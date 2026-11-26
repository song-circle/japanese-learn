import { useEffect, useMemo, useRef, useState } from 'react'
import { allSentences } from '../data/sentences'
import ShadowSpeak from './ShadowSpeak'
import {
  todayPlan, grade, retryDone, addBonus, boxOf, dueTomorrow, loadListen,
  NO_OPTIONS_FROM_BOX, NEW_PER_DAY,
} from '../utils/listenSrs'

// 듣고 맞히기
//   새 문장 : 상황만 보여 주고 듣기 → 뜻 4개 중 고르기 → 답·한글 발음·단어 풀이
//   복습    : 소리만 듣고 맞히기. 익숙한 문장(3단계~)은 보기 없이 떠올리고 스스로 채점
//   힌트    : 느리게 듣기(무료) · 한글 발음(-1점) · 첫 단어 뜻(-1점). 힌트 없이 맞히면 3점
//   따라 말하기: 답을 본 뒤 소리 내어 말하면 음성 인식으로 확인. 통하면 +1점(복습 간격과는 무관)

const audioUrl = (id, slow) => `${import.meta.env.BASE_URL}audio/${id}${slow ? '.slow' : ''}.mp3`
const shuffle = (xs) => {
  const a = [...xs]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// 오답 보기: 같은 상황의 다른 문장 뜻을 먼저, 모자라면 다른 상황에서
function optionsFor(s) {
  const same = shuffle(allSentences.filter((x) => x.situation === s.situation && x.id !== s.id))
  const other = shuffle(allSentences.filter((x) => x.situation !== s.situation))
  const wrong = [...same, ...other].map((x) => x.ko).filter((ko, i, arr) => ko !== s.ko && arr.indexOf(ko) === i).slice(0, 3)
  return shuffle([s.ko, ...wrong])
}

// 받침이 있으면 '이', 없으면 '가' (점원이 / 상대가)
const subj = (word) => {
  const c = word.charCodeAt(word.length - 1) - 0xac00
  return word + (c >= 0 && c < 11172 && c % 28 !== 0 ? '이' : '가')
}
const whoText = (who) => (who === '나' ? '내가 하는 말' : `${subj(who)} 하는 말`)

function ListenGuess({ onBack }) {
  const [queue, setQueue] = useState(null)   // [{ s, mode: 'new'|'review', retry, noOptions }]
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState(null) // 고른 보기, 또는 'self-right' / 'self-wrong'
  const [revealed, setRevealed] = useState(false) // 보기 없는 문제에서 답을 열었는지
  const [hints, setHints] = useState({ pron: false, word: false })
  const [showJa, setShowJa] = useState(false)
  const [session, setSession] = useState({ right: 0, wrong: 0, points: 0 })
  const audio = useRef(null)

  const plan = useMemo(() => todayPlan(allSentences), [])
  const current = queue?.[index]
  const s = current?.s
  // 보기 없이 낼지는 카드를 큐에 넣을 때 정한다(채점하면 단계가 바뀌므로 화면 도중에 다시 계산하지 않음)
  const noOptions = !!current?.noOptions
  const options = useMemo(() => (s ? optionsFor(s) : []), [s])
  const answered = picked !== null

  const play = (slow = false) => {
    if (!s) return
    audio.current?.pause()
    audio.current = new Audio(audioUrl(s.id, slow))
    audio.current.play().catch(() => {})
  }

  // 문제가 바뀔 때만 한 번 들려준다(틀려서 큐 끝에 문제가 붙을 때는 다시 틀지 않음)
  const started = queue !== null
  useEffect(() => {
    if (started) play()
    return () => audio.current?.pause()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, started])

  const start = () => {
    const q = [
      ...plan.reviews.map((x) => ({ s: x, mode: 'review', noOptions: boxOf(x.id) >= NO_OPTIONS_FROM_BOX })),
      ...plan.news.map((x) => ({ s: x, mode: 'new' })),
    ]
    setQueue(q)
    setIndex(0)
  }

  const finish = (correct) => {
    const used = (hints.pron ? 1 : 0) + (hints.word ? 1 : 0)
    const points = correct ? Math.max(1, 3 - used) : 0
    // 같은 학습에서 다시 나온 문제는 단계를 바꾸지 않고 다음 복습만 내일로
    if (current.retry) retryDone(s.id, points)
    else grade(s.id, correct, points)
    setSession((x) => ({
      right: x.right + (correct ? 1 : 0),
      wrong: x.wrong + (correct ? 0 : 1),
      points: x.points + points,
    }))
    // 틀린 문장은 이번 학습 끝에 한 번 더 (보기 있는 방식으로)
    if (!correct && !current.retry) setQueue((q) => [...q, { s, mode: 'review', retry: true }])
  }

  const choose = (opt) => {
    if (answered) return
    setPicked(opt)
    finish(opt === s.ko)
  }

  const speakPassed = () => {
    addBonus(1)
    setSession((x) => ({ ...x, points: x.points + 1 }))
  }

  const selfGrade = (correct) => {
    setPicked(correct ? 'self-right' : 'self-wrong')
    finish(correct)
  }

  const next = () => {
    setIndex((i) => i + 1)
    setPicked(null)
    setRevealed(false)
    setHints({ pron: false, word: false })
    setShowJa(false)
  }

  // ---------- 시작 화면 ----------
  if (!queue) {
    const state = loadListen()
    const learned = Object.keys(state.cards).length
    const nothing = plan.reviews.length + plan.news.length === 0
    return (
      <div className="fade-in">
        <header className="header">
          <button className="back-btn" onClick={onBack}>←</button>
          <h1>듣고 맞히기</h1>
        </header>
        <div className="content">
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem' }}>👂</div>
            <p style={{ margin: '0.5rem 0 1rem', color: 'var(--text-secondary)' }}>
              일본어를 먼저 듣고, 무슨 말인지 맞혀 보세요.<br />못 맞힌 문장은 자주, 맞힌 문장은 점점 드물게 다시 나와요.
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-around', margin: '1rem 0' }}>
              <div><div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{plan.reviews.length}</div><div style={{ color: 'var(--text-secondary)' }}>복습</div></div>
              <div><div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{plan.news.length}</div><div style={{ color: 'var(--text-secondary)' }}>새 문장</div></div>
              <div><div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{learned}/{allSentences.length}</div><div style={{ color: 'var(--text-secondary)' }}>배운 문장</div></div>
            </div>
            {nothing ? (
              <p>오늘 할 것은 다 했어요. 내일 다시 만나요! 🎉</p>
            ) : (
              <button className="btn" style={{ width: '100%' }} onClick={start}>시작하기 ▶</button>
            )}
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '1rem' }}>
              새 문장은 하루 {NEW_PER_DAY}개 · 누적 점수 {state.points}점
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ---------- 끝 ----------
  if (index >= queue.length) {
    return (
      <div className="fade-in">
        <header className="header">
          <button className="back-btn" onClick={onBack}>←</button>
          <h1>오늘 학습 끝</h1>
        </header>
        <div className="content">
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3rem' }}>🎉</div>
            <h2>{session.right} / {session.right + session.wrong} 맞혔어요</h2>
            <p style={{ fontSize: '1.3rem' }}>+{session.points}점</p>
            <p style={{ color: 'var(--text-secondary)' }}>내일 복습할 문장 {dueTomorrow()}개</p>
            <button className="btn" style={{ width: '100%', marginTop: '1rem' }} onClick={onBack}>홈으로</button>
          </div>
        </div>
      </div>
    )
  }

  // ---------- 문제 ----------
  const correctNow = picked === s.ko || picked === 'self-right'
  const showAnswer = answered || revealed
  return (
    <div className="fade-in">
      <header className="header">
        <button className="back-btn" onClick={onBack}>←</button>
        <h1>듣고 맞히기</h1>
        <span style={{ marginLeft: 'auto', color: 'var(--text-secondary)' }}>
          {index + 1} / {queue.length} · {session.points}점
        </span>
      </header>
      <div className="content">
        <div className="progress-bar" style={{ marginBottom: '1.5rem' }}>
          <div className="progress-fill" style={{ width: `${(index / queue.length) * 100}%` }} />
        </div>

        <div className="quiz-question-card">
          {current.mode === 'new' ? (
            <>
              <p className="quiz-subtitle">{s.icon} {s.scene} · {whoText(s.who)}</p>
              <p style={{ fontSize: '0.85rem', color: 'var(--accent)' }}>새 문장</p>
            </>
          ) : (
            <p className="quiz-subtitle">🎧 소리만 듣고 맞혀 보세요{current.retry ? ' (다시)' : ''}</p>
          )}
          <div className="listen-sound">
          <button className="quiz-sound-btn" onClick={() => play()} aria-label="다시 듣기">
            <svg viewBox="0 0 24 24" fill="white" width="32" height="32">
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
            </svg>
          </button>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '1rem' }}>
            <button className="btn-secondary btn" onClick={() => play(true)}>🐢 느리게</button>
            {!showAnswer && !hints.pron && <button className="btn-secondary btn" onClick={() => setHints((h) => ({ ...h, pron: true }))}>한글 발음 (-1점)</button>}
            {!showAnswer && !hints.word && s.words.length > 0 && <button className="btn-secondary btn" onClick={() => setHints((h) => ({ ...h, word: true }))}>첫 단어 뜻 (-1점)</button>}
          </div>
          {!showAnswer && hints.pron && <p style={{ fontSize: '1.4rem', marginTop: '1rem' }}>{s.pron}</p>}
          {!showAnswer && hints.word && <p style={{ marginTop: '0.5rem', color: 'var(--text-secondary)' }}>{s.words[0][1]} = {s.words[0][2]}</p>}
        </div>

        {/* 보기 */}
        {!noOptions && (
          <div className="listen-options">
            {options.map((opt) => {
              let cls = 'quiz-option'
              if (answered && opt === s.ko) cls += ' correct'
              else if (answered && opt === picked) cls += ' wrong'
              return (
                <button key={opt} className={cls} onClick={() => choose(opt)} disabled={answered}>{opt}</button>
              )
            })}
          </div>
        )}

        {/* 보기 없는 문제: 떠올리고 답 확인 → 스스로 채점 */}
        {noOptions && !revealed && (
          <button className="quiz-next-btn" onClick={() => setRevealed(true)}>뜻을 떠올렸으면 답 보기</button>
        )}
        {noOptions && revealed && !answered && (
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
            <button className="btn" style={{ flex: 1, background: '#4CAF50' }} onClick={() => selfGrade(true)}>맞혔어요</button>
            <button className="btn" style={{ flex: 1, background: '#F44336' }} onClick={() => selfGrade(false)}>몰랐어요</button>
          </div>
        )}

        {/* 답 풀이 */}
        {showAnswer && (
          <div className="card" style={{ marginTop: '1rem' }}>
            {answered && <p style={{ fontWeight: 700, color: correctNow ? '#4CAF50' : '#F44336' }}>{correctNow ? '정답! 🎉' : '아쉬워요'}</p>}
            <p style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0.25rem 0' }}>{s.pron}</p>
            <p style={{ fontSize: '1.1rem' }}>{s.ko}</p>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{s.icon} {s.scene} · {whoText(s.who)}</p>
            {s.words.length > 0 && (
              <ul style={{ margin: '0.75rem 0 0', paddingLeft: '1.2rem' }}>
                {s.words.map(([ja, pron, ko]) => (
                  <li key={ja}>{pron} <span style={{ color: 'var(--text-secondary)' }}>— {ko}{showJa ? ` (${ja})` : ''}</span></li>
                ))}
              </ul>
            )}
            <button className="btn-secondary btn" style={{ marginTop: '0.75rem' }} onClick={() => setShowJa((v) => !v)}>
              {showJa ? '일본어 글자 숨기기' : '일본어 글자 보기'}
            </button>
            {showJa && <p style={{ fontSize: '1.3rem', marginTop: '0.5rem' }}>{s.ja}</p>}
          </div>
        )}

        {answered && <ShadowSpeak key={index} sentence={s} onPass={speakPassed} />}

        {answered && (
          <button className="quiz-next-btn" onClick={next}>{index < queue.length - 1 ? '다음 →' : '결과 보기 🎯'}</button>
        )}
      </div>
    </div>
  )
}

export default ListenGuess

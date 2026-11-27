import { useEffect, useMemo, useRef, useState } from 'react'
import { allSentences } from '../data/sentences'
import ShadowSpeak from './ShadowSpeak'
import {
  todayPlan, grade, retryDone, addBonus, dueTomorrow, loadListen, NEW_PER_DAY,
} from '../utils/listenSrs'
import { optionsFor, shuffle } from '../utils/distractors'
import { clozeFor } from '../utils/cloze'
import { LEVELS, makeLevels, questionType } from '../utils/levels'
import { playReal, stopNoise } from '../utils/realSound'
import { markStepDone } from '../utils/course'

// 듣고 맞히기 (PC 앱과 같은 방식, 단계식)
//   문장마다 단계(0~3)가 있고, 힌트 없이 첫 답을 맞히면 오르고 틀리면 내려간다(힌트 쓰고 맞히면 그대로).
//     0 뜻 고르기   : 보기 5개, 오답은 소리가 비슷한 문장 위주
//     1 뜻 떠올리기 : 보기 없이 떠올리고 정답을 본 뒤 스스로 채점
//     2 빈칸 듣기   : 한글 발음 문장의 한 단어가 빈칸. 들린 단어를 발음이 비슷한 5개 중에서
//     3 실전 소리   : 빈칸 듣기를 1.25배 속도 + 가게 소음으로
//   새 문장은 늘 뜻 고르기. 장면 설명(어디서·누가)은 답을 낸 뒤에만 보여 준다.
//   힌트: 처음엔 숨김. 💡를 누를 때마다 하나씩(각 -1점). 느리게 듣기는 무료
//   틀리면 정답을 알려 주지 않고 그 보기만 막은 뒤 다시 들려준다. 채점은 첫 번째로 고른 답으로
//   따라 말하기: 답을 본 뒤 소리 내어 말하면 음성 인식으로 확인. 통하면 +1점(복습 간격과는 무관)

const audioUrl = (id, slow) => `${import.meta.env.BASE_URL}audio/${id}${slow ? '.slow' : ''}.mp3`
const levels = makeLevels('listen-levels')

// 받침이 있으면 '이', 없으면 '가' (점원이 / 상대가)
const subj = (word) => {
  const c = word.charCodeAt(word.length - 1) - 0xac00
  return word + (c >= 0 && c < 11172 && c % 28 !== 0 ? '이' : '가')
}
const whoText = (who) => (who === '나' ? '내가 하는 말' : `${subj(who)} 하는 말`)

// 큐에 넣을 때 문제 형식을 정한다(채점하면 단계가 바뀌므로 화면 도중에 다시 계산하지 않음)
function reviewItem(s) {
  const level = levels.levelOf(s.id)
  const cloze = level >= 2 ? clozeFor(s, allSentences) : null
  return { s, mode: 'review', level, cloze, ...questionType(level, !!cloze) }
}
const chooseItem = (s, mode, extra = {}) => ({ s, mode, level: 0, cloze: null, type: 'choose', real: false, ...extra })

function ListenGuess({ onBack }) {
  const [queue, setQueue] = useState(null)   // [{ s, mode, level, type: 'choose'|'recall'|'cloze', real, cloze, retry }]
  const [index, setIndex] = useState(0)
  const [first, setFirst] = useState(null)   // 첫 번째 답이 맞았는지(채점 기준). 아직이면 null
  const [done, setDone] = useState(null)     // 정답을 보여 주는 중: 'right' | 'gaveup'
  const [wrongs, setWrongs] = useState([])   // 틀리게 고른 보기
  const [removed, setRemoved] = useState([]) // 힌트로 지운 보기
  const [revealed, setRevealed] = useState(false) // 떠올리기 문제에서 답을 열었는지
  const [hintLevel, setHintLevel] = useState(0)
  const [levelChange, setLevelChange] = useState(0)
  const [showJa, setShowJa] = useState(false)
  const [session, setSession] = useState({ right: 0, wrong: 0, points: 0 })
  const audio = useRef(null)

  const plan = useMemo(() => todayPlan(allSentences), [])
  const current = queue?.[index]
  const s = current?.s
  const type = current?.type
  const options = useMemo(() => {
    if (!current) return []
    if (current.type === 'cloze') return current.cloze.options
    if (current.type === 'choose') return optionsFor(current.s, allSentences)
    return []
  }, [current])
  const answer = type === 'cloze' ? current.cloze.answer : s?.ko
  const steps = !current ? []
    : type === 'cloze' ? ['meaning', 'fifty']
    : ['pron', ...(s.words.length ? ['word'] : []), ...(type === 'choose' ? ['fifty'] : [])]
  const opened = steps.slice(0, hintLevel)

  const play = (slow = false) => {
    if (!s) return
    audio.current?.pause()
    stopNoise()
    audio.current = new Audio(audioUrl(s.id, slow))
    if (current.real && !slow && !done) playReal(audio.current)
    else audio.current.play().catch(() => {})
  }

  // 문제가 바뀔 때만 한 번 들려준다(틀려서 큐 끝에 문제가 붙을 때는 다시 틀지 않음)
  const started = queue !== null
  useEffect(() => {
    if (started) play()
    return () => {
      audio.current?.pause()
      stopNoise()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, started])

  // 끝까지 했으면 30일 코스의 오늘 단계를 끝으로 표시
  const over = queue !== null && index >= queue.length
  useEffect(() => {
    if (over) markStepDone('listen')
  }, [over])

  const start = () => {
    setQueue([...plan.reviews.map(reviewItem), ...plan.news.map((x) => chooseItem(x, 'new'))])
    setIndex(0)
  }

  // 첫 번째 답으로 채점: 맞으면 (3 + 단계)점에서 연 힌트 수만큼 빼고(최소 1점). 단계도 오르내림
  const gradeFirst = (correct) => {
    setFirst(correct)
    const points = correct ? Math.max(1, 3 + current.level - hintLevel) : 0
    // 같은 학습에서 다시 나온 문제는 복습 단계를 바꾸지 않고 다음 복습만 내일로
    if (current.retry) retryDone(s.id, points)
    else grade(s.id, correct, points)
    if (current.mode !== 'new' || correct) setLevelChange(levels.update(s.id, correct, hintLevel > 0))
    setSession((x) => ({
      right: x.right + (correct ? 1 : 0),
      wrong: x.wrong + (correct ? 0 : 1),
      points: x.points + points,
    }))
    // 틀린 문장은 이번 학습 끝에 한 번 더 (뜻 고르기로)
    if (!correct && !current.retry) setQueue((q) => [...q, chooseItem(s, 'review', { retry: true, level: levels.levelOf(s.id) })])
  }

  const choose = (opt) => {
    if (done || wrongs.includes(opt) || removed.includes(opt)) return
    const correct = opt === answer
    if (first === null) gradeFirst(correct)
    if (correct) {
      setDone('right')
      stopNoise()
    } else {
      // 틀려도 정답은 알려 주지 않는다. 그 보기만 막고 한 번 더 들려준다
      setWrongs((w) => [...w, opt])
      setTimeout(() => play(), 350)
    }
  }

  const giveUp = () => {
    if (done) return
    if (first === null) gradeFirst(false)
    setDone('gaveup')
    stopNoise()
    audio.current?.pause()
    audio.current = new Audio(audioUrl(s.id))
    audio.current.play().catch(() => {})
  }

  const selfGrade = (correct) => {
    gradeFirst(correct)
    setDone(correct ? 'right' : 'gaveup')
  }

  const nextHint = () => {
    if (done || hintLevel >= steps.length) return
    if (steps[hintLevel] === 'fifty') {
      const left = options.filter((o) => o !== answer && !wrongs.includes(o))
      setRemoved(shuffle(left).slice(0, 2))
    }
    setHintLevel((h) => h + 1)
  }

  const speakPassed = () => {
    addBonus(1)
    setSession((x) => ({ ...x, points: x.points + 1 }))
  }

  const next = () => {
    setIndex((i) => i + 1)
    setFirst(null)
    setDone(null)
    setWrongs([])
    setRemoved([])
    setRevealed(false)
    setHintLevel(0)
    setLevelChange(0)
    setShowJa(false)
  }

  // ---------- 시작 화면 ----------
  if (!queue) {
    const state = loadListen()
    const learned = Object.keys(state.cards).length
    const nothing = plan.reviews.length + plan.news.length === 0
    const lv = levels.load()
    const byLevel = LEVELS.map((_, i) => Object.keys(state.cards).filter((id) => (lv[id] ?? 0) === i).length)
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
              일본어를 먼저 듣고, 무슨 말인지 맞혀 보세요.<br />맞힐수록 뜻 고르기 → 뜻 떠올리기 → 빈칸 듣기 → 실전 소리로 어려워져요.
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-around', margin: '1rem 0' }}>
              <div><div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{plan.reviews.length}</div><div style={{ color: 'var(--text-secondary)' }}>복습</div></div>
              <div><div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{plan.news.length}</div><div style={{ color: 'var(--text-secondary)' }}>새 문장</div></div>
              <div><div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{learned}/{allSentences.length}</div><div style={{ color: 'var(--text-secondary)' }}>배운 문장</div></div>
            </div>
            {learned > 0 && (
              <div style={{ display: 'flex', gap: '0.3rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '1rem', fontSize: '0.8rem' }}>
                {LEVELS.map((name, i) => <span key={name} className={`lv-chip lv${i}`}>Lv{i} {name} {byLevel[i]}</span>)}
              </div>
            )}
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
  if (over) {
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
  const newLv = levels.levelOf(s.id)
  const lvMsg = levelChange > 0 ? ` · ⬆ Lv${newLv} ${LEVELS[newLv]}로` : levelChange < 0 ? ` · ⬇ Lv${newLv}로` : ''
  const verdict = type === 'recall'
    ? (done === 'right' ? ['#4CAF50', `떠올렸어요 👍${lvMsg}`] : ['#F44336', `다음에 다시 나와요${lvMsg}`])
    : done === 'gaveup' ? ['#F44336', `정답은 이거예요${lvMsg}`]
    : first ? ['#4CAF50', `정답! 🎉${lvMsg}`] : ['#FF9800', `맞혔어요 (${wrongs.length + 1}번째에)${lvMsg}`]
  const ask = type === 'recall' ? '🧠 소리만 듣고 뜻을 떠올려 보세요'
    : type === 'cloze' ? (current.real ? '🔊 빠르고 시끄러워요. 빈칸에 들린 말을 고르세요' : '✏️ 빈칸에 들린 말을 고르세요')
    : `🎧 소리만 듣고 뜻을 골라 보세요${current.retry ? ' (다시)' : ''}`
  const lvShown = type === 'recall' && current.level >= 2 ? 1 : current.level
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
          <p className="quiz-subtitle">
            {current.mode === 'new'
              ? <span style={{ color: 'var(--accent)', fontWeight: 700 }}>새 문장 · </span>
              : <span className={`lv-chip lv${lvShown}`}>Lv{lvShown} {LEVELS[lvShown]}</span>}
            {' '}{ask}
          </p>
          <div className="listen-sound">
            <button className="quiz-sound-btn" onClick={() => play()} aria-label="다시 듣기">
              <svg viewBox="0 0 24 24" fill="white" width="32" height="32">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
              </svg>
            </button>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '1rem' }}>
            <button className="btn-secondary btn" onClick={() => play(true)}>🐢 느리게</button>
            {!done && !revealed && hintLevel < steps.length && (
              <button className="btn-secondary btn" onClick={nextHint}>💡 힌트{first === null ? ' (-1점)' : ''}</button>
            )}
          </div>
          {type === 'cloze' && !done && (
            <p className="cloze-line">
              {current.cloze.masked.split('____')[0]}<span className="cloze-blank">____</span>{current.cloze.masked.split('____')[1]}
            </p>
          )}
          {!done && opened.includes('pron') && <p style={{ fontSize: '1.4rem', marginTop: '1rem' }}>{s.pron}</p>}
          {!done && opened.includes('word') && <p style={{ marginTop: '0.5rem', color: 'var(--text-secondary)' }}>첫 단어: {s.words[0][1]} = {s.words[0][2]}</p>}
          {!done && opened.includes('meaning') && <p style={{ marginTop: '0.5rem', color: 'var(--text-secondary)' }}>문장 뜻: {s.ko}</p>}
          {!done && wrongs.length > 0 && <p style={{ marginTop: '0.75rem', color: '#F44336' }}>✗ 아니에요. 다시 듣고 골라 보세요</p>}
        </div>

        {/* 보기 (뜻 고르기·빈칸 듣기) */}
        {type !== 'recall' && (
          <div className="listen-options">
            {options.map((opt) => {
              let cls = 'quiz-option'
              if (done && opt === answer) cls += ' correct'
              else if (wrongs.includes(opt)) cls += ' wrong'
              const gone = removed.includes(opt) && !wrongs.includes(opt)
              return (
                <button key={opt} className={cls} onClick={() => choose(opt)}
                  disabled={!!done || wrongs.includes(opt) || removed.includes(opt)}
                  style={gone ? { opacity: 0.3, textDecoration: 'line-through' } : undefined}>
                  {opt}
                </button>
              )
            })}
          </div>
        )}
        {type !== 'recall' && !done && (
          <button className="btn-secondary btn" style={{ width: '100%', marginTop: '0.75rem' }} onClick={giveUp}>포기 (정답 보기)</button>
        )}

        {/* 떠올리기: 답 확인 → 스스로 채점 */}
        {type === 'recall' && !revealed && (
          <button className="quiz-next-btn" onClick={() => setRevealed(true)}>뜻을 떠올렸으면 답 보기</button>
        )}
        {type === 'recall' && revealed && !done && (
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
            <button className="btn" style={{ flex: 1, background: '#4CAF50' }} onClick={() => selfGrade(true)}>떠올렸어요</button>
            <button className="btn" style={{ flex: 1, background: '#F44336' }} onClick={() => selfGrade(false)}>몰랐어요</button>
          </div>
        )}

        {/* 답 풀이 */}
        {(done || revealed) && (
          <div className="card" style={{ marginTop: '1rem' }}>
            {done && <p style={{ fontWeight: 700, color: verdict[0] }}>{verdict[1]}</p>}
            <p style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0.25rem 0' }}>{s.pron}</p>
            <p style={{ fontSize: '1.1rem' }}>{s.ko}</p>
            {type === 'cloze' && <p>빈칸: <b>{current.cloze.answer}</b> = {current.cloze.answerKo}</p>}
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

        {done && <ShadowSpeak key={index} sentence={s} onPass={speakPassed} />}

        {done && (
          <button className="quiz-next-btn" onClick={next}>{index < queue.length - 1 ? '다음 →' : '결과 보기 🎯'}</button>
        )}
      </div>
    </div>
  )
}

export default ListenGuess

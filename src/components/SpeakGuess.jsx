import { useEffect, useMemo, useRef, useState } from 'react'
import { allSentences } from '../data/sentences'
import { speak as srs, speakSentences } from '../utils/listenSrs'
import { recognitionAvailable, listenOnce, stopListening, bestMatch, PASS } from '../utils/speechRec'
import { azureReady, assessOnce, stopAssess, pronErrorText } from '../utils/pronounce'
import { loadAiSettings } from '../utils/aiTalk'
import PronScore from './PronScore'
import { markStepDone } from '../utils/course'

// 말해서 맞히기: 한국어 뜻을 보고 일본어로 말한다 (실제 회화처럼 내가 먼저 떠올려 말하기)
//   대상   : 듣고 맞히기에서 이미 들어 본 '나'의 문장
//   채점   : 첫 번째로 말한 것으로 맞음/틀림을 정한다. 알아들은 말이 문장과 80% 이상 같으면 맞음
//            Azure 키가 있으면 발음 점수도 보여 준다. 그 뒤에는 원어민 음성을 듣고 몇 번이든 다시 말해 볼 수 있다
//   힌트   : 첫 단어 발음(-2점). 힌트 없이 맞히면 3점
//   마이크를 못 쓰는 기기: 소리 내어 말한 뒤 답을 보고 스스로 채점

const audioUrl = (id, slow) => `${import.meta.env.BASE_URL}audio/${id}${slow ? '.slow' : ''}.mp3`

function SpeakGuess({ onBack }) {
  const [settings] = useState(loadAiSettings)
  const azure = azureReady(settings)
  const [micOk, setMicOk] = useState(null)
  const [queue, setQueue] = useState(null) // [{ s, retry }]
  const [index, setIndex] = useState(0)
  const [hint, setHint] = useState(false)
  const [state, setState] = useState('ask') // ask | listening | graded
  const [first, setFirst] = useState(null)  // 첫 시도 결과 { correct, text, pron }
  const [again, setAgain] = useState(null)  // 다시 말해 본 결과 { score, text, pron }
  const [error, setError] = useState('')
  const [session, setSession] = useState({ right: 0, wrong: 0, points: 0 })
  const audio = useRef(null)

  const pool = useMemo(() => speakSentences(allSentences), [])
  const plan = useMemo(() => srs.todayPlan(pool), [pool])
  const current = queue?.[index]
  const s = current?.s

  useEffect(() => {
    let alive = true
    ;(azure ? Promise.resolve(true) : recognitionAvailable()).then((ok) => alive && setMicOk(ok))
    return () => {
      alive = false
      stopListening()
      stopAssess()
      audio.current?.pause()
    }
  }, [azure])

  const play = (slow = false) => {
    audio.current?.pause()
    audio.current = new Audio(audioUrl(s.id, slow))
    audio.current.play().catch(() => {})
  }

  const start = () => {
    setQueue([...plan.reviews, ...plan.news].map((x) => ({ s: x })))
    setIndex(0)
  }

  // 한 번 듣고 { text, score, pron } 돌려준다. 못 들었으면 null
  const hear = async () => {
    if (azure) {
      const r = await assessOnce(settings, s.ja)
      if (!r?.text) return null
      return { text: r.text, score: bestMatch(s, [r.text]).score, pron: r }
    }
    const heard = await listenOnce()
    if (!heard.length) return null
    const best = bestMatch(s, heard)
    return { text: best.text, score: best.score, pron: null }
  }

  const finish = (correct) => {
    const points = correct ? (hint ? 1 : 3) : 0
    if (current.retry) srs.retryDone(s.id, points)
    else srs.grade(s.id, correct, points)
    setSession((x) => ({
      right: x.right + (correct ? 1 : 0),
      wrong: x.wrong + (correct ? 0 : 1),
      points: x.points + points,
    }))
    // 틀린 문장은 이번 학습 끝에 한 번 더
    if (!correct && !current.retry) setQueue((q) => [...q, { s, retry: true }])
    setState('graded')
  }

  const say = async () => {
    if (state === 'listening') {
      stopListening()
      stopAssess()
      return
    }
    const graded = state === 'graded'
    setState('listening')
    setError('')
    try {
      const r = await hear()
      if (!r) {
        setError('소리를 못 들었어요. 마이크 가까이에서 다시 말해 보세요.')
        setState(graded ? 'graded' : 'ask')
        return
      }
      if (graded) {
        setAgain(r)
        setState('graded')
      } else {
        setFirst({ ...r, correct: r.score >= PASS })
        finish(r.score >= PASS)
      }
    } catch (e) {
      setError(azure ? pronErrorText(e)
        : e?.message === 'permission' ? '마이크 권한이 필요해요.' : `음성 인식 오류: ${e?.message ?? e}`)
      setState(graded ? 'graded' : 'ask')
    }
  }

  // 모르겠어요 / (마이크 없는 기기) 스스로 채점
  const giveUp = () => {
    setFirst({ correct: false, text: '', score: 0, pron: null, gaveUp: true })
    finish(false)
  }
  const selfGrade = (correct) => {
    setFirst({ correct, text: '', score: 0, pron: null, self: true })
    finish(correct)
  }

  const next = () => {
    audio.current?.pause()
    setIndex((i) => i + 1)
    setHint(false)
    setState('ask')
    setFirst(null)
    setAgain(null)
    setError('')
  }

  // 정답을 보여 줄 때 원어민 음성을 한 번 들려준다
  useEffect(() => {
    if (state === 'graded' && s) play()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state === 'graded', index])

  // 끝까지 했으면 30일 코스의 오늘 단계를 끝으로 표시
  const over = queue !== null && index >= queue.length
  useEffect(() => {
    if (over) markStepDone('speak')
  }, [over])

  const header = (title, right) => (
    <header className="header">
      <button className="back-btn" onClick={onBack}>←</button>
      <h1>{title}</h1>
      {right && <span style={{ marginLeft: 'auto', color: 'var(--text-secondary)' }}>{right}</span>}
    </header>
  )

  // ---------- 시작 화면 ----------
  if (!queue) {
    const st = srs.load()
    const nothing = plan.reviews.length + plan.news.length === 0
    return (
      <div className="fade-in">
        {header('말해서 맞히기')}
        <div className="content">
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem' }}>🎤</div>
            <p style={{ margin: '0.5rem 0 1rem', color: 'var(--text-secondary)' }}>
              한국어 뜻을 보고 일본어로 말해 보세요.<br />듣고 맞히기에서 들어 본 &apos;내가 하는 말&apos;이 나와요.
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-around', margin: '1rem 0' }}>
              <div><div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{plan.reviews.length}</div><div style={{ color: 'var(--text-secondary)' }}>복습</div></div>
              <div><div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{plan.news.length}</div><div style={{ color: 'var(--text-secondary)' }}>새 문장</div></div>
              <div><div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{Object.keys(st.cards).length}/{pool.length}</div><div style={{ color: 'var(--text-secondary)' }}>말해 본 문장</div></div>
            </div>
            {pool.length === 0 ? (
              <p>먼저 👂 듣고 맞히기로 문장을 들어 보세요. 들어 본 문장부터 여기에 나와요.</p>
            ) : nothing ? (
              <p>오늘 할 것은 다 했어요. 듣고 맞히기에서 새 문장을 들으면 여기에도 생겨요. 🎉</p>
            ) : (
              <button className="btn" style={{ width: '100%' }} onClick={start}>시작하기 ▶</button>
            )}
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '1rem' }}>
              누적 점수 {st.points}점{azure ? ' · 발음 점수 켜짐' : ' · AI 회화 ⚙️ 설정에 Azure 키를 넣으면 발음 점수도 나와요'}
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
        {header('오늘 말하기 끝')}
        <div className="content">
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3rem' }}>🎉</div>
            <h2>{session.right} / {session.right + session.wrong} 말했어요</h2>
            <p style={{ fontSize: '1.3rem' }}>+{session.points}점</p>
            <p style={{ color: 'var(--text-secondary)' }}>내일 복습할 문장 {srs.dueTomorrow()}개</p>
            <button className="btn" style={{ width: '100%', marginTop: '1rem' }} onClick={onBack}>돌아가기</button>
          </div>
        </div>
      </div>
    )
  }

  // ---------- 문제 ----------
  const graded = state === 'graded'
  const firstWord = s.words[0]
  return (
    <div className="fade-in">
      {header('말해서 맞히기', `${index + 1} / ${queue.length} · ${session.points}점`)}
      <div className="content">
        <div className="progress-bar" style={{ marginBottom: '1.5rem' }}>
          <div className="progress-fill" style={{ width: `${(index / queue.length) * 100}%` }} />
        </div>

        <div className="quiz-question-card">
          <p className="quiz-subtitle">{s.icon} {s.scene}{current.retry ? ' (다시)' : ''}</p>
          <p style={{ fontSize: '1.6rem', fontWeight: 700, margin: '0.75rem 0' }}>“{s.ko}”</p>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>일본어로 말해 보세요</p>
          {!graded && !hint && firstWord && (
            <button className="btn-secondary btn" onClick={() => setHint(true)}>첫 단어 힌트 (-2점)</button>
          )}
          {!graded && hint && firstWord && (
            <p style={{ fontSize: '1.2rem', marginTop: '0.5rem' }}>{firstWord[1]} <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>({firstWord[2]}) …</span></p>
          )}
        </div>

        {/* 말하기 */}
        {!graded && micOk && (
          <>
            <button className={`btn mic-btn${state === 'listening' ? ' listening' : ''}`} style={{ width: '100%', marginTop: '1rem', padding: '1rem' }} onClick={say}>
              {state === 'listening' ? '듣는 중… (누르면 멈춤)' : '🎤 일본어로 말하기'}
            </button>
            {state !== 'listening' && (
              <button className="btn-secondary btn" style={{ width: '100%', marginTop: '0.5rem' }} onClick={giveUp}>모르겠어요 (답 보기)</button>
            )}
          </>
        )}
        {!graded && micOk === false && (
          <>
            <p style={{ color: 'var(--text-secondary)', marginTop: '1rem' }}>이 기기에서는 음성 인식을 쓸 수 없어요. 소리 내어 말한 뒤 답을 보고 스스로 채점하세요.</p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn" style={{ flex: 1, background: '#4CAF50' }} onClick={() => selfGrade(true)}>말했어요</button>
              <button className="btn" style={{ flex: 1, background: '#F44336' }} onClick={() => selfGrade(false)}>몰랐어요</button>
            </div>
          </>
        )}
        {error && <p style={{ color: '#F44336', marginTop: '0.75rem' }}>{error}</p>}

        {/* 정답·결과 */}
        {graded && (
          <div className="card" style={{ marginTop: '1rem' }}>
            {!first.self && (
              <p style={{ fontWeight: 700, color: first.correct ? '#4CAF50' : '#F44336', marginTop: 0 }}>
                {first.correct ? '통했어요! 🎉' : first.gaveUp ? '이렇게 말해요' : '아쉬워요. 이렇게 말해요'}
                {first.text && ` (${Math.round(first.score * 100)}%)`}
              </p>
            )}
            {first.text && <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 0.5rem' }}>앱이 알아들은 말: {first.text}</p>}
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <button className="btn-secondary btn ai-small" onClick={() => play()}>🔊</button>
              <button className="btn-secondary btn ai-small" onClick={() => play(true)}>🐢</button>
              <span style={{ fontSize: '1.5rem', fontWeight: 700 }}>{s.pron}</span>
            </div>
            <p style={{ margin: '0.4rem 0 0', fontSize: '1.2rem' }}>{s.ja}</p>
            {s.words.length > 0 && (
              <ul style={{ margin: '0.75rem 0 0', paddingLeft: '1.2rem' }}>
                {s.words.map(([ja, pron, ko]) => (
                  <li key={ja}>{pron} <span style={{ color: 'var(--text-secondary)' }}>— {ko}</span></li>
                ))}
              </ul>
            )}
            {first.pron && (
              <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <PronScore key={`first-${index}`} result={first.pron} settings={settings} />
              </div>
            )}
          </div>
        )}

        {/* 원어민 듣고 다시 말해 보기 (점수와 복습 간격에는 영향 없음) */}
        {graded && micOk && (
          <div className="card shadow-speak" style={{ marginTop: '1rem', textAlign: 'center' }}>
            <p style={{ fontWeight: 700, margin: 0 }}>🗣️ 들은 대로 다시 말해 보기</p>
            <button className={`btn mic-btn${state === 'listening' ? ' listening' : ''}`} style={{ width: '100%', marginTop: '0.75rem' }} onClick={say}>
              {state === 'listening' ? '듣는 중… (누르면 멈춤)' : '🎤 다시 말하기'}
            </button>
            {again && (
              <div style={{ marginTop: '0.75rem', textAlign: 'left' }}>
                <p style={{ fontWeight: 700, color: again.score >= PASS ? '#4CAF50' : '#FF9800', margin: 0 }}>
                  {again.score >= PASS ? '잘 통했어요! 👍' : '한 번 더!'} ({Math.round(again.score * 100)}%)
                </p>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0.5rem' }}>앱이 알아들은 말: {again.text}</p>
                {again.pron && <PronScore key={again.text + again.pron.pron} result={again.pron} settings={settings} />}
              </div>
            )}
          </div>
        )}

        {graded && state !== 'listening' && (
          <button className="quiz-next-btn" onClick={next}>{index < queue.length - 1 ? '다음 →' : '결과 보기 🎯'}</button>
        )}
      </div>
    </div>
  )
}

export default SpeakGuess

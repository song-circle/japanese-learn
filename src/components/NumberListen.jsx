import { useEffect, useState } from 'react'
import { KINDS, makeQuestion } from '../utils/numberJa'
import { speakJa, stopSpeaking } from '../utils/ttsJa'
import { markStepDone } from '../utils/course'

// 숫자 듣기: 점원이 말하는 가격·시간·개수·인원을 듣고 숫자로 입력한다.
//   한 번에 10문제, 매번 다른 숫자. 소리는 기기 TTS(가나로 넘겨서 3百·4時 같은 예외도 바르게 읽음)
//   시간은 '시'와 '분'을 붙여서 입력(3시 15분 = 315, 9시 = 9 또는 900). 오전·오후는 입력하지 않는다

const KEY = 'japanese-learn-numbers'
const ROUND = 10

function loadStats() {
  try {
    return { rounds: 0, right: 0, total: 0, ...JSON.parse(localStorage.getItem(KEY) || '{}') }
  } catch {
    return { rounds: 0, right: 0, total: 0 }
  }
}

// 입력한 숫자를 보기 좋게
function display(kind, v) {
  if (!v) return ''
  if (kind === 'price') return `${Number(v).toLocaleString('ko-KR')}엔`
  if (kind === 'time') {
    if (v.length <= 2) return `${v}시`
    return `${v.slice(0, -2)}시 ${v.slice(-2)}분`
  }
  return `${v}${kind === 'count' ? '개' : '명'}`
}

// 시간 입력 맞추기: '9' → '900'
const normalize = (kind, v) => (kind === 'time' && v.length <= 2 ? `${Number(v)}00` : String(Number(v)))

function NumberListen({ onBack }) {
  const [kind, setKind] = useState(null) // 'price' | 'time' | 'count' | 'people' | 'mix'
  const [q, setQ] = useState(null)
  const [n, setN] = useState(0)
  const [input, setInput] = useState('')
  const [result, setResult] = useState(null) // null | true | false
  const [score, setScore] = useState(0)
  const [showPron, setShowPron] = useState(false)
  const [stats, setStats] = useState(loadStats)

  useEffect(() => () => stopSpeaking(), [])

  const newQuestion = (k) => {
    const next = makeQuestion(k)
    setQ(next)
    setInput('')
    setResult(null)
    setShowPron(false)
    speakJa(next.ja).catch(() => {})
  }

  const start = (k) => {
    setKind(k)
    setN(0)
    setScore(0)
    newQuestion(k)
  }

  const press = (key) => {
    if (result !== null) return
    if (key === '⌫') setInput((v) => v.slice(0, -1))
    else if (input.length < 6) setInput((v) => (v === '' && key === '0' ? v : v + key))
  }

  const check = () => {
    if (!input || result !== null) return
    const ok = normalize(q.kind, input) === q.answer
    setResult(ok)
    if (ok) setScore((s) => s + 1)
  }

  const next = () => {
    const done = n + 1
    if (done >= ROUND) {
      const s = loadStats()
      const updated = { rounds: s.rounds + 1, right: s.right + score, total: s.total + ROUND }
      localStorage.setItem(KEY, JSON.stringify(updated))
      markStepDone('numbers')
      setStats(updated)
      setN(done)
      setQ(null)
      return
    }
    setN(done)
    newQuestion(kind)
  }

  const header = (
    <header className="header">
      <button className="back-btn" onClick={() => { stopSpeaking(); kind ? setKind(null) : onBack() }}>←</button>
      <h1>숫자 듣기</h1>
      {q && <span style={{ marginLeft: 'auto', color: 'var(--text-secondary)' }}>{n + 1} / {ROUND} · {score}점</span>}
    </header>
  )

  // ---------- 고르기 ----------
  if (!kind) {
    return (
      <div className="fade-in">
        {header}
        <div className="content">
          <p style={{ color: 'var(--text-secondary)', marginTop: 0 }}>
            점원이 말하는 가격·시간·개수를 듣고 숫자로 입력해 보세요. 매번 다른 숫자가 나와요.
          </p>
          {[...KINDS, { id: 'mix', name: '섞어서', icon: '🎲', unit: '전부' }].map((k) => (
            <div key={k.id} className="card" style={{ cursor: 'pointer', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }} onClick={() => start(k.id)}>
              <div style={{ fontSize: '2rem' }}>{k.icon}</div>
              <div style={{ flex: 1, fontWeight: 700 }}>{k.name} <span style={{ fontWeight: 400, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>({k.unit})</span></div>
              <div>▶</div>
            </div>
          ))}
          {stats.total > 0 && (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              지금까지 {stats.rounds}번 · 정답률 {Math.round((stats.right / stats.total) * 100)}%
            </p>
          )}
        </div>
      </div>
    )
  }

  // ---------- 끝 ----------
  if (!q) {
    return (
      <div className="fade-in">
        {header}
        <div className="content">
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3rem' }}>{score >= 8 ? '🎉' : '💪'}</div>
            <h2>{score} / {ROUND} 맞혔어요</h2>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button className="btn-secondary btn" style={{ flex: 1 }} onClick={() => setKind(null)}>다른 종류</button>
              <button className="btn" style={{ flex: 1 }} onClick={() => start(kind)}>한 번 더</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ---------- 문제 ----------
  const info = KINDS.find((k) => k.id === q.kind)
  return (
    <div className="fade-in">
      {header}
      <div className="content">
        <div className="quiz-question-card">
          <p className="quiz-subtitle">{info.icon} {q.scene} · {info.name}</p>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', margin: '0.75rem 0' }}>
            <button className="btn" onClick={() => speakJa(q.ja)}>🔊 다시 듣기</button>
            <button className="btn-secondary btn" onClick={() => speakJa(q.ja, true)}>🐢 느리게</button>
          </div>
          <div className="num-display">
            {display(q.kind, input) || <span style={{ opacity: 0.4 }}>{q.kind === 'time' ? '예: 3시 15분 = 315' : '숫자를 입력하세요'}</span>}
          </div>
        </div>

        {result === null ? (
          <>
            <div className="num-pad">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0'].map((k) => (
                <button key={k} className="btn-secondary btn" onClick={() => press(k)}>{k}</button>
              ))}
              <button className="btn" disabled={!input} onClick={check}>확인</button>
            </div>
            {!showPron && (
              <button className="btn-secondary btn" style={{ width: '100%', marginTop: '0.5rem' }} onClick={() => setShowPron(true)}>한글 발음 보기 (힌트)</button>
            )}
            {showPron && <p style={{ textAlign: 'center', fontSize: '1.2rem' }}>{q.pron}</p>}
          </>
        ) : (
          <div className="card" style={{ marginTop: '1rem' }}>
            <p style={{ fontWeight: 700, color: result ? '#4CAF50' : '#F44336', marginTop: 0 }}>
              {result ? '정답! 🎉' : `아쉬워요. 정답: ${q.show}`}
            </p>
            <p style={{ fontSize: '1.3rem', fontWeight: 700, margin: '0.25rem 0' }}>{q.pron}</p>
            <p style={{ margin: 0 }}>{q.ko}</p>
            <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem' }}>
              <button className="btn-secondary btn ai-small" onClick={() => speakJa(q.ja)}>🔊</button>
              <button className="btn-secondary btn ai-small" onClick={() => speakJa(q.ja, true)}>🐢</button>
            </div>
            <button className="quiz-next-btn" onClick={next}>{n + 1 < ROUND ? '다음 →' : '결과 보기 🎯'}</button>
          </div>
        )}
      </div>
    </div>
  )
}

export default NumberListen

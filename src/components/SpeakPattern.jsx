import { useEffect, useRef, useState } from 'react'
import { patterns, patternSentences } from '../data/patterns'
import { recognitionAvailable, listenOnce, stopListening, bestMatch, PASS } from '../utils/speechRec'
import { azureReady, assessOnce, stopAssess, pronErrorText } from '../utils/pronounce'
import { loadAiSettings } from '../utils/aiTalk'
import { shuffle } from '../utils/distractors'
import PronScore from './PronScore'

// 패턴 바꿔 말하기: '〜をください' 같은 틀에 단어를 바꿔 넣어 말한다.
//   한국어(물 주세요)를 보고 일본어로 말하면 첫 시도로 채점(80% 이상 통하면 맞음). Azure 키가 있으면 발음 점수도
//   힌트: 틀(〜오 쿠다사이) → 단어(오미즈) 순서로 하나씩. 정답을 본 뒤 원어민 음성을 듣고 다시 말해 볼 수 있다
//   기록: 문장마다 맞힌 횟수(localStorage). 틀 목록에 '말해 본 단어 수'로 보여 준다

const KEY = 'japanese-learn-patterns'
const ROUND = 8
const audioUrl = (id, slow) => `${import.meta.env.BASE_URL}audio/${id}${slow ? '.slow' : ''}.mp3`

function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}')
  } catch {
    return {}
  }
}
function record(id, correct) {
  const p = loadProgress()
  const x = p[id] ?? { right: 0, wrong: 0 }
  x[correct ? 'right' : 'wrong'] += 1
  p[id] = x
  localStorage.setItem(KEY, JSON.stringify(p))
}

// 한 판: 덜 맞힌 문장부터 ROUND개
function makeRound(patternId) {
  const prog = loadProgress()
  const pool = patternSentences.filter((s) => patternId === 'mix' || s.pattern === patternId)
  return shuffle(pool)
    .sort((a, b) => (prog[a.id]?.right ?? 0) - (prog[b.id]?.right ?? 0))
    .slice(0, ROUND)
}

function SpeakPattern({ onBack }) {
  const [settings] = useState(loadAiSettings)
  const azure = azureReady(settings)
  const [micOk, setMicOk] = useState(null)
  const [patternId, setPatternId] = useState(null)
  const [queue, setQueue] = useState([])
  const [index, setIndex] = useState(0)
  const [hint, setHint] = useState(0)          // 0 없음 · 1 틀 · 2 단어
  const [state, setState] = useState('ask')    // ask | listening | graded
  const [first, setFirst] = useState(null)     // { correct, text, score, pron, gaveUp, self }
  const [again, setAgain] = useState(null)
  const [error, setError] = useState('')
  const [score, setScore] = useState(0)
  const audio = useRef(null)

  const s = queue[index]
  const pattern = s ? patterns.find((p) => p.id === s.pattern) : null

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
    if (!s) return
    audio.current?.pause()
    audio.current = new Audio(audioUrl(s.id, slow))
    audio.current.play().catch(() => {})
  }

  // 정답을 보여 줄 때 원어민 음성을 한 번 들려준다
  useEffect(() => {
    if (state === 'graded' && s) play()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state === 'graded', index])

  const start = (id) => {
    setPatternId(id)
    setQueue(makeRound(id))
    setIndex(0)
    setScore(0)
    reset()
  }
  const reset = () => {
    setHint(0)
    setState('ask')
    setFirst(null)
    setAgain(null)
    setError('')
  }

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

  const finish = (result) => {
    setFirst(result)
    record(s.id, result.correct)
    if (result.correct) setScore((x) => x + (hint === 0 ? 3 : hint === 1 ? 2 : 1))
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
        finish({ ...r, correct: r.score >= PASS })
      }
    } catch (e) {
      setError(azure ? pronErrorText(e)
        : e?.message === 'permission' ? '마이크 권한이 필요해요.' : `음성 인식 오류: ${e?.message ?? e}`)
      setState(graded ? 'graded' : 'ask')
    }
  }

  const next = () => {
    audio.current?.pause()
    setIndex((i) => i + 1)
    reset()
  }

  const header = (title, right, back = onBack) => (
    <header className="header">
      <button className="back-btn" onClick={back}>←</button>
      <h1>{title}</h1>
      {right && <span style={{ marginLeft: 'auto', color: 'var(--text-secondary)' }}>{right}</span>}
    </header>
  )

  // ---------- 틀 고르기 ----------
  if (!patternId) {
    const prog = loadProgress()
    return (
      <div className="fade-in">
        {header('패턴 바꿔 말하기')}
        <div className="content">
          <p style={{ color: 'var(--text-secondary)', marginTop: 0 }}>
            자주 쓰는 틀에 단어를 바꿔 넣어 말해 보세요. 외운 문장이 아니라 처음 보는 상황에서도 말이 나오게 하는 연습이에요.
          </p>
          <div className="card" style={{ cursor: 'pointer', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }} onClick={() => start('mix')}>
            <div style={{ fontSize: '2rem' }}>🎲</div>
            <div style={{ flex: 1, fontWeight: 700 }}>섞어서 {ROUND}문제</div>
            <div>▶</div>
          </div>
          {patterns.map((p) => {
            const mine = patternSentences.filter((x) => x.pattern === p.id)
            const done = mine.filter((x) => (prog[x.id]?.right ?? 0) > 0).length
            return (
              <div key={p.id} className="card" style={{ cursor: 'pointer', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }} onClick={() => start(p.id)}>
                <div style={{ fontSize: '2rem' }}>{p.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>{p.pron} <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>· {p.ko}</span></div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>말해 본 단어 {done}/{mine.length}</div>
                </div>
                <div>▶</div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const back = () => {
    stopListening()
    stopAssess()
    audio.current?.pause()
    setPatternId(null)
  }

  // ---------- 끝 ----------
  if (!s) {
    return (
      <div className="fade-in">
        {header('패턴 말하기 끝', null, back)}
        <div className="content">
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3rem' }}>🎉</div>
            <h2>+{score}점</h2>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn-secondary btn" style={{ flex: 1 }} onClick={back}>다른 틀</button>
              <button className="btn" style={{ flex: 1 }} onClick={() => start(patternId)}>한 번 더</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ---------- 문제 ----------
  const graded = state === 'graded'
  return (
    <div className="fade-in">
      {header('패턴 바꿔 말하기', `${index + 1} / ${queue.length} · ${score}점`, back)}
      <div className="content">
        <div className="progress-bar" style={{ marginBottom: '1.5rem' }}>
          <div className="progress-fill" style={{ width: `${(index / queue.length) * 100}%` }} />
        </div>

        <div className="quiz-question-card">
          <p className="quiz-subtitle">{pattern.icon} {patternId === 'mix' ? '섞어서' : pattern.ko}</p>
          <p style={{ fontSize: '1.6rem', fontWeight: 700, margin: '0.75rem 0' }}>“{s.ko}”</p>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>일본어로 말해 보세요</p>
          {!graded && hint >= 1 && (
            <p style={{ fontSize: '1.15rem', margin: '0.5rem 0 0' }}>틀: <b>{pattern.pron}</b> <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>({pattern.ko})</span></p>
          )}
          {!graded && hint >= 2 && (
            <p style={{ fontSize: '1.15rem', margin: '0.3rem 0 0' }}>단어: <b>{s.word.pron}</b> <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>= {s.word.ko}</span></p>
          )}
          {!graded && hint < 2 && (
            <button className="btn-secondary btn" style={{ marginTop: '0.5rem' }} onClick={() => setHint((h) => h + 1)}>
              💡 {hint === 0 ? '틀 힌트' : '단어 힌트'}
            </button>
          )}
        </div>

        {!graded && micOk && (
          <>
            <button className={`btn mic-btn${state === 'listening' ? ' listening' : ''}`} style={{ width: '100%', marginTop: '1rem', padding: '1rem' }} onClick={say}>
              {state === 'listening' ? '듣는 중… (누르면 멈춤)' : '🎤 일본어로 말하기'}
            </button>
            {state !== 'listening' && (
              <button className="btn-secondary btn" style={{ width: '100%', marginTop: '0.5rem' }} onClick={() => finish({ correct: false, gaveUp: true })}>모르겠어요 (답 보기)</button>
            )}
          </>
        )}
        {!graded && micOk === false && (
          <>
            <p style={{ color: 'var(--text-secondary)', marginTop: '1rem' }}>이 기기에서는 음성 인식을 쓸 수 없어요. 소리 내어 말한 뒤 답을 보고 스스로 채점하세요.</p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn" style={{ flex: 1, background: '#4CAF50' }} onClick={() => finish({ correct: true, self: true })}>말했어요</button>
              <button className="btn" style={{ flex: 1, background: '#F44336' }} onClick={() => finish({ correct: false, self: true })}>몰랐어요</button>
            </div>
          </>
        )}
        {error && <p style={{ color: '#F44336', marginTop: '0.75rem' }}>{error}</p>}

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
            <p style={{ margin: '0.5rem 0 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              틀 {pattern.pron} + 단어 {s.word.pron}({s.word.ko}) · {pattern.note}
            </p>
            {first.pron && (
              <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <PronScore key={`first-${index}`} result={first.pron} settings={settings} />
              </div>
            )}
          </div>
        )}

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

export default SpeakPattern

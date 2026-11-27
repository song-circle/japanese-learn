import { useEffect, useRef, useState } from 'react'
import { dialogues, sentenceOf } from '../data/dialogues'
import { situations } from '../data/sentences'
import { recognitionAvailable, listenOnce, stopListening, bestMatch } from '../utils/speechRec'
import { azureReady, assessOnce, stopAssess, pronErrorText } from '../utils/pronounce'
import { loadAiSettings } from '../utils/aiTalk'
import { judgeSpeech } from '../utils/judgeSpeech'
import { pickSound } from '../utils/realVariant'
import { markStepDone } from '../utils/course'
import JudgeNote from './JudgeNote'

// 대화 듣기: 상황별 짧은 대화를 이어서 듣는다(한 문장씩이 아니라 흐름으로).
//   듣기 모드      : 처음부터 끝까지 자동으로 이어 듣기. 자막은 기본 끔(끔 / 발음 / 발음+뜻)
//   내 차례 말하기 : 점원·상대 대사는 자동으로 나오고, '나'의 차례에는 한국어 뜻을 보고 직접 말한다
//                    (글자가 80% 이상 같거나, AI가 뜻이 통한다고 하면 맞음). 정답 음성을 들은 뒤 계속
//   점원·상대 대사는 가끔 실전 표현(같은 뜻 다른 표현·다른 목소리)으로 나온다
//   끝까지 들으면 30일 코스의 오늘 '대화 듣기'가 끝으로 표시된다

const KEY = 'japanese-learn-dialogues'
const audioUrl = (id) => `${import.meta.env.BASE_URL}audio/${id}.mp3`
const SUBS = ['끔', '발음', '발음+뜻']

function loadDone() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}')
  } catch {
    return {}
  }
}
function markDone(id) {
  const d = loadDone()
  d[id] = (d[id] ?? 0) + 1
  localStorage.setItem(KEY, JSON.stringify(d))
}

// 대화 시작할 때 턴마다 들려줄 소리를 정한다(점원·상대는 가끔 실전 표현)
const prepare = (d) => d.turns.map((id) => {
  const s = sentenceOf(id)
  // 대화에서는 30%만(너무 자주 바뀌면 흐름을 익히기 어렵다)
  return { s, sound: pickSound(s, { level: 0, type: 'choose', mode: 'review' }) }
})

function DialogueListen({ onBack, initialId }) {
  const [settings] = useState(loadAiSettings)
  const azure = azureReady(settings)
  const [micOk, setMicOk] = useState(null)
  const [dlg, setDlg] = useState(null)        // 고른 대화
  const [mode, setMode] = useState('listen')  // listen | speak
  const [turns, setTurns] = useState([])
  const [idx, setIdx] = useState(0)            // 지금 턴
  const [status, setStatus] = useState('idle') // playing | my-turn | listening | judging | result | done
  const [paused, setPaused] = useState(false)
  const [subs, setSubs] = useState(0)
  const [results, setResults] = useState({})   // 턴 번호 → { correct, text, judge }
  const [error, setError] = useState('')
  const audio = useRef(null)
  const timer = useRef(null)
  const bottom = useRef(null)

  useEffect(() => {
    let alive = true
    ;(azure ? Promise.resolve(true) : recognitionAvailable()).then((ok) => alive && setMicOk(ok))
    return () => {
      alive = false
      stopAll()
    }
  }, [azure])

  const stopAll = () => {
    clearTimeout(timer.current)
    audio.current?.pause()
    stopListening()
    stopAssess()
  }

  const playTurn = (t, then) => {
    audio.current?.pause()
    audio.current = new Audio(audioUrl(t.sound ? t.sound.id : t.s.id))
    audio.current.onended = () => { timer.current = setTimeout(then, 700) }
    audio.current.play().catch(() => { timer.current = setTimeout(then, 1500) })
  }

  const turn = turns[idx]
  const isMine = (t) => mode === 'speak' && t?.s.who === '나'

  // 턴이 바뀌면: 내 차례면 기다리고, 아니면 들려준 뒤 다음 턴으로
  useEffect(() => {
    if (!dlg || paused || status !== 'playing') return
    if (idx >= turns.length) {
      setStatus('done')
      markDone(dlg.id)
      markStepDone('dialogue')
      return
    }
    if (isMine(turns[idx])) {
      setStatus('my-turn')
      return
    }
    playTurn(turns[idx], () => setIdx((i) => i + 1))
    return () => clearTimeout(timer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dlg, idx, paused, status])

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth' })
  }, [idx, status])

  const start = (d, m) => {
    stopAll()
    setDlg(d)
    setMode(m)
    setTurns(prepare(d))
    setIdx(0)
    setResults({})
    setError('')
    setPaused(false)
    setStatus('playing')
  }

  const togglePause = () => {
    if (paused) {
      setPaused(false)
    } else {
      clearTimeout(timer.current)
      audio.current?.pause()
      setPaused(true)
    }
  }

  // 내 차례: 말하기 → 채점 → 정답 음성 → '계속'
  const say = async () => {
    if (status === 'listening') {
      stopListening()
      stopAssess()
      return
    }
    setStatus('listening')
    setError('')
    try {
      let text = ''
      let score = 0
      if (azure) {
        const r = await assessOnce(settings, turn.s.ja)
        text = r?.text ?? ''
        score = text ? bestMatch(turn.s, [text]).score : 0
      } else {
        const heard = await listenOnce()
        const best = bestMatch(turn.s, heard)
        text = heard.length ? best.text : ''
        score = best.score
      }
      if (!text) {
        setError('소리를 못 들었어요. 다시 말해 보세요.')
        setStatus('my-turn')
        return
      }
      setStatus('judging')
      const judge = await judgeSpeech(settings, turn.s, text, score)
      setResults((r) => ({ ...r, [idx]: { correct: judge.correct, text, score, judge } }))
      setStatus('result')
      playTurn(turn, () => {})
    } catch (e) {
      setError(azure ? pronErrorText(e) : e?.message === 'permission' ? '마이크 권한이 필요해요.' : `음성 인식 오류: ${e?.message ?? e}`)
      setStatus('my-turn')
    }
  }

  const skipMine = () => {
    setResults((r) => ({ ...r, [idx]: { correct: false, skipped: true } }))
    setStatus('result')
    playTurn(turn, () => {})
  }

  const goOn = () => {
    audio.current?.pause()
    setIdx((i) => i + 1)
    setStatus('playing')
  }

  // ---------- 목록 ----------
  if (!dlg) {
    const done = loadDone()
    return (
      <div className="fade-in">
        <header className="header">
          <button className="back-btn" onClick={onBack}>←</button>
          <h1>대화 듣기</h1>
        </header>
        <div className="content">
          <p style={{ color: 'var(--text-secondary)', marginTop: 0 }}>
            한 문장씩이 아니라 실제 대화 흐름으로 들어 보세요. 듣기로 먼저 들어 보고, 익숙해지면 내 차례에 직접 말해 보세요.
          </p>
          {[...dialogues].sort((a, b) => (b.id === initialId) - (a.id === initialId)).map((d) => {
            const sit = situations.find((x) => x.id === d.situation)
            return (
              <div key={d.id} className="card" style={{ marginBottom: '0.6rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <div style={{ fontSize: '1.8rem' }}>{sit?.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700 }}>{d.id === initialId && <span className="lv-chip lv1" style={{ marginRight: '0.3rem' }}>오늘</span>}{d.title}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {sit?.name} · {d.turns.length}마디{done[d.id] ? ` · ✅ ${done[d.id]}번 들음` : ''}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem' }}>
                  <button className="btn-secondary btn" style={{ flex: 1 }} onClick={() => start(d, 'listen')}>🎧 듣기</button>
                  <button className="btn" style={{ flex: 1 }} onClick={() => start(d, 'speak')}>🎤 내 차례 말하기</button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ---------- 대화 ----------
  const shown = turns.slice(0, status === 'done' ? turns.length : idx + 1)
  const mine = turns.map((t, i) => (isMine(t) ? i : -1)).filter((i) => i >= 0)
  const right = mine.filter((i) => results[i]?.correct).length
  const back = () => {
    stopAll()
    setDlg(null)
  }
  return (
    <div className="fade-in">
      <header className="header">
        <button className="back-btn" onClick={back}>←</button>
        <h1 style={{ fontSize: '1.1rem' }}>{dlg.title}</h1>
        <button className="btn-secondary btn ai-small" style={{ marginLeft: 'auto' }} onClick={() => setSubs((x) => (x + 1) % SUBS.length)}>
          자막: {SUBS[subs]}
        </button>
      </header>
      <div className="content">
        {shown.map((t, i) => {
          const me = t.s.who === '나'
          const isNow = i === idx && status !== 'done'
          const r = results[i]
          // 내 차례에서 아직 말하기 전이면 정답 문장을 숨기고 뜻만
          const hideAnswer = isMine(t) && isNow && (status === 'my-turn' || status === 'listening' || status === 'judging')
          const heardText = t.sound?.kind === 'text' ? t.sound : null
          return (
            <div key={i} className={`ai-bubble ${me ? 'ai-me' : 'ai-them'}${isNow && status === 'playing' ? ' dlg-now' : ''}`}>
              <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>{me ? '나' : t.s.who}{t.sound ? ` · 🎭 ${t.sound.kind === 'text' ? '다른 표현' : '다른 목소리'}` : ''}</div>
              {hideAnswer ? (
                <div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>“{t.s.ko}”</div>
                  <div style={{ fontSize: '0.85rem', opacity: 0.85 }}>내 차례예요. 일본어로 말해 보세요</div>
                </div>
              ) : (
                <>
                  {(subs >= 1 || r || status === 'done') && <div style={{ fontWeight: 700 }}>{heardText ? heardText.pron : t.s.pron}</div>}
                  {(subs >= 2 || status === 'done') && (
                    <div style={{ fontSize: '0.85rem', opacity: 0.85 }}>
                      {t.s.ko}{heardText ? ` (기본 표현: ${t.s.pron})` : ''}
                    </div>
                  )}
                  {subs === 0 && !r && status !== 'done' && <div style={{ opacity: 0.6 }}>🔊 …</div>}
                </>
              )}
              {r && !r.skipped && (
                <div style={{ fontSize: '0.8rem', marginTop: '0.3rem' }}>
                  {r.correct ? '✅ 통했어요' : '❌ 다시 들어 보세요'} · 내가 한 말: {r.text}
                </div>
              )}
              {r?.judge && <JudgeNote judge={r.judge} />}
            </div>
          )
        })}

        {error && <p style={{ color: '#F44336' }}>{error}</p>}

        {status === 'my-turn' && micOk && (
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
            <button className="btn mic-btn" style={{ flex: 2 }} onClick={say}>🎤 일본어로 말하기</button>
            <button className="btn-secondary btn" style={{ flex: 1 }} onClick={skipMine}>모르겠어요</button>
          </div>
        )}
        {status === 'my-turn' && micOk === false && (
          <button className="btn" style={{ width: '100%', marginTop: '0.75rem' }} onClick={skipMine}>소리 내어 말해 보고 정답 듣기</button>
        )}
        {status === 'listening' && (
          <button className="btn mic-btn listening" style={{ width: '100%', marginTop: '0.75rem' }} onClick={say}>듣는 중… (누르면 멈춤)</button>
        )}
        {status === 'judging' && <p style={{ color: 'var(--text-secondary)' }}>🤖 뜻이 통하는지 확인하는 중…</p>}
        {status === 'result' && (
          <button className="quiz-next-btn" onClick={goOn}>계속 ▶</button>
        )}
        {(status === 'playing') && (
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
            <button className="btn-secondary btn" style={{ flex: 1 }} onClick={togglePause}>{paused ? '▶ 계속 듣기' : '⏸ 멈춤'}</button>
            <button className="btn-secondary btn" style={{ flex: 1 }} onClick={() => start(dlg, mode)}>🔁 처음부터</button>
          </div>
        )}
        {status === 'done' && (
          <div className="card" style={{ marginTop: '1rem', textAlign: 'center' }}>
            <p style={{ fontWeight: 700, margin: 0 }}>대화 끝! 🎉{mode === 'speak' && mine.length ? ` 내 차례 ${right}/${mine.length} 통했어요` : ''}</p>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
              <button className="btn-secondary btn" style={{ flex: 1 }} onClick={() => start(dlg, 'listen')}>🎧 다시 듣기</button>
              <button className="btn" style={{ flex: 1 }} onClick={() => start(dlg, 'speak')}>🎤 내 차례 말하기</button>
            </div>
            <button className="btn-secondary btn" style={{ width: '100%', marginTop: '0.5rem' }} onClick={back}>다른 대화</button>
          </div>
        )}
        <div ref={bottom} />
      </div>
    </div>
  )
}

export default DialogueListen

import { useEffect, useRef, useState } from 'react'
import { situations } from '../data/sentences'
import { loadListen } from '../utils/listenSrs'
import { recognitionAvailable, listenOnce, stopListening } from '../utils/speechRec'
import { speakJa, stopSpeaking } from '../utils/ttsJa'
import {
  loadAiSettings, saveAiSettings, talkTurn, errorText, roleOf,
  CLAUDE_MODELS, DEFAULT_GEMINI_MODEL,
} from '../utils/aiTalk'

// AI 회화: 배운 상황 안에서 AI가 점원·상대 역할을 맡고, 나는 말로 대답한다.
//   AI 대사: 소리 먼저(기기 TTS) → 한글 발음·뜻은 눌러서 보기
//   내 대답: 🎤 일본어로 말하기 / 모르면 🇰🇷 한국어로 물어보기 → AI가 일본어로 고쳐 줌
//   대답 예시 2개는 눌러서 들어 보고 따라 말할 수 있다

// ---------- 설정 ----------
function Settings({ initial, onSave, onCancel }) {
  const [s, setS] = useState(initial)
  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>AI 설정</h3>
      <label style={{ display: 'block', marginBottom: '0.75rem' }}>
        AI 종류
        <select className="ai-input" value={s.provider} onChange={(e) => setS({ ...s, provider: e.target.value })}>
          <option value="claude">Claude (Anthropic)</option>
          <option value="gemini">Gemini (Google)</option>
        </select>
      </label>
      {s.provider === 'claude' ? (
        <label style={{ display: 'block', marginBottom: '0.75rem' }}>
          모델
          <select className="ai-input" value={s.model} onChange={(e) => setS({ ...s, model: e.target.value })}>
            {CLAUDE_MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </label>
      ) : (
        <label style={{ display: 'block', marginBottom: '0.75rem' }}>
          모델 이름
          <input className="ai-input" value={s.geminiModel} placeholder={DEFAULT_GEMINI_MODEL} onChange={(e) => setS({ ...s, geminiModel: e.target.value.trim() })} />
        </label>
      )}
      <label style={{ display: 'block', marginBottom: '0.75rem' }}>
        API 키
        <input className="ai-input" type="password" value={s.apiKey} autoComplete="off"
          placeholder={s.provider === 'claude' ? 'sk-ant-...' : 'AIza...'}
          onChange={(e) => setS({ ...s, apiKey: e.target.value.trim() })} />
      </label>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
        키는 이 휴대폰에만 저장돼요. 혹시 모르니 {s.provider === 'claude' ? 'Claude Console' : 'Google AI Studio'}에서 월 사용 한도를 걸어 두세요.
      </p>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        {onCancel && <button className="btn-secondary btn" style={{ flex: 1 }} onClick={onCancel}>취소</button>}
        <button className="btn" style={{ flex: 1 }} disabled={!s.apiKey} onClick={() => onSave(s)}>저장</button>
      </div>
    </div>
  )
}

// ---------- 한 줄(AI 대사, 고친 말, 대답 예시) ----------
function JaLine({ line, autoPlay = false, reveal = false, koFirst = false }) {
  const [showPron, setShowPron] = useState(reveal)
  const [showKo, setShowKo] = useState(reveal || koFirst)
  useEffect(() => {
    if (autoPlay) speakJa(line.ja).catch(() => {})
  }, [autoPlay, line.ja])
  return (
    <div>
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <button className="btn-secondary btn ai-small" onClick={() => speakJa(line.ja)}>🔊</button>
        <button className="btn-secondary btn ai-small" onClick={() => speakJa(line.ja, true)}>🐢</button>
        {!showPron && <button className="btn-secondary btn ai-small" onClick={() => setShowPron(true)}>한글 발음</button>}
        {!showKo && <button className="btn-secondary btn ai-small" onClick={() => setShowKo(true)}>뜻</button>}
      </div>
      {showPron && <p style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0.4rem 0 0' }}>{line.pron}</p>}
      {showKo && <p style={{ margin: '0.2rem 0 0', color: 'var(--text-secondary)' }}>{line.ko}</p>}
    </div>
  )
}

function AiTalk({ onBack }) {
  const [settings, setSettings] = useState(loadAiSettings)
  const [editing, setEditing] = useState(!settings.apiKey)
  const [situation, setSituation] = useState(null)
  const [history, setHistory] = useState([]) // [{ role:'user', text, lang }, { role:'assistant', data }]
  const [busy, setBusy] = useState(false)    // 'ai' | 'mic' | false
  const [error, setError] = useState('')
  const [micOk, setMicOk] = useState(true)
  const bottom = useRef(null)

  useEffect(() => {
    recognitionAvailable().then(setMicOk)
    return () => {
      stopListening()
      stopSpeaking()
    }
  }, [])

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history, busy])

  const ask = async (next) => {
    setHistory(next)
    setBusy('ai')
    setError('')
    try {
      const data = await talkTurn(settings, situation, next)
      setHistory([...next, { role: 'assistant', data }])
    } catch (e) {
      setError(errorText(e))
      // 실패한 내 말은 빼서 다시 말할 수 있게
      setHistory(next.slice(0, -1))
    } finally {
      setBusy(false)
    }
  }

  const start = (sit) => {
    setSituation(sit)
    setHistory([])
    setError('')
  }

  // situation이 정해지면 AI가 먼저 말한다
  useEffect(() => {
    if (situation && history.length === 0 && !busy) ask([{ role: 'user', text: '(시작)' }])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [situation])

  const say = async (lang) => {
    if (busy === 'mic') {
      stopListening()
      return
    }
    stopSpeaking()
    setBusy('mic')
    setError('')
    try {
      const heard = await listenOnce(lang)
      setBusy(false)
      if (!heard.length) {
        setError('소리를 못 들었어요. 다시 말해 보세요.')
        return
      }
      ask([...history, { role: 'user', text: heard[0], lang }])
    } catch (e) {
      setBusy(false)
      setError(e?.message === 'permission' ? '마이크 권한이 필요해요.' : `음성 인식 오류: ${e?.message ?? e}`)
    }
  }

  // ---------- 설정 화면 ----------
  if (editing) {
    return (
      <div className="fade-in">
        <header className="header">
          <button className="back-btn" onClick={onBack}>←</button>
          <h1>AI 회화</h1>
        </header>
        <div className="content">
          <Settings
            initial={settings}
            onCancel={settings.apiKey ? () => setEditing(false) : null}
            onSave={(s) => {
              saveAiSettings(s)
              setSettings(s)
              setEditing(false)
            }}
          />
        </div>
      </div>
    )
  }

  // ---------- 상황 고르기 ----------
  if (!situation) {
    const cards = loadListen().cards
    return (
      <div className="fade-in">
        <header className="header">
          <button className="back-btn" onClick={onBack}>←</button>
          <h1>AI 회화</h1>
          <button className="btn-secondary btn ai-small" style={{ marginLeft: 'auto' }} onClick={() => setEditing(true)}>⚙️ 설정</button>
        </header>
        <div className="content">
          <p style={{ color: 'var(--text-secondary)', marginTop: 0 }}>
            상황을 고르면 AI가 {`'점원'`}이나 {`'상대'`} 역할로 먼저 말을 걸어요. 듣고 일본어로 대답해 보세요.
          </p>
          {situations.map((sit) => {
            const learned = sit.sentences.filter((s) => cards[s.id]).length
            return (
              <div key={sit.id} className="card" style={{ cursor: 'pointer', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }} onClick={() => start(sit)}>
                <div style={{ fontSize: '2rem' }}>{sit.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>{sit.name}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    상대: {roleOf(sit)} · 배운 문장 {learned}/{sit.sentences.length}
                  </div>
                </div>
                <div>▶</div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ---------- 대화 ----------
  const last = history[history.length - 1]
  const lastAi = last?.role === 'assistant' ? last.data : null
  const done = lastAi?.done
  return (
    <div className="fade-in">
      <header className="header">
        <button className="back-btn" onClick={() => { stopListening(); stopSpeaking(); setSituation(null) }}>←</button>
        <h1>{situation.icon} {situation.name}</h1>
      </header>
      <div className="content">
        {history.map((h, i) => {
          if (h.role === 'user') {
            if (h.text === '(시작)') return null
            return (
              <div key={i} className="ai-bubble ai-me">
                <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>나{h.lang === 'ko-KR' ? ' (한국어로 물어봄)' : ''}</div>
                <div>{h.text}</div>
              </div>
            )
          }
          const d = h.data
          const fb = d.feedback
          return (
            <div key={i}>
              {fb && !fb.ok && fb.better_ja && (
                <div className="ai-bubble ai-fix">
                  <div style={{ fontWeight: 700, marginBottom: '0.3rem' }}>✏️ 이렇게 말하면 돼요</div>
                  <JaLine line={{ ja: fb.better_ja, pron: fb.better_pron, ko: fb.note_ko }} reveal />
                </div>
              )}
              {fb && fb.ok && i > 1 && <div style={{ color: '#4CAF50', fontSize: '0.9rem', margin: '0.25rem 0' }}>👍 잘 통했어요</div>}
              <div className="ai-bubble ai-them">
                <div style={{ fontSize: '0.8rem', opacity: 0.8, marginBottom: '0.3rem' }}>{roleOf(situation)}</div>
                <JaLine line={d.reply} autoPlay={i === history.length - 1} />
              </div>
            </div>
          )
        })}

        {busy === 'ai' && <p style={{ color: 'var(--text-secondary)' }}>…생각하는 중</p>}
        {error && <p style={{ color: '#F44336' }}>{error}</p>}

        {done ? (
          <div className="card" style={{ textAlign: 'center', marginTop: '1rem' }}>
            <p style={{ fontWeight: 700 }}>대화 끝! 🎉</p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn-secondary btn" style={{ flex: 1 }} onClick={() => start(situation)}>한 번 더</button>
              <button className="btn" style={{ flex: 1 }} onClick={() => setSituation(null)}>다른 상황</button>
            </div>
          </div>
        ) : lastAi && (
          <>
            {lastAi.suggestions?.length > 0 && (
              <div className="card" style={{ marginTop: '1rem' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>💡 이렇게 대답할 수 있어요 (들어 보고 따라 말하기)</div>
                {lastAi.suggestions.map((sg, k) => (
                  <div key={`${history.length}-${k}`} style={{ marginBottom: k < lastAi.suggestions.length - 1 ? '0.75rem' : 0 }}>
                    <JaLine line={sg} koFirst />
                  </div>
                ))}
              </div>
            )}
            {micOk ? (
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                <button className={`btn mic-btn${busy === 'mic' ? ' listening' : ''}`} style={{ flex: 2 }} disabled={busy === 'ai'} onClick={() => say('ja-JP')}>
                  {busy === 'mic' ? '듣는 중… (누르면 멈춤)' : '🎤 일본어로 말하기'}
                </button>
                <button className="btn-secondary btn" style={{ flex: 1 }} disabled={!!busy} onClick={() => say('ko-KR')}>
                  🇰🇷 한국어로 물어보기
                </button>
              </div>
            ) : (
              <p style={{ color: 'var(--text-secondary)' }}>이 기기에서는 음성 인식을 쓸 수 없어요.</p>
            )}
          </>
        )}
        <div ref={bottom} />
      </div>
    </div>
  )
}

export default AiTalk

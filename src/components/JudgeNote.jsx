import { speakJa } from '../utils/ttsJa'

// AI가 '뜻이 통하는지' 판정한 결과 보여 주기 (말해서 맞히기·패턴 말하기·대화 듣기 공용)
//   judge: judgeSpeech()의 결과. AI가 판정하지 않았으면 아무것도 보여 주지 않는다

function JudgeNote({ judge }) {
  if (judge?.by !== 'ai') return null
  return (
    <div className={`judge-note ${judge.correct ? 'ok' : 'ng'}`}>
      <div style={{ fontWeight: 700 }}>{judge.correct ? '🤖 표현은 달라도 뜻이 통해요' : '🤖 AI 판정: 뜻이 달라요'}</div>
      {judge.note_ko && <div style={{ fontSize: '0.9rem', marginTop: '0.2rem' }}>{judge.note_ko}</div>}
      {judge.better_ja && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.3rem' }}>
          <button className="btn-secondary btn ai-small" onClick={() => speakJa(judge.better_ja)}>🔊</button>
          <span>더 자연스럽게: <b>{judge.better_pron}</b> <span style={{ opacity: 0.7 }}>({judge.better_ja})</span></span>
        </div>
      )}
    </div>
  )
}

export default JudgeNote

import { useState } from 'react'
import { scoreColor } from '../utils/pronounce'
import { explainPronunciation, errorText } from '../utils/aiTalk'
import { speakJa } from '../utils/ttsJa'

// Azure 발음 평가 결과: 점수 + 단어별 색 + (AI 키가 있으면) 어디가 틀렸는지 설명 듣기
//   result: pronounce.assessOnce()의 결과, settings: loadAiSettings()

function PronScore({ result, settings, compact = false }) {
  const [explain, setExplain] = useState(null) // null | 'loading' | { summary_ko, tips } | { error }

  const main = result.pron
  const color = scoreColor(main)
  const label = main >= 80 ? '좋아요' : main >= 60 ? '조금만 더' : '다시 해 봐요'
  const needHelp = main < 90 || result.words.some((w) => w.score < 80 || w.error !== 'None')

  const ask = async () => {
    setExplain('loading')
    try {
      setExplain(await explainPronunciation(settings, result))
    } catch (e) {
      setExplain({ error: errorText(e) })
    }
  }

  return (
    <div className="pron-score" style={{ textAlign: 'left' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: compact ? '1.1rem' : '1.5rem', fontWeight: 800, color }}>🎯 발음 {main}점</span>
        <span style={{ color, fontWeight: 700, fontSize: '0.9rem' }}>{label}</span>
      </div>
      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
        정확도 {result.accuracy} · 유창성 {result.fluency}{result.completeness != null ? ` · 완성도 ${result.completeness}` : ''}
      </div>

      {result.words.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.5rem' }}>
          {result.words.map((w, i) => (
            <span
              key={i}
              className="pron-word"
              style={{
                borderColor: scoreColor(w.score, w.error),
                color: scoreColor(w.score, w.error),
                textDecoration: w.error === 'Omission' ? 'line-through' : 'none',
              }}
              title={w.error}
            >
              {w.word}
              <small> {w.error === 'Omission' ? '빠짐' : w.error === 'Insertion' ? '더함' : w.score}</small>
            </span>
          ))}
        </div>
      )}

      {needHelp && settings.apiKey && explain === null && (
        <button className="btn-secondary btn ai-small" style={{ marginTop: '0.6rem' }} onClick={ask}>
          🤖 어디를 고치면 되는지 설명 듣기
        </button>
      )}
      {explain === 'loading' && <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>…설명을 만드는 중</p>}
      {explain?.error && <p style={{ color: '#F44336', fontSize: '0.9rem' }}>{explain.error}</p>}
      {explain?.summary_ko && (
        <div className="pron-explain">
          <p style={{ margin: 0, fontWeight: 700 }}>{explain.summary_ko}</p>
          {explain.tips.map((t, i) => (
            <div key={i} style={{ marginTop: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <button className="btn-secondary btn ai-small" onClick={() => speakJa(t.word, true)}>🐢</button>
                <span style={{ fontWeight: 700 }}>{t.pron}</span>
              </div>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.9rem' }}>{t.tip_ko}</p>
            </div>
          ))}
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            AI는 소리를 직접 듣지 않고, 점수가 낮은 곳을 보고 설명해요.
          </p>
        </div>
      )}
    </div>
  )
}

export default PronScore

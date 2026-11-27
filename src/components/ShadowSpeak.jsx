import { useEffect, useState } from 'react'
import { recognitionAvailable, listenOnce, stopListening, bestMatch, PASS } from '../utils/speechRec'
import { azureReady, assessOnce, stopAssess, pronErrorText } from '../utils/pronounce'
import { loadAiSettings } from '../utils/aiTalk'
import PronScore from './PronScore'

// 따라 말하기: 답을 본 뒤 문장을 소리 내어 말하면 음성 인식으로 통했는지 알려 준다.
// 처음 통과하면 onPass()를 한 번 부른다(+1점). 복습 간격에는 영향을 주지 않는다.
// Azure 키가 있으면(AI 회화 ⚙️ 설정) Azure로 듣고 발음 점수·단어별 점수도 보여 준다.

function ShadowSpeak({ sentence, onPass }) {
  const [supported, setSupported] = useState(null)
  const [state, setState] = useState('idle') // idle | listening | done | error
  const [result, setResult] = useState(null) // { score, text }
  const [error, setError] = useState('')
  const [passed, setPassed] = useState(false)
  const [pron, setPron] = useState(null) // Azure 발음 평가 결과
  const [settings] = useState(loadAiSettings)
  const azure = azureReady(settings)

  useEffect(() => {
    let alive = true
    // Azure는 웹뷰 마이크를 직접 쓰므로 기기 음성 인식이 없어도 된다
    ;(azure ? Promise.resolve(true) : recognitionAvailable()).then((ok) => alive && setSupported(ok))
    return () => {
      alive = false
      stopListening()
      stopAssess()
    }
  }, [azure])

  if (supported === null) return null
  if (!supported) {
    return (
      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.75rem' }}>
        🎤 이 기기에서는 음성 인식을 쓸 수 없어서 따라 말하기는 건너뛰어요. 소리 내어 한 번 따라 해 보세요.
      </p>
    )
  }

  const speak = async () => {
    if (state === 'listening') {
      if (azure) stopAssess()
      else stopListening()
      return
    }
    setState('listening')
    setError('')
    setPron(null)
    try {
      let heard
      if (azure) {
        const r = await assessOnce(settings, sentence.ja)
        heard = r?.text ? [r.text] : []
        setPron(r?.text ? r : null)
      } else {
        heard = await listenOnce()
      }
      if (!heard.length) {
        setResult(null)
        setError('소리를 못 들었어요. 마이크 가까이에서 다시 말해 보세요.')
        setState('error')
        return
      }
      const best = bestMatch(sentence, heard)
      setResult(best)
      setState('done')
      if (best.score >= PASS && !passed) {
        setPassed(true)
        onPass?.()
      }
    } catch (e) {
      setResult(null)
      setError(azure ? pronErrorText(e)
        : e?.message === 'permission'
          ? '마이크 권한이 필요해요. 설정에서 마이크를 허용해 주세요.'
          : `음성 인식이 안 됐어요 (${e?.message ?? e}). 인터넷 연결을 확인해 주세요.`)
      setState('error')
    }
  }

  const pct = result ? Math.round(result.score * 100) : 0
  const verdict = !result ? null
    : result.score >= PASS ? { text: '잘 통했어요! 👍', color: '#4CAF50' }
    : result.score >= 0.5 ? { text: '거의 비슷해요. 한 번 더!', color: '#FF9800' }
    : { text: '다시 들어 보고 따라 해 봐요', color: '#F44336' }

  return (
    <div className="card shadow-speak" style={{ marginTop: '1rem', textAlign: 'center' }}>
      <p style={{ fontWeight: 700, margin: 0 }}>🗣️ 따라 말하기</p>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0.75rem' }}>
        위 🔊로 다시 듣고, 들은 대로 소리 내어 말해 보세요{passed ? '' : ' · 통하면 +1점'}
      </p>
      <button className={`btn mic-btn${state === 'listening' ? ' listening' : ''}`} style={{ width: '100%' }} onClick={speak}>
        {state === 'listening' ? '듣는 중… (누르면 멈춤)' : result || error ? '🎤 다시 말하기' : '🎤 말하기'}
      </button>
      {verdict && (
        <div style={{ marginTop: '0.75rem' }}>
          <p style={{ fontWeight: 700, color: verdict.color, margin: 0 }}>{verdict.text} ({pct}%)</p>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0' }}>
            앱이 알아들은 말: {result.text}
          </p>
        </div>
      )}
      {pron && (
        <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <PronScore key={pron.text + pron.pron} result={pron} settings={settings} />
        </div>
      )}
      {!azure && (
        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.75rem', marginBottom: 0 }}>
          AI 회화 ⚙️ 설정에 Azure 키를 넣으면 발음 점수도 나와요
        </p>
      )}
      {error && <p style={{ color: '#F44336', fontSize: '0.9rem', marginTop: '0.75rem' }}>{error}</p>}
    </div>
  )
}

export default ShadowSpeak

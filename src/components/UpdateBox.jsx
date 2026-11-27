import { useEffect, useState } from 'react'
import { WEB_VERSION, RELEASES, checkUpdate, applyNow } from '../utils/webUpdate'

// 홈 맨 아래: 지금 버전 + 업데이트 확인 버튼.
// 앱을 켤 때 한 번 조용히 확인해서, 새 버전을 받았으면 홈 위쪽에 '지금 적용' 띠를 띄운다(banner).

let autoChecked = false // 앱을 켠 뒤 한 번만 자동 확인

const openReleases = () => window.open(RELEASES, '_system')

export function UpdateBanner() {
  const [ready, setReady] = useState(null) // { version, id }
  useEffect(() => {
    if (autoChecked) return
    autoChecked = true
    checkUpdate()
      .then((r) => { if (r.state === 'downloaded') setReady(r) })
      .catch(() => { /* 인터넷이 없으면 조용히 넘어감 */ })
  }, [])
  if (!ready) return null
  return (
    <div className="card update-banner">
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700 }}>🆕 새 버전 v1.0.{ready.version}을 받았어요</div>
        <div style={{ fontSize: '0.8rem', opacity: 0.85 }}>다음에 앱을 열 때 바뀌어요. 기록은 그대로예요.</div>
      </div>
      <button className="btn" onClick={() => applyNow(ready.id)}>지금 적용</button>
    </div>
  )
}

function UpdateBox() {
  const [state, setState] = useState('idle') // idle | checking | latest | need-apk | downloaded | web | error
  const [info, setInfo] = useState(null)

  const check = async () => {
    setState('checking')
    try {
      const r = await checkUpdate()
      setInfo(r)
      setState(r.state)
    } catch (e) {
      setInfo({ error: String(e?.message ?? e) })
      setState('error')
    }
  }

  return (
    <div className="card" style={{ marginTop: '1.5rem', textAlign: 'center' }}>
      <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
        앱 버전 v1.0.{WEB_VERSION || '개발'}
      </div>
      {state === 'downloaded' ? (
        <>
          <p style={{ margin: '0.5rem 0' }}>새 버전 v1.0.{info.version}을 받았어요.</p>
          <button className="btn" style={{ width: '100%' }} onClick={() => applyNow(info.id)}>지금 적용하고 다시 시작</button>
        </>
      ) : state === 'need-apk' ? (
        <>
          <p style={{ margin: '0.5rem 0' }}>새 버전 v1.0.{info.version}은 앱(APK)을 새로 받아야 해요.<br />덮어서 설치하면 기록은 그대로예요.</p>
          <button className="btn" style={{ width: '100%' }} onClick={openReleases}>APK 받으러 가기</button>
        </>
      ) : (
        <>
          <button className="btn-secondary btn" style={{ width: '100%', marginTop: '0.5rem' }} disabled={state === 'checking'} onClick={check}>
            {state === 'checking' ? '확인하는 중… (받는 중일 수 있어요)' : '🔄 업데이트 확인'}
          </button>
          {state === 'latest' && <p style={{ margin: '0.5rem 0 0', color: '#4CAF50' }}>지금이 최신 버전이에요 👍</p>}
          {state === 'web' && <p style={{ margin: '0.5rem 0 0', color: 'var(--text-secondary)' }}>휴대폰 앱에서만 쓸 수 있어요.</p>}
          {state === 'error' && <p style={{ margin: '0.5rem 0 0', color: '#F44336' }}>확인하지 못했어요. 인터넷 연결을 확인해 주세요. ({info.error.slice(0, 80)})</p>}
        </>
      )}
    </div>
  )
}

export default UpdateBox

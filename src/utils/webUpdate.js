// 앱 자동 업데이트 (APK를 다시 깔지 않고 화면·기능만 바꾸기)
//   @capgo/capacitor-updater를 서버 없이 쓴다: GitHub 릴리스 web-latest에 올린 version.json을 보고
//   새 버전이면 web-<번호>.zip을 받아 바꾼다. 학습 기록(localStorage)은 그대로 남는다.
//   안드로이드 쪽(권한·플러그인)이 바뀐 버전은 APK를 새로 받아야 한다: version.json의 minApk보다
//   지금 APK 번호가 낮으면 업데이트하지 않고 APK를 받으라고 알려 준다.

import { Capacitor, CapacitorHttp } from '@capacitor/core'
import { CapacitorUpdater } from '@capgo/capacitor-updater'

const FEED = 'https://github.com/song-circle/japanese-learn/releases/download/web-latest/version.json'
export const RELEASES = 'https://github.com/song-circle/japanese-learn/releases/latest'

// 빌드할 때 넣는 번호(GitHub 빌드 번호 = APK 1.0.<번호>와 같음). 개발 중에는 0
// eslint-disable-next-line no-undef
export const WEB_VERSION = Number(typeof __WEB_VERSION__ !== 'undefined' ? __WEB_VERSION__ : 0)

const native = Capacitor.isNativePlatform()

// 앱이 켜지면 한 번: 이 버전이 잘 떴다고 알린다(안 알리면 업데이트가 실패한 것으로 보고 이전 버전으로 되돌림)
export async function markReady() {
  if (!native) return
  try {
    await CapacitorUpdater.notifyAppReady()
  } catch {
    /* 플러그인이 없는 옛 APK */
  }
}

// 지금 APK 번호: versionName '1.0.57' → 57
async function apkNumber() {
  try {
    const { native: v } = await CapacitorUpdater.current()
    return Number(String(v).split('.').pop()) || 0
  } catch {
    return 0
  }
}

// 새 버전 확인 + 받기
//   결과: { state: 'latest' } | { state: 'need-apk', version } | { state: 'downloaded', version, id } | { state: 'web' }
export async function checkUpdate() {
  if (!native) return { state: 'web' }
  const res = await CapacitorHttp.get({ url: `${FEED}?t=${Date.now()}`, responseType: 'json' })
  if (res.status !== 200) throw new Error(`HTTP ${res.status}`)
  const feed = typeof res.data === 'string' ? JSON.parse(res.data) : res.data
  if (!(feed.version > WEB_VERSION)) return { state: 'latest' }
  if ((feed.minApk ?? 0) > (await apkNumber())) return { state: 'need-apk', version: feed.version }
  // checksum: 플러그인이 받은 zip의 SHA-256을 확인한다(없으면 받기를 거부함)
  const bundle = await CapacitorUpdater.download({ url: feed.url, version: String(feed.version), checksum: feed.checksum ?? '' })
  // 다음에 앱을 켜거나 다시 열 때 바뀐다. 바로 바꾸려면 applyNow
  await CapacitorUpdater.next({ id: bundle.id })
  return { state: 'downloaded', version: feed.version, id: bundle.id }
}

// 받은 버전으로 지금 바로 다시 시작
export async function applyNow(id) {
  await CapacitorUpdater.set({ id })
}

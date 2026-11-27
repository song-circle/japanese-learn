// 실전 소리: 음성을 1.25배로 빠르게 + 가게 소음(웹 오디오로 만든 웅성거림)을 깔아서 들려준다 (휴대폰·PC 공용)

let ctx = null
let node = null

export function startNoise() {
  try {
    ctx ??= new (window.AudioContext || window.webkitAudioContext)()
    ctx.resume?.()
    stopNoise()
    const len = ctx.sampleRate * 2
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    let last = 0
    for (let i = 0; i < len; i++) {
      // 갈색 잡음(웅성거리는 소리에 가까움) + 가끔 딸그락
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02
      d[i] = last * 3 + (Math.random() < 0.0004 ? (Math.random() - 0.5) * 0.6 : 0)
    }
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.loop = true
    const gain = ctx.createGain()
    gain.gain.value = 0.35
    src.connect(gain).connect(ctx.destination)
    src.start()
    node = src
  } catch {
    /* 소음 없이 */
  }
}

export function stopNoise() {
  try {
    node?.stop()
  } catch {
    /* 이미 멈춤 */
  }
  node = null
}

// audio(HTMLAudioElement)를 실전 소리로 재생
export function playReal(audio) {
  audio.playbackRate = 1.25
  startNoise()
  audio.addEventListener('ended', () => setTimeout(stopNoise, 300))
  audio.play().catch(() => stopNoise())
}

// 따라 말하기용 일본어 음성 인식
//   앱(Android): @capacitor-community/speech-recognition (기기의 구글 음성 인식)
//   브라우저   : Web Speech API (Chrome 등). 개발 중 확인용
// 그리고 들은 말이 문장과 얼마나 비슷한지 0~1로 잰다.

import { Capacitor } from '@capacitor/core'
import { SpeechRecognition } from '@capacitor-community/speech-recognition'

const native = Capacitor.isNativePlatform()
const WebRec = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null

export async function recognitionAvailable() {
  if (native) {
    try {
      return (await SpeechRecognition.available()).available
    } catch {
      return false
    }
  }
  return !!WebRec
}

let webRec = null

// 한 번 듣고 후보 문장들(최대 5개)을 돌려준다. 아무 말도 못 알아들으면 [].
// 권한이 거부되면 Error('permission')
export async function listenOnce(lang = 'ja-JP') {
  if (native) {
    let perm = await SpeechRecognition.checkPermissions()
    if (perm.speechRecognition !== 'granted') perm = await SpeechRecognition.requestPermissions()
    if (perm.speechRecognition !== 'granted') throw new Error('permission')
    try {
      const r = await SpeechRecognition.start({ language: lang, maxResults: 5, partialResults: false, popup: false })
      return r.matches ?? []
    } catch (e) {
      // 말이 없거나 못 알아들으면 플러그인이 오류로 끝낸다
      if (/^(No match|No speech input|Didn't understand)/.test(String(e?.message ?? e))) return []
      throw e
    }
  }
  if (!WebRec) throw new Error('unsupported')
  return new Promise((resolve, reject) => {
    const rec = new WebRec()
    webRec = rec
    rec.lang = lang
    rec.maxAlternatives = 5
    rec.interimResults = false
    let got = []
    rec.onresult = (ev) => {
      got = Array.from(ev.results[0] ?? []).map((a) => a.transcript)
    }
    rec.onerror = (ev) => {
      if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') reject(new Error('permission'))
      else if (ev.error === 'no-speech' || ev.error === 'aborted') resolve([])
      else reject(new Error(ev.error))
    }
    rec.onend = () => {
      webRec = null
      resolve(got)
    }
    rec.start()
  })
}

export async function stopListening() {
  if (native) {
    try { await SpeechRecognition.stop() } catch { /* 이미 끝남 */ }
  } else {
    webRec?.stop()
  }
}

// ---------- 비교 ----------

// 문장 부호·공백을 빼고, 가타카나는 히라가나로, 전각 숫자는 반각으로 맞춘다
export function normalize(text) {
  return text
    .normalize('NFKC')
    .replace(/[\s、。,.!?！？「」・ー〜~-]/g, '')
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
}

function distance(a, b) {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const up = prev[j]
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1))
      diag = up
    }
  }
  return prev[b.length]
}

// 0~1. 1이면 글자까지 같다
export function similarity(a, b) {
  const x = normalize(a)
  const y = normalize(b)
  if (!x.length || !y.length) return 0
  return 1 - distance(x, y) / Math.max(x.length, y.length)
}

// 문장의 여러 표기(한자 섞인 글, 가나 읽기, 숫자 표기)와 인식 후보들 중 가장 가까운 쌍
export function bestMatch(sentence, heard) {
  const targets = [sentence.ja, sentence.tts, sentence.kana, ...(sentence.alt ?? [])].filter(Boolean)
  let best = { score: 0, text: heard[0] ?? '' }
  for (const h of heard) {
    for (const t of targets) {
      const score = similarity(h, t)
      if (score > best.score) best = { score, text: h }
    }
  }
  return best
}

// 이 점수 이상이면 '통했다'
export const PASS = 0.8

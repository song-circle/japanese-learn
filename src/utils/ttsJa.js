// AI가 만든 일본어 문장 읽어 주기 (미리 만든 mp3가 없는 문장용)
//   앱(Android): 기기 TTS (@capacitor-community/text-to-speech)
//   브라우저   : Web Speech API

import { Capacitor } from '@capacitor/core'
import { TextToSpeech } from '@capacitor-community/text-to-speech'

const native = Capacitor.isNativePlatform()

export async function speakJa(text, slow = false) {
  const rate = slow ? 0.7 : 1.0
  if (native) {
    try { await TextToSpeech.stop() } catch { /* 재생 중 아님 */ }
    await TextToSpeech.speak({ text, lang: 'ja-JP', rate })
    return
  }
  if (!window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'ja-JP'
  u.rate = rate
  const voice = window.speechSynthesis.getVoices().find((v) => v.lang === 'ja-JP')
  if (voice) u.voice = voice
  window.speechSynthesis.speak(u)
}

export async function stopSpeaking() {
  if (native) {
    try { await TextToSpeech.stop() } catch { /* 재생 중 아님 */ }
  } else {
    window.speechSynthesis?.cancel()
  }
}

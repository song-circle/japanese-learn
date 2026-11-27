// 듣고 맞히기에 실전 표현 섞기 (휴대폰·PC 공용)
//   복습 문제에서 가끔 원래 음성 대신 '같은 뜻 다른 표현'이나 '같은 문장 다른 목소리'를 들려준다.
//   - 새 문장, 내가 하는 말은 늘 원래 음성
//   - Lv0은 30%, Lv1부터는 50% 확률
//   - 빈칸 듣기는 글자가 같아야 하므로 다른 목소리만

import { variantClips, voiceClips } from '../data/variants.js'

const textBy = {}
for (const c of variantClips) (textBy[c.sid] ??= []).push(c)
const voiceBy = Object.fromEntries(voiceClips.map((c) => [c.sid, c]))

// 결과: null(원래 음성) | { kind: 'text' | 'voice', id, ja, pron?, voice }
export function pickSound(s, { level, type, mode }) {
  if (s.who === '나' || mode === 'new') return null
  if (Math.random() >= (level === 0 ? 0.3 : 0.5)) return null
  const texts = type === 'cloze' ? [] : (textBy[s.id] ?? [])
  if (texts.length && Math.random() < 0.65) return { kind: 'text', ...texts[Math.floor(Math.random() * texts.length)] }
  const v = voiceBy[s.id]
  return v ? { kind: 'voice', ...v } : null
}

// 'ja-JP-AoiNeural' → 'Aoi'
export const voiceName = (v) => v.replace(/^ja-JP-/, '').replace(/Neural$/, '')

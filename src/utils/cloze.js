// 빈칸 듣기 문제: 문장의 한글 발음에서 단어 하나를 빈칸으로 두고, 들린 단어를 고르게 한다.
//   보기는 한글 발음이 비슷한 단어들(자모 단위로 비교)이라 문장 느낌이 아니라 그 단어 소리를 알아들어야 맞힌다.

import { shuffle } from './distractors.js'

// 한글 → 자모 배열 (초성·중성·종성). 한글이 아닌 글자는 그대로
function jamo(text) {
  const out = []
  for (const ch of text) {
    const c = ch.charCodeAt(0) - 0xac00
    if (c >= 0 && c < 11172) {
      out.push('c' + Math.floor(c / 588), 'v' + Math.floor((c % 588) / 28))
      if (c % 28) out.push('t' + (c % 28))
    } else if (ch !== ' ') {
      out.push(ch)
    }
  }
  return out
}

function similarity(a, b) {
  const x = jamo(a)
  const y = jamo(b)
  const prev = Array.from({ length: y.length + 1 }, (_, i) => i)
  for (let i = 1; i <= x.length; i++) {
    let diag = prev[0]
    prev[0] = i
    for (let j = 1; j <= y.length; j++) {
      const up = prev[j]
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (x[i - 1] === y[j - 1] ? 0 : 1))
      diag = up
    }
  }
  return 1 - prev[y.length] / Math.max(x.length, y.length, 1)
}

let wordPool = null
function allWords(allSentences) {
  if (!wordPool) {
    const seen = new Map()
    for (const s of allSentences) {
      for (const [ja, pron, ko] of s.words) {
        if (!seen.has(pron)) seen.set(pron, { ja, pron, ko })
      }
    }
    wordPool = [...seen.values()]
  }
  return wordPool
}

const syllables = (p) => [...p].filter((ch) => /[가-힣]/.test(ch)).length

// 결과: { masked, answer, answerKo, options } 또는 null(빈칸으로 만들 단어가 없는 문장)
export function clozeFor(s, allSentences, count = 5) {
  // 빈칸 뒤에도 두 글자 이상 남는 단어만(문장 거의 전체가 빈칸이면 듣기 문제가 아니다)
  const candidates = s.words.filter(([, pron]) => syllables(pron) >= 2 && s.pron.includes(pron)
    && syllables(s.pron) - syllables(pron) >= 2)
  if (!candidates.length) return null
  const [, pron, ko] = candidates[Math.floor(Math.random() * candidates.length)]
  const others = allWords(allSentences)
    // 정답과 같거나, 서로 포함하는 단어는 빼서 답이 둘이 되지 않게
    .filter((w) => w.pron !== pron && syllables(w.pron) >= 2 && !w.pron.includes(pron) && !pron.includes(w.pron))
    .map((w) => ({ w, v: similarity(pron, w.pron) }))
    .sort((a, b) => b.v - a.v)
    .slice(0, 8)
  const picked = shuffle(others).slice(0, count - 1).map((o) => o.w.pron)
  return {
    masked: s.pron.replace(pron, '____'),
    answer: pron,
    answerKo: ko,
    options: shuffle([pron, ...picked]),
  }
}

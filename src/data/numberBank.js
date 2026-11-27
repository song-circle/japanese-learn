// PC용 숫자 듣기 음성 묶음: 가격·시간·개수·인원 문장을 미리 정해 두고 원어민 음성을 만들어 둔다
//   (휴대폰 숫자 듣기는 기기 음성으로 매번 새 숫자를 읽지만, 회사 PC에는 일본어 음성이 없을 수 있어서)
//   음성: public/audio/num-<n>.mp3 (scripts/gen-audio.mjs가 함께 만든다)
//   같은 목록이 늘 나오도록 정해진 씨앗으로 숫자를 고른다

import { makeQuestion } from '../utils/numberJa.js'

// 정해진 씨앗의 난수(목록이 빌드할 때마다 바뀌지 않게)
function seeded(seed) {
  let x = seed
  return () => {
    x = (x * 16807) % 2147483647
    return (x - 1) / 2147483646
  }
}

function build() {
  const real = Math.random
  Math.random = seeded(20261127)
  try {
    const kinds = [['price', 40], ['time', 30], ['count', 12], ['people', 12]]
    const seen = new Set()
    const out = []
    for (const [kind, n] of kinds) {
      let tries = 0
      while (out.filter((q) => q.kind === kind).length < n && tries++ < 500) {
        const q = makeQuestion(kind)
        if (seen.has(q.ja)) continue
        seen.add(q.ja)
        out.push({ ...q, id: `num-${out.length + 1}` })
      }
    }
    return out
  } finally {
    Math.random = real
  }
}

export const numberBank = build()

// 듣고 맞히기 오답 보기 만들기 (휴대폰 앱과 PC 앱이 함께 쓴다)
//   소리가 비슷한 문장(가나 읽기가 비슷한 것) 위주로 고른다.
//   같은 상황의 문장만 섞으면 '편의점 문장 넷 중 하나'처럼 외워서 맞힐 수 있으므로 소리로 헷갈리게 한다.

export const OPTION_COUNT = 5

export const shuffle = (xs) => {
  const a = [...xs]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// 가나 읽기(문장 부호·공백 빼고, 가타카나는 히라가나로)
const kanaOf = (x) => (x.kana ?? x.ja).normalize('NFKC')
  .replace(/[\s、。,.!?！？「」・〜~]/g, '')
  .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))

// 두 읽기가 얼마나 비슷한지 0~1
function similarity(a, b) {
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
  return 1 - prev[b.length] / Math.max(a.length, b.length, 1)
}

// 보기 OPTION_COUNT개(정답 포함, 섞어서): 소리 비슷한 상위 8개 중 3개 + 같은 상황 1개 + 모자라면 아무거나
export function optionsFor(s, allSentences, count = OPTION_COUNT) {
  const k = kanaOf(s)
  const others = allSentences.filter((x) => x.id !== s.id && x.ko !== s.ko)
  const alike = others
    .map((x) => ({ x, v: similarity(k, kanaOf(x)) }))
    .sort((a, b) => b.v - a.v)
    .slice(0, 8)
    .map((o) => o.x)
  const picked = []
  const add = (x) => {
    if (x && picked.length < count - 1 && !picked.some((p) => p.ko === x.ko)) picked.push(x)
  }
  shuffle(alike).slice(0, 3).forEach(add)
  add(shuffle(others.filter((x) => x.situation === s.situation)).find((x) => !picked.some((p) => p.ko === x.ko)))
  for (const x of shuffle(others)) add(x)
  return shuffle([s.ko, ...picked.map((x) => x.ko)])
}

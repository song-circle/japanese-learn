// 한글 발음 비교 (PC 한글 받아쓰기·소리 없이 말하기)
//   - 띄어쓰기·문장 부호는 무시하고, 장음 '-'는 소리로 본다
//   - 된소리와 거센소리(까/카, 따/타, 빠/파)는 같은 소리로 본다(표기 규칙 차이일 뿐 들리는 소리는 비슷)
//   - 자모 단위로 얼마나 비슷한지(0~1)와, 정답 글자마다 맞았는지(diff)를 돌려준다

const CHO_SAME = { 1: 15, 4: 16, 8: 17 } // ㄲ→ㅋ, ㄸ→ㅌ, ㅃ→ㅍ

// 비교에 쓰는 글자들: 한글 음절과 '-'만
export function units(text) {
  return [...text.normalize('NFC')].filter((ch) => /[가-힣-]/.test(ch))
}

function jamoOf(ch) {
  const c = ch.charCodeAt(0) - 0xac00
  if (c < 0 || c >= 11172) return [ch]
  let cho = Math.floor(c / 588)
  cho = CHO_SAME[cho] ?? cho
  const out = ['c' + cho, 'v' + Math.floor((c % 588) / 28)]
  if (c % 28) out.push('t' + (c % 28))
  return out
}

function levenshtein(a, b) {
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

// 같은 소리인 글자인지(된소리·거센소리 같게)
const sameUnit = (x, y) => jamoOf(x).join() === jamoOf(y).join()

// 정답 글자마다 맞았는지: 음절 단위로 정렬(편집 거리 역추적)
function align(target, input) {
  const n = target.length
  const m = input.length
  const d = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)))
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (sameUnit(target[i - 1], input[j - 1]) ? 0 : 1))
    }
  }
  const ok = Array(n).fill(false)
  let i = n
  let j = m
  while (i > 0 && j > 0) {
    if (d[i][j] === d[i - 1][j - 1] + (sameUnit(target[i - 1], input[j - 1]) ? 0 : 1)) {
      ok[i - 1] = sameUnit(target[i - 1], input[j - 1])
      i--
      j--
    } else if (d[i][j] === d[i - 1][j] + 1) {
      i--
    } else {
      j--
    }
  }
  return ok
}

// 결과: { score(0~1), diff: [{ ch, ok }] (정답 글자 순서, 띄어쓰기 포함해 보여 주기용) }
export function compareHangul(targetPron, input) {
  const t = units(targetPron)
  const u = units(input)
  const tj = t.flatMap(jamoOf)
  const uj = u.flatMap(jamoOf)
  const score = tj.length ? Math.max(0, 1 - levenshtein(tj, uj) / Math.max(tj.length, uj.length)) : 0
  const ok = align(t, u)
  // 보여 줄 때는 원래 정답 글(띄어쓰기 포함)에 맞았는지 표시
  let k = 0
  const diff = [...targetPron].map((ch) => (/[가-힣-]/.test(ch) ? { ch, ok: ok[k++] } : { ch, ok: true, space: true }))
  return { score, diff }
}

export const TYPE_PASS = 0.85

// 한글 발음 표기 규칙: 단어 중간의 ㅋ·ㅌ·ㅍ는 들리는 대로 ㄲ·ㄸ·ㅃ로 적는다
//   일본어 か·た·ぱ행은 단어 중간에서 힘을 빼고 발음해 한국 사람 귀에는 된소리에 가깝게 들린다.
//   (あたためますか: 아타타메마스카 → 아따따메마스까). 단어 첫 글자는 그대로. 장음 '-'는 단어 안으로 본다.

const TENSE = { 15: 1, 16: 4, 17: 8 } // 초성 ㅋ→ㄲ, ㅌ→ㄸ, ㅍ→ㅃ

export function tense(pron) {
  let out = ''
  let wordStart = true
  for (const ch of pron) {
    const code = ch.charCodeAt(0) - 0xac00
    if (code >= 0 && code < 11172) {
      const cho = Math.floor(code / 588)
      out += !wordStart && TENSE[cho] !== undefined ? String.fromCharCode(0xac00 + TENSE[cho] * 588 + (code % 588)) : ch
      wordStart = false
    } else {
      out += ch
      if (ch !== '-') wordStart = true
    }
  }
  return out
}

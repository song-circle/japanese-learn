// 한글 발음 표기를 실제로 들리는 소리에 가깝게: 단어 중간의 ㅋ·ㅌ·ㅍ → ㄲ·ㄸ·ㅃ
//   일본어 か·た·ぱ행은 단어 중간에서 힘을 빼고 발음해 한국 사람 귀에는 된소리에 가깝게 들린다.
//   (あたためますか: 아타타메마스카 → 아따따메마스까). 단어 첫 글자는 그대로.
//   node scripts/tense-pron.mjs          # 바뀌는 것 미리 보기
//   node scripts/tense-pron.mjs --write  # src/data/sentences.js에 적용
import fs from 'node:fs'

const FILE = 'src/data/sentences.js'
const TENSE = { 15: 1, 16: 4, 17: 8 } // 초성 ㅋ→ㄲ, ㅌ→ㄸ, ㅍ→ㅃ

export function tense(pron) {
  let out = ''
  let wordStart = true
  for (const ch of pron) {
    const code = ch.charCodeAt(0) - 0xac00
    if (code >= 0 && code < 11172) {
      const cho = Math.floor(code / 588)
      if (!wordStart && TENSE[cho] !== undefined) {
        out += String.fromCharCode(0xac00 + TENSE[cho] * 588 + (code % 588))
      } else {
        out += ch
      }
      wordStart = false
    } else {
      out += ch
      // 장음 표시 '-'는 단어 안이므로 단어 시작으로 보지 않는다
      if (ch !== '-') wordStart = true
    }
  }
  return out
}

if (process.argv[1]?.endsWith('tense-pron.mjs')) {
  const src = fs.readFileSync(FILE, 'utf8')
  const changes = []
  const fix = (s) => {
    const t = tense(s)
    if (t !== s) changes.push(`${s}  →  ${t}`)
    return t
  }
  const out = src
    // 문장 발음: pron: '...'
    .replace(/pron: '([^']*)'/g, (m, p) => `pron: '${fix(p)}'`)
    // 단어 풀이: ['일본어', '한글 발음', '뜻']
    .replace(/\['([^']*)', '([^']*)', '([^']*)'\]/g, (m, ja, p, ko) => `['${ja}', '${fix(p)}', '${ko}']`)
  console.log(changes.length, 'changes')
  console.log(changes.slice(0, 40).join('\n'))
  if (process.argv.includes('--write')) {
    fs.writeFileSync(FILE, out)
    console.log('written')
  }
}

// 숫자·가격·시간·개수·인원을 일본어로 읽기 (가나 + 한글 발음)
//   기기 TTS가 숫자를 틀리게 읽지 않도록 가나로 만들어 넘긴다.
//   읽기 조각은 [가나, 한글] 쌍. 장음은 '-'로 적는다.

const ONES = [null, ['いち', '이치'], ['に', '니'], ['さん', '산'], ['よん', '욘'], ['ご', '고'],
  ['ろく', '로쿠'], ['なな', '나나'], ['はち', '하치'], ['きゅう', '큐-']]

const join = (parts) => [parts.map((p) => p[0]).join(''), parts.map((p) => p[1]).join('')]

// 1~9999
function under10000(n) {
  const parts = []
  const th = Math.floor(n / 1000)
  const hu = Math.floor((n % 1000) / 100)
  const te = Math.floor((n % 100) / 10)
  const on = n % 10
  if (th) {
    if (th === 1) parts.push(['せん', '센'])
    else if (th === 3) parts.push(['さんぜん', '산젠'])
    else if (th === 8) parts.push(['はっせん', '핫센'])
    else parts.push(ONES[th], ['せん', '센'])
  }
  if (hu) {
    if (hu === 1) parts.push(['ひゃく', '햐쿠'])
    else if (hu === 3) parts.push(['さんびゃく', '삼뱌쿠'])
    else if (hu === 6) parts.push(['ろっぴゃく', '롯퍄쿠'])
    else if (hu === 8) parts.push(['はっぴゃく', '핫퍄쿠'])
    else parts.push(ONES[hu], ['ひゃく', '햐쿠'])
  }
  if (te) {
    if (te !== 1) parts.push(ONES[te])
    parts.push(['じゅう', '쥬-'])
  }
  if (on) parts.push(ONES[on])
  return parts
}

// 0~99999999 → 조각들
export function numberParts(n) {
  if (n === 0) return [['ぜろ', '제로']]
  const man = Math.floor(n / 10000)
  const rest = n % 10000
  const parts = []
  if (man) parts.push(...under10000(man), ['まん', '만'])
  if (rest) parts.push(...under10000(rest))
  return parts
}

export function readNumber(n) {
  return join(numberParts(n))
}

// 가격: 끝자리가 4면 'よえん'
export function readPrice(n) {
  const parts = numberParts(n)
  if (n % 10 === 4) {
    parts[parts.length - 1] = ['よ', '요']
  }
  return join([...parts, ['えん', '엔']])
}

const HOURS = [null, ['いちじ', '이치지'], ['にじ', '니지'], ['さんじ', '산지'], ['よじ', '요지'], ['ごじ', '고지'],
  ['ろくじ', '로쿠지'], ['しちじ', '시치지'], ['はちじ', '하치지'], ['くじ', '쿠지'], ['じゅうじ', '쥬-지'],
  ['じゅういちじ', '쥬-이치지'], ['じゅうにじ', '쥬-니지']]

// 분: 5분 단위. 30분은 '半'(はん)으로 읽을 때도 있다
function minuteParts(m, useHan) {
  if (m === 0) return []
  if (m === 30 && useHan) return [['はん', '한']]
  const te = Math.floor(m / 10)
  const on = m % 10
  const parts = []
  if (te > 1) parts.push(ONES[te])
  if (on === 0) {
    parts.push(['じゅっぷん', '쥽푼'])
  } else {
    if (te) parts.push(['じゅう', '쥬-'])
    // on은 5분 단위라 5만 나온다
    parts.push(['ごふん', '고훈'])
  }
  return parts
}

// 시간: { h: 1~12, m: 0~55, ampm: '' | 'am' | 'pm', han }
export function readTime({ h, m, ampm, han }) {
  const parts = []
  if (ampm === 'am') parts.push(['ごぜん', '고젠 '])
  if (ampm === 'pm') parts.push(['ごご', '고고 '])
  parts.push(HOURS[h], ...minuteParts(m, han))
  return join(parts)
}

// 개수(ひとつ…とお)와 인원(ひとり…)
const TSU = [null, ['ひとつ', '히토츠'], ['ふたつ', '후타츠'], ['みっつ', '밋츠'], ['よっつ', '욧츠'], ['いつつ', '이츠츠'],
  ['むっつ', '뭇츠'], ['ななつ', '나나츠'], ['やっつ', '얏츠'], ['ここのつ', '코코노츠'], ['とお', '토-']]
const NIN = [null, ['ひとり', '히토리'], ['ふたり', '후타리'], ['さんにん', '산닌'], ['よにん', '요닌'], ['ごにん', '고닌'],
  ['ろくにん', '로쿠닌'], ['ななにん', '나나닌'], ['はちにん', '하치닌'], ['きゅうにん', '큐-닌'], ['じゅうにん', '쥬-닌']]

export const readCount = (n) => TSU[n]
export const readPeople = (n) => NIN[n]

// ---------- 문제 만들기 ----------

const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1))
const pick = (xs) => xs[Math.floor(Math.random() * xs.length)]

// 실제로 자주 보는 가격 모양: 100엔 단위, 끝이 80·98, 10엔 단위 등
function randomPrice() {
  const kind = rand(1, 10)
  if (kind <= 3) return rand(1, 99) * 100            // 1,200
  if (kind <= 5) return rand(1, 49) * 100 + 80       // 1,280
  if (kind <= 7) return rand(1, 49) * 100 + 98       // 398
  if (kind <= 9) return rand(10, 999) * 10           // 4,560
  return rand(10, 50) * 1000                         // 23,000
}

const fmtPrice = (n) => `${n.toLocaleString('ko-KR')}엔`
const fmtTime = ({ h, m, ampm }) => `${ampm === 'am' ? '오전 ' : ampm === 'pm' ? '오후 ' : ''}${h}시${m ? ` ${m}분` : ''}`

// 문제: { kind, answer(숫자 문자열), show(정답 표시), ja(TTS에 넘길 가나 문장), pron(한글 발음), ko(뜻), scene }
// kind가 'mix'면 네 종류 중 하나를 고른다
export function makeQuestion(kind) {
  if (kind === 'mix') kind = pick(KINDS).id
  if (kind === 'price') {
    const n = randomPrice()
    const [kana, pron] = readPrice(n)
    const t = pick([
      [`${kana}です`, `${pron} 데스`, '점원: ~엔입니다', '편의점 계산대'],
      [`おかいけい、${kana}です`, `오카이케- ${pron} 데스`, '점원: 계산은 ~엔입니다', '식당 계산'],
      [`ぜんぶで${kana}になります`, `젠부데 ${pron} 니 나리마스`, '점원: 전부 ~엔입니다', '가게 계산대'],
    ])
    return { kind, answer: String(n), show: fmtPrice(n), ja: t[0], pron: t[1], ko: t[2].replace('~', fmtPrice(n).replace('엔', '')), scene: t[3] }
  }
  if (kind === 'time') {
    const time = { h: rand(1, 12), m: rand(0, 11) * 5, ampm: pick(['', '', 'am', 'pm']), han: Math.random() < 0.5 }
    const [kana, pron] = readTime(time)
    const t = pick([
      [`${kana}です`, `${pron} 데스`, '~입니다', '시간 묻기'],
      [`${kana}にしゅっぱつします`, `${pron} 니 슛파츠시마스`, '~에 출발합니다', '버스·전철 안내'],
      [`チェックアウトは${kana}です`, `첵쿠아우토와 ${pron} 데스`, '체크아웃은 ~입니다', '호텔 프런트'],
    ])
    const show = fmtTime(time)
    // 답은 '시'와 '분'을 붙인 숫자(3시 15분 = 315, 12시 = 1200). 오전·오후는 보기만
    return { kind, answer: `${time.h}${String(time.m).padStart(2, '0')}`, show, ja: t[0], pron: t[1], ko: t[2].replace('~', show), scene: t[3] }
  }
  if (kind === 'count') {
    const n = rand(1, 10)
    const [kana, pron] = readCount(n)
    const t = pick([
      [`これを${kana}ください`, `코레오 ${pron} 쿠다사이`, '이거 ~개 주세요', '가게에서 (손님)'],
      [`${kana}ですね`, `${pron} 데스네`, '~개 맞으시죠', '점원 확인'],
    ])
    return { kind, answer: String(n), show: `${n}개`, ja: t[0], pron: t[1], ko: t[2].replace('~', n), scene: t[3] }
  }
  // people
  const n = rand(1, 10)
  const [kana, pron] = readPeople(n)
  const t = pick([
    [`${kana}です`, `${pron} 데스`, '~명입니다', '식당 입구 (손님)'],
    [`${kana}さまですね`, `${pron} 사마 데스네`, '~분이시죠', '식당 점원 확인'],
  ])
  return { kind, answer: String(n), show: `${n}명`, ja: t[0], pron: t[1], ko: t[2].replace('~', n), scene: t[3] }
}

export const KINDS = [
  { id: 'price', name: '가격', icon: '💴', unit: '엔' },
  { id: 'time', name: '시간', icon: '🕒', unit: '시·분' },
  { id: 'count', name: '개수', icon: '🍙', unit: '개' },
  { id: 'people', name: '인원', icon: '👥', unit: '명' },
]

// 듣고 맞히기 복습 일정 (localStorage)
//   카드마다 단계(box)와 다음 복습일(due)을 둔다.
//   맞히면 단계가 오르고 간격이 늘어난다: 1일 → 2일 → 4일 → 7일 → 15일 → 30일
//   틀리면 1단계로 내려가고 오늘 다시 본다.

const KEY = 'japanese-learn-listen'
export const INTERVAL_DAYS = [0, 1, 2, 4, 7, 15, 30]
export const MAX_BOX = INTERVAL_DAYS.length - 1
export const NEW_PER_DAY = 5
export const MAX_REVIEWS = 30
// 이 단계부터는 보기 없이 떠올리고 스스로 채점한다
export const NO_OPTIONS_FROM_BOX = 3

export function today(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return today(new Date(y, m - 1, d + n))
}

const empty = () => ({ cards: {}, newDate: '', newToday: 0, points: 0, days: {} })

export function loadListen() {
  try {
    return { ...empty(), ...JSON.parse(localStorage.getItem(KEY) || '{}') }
  } catch {
    return empty()
  }
}

function save(state) {
  localStorage.setItem(KEY, JSON.stringify(state))
}

// 오늘 할 것: 복습할 카드(오래 밀린 것부터) + 오늘 남은 새 문장
export function todayPlan(allSentences, state = loadListen()) {
  const t = today()
  const reviews = allSentences
    .filter((s) => state.cards[s.id] && state.cards[s.id].due <= t)
    .sort((a, b) => state.cards[a.id].due.localeCompare(state.cards[b.id].due))
    .slice(0, MAX_REVIEWS)
  const newToday = state.newDate === t ? state.newToday : 0
  const news = allSentences.filter((s) => !state.cards[s.id]).slice(0, Math.max(0, NEW_PER_DAY - newToday))
  return { reviews, news }
}

export function boxOf(id, state = loadListen()) {
  return state.cards[id]?.box ?? 0
}

// 채점 결과 기록. 바뀐 카드를 돌려준다.
export function grade(id, correct, points = 0) {
  const state = loadListen()
  const t = today()
  const card = state.cards[id] ?? { box: 0, due: t, seen: 0, right: 0, wrong: 0 }
  const isNew = card.seen === 0
  card.seen += 1
  if (correct) {
    card.right += 1
    card.box = Math.min(card.box + 1, MAX_BOX)
  } else {
    card.wrong += 1
    card.box = 1
  }
  card.due = correct ? addDays(t, INTERVAL_DAYS[card.box]) : t
  state.cards[id] = card
  if (isNew) {
    if (state.newDate !== t) {
      state.newDate = t
      state.newToday = 0
    }
    state.newToday += 1
  }
  state.points += points
  const day = state.days[t] ?? { right: 0, wrong: 0, points: 0 }
  day[correct ? 'right' : 'wrong'] += 1
  day.points += points
  state.days[t] = day
  save(state)
  return card
}

// 같은 학습에서 틀려서 한 번 더 본 문제의 결과. 단계는 그대로 두고 다음 복습은 내일로
// (오늘 이미 두 번 봤으니 오늘 목록에 다시 띄우지 않는다). 점수는 그대로 쌓는다.
export function retryDone(id, points = 0) {
  const state = loadListen()
  const card = state.cards[id]
  if (!card) return
  card.due = addDays(today(), 1)
  state.points += points
  const t = today()
  const day = state.days[t] ?? { right: 0, wrong: 0, points: 0 }
  day.points += points
  state.days[t] = day
  save(state)
}

// 내일 복습할 카드 수 (결과 화면용)
export function dueTomorrow(state = loadListen()) {
  const tm = addDays(today(), 1)
  return Object.values(state.cards).filter((c) => c.due <= tm).length
}

// 복습 일정 (localStorage)
//   카드마다 단계(box)와 다음 복습일(due)을 둔다.
//   맞히면 단계가 오르고 간격이 늘어난다: 1일 → 2일 → 4일 → 7일 → 15일 → 30일
//   틀리면 1단계로 내려가고 오늘 다시 본다.
//   듣고 맞히기와 말해서 맞히기가 같은 방식을 쓰고, 저장 키만 다르다(makeSrs).

export const INTERVAL_DAYS = [0, 1, 2, 4, 7, 15, 30]
export const MAX_BOX = INTERVAL_DAYS.length - 1
// 하루 10개면 300문장을 30일 안에 다 배운다(30일 코스)
export const NEW_PER_DAY = 10
export const MAX_REVIEWS = 30
// 이 단계부터는 보기 없이 떠올리고 스스로 채점한다
export const NO_OPTIONS_FROM_BOX = 3

export function today(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return today(new Date(y, m - 1, d + n))
}

const empty = () => ({ cards: {}, newDate: '', newToday: 0, points: 0, days: {} })

export function makeSrs(KEY, newPerDay = NEW_PER_DAY) {
  function load() {
    try {
      return { ...empty(), ...JSON.parse(localStorage.getItem(KEY) || '{}') }
    } catch {
      return empty()
    }
  }

  function save(state) {
    localStorage.setItem(KEY, JSON.stringify(state))
  }

  function addPoints(state, t, points) {
    state.points += points
    const day = state.days[t] ?? { right: 0, wrong: 0, points: 0 }
    day.points += points
    state.days[t] = day
    return day
  }

  return {
    load,

    // 오늘 할 것: 복습할 카드(오래 밀린 것부터) + 오늘 남은 새 문장
    todayPlan(sentences, state = load()) {
      const t = today()
      const reviews = sentences
        .filter((s) => state.cards[s.id] && state.cards[s.id].due <= t)
        .sort((a, b) => state.cards[a.id].due.localeCompare(state.cards[b.id].due))
        .slice(0, MAX_REVIEWS)
      const newToday = state.newDate === t ? state.newToday : 0
      const news = sentences.filter((s) => !state.cards[s.id]).slice(0, Math.max(0, newPerDay - newToday))
      return { reviews, news }
    },

    boxOf(id, state = load()) {
      return state.cards[id]?.box ?? 0
    },

    // 채점 결과 기록. 바뀐 카드를 돌려준다.
    grade(id, correct, points = 0) {
      const state = load()
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
      const day = addPoints(state, t, points)
      day[correct ? 'right' : 'wrong'] += 1
      save(state)
      return card
    },

    // 같은 학습에서 틀려서 한 번 더 본 문제의 결과. 단계는 그대로 두고 다음 복습은 내일로
    // (오늘 이미 두 번 봤으니 오늘 목록에 다시 띄우지 않는다). 점수는 그대로 쌓는다.
    retryDone(id, points = 0) {
      const state = load()
      const card = state.cards[id]
      if (!card) return
      card.due = addDays(today(), 1)
      addPoints(state, today(), points)
      save(state)
    },

    // 내일 복습할 카드 수 (결과 화면용)
    dueTomorrow(state = load()) {
      const tm = addDays(today(), 1)
      return Object.values(state.cards).filter((c) => c.due <= tm).length
    },

    // 덤 점수(따라 말하기가 통했을 때 등). 복습 일정은 바꾸지 않는다.
    addBonus(points = 1) {
      const state = load()
      addPoints(state, today(), points)
      save(state)
    },
  }
}

// ---------- 듣고 맞히기 ----------
const listen = makeSrs('japanese-learn-listen')
export const loadListen = listen.load
export const todayPlan = listen.todayPlan
export const boxOf = listen.boxOf
export const grade = listen.grade
export const retryDone = listen.retryDone
export const dueTomorrow = listen.dueTomorrow
export const addBonus = listen.addBonus

// ---------- 말해서 맞히기 ----------
// 듣고 맞히기에서 이미 들어 본 '나'의 문장만 말하기로 넘어온다(듣기 → 말하기 순서).
export const speak = makeSrs('japanese-learn-speak')

export function speakSentences(allSentences, listenState = loadListen()) {
  return allSentences.filter((s) => s.who === '나' && listenState.cards[s.id])
}

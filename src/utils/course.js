// 30일 회화 코스: 날마다 같은 순서로 네 가지를 하고, 시간이 되면 보너스 두 가지
//   ① 듣고 맞히기(새 문장 7개 + 복습) → ② 말해서 맞히기(들어 본 '나'의 문장을 말로)
//   → ③ 패턴 바꿔 말하기 한 판 → ④ 오늘 상황의 대화 듣기 한 편
//   보너스: 숫자 듣기 한 판, AI 회화 한 번(끝내지 않아도 '오늘 끝'으로 친다)
// 진도는 각 기능의 기록으로 판단하고, 코스는 시작일과 단계별로 마지막으로 끝까지 한 날만 저장한다.
// 복습이 하루 상한(30개)보다 많이 밀리면 할 일이 0이 안 되므로, 그날 한 번 끝까지 했으면 그 단계는 끝으로 친다.

import { allSentences } from '../data/sentences'
import { dialogues } from '../data/dialogues'
import { today, todayPlan, loadListen, speak, speakSentences } from './listenSrs'

const KEY = 'japanese-learn-course'
export const COURSE_DAYS = 30

function load() {
  try {
    return { start: '', aiDays: {}, doneOn: {}, ...JSON.parse(localStorage.getItem(KEY) || '{}') }
  } catch {
    return { start: '', aiDays: {}, doneOn: {} }
  }
}

function save(c) {
  localStorage.setItem(KEY, JSON.stringify(c))
}

export function startCourse() {
  const c = load()
  c.start = today()
  save(c)
}

// AI 회화를 끝까지 한 번 하면 부른다
export function markAiTalk() {
  const c = load()
  c.aiDays[today()] = true
  save(c)
}

// 듣고 맞히기('listen')·말해서 맞히기('speak')·패턴('pattern')·대화('dialogue')·숫자('numbers')를
// 그날 끝까지 했을 때 부른다
export function markStepDone(key) {
  const c = load()
  c.doneOn = { ...c.doneOn, [key]: today() }
  save(c)
}

function daysBetween(a, b) {
  const [y1, m1, d1] = a.split('-').map(Number)
  const [y2, m2, d2] = b.split('-').map(Number)
  return Math.round((new Date(y2, m2 - 1, d2) - new Date(y1, m1 - 1, d1)) / 86400000)
}

// 오늘 AI 회화로 할 상황: 오늘 배울 새 문장의 상황. 오늘 새 문장을 다 했으면 가장 최근에 배운 문장의 상황
// (새 문장은 데이터 순서대로 나오므로 배운 것 중 마지막이 가장 최근)
function todaySituation(listenState, listenPlan) {
  const fresh = listenPlan.news[0]
    ?? [...allSentences].reverse().find((s) => listenState.cards[s.id])
    ?? allSentences[0]
  return { id: fresh.situation, name: fresh.situationName, icon: fresh.icon }
}

// 코스 상태. 시작 전이면 { started: false }
export function courseStatus() {
  const c = load()
  if (!c.start) return { started: false }
  const t = today()
  const day = daysBetween(c.start, t) + 1
  const listenState = loadListen()
  const lp = todayPlan(allSentences, listenState)
  const sp = speak.todayPlan(speakSentences(allSentences, listenState))
  const learned = Object.keys(listenState.cards).length
  const finished = (key, todo) => (c.doneOn?.[key] === t ? 0 : todo)
  const listenTodo = finished('listen', lp.reviews.length + lp.news.length)
  // 말하기 문장은 듣기에서 생긴다. 듣기가 남았는데 말할 것이 없으면 아직 끝이 아니라 '듣기 먼저'
  const speakWaiting = listenTodo > 0 && sp.reviews.length + sp.news.length === 0 && c.doneOn?.speak !== t
  const steps = [
    { key: 'listen', page: 'listen-guess', title: '듣고 맞히기', icon: '👂',
      todo: listenTodo,
      detail: `복습 ${lp.reviews.length} · 새 문장 ${lp.news.length}` },
    { key: 'speak', page: 'speak-guess', title: '말해서 맞히기', icon: '🎤',
      todo: speakWaiting ? 1 : finished('speak', sp.reviews.length + sp.news.length),
      detail: speakWaiting ? '듣고 맞히기를 하면 말할 문장이 생겨요' : `복습 ${sp.reviews.length} · 새 문장 ${sp.news.length}` },
  ]
  const sit = todaySituation(listenState, lp)
  // 오늘 상황의 대화(없으면 아무 대화나)
  const dlg = dialogues.find((d) => d.situation === sit.id) ?? dialogues[(day - 1) % dialogues.length]
  const doneToday = (key) => c.doneOn?.[key] === t
  steps.push(
    { key: 'pattern', page: 'patterns', title: '패턴 바꿔 말하기 한 판', icon: '🧩',
      todo: doneToday('pattern') ? 0 : 1, detail: '8문제 · 섞어서나 아무 틀이나' },
    { key: 'dialogue', page: 'dialogues', type: dlg.id, title: '대화 듣기 한 편', icon: '💬',
      todo: doneToday('dialogue') ? 0 : 1, detail: dlg.title },
  )
  const bonus = [
    { key: 'numbers', page: 'numbers', title: '숫자 듣기', icon: '💴', todo: doneToday('numbers') ? 0 : 1 },
    { key: 'ai', page: 'ai-talk', type: sit.id, title: 'AI 회화', icon: '🗣️', todo: c.aiDays[t] ? 0 : 1 },
  ]
  return {
    started: true,
    day: Math.min(day, COURSE_DAYS),
    over: day > COURSE_DAYS,
    steps,
    bonus,
    allDone: steps.every((s) => s.todo === 0),
    learned,
    total: allSentences.length,
  }
}

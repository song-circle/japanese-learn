// 오디오 수업 (출퇴근·걷기처럼 화면을 안 보는 시간용, Pimsleur 방식)
//   말하기 문장('나'·패턴): 한국어 뜻 → (일본어로?) → 생각하고 말할 시간 → 일본어 정답 → 따라 할 시간 → 한 번 더
//   듣기 문장(점원·상대) : 일본어 → (무슨 뜻일까요?) → 떠올릴 시간 → 한국어 뜻 → 일본어 한 번 더
//   소리만 듣고도 지금 무엇을 할 차례인지 알 수 있게:
//     - 듣기·말하기를 5문장씩 묶어서 같은 종류만 이어 내고, 묶음이 바뀔 때 "듣기 연습이에요…" / "말하기 연습이에요…"
//     - 한국어 바로 옆에 역할을 말로 붙인다
//         말하기: 딩-동 → 한국어 → "일본어로 말해 보세요" → 똑·똑(말할 시간) → "정답." → 일본어 ×2
//         듣기  : 종소리 → 일본어 → (생각할 시간) → "뜻은," → 한국어 → 일본어 한 번 더
//   문장 고르기: 오늘 복습할 것 → 배운 문장 중 단계가 낮은 것 → 패턴 문장(약 30%) → 그래도 모자라면 새 문장
//   ∞ 끝까지: 실제로 가장 많이 쓰는 곳(편의점·식당·이자카야·쇼핑·호텔과 카페·예약·기념품·방 문제) 문장을 80%로,
//             약한 것부터 40문장씩 이어 붙인다. 듣기 문장은 절반쯤 실전 표현(다른 표현·다른 목소리)으로

import { shuffle } from '../../src/utils/distractors.js'
import { pickSound } from '../../src/utils/realVariant.js'

// 실제로 가장 많이 쓰는 곳
export const FOCUS = ['konbini', 'restaurant', 'izakaya', 'shop', 'hotel', 'cafe', 'reserve', 'gift', 'room']
const BATCH = 40
const BLOCK = 5

// 듣기·말하기를 5문장씩 번갈아(같은 종류가 이어지게 해서 지금 무엇을 하는지 헷갈리지 않게)
function blockify(items) {
  const listen = items.filter((x) => x.role === 'listen')
  const speak = items.filter((x) => x.role === 'speak')
  const out = []
  while (listen.length || speak.length) {
    out.push(...listen.splice(0, BLOCK), ...speak.splice(0, BLOCK))
  }
  return out
}

const SECONDS_PER_ITEM = 18
const url = (id) => `./audio/${id}.mp3`

export function buildLesson({ minutes, plan, learned, levels, allSentences, patternSentences }) {
  const n = Math.max(5, Math.round((minutes * 60) / SECONDS_PER_ITEM))
  const nPattern = Math.round(n * 0.3)
  const picked = []
  const add = (s) => { if (s && !picked.some((x) => x.id === s.id)) picked.push(s) }
  plan.reviews.slice(0, n - nPattern).forEach(add)
  const known = shuffle(allSentences.filter((s) => learned[s.id])).sort((a, b) => (levels[a.id] ?? 0) - (levels[b.id] ?? 0))
  for (const s of known) {
    if (picked.length >= n - nPattern) break
    add(s)
  }
  shuffle(patternSentences).slice(0, n - picked.length).forEach(add)
  for (const s of allSentences) {
    if (picked.length >= n) break
    add(s)
  }
  // 말하기·듣기가 섞이게
  return blockify(shuffle(picked).map((s) => ({ s, role: s.pattern || s.who === '나' ? 'speak' : 'listen' })))
}

// ∞ 끝까지용 한 묶음(40문장). seen: 이번 수업에서 문장별로 나온 횟수(덜 나온 것부터)
export function buildEndlessBatch({ learned, levels, allSentences, patternSentences, seen }) {
  const weak = (a, b) => (seen.get(a.id) ?? 0) - (seen.get(b.id) ?? 0) || (levels[a.id] ?? 0) - (levels[b.id] ?? 0)
  const known = allSentences.filter((s) => learned[s.id])
  // 배운 문장이 적으면 전체에서(아직 안 배운 문장도 듣기로는 도움이 된다)
  const base = known.length >= 30 ? known : allSentences
  const focus = shuffle(base.filter((s) => FOCUS.includes(s.situation))).sort(weak)
  const other = shuffle(base.filter((s) => !FOCUS.includes(s.situation))).sort(weak)
  const pats = shuffle(patternSentences).sort(weak)
  const nPat = Math.round(BATCH * 0.15)
  const nFocus = Math.round((BATCH - nPat) * 0.8)
  const picked = [...focus.slice(0, nFocus), ...other.slice(0, BATCH - nPat - nFocus), ...pats.slice(0, nPat)]
  picked.forEach((s) => seen.set(s.id, (seen.get(s.id) ?? 0) + 1))
  return blockify(shuffle(picked).map((s) => {
    const role = s.pattern || s.who === '나' ? 'speak' : 'listen'
    // 듣기 문장은 실전 표현을 자주 섞는다(Lv1 기준 확률 50%)
    const sound = role === 'listen' ? pickSound(s, { level: 1, type: 'recall', mode: 'review' }) : null
    return { s, role, sound }
  }))
}

// 수업 재생기. onState({ index, total, phase, paused, done })를 부른다
//   phase: 'prompt'(문제 듣는 중) · 'think'(생각·말할 시간) · 'answer'(정답) · 'repeat'(따라 하기) · 'done'
// ---------- 신호음(웹 오디오로 만들어 파일이 필요 없다) ----------
let ctx = null
function beep(freq, start, dur, vol = 0.18, type = 'sine') {
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = type
  o.frequency.value = freq
  g.gain.setValueAtTime(0, ctx.currentTime + start)
  g.gain.linearRampToValueAtTime(vol, ctx.currentTime + start + 0.015)
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur)
  o.connect(g).connect(ctx.destination)
  o.start(ctx.currentTime + start)
  o.stop(ctx.currentTime + start + dur + 0.05)
}
// kind: 'speak'(딩-동, 올라감) · 'listen'(낮은 종소리) · 'answer'(짧은 알림) · 'tick'(초침)
// 끝나는 데 걸리는 시간(ms)을 돌려준다
function cue(kind) {
  try {
    ctx ??= new AudioContext()
    ctx.resume?.()
    if (kind === 'speak') { beep(659, 0, 0.35); beep(988, 0.18, 0.5); return 700 }
    if (kind === 'listen') { beep(392, 0, 0.9, 0.2, 'triangle'); beep(784, 0, 0.6, 0.05); return 750 }
    if (kind === 'answer') { beep(1319, 0, 0.18, 0.12); return 250 }
    if (kind === 'tick') { beep(1800, 0, 0.04, 0.06, 'square'); return 0 }
  } catch { /* 소리 없이 */ }
  return 0
}

// refill: ∞ 끝까지일 때 다음 묶음을 돌려주는 함수(없으면 items만 하고 끝)
export function createPlayer(items, onState, refill = null) {
  let index = 0
  let step = 0
  let steps = []
  let paused = false
  let stopped = false
  let audio = null
  let timer = null
  let lastDur = 1.5
  let phase = 'prompt'
  let tickTimers = []
  const clearTicks = () => { tickTimers.forEach(clearTimeout); tickTimers = [] }

  const emit = () => onState({ index, total: refill ? Infinity : items.length, phase, paused, done: phase === 'done', item: items[index] })

  // prev: 바로 앞 문장. 종류가 바뀌면(묶음 시작) 무슨 연습인지 먼저 알린다
  function stepsFor(it, prev) {
    // 실전 표현이면 그 음성으로(같은 뜻이라 한국어 뜻은 그대로)
    const ja = it.sound?.id ?? it.s.id
    const ko = `ko-${it.s.id}`
    const block = !prev || prev.role !== it.role
      ? [{ phase: 'prompt', clip: it.role === 'speak' ? 'block-speak' : 'block-listen' }]
      : []
    if (it.role === 'speak') {
      return [
        ...block,
        { phase: 'prompt', cue: 'speak' },
        { phase: 'prompt', clip: ko },
        { phase: 'prompt', clip: 'guide-say-jp' },
        { phase: 'think', pause: 4500, ticks: true }, // 똑·똑 소리가 나는 동안 일본어로 말하기
        { phase: 'answer', clip: 'guide-answer' },
        { phase: 'answer', clip: ja },
        { phase: 'repeat', pause: 'echo' }, // 방금 들은 길이만큼 따라 할 시간
        { phase: 'answer', clip: ja },
        { phase: 'repeat', pause: 'echo' },
      ]
    }
    return [
      ...block,
      { phase: 'prompt', cue: 'listen' },
      { phase: 'prompt', clip: ja },
      { phase: 'think', pause: 3000 },
      { phase: 'answer', clip: 'guide-meaning' },
      { phase: 'answer', clip: ko },
      { phase: 'answer', clip: ja },
      { phase: 'repeat', pause: 1200 },
    ]
  }

  function run() {
    if (stopped || paused) return
    if (step >= steps.length) {
      index += 1
      step = 0
      if (index >= items.length && refill) items.push(...refill())
      if (index >= items.length) return finish()
      steps = stepsFor(items[index], items[index - 1])
    }
    const st = steps[step]
    phase = st.phase
    emit()
    step += 1
    if (st.cue) {
      timer = setTimeout(run, cue(st.cue) + 100)
      return
    }
    if (st.clip) {
      audio = new Audio(url(st.clip))
      audio.onended = () => {
        if (st.phase === 'answer' && !st.clip.startsWith('ko-') && audio.duration) lastDur = audio.duration
        timer = setTimeout(run, 250)
      }
      audio.onerror = () => { timer = setTimeout(run, 300) }
      audio.play().catch(() => { timer = setTimeout(run, 300) })
    } else {
      const ms = st.pause === 'echo' ? Math.round(lastDur * 1100 + 900) : st.pause
      // 말할 시간에는 1초마다 초침 소리(지금이 말할 차례라는 신호)
      if (st.ticks) for (let t = 600; t < ms - 300; t += 1000) tickTimers.push(setTimeout(() => !paused && !stopped && cue('tick'), t))
      timer = setTimeout(run, ms)
    }
  }

  function finish() {
    phase = 'done'
    emit()
  }

  return {
    start() {
      // 시작 안내 → 첫 문장
      steps = [{ phase: 'prompt', clip: 'lesson-start' }, ...stepsFor(items[0], null)]
      run()
    },
    toggle() {
      if (phase === 'done') return
      paused = !paused
      if (paused) {
        clearTimeout(timer)
        clearTicks()
        audio?.pause()
        // 다시 시작할 때 지금 문장의 처음부터
        step = 0
        steps = stepsFor(items[index], items[index - 1])
        emit()
      } else {
        run()
      }
    },
    skip() {
      if (phase === 'done') return
      clearTimeout(timer)
      clearTicks()
      audio?.pause()
      step = steps.length // 다음 문장으로
      if (!paused) run()
      else {
        index = Math.min(index + 1, items.length - 1)
        step = 0
        steps = stepsFor(items[index], items[index - 1])
        emit()
      }
    },
    stop() {
      stopped = true
      clearTimeout(timer)
      clearTicks()
      audio?.pause()
    },
    endClip() {
      audio = new Audio(url('lesson-end'))
      audio.play().catch(() => {})
    },
  }
}

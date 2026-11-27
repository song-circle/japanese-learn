// 오디오 수업 (출퇴근·걷기처럼 화면을 안 보는 시간용, Pimsleur 방식)
//   말하기 문장('나'·패턴): 한국어 뜻 → (일본어로?) → 생각하고 말할 시간 → 일본어 정답 → 따라 할 시간 → 한 번 더
//   듣기 문장(점원·상대) : 일본어 → (무슨 뜻일까요?) → 떠올릴 시간 → 한국어 뜻 → 일본어 한 번 더
//   안내 말('일본어로?' 등)은 처음 몇 문장에만 넣는다(익숙해지면 군더더기)
//   문장 고르기: 오늘 복습할 것 → 배운 문장 중 단계가 낮은 것 → 패턴 문장(약 30%) → 그래도 모자라면 새 문장

import { shuffle } from '../../src/utils/distractors.js'

const SECONDS_PER_ITEM = 18
const GUIDE_FIRST = 3 // 안내 말을 넣는 처음 문장 수
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
  return shuffle(picked).map((s) => ({ s, role: s.pattern || s.who === '나' ? 'speak' : 'listen' }))
}

// 수업 재생기. onState({ index, total, phase, paused, done })를 부른다
//   phase: 'prompt'(문제 듣는 중) · 'think'(생각·말할 시간) · 'answer'(정답) · 'repeat'(따라 하기) · 'done'
export function createPlayer(items, onState) {
  let index = 0
  let step = 0
  let steps = []
  let paused = false
  let stopped = false
  let audio = null
  let timer = null
  let lastDur = 1.5
  let phase = 'prompt'

  const emit = () => onState({ index, total: items.length, phase, paused, done: phase === 'done', item: items[index] })

  function stepsFor(it, i) {
    const guide = i < GUIDE_FIRST
    const ja = it.s.id
    const ko = `ko-${it.s.id}`
    if (it.role === 'speak') {
      return [
        { phase: 'prompt', clip: ko },
        ...(guide ? [{ phase: 'prompt', clip: 'lesson-ask-jp' }] : []),
        { phase: 'think', pause: 4500 },
        { phase: 'answer', clip: ja },
        ...(guide ? [{ phase: 'repeat', clip: 'lesson-repeat' }] : []),
        { phase: 'repeat', pause: 'echo' }, // 방금 들은 길이만큼 따라 할 시간
        { phase: 'answer', clip: ja },
        { phase: 'repeat', pause: 'echo' },
      ]
    }
    return [
      { phase: 'prompt', clip: ja },
      ...(guide ? [{ phase: 'prompt', clip: 'lesson-ask-meaning' }] : []),
      { phase: 'think', pause: 3500 },
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
      if (index >= items.length) return finish()
      steps = stepsFor(items[index], index)
    }
    const st = steps[step]
    phase = st.phase
    emit()
    step += 1
    if (st.clip) {
      audio = new Audio(url(st.clip))
      audio.onended = () => {
        if (st.clip === items[index]?.s.id && audio.duration) lastDur = audio.duration
        timer = setTimeout(run, 250)
      }
      audio.onerror = () => { timer = setTimeout(run, 300) }
      audio.play().catch(() => { timer = setTimeout(run, 300) })
    } else {
      const ms = st.pause === 'echo' ? Math.round(lastDur * 1100 + 900) : st.pause
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
      steps = [{ phase: 'prompt', clip: 'lesson-start' }, ...stepsFor(items[0], 0)]
      run()
    },
    toggle() {
      if (phase === 'done') return
      paused = !paused
      if (paused) {
        clearTimeout(timer)
        audio?.pause()
        // 다시 시작할 때 지금 문장의 처음부터
        step = 0
        steps = stepsFor(items[index], index)
        emit()
      } else {
        run()
      }
    },
    skip() {
      if (phase === 'done') return
      clearTimeout(timer)
      audio?.pause()
      step = steps.length // 다음 문장으로
      if (!paused) run()
      else {
        index = Math.min(index + 1, items.length - 1)
        step = 0
        steps = stepsFor(items[index], index)
        emit()
      }
    },
    stop() {
      stopped = true
      clearTimeout(timer)
      audio?.pause()
    },
    endClip() {
      audio = new Audio(url('lesson-end'))
      audio.play().catch(() => {})
    },
  }
}

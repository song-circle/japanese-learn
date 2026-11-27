// 오른쪽 아래 작은 창: 소리 듣고 맞히기 (단계식)
//   문제 순서는 휴대폰 듣고 맞히기와 같다(복습할 것 먼저, 그다음 오늘의 새 문장).
//   오늘 할 것(복습 + 새 문장 20개)을 다 했으면 배운 문장에서 골라 연습한다(복습 일정은 바꾸지 않음).
//   연습은 최근 10개를 빼고, 덜 나온 것·단계가 낮은 것부터. '새 문장 10개 더'로 범위를 넓힐 수 있다.
//
//   문장마다 PC 단계(0~3)가 있고, 힌트 없이 첫 답을 맞히면 오르고 틀리면 내려간다(힌트 쓰고 맞히면 그대로).
//     0 뜻 고르기    : 보기 5개, 오답은 소리가 비슷한 문장 위주
//     1 뜻 떠올리기  : 보기 없이 떠올리고 정답을 본 뒤 스스로 채점
//     2 빈칸 듣기    : 한글 발음 문장의 한 단어가 빈칸. 들린 단어를 발음이 비슷한 5개 중에서 고른다
//     3 실전 소리    : 빈칸 듣기를 1.25배 속도 + 가게 소음으로
//   장면 설명(어디서·누가)은 답을 낸 뒤에만 보여 준다.
//   힌트: 처음엔 숨김. 💡(H)를 누를 때마다 하나씩(각 -1점). 틀리면 정답을 알려 주지 않고 다시 고르게 한다.
//   키보드: 1~5 고르기 · R 다시 듣기 · S 느리게 · H 힌트 · 0 포기(정답 보기) · N 새 문장 더 · Space/Enter 다음 · Esc 닫기

import './style.css'
import { allSentences } from '../../src/data/sentences.js'
import { makeSrs, today } from '../../src/utils/listenSrs.js'
import { optionsFor, shuffle, OPTION_COUNT } from '../../src/utils/distractors.js'
import { clozeFor } from '../../src/utils/cloze.js'
import { LEVELS, makeLevels, questionType } from '../../src/utils/levels.js'
import { playReal, stopNoise } from '../../src/utils/realSound.js'

// 휴대폰과 같은 저장 방식이지만 PC는 하루 종일 켜 두므로 새 문장을 하루 20개까지 낸다(휴대폰은 7개)
const KEY = 'japanese-learn-listen'
const PC_NEW_PER_DAY = 20

// '새 문장 10개 더'로 늘린 오늘의 추가분
function extraToday() {
  try {
    const e = JSON.parse(localStorage.getItem('desk-extra') || '{}')
    return e.date === today() ? e.n : 0
  } catch {
    return 0
  }
}
function addExtra(n) {
  localStorage.setItem('desk-extra', JSON.stringify({ date: today(), n: extraToday() + n }))
}
const srs = () => makeSrs(KEY, PC_NEW_PER_DAY + extraToday())

// ---------- PC 단계 (휴대폰과 같은 코드, 저장은 PC에) ----------
const levels = makeLevels('desk-levels')
const levelOf = levels.levelOf
const loadLevels = levels.load

const card = document.getElementById('card')
const desk = window.desk

const audioUrl = (id, slow) => `./audio/${id}${slow ? '.slow' : ''}.mp3`
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

const subj = (word) => {
  const c = word.charCodeAt(word.length - 1) - 0xac00
  return word + (c >= 0 && c < 11172 && c % 28 !== 0 ? '이' : '가')
}
const whoText = (who) => (who === '나' ? '내가 하는 말' : `${subj(who)} 하는 말`)

// ---------- 상태 ----------
// q: { s, mode: 'review'|'new'|'practice', level, type: 'choose'|'recall'|'cloze', real(실전 소리),
//      options, answer, cloze, removed: Set, wrongs: Set }
let q = null
let revealed = false // 떠올리기 문제에서 정답을 열었는지
let first = null     // 첫 번째 답이 맞았는지(채점은 이것으로). 아직이면 null
let done = null      // 정답을 보여 주는 중이면 'right' | 'gaveup'
let hintLevel = 0
let audio = null
let recent = []      // 방금 본 문장 10개는 바로 다시 내지 않는다
const retryIds = new Set()   // 오늘 틀린 문장: 한 번 더 나오고 그 결과는 다음 복습만 내일로(휴대폰과 같음)
const shownCount = new Map() // 이번에 켠 뒤 문장별로 몇 번 나왔는지
let session = { right: 0, total: 0, points: 0 }
let hideTimer = null
let levelChange = 0  // 이번 문제로 단계가 오르면 1, 내려가면 -1

const hintSteps = () => {
  if (!q) return []
  if (q.type === 'cloze') return ['meaning', 'fifty']
  return ['pron', ...(q.s.words.length ? ['word'] : []), ...(q.type === 'choose' ? ['fifty'] : [])]
}

// ---------- 소리 ----------
// 실전 소리(1.25배 + 가게 소음)는 휴대폰과 같은 코드(src/utils/realSound.js)
function play(slow = false) {
  if (!q) return
  audio?.pause()
  stopNoise()
  audio = new Audio(audioUrl(q.s.id, slow))
  if (q.real && !slow && !done) playReal(audio)
  else audio.play().catch(() => {})
}

function reportStatus() {
  const p = srs().todayPlan(allSentences)
  const left = p.reviews.length + p.news.length
  desk.status(left ? `오늘 남은 것: 복습 ${p.reviews.length} · 새 문장 ${p.news.length}` : '오늘 할 것 끝! (지금은 연습 문제)')
}

// ---------- 문제 고르기 ----------
function pickQuestion() {
  const p = srs().todayPlan(allSentences)
  const notRecent = (x) => !recent.includes(x.id)
  let s = p.reviews.find(notRecent) ?? p.news.find(notRecent)
  let mode = s && p.reviews.includes(s) ? 'review' : 'new'
  if (!s) {
    // 오늘 할 것 끝: 배운 문장 중 덜 나온 것 → 단계가 낮은 것 순서로(같으면 무작위)
    const learned = srs().load().cards
    const levels = loadLevels()
    const pool = allSentences.filter((x) => learned[x.id] && notRecent(x))
    const ranked = shuffle(pool.length ? pool : allSentences.filter(notRecent))
      .sort((a, b) => (shownCount.get(a.id) ?? 0) - (shownCount.get(b.id) ?? 0)
        || (levels[a.id] ?? 0) - (levels[b.id] ?? 0))
    s = ranked[0]
    mode = 'practice'
  }
  recent = [s.id, ...recent].slice(0, 10)
  shownCount.set(s.id, (shownCount.get(s.id) ?? 0) + 1)

  // 새 문장은 늘 뜻 고르기. 그 밖에는 문장의 단계대로(빈칸을 못 만드는 문장은 떠올리기로)
  const level = mode === 'new' ? 0 : levelOf(s.id)
  const cloze = level >= 2 ? clozeFor(s, allSentences, OPTION_COUNT) : null
  const { type, real } = questionType(level, !!cloze)
  const base = { s, mode, level, type, real, removed: new Set(), wrongs: new Set() }
  if (type === 'cloze') return { ...base, cloze, options: cloze.options, answer: cloze.answer }
  if (type === 'recall') return { ...base, options: [], answer: s.ko }
  return { ...base, options: optionsFor(s, allSentences), answer: s.ko }
}

function next() {
  clearTimeout(hideTimer)
  q = pickQuestion()
  first = null
  done = null
  revealed = false
  hintLevel = 0
  levelChange = 0
  render()
  play()
}

// 첫 번째 답으로 채점: 맞으면 3점에서 연 힌트 수만큼 빼고(최소 1점), 단계는 힌트 없이 맞히면 +1, 틀리면 -1
function gradeFirst(correct) {
  first = correct
  const points = correct ? Math.max(1, 3 + q.level - hintLevel) : 0 // 높은 단계일수록 점수도 크게
  const { grade, retryDone, addBonus } = srs()
  if (q.mode === 'practice') {
    if (points) addBonus(Math.max(1, q.level))
  } else if (retryIds.has(q.s.id)) {
    retryIds.delete(q.s.id)
    retryDone(q.s.id, points)
  } else {
    grade(q.s.id, correct, points)
    if (!correct) retryIds.add(q.s.id)
  }
  levelChange = levels.update(q.s.id, correct, hintLevel > 0)
  session.total += 1
  session.right += correct ? 1 : 0
  session.points += q.mode === 'practice' ? (points ? Math.max(1, q.level) : 0) : points
  reportStatus()
}

function choose(opt) {
  if (!q || done || q.removed.has(opt) || q.wrongs.has(opt)) return
  const correct = opt === q.answer
  if (first === null) gradeFirst(correct)
  if (correct) {
    done = 'right'
    stopNoise()
    // 한 번에 맞혔으면 잠시 뒤 저절로 닫힌다(창 위에 마우스가 있으면 그대로)
    if (first) hideTimer = setTimeout(() => { if (!card.matches(':hover')) desk.hide() }, 7000)
  } else {
    // 틀려도 정답은 알려 주지 않는다. 그 보기만 막고 한 번 더 들려준다
    q.wrongs.add(opt)
    setTimeout(() => play(), 350)
  }
  render()
}

// 떠올리기 문제: 정답 보기 → 스스로 채점
function reveal() {
  if (!q || q.type !== 'recall' || done || revealed) return
  revealed = true
  render()
}
function selfGrade(correct) {
  if (!q || q.type !== 'recall' || done || !revealed) return
  gradeFirst(correct)
  done = correct ? 'right' : 'gaveup'
  render()
}

function giveUp() {
  if (!q || done || q.type === 'recall') return
  if (first === null) gradeFirst(false)
  done = 'gaveup'
  stopNoise()
  render()
  play()
}

// 힌트 하나 더 열기 (💡 버튼, H 키)
function nextHint() {
  if (!q || done || revealed) return
  const steps = hintSteps()
  if (hintLevel >= steps.length) return
  const kind = steps[hintLevel]
  hintLevel += 1
  if (kind === 'fifty') {
    const left = q.options.filter((o) => o !== q.answer && !q.wrongs.has(o))
    shuffle(left).slice(0, 2).forEach((o) => q.removed.add(o))
  }
  render()
}

function moreNew() {
  addExtra(10)
  reportStatus()
  next()
}

// ---------- 화면 ----------
function render() {
  if (!q) return
  const s = q.s
  const modeLabel = q.mode === 'new' ? '<span class="tag">새 문장</span>' : q.mode === 'review' ? '복습' : '연습'
  const levelLabel = `<span class="lv lv${q.level}">Lv${q.level} ${LEVELS[q.type === 'recall' && q.level >= 2 ? 1 : q.level]}</span>`
  const ask = q.type === 'recall' ? '🧠 소리만 듣고 뜻을 떠올려 보세요 (보기 없음)'
    : q.type === 'cloze' ? (q.real ? '🔊 빠르고 시끄러워요. 빈칸에 들린 말을 고르세요' : '✏️ 빈칸에 들린 말을 고르세요')
    : '🎧 소리만 듣고 뜻을 골라 보세요'
  // 장면 설명은 답을 낸 뒤에만(미리 보이면 상황만 보고 맞힐 수 있음)
  const scene = done ? `${s.icon} ${esc(s.scene)} · ${whoText(s.who)}` : ask
  const steps = hintSteps()
  const opened = steps.slice(0, hintLevel)
  const moreHints = !done && !revealed && hintLevel < steps.length
  const lvMsg = levelChange > 0 ? ` · ⬆ Lv${levelOf(s.id)} ${LEVELS[levelOf(s.id)]}로` : levelChange < 0 ? ` · ⬇ Lv${levelOf(s.id)}로` : ''
  const verdict = q.type === 'recall' ? (done === 'right' ? ['ok', `떠올렸어요 👍${lvMsg}`] : ['ng', `다음에 다시 나와요${lvMsg}`])
    : done === 'gaveup' ? ['ng', `정답은 이거예요${lvMsg}`]
    : first ? ['ok', `정답! 🎉${lvMsg}`] : ['ok', `맞혔어요 (${q.wrongs.size + 1}번째에)${lvMsg}`]

  const optionsHtml = q.type === 'recall' ? '' : `
    <div class="options">
      ${q.options.map((o, i) => {
        let cls = 'opt'
        if (done && o === q.answer) cls += ' correct'
        else if (q.wrongs.has(o)) cls += ' wrong'
        else if (q.removed.has(o)) cls += ' gone'
        const off = !!done || q.removed.has(o) || q.wrongs.has(o)
        return `<button class="${cls}" data-opt="${i}" ${off ? 'disabled' : ''}><span class="k">${i + 1}</span>${esc(o)}</button>`
      }).join('')}
    </div>`

  card.innerHTML = `
    <div class="top">
      <span>👂 ${modeLabel} ${levelLabel}</span>
      <span class="grow"></span>
      <span>${session.right}/${session.total} · ${session.points}점</span>
      <button class="x" data-act="close" title="닫기 (Esc)">✕</button>
    </div>
    <div class="scene">${scene}</div>
    <div class="row">
      <button class="small play" data-act="play">🔊 다시 듣기 <kbd>R</kbd></button>
      <button class="small" data-act="slow">🐢 느리게 <kbd>S</kbd></button>
      ${moreHints ? `<button class="small" data-act="hint">💡 힌트${first === null ? ' -1점' : ''} <kbd>H</kbd></button>` : ''}
    </div>
    ${q.type === 'cloze' && !done ? `<div class="cloze">${esc(q.cloze.masked).replace('____', '<span class="blank">____</span>')}</div>` : ''}
    ${!done && opened.includes('pron') ? `<div class="hint"><span class="sub">발음</span> ${esc(s.pron)}</div>` : ''}
    ${!done && opened.includes('word') ? `<div class="hint"><span class="sub">첫 단어</span> ${esc(s.words[0][1])} = ${esc(s.words[0][2])}</div>` : ''}
    ${!done && opened.includes('meaning') ? `<div class="hint"><span class="sub">문장 뜻</span> ${esc(s.ko)}</div>` : ''}
    ${!done && q.wrongs.size ? '<div class="hint ngtext">✗ 아니에요. 다시 듣고 골라 보세요</div>' : ''}
    ${q.type === 'recall' && !done ? (revealed ? `
      <div class="result">
        <div class="pron">${esc(s.pron)}</div>
        <div class="ja">${esc(s.ja)} — <b>${esc(s.ko)}</b></div>
        <div class="row">
          <button class="small play" data-act="self-right">떠올렸어요 <kbd>1</kbd></button>
          <button class="small" data-act="self-wrong">몰랐어요 <kbd>2</kbd></button>
        </div>
      </div>` : `
      <div class="row"><button class="small play" data-act="reveal">뜻을 떠올렸으면 정답 보기 <kbd>Space</kbd></button></div>`) : optionsHtml}
    ${done ? `
      <div class="result">
        <div class="verdict ${verdict[0]}">${verdict[1]}</div>
        <div class="pron">${esc(s.pron)}</div>
        <div class="ja">${esc(s.ja)} — ${esc(s.ko)}</div>
        ${q.type === 'cloze' ? `<div class="ja">빈칸: <b>${esc(q.answer)}</b> = ${esc(q.cloze.answerKo)}</div>` : ''}
        ${s.words.length ? `<ul class="words">${s.words.map(([, p, k]) => `<li>${esc(p)} — ${esc(k)}</li>`).join('')}</ul>` : ''}
        <div class="row">
          <button class="small play" data-act="next">다음 문제 <kbd>Space</kbd></button>
          <button class="small" data-act="close">닫기 <kbd>Esc</kbd></button>
        </div>
      </div>` : q.type === 'recall' ? '' : `
      <div class="row" style="justify-content: space-between; align-items: center">
        <span class="keys">1~${q.options.length} 고르기 · Esc 닫기</span>
        <button class="small" data-act="giveup">포기 (정답 보기) <kbd>0</kbd></button>
      </div>`}
    ${q.mode === 'practice' ? `
      <div class="row more">
        <span class="keys">오늘 할 것은 끝. 배운 문장으로 연습 중</span>
        <button class="small" data-act="more">➕ 새 문장 10개 더 <kbd>N</kbd></button>
      </div>` : ''}
  `
  fit()
}

function fit() {
  requestAnimationFrame(() => desk.resize(card.offsetHeight))
}

// 처음 실행했을 때만 사용법을 보여 준다(자동 실행 때마다 뜨지 않게)
async function welcome() {
  if (localStorage.getItem('desk-welcomed')) return
  localStorage.setItem('desk-welcomed', '1')
  desk.show()
  const key = await desk.hotkey()
  card.innerHTML = `
    <div class="top"><span>👂 日本語 듣기</span><span class="grow"></span><button class="x" data-act="close">✕</button></div>
    <div class="welcome">
      <p><b>${key ? `<kbd>${esc(key)}</kbd>` : '오른쪽 아래 트레이 아이콘'}</b>을 누르면 일본어가 들리고 여기에 문제가 떠요.</p>
      <p>맞힐수록 문제가 어려워져요: 뜻 고르기 → 뜻 떠올리기 → 빈칸 듣기 → 실전 소리(빠르게 + 소음).</p>
      <p>트레이 아이콘을 오른쪽 클릭하면 'Windows 시작할 때 자동 실행'을 켤 수 있어요. 기록은 이 PC에만 쌓여요.</p>
    </div>
    <div class="row"><button class="small play" data-act="next">지금 한 문제 풀기</button></div>
  `
  fit()
}

// ---------- 입력 ----------
card.addEventListener('click', (e) => {
  const b = e.target.closest('button')
  if (!b) return
  if (b.dataset.opt !== undefined) return choose(q.options[Number(b.dataset.opt)])
  const act = b.dataset.act
  if (act === 'close') desk.hide()
  else if (act === 'play') play()
  else if (act === 'slow') play(true)
  else if (act === 'next') next()
  else if (act === 'hint') nextHint()
  else if (act === 'giveup') giveUp()
  else if (act === 'reveal') reveal()
  else if (act === 'self-right') selfGrade(true)
  else if (act === 'self-wrong') selfGrade(false)
  else if (act === 'more') moreNew()
})

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase()
  if (k === 'escape') return desk.hide()
  if (!q) {
    if (k === ' ' || k === 'enter') next()
    return
  }
  if (q.type === 'recall' && !done) {
    if (!revealed && (k === ' ' || k === 'enter')) { e.preventDefault(); return reveal() }
    if (revealed && k === '1') return selfGrade(true)
    if (revealed && k === '2') return selfGrade(false)
  } else if (!done && /^[1-9]$/.test(k) && Number(k) <= q.options.length) {
    return choose(q.options[Number(k) - 1])
  }
  if (!done && q.type !== 'recall' && k === '0') return giveUp()
  if (k === 'r') return play()
  if (k === 's') return play(true)
  if (k === 'h') return nextHint()
  if (k === 'n' && q.mode === 'practice') return moreNew()
  if (done && (k === ' ' || k === 'enter')) {
    e.preventDefault()
    next()
  }
})

card.addEventListener('mouseenter', () => clearTimeout(hideTimer))

// 단축키·트레이: 풀기 전 문제가 있으면 다시 듣기, 아니면 새 문제
desk.onAsk(() => {
  if (q && !done) play()
  else next()
})
desk.onWelcome(welcome)
reportStatus()

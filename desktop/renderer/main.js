// 오른쪽 아래 작은 창: 소리 듣고 뜻 고르기
//   문제 순서는 휴대폰 듣고 맞히기와 같다(복습할 것 먼저, 그다음 오늘의 새 문장).
//   오늘 할 것(복습 + 새 문장 20개)을 다 했으면 배운 문장에서 골라 연습만 한다(복습 일정은 바꾸지 않음).
//   연습은 최근 10개를 빼고, 덜 나온 것·자주 틀린 것부터.
//   힌트: 처음엔 숨김. 💡(H)를 누를 때마다 한글 발음 → 첫 단어 뜻 → 보기 둘 지우기 순서로 하나씩(각 -1점)
//   틀리면 정답을 알려 주지 않고 그 보기만 막은 뒤 다시 들려준다. 채점은 첫 번째로 고른 답으로
//   키보드: 1~4 고르기 · R 다시 듣기 · S 느리게 · H 힌트 · 0 포기(정답 보기) · Space/Enter 다음 · Esc 닫기

import './style.css'
import { allSentences } from '../../src/data/sentences.js'
import { makeSrs } from '../../src/utils/listenSrs.js'

// 휴대폰과 같은 저장 방식이지만 PC는 하루 종일 켜 두므로 새 문장을 하루 20개까지 낸다(휴대폰은 7개)
const PC_NEW_PER_DAY = 20
const srs = makeSrs('japanese-learn-listen', PC_NEW_PER_DAY)
const { todayPlan, grade, retryDone, addBonus } = srs
const loadListen = srs.load

const card = document.getElementById('card')
const desk = window.desk

const audioUrl = (id, slow) => `./audio/${id}${slow ? '.slow' : ''}.mp3`
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const shuffle = (xs) => {
  const a = [...xs]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// 오답 보기: 같은 상황의 다른 문장 뜻을 먼저, 모자라면 다른 상황에서
function optionsFor(s) {
  const same = shuffle(allSentences.filter((x) => x.situation === s.situation && x.id !== s.id))
  const other = shuffle(allSentences.filter((x) => x.situation !== s.situation))
  const wrong = [...same, ...other].map((x) => x.ko).filter((ko, i, arr) => ko !== s.ko && arr.indexOf(ko) === i).slice(0, 3)
  return shuffle([s.ko, ...wrong])
}

const subj = (word) => {
  const c = word.charCodeAt(word.length - 1) - 0xac00
  return word + (c >= 0 && c < 11172 && c % 28 !== 0 ? '이' : '가')
}
const whoText = (who) => (who === '나' ? '내가 하는 말' : `${subj(who)} 하는 말`)

// ---------- 상태 ----------
let q = null        // { s, mode: 'review' | 'new' | 'practice', options, removed: Set(힌트로 지운 보기), wrongs: Set(틀리게 고른 보기) }
let first = null    // 첫 번째로 고른 답이 맞았는지(채점은 이것으로). 아직 안 골랐으면 null
let done = null     // 정답을 보여 주는 중이면 'right' | 'gaveup'
let hintLevel = 0   // 연 힌트 수: 한글 발음 → 첫 단어 뜻 → 보기 둘 지우기 순서로 하나씩
let audio = null
let recent = []     // 방금 본 문장 10개는 바로 다시 내지 않는다
// 오늘 틀린 문장: 한 번 더 나오고, 그 결과는 단계를 바꾸지 않고 다음 복습을 내일로(휴대폰과 같음)
const retryIds = new Set()
const shownCount = new Map() // 이번에 켠 뒤 문장별로 몇 번 나왔는지(연습 문제를 고르게 섞으려고)
let session = { right: 0, total: 0, points: 0 }
let hideTimer = null

const hintSteps = (s) => ['pron', ...(s.words.length ? ['word'] : []), 'fifty']

function play(slow = false) {
  if (!q) return
  audio?.pause()
  audio = new Audio(audioUrl(q.s.id, slow))
  audio.play().catch(() => {})
}

function reportStatus() {
  const p = todayPlan(allSentences)
  const left = p.reviews.length + p.news.length
  desk.status(left ? `오늘 남은 것: 복습 ${p.reviews.length} · 새 문장 ${p.news.length}` : '오늘 할 것 끝! (지금은 연습 문제)')
}

function pickQuestion() {
  const p = todayPlan(allSentences)
  const notRecent = (x) => !recent.includes(x.id)
  let s = p.reviews.find(notRecent) ?? p.news.find(notRecent)
  let mode = s && p.reviews.includes(s) ? 'review' : 'new'
  if (!s) {
    // 오늘 할 것 끝: 배운 문장에서 아무거나 (하나도 안 배웠으면 전체에서)
    // 덜 나온 것 → 아직 단계가 낮은(자주 틀린) 것 순서로, 같으면 무작위
    const learned = loadListen().cards
    const pool = allSentences.filter((x) => learned[x.id] && notRecent(x))
    const ranked = shuffle(pool.length ? pool : allSentences.filter(notRecent))
      .sort((a, b) => (shownCount.get(a.id) ?? 0) - (shownCount.get(b.id) ?? 0)
        || (learned[a.id]?.box ?? 0) - (learned[b.id]?.box ?? 0))
    s = ranked[0]
    mode = 'practice'
  }
  recent = [s.id, ...recent].slice(0, 10)
  shownCount.set(s.id, (shownCount.get(s.id) ?? 0) + 1)
  return { s, mode, options: optionsFor(s), removed: new Set(), wrongs: new Set() }
}

function next() {
  clearTimeout(hideTimer)
  q = pickQuestion()
  first = null
  done = null
  hintLevel = 0
  render()
  play()
}

// 첫 번째 답으로 채점: 맞으면 3점에서 연 힌트 수만큼 빼고(최소 1점), 틀리면 0점·복습 간격 처음부터
function gradeFirst(correct) {
  first = correct
  const points = correct ? Math.max(1, 3 - hintLevel) : 0
  if (q.mode === 'practice') {
    if (points) addBonus(1) // 연습은 일정은 그대로, 맞히면 1점만
  } else if (retryIds.has(q.s.id)) {
    retryIds.delete(q.s.id)
    retryDone(q.s.id, points)
  } else {
    grade(q.s.id, correct, points)
    if (!correct) retryIds.add(q.s.id)
  }
  session.total += 1
  session.right += correct ? 1 : 0
  session.points += q.mode === 'practice' ? (points ? 1 : 0) : points
  reportStatus()
}

function choose(opt) {
  if (!q || done || q.removed.has(opt) || q.wrongs.has(opt)) return
  const correct = opt === q.s.ko
  if (first === null) gradeFirst(correct)
  if (correct) {
    done = 'right'
    // 한 번에 맞혔으면 잠시 뒤 저절로 닫힌다(창 위에 마우스가 있으면 그대로)
    if (first) hideTimer = setTimeout(() => { if (!card.matches(':hover')) desk.hide() }, 6000)
  } else {
    // 틀려도 정답은 알려 주지 않는다. 그 보기만 막고 한 번 더 들려준다
    q.wrongs.add(opt)
    setTimeout(() => play(), 350)
  }
  render()
}

function giveUp() {
  if (!q || done) return
  if (first === null) gradeFirst(false)
  done = 'gaveup'
  render()
  play()
}

// 힌트 하나 더 열기 (💡 버튼, H 키)
function nextHint() {
  if (!q || done) return
  const steps = hintSteps(q.s)
  if (hintLevel >= steps.length) return
  const kind = steps[hintLevel]
  hintLevel += 1
  if (kind === 'fifty') {
    const left = q.options.filter((o) => o !== q.s.ko && !q.wrongs.has(o))
    shuffle(left).slice(0, 2).forEach((o) => q.removed.add(o))
  }
  render()
}

// ---------- 화면 ----------
function render() {
  if (!q) return
  const s = q.s
  const label = q.mode === 'new' ? '<span class="tag">새 문장</span>'
    : q.mode === 'review' ? '복습' : '연습 (오늘 할 것 끝)'
  const scene = q.mode === 'new' || done ? `${s.icon} ${esc(s.scene)} · ${whoText(s.who)}` : '🎧 소리만 듣고 뜻을 골라 보세요'
  const steps = hintSteps(s)
  const opened = steps.slice(0, hintLevel)
  const moreHints = !done && hintLevel < steps.length
  const verdict = done === 'gaveup' ? ['ng', '정답은 이거예요']
    : first ? ['ok', '정답! 🎉'] : ['ok', `맞혔어요 (${q.wrongs.size + 1}번째에) · 다음에 다시 나와요`]

  card.innerHTML = `
    <div class="top">
      <span>👂 ${label}</span>
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
    ${!done && opened.includes('pron') ? `<div class="hint"><span class="sub">발음</span> ${esc(s.pron)}</div>` : ''}
    ${!done && opened.includes('word') ? `<div class="hint"><span class="sub">첫 단어</span> ${esc(s.words[0][1])} = ${esc(s.words[0][2])}</div>` : ''}
    ${!done && q.wrongs.size ? '<div class="hint ngtext">✗ 아니에요. 다시 듣고 골라 보세요</div>' : ''}
    <div class="options">
      ${q.options.map((o, i) => {
        let cls = 'opt'
        if (done && o === s.ko) cls += ' correct'
        else if (q.wrongs.has(o)) cls += ' wrong'
        else if (q.removed.has(o)) cls += ' gone'
        const off = !!done || q.removed.has(o) || q.wrongs.has(o)
        return `<button class="${cls}" data-opt="${i}" ${off ? 'disabled' : ''}><span class="k">${i + 1}</span>${esc(o)}</button>`
      }).join('')}
    </div>
    ${done ? `
      <div class="result">
        <div class="verdict ${verdict[0]}">${verdict[1]}</div>
        <div class="pron">${esc(s.pron)}</div>
        <div class="ja">${esc(s.ja)} — ${esc(s.ko)}</div>
        ${s.words.length ? `<ul class="words">${s.words.map(([, p, k]) => `<li>${esc(p)} — ${esc(k)}</li>`).join('')}</ul>` : ''}
        <div class="row">
          <button class="small play" data-act="next">다음 문제 <kbd>Space</kbd></button>
          <button class="small" data-act="close">닫기 <kbd>Esc</kbd></button>
        </div>
      </div>` : `
      <div class="row" style="justify-content: space-between; align-items: center">
        <span class="keys">1~4 고르기 · Esc 닫기</span>
        <button class="small" data-act="giveup">포기 (정답 보기) <kbd>0</kbd></button>
      </div>`}
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
      <p><b>${key ? `<kbd>${esc(key)}</kbd>` : '오른쪽 아래 트레이 아이콘'}</b>을 누르면 일본어가 들리고 여기에 보기 4개가 떠요.</p>
      <p>트레이 아이콘을 눌러도 되고, 오른쪽 클릭하면 'Windows 시작할 때 자동 실행'을 켤 수 있어요.</p>
      <p>기록은 이 PC에만 쌓여요(휴대폰과 따로).</p>
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
})

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase()
  if (k === 'escape') return desk.hide()
  if (!q) {
    if (k === ' ' || k === 'enter') next()
    return
  }
  if (!done && ['1', '2', '3', '4'].includes(k)) return choose(q.options[Number(k) - 1])
  if (!done && k === '0') return giveUp()
  if (k === 'r') return play()
  if (k === 's') return play(true)
  if (k === 'h') return nextHint()
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

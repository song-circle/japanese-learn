// 오른쪽 아래 작은 창: 소리 듣고 맞히기
//   문제 순서는 휴대폰 듣고 맞히기와 같다(복습할 것 먼저, 그다음 오늘의 새 문장).
//   오늘 할 것(복습 + 새 문장 20개)을 다 했으면 배운 문장에서 골라 연습한다(복습 일정은 바꾸지 않음).
//   연습은 최근 10개를 빼고, 덜 나온 것·단계가 낮은 것부터. '새 문장 10개 더'로 범위를 넓힐 수 있다.
//
//   보기는 기본으로 숨긴다(보기가 있으면 알아보기만 해도 맞혀서 쉽다). 💡 힌트 단계 중 하나로 '보기 보기'.
//     새 문장(처음)   : 뜻 고르기(보기 5개) — 처음 듣는 문장은 기준이 필요해서
//     복습 Lv0·Lv1    : 뜻을 한국어로 적고 Enter → 정답과 비교해 보고 스스로 채점(안 적고 Enter도 됨)
//     복습 Lv2        : 빈칸 듣기 — 한글 발음 문장의 빈칸 단어를 한글로 입력
//     복습 Lv3        : 실전 소리 — 빈칸 듣기를 1.25배 속도 + 가게 소음으로
//   단계는 힌트 없이 첫 답을 맞히면 오르고 틀리면 내려간다(힌트 쓰고 맞히면 그대로).
//   실전 표현: 복습·연습 문제에서 가끔 같은 뜻 다른 표현이나 다른 목소리로 들려준다(휴대폰과 같은 코드).
//   장면 설명(어디서·누가)은 답을 낸 뒤에만 보여 준다.
//   틀리면 정답을 알려 주지 않고 다시 들려준 뒤 다시 하게 한다. 채점은 첫 번째 답으로.
//
//   섞는 문제(extras.js): 한글 받아쓰기 · 소리 없이 말하기 · 대화 이어 듣기 · 숫자 듣기 · 패턴 빈칸
//   오늘 할 복습·새 문장이 남았으면 35%, 다 했으면 60% 확률로 이 중 하나가 나온다
//
//   키보드: (입력칸) Enter 확인 · F2 포기  /  (그 밖) 1~5 고르기 · R 다시 듣기 · S 느리게 · H 힌트
//           0 포기 · N 새 문장 더 · Space/Enter 다음 · Esc 닫기
//
//   오디오 수업(lesson.js): 트레이 메뉴 '🎧 오디오 수업'. 화면을 안 봐도 되는 5·10·15분 듣기·말하기 수업.
//   창을 닫아도 소리는 계속. Space 일시정지 · → 다음 문장 · T 자막 · X 끝내기

import './style.css'
import { allSentences } from '../../src/data/sentences.js'
import { makeSrs, today } from '../../src/utils/listenSrs.js'
import { optionsFor, shuffle, OPTION_COUNT } from '../../src/utils/distractors.js'
import { clozeFor } from '../../src/utils/cloze.js'
import { LEVELS, makeLevels } from '../../src/utils/levels.js'
import { playReal, stopNoise } from '../../src/utils/realSound.js'
import { pickSound, voiceName } from '../../src/utils/realVariant.js'
import { compareHangul, TYPE_PASS } from '../../src/utils/hangulCompare.js'
import { makeExtra, checkNumber } from './extras.js'
import { buildLesson, buildEndlessBatch, createPlayer } from './lesson.js'
import { patternSentences } from '../../src/data/patterns.js'

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
// q (문제 하나):
//   kind     'listen' | 'dictation' | 'typeSpeak' | 'dialogue' | 'number' | 'pattern'
//   input    'choose'(보기에서 고르기) | 'meaning'(뜻 적고 스스로 채점) | 'type'(한글 입력 채점) | 'number'
//   grading  'srs'(듣고 맞히기 복습·단계) | 'bonus'(점수만)
//   s, clips(이어 들을 음성), sound(실전 표현), real(실전 소리), options/answer(보기), target(입력 정답), masked(빈칸 문장)
//   hints    힌트 순서: pron · word · first · meaning · options · fifty
let q = null
let first = null     // 첫 번째 답이 맞았는지(채점 기준). 아직이면 null
let done = null      // 정답을 보여 주는 중이면 'right' | 'gaveup'
let revealed = false // 뜻 적기 문제에서 정답을 열었는지
let hintLevel = 0
let showOptions = false
let wrongs = new Set()  // 틀린 보기
let removed = new Set() // 힌트로 지운 보기
let typed = null        // 마지막 입력 채점 { value, score, diff, correct }
let meaning = null      // 뜻 적기에서 적은 것 { value, score }
let audio = null
let seqTimer = null
let recent = []      // 방금 본 문장 10개는 바로 다시 내지 않는다
const retryIds = new Set()   // 오늘 틀린 문장: 한 번 더 나오고 그 결과는 다음 복습만 내일로(휴대폰과 같음)
const shownCount = new Map() // 이번에 켠 뒤 문장별로 몇 번 나왔는지
let session = { right: 0, total: 0, points: 0 }
let hideTimer = null
let levelChange = 0  // 이번 문제로 단계가 오르면 1, 내려가면 -1
let lesson = null    // 오디오 수업 중이면 { player, items, st, subs, minutes }

// ---------- 소리 ----------
// 여러 마디(대화)를 이어서 재생. 느린 파일이 없으면 재생 속도로 느리게
function playSeq(ids, slow, hasSlow) {
  clearTimeout(seqTimer)
  audio?.pause()
  const go = (i) => {
    if (i >= ids.length) return
    audio = new Audio(audioUrl(ids[i], slow && hasSlow))
    if (slow && !hasSlow) audio.playbackRate = 0.75
    audio.onended = () => { seqTimer = setTimeout(() => go(i + 1), 450) }
    audio.play().catch(() => {})
  }
  go(0)
}

function play(slow = false) {
  if (!q) return
  clearTimeout(seqTimer)
  audio?.pause()
  stopNoise()
  if (q.kind !== 'listen') {
    // 소리 없이 말하기는 답을 적기 전에는 들려주지 않는다
    if (q.silentFirst && !done) return
    return playSeq(q.clips, slow, ['dictation', 'typeSpeak', 'pattern'].includes(q.kind))
  }
  // 실전 표현(다른 표현·다른 목소리)은 느린 파일이 없어서 재생 속도로 느리게
  audio = new Audio(q.sound ? audioUrl(q.sound.id) : audioUrl(q.s.id, slow))
  if (q.sound && slow) audio.playbackRate = 0.7
  if (q.real && !slow && !done) playReal(audio)
  else audio.play().catch(() => {})
}

function reportStatus() {
  const p = srs().todayPlan(allSentences)
  const left = p.reviews.length + p.news.length
  desk.status(left ? `오늘 남은 것: 복습 ${p.reviews.length} · 새 문장 ${p.news.length}` : '오늘 할 것 끝! (지금은 연습 문제)')
}

// ---------- 문제 고르기 ----------
function pickListen() {
  const p = srs().todayPlan(allSentences)
  const notRecent = (x) => !recent.includes(x.id)
  let s = p.reviews.find(notRecent) ?? p.news.find(notRecent)
  let mode = s && p.reviews.includes(s) ? 'review' : 'new'
  if (!s) {
    // 오늘 할 것 끝: 배운 문장 중 덜 나온 것 → 단계가 낮은 것 순서로(같으면 무작위)
    const learned = srs().load().cards
    const lv = loadLevels()
    const pool = allSentences.filter((x) => learned[x.id] && notRecent(x))
    const ranked = shuffle(pool.length ? pool : allSentences.filter(notRecent))
      .sort((a, b) => (shownCount.get(a.id) ?? 0) - (shownCount.get(b.id) ?? 0) || (lv[a.id] ?? 0) - (lv[b.id] ?? 0))
    s = ranked[0]
    mode = 'practice'
  }
  recent = [s.id, ...recent].slice(0, 10)
  shownCount.set(s.id, (shownCount.get(s.id) ?? 0) + 1)

  const level = mode === 'new' ? 0 : levelOf(s.id)
  const base = { kind: 'listen', grading: 'srs', s, mode, level }
  // 새 문장: 뜻 고르기(보기 보임)
  if (mode === 'new') {
    return { ...base, input: 'choose', real: false, sound: null, options: optionsFor(s, allSentences), answer: s.ko, hints: ['pron', 'word', 'fifty'] }
  }
  // Lv2 이상: 빈칸 단어를 한글로 입력(빈칸을 못 만드는 문장은 뜻 적기로)
  const cloze = level >= 2 ? clozeFor(s, allSentences, OPTION_COUNT) : null
  if (cloze) {
    return { ...base, input: 'type', real: level >= 3, sound: pickSound(s, { level, type: 'cloze', mode: 'review' }),
      cloze, masked: cloze.masked, target: cloze.answer, options: cloze.options, answer: cloze.answer, hints: ['meaning', 'options', 'fifty'] }
  }
  // Lv0·Lv1: 뜻을 적고 스스로 채점
  return { ...base, input: 'meaning', real: false, sound: pickSound(s, { level, type: 'recall', mode: 'review' }),
    options: optionsFor(s, allSentences), answer: s.ko, hints: ['pron', 'word', 'options'] }
}

function next() {
  clearTimeout(hideTimer)
  const p = srs().todayPlan(allSentences)
  const rate = p.reviews.length + p.news.length ? 0.35 : 0.6
  q = Math.random() < rate ? makeExtra(srs().load().cards) : pickListen()
  first = null
  done = null
  revealed = false
  hintLevel = 0
  showOptions = q.input === 'choose'
  wrongs = new Set()
  removed = new Set()
  typed = null
  meaning = null
  levelChange = 0
  render()
  play()
}

// ---------- 채점 ----------
// 첫 번째 답으로 채점. 듣고 맞히기: 맞으면 (3 + 단계)점에서 힌트 수만큼 빼고, 단계 오르내림
function gradeFirst(correct) {
  first = correct
  if (q.grading === 'bonus') {
    const points = correct ? Math.max(1, q.points - hintLevel) : 0
    if (points) srs().addBonus(points)
    session.total += 1
    session.right += correct ? 1 : 0
    session.points += points
    return
  }
  const points = correct ? Math.max(1, 3 + q.level - hintLevel) : 0
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

function finishRight() {
  done = 'right'
  stopNoise()
  // 한 번에 맞혔으면 잠시 뒤 저절로 닫힌다(창 위에 마우스가 있으면 그대로)
  if (first) hideTimer = setTimeout(() => { if (!card.matches(':hover')) desk.hide() }, 7000)
}

// 보기 고르기(뜻 고르기, 또는 힌트로 연 보기)
function choose(opt) {
  if (!q || done || !showOptions || removed.has(opt) || wrongs.has(opt)) return
  const correct = opt === q.answer
  if (first === null) gradeFirst(correct)
  if (correct) {
    finishRight()
    if (q.input !== 'choose') play()
  } else {
    // 틀려도 정답은 알려 주지 않는다. 그 보기만 막고 한 번 더 들려준다
    wrongs.add(opt)
    setTimeout(() => play(), 350)
  }
  render()
}

// 입력칸 Enter
function submit() {
  if (!q || done) return
  const value = card.querySelector('#ans')?.value ?? ''
  if (q.input === 'meaning') {
    if (revealed) return
    // 적은 뜻과 정답이 얼마나 비슷한지(참고용). 채점은 정답을 보고 스스로
    meaning = value.trim() ? { value, score: compareHangul(q.answer, value).score } : null
    revealed = true
    render()
    return
  }
  if (!value.trim()) return
  if (q.input === 'number') {
    const correct = checkNumber(q.n, value)
    if (first === null) gradeFirst(correct)
    typed = { value, correct }
    if (correct) finishRight()
    else done = 'gaveup' // 숫자는 한 번에(다시 들으면 같은 숫자라 맞히기 쉬움)
    render()
    play()
    return
  }
  // 한글 입력: 85% 이상 비슷하면 맞음. 틀리면 다시 듣고 다시 입력
  const r = compareHangul(q.target, value)
  const correct = r.score >= TYPE_PASS
  if (first === null) gradeFirst(correct)
  typed = { value, ...r, correct }
  if (correct) {
    finishRight()
    play()
  } else if (q.silentFirst) {
    // 소리 없이 말하기는 한 번에(정답 소리를 듣고 나면 그대로 적을 수 있으니)
    done = 'gaveup'
    play()
  } else {
    wrongs.add(value)
    setTimeout(() => play(), 350)
  }
  render()
}

// 뜻 적기: 정답을 본 뒤 스스로 채점
function selfGrade(correct) {
  if (!q || q.input !== 'meaning' || done || !revealed) return
  gradeFirst(correct)
  done = correct ? 'right' : 'gaveup'
  if (correct) finishRight()
  render()
  play()
}

function giveUp() {
  if (!q || done) return
  if (first === null) gradeFirst(false)
  done = 'gaveup'
  stopNoise()
  render()
  play()
}

// 힌트 하나 더 열기 (💡 버튼, H 키). '보기 보기' 전에는 '보기 둘 지우기'를 건너뛴다
function nextHint() {
  if (!q || done || revealed) return
  const steps = q.hints
  if (hintLevel >= steps.length) return
  const kind = steps[hintLevel]
  hintLevel += 1
  if (kind === 'options') showOptions = true
  if (kind === 'fifty') {
    showOptions = true
    const left = q.options.filter((o) => o !== q.answer && !wrongs.has(o))
    shuffle(left).slice(0, 2).forEach((o) => removed.add(o))
  }
  render()
}

function moreNew() {
  addExtra(10)
  reportStatus()
  next()
}

// ---------- 오디오 수업 ----------
function startLesson(minutes) {
  lesson?.player.stop()
  clearTimeout(seqTimer)
  clearTimeout(hideTimer)
  audio?.pause()
  stopNoise()
  // minutes가 0이면 ∞ 끝까지(끌 때까지 40문장씩 이어 붙임)
  const endless = !minutes
  const seen = new Map()
  const batch = () => buildEndlessBatch({ learned: srs().load().cards, levels: loadLevels(), allSentences, patternSentences, seen })
  const items = endless ? batch() : buildLesson({
    minutes,
    plan: srs().todayPlan(allSentences),
    learned: srs().load().cards,
    levels: loadLevels(),
    allSentences,
    patternSentences,
  })
  lesson = { items, minutes, endless, subs: false, st: null, startedAt: Date.now() }
  lesson.player = createPlayer(items, (st) => {
    if (!lesson) return
    lesson.st = st
    if (st.done) finishLesson()
    renderLesson()
  }, endless ? batch : null)
  lesson.player.start()
}

function finishLesson() {
  lesson.player.endClip()
  srs().addBonus(lesson.items.length)
  try {
    const log = JSON.parse(localStorage.getItem('desk-lessons') || '[]')
    log.push({ date: today(), minutes: lesson.minutes, items: lesson.items.length })
    localStorage.setItem('desk-lessons', JSON.stringify(log.slice(-100)))
  } catch { /* 기록 실패는 무시 */ }
  desk.status(`🎧 오늘 오디오 수업 ${lesson.minutes}분 끝`)
}

function stopLesson() {
  // ∞ 끝까지는 끝내기를 눌렀을 때 들은 만큼 점수·기록
  if (lesson?.endless && lesson.st && !lesson.st.done) {
    const heard = lesson.st.index
    if (heard) srs().addBonus(heard)
    try {
      const log = JSON.parse(localStorage.getItem('desk-lessons') || '[]')
      log.push({ date: today(), minutes: Math.round((Date.now() - lesson.startedAt) / 60000), items: heard, endless: true })
      localStorage.setItem('desk-lessons', JSON.stringify(log.slice(-100)))
    } catch { /* 기록 실패는 무시 */ }
  }
  lesson?.player.stop()
  lesson = null
  q = null
  next()
}

const PHASE_TEXT = {
  prompt: (it) => (it.role === 'speak' ? '🇰🇷 한국어를 들어 보세요' : '🇯🇵 일본어를 들어 보세요'),
  think: (it) => (it.role === 'speak' ? '🗣️ 일본어로 말해 보세요 (속으로라도)' : '🧠 무슨 뜻일까요?'),
  answer: () => '✅ 정답',
  repeat: () => '🔁 따라 해 보세요',
}

function renderLesson() {
  const st = lesson.st
  const total = lesson.items.length
  if (st?.done) {
    card.innerHTML = `
      <div class="top"><span>🎧 오디오 수업 ${lesson.minutes}분</span><span class="grow"></span><button class="x" data-act="close">✕</button></div>
      <div class="verdict ok" style="margin-top:8px">수업 끝! 🎉 ${total}문장 · +${total}점</div>
      <ul class="words lesson-list">${lesson.items.map(({ s }) => `<li><b>${esc(s.pron)}</b> — ${esc(s.ko)}</li>`).join('')}</ul>
      <div class="row">
        <button class="small play" data-act="lesson-end">문제 풀기로 돌아가기</button>
        <button class="small" data-act="close">닫기 <kbd>Esc</kbd></button>
      </div>`
    fit()
    return
  }
  const i = st?.index ?? 0
  const it = st?.item ?? lesson.items[0]
  const showAnswer = st && (st.phase === 'answer' || st.phase === 'repeat')
  card.innerHTML = `
    <div class="top">
      <span>🎧 오디오 수업 ${lesson.endless ? '∞' : `${lesson.minutes}분`} · ${it.role === 'speak' ? '말하기' : '듣기'}${it.sound ? ' · 🎭' : ''}</span>
      <span class="grow"></span>
      <span>${lesson.endless ? `${i + 1}문장째 · ${Math.round((Date.now() - lesson.startedAt) / 60000)}분` : `${i + 1} / ${total}`}</span>
      <button class="x" data-act="close" title="창만 닫기 (소리는 계속)">✕</button>
    </div>
    ${lesson.endless ? '' : `<div class="lesson-bar"><div style="width:${(i / total) * 100}%"></div></div>`}
    <div class="lesson-phase">${st?.paused ? '⏸ 일시정지' : PHASE_TEXT[st?.phase ?? 'prompt'](it)}</div>
    ${lesson.subs ? `<div class="hint">${esc(it.s.ko)}${showAnswer ? `<br><b>${esc(it.sound?.pron ?? it.s.pron)}</b>${it.sound?.kind === 'text' ? ` <span class="sub">(기본: ${esc(it.s.pron)})</span>` : ''}` : ''}</div>` : ''}
    <div class="row">
      <button class="small play" data-act="lesson-toggle">${st?.paused ? '▶ 계속' : '⏸ 일시정지'} <kbd>Space</kbd></button>
      <button class="small" data-act="lesson-skip">⏭ 다음 <kbd>→</kbd></button>
      <button class="small" data-act="lesson-subs">자막 ${lesson.subs ? '끄기' : '켜기'} <kbd>T</kbd></button>
      <button class="small" data-act="lesson-stop">■ 끝내기 <kbd>X</kbd></button>
    </div>
    <div class="keys">🔔 딩동 + "말해 보세요" → 한국어를 듣고 일본어로 말하기 (똑똑 소리 동안) · 🔕 종소리 + "들어 보세요" → 일본어 듣고 뜻 떠올리기</div>
    <div class="keys">창을 닫아도(✕·Esc) 수업 소리는 계속 나와요. 이어폰을 끼고 다른 일을 해도 돼요.</div>`
  fit()
}

// ---------- 화면 ----------
const HINT_NAME = { pron: '발음', word: '첫 단어', first: '첫 단어', meaning: '뜻', options: '보기 보기', fifty: '보기 둘 지우기' }

function topLabel() {
  if (q.kind !== 'listen') return q.label
  const mode = q.mode === 'new' ? '<span class="tag">새 문장</span>' : q.mode === 'review' ? '복습' : '연습'
  const lvName = q.input === 'meaning' ? '뜻 적기' : q.input === 'type' ? LEVELS[q.real ? 3 : 2] : LEVELS[0]
  const lvNum = q.mode === 'new' ? 0 : q.level
  const variant = q.sound ? ` <span class="lv variant">🎭 ${q.sound.kind === 'text' ? '다른 표현' : '다른 목소리'}</span>` : ''
  return `👂 ${mode} <span class="lv lv${lvNum}">Lv${lvNum} ${lvName}</span>${variant}`
}

function askText() {
  if (q.kind !== 'listen') return esc(q.ask)
  if (q.input === 'choose') return '🎧 소리만 듣고 뜻을 골라 보세요'
  if (q.input === 'meaning') return '🧠 소리만 듣고 뜻을 한국어로 적어 보세요 (모르면 그냥 Enter)'
  return q.real ? '🔊 빠르고 시끄러워요. 빈칸에 들린 말을 한글로 적어 보세요' : '✏️ 빈칸에 들린 말을 한글로 적어 보세요'
}

function answerHtml() {
  const s = q.s
  if (q.kind === 'number') return `<div class="pron">${esc(q.n.show)}</div><div class="ja">${esc(q.n.pron)} — ${esc(q.n.ko)}</div>`
  if (q.kind === 'dialogue') return q.turns.map((t) => `<div class="ja"><b>${esc(t.who)}</b> ${esc(t.pron)} — ${esc(t.ko)}</div>`).join('')
  const lvMsg = levelChange > 0 ? `<div class="ja">⬆ Lv${levelOf(s.id)} ${LEVELS[levelOf(s.id)]}로 올라갔어요</div>` : levelChange < 0 ? `<div class="ja">⬇ Lv${levelOf(s.id)}로 내려갔어요</div>` : ''
  return `
    <div class="pron">${esc(s.pron)}</div>
    <div class="ja">${esc(s.ja)} — ${esc(s.ko)}</div>
    ${q.cloze ? `<div class="ja">빈칸: <b>${esc(q.cloze.answer)}</b> = ${esc(q.cloze.answerKo)}</div>` : ''}
    ${q.kind === 'pattern' ? `<div class="ja">바뀐 단어: <b>${esc(s.word.pron)}</b> = ${esc(s.word.ko)}</div>` : ''}
    ${q.kind === 'listen' ? `<div class="ja">${s.icon} ${esc(s.scene)} · ${whoText(s.who)}</div>` : ''}
    ${q.sound?.kind === 'text' ? `<div class="variant-box">🎭 들은 말: <b>${esc(q.sound.pron)}</b> (${esc(q.sound.ja)})<br><span class="sub">같은 뜻의 다른 표현이에요. 위가 기본 표현이에요.</span></div>` : ''}
    ${q.sound?.kind === 'voice' ? `<div class="ja">🎭 다른 목소리(${esc(voiceName(q.sound.voice))})로 들었어요</div>` : ''}
    ${lvMsg}
    ${q.kind === 'listen' && s.words.length ? `<ul class="words">${s.words.map(([, p, k]) => `<li>${esc(p)} — ${esc(k)}</li>`).join('')}</ul>` : ''}`
}

function render() {
  if (lesson) return renderLesson()
  if (!q) return
  const s = q.s
  const opened = q.hints.slice(0, hintLevel)
  const moreHints = !done && !revealed && hintLevel < q.hints.length
  const nextHintName = moreHints ? HINT_NAME[q.hints[hintLevel]] : ''
  const showInput = !done && (q.input === 'type' || q.input === 'number' || (q.input === 'meaning' && !revealed))
  const firstWord = q.target ? q.target.split(' ')[0] : s?.words?.[0]?.[1] ?? ''
  const late = q.input === 'type' ? wrongs.size : wrongs.size
  const verdict = done === 'right'
    ? ['ok', first ? '정답! 🎉' : `맞혔어요 (${late + 1}번째에)`]
    : ['ng', q.input === 'meaning' ? '다음에 다시 나와요' : '아쉬워요. 정답은 이거예요']
  const diffHtml = typed?.diff ? `<div class="diff">${typed.diff.map((d) => (d.space ? esc(d.ch) : `<span class="${d.ok ? 'd-ok' : 'd-ng'}">${esc(d.ch)}</span>`)).join('')}</div>` : ''

  const optionsHtml = showOptions && !done && q.options ? `
    <div class="options">
      ${q.options.map((o, i) => {
        let cls = 'opt'
        if (wrongs.has(o)) cls += ' wrong'
        else if (removed.has(o)) cls += ' gone'
        const off = wrongs.has(o) || removed.has(o)
        return `<button class="${cls}" data-opt="${i}" ${off ? 'disabled' : ''}><span class="k">${i + 1}</span>${esc(o)}</button>`
      }).join('')}
    </div>` : ''

  const placeholder = q.input === 'number' ? '숫자' : q.input === 'meaning' ? '뜻을 한국어로 (모르면 그냥 Enter)' : '한글로 입력 후 Enter'

  card.innerHTML = `
    <div class="top">
      <span>${topLabel()}</span>
      <span class="grow"></span>
      <span>${session.right}/${session.total} · ${session.points}점</span>
      <button class="x" data-act="close" title="닫기 (Esc)">✕</button>
    </div>
    <div class="scene">${askText()}</div>
    <div class="row">
      ${q.silentFirst && !done ? '' : `<button class="small play" data-act="play">🔊 ${q.kind === 'dialogue' ? '대화 다시 듣기' : '다시 듣기'} <kbd>R</kbd></button>
      <button class="small" data-act="slow">🐢 느리게 <kbd>S</kbd></button>`}
      ${moreHints ? `<button class="small" data-act="hint">💡 ${nextHintName}${first === null ? ' -1점' : ''} <kbd>H</kbd></button>` : ''}
    </div>
    ${q.masked && !done ? `<div class="cloze">${esc(q.masked).replace('____', '<span class="blank">____</span>')}</div>` : ''}
    ${!done && opened.includes('pron') ? `<div class="hint"><span class="sub">발음</span> ${esc(s.pron)}</div>` : ''}
    ${!done && (opened.includes('word') || opened.includes('first')) ? `<div class="hint"><span class="sub">첫 단어</span> ${esc(firstWord)}${opened.includes('word') && s.words[0] ? ` = ${esc(s.words[0][2])}` : ' …'}</div>` : ''}
    ${!done && opened.includes('meaning') ? `<div class="hint"><span class="sub">뜻</span> ${esc(s.ko)}</div>` : ''}
    ${!done && (wrongs.size || (typed && !typed.correct)) ? `<div class="hint ngtext">✗ 아니에요${typed?.score != null && !typed.correct ? ` (${Math.round(typed.score * 100)}%)` : ''}. 다시 듣고 해 보세요</div>` : ''}
    ${showInput ? `
      <div class="row type-row">
        <input id="ans" class="type-in" autocomplete="off" spellcheck="false" placeholder="${placeholder}">
        <button class="small play" data-act="submit">${q.input === 'meaning' ? '정답 보기' : '확인'} <kbd>Enter</kbd></button>
      </div>` : ''}
    ${optionsHtml}
    ${q.input === 'meaning' && revealed && !done ? `
      <div class="result">
        ${meaning ? `<div class="ja">내가 적은 뜻: ${esc(meaning.value)} <span class="sub">(정답과 ${Math.round(meaning.score * 100)}% 비슷)</span></div>` : ''}
        <div class="pron">${esc(s.ko)}</div>
        <div class="ja">${esc(s.pron)}</div>
        <div class="row">
          <button class="small ${!meaning || meaning.score >= 0.6 ? 'play' : ''}" data-act="self-right">알았어요 <kbd>1</kbd></button>
          <button class="small ${meaning && meaning.score < 0.6 ? 'play' : ''}" data-act="self-wrong">몰랐어요 <kbd>2</kbd></button>
        </div>
      </div>` : ''}
    ${done ? `
      <div class="result">
        <div class="verdict ${verdict[0]}">${verdict[1]}${typed?.score != null ? ` · ${Math.round(typed.score * 100)}%` : ''}</div>
        ${diffHtml}
        ${typed ? `<div class="ja">내가 쓴 것: ${esc(typed.value)}</div>` : ''}
        ${meaning ? `<div class="ja">내가 적은 뜻: ${esc(meaning.value)}</div>` : ''}
        ${answerHtml()}
        <div class="row">
          <button class="small play" data-act="next">다음 문제 <kbd>Space</kbd></button>
          <button class="small" data-act="close">닫기 <kbd>Esc</kbd></button>
        </div>
      </div>` : q.input === 'meaning' && revealed ? '' : `
      <div class="row" style="justify-content: space-between; align-items: center">
        <span class="keys">${showInput ? 'Enter 확인 · F2 포기' : `1~${q.options?.length ?? 5} 고르기 · 0 포기`} · Esc 닫기</span>
        ${q.input === 'meaning' ? '' : `<button class="small" data-act="giveup">포기 (정답 보기) <kbd>${showInput ? 'F2' : '0'}</kbd></button>`}
      </div>`}
    ${q.mode === 'practice' ? `
      <div class="row more">
        <span class="keys">오늘 할 것은 끝. 배운 문장으로 연습 중</span>
        <button class="small" data-act="more">➕ 새 문장 10개 더 <kbd>N</kbd></button>
      </div>` : ''}
  `
  fit()
  if (showInput) setTimeout(() => card.querySelector('#ans')?.focus(), 30)
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
      <p>보기는 숨어 있어요. 뜻을 직접 적거나 들린 말을 한글로 적고, 막히면 💡 힌트로 보기를 열 수 있어요.</p>
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
  else if (act === 'submit') submit()
  else if (act === 'self-right') selfGrade(true)
  else if (act === 'self-wrong') selfGrade(false)
  else if (act === 'more') moreNew()
  else if (act === 'lesson-toggle') lesson?.player.toggle()
  else if (act === 'lesson-skip') lesson?.player.skip()
  else if (act === 'lesson-subs') { lesson.subs = !lesson.subs; renderLesson() }
  else if (act === 'lesson-stop' || act === 'lesson-end') stopLesson()
})

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase()
  if (k === 'escape') return desk.hide()
  // 입력칸에 쓰는 중에는 단축키를 쓰지 않는다(Enter 확인, F2 포기, 힌트는 F1)
  if (e.target.tagName === 'INPUT') {
    if (k === 'enter' && !e.isComposing) { e.preventDefault(); submit() }
    else if (k === 'f2') giveUp()
    else if (k === 'f1') { e.preventDefault(); nextHint() }
    return
  }
  if (lesson) {
    if (lesson.st?.done) {
      if (k === ' ' || k === 'enter') stopLesson()
      return
    }
    if (k === ' ') { e.preventDefault(); lesson.player.toggle() }
    else if (k === 'arrowright') lesson.player.skip()
    else if (k === 't') { lesson.subs = !lesson.subs; renderLesson() }
    else if (k === 'x') stopLesson()
    return
  }
  if (!q) {
    if (k === ' ' || k === 'enter') next()
    return
  }
  if (q.input === 'meaning' && revealed && !done) {
    if (k === '1') return selfGrade(true)
    if (k === '2') return selfGrade(false)
  }
  if (!done && showOptions && /^[1-9]$/.test(k) && Number(k) <= q.options.length) return choose(q.options[Number(k) - 1])
  if (!done && (k === '0' || k === 'f2')) return giveUp()
  if (k === 'r') return play()
  if (k === 's') return play(true)
  if (k === 'h' || k === 'f1') { e.preventDefault(); return nextHint() }
  if (k === 'n' && q.mode === 'practice') return moreNew()
  if (done && (k === ' ' || k === 'enter')) {
    e.preventDefault()
    next()
  }
})

card.addEventListener('mouseenter', () => clearTimeout(hideTimer))

// 단축키·트레이: 풀기 전 문제가 있으면 다시 듣기, 아니면 새 문제
desk.onAsk(() => {
  // 오디오 수업 중이면 수업 화면만 다시 보여 준다
  if (lesson) return renderLesson()
  if (q && !done) play()
  else next()
})
desk.onLesson((minutes) => startLesson(minutes))
desk.onWelcome(welcome)
reportStatus()

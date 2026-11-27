// PC 토스트에 섞는 문제 (듣고 맞히기 단계 문제 말고). main.js의 문제 모양(input·hints 등)으로 만들어 준다.
//   dictation  한글 받아쓰기   : 들린 소리를 한글로 입력(자모 비교, 까/카는 같게, 장음 '-'는 소리로)
//   typeSpeak  소리 없이 말하기 : 한국어 뜻을 보고 일본어 발음을 한글로 입력('나'의 문장·패턴 문장)
//   dialogue   대화 이어 듣기   : 대화 2~3마디를 이어 듣고 마지막 말의 뜻을 적은 뒤 스스로 채점(보기는 힌트로만)
//   number     숫자 듣기       : 가격·시간·개수·인원을 듣고 숫자 입력(미리 만든 음성)
//   pattern    패턴 빈칸       : 패턴 문장에서 바뀐 단어를 한글로 입력(보기는 힌트로만)
//   점수는 듣고 맞히기 누적 점수에 더한다(복습 일정은 바꾸지 않음)

import { allSentences } from '../../src/data/sentences.js'
import { patterns, patternSentences } from '../../src/data/patterns.js'
import { dialogues, sentenceOf } from '../../src/data/dialogues.js'
import { numberBank } from '../../src/data/numberBank.js'
import { optionsFor, shuffle } from '../../src/utils/distractors.js'

const pick = (xs) => xs[Math.floor(Math.random() * xs.length)]

const WEIGHTS = [['dictation', 30], ['typeSpeak', 30], ['dialogue', 15], ['number', 15], ['pattern', 10]]
function pickKind() {
  let r = Math.random() * WEIGHTS.reduce((a, [, w]) => a + w, 0)
  for (const [k, w] of WEIGHTS) {
    if ((r -= w) < 0) return k
  }
  return 'dictation'
}

export const KIND_LABEL = {
  dictation: '✍️ 한글 받아쓰기',
  typeSpeak: '⌨️ 소리 없이 말하기',
  dialogue: '💬 대화 이어 듣기',
  number: '💴 숫자 듣기',
  pattern: '🧩 패턴 빈칸',
}

// learned: 듣고 맞히기에서 배운 문장(받아쓰기·말하기는 들어 본 문장 위주로)
export function makeExtra(learned) {
  const kind = pickKind()
  const known = allSentences.filter((s) => learned[s.id])
  const pool = known.length >= 5 ? known : allSentences.slice(0, 20)
  const base = { kind, label: KIND_LABEL[kind], grading: 'bonus' }

  if (kind === 'dictation') {
    const s = pick(pool)
    return { ...base, s, clips: [s.id], input: 'type', target: s.pron, hints: ['first'], points: 3,
      ask: '들린 소리를 한글로 그대로 적어 보세요 (길게 끄는 소리는 -)' }
  }
  if (kind === 'typeSpeak') {
    const mine = pool.filter((s) => s.who === '나')
    const s = Math.random() < 0.5 || !mine.length ? pick(patternSentences) : pick(mine)
    return { ...base, s, clips: [s.id], input: 'type', target: s.pron, hints: ['first'], points: 3, silentFirst: true,
      ask: `“${s.ko}” — 일본어로 어떻게 말할까요? 한글 발음으로 적어 보세요` }
  }
  if (kind === 'dialogue') {
    const d = pick(dialogues)
    const idxs = d.turns.map((id, i) => (i >= 1 && sentenceOf(id).who !== '나' ? i : -1)).filter((i) => i >= 0)
    const k = idxs.length ? pick(idxs) : d.turns.length - 1
    const turns = d.turns.slice(Math.max(0, k - 2), k + 1).map(sentenceOf)
    const s = turns[turns.length - 1]
    return { ...base, s, turns, clips: turns.map((t) => t.id), input: 'meaning', hints: ['options'], points: 2,
      options: optionsFor(s, allSentences), answer: s.ko, ask: `${d.title} — 마지막 말은 무슨 뜻일까요?` }
  }
  if (kind === 'number') {
    const n = pick(numberBank)
    return { ...base, n, clips: [n.id], input: 'number', hints: [], points: 2,
      ask: n.kind === 'time' ? '들린 시간을 숫자로 (3시 15분 = 315)' : `들린 숫자를 입력하세요 (${n.kind === 'price' ? '엔' : n.kind === 'count' ? '개' : '명'})` }
  }
  // pattern
  const s = pick(patternSentences)
  const p = patterns.find((x) => x.id === s.pattern)
  const others = shuffle(patternSentences.filter((x) => x.pattern === s.pattern && x.id !== s.id)).slice(0, 4).map((x) => x.word.pron)
  return { ...base, s, clips: [s.id], input: 'type', target: s.word.pron, masked: s.pron.replace(s.word.pron, '____'),
    hints: ['meaning', 'options'], points: 3, options: shuffle([s.word.pron, ...others]), answer: s.word.pron,
    ask: `${p.pron} — 빈칸에 들린 단어를 한글로 적어 보세요` }
}

// 숫자 입력 채점
export function checkNumber(n, value) {
  const v = value.replace(/[^0-9]/g, '')
  const norm = n.kind === 'time' && v.length <= 2 ? `${Number(v)}00` : String(Number(v))
  return !!v && norm === n.answer
}

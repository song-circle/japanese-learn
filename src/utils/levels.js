// 듣고 맞히기 단계 (휴대폰 앱·PC 앱 공용). 문장마다 0~3, 저장은 기기마다 따로(localStorage)
//   0 뜻 고르기 · 1 뜻 떠올리기 · 2 빈칸 듣기 · 3 실전 소리(빈칸 듣기를 빠르게 + 소음)
//   힌트 없이 첫 답을 맞히면 +1, 틀리면 -1, 힌트 쓰고 맞히면 그대로

export const LEVELS = ['뜻 고르기', '뜻 떠올리기', '빈칸 듣기', '실전 소리']
export const MAX_LEVEL = LEVELS.length - 1

export function makeLevels(key) {
  const load = () => {
    try {
      return JSON.parse(localStorage.getItem(key) || '{}')
    } catch {
      return {}
    }
  }
  const levelOf = (id) => load()[id] ?? 0
  const setLevel = (id, lv) => {
    const all = load()
    all[id] = Math.max(0, Math.min(MAX_LEVEL, lv))
    localStorage.setItem(key, JSON.stringify(all))
  }
  // 첫 답 결과로 단계 바꾸기. 바뀐 방향(+1/0/-1)을 돌려준다
  const update = (id, correct, usedHint) => {
    const before = levelOf(id)
    if (correct && !usedHint) setLevel(id, before + 1)
    else if (!correct) setLevel(id, before - 1)
    return Math.sign(levelOf(id) - before)
  }
  return { load, levelOf, setLevel, update }
}

// 단계에 맞는 문제 형식. 빈칸을 못 만드는 문장은 떠올리기로
//   결과: { type: 'choose' | 'recall' | 'cloze', real }
export function questionType(level, hasCloze) {
  if (level >= 2 && hasCloze) return { type: 'cloze', real: level >= 3 }
  if (level >= 1) return { type: 'recall', real: false }
  return { type: 'choose', real: false }
}

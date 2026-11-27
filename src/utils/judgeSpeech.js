// 말하기 채점 (말해서 맞히기·패턴 말하기·대화 듣기 공용)
//   1) 알아들은 말이 모범 답과 80% 이상 같으면 맞음
//   2) 아니면 AI 키가 있을 때 AI에게 "뜻이 통하는지" 한 번 더 묻는다(표현이 달라도 통하면 맞음)
//   결과: { correct, by: 'match' | 'ai' | 'none', note_ko, better_ja, better_pron }

import { PASS } from './speechRec'
import { judgeMeaning } from './aiTalk'

export async function judgeSpeech(settings, sentence, heardText, score) {
  if (score >= PASS) return { correct: true, by: 'match' }
  if (!settings?.apiKey || !heardText) return { correct: false, by: 'none' }
  try {
    const r = await judgeMeaning(settings, { ko: sentence.ko, ja: sentence.ja, heard: heardText })
    return { correct: !!r.ok, by: 'ai', note_ko: r.note_ko, better_ja: r.better_ja, better_pron: r.better_pron }
  } catch {
    // AI를 못 부르면(인터넷·키 문제) 글자 비교 결과만으로
    return { correct: false, by: 'none' }
  }
}

// PC 오디오 수업용 한국어 음성 목록
//   ko-<문장 id>.mp3 : 문장 뜻(한국어). 괄호 설명은 쉼표로 읽게
//   lesson-*.mp3     : 수업 안내 말
//   (scripts/gen-audio.mjs가 Azure 한국어 목소리로 만든다)

import { allSentences } from './sentences.js'
import { patternSentences } from './patterns.js'

export const KO_VOICE = 'ko-KR-SunHiNeural'
// 안내 말은 뜻을 읽는 목소리(여자)와 구분되게 남자 목소리로
export const GUIDE_VOICE = 'ko-KR-InJoonNeural'

const speakable = (ko) => ko.replace(/\s*\(([^)]*)\)/g, ', $1').replace(/\s*\/\s*/g, ', ').replace(/~/g, '')

export const koClips = [...allSentences, ...patternSentences].map((s) => ({ id: `ko-${s.id}`, text: speakable(s.ko) }))

export const lessonClips = [
  { id: 'lesson-start', text: '오디오 수업을 시작할게요. 듣기 연습과 말하기 연습이 다섯 문장씩 번갈아 나와요.' },
  { id: 'lesson-ask-jp', text: '일본어로?' },
  { id: 'lesson-ask-meaning', text: '무슨 뜻일까요?' },
  { id: 'lesson-repeat', text: '따라 해 보세요.' },
  { id: 'lesson-again', text: '한 번 더.' },
  { id: 'lesson-end', text: '오늘 수업은 여기까지예요. 수고하셨어요.' },
]

// 매 문장 앞에 넣는 짧은 안내(남자 목소리): 지금 말할 차례인지, 들을 차례인지, 뜻이 나오는지
export const guideClips = [
  { id: 'guide-say', text: '말해 보세요.' },
  { id: 'guide-listen', text: '들어 보세요.' },
  { id: 'guide-meaning', text: '뜻은,' },
  // 한국어 뒤에 붙여 '이걸 말할 차례'라는 걸 말로 분명히
  { id: 'guide-say-jp', text: '일본어로 말해 보세요.' },
  { id: 'guide-answer', text: '정답.' },
  // 5문장 묶음이 바뀔 때
  { id: 'block-listen', text: '듣기 연습이에요. 일본어를 듣고 뜻을 떠올려 보세요.' },
  { id: 'block-speak', text: '말하기 연습이에요. 한국어를 듣고 일본어로 말해 보세요.' },
]

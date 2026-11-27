// PC 오디오 수업용 한국어 음성 목록
//   ko-<문장 id>.mp3 : 문장 뜻(한국어). 괄호 설명은 쉼표로 읽게
//   lesson-*.mp3     : 수업 안내 말
//   (scripts/gen-audio.mjs가 Azure 한국어 목소리로 만든다)

import { allSentences } from './sentences.js'
import { patternSentences } from './patterns.js'

export const KO_VOICE = 'ko-KR-SunHiNeural'

const speakable = (ko) => ko.replace(/\s*\(([^)]*)\)/g, ', $1').replace(/\s*\/\s*/g, ', ').replace(/~/g, '')

export const koClips = [...allSentences, ...patternSentences].map((s) => ({ id: `ko-${s.id}`, text: speakable(s.ko) }))

export const lessonClips = [
  { id: 'lesson-start', text: '오디오 수업을 시작할게요. 한국어를 들으면 일본어로 말해 보고, 일본어를 들으면 뜻을 떠올려 보세요.' },
  { id: 'lesson-ask-jp', text: '일본어로?' },
  { id: 'lesson-ask-meaning', text: '무슨 뜻일까요?' },
  { id: 'lesson-repeat', text: '따라 해 보세요.' },
  { id: 'lesson-again', text: '한 번 더.' },
  { id: 'lesson-end', text: '오늘 수업은 여기까지예요. 수고하셨어요.' },
]

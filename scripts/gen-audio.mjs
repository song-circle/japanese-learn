// 듣고 맞히기 문장의 원어민 음성(mp3)을 Azure Speech로 만든다. 없는 파일만 만든다.
//   AZURE_SPEECH_KEY, AZURE_SPEECH_REGION 환경 변수 필요 (Azure Speech 무료 F0로 충분)
//   node scripts/gen-audio.mjs          # 없는 것만
//   node scripts/gen-audio.mjs --force  # 전부 다시
// 결과: public/audio/<id>.mp3 (보통 속도), public/audio/<id>.slow.mp3 (느리게, 힌트용)
import fs from 'node:fs'
import path from 'node:path'
import { allSentences } from '../src/data/sentences.js'

const KEY = process.env.AZURE_SPEECH_KEY
const REGION = process.env.AZURE_SPEECH_REGION
if (!KEY || !REGION) {
  console.error('AZURE_SPEECH_KEY, AZURE_SPEECH_REGION 환경 변수를 설정하세요')
  process.exit(1)
}
const force = process.argv.includes('--force')
const outDir = path.resolve('public/audio')
fs.mkdirSync(outDir, { recursive: true })

// '나'(사용자가 하는 말)는 남성, 점원·상대는 여성 목소리
const voiceOf = (who) => (who === '나' ? 'ja-JP-KeitaNeural' : 'ja-JP-NanamiNeural')

const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// 무료 등급은 요청이 몰리면 429(Throttled)를 준다 → 기다렸다 다시
async function synth(text, voice, rate, file) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await synthOnce(text, voice, rate, file)
    } catch (e) {
      if (!String(e.message).includes('HTTP 429') || attempt >= 6) throw e
      const wait = 2000 * attempt
      console.log(`  throttled, retry in ${wait / 1000}s`)
      await sleep(wait)
    }
  }
}

async function synthOnce(text, voice, rate, file) {
  const ssml = `<speak version="1.0" xml:lang="ja-JP"><voice name="${voice}"><prosody rate="${rate}">${escape(text)}</prosody></voice></speak>`
  const res = await fetch(`https://${REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': KEY,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
      'User-Agent': 'japanese-learn-gen-audio',
    },
    body: ssml,
  })
  if (!res.ok) throw new Error(`${file}: HTTP ${res.status} ${await res.text()}`)
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()))
}

let made = 0
for (const s of allSentences) {
  for (const [suffix, rate] of [['', '0%'], ['.slow', '-30%']]) {
    const file = path.join(outDir, `${s.id}${suffix}.mp3`)
    if (!force && fs.existsSync(file)) continue
    await synth(s.tts ?? s.ja, voiceOf(s.who), rate, file)
    made++
    console.log('made', path.basename(file))
  }
}
console.log(`done: ${made} file(s) made, ${allSentences.length} sentences`)

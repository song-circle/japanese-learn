// 휴대폰 앱 빌드에서 PC 전용 음성(오디오 수업의 한국어 ko-*, 안내 lesson-*·guide-*, 숫자 듣기 num-*)을 뺀다.
// 휴대폰 자동 업데이트는 dist 전체를 zip으로 받으므로 쓰지 않는 파일까지 받지 않게.
import fs from 'node:fs'
import path from 'node:path'

const dir = path.resolve('dist/audio')
let removed = 0
for (const f of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
  if (/^(ko|lesson|guide|block|num)-/.test(f)) {
    fs.unlinkSync(path.join(dir, f))
    removed++
  }
}
console.log(`prune-dist: PC 전용 음성 ${removed}개 뺌`)

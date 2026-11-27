import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

// renderer를 desktop/build로 묶는다. 문장 데이터·복습 로직은 휴대폰 앱의 src를 그대로 쓰고,
// 원어민 음성은 휴대폰 앱의 public/audio를 함께 복사한다.
const here = (p) => fileURLToPath(new URL(p, import.meta.url))

export default defineConfig({
  root: here('./renderer'),
  base: './',
  publicDir: here('../public'),
  build: {
    outDir: here('./build'),
    emptyOutDir: true,
  },
})

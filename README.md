# 일본어 학습 앱 (japanese-learn)

히라가나·가타카나부터 JLPT N5 단어, 문법, 여행·식당 회화까지 한 앱에서 연습하는 일본어 학습 앱입니다.
React로 만든 웹앱을 Capacitor로 감싸 Android 앱(APK/AAB)으로도 빌드합니다.

## 기능

| 구분 | 내용 |
| --- | --- |
| **듣고 맞히기** | 실생활 문장(인사·편의점·식당·길 묻기)을 원어민 음성으로 먼저 듣고 뜻을 맞힌다. 새 문장은 상황만 보고, 복습은 소리만 듣고. 힌트(느리게·한글 발음·첫 단어 뜻), 점수, 복습 간격 자동(틀리면 오늘 다시, 맞히면 1→2→4→7→15→30일). 가나를 몰라도 되게 한글 발음과 뜻을 함께 보여 준다 |
| 문자 | 히라가나·가타카나 (탁음·반탁음·요음 포함) 학습, 쓰기 연습 |
| 단어·한자 | 기본 단어, JLPT N5 단어, 한자 |
| 문법·회화 | 문법 설명, 상황별 회화, 식당·여행 표현 (여행 표현 즐겨찾기) |
| 연습 | 퀴즈, 플래시카드, 짝 맞추기, 타임어택, 듣기 퀴즈 (브라우저 음성 합성으로 발음 재생) |
| 기록 | 하루 목표, 학습 통계 |

## 기술

- React 19 + Vite, PWA (`vite-plugin-pwa`)
- Capacitor 6 (Android)
- GitHub Actions: 푸시 시 APK 빌드(`build-apk.yml`), 수동 실행으로 Play Store용 서명 AAB 빌드(`build-release.yml`)

## 듣고 맞히기 음성

문장은 `src/data/sentences.js`, 음성은 `public/audio/<id>.mp3`(보통)·`<id>.slow.mp3`(느리게, 70%).
문장을 추가하면 Azure Speech(무료 등급으로 충분)로 없는 음성만 만든다:

```bash
AZURE_SPEECH_KEY=... AZURE_SPEECH_REGION=koreacentral node scripts/gen-audio.mjs
```

내가 하는 말은 남성(ja-JP-KeitaNeural), 점원·상대가 하는 말은 여성(ja-JP-NanamiNeural) 목소리.

## 실행

```bash
npm install
npm run dev        # 개발 서버
npm run build      # 웹 빌드 (dist/)
```

### Android

```bash
npm run build
npx cap sync android
npx cap open android   # Android Studio에서 실행·빌드
```

Play Store 배포 절차(서명 키, GitHub Secrets, AAB 빌드)는 [docs/PLAY_STORE_GUIDE.md](docs/PLAY_STORE_GUIDE.md)에 있습니다.
개인정보처리방침: [docs/privacy-policy.html](docs/privacy-policy.html)

## 폴더

```
src/components/   화면 (학습·퀴즈·단어·문법·회화·통계 등)
src/data/         문자·단어·JLPT·한자·문법·회화 데이터
android/          Capacitor Android 프로젝트
docs/             배포 가이드, 개인정보처리방침
```

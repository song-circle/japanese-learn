# 일본어 학습 앱 (japanese-learn)

히라가나·가타카나부터 JLPT N5 단어, 문법, 여행·식당 회화까지 한 앱에서 연습하는 일본어 학습 앱입니다.
React로 만든 웹앱을 Capacitor로 감싸 Android 앱(APK/AAB)으로도 빌드합니다.

## 기능

| 구분 | 내용 |
| --- | --- |
| 문자 | 히라가나·가타카나 (탁음·반탁음·요음 포함) 학습, 쓰기 연습 |
| 단어·한자 | 기본 단어, JLPT N5 단어, 한자 |
| 문법·회화 | 문법 설명, 상황별 회화, 식당·여행 표현 (여행 표현 즐겨찾기) |
| 연습 | 퀴즈, 플래시카드, 짝 맞추기, 타임어택, 듣기 퀴즈 (브라우저 음성 합성으로 발음 재생) |
| 기록 | 하루 목표, 학습 통계 |

## 기술

- React 19 + Vite, PWA (`vite-plugin-pwa`)
- Capacitor 6 (Android)
- GitHub Actions: 푸시 시 APK 빌드(`build-apk.yml`), 수동 실행으로 Play Store용 서명 AAB 빌드(`build-release.yml`)

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

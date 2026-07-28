# IVE DIVE 하이브리드 앱

[IVE DIVE 웹 서비스](https://ive-three.vercel.app)([리포](https://github.com/seokachu/IVE))를
네이티브 셸로 감싼 **Expo(React Native) 하이브리드 앱**.
완성된 웹을 그대로 재사용하면서, 웹이 할 수 없는 것들 — **푸시 알림, 카드사 앱 연동
결제, 설치형 앱 경험** — 을 네이티브 레이어가 담당한다.

| 메인 (WebView) | 자유게시판 | 푸시 알림 |
|:---:|:---:|:---:|
| <img src="docs/images/main.png" width="240" alt="메인 화면" /> | <img src="docs/images/board.png" width="240" alt="자유게시판" /> | <img src="docs/images/push-notifications.png" width="240" alt="푸시 알림" /> |

## 기술 스택

- **Expo SDK 57 / React Native 0.86 / React 19.2** (웹과 React 버전 정렬)
- **react-native-webview** — WebView 셸 + 한국 PG 결제 대응
- **expo-notifications + FCM** — 푸시 알림 (Expo Push → FCM → 기기)
- **EAS** — 프로젝트/자격증명 관리, 로컬 Gradle 빌드로 개발

## 핵심 구현

### 1. 푸시 알림 (댓글·답글)

```
[앱] 토큰 발급 → WebView 전역에 주입
[웹] 로그인 사용자와 연결해 Supabase에 저장 (RLS)
[서버] 댓글 작성 시 수신자 계산 → Expo Push 발송
[앱] 수신 → 탭하면 해당 게시글로 이동 (콜드 스타트 대응)
```

- 수신자 로직: 글 작성자 + 대댓글 시 원댓글 작성자, 본인 제외, 중복 시 답글 알림 우선
- 내용 미리보기(40자), 마이페이지 수신 설정(on/off), 만료 토큰 자동 정리
- 상세 설계: [웹 리포 docs/push-notifications.md](https://github.com/seokachu/IVE/blob/main/docs/push-notifications.md)

### 2. 결제 (토스페이먼츠 + 카드사 앱)

- 결제창·카드사 인증·PG 중계 페이지를 전부 WebView 안에서 처리 (브라우저 이탈 차단)
- `intent://` 스킴 파싱으로 카드사 앱(SOL페이 등) 실행, 미설치 시 스토어 폴백
- Android App Links(`assetlinks.json`)로 외부 앱 복귀 시 브라우저가 아닌 앱으로
- 문제 해결 전 과정: [docs/webview-payment-debugging.md](docs/webview-payment-debugging.md)

### 3. 앱답게 만드는 UX

- 안드로이드 하드웨어 뒤로가기 → 웹 히스토리 우선
- 오프라인 감지 화면, iOS WebView 프로세스 종료 자동 복구
- 브랜드 아이콘/스플래시 (웹 로고에서 생성)

## 문서

| 문서 | 내용 |
|---|---|
| [docs/decisions.md](docs/decisions.md) | 기술 의사결정 — 하이브리드 vs PWA, FCM 이유, 수신자 설계 등 |
| [docs/webview-payment-debugging.md](docs/webview-payment-debugging.md) | 결제 디버깅 기록 — 크롬 이탈, SameSite, originWhitelist |
| [웹 docs/push-notifications.md](https://github.com/seokachu/IVE/blob/main/docs/push-notifications.md) | 푸시 아키텍처 + 설계 결정 + 예상 Q&A |

## 실행

```bash
pnpm install
pnpm android   # 로컬 빌드 + 에뮬레이터/기기 실행 (Android Studio 필요)
pnpm start     # 개발 서버만
```

- 설치용 APK: `cd android && ./gradlew assembleRelease`
  → `android/app/build/outputs/apk/release/app-release.apk`
- `google-services.json`은 커밋하지 않음 — 재발급:
  ```bash
  pnpm dlx firebase-tools apps:sdkconfig ANDROID 1:836315136411:android:ab10379b7f4d837856613e \
    --project ive-dive-app -o google-services.json
  ```

## 데모 시나리오 (시연용)

1. **앱 실행** — 핑크 스플래시 → 웹이 WebView로 로드
2. **푸시** — 다른 계정으로 웹에서 댓글 작성 → 몇 초 내 기기에 알림 도착
   → 탭하면 해당 게시글로 이동
3. **수신 설정** — 마이페이지 토글 OFF → 댓글 → 알림 없음 → ON 복구
4. **결제** — 굿즈샵 → 카드 결제 → 카드사 앱 인증 → 앱으로 복귀 → 성공 페이지
5. **뒤로가기** — 하드웨어 백 버튼이 웹 히스토리를 타고 이동

## 남은 로드맵

- iOS 지원 (Apple Developer Program 필요 — APNs 설정)
- 알림 종류 확장 (좋아요 등) 및 종류별 수신 설정
- 플레이스토어 배포 (EAS production 빌드, 릴리즈 서명 키로 assetlinks 갱신)

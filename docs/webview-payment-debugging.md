# WebView 결제(토스/카드사 앱) 디버깅 기록

하이브리드 앱에서 카드 결제가 동작하기까지의 문제 해결 과정.
실기기(Galaxy Z Fold, Android)에서만 재현되는 문제들이라 에뮬레이터/데스크톱
테스트로는 발견할 수 없었다. 면접에서 "하이브리드 앱의 어려움"을 물으면 이 사례.

## 증상의 변천과 원인

### 1차: 결제 완료 후 크롬에서 "로그인하세요"

- **증상**: 결제는 되는데 성공 페이지가 시스템 브라우저(크롬)에서 열리고 로그인 요구.
- **원인 1**: 결제창(window.open)을 WebView가 처리하지 못해 크롬으로 위임.
  → `setSupportMultipleWindows={false}`로 같은 WebView에서 열도록 수정.
- **원인 2**: 허용 목록(allowlist) 정책이 문제. "우리 도메인·토스·카카오만 WebView,
  나머지는 브라우저로"였는데, 카드 결제는 **카드사 인증·PG 중계 등 예측 불가한
  도메인을 여러 번 경유**한다. 중간에 하나라도 브라우저로 새면 이후 흐름 전체가
  세션 없는 브라우저에서 진행된다.
  → 정책 반전: **http/https는 전부 WebView에서, 앱 스킴만 밖으로**. (한국 PG 표준)

### 2차: 앱 안으로 들어왔는데 서버가 "로그인하세요"

- **증상**: 성공 페이지가 앱 안에서 열리는데도 서버 가드(proxy)가 로그인으로 리다이렉트.
- **원인**: PG → 우리 사이트 복귀는 **크로스 사이트 리다이렉트**라 SameSite=Lax
  세션 쿠키가 요청에 실리지 않는다. 서버는 비로그인으로 오판.
  (같은 사이트 내 이동인 /mypage는 정상이었던 이유)
- **수정**: /payment/* 경로의 인증을 서버에서 **클라이언트 AuthGuard로 이관** —
  페이지의 JS는 자기 쿠키를 항상 읽을 수 있어 SameSite 영향이 없다.
  겸사겸사 AuthGuard의 리다이렉트 타이머 cleanup 누락(레이스)도 수정.

### 3차: 카드사 앱(SOL페이)이 안 열림

- **증상**: "신한 SOL페이에서 결제하고 있어요"에서 멈춤. 앱 미실행.
- **진단**: USB 디버깅으로 logcat 확인 →
  `Can't open url: intent://pay?...;scheme=shinhan-sr-ansimclick;package=com.shcard.smartpay`
  이 경고는 우리 코드가 아니라 **react-native-webview 라이브러리**가 찍은 것.
- **원인**: WebView의 기본 `originWhitelist`가 http/https만 허용 →
  intent:// 스킴은 **onShouldStartLoadWithRequest에 도달하기 전에** 라이브러리가
  가로채 `Linking.canOpenURL`로 처리 시도 → Android 11+ 패키지 가시성 정책으로
  canOpenURL이 false → 조용히 실패. 우리가 만든 intent 파싱 코드는 실행 기회조차 없었다.
- **수정**: `originWhitelist={["*"]}` — 모든 스킴이 우리 핸들러에 도달하게 하고,
  intent://는 스킴 변환(`intent://… scheme=X` → `X://…`) 후 실행, 실패 시
  Play 스토어(`market://details?id=패키지`)로 폴백.
- **검증**: logcat에서 우리 앱이 `shinhan-sr-ansimclick://` 인텐트로
  `com.shcard.smartpay`를 실행한 기록(result code=0) 확인.

## 함께 적용한 것: Android App Links

외부 앱(카드사/토스)이 `https://ive-three.vercel.app` 주소로 복귀시킬 때
브라우저가 아닌 우리 앱이 열리도록:

- 웹: `/.well-known/assetlinks.json` 배포 (서명 지문 등록)
- 앱: `intentFilters`(autoVerify) + 딥링크로 들어온 URL을 WebView로 라우팅
- 확인: `adb shell pm get-app-links` → `verified`

## 교훈

1. **결제·인증처럼 도메인을 예측할 수 없는 흐름에 allowlist를 걸지 말 것.**
   경계는 "http인가 아닌가"로 긋고, 스킴만 분기한다.
2. **라이브러리 기본값을 의심할 것.** 내 핸들러가 안 불리는 문제였는데,
   증상만 보면 "내 코드가 잘못 처리하는" 것처럼 보였다.
3. **실기기 + adb logcat이 결정적이었다.** 추측으로 고치면 리빌드-재설치
   사이클만 반복된다. 경고 메시지 한 줄이 원인을 특정했다.
4. **SameSite는 서버 인증 설계에 영향을 준다.** 크로스 사이트 복귀 경로의
   인증은 클라이언트에서 검증하는 것이 정확하다.

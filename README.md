# IVE DIVE 하이브리드 앱

[IVE DIVE 웹](https://ive-three.vercel.app)([리포](https://github.com/seokachu/IVE))을 WebView로 감싼 Expo 하이브리드 앱.

## 구조

- `App.tsx` — SafeArea + 상태바 셸
- `src/WebViewScreen.tsx` — WebView 본체. 안드로이드 하드웨어 뒤로가기(웹 히스토리 우선), iOS 스와이프 내비게이션/당겨서 새로고침, 로딩 스피너, 오프라인 화면, WebView 프로세스 종료 복구
- `src/constants.ts` — 서비스 URL과 내부 허용 호스트(인증·결제 리다이렉트 포함)
- `src/isInternalUrl.ts` — 허용 호스트는 WebView 안에서, 그 외 외부 링크는 시스템 브라우저로

## 실행

```bash
pnpm install
pnpm ios      # iOS 시뮬레이터
pnpm android  # Android 에뮬레이터
pnpm start    # Expo Go (실기기 QR)
```

## 실기기에서 확인할 것

- 카카오 로그인: WebView 내 OAuth 흐름 정상 여부 (정책상 시스템 브라우저 전환이 필요할 수 있음)
- 토스 결제: 카드사 앱 호출(intent:// 스킴) 및 결제 완료 리다이렉트 복귀
- 다음 단계 후보: 푸시 알림(expo-notifications), 딥링크(scheme: `ivedive`), 스플래시/아이콘 브랜딩

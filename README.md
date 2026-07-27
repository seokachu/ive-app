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
## 푸시 알림

권한 요청, 안드로이드 채널, Expo 푸시 토큰 발급, 알림 탭 시 `data.url` 페이지로 WebView 이동(콜드 스타트 포함)까지 구현. EAS 프로젝트(@seokachu/ive-app)와 Firebase 프로젝트(ive-dive-app)가 연결되어 있다.

`google-services.json`은 공개 리포라 커밋하지 않는다. 새로 받으려면:

```bash
pnpm dlx firebase-tools login
pnpm dlx firebase-tools apps:sdkconfig ANDROID 1:836315136411:android:ab10379b7f4d837856613e \
  --project ive-dive-app -o google-services.json
```

남은 것: FCM V1 서비스 계정 키를 EAS에 업로드(서버 발송용), iOS APNs 설정, 서버 발송 로직.

- 다음 단계 후보: 딥링크(scheme: `ivedive`) 라우팅, EAS 빌드 파이프라인

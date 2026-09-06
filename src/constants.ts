export const WEB_URL = "https://ive-three.vercel.app";

// 네이티브 스플래시 → RN 오버레이 페이드 시간. App.tsx(setOptions)와 WebViewScreen(최소 노출 계산)이 같이 쓴다
export const SPLASH_FADE_MS = 300;

// WebView 안에서 그대로 열어야 하는 호스트.
// 인증(Supabase, 카카오)과 결제(토스) 리다이렉트는 앱 밖으로 내보내면 흐름이 끊긴다.
// 앞에 점(.)이 붙은 항목은 서브도메인 전체를 포함한다.
export const INTERNAL_HOSTS = [
  "ive-three.vercel.app",
  ".supabase.co",
  ".kakao.com",
  ".kakaocdn.net",
  ".tosspayments.com",
  ".toss.im",
];

// Android 하드웨어 뒤로가기 기준 (WebViewScreen, docs/decisions.md §9).
// 홈: 2초 안에 두 번 눌러 종료 · 탭 루트: 홈으로 · 그 외(상세 등): 웹 히스토리.
// 탭 루트는 웹 하단 탭바(BottomNav = GNB_ARRAY)와 같이 바꾼다.
export const HOME_PATH = "/";
export const TAB_ROOT_PATHS = ["/news", "/discography", "/shop", "/board"];
export const EXIT_DOUBLE_PRESS_MS = 2000;

export const WEB_URL = "https://ive-three.vercel.app";

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

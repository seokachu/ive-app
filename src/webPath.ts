import { WEB_URL } from "./constants";

const WEB_ORIGIN = WEB_URL.replace(/\/+$/, "").toLowerCase();

// 우리 웹 도메인의 경로만 돌려준다 — 외부 도메인(토스 · 카드사 등)은 null.
// 쿼리 · 해시 · 끝 슬래시는 뗀다 ("/shop/?sort=new" → "/shop", 루트는 "/").
// Hermes의 URL 지원이 완전하지 않아 문자열로 처리한다 (isInternalUrl 과 같은 이유).
export const getWebPath = (url: string) => {
  if (!url.toLowerCase().startsWith(WEB_ORIGIN)) return null;
  const rest = url.slice(WEB_ORIGIN.length);
  // "ive-three.vercel.app.evil.com" 처럼 앞부분만 같은 다른 호스트
  if (rest !== "" && !/^[/?#]/.test(rest)) return null;
  const path = rest.split(/[?#]/)[0].replace(/\/+$/, "");
  return path === "" ? "/" : path;
};

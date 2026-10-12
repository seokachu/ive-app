import { Linking } from "react-native";

// intent:// 스킴(토스/카드사 앱 호출)을 실제 앱 스킴으로 변환해 연다.
// 해당 앱이 없으면 Play 스토어로 보낸다.
const openIntentUrl = async (url: string) => {
  const scheme = url.match(/scheme=([^;]+)/)?.[1];
  const packageName = url.match(/package=([^;]+)/)?.[1];
  const appUrl = scheme ? url.replace(/^intent:\/\//, `${scheme}://`).split("#Intent")[0] : null;

  try {
    if (!appUrl) throw new Error("scheme 정보 없음");
    await Linking.openURL(appUrl);
  } catch {
    if (packageName) {
      Linking.openURL(`market://details?id=${packageName}`).catch(() => {});
    }
  }
};

/** APK 다운로드 URL — GitHub 릴리스 자산이나 .apk 로 끝나는 주소 */
const APK_URL_PATTERN = /\.apk(\?|#|$)|\/releases\/[^?#]*\/download\//i;

// WebView onShouldStartLoadWithRequest — Android 단일 WebView(WebViewScreen)와 iOS 탭별 WebView(TabWebView)가 같이 쓴다.
// http/https는 전부 WebView 안에서 처리한다. 결제(토스→카드사 인증→PG 중계)가
// 여러 외부 도메인을 경유하므로, 허용 목록 방식은 흐름 중간에 브라우저로 새어
// 세션이 끊긴다. 앱 호출 스킴(intent:// 등)만 밖으로 보낸다.
export const handleShouldStartLoad = (request: { url: string }) => {
  // APK 파일은 WebView 가 받으면 안 된다 — WebView 의 DownloadManager 알림은 눌러도
  // 설치기로 넘어가지 않는다. 시스템 브라우저(Chrome)에 넘기면 받은 뒤 바로 설치로 이어진다.
  // (/download 페이지가 앱 안에서 열렸을 때 GitHub 릴리스 링크로 이동하는 순간 여기서 잡힌다)
  if (APK_URL_PATTERN.test(request.url)) {
    Linking.openURL(request.url).catch(() => {});
    return false;
  }

  if (request.url.startsWith("http://") || request.url.startsWith("https://")) {
    return true;
  }

  if (request.url.startsWith("intent://")) {
    openIntentUrl(request.url);
    return false;
  }

  Linking.openURL(request.url).catch(() => {
    // 열 수 없는 스킴은 조용히 무시
  });
  return false;
};

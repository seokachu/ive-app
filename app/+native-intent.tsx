import { getTabForPath, getTabRoute } from "../src/tabs";
import { getWebPath } from "../src/webPath";

// 앱을 연 URL(알림 · App Links · ivedive://)을 라우트로 바꾼다. 라우트는 탭 5개뿐이라
// 그 경로가 속한 탭으로만 보내고, 실제 페이지 이동은 IosTabsLayout 이 그 탭 WebView 에 맡긴다.
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    return getTabRoute(getTabForPath(getWebPath(path) ?? (path.startsWith("/") ? path.split(/[?#]/)[0] : null)));
  } catch {
    return "/";
  }
}

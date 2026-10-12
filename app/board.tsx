import TabWebView from "../src/ios/TabWebView";

// iOS 네이티브 탭 화면 (Android 는 app/_layout 이 단일 WebView 를 그려 쓰지 않는다)
export default function BoardTab() {
  return <TabWebView name="board" />;
}

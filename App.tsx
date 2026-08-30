import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import WebViewScreen from "./src/WebViewScreen";
import { SPLASH_FADE_MS } from "./src/constants";

/**
 * **스플래시는 2단계다** — 웹뷰가 첫 화면을 그릴 때까지 빈 화면이 안 보인다.
 *
 * 안드로이드 12+ 네이티브 스플래시는 "배경색 + 중앙 아이콘"만 허용해서
 * 워드마크·태그라인을 실을 수 없다. 아이콘만 먼저 떴다가 로고+태그라인으로
 * 바뀌면 로고가 미세하게 어긋나 보여서, 네이티브 단계는 **배경색만** 보이게
 * 두고(투명 이미지) RN 이 그리는 순간 같은 분홍 배경의 오버레이가 로고와
 * 태그라인을 한 번에 띄워 웹 로드가 끝날 때까지 잇는다.
 *
 * 자동 숨김을 막아 두는 것은 그 이음매 때문이다 — RN 오버레이의 첫
 * 레이아웃(onLayout)까지 네이티브를 붙잡아 둬야 중간에 빈 화면이 끼지
 * 않는다. 배경색이 같아 페이드 300ms 가 한 장면처럼 이어진다.
 */
SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({ fade: true, duration: SPLASH_FADE_MS });

//StatusBar는 웹 테마에 따라 동적으로 바뀌어야 하므로 WebViewScreen에서 렌더링한다
export default function App() {
  return (
    <SafeAreaProvider>
      <WebViewScreen />
    </SafeAreaProvider>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import type { WebViewMessageEvent } from "react-native-webview";
import NetInfo from "@react-native-community/netinfo";
import { WEB_URL } from "../constants";
import { isInternalUrl } from "../isInternalUrl";
import OfflineScreen from "../OfflineScreen";
import { handleShouldStartLoad } from "../shouldStartLoad";
import { TABS, type TabName } from "../tabs";
import { useTabShell } from "./TabShellContext";

/**
 * 웹 하단 탭바(BottomNav)는 네이티브 탭바가 대신하므로 숨기고, 탭바 높이 변수(--tabbar-h)를
 * 세이프에어리어로 바꾼다 — 탭바 위에 붙는 요소(mb-tabbar)와 본문 여백(pb-tabbar)이 네이티브 탭바 위로 올라간다.
 * <style> 을 문서에 넣으면 React 하이드레이션이 지울 수 있어 DOM 밖의 adoptedStyleSheets 로 붙인다(웹 코드 수정 없음).
 */
const HIDE_WEB_TABBAR_SCRIPT = `(function () {
  try {
    var sheet = new CSSStyleSheet();
    sheet.replaceSync('nav[aria-label="하단 메뉴"]{display:none!important}:root{--tabbar-h:env(safe-area-inset-bottom,0px)!important}');
    document.adoptedStyleSheets = document.adoptedStyleSheets.concat(sheet);
  } catch (e) {}
})(); true;`;

const TabWebView = ({ name }: { name: TabName }) => {
  const shell = useTabShell();
  const { isDark, setIsDark, pushToken, register, takePendingUrl, onFirstLoadEnd } = shell;
  const tabPath = TABS.find((tab) => tab.name === name)?.path ?? "/";
  const webViewRef = useRef<WebView>(null);
  const readyRef = useRef(false);
  const pendingUrlRef = useRef<string | null>(null);
  //첫 주소 — 알림 · 딥링크로 이 탭이 처음 열렸으면 그 URL, 아니면 탭 루트
  const [initialUrl] = useState(() => takePendingUrl(name) ?? `${WEB_URL}${tabPath === "/" ? "" : tabPath}`);
  const [isOffline, setIsOffline] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const loadFailedRef = useRef(false);
  //"홈으로 이동" 시 WebView 를 다시 마운트해 탭 루트부터 로드
  const [webKey, setWebKey] = useState(0);

  const injectPushToken = useCallback(() => {
    if (!pushToken || !readyRef.current) return;
    const payload = JSON.stringify({ token: pushToken, platform: "ios" });
    webViewRef.current?.injectJavaScript(
      `window.__IVE_PUSH__ = ${payload}; window.dispatchEvent(new Event("ive-push-token")); true;`,
    );
  }, [pushToken]);

  useEffect(injectPushToken, [injectPushToken]);

  useEffect(
    () =>
      register(name, {
        navigate: (url) => {
          if (!isInternalUrl(url)) return;
          if (readyRef.current) {
            webViewRef.current?.injectJavaScript(`window.location.href = ${JSON.stringify(url)}; true;`);
          } else {
            pendingUrlRef.current = url;
          }
        },
        goRoot: () => {
          webViewRef.current?.injectJavaScript(
            `if (typeof window.__iveNavigate === "function") { window.__iveNavigate(${JSON.stringify(tabPath)}, true); }` +
              ` else { window.location.replace(${JSON.stringify(`${WEB_URL}${tabPath}`)}); } true;`,
          );
        },
      }),
    [name, register, tabPath],
  );

  // 연결이 끊기면 오프라인 화면, 복구되면 실패했던 페이지를 자동으로 다시 불러온다
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = Boolean(state.isConnected && state.isInternetReachable !== false);
      setIsOffline(!online);
      if (online && loadFailedRef.current) {
        loadFailedRef.current = false;
        setLoadFailed(false);
        webViewRef.current?.reload();
      }
    });
    return unsubscribe;
  }, []);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data?.type === "theme") setIsDark(data.value === "dark");
      } catch {
        //웹에서 오는 다른 형식의 메시지(route · overlay — Android 뒤로가기용)는 무시
      }
    },
    [setIsDark],
  );

  const handleRetry = useCallback(async () => {
    const state = await NetInfo.fetch();
    const online = Boolean(state.isConnected && state.isInternetReachable !== false);
    setIsOffline(!online);
    if (online) {
      loadFailedRef.current = false;
      setLoadFailed(false);
      webViewRef.current?.reload();
    }
  }, []);

  const handleGoHome = useCallback(() => {
    loadFailedRef.current = false;
    setLoadFailed(false);
    readyRef.current = false;
    setWebKey((key) => key + 1);
  }, []);

  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]} edges={["top"]}>
      <WebView
        key={webKey}
        ref={webViewRef}
        source={{ uri: webKey === 0 ? initialUrl : `${WEB_URL}${tabPath}` }}
        style={[styles.webview, isDark && styles.containerDark]}
        injectedJavaScriptBeforeContentLoaded={HIDE_WEB_TABBAR_SCRIPT}
        onMessage={handleMessage}
        originWhitelist={["*"]}
        onShouldStartLoadWithRequest={handleShouldStartLoad}
        onError={() => {
          loadFailedRef.current = true;
          setLoadFailed(true);
          onFirstLoadEnd();
        }}
        renderError={() => <View style={[styles.container, isDark && styles.containerDark]} />}
        onLoad={() => {
          loadFailedRef.current = false;
          setLoadFailed(false);
        }}
        onLoadEnd={() => {
          readyRef.current = true;
          onFirstLoadEnd();
          injectPushToken();
          if (pendingUrlRef.current) {
            const pendingUrl = pendingUrlRef.current;
            pendingUrlRef.current = null;
            webViewRef.current?.injectJavaScript(`window.location.href = ${JSON.stringify(pendingUrl)}; true;`);
          }
        }}
        allowsBackForwardNavigationGestures
        pullToRefreshEnabled
        onContentProcessDidTerminate={() => webViewRef.current?.reload()}
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
        setSupportMultipleWindows={false}
        javaScriptCanOpenWindowsAutomatically
      />
      {(isOffline || loadFailed) && <OfflineScreen onRetry={handleRetry} onGoHome={handleGoHome} isDark={isDark} />}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  //웹 다크 테마와 동일한 배경 (design-system §1-3)
  containerDark: {
    backgroundColor: "#1b1b1f",
  },
  webview: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
});

export default TabWebView;

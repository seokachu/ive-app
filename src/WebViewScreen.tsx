import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, Linking, Platform, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import type { WebViewNavigation } from "react-native-webview";
import NetInfo from "@react-native-community/netinfo";
import { WEB_URL } from "./constants";
import { isInternalUrl } from "./isInternalUrl";
import OfflineScreen from "./OfflineScreen";
import { registerForPushNotificationsAsync, subscribeNotificationNavigation } from "./notifications";

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

const WebViewScreen = () => {
  const webViewRef = useRef<WebView>(null);
  const canGoBackRef = useRef(false);
  const webViewReadyRef = useRef(false);
  const pendingUrlRef = useRef<string | null>(null);
  const pushTokenRef = useRef<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);

  // 웹이 토큰을 Supabase에 저장할 수 있도록 WebView 전역에 주입
  const injectPushToken = useCallback(() => {
    const token = pushTokenRef.current;
    if (!token || !webViewReadyRef.current) return;
    const payload = JSON.stringify({ token, platform: Platform.OS });
    webViewRef.current?.injectJavaScript(
      `window.__IVE_PUSH__ = ${payload}; window.dispatchEvent(new Event("ive-push-token")); true;`,
    );
  }, []);

  const navigateTo = useCallback((url: string) => {
    if (!isInternalUrl(url)) return;
    const script = `window.location.href = ${JSON.stringify(url)}; true;`;
    if (webViewReadyRef.current) {
      webViewRef.current?.injectJavaScript(script);
    } else {
      // 콜드 스타트(알림 탭으로 앱 실행) 시에는 WebView 로드 후 이동
      pendingUrlRef.current = url;
    }
  }, []);

  // 푸시 토큰 발급 + 알림 탭 시 해당 페이지로 이동
  useEffect(() => {
    registerForPushNotificationsAsync().then((token) => {
      if (!token) return;
      if (__DEV__) console.log("Expo push token:", token);
      pushTokenRef.current = token;
      injectPushToken();
    });
    return subscribeNotificationNavigation(navigateTo);
  }, [navigateTo, injectPushToken]);

  // App Links로 앱이 열렸을 때(결제 후 복귀 등) 해당 페이지로 이동
  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      if (url) navigateTo(url);
    });
    const subscription = Linking.addEventListener("url", ({ url }) => navigateTo(url));
    return () => subscription.remove();
  }, [navigateTo]);

  // 안드로이드 하드웨어 뒤로가기 → 웹 히스토리 우선, 첫 화면이면 기본 동작(앱 종료)
  useEffect(() => {
    if (Platform.OS !== "android") return;

    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (canGoBackRef.current) {
        webViewRef.current?.goBack();
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOffline(!(state.isConnected && state.isInternetReachable !== false));
    });
    return unsubscribe;
  }, []);

  const handleNavigationStateChange = useCallback((navigation: WebViewNavigation) => {
    canGoBackRef.current = navigation.canGoBack;
  }, []);

  // http/https는 전부 WebView 안에서 처리한다. 결제(토스→카드사 인증→PG 중계)가
  // 여러 외부 도메인을 경유하므로, 허용 목록 방식은 흐름 중간에 브라우저로 새어
  // 세션이 끊긴다. 앱 호출 스킴(intent:// 등)만 밖으로 보낸다.
  const handleShouldStartLoad = useCallback((request: { url: string }) => {
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
  }, []);

  const handleRetry = useCallback(async () => {
    const state = await NetInfo.fetch();
    const online = Boolean(state.isConnected && state.isInternetReachable !== false);
    setIsOffline(!online);
    if (online) {
      webViewRef.current?.reload();
    }
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <WebView
        ref={webViewRef}
        source={{ uri: WEB_URL }}
        style={styles.webview}
        onNavigationStateChange={handleNavigationStateChange}
        onShouldStartLoadWithRequest={handleShouldStartLoad}
        onLoadEnd={() => {
          webViewReadyRef.current = true;
          injectPushToken();
          if (pendingUrlRef.current) {
            const pendingUrl = pendingUrlRef.current;
            pendingUrlRef.current = null;
            webViewRef.current?.injectJavaScript(`window.location.href = ${JSON.stringify(pendingUrl)}; true;`);
          }
        }}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color="#111111" />
          </View>
        )}
        // iOS: 스와이프로 뒤로/앞으로, 당겨서 새로고침
        allowsBackForwardNavigationGestures
        pullToRefreshEnabled
        // iOS에서 WebView 프로세스가 종료되면 빈 화면이 되므로 즉시 복구
        onContentProcessDidTerminate={() => webViewRef.current?.reload()}
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        // 결제창 등 window.open을 같은 WebView에서 열어 시스템 브라우저로 새지 않게 한다
        setSupportMultipleWindows={false}
        javaScriptCanOpenWindowsAutomatically
      />
      {isOffline && <OfflineScreen onRetry={handleRetry} />}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  webview: {
    flex: 1,
  },
  loading: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
});

export default WebViewScreen;

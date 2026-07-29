import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, Linking, Platform, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import type { WebViewMessageEvent, WebViewNavigation } from "react-native-webview";
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
  //웹(ThemeBridge)이 postMessage로 알려주는 현재 테마 — 네이티브 셸(배경·상태바)을 맞춘다
  const [isDarkWeb, setIsDarkWeb] = useState(false);

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data?.type === "theme") {
        setIsDarkWeb(data.value === "dark");
      }
    } catch {
      //웹에서 오는 다른 형식의 메시지는 무시
    }
  }, []);

  //Android 당겨서 새로고침 — WebView 자체 pullToRefreshEnabled는 iOS 전용이라
  //ScrollView + RefreshControl로 감싸고, 웹 스크롤이 최상단일 때만 제스처를 활성화한다
  const [refreshing, setRefreshing] = useState(false);
  const [pullEnabled, setPullEnabled] = useState(true);

  const handleWebViewScroll = useCallback((event: { nativeEvent: { contentOffset: { y: number } } }) => {
    setPullEnabled(event.nativeEvent.contentOffset.y <= 0);
  }, []);

  const handlePullRefresh = useCallback(() => {
    setRefreshing(true);
    webViewRef.current?.reload();
  }, []);

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

  const webView = (
    <WebView
        ref={webViewRef}
        source={{ uri: WEB_URL }}
        style={styles.webview}
        onMessage={handleMessage}
        // 기본 originWhitelist(http/https)는 intent:// 등 앱 호출 스킴을
        // onShouldStartLoadWithRequest에 도달하기 전에 차단한다.
        // 전부 통과시키고 스킴 분기는 우리 핸들러에서 처리한다.
        originWhitelist={["*"]}
        onNavigationStateChange={handleNavigationStateChange}
        onShouldStartLoadWithRequest={handleShouldStartLoad}
        onScroll={Platform.OS === "android" ? handleWebViewScroll : undefined}
        onLoadEnd={() => {
          webViewReadyRef.current = true;
          setRefreshing(false);
          injectPushToken();
          if (pendingUrlRef.current) {
            const pendingUrl = pendingUrlRef.current;
            pendingUrlRef.current = null;
            webViewRef.current?.injectJavaScript(`window.location.href = ${JSON.stringify(pendingUrl)}; true;`);
          }
        }}
        startInLoadingState
        renderLoading={() => (
          <View style={[styles.loading, isDarkWeb && styles.loadingDark]}>
            <ActivityIndicator size="large" color={isDarkWeb ? "#f4f4f5" : "#111111"} />
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
  );

  return (
    <SafeAreaView style={[styles.container, isDarkWeb && styles.containerDark]} edges={["top", "bottom"]}>
      <StatusBar style={isDarkWeb ? "light" : "dark"} />
      {Platform.OS === "android" ? (
        <ScrollView
          style={styles.webview}
          contentContainerStyle={styles.pullContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handlePullRefresh}
              enabled={pullEnabled}
              colors={["#db97e9"]}
              progressBackgroundColor={isDarkWeb ? "#1e1e21" : "#ffffff"}
            />
          }
        >
          {webView}
        </ScrollView>
      ) : (
        webView
      )}
      {isOffline && <OfflineScreen onRetry={handleRetry} />}
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
  },
  pullContainer: {
    flexGrow: 1,
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
  loadingDark: {
    backgroundColor: "#1b1b1f",
  },
});

export default WebViewScreen;

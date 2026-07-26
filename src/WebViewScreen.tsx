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

const WebViewScreen = () => {
  const webViewRef = useRef<WebView>(null);
  const canGoBackRef = useRef(false);
  const webViewReadyRef = useRef(false);
  const pendingUrlRef = useRef<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);

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
      if (token && __DEV__) console.log("Expo push token:", token);
    });
    return subscribeNotificationNavigation(navigateTo);
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

  // 서비스/인증/결제 도메인은 WebView 안에서, 그 외 외부 링크는 시스템 브라우저로
  const handleShouldStartLoad = useCallback((request: { url: string }) => {
    if (isInternalUrl(request.url)) return true;

    Linking.openURL(request.url).catch(() => {
      // 열 수 없는 스킴(intent:// 등)은 조용히 무시
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

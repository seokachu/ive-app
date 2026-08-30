import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, Image, Linking, Platform, RefreshControl, ScrollView, StyleSheet, Text, ToastAndroid, View } from "react-native";
import * as SplashScreen from "expo-splash-screen";
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

/** APK 다운로드 URL — GitHub 릴리스 자산이나 .apk 로 끝나는 주소 */
const APK_URL_PATTERN = /\.apk(\?|#|$)|\/releases\/[^?#]*\/download\//i;

/** 로드가 이만큼 길어지면 스플래시에 스피너를 붙인다 — 멈춘 게 아니라는 신호 */
const SPLASH_SPINNER_MS = 10000;
/** 이벤트가 전부 누락돼도 스플래시에 갇히지 않게 하는 최후 안전장치 */
const SPLASH_SAFETY_MS = 15000;

/**
 * 네이티브 스플래시(배경색만)를 내린다.
 *
 * App.tsx 가 자동 숨김을 막아 뒀기 때문에 반드시 누군가는 이걸 불러야 한다 —
 * 오버레이의 첫 레이아웃 · 로드 완료 · 로드 실패 · 최후 안전장치 네 곳에서
 * 부른다. 하나라도 빠지면 스플래시에 갇힌다. 여러 번 불러도 안전하다.
 */
const hideNativeSplash = () => {
  SplashScreen.hideAsync().catch(() => {});
};

const WebViewScreen = () => {
  const webViewRef = useRef<WebView>(null);
  const canGoBackRef = useRef(false);
  const webViewReadyRef = useRef(false);
  const pendingUrlRef = useRef<string | null>(null);
  const pushTokenRef = useRef<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  //WebView 로드 실패(오프라인·타임아웃) — 내장 에러 페이지 대신 우리 화면을 띄운다
  const [loadFailed, setLoadFailed] = useState(false);
  const loadFailedRef = useRef(false);
  //"홈으로 이동" 시 WebView를 다시 마운트해 WEB_URL부터 로드
  const [webKey, setWebKey] = useState(0);
  //웹(ThemeBridge)이 postMessage로 알려주는 현재 테마 — 네이티브 셸(배경·상태바)을 맞춘다
  const [isDarkWeb, setIsDarkWeb] = useState(false);
  //첫 로딩이 끝날 때까지 브랜드 스플래시 오버레이 표시
  const [webLoaded, setWebLoaded] = useState(false);
  //로드가 SPLASH_SPINNER_MS 를 넘겼는가 — 그때만 오버레이에 스피너를 붙인다.
  //평소에는 브랜드 화면만 보이고, 오래 걸릴 때만 "멈춘 게 아니다"를 알린다
  const [slowLoad, setSlowLoad] = useState(false);
  const splashVisible = !webLoaded && !loadFailed;

  useEffect(() => {
    const timer = setTimeout(() => setSlowLoad(true), SPLASH_SPINNER_MS);
    return () => clearTimeout(timer);
  }, []);

  // 자동 숨김을 막아 뒀으므로 네이티브 스플래시는 우리가 안 내리면 영영 남는다.
  // onLoadEnd·onError 가 전부 누락되는 경우까지 대비한 마지막 탈출구.
  useEffect(() => {
    if (webLoaded) return;
    const timer = setTimeout(() => {
      hideNativeSplash();
      setWebLoaded(true);
    }, SPLASH_SAFETY_MS);
    return () => clearTimeout(timer);
  }, [webLoaded]);

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

  // 안드로이드 하드웨어 뒤로가기 → 웹 히스토리 우선,
  // 첫 화면이면 2초 안에 한 번 더 눌러야 종료 (실수로 앱이 꺼지는 것 방지)
  const lastBackPressRef = useRef(0);
  useEffect(() => {
    if (Platform.OS !== "android") return;

    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (canGoBackRef.current) {
        webViewRef.current?.goBack();
        return true;
      }

      const now = Date.now();
      if (now - lastBackPressRef.current <= 2000) {
        return false; // 기본 동작 = 앱 종료
      }
      lastBackPressRef.current = now;
      ToastAndroid.show("한 번 더 누르면 앱이 종료돼요", ToastAndroid.SHORT);
      return true;
    });
    return () => subscription.remove();
  }, []);

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

  const handleNavigationStateChange = useCallback((navigation: WebViewNavigation) => {
    canGoBackRef.current = navigation.canGoBack;
  }, []);

  // http/https는 전부 WebView 안에서 처리한다. 결제(토스→카드사 인증→PG 중계)가
  // 여러 외부 도메인을 경유하므로, 허용 목록 방식은 흐름 중간에 브라우저로 새어
  // 세션이 끊긴다. 앱 호출 스킴(intent:// 등)만 밖으로 보낸다.
  const handleShouldStartLoad = useCallback((request: { url: string }) => {
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
  }, []);

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
    setWebKey((key) => key + 1);
  }, []);

  const handleLoadError = useCallback(() => {
    //오프라인 화면이 스플래시 뒤에 가려지지 않게 먼저 내린다
    hideNativeSplash();
    loadFailedRef.current = true;
    setLoadFailed(true);
    setWebLoaded(true);
    setRefreshing(false);
  }, []);

  const webView = (
    <WebView
        key={webKey}
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
        // 로드 실패 시 WebView 내장 에러 페이지 대신 빈 화면 → 그 위에 OfflineScreen을 덮는다
        onError={handleLoadError}
        renderError={() => <View style={[styles.errorFallback, isDarkWeb && styles.containerDark]} />}
        onLoad={() => {
          loadFailedRef.current = false;
          setLoadFailed(false);
        }}
        onLoadEnd={() => {
          //최소 노출 시간 없이, 웹 로드가 끝나는 즉시 오버레이를 걷는다
          hideNativeSplash();
          webViewReadyRef.current = true;
          setWebLoaded(true);
          setRefreshing(false);
          injectPushToken();
          if (pendingUrlRef.current) {
            const pendingUrl = pendingUrlRef.current;
            pendingUrlRef.current = null;
            webViewRef.current?.injectJavaScript(`window.location.href = ${JSON.stringify(pendingUrl)}; true;`);
          }
        }}
        // iOS: 스와이프로 뒤로/앞으로, 당겨서 새로고침
        allowsBackForwardNavigationGestures
        pullToRefreshEnabled
        // iOS에서 WebView 프로세스가 종료되면 빈 화면이 되므로 즉시 복구
        onContentProcessDidTerminate={() => webViewRef.current?.reload()}
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        // 메인 히어로의 유튜브 배경 영상은 음소거 자동재생이다. react-native-webview 의
        // mediaPlaybackRequiresUserAction 기본값이 true 라 웹에서 되던 자동재생이 앱에서만
        // 막혀 썸네일 폴백만 보였다. iOS 는 인라인 재생까지 켜야 전체화면으로 튀지 않는다.
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
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
      {/* 첫 로딩 동안 시스템 스플래시와 이어지는 브랜드 스플래시 —
          absolute 자식은 SafeAreaView 패딩을 무시하므로 상태바·내비게이션 영역까지 덮는다.
          첫 onLayout 에서 네이티브(배경색만)를 내려 로고+타이틀이 페이드로 떠오른다 */}
      {splashVisible && (
        <View style={styles.splash} pointerEvents="none" onLayout={hideNativeSplash}>
          <Image source={require("../assets/splash-gradient.png")} style={styles.splashBackground} resizeMode="cover" />
          <Image source={require("../assets/splash-logo.png")} style={styles.splashLogo} resizeMode="contain" />
          <Text style={styles.splashTagline}>IVE FAN COMMUNITY</Text>
          {slowLoad && <ActivityIndicator size="small" color="#ffffff" style={styles.splashSpinner} />}
        </View>
      )}
      {(isOffline || loadFailed) && (
        <OfflineScreen onRetry={handleRetry} onGoHome={handleGoHome} isDark={isDarkWeb} />
      )}
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
  errorFallback: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  pullContainer: {
    flexGrow: 1,
  },
  splash: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  splashBackground: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
  },
  splashLogo: {
    width: 110,
    height: 134,
  },
  //브랜드 로크업을 밀어내지 않도록 화면 아래에 따로 띄운다
  splashSpinner: {
    position: "absolute",
    bottom: 96,
  },
  splashTagline: {
    marginTop: 20,
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 4,
  },
});

export default WebViewScreen;

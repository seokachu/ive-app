import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Image, Linking, StyleSheet, Text, View } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { SPLASH_FADE_MS } from "../constants";
import { isInternalUrl } from "../isInternalUrl";
import { registerForPushNotificationsAsync, subscribeNotificationNavigation } from "../notifications";
import { getTabForPath, getTabRoute, TABS, type TabName } from "../tabs";
import { getWebPath } from "../webPath";
import { type TabHandle, type TabShell, TabShellContext } from "./TabShellContext";

// 브랜드 스플래시 타이밍 — Android WebViewScreen 과 같은 값 (근거는 WebViewScreen 주석)
const SPLASH_MIN_MS = 1000;
const SPLASH_SPINNER_MS = 10000;
const SPLASH_SAFETY_MS = 15000;

const hideNativeSplash = () => {
  SplashScreen.hideAsync().catch(() => {});
};

//브랜드 보라 — 본문 크기 대비용 purple-500, 다크는 purple-300 (웹 BottomNav 활성 탭과 동일)
const TINT = { light: "#A94FC0", dark: "#DB97E9" };

/**
 * iOS 셸 — 시스템 탭바(UITabBar)를 그대로 쓴다. iOS 26 부터 Liquid Glass(누르면 커지는 렌즈 ·
 * 드래그로 탭 이동)가 시스템 기본이라 따로 그리지 않는다. 탭마다 WebView 가 따로 있어
 * 탭별 스크롤 · 히스토리가 유지된다(네이티브 앱 방식). Android 는 웹 탭바를 쓰는 단일 WebView(WebViewScreen).
 */
const IosTabsLayout = () => {
  const [isDark, setIsDark] = useState(false);
  const [pushToken, setPushToken] = useState<string | null>(null);
  const handlesRef = useRef<Partial<Record<TabName, TabHandle>>>({});
  const pendingUrlsRef = useRef<Partial<Record<TabName, string>>>({});
  //지금 선택된 탭 — 같은 탭을 다시 누르면 탭 루트로 돌아간다
  const activeTabRef = useRef<TabName>("index");

  //첫 로딩이 끝날 때까지 브랜드 스플래시 오버레이 표시
  const [webLoaded, setWebLoaded] = useState(false);
  const [slowLoad, setSlowLoad] = useState(false);
  const splashShownAtRef = useRef<number | null>(null);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const onFirstLoadEnd = useCallback(() => {
    hideNativeSplash();
    const shownAt = splashShownAtRef.current ?? Date.now();
    const remaining = SPLASH_FADE_MS + SPLASH_MIN_MS - (Date.now() - shownAt);
    if (remaining <= 0) {
      setWebLoaded(true);
      return;
    }
    clearTimeout(revealTimerRef.current);
    revealTimerRef.current = setTimeout(() => setWebLoaded(true), remaining);
  }, []);

  useEffect(() => {
    const spinner = setTimeout(() => setSlowLoad(true), SPLASH_SPINNER_MS);
    const safety = setTimeout(() => {
      hideNativeSplash();
      setWebLoaded(true);
    }, SPLASH_SAFETY_MS);
    return () => {
      clearTimeout(spinner);
      clearTimeout(safety);
      clearTimeout(revealTimerRef.current);
    };
  }, []);

  // 알림 · 딥링크 URL → 그 경로가 속한 탭으로 전환하고 그 탭 WebView 를 이동시킨다
  const navigateTo = useCallback((url: string) => {
    if (!isInternalUrl(url)) return;
    const tab = getTabForPath(getWebPath(url));
    const handle = handlesRef.current[tab];
    if (handle) {
      handle.navigate(url);
    } else {
      //아직 안 열린 탭 — 마운트될 때 이 URL 로 첫 로드
      pendingUrlsRef.current[tab] = url;
    }
    try {
      router.navigate(getTabRoute(tab));
    } catch {
      //콜드 스타트에 라우터가 아직 준비 전 — +native-intent 가 같은 탭으로 보낸다
    }
  }, []);

  useEffect(() => {
    registerForPushNotificationsAsync().then((token) => {
      if (!token) return;
      if (__DEV__) console.log("Expo push token:", token);
      setPushToken(token);
    });
    return subscribeNotificationNavigation(navigateTo);
  }, [navigateTo]);

  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      if (url) navigateTo(url);
    });
    const subscription = Linking.addEventListener("url", ({ url }) => navigateTo(url));
    return () => subscription.remove();
  }, [navigateTo]);

  const shell = useMemo<TabShell>(
    () => ({
      isDark,
      setIsDark,
      pushToken,
      register: (name, handle) => {
        handlesRef.current[name] = handle;
        return () => {
          if (handlesRef.current[name] === handle) delete handlesRef.current[name];
        };
      },
      takePendingUrl: (name) => {
        const url = pendingUrlsRef.current[name] ?? null;
        delete pendingUrlsRef.current[name];
        return url;
      },
      onFirstLoadEnd,
    }),
    [isDark, pushToken, onFirstLoadEnd],
  );

  const tint = isDark ? TINT.dark : TINT.light;

  return (
    <TabShellContext.Provider value={shell}>
      <View style={styles.root}>
        <StatusBar style={isDark ? "light" : "dark"} />
        <NativeTabs tintColor={tint}>
          {TABS.map((tab) => (
            <NativeTabs.Trigger
              key={tab.name}
              name={tab.name}
              contentStyle={{ backgroundColor: isDark ? "#1b1b1f" : "#ffffff" }}
              listeners={{
                tabPress: () => {
                  if (activeTabRef.current === tab.name) handlesRef.current[tab.name]?.goRoot();
                },
                focus: () => {
                  activeTabRef.current = tab.name;
                },
              }}
            >
              <NativeTabs.Trigger.Icon sf={tab.sf} />
              <NativeTabs.Trigger.Label>{tab.label}</NativeTabs.Trigger.Label>
            </NativeTabs.Trigger>
          ))}
        </NativeTabs>
        {/* 시스템 스플래시와 이어지는 브랜드 스플래시 — 탭바까지 덮는다 */}
        {!webLoaded && (
          <View
            style={styles.splash}
            pointerEvents="none"
            onLayout={() => {
              splashShownAtRef.current ??= Date.now();
              hideNativeSplash();
            }}
          >
            <Image source={require("../../assets/splash-gradient.png")} style={styles.splashBackground} resizeMode="cover" />
            <Image source={require("../../assets/splash-logo.png")} style={styles.splashLogo} resizeMode="contain" />
            <Text style={styles.splashTagline}>IVE FAN COMMUNITY</Text>
            {slowLoad && <ActivityIndicator size="small" color="#ffffff" style={styles.splashSpinner} />}
          </View>
        )}
      </View>
    </TabShellContext.Provider>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
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

export default IosTabsLayout;

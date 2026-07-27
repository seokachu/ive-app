import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";

// 포그라운드에서도 배너로 알림 표시
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export const registerForPushNotificationsAsync = async (): Promise<string | null> => {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "기본 알림",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  // iOS 시뮬레이터는 푸시 토큰 발급 불가.
  // Android 에뮬레이터는 Google Play 서비스가 있으면 FCM 토큰 발급이 가능해 허용한다.
  if (!Device.isDevice && Platform.OS === "ios") return null;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") return null;

  // EAS 프로젝트 연결(eas init) 전에는 토큰 발급 불가
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return null;

  try {
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    return token.data;
  } catch {
    return null;
  }
};

const extractNotificationUrl = (response: Notifications.NotificationResponse | null) => {
  const url = response?.notification.request.content.data?.url;
  return typeof url === "string" ? url : null;
};

// 알림 탭으로 이동할 URL 구독 (콜드 스타트 포함)
export const subscribeNotificationNavigation = (onNavigate: (url: string) => void) => {
  Notifications.getLastNotificationResponseAsync().then((response) => {
    const url = extractNotificationUrl(response);
    if (__DEV__) console.log("[push] last response:", JSON.stringify(response?.notification.request.content.data ?? null));
    if (url) onNavigate(url);
  });

  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const url = extractNotificationUrl(response);
    if (__DEV__) console.log("[push] tap response:", JSON.stringify(response.notification.request.content.data ?? null));
    if (url) onNavigate(url);
  });

  return () => subscription.remove();
};

import type { SFSymbolIcon } from "expo-router/unstable-native-tabs";

// iOS 네이티브 탭바(app/_layout · NativeTabs)의 탭 목록 — 웹 하단 탭바(BottomNav = 홈 + GNB_ARRAY)와 같은 순서 · 라벨.
// name 은 app/ 의 라우트 파일 이름, path 는 그 탭 WebView 가 여는 웹 경로다. constants.TAB_ROOT_PATHS 와 같이 바꾼다.
export const TABS: { name: TabName; path: string; label: string; sf: NonNullable<SFSymbolIcon["sf"]> }[] = [
  { name: "index", path: "/", label: "홈", sf: { default: "house", selected: "house.fill" } },
  { name: "news", path: "/news", label: "소식", sf: { default: "newspaper", selected: "newspaper.fill" } },
  { name: "discography", path: "/discography", label: "음악", sf: { default: "music.note", selected: "music.note" } },
  { name: "shop", path: "/shop", label: "굿즈샵", sf: { default: "bag", selected: "bag.fill" } },
  { name: "board", path: "/board", label: "자유게시판", sf: { default: "message", selected: "message.fill" } },
];

export type TabName = "index" | "news" | "discography" | "shop" | "board";

// 웹 경로가 속한 탭 — 탭 루트 아래 경로는 그 탭("/board/135" → board), 나머지(마이페이지 · 결제 · 외부 도메인)는 홈 탭
export const getTabForPath = (path: string | null): TabName =>
  TABS.find((tab) => tab.path !== "/" && path !== null && (path === tab.path || path.startsWith(`${tab.path}/`)))?.name ?? "index";

// expo-router 라우트 경로 ("index" → "/")
export const getTabRoute = (name: TabName) => (name === "index" ? "/" : `/${name}`);

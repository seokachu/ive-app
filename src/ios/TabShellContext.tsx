import { createContext, useContext } from "react";
import type { TabName } from "../tabs";

// 탭 WebView 가 셸(IosTabsLayout)에 등록하는 조작 핸들
export interface TabHandle {
  /** 알림 · 딥링크 URL 로 이동 */
  navigate: (url: string) => void;
  /** 이미 선택된 탭을 다시 눌렀을 때 — 탭 루트로 */
  goRoot: () => void;
}

// iOS 탭 WebView 들이 공유하는 셸 상태. 탭마다 WebView 가 따로라 테마 · 푸시 토큰 · 스플래시는 셸이 한 번만 갖는다
export interface TabShell {
  isDark: boolean;
  setIsDark: (isDark: boolean) => void;
  pushToken: string | null;
  register: (name: TabName, handle: TabHandle) => () => void;
  /** 탭이 아직 마운트되기 전에 들어온 URL — 첫 로드 주소로 쓴다 */
  takePendingUrl: (name: TabName) => string | null;
  /** 첫 페이지 로드 끝(성공 · 실패 모두) — 브랜드 스플래시를 걷는다 */
  onFirstLoadEnd: () => void;
}

export const TabShellContext = createContext<TabShell | null>(null);

export const useTabShell = () => {
  const shell = useContext(TabShellContext);
  if (!shell) throw new Error("useTabShell 은 IosTabsLayout 안에서만 쓸 수 있습니다");
  return shell;
};

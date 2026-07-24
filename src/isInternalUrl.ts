import { INTERNAL_HOSTS } from "./constants";

// Hermes의 URL 지원이 완전하지 않아 정규식으로 호스트를 추출한다.
const extractHost = (url: string) => {
  const match = url.match(/^(https?):\/\/([^/:?#]+)/i);
  if (!match) return null;
  return match[2].toLowerCase();
};

export const isInternalUrl = (url: string) => {
  const host = extractHost(url);
  if (!host) return false;

  return INTERNAL_HOSTS.some((entry) =>
    entry.startsWith(".") ? host.endsWith(entry) || host === entry.slice(1) : host === entry,
  );
};

import Svg, { Circle, Defs, G, LinearGradient, Path, Stop } from "react-native-svg";

// lucide 아이콘 패스 (웹과 같은 아이콘셋 — 디자인 SSOT의 lucide-react와 동일한 모양)
const PATHS = {
  "wifi-off": [
    "M12 20h.01",
    "M8.5 16.429a5 5 0 0 1 7 0",
    "M5 12.859a10 10 0 0 1 5.17-2.69",
    "M19 12.859a10 10 0 0 0-2.007-1.523",
    "M2 8.82a15 15 0 0 1 4.177-2.643",
    "M22 8.82a15 15 0 0 0-11.288-3.764",
    "m2 2 20 20",
  ],
  unplug: [
    "m19 5 3-3",
    "m2 22 3-3",
    "M6.3 20.3a2.4 2.4 0 0 0 3.4 0L12 18l-6-6-2.3 2.3a2.4 2.4 0 0 0 0 3.4Z",
    "M7.5 13.5 10 11",
    "M10.5 16.5 13 14",
    "m12 6 6 6 2.3-2.3a2.4 2.4 0 0 0 0-3.4l-2.6-2.6a2.4 2.4 0 0 0-3.4 0Z",
  ],
  wifi: ["M12 20h.01", "M2 8.82a15 15 0 0 1 20 0", "M5 12.859a10 10 0 0 1 14 0", "M8.5 16.429a5 5 0 0 1 7 0"],
  signal: ["M2 20h.01", "M7 20v-4", "M12 20v-8", "M17 20V8", "M22 4v16"],
  plane: [
    "M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z",
  ],
} as const;

export type IconName = keyof typeof PATHS;

interface IconProps {
  name: IconName;
  size: number;
  color: string;
  strokeWidth?: number;
}

export const Icon = ({ name, size, color, strokeWidth = 2 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    {PATHS[name].map((d) => (
      <Path key={d} d={d} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    ))}
  </Svg>
);

// 브랜드 그라데이션 원 + 흰색 아이콘 (.pen "오프라인 · 라이트/다크" 히어로)
export const GradientIcon = ({ name, size }: { name: IconName; size: number }) => (
  <Svg width={size} height={size} viewBox="0 0 96 96" fill="none">
    <Defs>
      <LinearGradient id="brand" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor="#C876DC" />
        <Stop offset="1" stopColor="#FF9F87" />
      </LinearGradient>
    </Defs>
    <Circle cx="48" cy="48" r="48" fill="url(#brand)" />
    <G transform="translate(28 28) scale(1.6667)">
      {PATHS[name].map((d) => (
        <Path key={d} d={d} stroke="#FFFFFF" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </G>
  </Svg>
);

import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { GradientIcon, Icon, type IconName } from "./icons";

// 웹 디자인 토큰(globals.css)과 같은 값 — .pen "오프라인 · 라이트/다크" 기준
const THEMES = {
  light: {
    page: "#FFFFFF",
    surface: "#FFFFFF",
    muted: "#F5F5F5",
    border: "#EEEEEE",
    textPrimary: "#0A0A0A",
    textSecondary: "#6B7280",
    textTertiary: "#A0A0A0",
    outlineLabel: "#A94FC0",
  },
  dark: {
    page: "#1B1B1F",
    surface: "#1E1E21",
    muted: "#26262A",
    border: "#2E2E33",
    textPrimary: "#F4F4F5",
    textSecondary: "#A1A1AA",
    textTertiary: "#7A7A83",
    outlineLabel: "#C876DC",
  },
} as const;

const PRIMARY = "#DB97E9";

const TIPS: { label: string; icon: IconName }[] = [
  { label: "Wi-Fi", icon: "wifi" },
  { label: "데이터", icon: "signal" },
  { label: "비행기 모드", icon: "plane" },
];

interface OfflineScreenProps {
  onRetry: () => void;
  onGoHome: () => void;
  isDark?: boolean;
}

const OfflineScreen = ({ onRetry, onGoHome, isDark = false }: OfflineScreenProps) => {
  const c = isDark ? THEMES.dark : THEMES.light;

  return (
    <View style={[styles.container, { backgroundColor: c.page }]}>
      <GradientIcon name="wifi-off" size={96} />

      <Text style={[styles.title, { color: c.textPrimary }]}>오프라인이에요</Text>
      <Text style={[styles.description, { color: c.textSecondary }]}>
        인터넷 연결을 확인한 뒤 다시 시도해 주세요.
      </Text>

      <View style={[styles.statusChip, { backgroundColor: c.muted }]}>
        <Icon name="unplug" size={14} color={c.textTertiary} />
        <Text style={[styles.statusText, { color: c.textTertiary }]}>네트워크에 연결되어 있지 않아요</Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.primaryButton} onPress={onRetry} activeOpacity={0.8}>
          <Text style={styles.primaryLabel}>다시 시도</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.outlineButton, { backgroundColor: c.surface }]}
          onPress={onGoHome}
          activeOpacity={0.8}
        >
          <Text style={[styles.outlineLabel, { color: c.outlineLabel }]}>홈으로 이동</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.divider}>
        <View style={[styles.line, { backgroundColor: c.border }]} />
        <Text style={[styles.dividerLabel, { color: c.textTertiary }]}>이럴 때 확인해 보세요</Text>
        <View style={[styles.line, { backgroundColor: c.border }]} />
      </View>

      <View style={styles.tips}>
        {TIPS.map(({ label, icon }) => (
          <View key={label} style={[styles.tipChip, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Icon name={icon} size={14} color={c.textSecondary} />
            <Text style={[styles.tipLabel, { color: c.textSecondary }]}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  title: {
    marginTop: 20,
    fontSize: 22,
    fontWeight: "700",
  },
  description: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
  statusChip: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 13,
  },
  actions: {
    marginTop: 28,
    alignSelf: "stretch",
    gap: 10,
  },
  primaryButton: {
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: PRIMARY,
  },
  primaryLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  outlineButton: {
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: PRIMARY,
  },
  outlineLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  divider: {
    marginTop: 32,
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  line: {
    flex: 1,
    height: 1,
  },
  dividerLabel: {
    fontSize: 12,
  },
  tips: {
    marginTop: 16,
    flexDirection: "row",
    gap: 8,
  },
  tipChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
  },
  tipLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
});

export default OfflineScreen;

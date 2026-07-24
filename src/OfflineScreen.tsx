import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface OfflineScreenProps {
  onRetry: () => void;
}

const OfflineScreen = ({ onRetry }: OfflineScreenProps) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>인터넷 연결이 없습니다</Text>
      <Text style={styles.description}>네트워크 상태를 확인한 뒤 다시 시도해 주세요.</Text>
      <TouchableOpacity style={styles.button} onPress={onRetry} activeOpacity={0.8}>
        <Text style={styles.buttonText}>다시 시도</Text>
      </TouchableOpacity>
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
    backgroundColor: "#ffffff",
    paddingHorizontal: 24,
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111111",
  },
  description: {
    fontSize: 14,
    color: "#666666",
    textAlign: "center",
  },
  button: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "#111111",
  },
  buttonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ffffff",
  },
});

export default OfflineScreen;

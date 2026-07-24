import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import WebViewScreen from "./src/WebViewScreen";

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <WebViewScreen />
    </SafeAreaProvider>
  );
}

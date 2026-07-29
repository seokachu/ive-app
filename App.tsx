import { SafeAreaProvider } from "react-native-safe-area-context";
import WebViewScreen from "./src/WebViewScreen";

//StatusBar는 웹 테마에 따라 동적으로 바뀌어야 하므로 WebViewScreen에서 렌더링한다
export default function App() {
  return (
    <SafeAreaProvider>
      <WebViewScreen />
    </SafeAreaProvider>
  );
}

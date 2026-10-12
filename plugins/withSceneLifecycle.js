// iOS 27 은 Scene 생명주기를 쓰지 않는 앱을 실행 직후 종료시킨다(UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption).
// Expo SDK 57 은 ExpoAppSceneDelegate 를 제공하지만 prebuild 템플릿의 AppDelegate 가 아직 옛 방식이라 여기서 바꾼다.
//   - Info.plist: 씬 매니페스트에 EXExpoAppSceneDelegate 지정 → 창 생성 · RN 시작은 씬 델리게이트가 맡는다
//   - AppDelegate: ExpoReactNativeFactoryProvider 채택, didFinishLaunching 에서 창 생성 · RN 시작 제거
// 템플릿이 Scene 을 직접 지원하게 되면(패턴이 안 맞으면) 이 플러그인은 아무것도 바꾸지 않고 경고만 남긴다.
const { withAppDelegate, withInfoPlist } = require("expo/config-plugins");

const withSceneLifecycle = (config) => {
  config = withInfoPlist(config, (cfg) => {
    cfg.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: "Default Configuration",
            UISceneDelegateClassName: "EXExpoAppSceneDelegate",
          },
        ],
      },
    };
    return cfg;
  });

  return withAppDelegate(config, (cfg) => {
    let src = cfg.modResults.contents;
    if (src.includes("ExpoReactNativeFactoryProvider")) return cfg;

    const startBlock = /#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\n\s*factory\.startReactNative\([\s\S]*?\)\n#endif\n/;
    if (!/class AppDelegate: ExpoAppDelegate \{/.test(src) || !startBlock.test(src)) {
      console.warn("[withSceneLifecycle] AppDelegate 템플릿이 예상과 달라 건너뜁니다 — iOS 27 Scene 대응을 확인하세요");
      return cfg;
    }
    src = src
      .replace("class AppDelegate: ExpoAppDelegate {", "class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {")
      .replace(startBlock, "    // 창 생성과 React Native 시작은 씬 델리게이트(ExpoAppSceneDelegate)가 한다 — iOS 27 Scene 생명주기\n");
    cfg.modResults.contents = src;
    return cfg;
  });
};

module.exports = withSceneLifecycle;

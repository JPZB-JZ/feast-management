# 斌选 Android APK 构建指南

## 环境准备

### 1. 安装 Node.js
- 下载地址：https://nodejs.org/ （推荐 LTS 版本）
- 安装后验证：`node -v` 和 `npm -v`

### 2. 安装 Android Studio
- 下载地址：https://developer.android.com/studio
- 安装时勾选：
  - Android SDK
  - Android SDK Platform
  - Android Virtual Device (可选，用于模拟器测试)

### 3. 配置环境变量
确保以下环境变量已设置：
- `ANDROID_HOME` 指向 Android SDK 目录
- `JAVA_HOME` 指向 JDK 目录
- Path 中包含 `%ANDROID_HOME%\platform-tools`

## 构建步骤

### 第一步：安装依赖
在项目目录下打开终端，执行：

```bash
cd d:\TRAE\feast_management_html
npm install
```

### 第二步：添加 Android 平台
```bash
npx cap add android
```

### 第三步：同步代码到 Android 项目
每次修改网页代码后都需要执行：
```bash
npx cap sync
```

### 第四步：打开 Android Studio
```bash
npx cap open android
```

### 第五步：构建 APK
在 Android Studio 中：
1. 等待 Gradle 同步完成
2. 点击菜单栏 **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**
3. 构建完成后，APK 文件位于：`android\app\build\outputs\apk\debug\app-debug.apk`

## 安装到平板

### 方法一：USB 调试安装
1. 在平板开启「开发者选项」和「USB 调试」
2. 用 USB 线连接电脑
3. 在 Android Studio 点击运行按钮，或执行：
   ```bash
   adb install android/app/build/outputs/apk/debug/app-debug.apk
   ```

### 方法二：传输安装
1. 将 `app-debug.apk` 复制到平板
2. 在平板文件管理器中点击安装
3. 可能需要允许「安装未知来源应用」

## 常见问题

### 1. Gradle 下载慢
修改 `android\gradle\wrapper\gradle-wrapper.properties`：
```properties
distributionUrl=https\://mirrors.cloud.tencent.com/gradle/gradle-8.0-bin.zip
```

### 2. 构建失败提示 SDK 版本
在 `android\app\build.gradle` 中检查：
```gradle
compileSdkVersion 33
targetSdkVersion 33
```

### 3. 图片上传在 APP 中不工作
确保在 `android\app\src\main\AndroidManifest.xml` 中已添加权限：
```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.CAMERA" />
```

## 发布正式版（可选）

如需生成正式签名的 APK：

1. 生成签名密钥：
```bash
keytool -genkey -v -keystore binxuan.keystore -alias binxuan -keyalg RSA -keysize 2048 -validity 10000
```

2. 在 `capacitor.config.json` 中配置签名：
```json
"android": {
  "buildOptions": {
    "keystorePath": "binxuan.keystore",
    "keystoreAlias": "binxuan",
    "keystorePassword": "你的密码",
    "keystoreKeyPassword": "你的密码"
  }
}
```

3. 构建正式版：
```bash
cd android
./gradlew assembleRelease
```

## 项目结构说明

```
feast_management_html/
├── android/              # Capacitor 生成的 Android 项目
├── css/                  # 样式文件
├── js/                   # JavaScript 文件
├── index.html            # 主页面
├── package.json          # Node.js 依赖配置
├── capacitor.config.json # Capacitor 配置
└── BUILD_APK.md          # 本文件
```

## 后续更新代码

如果修改了网页代码，只需执行：
```bash
npx cap sync
npx cap open android
```
然后在 Android Studio 中重新构建 APK。

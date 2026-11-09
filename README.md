# 班务通 · Class Desk

一款**本地优先**的班级管理工具，同一套代码支持 **Windows 桌面端、Android 手机、Android 平板和浏览器 PWA**。主要用于课堂点名、学生备注、任务完成情况收集与缺交清单导出。

![班务通桌面工作台](docs/screenshots/dashboard-desktop.png)

## 核心功能

### 课堂点名
- 按日期创建或继续点名场次。
- 每名学生可快速标记：出勤、迟到、请假、缺勤、未点名。
- 支持手动备注和可配置的快捷备注，例如“已联系”“病假”“迟到 10 分钟”。
- “全部出勤”、重置点名、随机点名、完成归档。
- 点名记录自动保存在本机，并可按场次导出 CSV。

### 班级名单
- 多班级独立管理。
- 添加、编辑、删除学生。
- 搜索姓名、学号、宿舍，按性别筛选。
- CSV 批量导入和名单导出，兼容 Excel 中文编码。

### 任务收集
- 创建任务、设置说明和截止日期，自动为班级学生生成提交清单。
- 每名学生可标记为已完成、待检查、未完成。
- 支持上传照片/聊天截图，也支持在电脑端直接 `Ctrl + V` 粘贴剪贴板截图。
- 图片自动压缩，保存在本机 IndexedDB。
- “未完成”筛选可清楚查看谁还没有提交。
- 导出 CSV 提交清单；导出 HTML 图文报告，图片会内嵌进报告文件。

### 管理与其他
- 工作台统计今日出勤、异常情况、任务待收数量。
- 最近点名与历史记录回看。
- 完整 JSON 备份，包含名单、记录、任务和图片附件。
- 响应式界面：Windows 三栏工作台、平板双栏、手机底部导航。

## 界面预览

| 点名 | 任务收集 |
| --- | --- |
| ![点名界面](docs/screenshots/attendance-desktop.png) | ![任务收集](docs/screenshots/tasks-desktop.png) |

| 手机工作台 | 手机任务收集 |
| --- | --- |
| ![手机工作台](docs/screenshots/dashboard-mobile.png) | ![手机任务](docs/screenshots/tasks-mobile.png) |

## 技术栈

- **React 19 + TypeScript + Vite**：共享前端界面和业务逻辑。
- **Zustand**：带持久化的本地状态管理。
- **IndexedDB**：保存图片和聊天截图。
- **Electron + electron-builder**：Windows 桌面安装包。
- **Capacitor 8**：Android 手机/平板原生外壳。
- **Service Worker + Web Manifest**：浏览器 PWA 安装与离线加载。

## 本地开发

环境要求：

- Node.js 22 或 24
- npm 10+
- Windows 桌面打包需要 Windows
- Android 打包需要 JDK 21、Android SDK Platform 36 和 Build Tools 36

```bash
npm ci
npm run dev
```

开发地址为 `http://127.0.0.1:5173/`。

## 构建

### Windows

```bash
npm run build:desktop
```

输出：

```text
release/Banwutong-Setup-1.0.0.exe
```

### Android

先同步最新 Web 资源：

```bash
npm run android:sync
```

构建调试 APK：

```bash
npm run android:apk
```

输出：

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

也可以使用 Android Studio：

```bash
npm run android:open
```

### 浏览器 / PWA

```bash
npm run build:web
npm run preview
```

将 `dist/` 部署到任意静态站点即可作为 PWA 安装。

## 下载安装包

前往 [GitHub Releases](https://github.com/CSN8079/banwutong-class-desk/releases/latest) 下载：

- `Banwutong-Setup-1.0.0.exe`：Windows x64 安装程序
- `Banwutong-Android-1.0.0-debug.apk`：Android 调试签名 APK，可直接侧载

> 当前安装包未购买代码签名证书。Windows SmartScreen 或 Android“未知来源安装”可能提示风险，这是未签名/自签名应用的正常提示。

## 数据与隐私

- 应用无需注册账号，不连接业务服务器。
- 学生名单、点名记录、备注和图片都保存在当前设备。
- 不同设备的数据不会自动同步；请通过“设置与数据 → 导出完整备份”迁移。
- HTML 图文报告会把相关图片内嵌到导出文件，分享前请确认接收方可信。
- 卸载浏览器/应用或清理应用数据前，请先导出备份。

## 测试与质量检查

```bash
npm run lint
npm test
npm run build
```

端到端渲染与响应式检查：

```bash
npm run dev
# 另开终端
npm run test:e2e
```

覆盖桌面、390px 手机和 768px 平板布局，并验证学生新增、点名备注、截图上传、HTML 报告下载和横向溢出检查。

## 项目结构

```text
src/
  components/       通用界面与布局
  data/             演示数据和日期工具
  lib/              CSV、导出、图片存储、文件保存
  pages/            工作台、名单、点名、任务、记录、设置
  store/            Zustand 业务状态
electron/           Electron 主进程与安全 preload
android/            Capacitor 生成的 Android 原生工程
public/             PWA 清单、Service Worker、图标
scripts/            Playwright 端到端 QA
docs/screenshots/   README 截图
resources/          Android/桌面图标源文件
```

## 路线图

- 云同步/多教师协作（需要额外后端和权限设计）
- 导入 Excel `.xlsx` 原生文件
- 更丰富的班级管理组件，如值日、座位表、活动报名
- Android 正式签名与应用商店发布

## License

MIT

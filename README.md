# ✦ 灵感便签

随时把闪过的念头记下来，回头再把同类的收成一组。

Electron + React，数据只存在本机，不联网。

---

## 两件事

**记** —— 在任何软件里按 `Ctrl + Alt + N`，屏幕上方弹出一个输入框，打字、回车，框自己消失。
不用切窗口，不用找文件，灵感的半衰期撑不过这些步骤。

**归档** —— 收件箱里随手选中几条同类的，点「归档到…」，搜一个已有分组或者直接输名字新建。
也可以把卡片直接拖到左边的分组上。

分组是**归属**（一条灵感只属于一个分组），`#标签` 是**视角**（可以横切多个分组）。
两者不冲突，正文里写 `#标签` 会自动识别，侧栏点标签就能跨分组筛。

---

## 跑起来

```bash
npm install          # 首次会提示批准 electron / esbuild / koffi 的安装脚本
npm start            # 构建 + 启动
npm run dev          # 开发模式，改代码热更新
npm test             # 数据层测试
npm run dist         # 打包成 Windows 安装包，产物在 release/
```

## 快捷键

| 键 | 作用 |
| --- | --- |
| `Ctrl + Alt + N` | 全局速记（可在设置里改） |
| `Ctrl + N` | 光标跳到输入框 |
| `Ctrl + F` | 搜索 |
| `Enter` / `Shift + Enter` | 保存 / 换行 |
| `Ctrl + A` | 全选当前列表 |
| `Ctrl + G` | 把选中的灵感归档 |
| `Shift + 点击` | 连续选中一段 |
| `Delete` | 移到回收站 |
| `Esc` | 取消选择 / 关闭速记框 |

双击卡片正文可以直接改；双击侧栏分组名可以重命名。

---

## 毛玻璃是怎么做的

这块值得单独说一句，因为 Windows 10 上有个坑。

Electron 的 `transparent: true` 窗口在 Win10 上**只是透明，不会模糊**——
CSS 的 `backdrop-filter` 采样不到桌面，结果就是壁纸纹理清清楚楚糊在文字上，没法看。

所以分两档（`electron/acrylic.js`）：

| 环境 | 做法 | 效果 |
| --- | --- | --- |
| Win11 22H2+ | 官方 `win.setBackgroundMaterial('acrylic')` | 系统级 acrylic |
| 其它（含 Win10） | 页面自己加厚半透明层 | 半透明，不模糊，但字清楚 |

**Win10 上没有真模糊，这是故意的——拿模糊换了圆角。**

Win10 确实能用未公开的 `SetWindowCompositionAttribute` 开出真模糊
（`ACCENT_ENABLE_ACRYLICBLURBEHIND` 或 `ACCENT_ENABLE_BLURBEHIND`），
但**只要开着它，窗口的四个角就必然是方的**，而且绕不过去：

- 系统模糊是 DWM 按**窗口矩形**画的，CSS 的 `border-radius` 只管内容，盖不住它；
- 想用 GDI 的 `CreateRoundRectRgn` + `SetWindowRgn` 把整扇窗裁圆也没用 —— 只要开着模糊，
  DWM 合成时就**不认这个区域**。区域系统照收，`GetWindowRgn` 也读得回来，画出来还是方角。
  所以「读得到区域」不能当作圆角生效的证据，**必须看截图，而且要放在白底上**：
  深色的方角压在深色背景上根本看不出来。
- 退一步，只在不透明窗口上硬裁，角是圆了，但 GDI 的区域是二值裁切、没有抗锯齿，
  弧线是肉眼可见的台阶。

最后选的是：**窗口恒 `transparent: true`，圆角全部交给 CSS**。透明窗口 DWM 按逐像素 alpha
合成，`border-radius` 画出来的弧本身就是抗锯齿的。「关掉毛玻璃」不是把窗口变成不透明，
而是让页面把背景铺到完全不透明（`--glass-a` 给 1），外观一样，圆角还留着。
代价是没有系统阴影 —— 开着毛玻璃时本来也没有。

`round-probe.js` 是当时做的四组对照（透明/不透明 × 开模糊/不开模糊），要动这块先跑一遍。

还有个独立的坑：调背景浓度时**主进程不要去碰窗口**。以前那里会去刷系统模糊的底色，
等于把方形的模糊层又打开一次，圆角立刻变回方角。浓度整个交给渲染进程改 CSS 变量。

设置里能关掉毛玻璃，也能调背景浓度。

---

## 数据

单个 JSON 文件，原子写入（先写 `.tmp` 再 rename，断电不会写出半个文件）：

```
%APPDATA%\灵感便签\notes.json
```

设置里「打开位置」直接跳过去。想备份就复制这个文件；想换台机器就拷过去。
文件损坏会自动留一份 `.bak` 再从空库启动，不会让你什么都打不开。

导出支持 Markdown（按分组分章节）和 JSON。

---

## 目录

```
electron/
  main.js       窗口 / 托盘 / 全局快捷键 / IPC
  store.js      数据层，原子写入
  acrylic.js    Windows 毛玻璃，带降级
  preload.js    contextBridge 暴露的 API
src/
  App.jsx       主窗口
  QuickCapture.jsx  速记窗口
  components/   界面组件
scripts/
  make-icons.js 手写 PNG 编码器生成图标，不依赖图形库
  test-store.js 数据层测试
  seed-demo.js  塞示例数据（会覆盖现有数据，慎用）
```

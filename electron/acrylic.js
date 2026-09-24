'use strict'

/**
 * 窗口毛玻璃。
 *
 * Win11 22H2+ 有官方 API：win.setBackgroundMaterial('acrylic')，系统级 acrylic。
 * Win10 没有这个 API，这里**不做**系统模糊，页面自己铺一层厚一点的半透明底。
 *
 * Win10 为什么不做：曾经用未公开的 SetWindowCompositionAttribute 开
 * ACCENT_ENABLE_ACRYLICBLURBEHIND / ACCENT_ENABLE_BLURBEHIND 拿到过真模糊，
 * 但**那层模糊会让窗口的四个角变成方的**，而且绕不过去：
 *
 *   - 系统模糊是 DWM 按窗口矩形画的，CSS 的 border-radius 只管内容，盖不住它；
 *   - 想用 GDI 的 SetWindowRgn 把整扇窗裁成圆角也没用 —— 只要开着模糊，DWM 合成
 *     时就不认这个区域。区域系统照收，GetWindowRgn 也读得回来，画出来还是方角。
 *     （所以「读得到区域」不能当成圆角生效的证据，必须看截图，最好是白底。）
 *   - 退一步只在不透明窗口上硬裁，角是圆了，但 GDI 的区域是二值裁切、没有抗锯齿，
 *     弧线是肉眼可见的台阶。
 *
 * 结论：Win10 上圆角和系统模糊二选一，这里选圆角 —— 窗口恒 transparent，
 * 圆角由 CSS 画（抗锯齿），背景浓度由 --glass-a 控制。
 * round-probe.js 是当时做的对照实验（a/b/c/d 四组），要动这块先跑一遍。
 */

/** Win11 的内核版本号仍是 10.0.x，靠 build >= 22000 区分 */
function isWin11() {
  const build = Number(require('os').release().split('.')[2] || 0)
  return build >= 22000
}

/**
 * 给窗口开毛玻璃。
 * @returns 'native-win11' | 'none'
 */
function enableBlur(win) {
  if (process.platform !== 'win32' || !win || win.isDestroyed()) return 'none'

  if (isWin11()) {
    try {
      win.setBackgroundMaterial('acrylic')
      return 'native-win11'
    } catch { /* 万一这个版本没有，就当没有 */ }
  }

  // Win10：不开系统模糊，页面自己加厚（App.jsx 里按 blurMode 算 --glass-a）
  return 'none'
}

module.exports = {
  enableBlur,
  isWin11,
}

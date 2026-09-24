// 隔离实验：圆角区域裁剪 vs 透明窗口 / 系统模糊，哪种组合能活下来又有效果
// 用法: electron round-probe.js <a|b|c>
const { app, BrowserWindow } = require('electron')
const koffi = require('koffi')

const MODE = (process.argv[2] || 'a').toLowerCase()

const user32 = koffi.load('user32.dll')
const gdi32 = koffi.load('gdi32.dll')
koffi.struct('WINCOMPATTRDATA', { Attribute: 'int', pData: 'void *', cbData: 'size_t' })
const SetWindowCompositionAttribute = user32.func(
  'int __stdcall SetWindowCompositionAttribute(uintptr_t hwnd, WINCOMPATTRDATA *data)',
)
const CreateRoundRectRgn = gdi32.func('uintptr_t __stdcall CreateRoundRectRgn(int,int,int,int,int,int)')
const SetWindowRgn = user32.func('int __stdcall SetWindowRgn(uintptr_t hwnd, uintptr_t hrgn, int redraw)')

const hwndOf = (w) => {
  const h = w.getNativeWindowHandle()
  return h.length === 8 ? h.readBigUInt64LE(0) : BigInt(h.readUInt32LE(0))
}

function accent(win, state, flags = 2) {
  const buf = Buffer.alloc(16)
  buf.writeInt32LE(state, 0)
  buf.writeInt32LE(flags, 4)
  buf.writeUInt32LE(0x99181820, 8)
  buf.writeInt32LE(0, 12)
  return SetWindowCompositionAttribute(hwndOf(win), { Attribute: 19, pData: buf, cbData: 16 })
}

function round(win, radius) {
  const [w, h] = win.getSize()
  const rgn = CreateRoundRectRgn(0, 0, w + 1, h + 1, radius * 2, radius * 2)
  return SetWindowRgn(hwndOf(win), rgn, 1)
}

const CONFIG = {
  a: { transparent: true, accent: 4, round: true, note: '透明 + acrylic 模糊 + 裁圆角（当前实现）' },
  b: { transparent: true, accent: 0, round: true, note: '透明 + 裁圆角，不开模糊' },
  c: { transparent: false, accent: 4, round: true, note: '不透明 + acrylic 模糊 + 裁圆角' },
  // acrylic(4) 画的那层模糊不认窗口区域，四角会露出方的。轻模糊(3) 认不认？
  d: { transparent: true, accent: 3, round: true, note: '透明 + 轻模糊 BLUR_BEHIND + 裁圆角' },
}

app.whenReady().then(() => {
  const c = CONFIG[MODE]
  console.log('MODE', MODE, '-', c.note)

  const win = new BrowserWindow({
    x: 1500, y: 200, width: 420, height: 320,
    frame: false,
    transparent: c.transparent,
    backgroundColor: c.transparent ? '#00000000' : '#202030',
    hasShadow: false,
    show: false,
  })

  win.loadURL('data:text/html,' + encodeURIComponent(`
    <body style="margin:0;background:rgba(20,20,32,.20);font:15px 'Segoe UI';color:#fff;
                 height:100vh;display:flex;align-items:center;justify-content:center;
                 border-radius:16px;border:1px solid rgba(255,255,255,.35)">
      <b>MODE ${MODE.toUpperCase()}</b>
    </body>`))

  win.once('ready-to-show', () => {
    win.show()
    if (c.accent) console.log('  accent ->', accent(win, c.accent))
    if (c.round) console.log('  setwindowrgn ->', round(win, 16))
    console.log('  survived the calls')
  })

  // 活过 18 秒才算没崩
  let t = 0
  const tick = setInterval(() => {
    t += 3
    console.log('  alive', t + 's')
    if (t >= 18) { clearInterval(tick); app.exit(0) }
  }, 3000)
})

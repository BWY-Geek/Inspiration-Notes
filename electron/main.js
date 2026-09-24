'use strict'

const {
  app, BrowserWindow, Tray, Menu, globalShortcut,
  ipcMain, nativeImage, screen, shell, dialog, clipboard,
} = require('electron')
const path = require('path')
const fs = require('fs')

const { Store } = require('./store')
const { enableBlur } = require('./acrylic')

const isDev = process.env.NODE_ENV === 'development'
const DEV_URL = 'http://localhost:5173'

// 同一时间只允许一个实例，第二次启动就唤起已有窗口
if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

let store = null
let mainWin = null
let quickWin = null
let tray = null
app.isQuitting = false

const asset = (f) => path.join(__dirname, '..', 'build', f)

function pageUrl(win, page) {
  if (isDev) return win.loadURL(`${DEV_URL}/${page}`)
  return win.loadFile(path.join(__dirname, '..', 'dist', page))
}

// ---------------------------------------------------------------- 主窗口

// 圆角和背景浓度都在 CSS 里（styles.css 的 --radius / --glass-a），主进程不掺和。

/**
 * 系统模糊开成什么样，要告诉渲染进程。
 * 系统真的帮我们模糊了（只有 Win11 会），页面里就只叠一层很淡的膜；
 * 没模糊成（Win10 就是这样），背景浓度全看设置里那根滑杆。
 */
let blurMode = 'none'

function createMainWindow() {
  mainWin = new BrowserWindow({
    width: 1080,
    height: 700,
    minWidth: 760,
    minHeight: 480,
    show: false,
    frame: false,
    // 窗口永远是透明的 —— 这是为了圆角。
    // 透明窗口 DWM 按逐像素 alpha 合成，CSS 的 border-radius 画出来的弧是抗锯齿的；
    // 一旦让窗口本身不透明，CSS 就管不到窗口的角，只能退回 GDI 硬裁，弧变成台阶。
    // 想要纯色背景不靠这里，靠设置里把背景不透明度拉满（--glass-a 给 1），
    // 看上去一样，圆角还留着。代价是没有系统阴影。
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    title: '灵感便签',
    icon: asset('icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  })

  blurMode = enableBlur(mainWin)

  pageUrl(mainWin, 'index.html')

  mainWin.once('ready-to-show', () => {
    mainWin.show()
    // 有些机器上窗口真正显示出来后才吃这个属性，show 完再补一次
    blurMode = enableBlur(mainWin)
    // 圆角全部交给 CSS，主进程不再 SetWindowRgn：
    // GDI 的区域是二值硬裁、没有抗锯齿，弧会变成肉眼可见的台阶；窗口既然恒透明，
    // DWM 就按逐像素 alpha 合成，border-radius 画出来的弧本身就是平滑的。
    console.log('[glass] mode=%s，圆角交给 CSS', blurMode)
    if (store.data.settings.alwaysOnTop) mainWin.setAlwaysOnTop(true)
  })

  // 点 ✕ 收到托盘，不真的退出——工具类应用常驻才顺手
  mainWin.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault()
      mainWin.hide()
    }
  })

  mainWin.on('closed', () => { mainWin = null })

  const notifyMaximize = () => mainWin?.webContents.send('win:maximized', mainWin.isMaximized())
  mainWin.on('maximize', notifyMaximize)
  mainWin.on('unmaximize', notifyMaximize)

  // 外部链接交给系统浏览器
  mainWin.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

function showMainWindow() {
  if (!mainWin) createMainWindow()
  if (mainWin.isMinimized()) mainWin.restore()
  mainWin.show()
  mainWin.focus()
}

// ---------------------------------------------------------------- 速记窗口

const QUICK_WIDTH = 620
const QUICK_MIN_HEIGHT = 132

let quickShownAt = 0

function createQuickWindow() {
  quickWin = new BrowserWindow({
    width: QUICK_WIDTH,
    height: QUICK_MIN_HEIGHT,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    fullscreenable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  })

  // screen-saver 级别才能盖住全屏应用
  quickWin.setAlwaysOnTop(true, 'screen-saver')
  quickWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  enableBlur(quickWin)   // 速记窗口恒透明，圆角由 quick.css 画

  pageUrl(quickWin, 'quick.html')

  quickWin.on('blur', () => {
    // 刚弹出来的一瞬间不理会失焦：Windows 的前台窗口锁有时会让焦点弹回去，
    // 不挡一下的话窗口会刚露头就自己关掉，看起来就像快捷键没反应
    if (Date.now() - quickShownAt < 400) return
    if (!quickWin.webContents.isDevToolsOpened()) hideQuickWindow()
  })

  quickWin.on('closed', () => { quickWin = null })
}

/** 放在鼠标所在那块屏幕的上方三分之一处 —— 视线最自然的位置 */
function positionQuickWindow() {
  const cursor = screen.getCursorScreenPoint()
  const { workArea } = screen.getDisplayNearestPoint(cursor)
  const [w, h] = quickWin.getSize()
  quickWin.setPosition(
    Math.round(workArea.x + (workArea.width - w) / 2),
    Math.round(workArea.y + workArea.height * 0.22),
  )
}

function showQuickWindow() {
  if (!quickWin) createQuickWindow()
  quickShownAt = Date.now()
  quickWin.setSize(QUICK_WIDTH, QUICK_MIN_HEIGHT)
  positionQuickWindow()
  quickWin.show()
  quickWin.focus()
  enableBlur(quickWin)
  quickWin.webContents.send('quick:opened')
}

function hideQuickWindow() {
  if (!quickWin) return
  quickWin.hide()
  quickWin.webContents.send('quick:closed')
}

function toggleQuickWindow() {
  if (quickWin && quickWin.isVisible()) hideQuickWindow()
  else showQuickWindow()
}

// ---------------------------------------------------------------- 托盘

function buildTray() {
  const icon = nativeImage.createFromPath(asset('tray.png'))
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon)
  tray.setToolTip('灵感便签')
  refreshTrayMenu()
  tray.on('click', showMainWindow)
  tray.on('double-click', showMainWindow)
}

function refreshTrayMenu() {
  if (!tray) return
  const s = store.data.settings
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: `快速记录  (${prettyHotkey(s.hotkey)})`, click: showQuickWindow },
    { label: '打开主窗口', click: showMainWindow },
    { type: 'separator' },
    {
      label: '开机自启',
      type: 'checkbox',
      checked: !!s.autoLaunch,
      click: (item) => applyAutoLaunch(item.checked),
    },
    { label: '打开数据目录', click: () => shell.showItemInFolder(store.file) },
    { type: 'separator' },
    { label: '退出', click: () => { app.isQuitting = true; app.quit() } },
  ]))
}

function prettyHotkey(hk) {
  return String(hk || '')
    .replace('CommandOrControl', 'Ctrl')
    .replace('CmdOrCtrl', 'Ctrl')
    .split('+')
    .join(' + ')
}

// ---------------------------------------------------------------- 快捷键 / 自启

let hotkeyOk = true

function applyHotkey(accelerator) {
  globalShortcut.unregisterAll()
  let ok = false
  try {
    ok = globalShortcut.register(accelerator, toggleQuickWindow)
  } catch {
    ok = false
  }
  if (!ok && accelerator !== 'CommandOrControl+Alt+N') {
    // 被别的软件占用了就退回默认键，起码还能用
    try { ok = globalShortcut.register('CommandOrControl+Alt+N', toggleQuickWindow) } catch {}
    if (ok) store.updateSettings({ hotkey: 'CommandOrControl+Alt+N' })
  }
  hotkeyOk = ok
  refreshTrayMenu()
  return ok
}

function applyAutoLaunch(enabled) {
  store.updateSettings({ autoLaunch: !!enabled })
  if (!app.isPackaged) {
    // 开发模式下设登录项会把 electron.exe 写进注册表，没意义
    refreshTrayMenu()
    broadcast()
    return
  }
  app.setLoginItemSettings({
    openAtLogin: !!enabled,
    path: process.execPath,
    args: ['--hidden'],
  })
  refreshTrayMenu()
  broadcast()
}

// ---------------------------------------------------------------- IPC

/** 任何一处改了数据，所有窗口都重新拉一遍 —— 简单且永远不会不同步 */
function broadcast() {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('db:changed')
  }
}

function registerIpc() {
  const mutate = (fn) => (_e, ...args) => {
    const result = fn(...args)
    broadcast()
    return result
  }

  ipcMain.handle('db:getAll', () => ({
    ...store.getAll(),
    runtime: { blurMode },
  }))

  ipcMain.handle('db:addNote', mutate((text, opts) => store.addNote(text, opts || {})))
  ipcMain.handle('db:updateNote', mutate((id, patch) => store.updateNote(id, patch)))
  ipcMain.handle('db:moveToGroup', mutate((ids, groupId) => store.moveToGroup(ids, groupId)))
  ipcMain.handle('db:trashNotes', mutate((ids) => store.trashNotes(ids)))
  ipcMain.handle('db:restoreNotes', mutate((ids) => store.restoreNotes(ids)))
  ipcMain.handle('db:purgeNotes', mutate((ids) => store.purgeNotes(ids)))
  ipcMain.handle('db:emptyTrash', mutate(() => store.emptyTrash()))

  ipcMain.handle('db:addGroup', mutate((name) => store.addGroup(name)))
  ipcMain.handle('db:updateGroup', mutate((id, patch) => store.updateGroup(id, patch)))
  ipcMain.handle('db:deleteGroup', mutate((id) => store.deleteGroup(id)))

  ipcMain.handle('db:updateSettings', (_e, patch) => {
    const before = { ...store.data.settings }
    const next = store.updateSettings(patch)
    if (patch.hotkey && patch.hotkey !== before.hotkey) applyHotkey(next.hotkey)
    if ('autoLaunch' in patch && patch.autoLaunch !== before.autoLaunch) applyAutoLaunch(next.autoLaunch)
    if ('alwaysOnTop' in patch) mainWin?.setAlwaysOnTop(!!patch.alwaysOnTop)
    // 背景浓度整个交给渲染进程调 CSS 变量，主进程不要碰窗口 ——
    // 以前这里会去刷系统模糊的底色，那等于把方形的模糊层又打开一次，圆角立刻变方角。
    broadcast()
    return store.data.settings
  })

  ipcMain.handle('app:dataPath', () => store.file)
  ipcMain.handle('app:revealData', () => shell.showItemInFolder(store.file))
  ipcMain.handle('app:copy', (_e, text) => clipboard.writeText(String(text ?? '')))

  ipcMain.handle('app:export', async (_e, { format, content, defaultName }) => {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWin, {
      title: '导出灵感',
      defaultPath: defaultName,
      filters: format === 'json'
        ? [{ name: 'JSON', extensions: ['json'] }]
        : [{ name: 'Markdown', extensions: ['md'] }],
    })
    if (canceled || !filePath) return null
    fs.writeFileSync(filePath, content, 'utf8')
    return filePath
  })

  ipcMain.handle('app:confirm', async (_e, { title, message, detail, confirmText }) => {
    const { response } = await dialog.showMessageBox(mainWin, {
      type: 'warning',
      buttons: [confirmText || '确定', '取消'],
      defaultId: 1,
      cancelId: 1,
      title: title || '确认',
      message: message || '',
      detail: detail || '',
      noLink: true,
    })
    return response === 0
  })

  // 窗口控制（无边框窗口自己画的标题栏要用）
  ipcMain.on('win:minimize', () => mainWin?.minimize())
  ipcMain.on('win:toggleMaximize', () => {
    if (!mainWin) return
    mainWin.isMaximized() ? mainWin.unmaximize() : mainWin.maximize()
  })
  ipcMain.on('win:hide', () => mainWin?.hide())
  ipcMain.on('win:isMaximized', (e) => { e.returnValue = !!mainWin?.isMaximized() })

  // 速记窗口
  ipcMain.on('quick:hide', hideQuickWindow)
  ipcMain.on('quick:resize', (_e, height) => {
    if (!quickWin) return
    const h = Math.max(QUICK_MIN_HEIGHT, Math.min(520, Math.round(height)))
    const [, cur] = quickWin.getSize()
    if (Math.abs(cur - h) > 1) quickWin.setSize(QUICK_WIDTH, h, false)
  })
  ipcMain.on('quick:openMain', () => { hideQuickWindow(); showMainWindow() })
}

// ---------------------------------------------------------------- 生命周期

app.on('second-instance', showMainWindow)

app.whenReady().then(() => {
  app.setAppUserModelId('com.spark.notes')

  store = new Store(path.join(app.getPath('userData'), 'notes.json'))

  registerIpc()
  buildTray()
  createQuickWindow()
  applyHotkey(store.data.settings.hotkey)

  // --hidden：开机自启时只驻留托盘，不弹窗打扰
  const startHidden = process.argv.includes('--hidden')
  if (!startHidden) createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
    else showMainWindow()
  })
})

// 常驻托盘，关窗不退出
app.on('window-all-closed', () => {})

app.on('before-quit', () => {
  app.isQuitting = true
  store?.flushNow()
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

import { useEffect, useState } from 'react'
import { buildMarkdown, cls, fmtDate } from '../lib/util'
import { IconX, IconExport, IconFolder } from './Icons'

function prettyHotkey(hk) {
  return String(hk || '').replace('CommandOrControl', 'Ctrl').split('+').join(' + ')
}

/** 把一次按键翻译成 Electron 的 accelerator 字符串 */
function toAccelerator(e) {
  const mods = []
  if (e.ctrlKey || e.metaKey) mods.push('CommandOrControl')
  if (e.altKey) mods.push('Alt')
  if (e.shiftKey) mods.push('Shift')

  let key = e.key
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(key)) return null
  if (key === ' ') key = 'Space'
  else if (key.length === 1) key = key.toUpperCase()
  else if (/^F\d{1,2}$/.test(key)) { /* F1..F12 原样 */ }
  else if (key === 'Escape' || key === 'Tab' || key === 'Backspace') return null

  // 全局快捷键至少得带一个修饰键，否则会抢走普通打字
  if (!mods.length) return null
  return [...mods, key].join('+')
}

export default function SettingsModal({ db, onClose, onSettings }) {
  const s = db.settings
  const [capturing, setCapturing] = useState(false)
  const [dataPath, setDataPath] = useState('')

  useEffect(() => { window.api.app.dataPath().then(setDataPath) }, [])

  useEffect(() => {
    if (!capturing) return
    const onKey = (e) => {
      e.preventDefault()
      if (e.key === 'Escape') { setCapturing(false); return }
      const acc = toAccelerator(e)
      if (acc) {
        onSettings({ hotkey: acc })
        setCapturing(false)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [capturing, onSettings])

  const exportMd = async () => {
    const content = buildMarkdown(db.notes, db.groups)
    const file = await window.api.app.exportFile({
      format: 'md',
      content,
      defaultName: `灵感便签-${fmtDate(Date.now())}.md`,
    })
    if (file) window.api.app.copy(file)
  }

  const exportJson = async () => {
    await window.api.app.exportFile({
      format: 'json',
      content: JSON.stringify({ notes: db.notes, groups: db.groups }, null, 2),
      defaultName: `灵感便签-${fmtDate(Date.now())}.json`,
    })
  }

  const liveNotes = db.notes.filter((n) => !n.deletedAt)

  return (
    <div className="modal-mask" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal glass-pane">
        <header className="modal-head">
          <h2>设置</h2>
          <button className="icon-btn" onClick={onClose}><IconX /></button>
        </header>

        <div className="modal-body">
          <section className="setting">
            <div className="setting-text">
              <b>全局快捷键</b>
              <span>在任何软件里按一下，就弹出速记框</span>
            </div>
            <button
              className={cls('hotkey', capturing && 'capturing')}
              onClick={() => setCapturing(true)}
            >
              {capturing ? '按下新的组合键…' : prettyHotkey(s.hotkey)}
            </button>
          </section>

          <section className="setting">
            <div className="setting-text">
              <b>背景不透明度</b>
              <span>{Math.round((s.glassOpacity ?? 0.72) * 100)}% — 越低越透，拉满就是纯色背景</span>
            </div>
            <input
              className="slider"
              type="range"
              min="0.3"
              max="1"
              step="0.02"
              value={s.glassOpacity ?? 0.72}
              onChange={(e) => onSettings({ glassOpacity: Number(e.target.value) })}
            />
          </section>

          <section className="setting">
            <div className="setting-text">
              <b>窗口置顶</b>
              <span>主窗口永远浮在其它窗口上面</span>
            </div>
            <Switch on={!!s.alwaysOnTop} onChange={(v) => onSettings({ alwaysOnTop: v })} />
          </section>

          <section className="setting">
            <div className="setting-text">
              <b>开机自启</b>
              <span>随 Windows 启动，静默驻留在托盘（仅安装版生效）</span>
            </div>
            <Switch on={!!s.autoLaunch} onChange={(v) => onSettings({ autoLaunch: v })} />
          </section>

          <hr />

          <section className="setting">
            <div className="setting-text">
              <b>导出</b>
              <span>{liveNotes.length} 条灵感 · {db.groups.length} 个分组</span>
            </div>
            <div className="row-btns">
              <button className="btn" onClick={exportMd}><IconExport width={14} height={14} /> Markdown</button>
              <button className="btn" onClick={exportJson}><IconExport width={14} height={14} /> JSON</button>
            </div>
          </section>

          <section className="setting">
            <div className="setting-text">
              <b>数据文件</b>
              <span className="mono path">{dataPath}</span>
            </div>
            <button className="btn" onClick={() => window.api.app.revealData()}>
              <IconFolder width={14} height={14} /> 打开位置
            </button>
          </section>

          <div className="shortcuts">
            <b>快捷键</b>
            <ul>
              <li><kbd>{prettyHotkey(s.hotkey)}</kbd> 全局速记</li>
              <li><kbd>Ctrl</kbd>+<kbd>N</kbd> 光标跳到输入框</li>
              <li><kbd>Ctrl</kbd>+<kbd>F</kbd> 搜索</li>
              <li><kbd>Enter</kbd> 保存 / <kbd>Shift</kbd>+<kbd>Enter</kbd> 换行</li>
              <li><kbd>Ctrl</kbd>+<kbd>G</kbd> 把选中的灵感归档</li>
              <li><kbd>Esc</kbd> 取消选择</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

function Switch({ on, onChange }) {
  return (
    <button className={cls('switch', on && 'on')} onClick={() => onChange(!on)} role="switch" aria-checked={on}>
      <span className="knob" />
    </button>
  )
}

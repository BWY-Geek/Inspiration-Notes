import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { IconSpark, IconCheck, IconFolder } from './components/Icons'

/**
 * 全局快捷键唤起的速记框：打字 → Enter → 存好 → 自动消失。
 * 不打断手头的事，是这个工具最该做好的一件事。
 */
export default function QuickCapture() {
  const [text, setText] = useState('')
  const [groups, setGroups] = useState([])
  const [groupId, setGroupId] = useState('')
  const [saved, setSaved] = useState(false)
  const areaRef = useRef(null)
  const rootRef = useRef(null)
  const hideTimer = useRef(null)

  const load = useCallback(async () => {
    const db = await window.api.db.getAll()
    setGroups(db.groups)
    const s = db.settings || {}

    // 和主窗口同一套：没有系统模糊时滑杆就是字面的背景不透明度，拉满即纯色
    const nativeBlur = !!db.runtime?.blurMode && db.runtime.blurMode !== 'none'
    const o = s.glassOpacity ?? 0.72
    document.documentElement.style.setProperty('--glass-a', nativeBlur ? 0.1 + o * 0.16 : o)
    document.documentElement.classList.toggle('native-blur', nativeBlur)
  }, [])

  useEffect(() => {
    load()
    return window.api.db.onChanged(load)
  }, [load])

  // 每次唤起都是一张白纸
  useEffect(() => window.api.quick.onOpened(() => {
    clearTimeout(hideTimer.current)
    setSaved(false)
    setText('')
    requestAnimationFrame(() => areaRef.current?.focus())
  }), [])

  useEffect(() => window.api.quick.onClosed(() => {
    clearTimeout(hideTimer.current)
    setSaved(false)
    setText('')
  }), [])

  // 输入框随内容长高，窗口跟着长高
  useLayoutEffect(() => {
    const el = areaRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = Math.min(el.scrollHeight, 320) + 'px'
    }
    const h = rootRef.current?.getBoundingClientRect().height
    if (h) window.api.quick.resize(h + 24)
  }, [text, saved, groups.length])

  const save = async () => {
    const body = text.trim()
    if (!body) return
    await window.api.db.addNote(body, { groupId: groupId || null })
    setSaved(true)
    setText('')
    hideTimer.current = setTimeout(() => window.api.quick.hide(), 620)
  }

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      window.api.quick.hide()
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      save()
    }
  }

  return (
    <div className="quick-root" ref={rootRef}>
      <div className="quick-card">
        <div className="quick-sheen" aria-hidden />

        {saved ? (
          <div className="quick-saved">
            <IconCheck width={18} height={18} />
            已记下
          </div>
        ) : (
          <>
            <div className="quick-input">
              <IconSpark className="quick-mark" width={16} height={16} />
              <textarea
                ref={areaRef}
                autoFocus
                rows={1}
                value={text}
                placeholder="闪过什么念头？写下来…"
                onChange={(e) => setText(e.target.value)}
                onKeyDown={onKeyDown}
              />
            </div>

            <footer className="quick-foot">
              <label className="quick-group">
                <IconFolder width={13} height={13} />
                <select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
                  <option value="">收件箱（稍后归档）</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </label>

              <div className="quick-hints">
                <span><kbd>Enter</kbd> 保存</span>
                <span><kbd>Shift</kbd>+<kbd>Enter</kbd> 换行</span>
                <span><kbd>Esc</kbd> 关闭</span>
                <button className="link" onClick={() => window.api.quick.openMain()}>打开主窗口</button>
              </div>
            </footer>
          </>
        )}
      </div>
    </div>
  )
}

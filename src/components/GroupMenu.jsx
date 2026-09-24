import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { cls } from '../lib/util'
import { IconFolder, IconPlus, IconInbox, IconCheck } from './Icons'

/**
 * 「归档到…」浮层：搜分组、选分组、没有就现场建一个。
 * 按屏幕坐标定位，卡片上的按钮和底部操作条共用同一个组件。
 */
export default function GroupMenu({ anchor, groups, count, currentGroupId, onPick, onCreate, onClose }) {
  const [q, setQ] = useState('')
  const [pos, setPos] = useState({ left: anchor.x, top: anchor.y, ready: false })
  const ref = useRef(null)

  const filtered = groups.filter((g) => g.name.toLowerCase().includes(q.trim().toLowerCase()))
  const exact = groups.some((g) => g.name === q.trim())

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    const pad = 10
    setPos({
      left: Math.min(Math.max(pad, anchor.x - width / 2), window.innerWidth - width - pad),
      top: anchor.y + height + pad > window.innerHeight ? anchor.y - height - 8 : anchor.y + 8,
      ready: true,
    })
  }, [anchor.x, anchor.y, filtered.length])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onDown)
    }
  }, [onClose])

  const create = () => {
    const name = q.trim()
    if (name) onCreate(name)
  }

  return (
    <div
      ref={ref}
      className="popover glass-pane"
      style={{ left: pos.left, top: pos.top, visibility: pos.ready ? 'visible' : 'hidden' }}
    >
      <div className="popover-head">
        归档 {count} 条灵感到
      </div>

      <input
        className="popover-search"
        autoFocus
        value={q}
        placeholder="搜索或输入新分组名…"
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return
          if (filtered.length === 1) onPick(filtered[0].id)
          else if (q.trim() && !exact) create()
        }}
      />

      <div className="popover-list">
        {filtered.map((g) => (
          <button key={g.id} className="popover-item" onClick={() => onPick(g.id)}>
            <IconFolder width={14} height={14} style={{ color: g.color }} />
            <span>{g.name}</span>
            {currentGroupId === g.id && <IconCheck width={13} height={13} className="ok" />}
          </button>
        ))}

        {q.trim() && !exact && (
          <button className="popover-item create" onClick={create}>
            <IconPlus width={14} height={14} />
            <span>新建分组「{q.trim()}」</span>
          </button>
        )}

        {!q.trim() && groups.length === 0 && (
          <p className="popover-empty">还没有分组，直接在上面输入名字新建一个。</p>
        )}
      </div>

      {currentGroupId !== undefined && (
        <button className={cls('popover-item', 'footer-item')} onClick={() => onPick(null)}>
          <IconInbox width={14} height={14} />
          <span>移出分组，退回收件箱</span>
        </button>
      )}
    </div>
  )
}

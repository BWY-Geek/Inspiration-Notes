import { useEffect, useState } from 'react'
import { IconSpark, IconSearch, IconPin, IconGear, IconMinus, IconSquare, IconRestore, IconX } from './Icons'

export default function TitleBar({ query, onQuery, settings, onSettings, onOpenSettings }) {
  const [maximized, setMaximized] = useState(() => window.api.win.isMaximized())

  useEffect(() => window.api.win.onMaximized(setMaximized), [])

  useEffect(() => {
    document.body.classList.toggle('is-maximized', maximized)
  }, [maximized])

  return (
    <header className="titlebar">
      <div className="brand">
        <IconSpark className="brand-mark" width={17} height={17} />
        <span className="brand-name">灵感便签</span>
      </div>

      <div className="search">
        <IconSearch width={15} height={15} />
        <input
          id="global-search"
          value={query}
          placeholder="搜索灵感或标签…   Ctrl+F"
          onChange={(e) => onQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && onQuery('')}
        />
        {query && (
          <button className="icon-btn tiny" title="清空" onClick={() => onQuery('')}>
            <IconX width={13} height={13} />
          </button>
        )}
      </div>

      <div className="titlebar-actions">
        <button
          className={`icon-btn${settings.alwaysOnTop ? ' on' : ''}`}
          title={settings.alwaysOnTop ? '取消窗口置顶' : '窗口置顶'}
          onClick={() => onSettings({ alwaysOnTop: !settings.alwaysOnTop })}
        >
          <IconPin />
        </button>
        <button className="icon-btn" title="设置" onClick={onOpenSettings}>
          <IconGear />
        </button>

        <div className="win-controls">
          <button className="win-btn" title="最小化" onClick={() => window.api.win.minimize()}>
            <IconMinus width={14} height={14} />
          </button>
          <button
            className="win-btn"
            title={maximized ? '还原' : '最大化'}
            onClick={() => window.api.win.toggleMaximize()}
          >
            {maximized ? <IconRestore width={13} height={13} /> : <IconSquare width={13} height={13} />}
          </button>
          <button className="win-btn danger" title="收到托盘" onClick={() => window.api.win.hide()}>
            <IconX width={14} height={14} />
          </button>
        </div>
      </div>
    </header>
  )
}

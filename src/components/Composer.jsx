import { useEffect, useRef, useState } from 'react'
import { IconSpark } from './Icons'

export default function Composer({ onAdd, placeholder }) {
  const [text, setText] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 220) + 'px'
  }, [text])

  const submit = () => {
    const body = text.trim()
    if (!body) return
    onAdd(body)
    setText('')
  }

  return (
    <div className="composer">
      <IconSpark className="composer-mark" width={15} height={15} />
      <textarea
        ref={ref}
        id="composer"
        rows={1}
        value={text}
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            submit()
          }
          if (e.key === 'Escape') e.currentTarget.blur()
        }}
      />
      <button className="btn primary" disabled={!text.trim()} onClick={submit}>
        记下 <kbd>↵</kbd>
      </button>
    </div>
  )
}

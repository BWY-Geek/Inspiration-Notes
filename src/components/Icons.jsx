// 统一的线性图标，stroke 走 currentColor，跟着文字色变
const base = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

const make = (children) => (props) => (
  <svg {...base} {...props}>{children}</svg>
)

export const IconSpark = (props) => (
  <svg {...base} fill="currentColor" stroke="none" {...props}>
    <path d="M12 2c.5 5.2 4.3 9 9.5 10-5.2 1-9 4.8-9.5 10-.5-5.2-4.3-9-9.5-10 5.2-1 9-4.8 9.5-10z" />
  </svg>
)

export const IconInbox = make(<>
  <path d="M4 13h4l1.5 3h5L16 13h4" />
  <path d="M5.4 5.6 3 13v5a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5l-2.4-7.4A2 2 0 0 0 16.7 4H7.3a2 2 0 0 0-1.9 1.6z" />
</>)

export const IconLayers = make(<>
  <path d="M12 3 3 8l9 5 9-5-9-5z" />
  <path d="m3 13 9 5 9-5" />
</>)

export const IconFolder = make(
  <path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />,
)

export const IconTag = make(<>
  <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h4.3a2 2 0 0 1 1.4.6l7.2 7.2a2 2 0 0 1 0 2.8l-4.4 4.4a2 2 0 0 1-2.8 0L4.6 11.8a2 2 0 0 1-.6-1.4V6.5z" />
  <circle cx="8.5" cy="8.5" r="1.2" fill="currentColor" stroke="none" />
</>)

export const IconTrash = make(<>
  <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  <path d="M6 7v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7" />
  <path d="M10 11v6M14 11v6" />
</>)

export const IconSearch = make(<>
  <circle cx="11" cy="11" r="6.5" />
  <path d="m20 20-3.6-3.6" />
</>)

export const IconPin = make(<>
  <path d="M15.5 3.5 20.5 8.5" />
  <path d="M14 5 9.8 7.1a2 2 0 0 1-1.6.1l-1.4-.5a1 1 0 0 0-1.1 1.6l8 8a1 1 0 0 0 1.6-1.1l-.5-1.4a2 2 0 0 1 .1-1.6L19 8" />
  <path d="m8.5 15.5-4.5 4.5" />
</>)

export const IconPlus = make(<path d="M12 5v14M5 12h14" />)
export const IconCheck = make(<path d="m5 12.5 4.5 4.5L19 7.5" />)
export const IconX = make(<path d="M6 6l12 12M18 6 6 18" />)
export const IconMinus = make(<path d="M5 12h14" />)

export const IconSquare = make(<rect x="5" y="5" width="14" height="14" rx="2" />)
export const IconRestore = make(<>
  <rect x="7" y="7" width="12" height="12" rx="2" />
  <path d="M5 15V6a1 1 0 0 1 1-1h9" />
</>)

export const IconGear = make(<>
  <circle cx="12" cy="12" r="3.2" />
  <path d="M19.4 14.5a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5v.2a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1h.2a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" />
</>)

export const IconArchive = make(<>
  <rect x="3" y="4" width="18" height="4" rx="1" />
  <path d="M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8" />
  <path d="M10 12h4" />
</>)

export const IconMore = make(<>
  <circle cx="5" cy="12" r="1.1" fill="currentColor" />
  <circle cx="12" cy="12" r="1.1" fill="currentColor" />
  <circle cx="19" cy="12" r="1.1" fill="currentColor" />
</>)

export const IconCopy = make(<>
  <rect x="9" y="9" width="11" height="11" rx="2" />
  <path d="M5 15V6a1 1 0 0 1 1-1h9" />
</>)

export const IconExport = make(<>
  <path d="M12 3v12" />
  <path d="m8 7 4-4 4 4" />
  <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
</>)

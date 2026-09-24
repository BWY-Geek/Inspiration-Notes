'use strict'

/**
 * 生成应用/托盘图标（一枚四角星「灵感火花」）。
 * 不依赖任何图形库：手写一个最小 PNG 编码器，用 zlib 压缩原始扫描线。
 * 运行：node scripts/make-icons.js
 */

const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const OUT_DIR = path.join(__dirname, '..', 'build')

function crc32(buf) {
  let c
  const table = []
  for (let n = 0; n < 256; n++) {
    c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([len, body, crc])
}

/** rgba: Buffer of size w*h*4 */
function encodePng(w, h, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type: RGBA
  // 10,11,12 = compression/filter/interlace = 0

  // 每行前面加一个 filter byte (0 = None)
  const raw = Buffer.alloc((w * 4 + 1) * h)
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4)
  }

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/** 四角星（星形线 astroid）：sqrt(|x|) + sqrt(|y|) <= sqrt(r) */
function drawIcon(size) {
  const rgba = Buffer.alloc(size * size * 4, 0)
  const c = (size - 1) / 2
  const R = size * 0.5
  const SS = 3 // 超采样倍数，做抗锯齿

  const star = [0xf7, 0xc0, 0x4a] // 琥珀
  const core = [0xff, 0xe9, 0xa8] // 高光

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let hits = 0
      let coreHits = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS - c
          const py = y + (sy + 0.5) / SS - c
          const d = Math.sqrt(Math.abs(px)) + Math.sqrt(Math.abs(py))
          if (d <= Math.sqrt(R)) hits++
          if (d <= Math.sqrt(R * 0.52)) coreHits++
        }
      }
      if (!hits) continue
      const total = SS * SS
      const a = Math.round((hits / total) * 255)
      const mix = coreHits / total
      const i = (y * size + x) * 4
      rgba[i] = Math.round(star[0] * (1 - mix) + core[0] * mix)
      rgba[i + 1] = Math.round(star[1] * (1 - mix) + core[1] * mix)
      rgba[i + 2] = Math.round(star[2] * (1 - mix) + core[2] * mix)
      rgba[i + 3] = a
    }
  }
  return rgba
}

function write(name, size) {
  const file = path.join(OUT_DIR, name)
  fs.writeFileSync(file, encodePng(size, size, drawIcon(size)))
  console.log('  ✓', path.relative(path.join(__dirname, '..'), file), `(${size}x${size})`)
}

fs.mkdirSync(OUT_DIR, { recursive: true })
console.log('生成图标：')
write('icon.png', 256)
write('tray.png', 20)
write('tray@2x.png', 40)

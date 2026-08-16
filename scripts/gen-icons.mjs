import { Resvg } from '@resvg/resvg-js'
import { writeFileSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PUBLIC    = resolve(__dirname, '../public')

mkdirSync(PUBLIC, { recursive: true })

function makeSVG(size) {
  const r  = size * 0.22          // corner radius (22% per README)
  const cx = size / 2
  const cy = size / 2
  // Inner UK text scales with size
  const fs = Math.round(size * 0.32)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <!-- bg -->
  <rect width="${size}" height="${size}" rx="${r}" fill="#0E0E10"/>
  <!-- subtle oxblood glow -->
  <radialGradient id="g" cx="35%" cy="20%" r="65%">
    <stop offset="0%" stop-color="#B0413E" stop-opacity="0.35"/>
    <stop offset="100%" stop-color="#B0413E" stop-opacity="0"/>
  </radialGradient>
  <rect width="${size}" height="${size}" rx="${r}" fill="url(#g)"/>
  <!-- oxblood inner square -->
  <rect
    x="${size * 0.22}" y="${size * 0.22}"
    width="${size * 0.56}" height="${size * 0.56}"
    rx="${size * 0.10}"
    fill="#B0413E"
  />
  <!-- UK monogram -->
  <text
    x="${cx}" y="${cy + fs * 0.36}"
    font-family="'JetBrains Mono', monospace"
    font-weight="700"
    font-size="${fs}"
    fill="#EDEAE3"
    text-anchor="middle"
    letter-spacing="-1"
  >UK</text>
</svg>`
}

for (const size of [192, 512]) {
  const svg = makeSVG(size)
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: size } })
  const png = resvg.render().asPng()
  writeFileSync(resolve(PUBLIC, `pwa-${size}x${size}.png`), png)
  console.log(`✓ pwa-${size}x${size}.png`)
}

// apple-touch-icon: 180×180, rounded bg
const appleSize = 180
const appleSVG = makeSVG(appleSize)
const resvgApple = new Resvg(appleSVG, { fitTo: { mode: 'width', value: appleSize } })
writeFileSync(resolve(PUBLIC, 'apple-touch-icon.png'), resvgApple.render().asPng())
console.log('✓ apple-touch-icon.png')

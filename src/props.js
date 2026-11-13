import {
  AdditiveBlending,
  BoxGeometry,
  CatmullRomCurve3,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  IcosahedronGeometry,
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  OctahedronGeometry,
  PlaneGeometry,
  PointLight,
  QuadraticBezierCurve3,
  RingGeometry,
  Shape,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from 'three'
import { canvasTex } from './legokit.js'
import { drawIcon } from './icons.js'
import { fontReady } from './propkit.js'
import { cartModel, isCartStyle } from './hub/carts.js'
import { mulberry32 } from './textures.js'

// Shared models: `makeSign` (multi-line outlined text sprites that can be redrawn when state
// changes), the slingshots (a cart style returns the cart instead: inventory / reward thumbnails)
// and the eggs. The lobby itself, and the handles the game drives, are built in src/hub/.

const std = (color, extra) => new MeshStandardMaterial({ color, roughness: 0.55, metalness: 0, ...extra })
const metal = (color, extra) => new MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.75, ...extra })
const glowMat = (color, intensity = 1.6, extra) => new MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.4, ...extra })
const additive = (color, opacity = 0.7) => new MeshBasicMaterial({ color, transparent: true, opacity, blending: AdditiveBlending, depthWrite: false, side: DoubleSide })

function put(parent, geo, mat, x = 0, y = 0, z = 0, shadow = true) {
  const m = new Mesh(geo, mat)
  m.position.set(x, y, z)
  m.castShadow = shadow
  m.receiveShadow = shadow
  parent.add(m)
  return m
}
const fmt = (n) => Math.round(n).toLocaleString('en-US')
export const fmtShort = (n) => {
  if (n >= 1e12) return `${+(n / 1e12).toFixed(1)}T`
  if (n >= 1e9) return `${+(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `${+(n / 1e6).toFixed(1)}M`
  if (n >= 1e4) return `${+(n / 1e3).toFixed(1)}K`
  return fmt(n)
}

// --- Signs ---------------------------------------------------------------------------------
// lines: [{ text, color, size (relative, 1 = one line height), outline, icon, pill }]
// `icon` draws an icons.js icon before the text; `pill` puts a dark rounded bar behind the line.
export function makeSign(lineHeight = 0.8) {
  const PX = 72
  const c = document.createElement('canvas')
  const tex = canvasTex(c)
  const sprite = new Sprite(new SpriteMaterial({ map: tex, transparent: true, depthWrite: false }))
  sprite.renderOrder = 3
  let last = null
  const draw = (lines) => {
    const g = c.getContext('2d')
    const font = (s) => `700 ${Math.round(PX * s)}px Fredoka, "Arial Black", sans-serif`
    const widths = lines.map((l) => {
      g.font = font(l.size ?? 1)
      return g.measureText(l.text).width + (l.icon ? PX * (l.size ?? 1) * 1.1 : 0) + (l.pill ? PX * 0.9 : 0)
    })
    const pad = 18
    const W = Math.ceil(Math.max(...widths) + pad * 2)
    const H = Math.ceil(lines.reduce((a, l) => a + PX * (l.size ?? 1) * 1.18, 0) + pad * 2)
    c.width = W
    c.height = H
    let y = pad
    lines.forEach((l, i) => {
      const s = l.size ?? 1
      const lh = PX * s * 1.18
      g.font = font(s)
      g.textBaseline = 'middle'
      g.textAlign = 'left'
      g.lineJoin = 'round'
      const w = widths[i]
      let x = (W - w) / 2 + (l.pill ? PX * 0.45 : 0)
      if (l.pill) {
        const ph = lh * 0.95
        g.fillStyle = 'rgba(40,44,58,0.82)'
        g.beginPath()
        g.roundRect((W - w) / 2, y + (lh - ph) / 2, w, ph, ph / 2)
        g.fill()
      }
      if (l.icon) {
        drawIcon(g, l.icon, x, y + lh / 2 - PX * s * 0.5, PX * s)
        x += PX * s * 1.1
      }
      g.lineWidth = Math.max(6, PX * s * 0.16)
      g.strokeStyle = l.outline ?? '#1b1f2e'
      g.strokeText(l.text, x, y + lh / 2 + 2)
      g.fillStyle = l.color ?? '#ffffff'
      g.fillText(l.text, x, y + lh / 2 + 2)
      y += lh
    })
    tex.dispose()
    tex.needsUpdate = true
    const k = lineHeight / PX
    sprite.scale.set(W * k, H * k, 1)
  }
  sprite.set = (lines) => {
    const key = JSON.stringify(lines)
    if (key === last) return
    last = key
    draw(lines)
  }
  fontReady.then(() => {
    if (last) draw(JSON.parse(last))
  })
  return sprite
}

// --- Slingshots ---------------------------------------------------------------------------
const SLING_STYLES = {
  twig: { wood: '#c98a4b', wrap: '#f3e1bf', band: '#4a2f22' },
  wrap: { wood: '#d0782a', wrap: '#ffd28a', band: '#5a2a1a' },
  ember: { wood: '#a8521f', wrap: '#ff4a1f', band: '#3a1a12', tip: '#ff7a1a' },
  steel: { wood: '#b8702e', wrap: '#d6dde6', band: '#2a2a33', cap: '#cfd6df' },
  royal: { wood: '#e0801f', wrap: '#ffd23a', band: '#6a1a1a', gem: '#ff2b4a' },
  vine: { wood: '#7a5a2a', wrap: '#3cc21f', band: '#2a5a1a', leaves: '#4fdc2a' },
  frost: { wood: '#9fe6ff', wrap: '#ffffff', band: '#2a6bbf', crystal: '#7fdcff', ice: true },
  shadow: { wood: '#3a1f5a', wrap: '#8a3cff', band: '#14081f', spikes: '#b45cff' },
  sun: { wood: '#ffcf3a', wrap: '#fff1a8', band: '#b0700e', wings: '#ffffff', gold: true },
}
// opts.bands = false leaves out the band + pouch (a giant launcher would draw
// its own stretchy ones). root.userData.sling describes the rig:
// { tips, pouch, band } for a slingshot, { cannon, barrel, mouth } for a blaster.
export function buildSlingshot(style, { bands = true } = {}) {
  if (isCartStyle(style)) return cartModel(style)
  const root = new Group()
  if (style === 'blaster') return buildBlaster(root)
  if (style === 'galaxy') return buildBlaster(root, { body: '#7a3cff', dark: '#ffd23a', wood: '#2a1a5a', muzzle: '#5ae8ff', hub: '#ff8fd8' })
  const s = SLING_STYLES[style] ?? SLING_STYLES.twig
  const woodMat = s.ice ? std(s.wood, { emissive: '#3ab8ff', emissiveIntensity: 0.35, roughness: 0.15, transparent: true, opacity: 0.9 }) : s.gold ? metal(s.wood, { emissive: '#ffae12', emissiveIntensity: 0.25 }) : std(s.wood, { roughness: 0.75 })
  const wrapMat = std(s.wrap, s.spikes ? { emissive: s.wrap, emissiveIntensity: 0.6 } : {})
  put(root, new CylinderGeometry(0.11, 0.13, 0.85, 10), woodMat, 0, 0.42, 0)
  for (const y of [0.15, 0.32, 0.5]) put(root, new TorusGeometry(0.13, 0.04, 6, 14).rotateX(Math.PI / 2), wrapMat, 0, y, 0)
  const tips = []
  for (const side of [-1, 1]) {
    const curve = new QuadraticBezierCurve3(new Vector3(0, 0.8, 0), new Vector3(side * 0.42, 0.95, 0), new Vector3(side * 0.42, 1.55, 0))
    put(root, new TubeGeometry(curve, 12, 0.095, 8), woodMat)
    tips.push(new Vector3(side * 0.42, 1.55, 0))
    put(root, new TorusGeometry(0.11, 0.035, 6, 12).rotateX(Math.PI / 2), wrapMat, side * 0.42, 1.36, 0)
  }
  put(root, new SphereGeometry(0.15, 10, 8), woodMat, 0, 0.82, 0)
  // band + pouch, pulled slightly back (-Z)
  const pouch = new Vector3(0, 1.28, -0.22)
  root.userData.sling = { tips: tips.map((t) => t.clone().setY(1.5)), pouch: pouch.clone(), band: s.band }
  if (bands) {
    const bandMat = std(s.band, { roughness: 0.9 })
    for (const t of tips) {
      const band = new CatmullRomCurve3([t.clone().setY(1.5), new Vector3(t.x * 0.45, 1.36, -0.15), pouch])
      put(root, new TubeGeometry(band, 8, 0.03, 5), bandMat)
    }
    put(root, new SphereGeometry(0.1, 8, 6).scale(1.3, 0.8, 0.6), bandMat, pouch.x, pouch.y, pouch.z)
  }
  if (s.cap) for (const t of tips) put(root, new SphereGeometry(0.12, 10, 8), metal(s.cap), t.x, t.y, t.z)
  if (s.tip) for (const t of tips) put(root, new SphereGeometry(0.12, 10, 8), glowMat(s.tip, 2.2), t.x, t.y, t.z)
  if (s.gem) put(root, new OctahedronGeometry(0.13), glowMat(s.gem, 0.9), 0, 0.84, 0.13)
  if (s.leaves) {
    const leafMat = std(s.leaves, { side: DoubleSide })
    for (let i = 0; i < 7; i++) {
      const a = i * 1.7
      const leaf = put(root, new SphereGeometry(0.11, 6, 4).scale(1, 0.35, 1.8), leafMat, Math.cos(a) * 0.16 + (i % 2 ? 0.3 : -0.3) * (i > 3 ? 1 : 0), 0.3 + i * 0.18, Math.sin(a) * 0.16)
      leaf.rotation.set(a, a * 0.5, 0.6)
    }
    const vine = new CatmullRomCurve3(Array.from({ length: 14 }, (_, i) => new Vector3(Math.cos(i * 1.4) * 0.14, i * 0.1, Math.sin(i * 1.4) * 0.14)))
    put(root, new TubeGeometry(vine, 40, 0.03, 5), std('#2f9a1a'))
  }
  if (s.crystal) {
    const cm = glowMat(s.crystal, 0.5, { transparent: true, opacity: 0.85, roughness: 0.1 })
    for (const t of tips) for (let i = 0; i < 3; i++) {
      const cr = put(root, new ConeGeometry(0.07, 0.4, 5), cm, t.x + (i - 1) * 0.08, t.y + 0.12, (i - 1) * 0.05)
      cr.rotation.z = (i - 1) * 0.5
    }
    put(root, new OctahedronGeometry(0.18).scale(1, 1.6, 1), cm, 0, 0.84, 0)
  }
  if (s.spikes) {
    const sm = glowMat(s.spikes, 1.2)
    for (const t of tips) for (let i = 0; i < 2; i++) {
      const sp = put(root, new ConeGeometry(0.06, 0.32, 4), sm, t.x + Math.sign(t.x) * 0.06, t.y - 0.1 - i * 0.25, 0)
      sp.rotation.z = -Math.sign(t.x) * 1.2
    }
    put(root, new OctahedronGeometry(0.16), sm, 0, 0.84, 0.05)
  }
  if (s.wings) {
    const wm = std(s.wings, { emissive: '#fff3c0', emissiveIntensity: 0.35 })
    for (const t of tips) for (let i = 0; i < 3; i++) {
      const f = put(root, new SphereGeometry(0.1, 8, 6).scale(2.4 - i * 0.5, 0.5, 0.6), wm, t.x + Math.sign(t.x) * (0.25 + i * 0.05), t.y - 0.05 - i * 0.12, -0.05)
      f.rotation.z = Math.sign(t.x) * (0.5 - i * 0.25)
    }
  }
  return root
}
function buildBlaster(root, c = {}) {
  const body = std(c.body ?? '#ff7a1a', c.body ? { emissive: c.body, emissiveIntensity: 0.25 } : {})
  const dark = std(c.dark ?? '#4a4f5a', c.dark ? { metalness: 0.6, roughness: 0.3 } : {})
  const wood = std(c.wood ?? '#8a5226', { roughness: 0.8 })
  // carriage + wheels
  put(root, new BoxGeometry(0.9, 0.3, 1.1), wood, 0, 0.35, 0)
  for (const s of [-1, 1]) for (const z of [-0.35, 0.35]) {
    const w = put(root, new CylinderGeometry(0.28, 0.28, 0.12, 14).rotateZ(Math.PI / 2), dark, s * 0.5, 0.28, z)
    put(w, new CylinderGeometry(0.1, 0.1, 0.14, 8).rotateZ(Math.PI / 2), std(c.hub ?? '#ffd23a'))
  }
  // barrel tilted up and forward (+Z)
  const barrel = new Group()
  barrel.position.set(0, 0.62, 0)
  barrel.rotation.x = -0.6
  root.add(barrel)
  put(barrel, new CylinderGeometry(0.26, 0.32, 1.3, 16).rotateX(Math.PI / 2), body, 0, 0, 0.35)
  for (const z of [-0.15, 0.3, 0.85]) put(barrel, new TorusGeometry(0.31, 0.05, 8, 18), dark, 0, 0, z)
  put(barrel, new CylinderGeometry(0.2, 0.2, 0.05, 14).rotateX(Math.PI / 2), glowMat(c.muzzle ?? '#3cff3c', 2.2), 0, 0, 1.01)
  put(barrel, new SphereGeometry(0.3, 14, 10), body, 0, 0, -0.3)
  root.userData.sling = { cannon: true, barrel, mouth: new Vector3(0, 0, 1.01) }
  return root
}

// --- Eggs ---------------------------------------------------------------------------------
const eggProfile = (() => {
  const pts = []
  for (let i = 0; i <= 24; i++) {
    const t = i / 24
    const a = t * Math.PI
    const r = Math.sin(a) * (0.62 - 0.12 * t) * (1 + 0.08 * Math.sin(a))
    pts.push(new Vector2(Math.max(0.001, r), -Math.cos(a) * 0.85 + 0.85))
  }
  return pts
})()
// Egg shells (the hub's egg court): Common white speckled, Uncommon green, Rare blue, Exclusive a
// glowing galaxy (the court's Mythic pedestal), Race white with purple waves and a crown.
function paintEgg(look) {
  const W = 512
  const H = 256
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')
  const rand = mulberry32(look.length * 97)
  const spots = (cols, n, r0, r1) => {
    for (let i = 0; i < n; i++) {
      g.fillStyle = cols[i % cols.length]
      g.beginPath()
      g.ellipse(rand() * W, rand() * H, r0 + rand() * (r1 - r0), (r0 + rand() * (r1 - r0)) * 0.7, rand() * 3, 0, Math.PI * 2)
      g.fill()
    }
  }
  const gradient = (top, bottom) => {
    const gr = g.createLinearGradient(0, 0, 0, H)
    gr.addColorStop(0, top)
    gr.addColorStop(1, bottom)
    g.fillStyle = gr
    g.fillRect(0, 0, W, H)
  }
  if (look === 'common') {
    g.fillStyle = '#f4f2ee'
    g.fillRect(0, 0, W, H)
    spots(['rgba(150,140,130,0.6)', 'rgba(110,100,95,0.5)'], 120, 2, 6)
  } else if (look === 'uncommon') {
    gradient('#5fe84a', '#22a83a')
    spots(['rgba(20,110,30,0.45)'], 30, 6, 14)
  } else if (look === 'rare') {
    gradient('#6fd6ff', '#1f7bff')
    spots(['rgba(255,255,255,0.35)'], 18, 5, 10)
  } else if (look === 'race') {
    g.fillStyle = '#f6f2ff'
    g.fillRect(0, 0, W, H)
    g.strokeStyle = '#8a3cd8'
    g.lineWidth = 22
    for (let k = 0; k < 2; k++) {
      g.beginPath()
      for (let x = 0; x <= W; x += 8) g.lineTo(x, H * (0.38 + k * 0.22) + Math.sin((x / W) * Math.PI * 4 + k) * 22)
      g.stroke()
    }
    g.fillStyle = '#ffd23a'
    g.fillRect(0, H * 0.06, W, 14)
  } else if (look === 'exclusive') {
    gradient('#2a1a8a', '#14105a')
    for (let i = 0; i < 8; i++) {
      const x = rand() * W
      const y = rand() * H
      const rg = g.createRadialGradient(x, y, 0, x, y, 90)
      rg.addColorStop(0, i % 2 ? 'rgba(255,90,220,0.5)' : 'rgba(90,200,255,0.45)')
      rg.addColorStop(1, 'rgba(0,0,0,0)')
      g.fillStyle = rg
      g.fillRect(0, 0, W, H)
    }
    spots(['#ffffff', '#bff6ff', '#ffd6ff'], 140, 1, 3)
  }
  return canvasTex(c)
}
export function buildEgg(look) {
  const root = new Group()
  if (look === 'rainbow') {
    const geo = new IcosahedronGeometry(0.72, 1).toNonIndexed()
    geo.scale(0.95, 1.18, 0.95)
    const cols = ['#ff3b3b', '#ffb21f', '#ffef3a', '#3cff6a', '#3fa2ff', '#b45cff', '#ff6ad5']
    const colorArr = []
    const c = new Color()
    for (let f = 0; f < geo.attributes.position.count / 3; f++) {
      c.set(cols[(f * 5) % cols.length])
      for (let v = 0; v < 3; v++) colorArr.push(c.r, c.g, c.b)
    }
    geo.setAttribute('color', new (geo.attributes.position.constructor)(new Float32Array(colorArr), 3))
    put(root, geo, new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.35 }), 0, 0.85, 0)
    return root
  }
  const galaxy = look === 'exclusive'
  const glossy = galaxy || look === 'rare'
  const egg = put(root, new LatheGeometry(eggProfile, 32), std('#ffffff', { map: paintEgg(look), roughness: glossy ? 0.22 : 0.45, emissive: galaxy ? '#3a1aa8' : '#000000', emissiveIntensity: galaxy ? 0.5 : 0 }))
  egg.scale.setScalar(1.05)
  if (look === 'race') {
    const crown = new Group()
    crown.position.y = 1.62
    root.add(crown)
    const gold = metal('#ffcf3a', { emissive: '#ffae12', emissiveIntensity: 0.35 })
    put(crown, new CylinderGeometry(0.3, 0.34, 0.16, 16, 1, true), gold)
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      put(crown, new ConeGeometry(0.07, 0.24, 4), gold, Math.cos(a) * 0.3, 0.16, Math.sin(a) * 0.3)
    }
  }
  return root
}

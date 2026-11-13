import {
  CylinderGeometry,
  BoxGeometry,
  ExtrudeGeometry,
  Group,
  IcosahedronGeometry,
  MeshStandardMaterial,
  OctahedronGeometry,
  PlaneGeometry,
  PointLight,
  RepeatWrapping,
  Shape,
  SphereGeometry,
  TorusGeometry,
  MeshBasicMaterial,
} from 'three'
import { PLATFORMS } from '../config.js'
import { canvasTex, legoBoxGeo, legoMat, withTop } from '../legokit.js'
import { bake } from '../bake.js'
import { makeSign } from '../props.js'
import { neon } from '../propkit.js'
import { emitAt, glowMat, metal, outlined, placed, put, rrect, solid, std } from './kit.js'

// Power treadmills (PLATFORMS). Local model space: the belt runs along Z, you step on at +Z and the
// console with its screen stands at -Z. The east row (white frames, accent colour per tier,
// flower-print base) unlocks with rebirths; the west row is the three bought ones (pink blossom
// arch, golden royal with wings + crown, black rainbow with a neon arch and star). Static parts are
// baked to a few draw calls; the belts scroll, the decorations sparkle. Returns the `tables`
// handles game.js / training.js drive (running on the belt = training, see game.js checkTables).

const LEN = 6.4 // deck length
const WID = 2.9 // deck width
const DECK_Y = 0.32 // base plate top

// Dark belt with light slats; the texture scrolls toward the player.
function paintBelt(base = '#1d2347', slat = '#3a4478') {
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 128
  const g = c.getContext('2d')
  g.fillStyle = base
  g.fillRect(0, 0, 64, 128)
  g.fillStyle = slat
  for (let y = 0; y < 128; y += 16) g.fillRect(0, y, 64, 6)
  const t = canvasTex(c)
  t.wrapS = t.wrapT = RepeatWrapping
  t.repeat.set(1, 4)
  return t
}

// Little flower prints on the base plate (transparent decal).
function paintFlowers(color, seed = 1) {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 128
  const g = c.getContext('2d')
  let s = seed
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  for (let i = 0; i < 7; i++) {
    const x = 22 + r() * 212
    const y = 18 + r() * 92
    g.fillStyle = color
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2
      g.beginPath()
      g.arc(x + Math.cos(a) * 7, y + Math.sin(a) * 7, 6, 0, Math.PI * 2)
      g.fill()
    }
    g.fillStyle = '#fff7a8'
    g.beginPath()
    g.arc(x, y, 4, 0, Math.PI * 2)
    g.fill()
  }
  return canvasTex(c)
}

function paintScreen(mult, frame, dark = '#141826') {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 112
  const g = c.getContext('2d')
  const tex = canvasTex(c)
  const draw = () => {
    g.fillStyle = frame
    rrect(g, 0, 0, 256, 112, 20)
    g.fill()
    g.fillStyle = dark
    rrect(g, 12, 12, 232, 88, 14)
    g.fill()
    // lightning bolt
    g.fillStyle = '#ffd21f'
    g.beginPath()
    g.moveTo(60, 24)
    g.lineTo(38, 62)
    g.lineTo(54, 62)
    g.lineTo(44, 90)
    g.lineTo(74, 48)
    g.lineTo(57, 48)
    g.lineTo(68, 24)
    g.closePath()
    g.fill()
    outlined(g, `x${mult.toLocaleString('en-US')}`, 160, 58, { size: 50, fill: '#ffd21f', stroke: '#141826', width: 0.1 })
    tex.needsUpdate = true
  }
  draw()
  document.fonts?.load('700 50px Fredoka').then(draw)
  return tex
}

// Shared frame: base plate, deck, belt, rails, front roller, console posts, handles, screen.
function frame(root, o) {
  const { deck, rail, accent, base, beltBase, beltSlat, screenFrame, flowers, mult } = o
  const baseMat = legoMat(base)
  put(root, withTop(new BoxGeometry(WID + 1.1, DECK_Y, LEN + 1.6), DECK_Y), baseMat, 0, DECK_Y / 2, 0.25)
  if (flowers) {
    const dec = put(root, new PlaneGeometry(WID + 0.9, 2.2), new MeshBasicMaterial({ map: paintFlowers(flowers, mult * 7 + 3), transparent: true, depthWrite: false }), 0, DECK_Y + 0.012, LEN / 2 - 0.25, false)
    dec.rotation.x = -Math.PI / 2
  }
  // deck body (rounded look: a box + two half-cylinder ends)
  const deckMat = deck
  put(root, new BoxGeometry(WID, 0.42, LEN - 0.6), deckMat, 0, DECK_Y + 0.21, -0.3)
  put(root, new CylinderGeometry(0.34, 0.34, WID + 0.25, 20).rotateZ(Math.PI / 2), deckMat, 0, DECK_Y + 0.3, LEN / 2 - 0.55)
  put(root, new CylinderGeometry(0.3, 0.3, WID + 0.1, 16).rotateZ(Math.PI / 2), deckMat, 0, DECK_Y + 0.26, -LEN / 2 + 0.1)
  // roller hub caps (accent ring + dark dot) on both sides
  for (const s of [-1, 1]) {
    put(root, new CylinderGeometry(0.24, 0.24, 0.06, 18).rotateZ(Math.PI / 2), std(accent), s * (WID / 2 + 0.14), DECK_Y + 0.3, LEN / 2 - 0.55)
    put(root, new CylinderGeometry(0.1, 0.1, 0.08, 12).rotateZ(Math.PI / 2), std('#1b1f2e'), s * (WID / 2 + 0.16), DECK_Y + 0.3, LEN / 2 - 0.55)
  }
  // side rails with an accent stripe
  for (const s of [-1, 1]) {
    put(root, new BoxGeometry(0.34, 0.2, LEN - 0.9), rail, s * (WID / 2 - 0.05), DECK_Y + 0.52, -0.35)
    put(root, new BoxGeometry(0.06, 0.08, LEN - 1.1), std(accent, { emissive: accent, emissiveIntensity: 0.25 }), s * (WID / 2 + 0.13), DECK_Y + 0.44, -0.35)
  }
  // belt (scrolls)
  const beltTex = paintBelt(beltBase, beltSlat)
  const belt = put(root, new PlaneGeometry(WID - 0.5, LEN - 1.1), new MeshStandardMaterial({ map: beltTex, roughness: 0.75 }), 0, DECK_Y + 0.43, -0.3, false)
  belt.rotation.x = -Math.PI / 2
  belt.receiveShadow = true
  // console: two posts leaning back, handle bars, screen
  const cz = -LEN / 2 + 0.25
  for (const s of [-1, 1]) {
    const post = put(root, new BoxGeometry(0.2, 2.3, 0.2), rail, s * (WID / 2 - 0.25), DECK_Y + 1.3, cz)
    post.rotation.x = -0.08
    const bar = put(root, new CylinderGeometry(0.07, 0.07, 1.6, 10).rotateX(Math.PI / 2), rail, s * (WID / 2 - 0.25), DECK_Y + 1.55, cz + 0.8)
    bar.rotation.x = 0.06
    put(root, new CylinderGeometry(0.095, 0.095, 0.55, 10).rotateX(Math.PI / 2), std(accent), s * (WID / 2 - 0.25), DECK_Y + 1.6, cz + 1.4)
    put(root, new SphereGeometry(0.11, 10, 8), std(accent), s * (WID / 2 - 0.25), DECK_Y + 1.62, cz + 1.68)
  }
  put(root, new BoxGeometry(WID - 0.3, 0.16, 0.16), rail, 0, DECK_Y + 2.05, cz - 0.05)
  const screen = new Group()
  screen.position.set(0, DECK_Y + 2.62, cz - 0.08)
  screen.rotation.x = -0.32
  root.add(screen)
  put(screen, new BoxGeometry(2.25, 1.0, 0.18), std(screenFrame), 0, 0, 0)
  const face = put(screen, new PlaneGeometry(2.15, 0.94), new MeshBasicMaterial({ map: paintScreen(mult, screenFrame) }), 0, 0, 0.095, false)
  face.material.toneMapped = false
  return { belt: beltTex, screen }
}

// --- East row ---------------------------------------------------------------------------------
function buildPowerTreadmill(t) {
  const root = new Group()
  const white = std('#f7f8fb', { roughness: 0.35 })
  const parts = frame(root, { deck: white, rail: white, accent: t.color, base: '#bff59a', beltBase: '#1b2148', beltSlat: '#353f75', screenFrame: t.color, flowers: t.flower, mult: t.mult })
  return { root, belts: [parts.belt], tick: [] }
}

// --- West row ----------------------------------------------------------------------------------
function wingShape() {
  const s = new Shape()
  s.moveTo(0, 0)
  s.bezierCurveTo(0.4, 0.6, 1.2, 1.3, 2.2, 1.5)
  s.lineTo(1.9, 1.15)
  s.lineTo(2.3, 1.05)
  s.lineTo(1.9, 0.75)
  s.lineTo(2.15, 0.6)
  s.lineTo(1.7, 0.4)
  s.lineTo(1.85, 0.2)
  s.bezierCurveTo(1.1, 0.15, 0.5, -0.05, 0, 0)
  return new ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 1 })
}
function starShape(r = 0.7) {
  const s = new Shape()
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5
    const rr = i % 2 ? r * 0.45 : r
    if (i === 0) s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr)
    else s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr)
  }
  s.closePath()
  const g = new ExtrudeGeometry(s, { depth: 0.22, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2 })
  g.center()
  return g
}

function buildPremium(p, fx, wxz) {
  const root = new Group()
  const animated = new Group() // kept out of the bake
  const cz = -LEN / 2 + 0.25
  let parts
  const tick = []
  if (p.style === 'blossom') {
    const pink = std('#ffd6f1', { roughness: 0.35 })
    const hot = std('#ff5fc8', { roughness: 0.4 })
    parts = frame(root, { deck: pink, rail: hot, accent: '#ff3fb8', base: '#ffb6e6', beltBase: '#2a1a3a', beltSlat: '#4a2f62', screenFrame: '#ff6ad0', flowers: '#ff3fb8', mult: p.mult })
    // twisted plum trunks rising beside the console and arching over it, crowned with blossom puffs
    const bark = std('#5a2440', { roughness: 0.8 })
    const puffA = std('#ff8ad8', { roughness: 0.5 })
    const puffB = std('#ffc2ec', { roughness: 0.5 })
    for (const s of [-1, 1]) {
      for (let i = 0; i < 7; i++) {
        const k = i / 6
        put(root, new BoxGeometry(0.42, 0.62, 0.42), bark, s * (WID / 2 + 0.55 - Math.sin(k * 2.2) * 0.9 * k), DECK_Y + 0.3 + i * 0.58, cz - 0.4 + Math.sin(k * 5) * 0.15).rotation.y = i * 0.5
      }
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2
        put(root, new IcosahedronGeometry(0.62 + (i % 3) * 0.12, 1), i % 2 ? puffA : puffB, s * (WID / 2 - 0.1) + Math.cos(a) * 0.65, DECK_Y + 4.1 + Math.sin(a * 2) * 0.3, cz - 0.4 + Math.sin(a) * 0.6)
      }
    }
    for (let i = 0; i < 5; i++) put(root, new IcosahedronGeometry(0.55, 1), i % 2 ? puffA : puffB, -1.1 + i * 0.55, DECK_Y + 4.6 + Math.sin(i) * 0.2, cz - 0.4)
    emitAt(fx, wxz.x, 4.5, wxz.z, { rate: 6, spread: 4, spreadY: 1, dir: [0.2, -1, 0.1], speed: 0.6, jitter: 0.5, life: 3.2, size: 0.32, color: ['#ff8ad8', '#ffc2ec', '#ff5fc8'], shape: 'square', additive: false })
    emitAt(fx, wxz.x, 3.6, wxz.z, { rate: 4, spread: 3.5, spreadY: 2, speed: 0.3, life: 1.4, size: 0.4, color: ['#ffffff', '#ffd6f1'], shape: 'star' })
  } else if (p.style === 'royal') {
    const gold = metal('#ffcf3a', { emissive: '#c88a10', emissiveIntensity: 0.35 })
    parts = frame(root, { deck: gold, rail: gold, accent: '#ffe27a', base: '#f2c84a', beltBase: '#1a1a22', beltSlat: '#34343f', screenFrame: '#ffcf3a', flowers: null, mult: p.mult })
    // red carpet runner at the front step
    put(root, new BoxGeometry(1.6, 0.06, 1.7), std('#e83a4a', { roughness: 0.9 }), 0, DECK_Y + 0.03, LEN / 2 + 0.25)
    // crown on the screen + white wings either side
    const crown = new Group()
    crown.position.set(0, DECK_Y + 3.45, cz - 0.2)
    root.add(crown)
    put(crown, new CylinderGeometry(0.62, 0.7, 0.36, 16, 1, true), gold)
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      put(crown, new OctahedronGeometry(0.16), gold, Math.cos(a) * 0.62, 0.36, Math.sin(a) * 0.62)
      put(crown, new SphereGeometry(0.09, 8, 6), glowMat(i % 2 ? '#ff2b4a' : '#3fa2ff', 0.9), Math.cos(a) * 0.66, 0.02, Math.sin(a) * 0.66)
    }
    const wing = wingShape()
    const feather = std('#ffffff', { roughness: 0.5, emissive: '#fff6d8', emissiveIntensity: 0.15, side: 2 }) // DoubleSide: one wing is mirrored
    for (const s of [-1, 1]) {
      const w = put(root, wing, feather, s * 1.0, DECK_Y + 2.5, cz - 0.3)
      w.scale.set(s, 1, 1)
      w.rotation.y = s * 0.35
    }
    for (const s of [-1, 1]) put(root, new CylinderGeometry(0.18, 0.22, 0.5, 12), gold, s * (WID / 2 + 0.45), DECK_Y + 0.25, LEN / 2 - 0.2)
    emitAt(fx, wxz.x, 3, wxz.z, { rate: 9, spread: 4, spreadY: 3, speed: 0.25, life: 1.6, size: 0.42, color: ['#fff27a', '#ffcf3a', '#ffffff'], shape: 'star' })
  } else {
    // rainbow
    const black = std('#1c1d2a', { roughness: 0.35, metalness: 0.2 })
    parts = frame(root, { deck: black, rail: black, accent: '#5fe8ff', base: '#2a2c3e', beltBase: '#0e0f18', beltSlat: '#262838', screenFrame: '#2af0ff', flowers: null, mult: p.mult })
    const RB = ['#ff3b3b', '#ff9a1f', '#ffe23a', '#3cff6a', '#2ac8ff', '#5a6aff', '#c45cff']
    // neon rainbow edges and front step stripes
    RB.forEach((c, i) => {
      put(root, new BoxGeometry(WID + 1.1, 0.07, 0.16), neon(c, 2.2), 0, DECK_Y + 0.02, LEN / 2 + 0.95 - i * 0.2, false)
      if (i < 3) for (const s of [-1, 1]) put(root, new BoxGeometry(0.05, 0.05, LEN - 1.2), neon(c, 2.4), s * (WID / 2 + 0.2 + i * 0.07), DECK_Y + 0.1 + i * 0.06, -0.3, false)
    })
    // the arch behind the screen: seven half rings, clouds at the feet, a spinning star on top
    const arch = new Group()
    arch.position.set(0, DECK_Y + 2.0, cz - 0.6)
    root.add(arch)
    RB.forEach((c, i) => put(arch, new TorusGeometry(2.55 - i * 0.17, 0.085, 8, 40, Math.PI), neon(c, 2.0), 0, 0, 0, false))
    const cloud = std('#ffffff', { roughness: 0.7, emissive: '#e8f4ff', emissiveIntensity: 0.3 })
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) put(arch, new IcosahedronGeometry(0.42 - i * 0.06, 1), cloud, s * (2.1 + i * 0.32), 0.05 + (i % 2) * 0.2, 0.1)
    const star = put(animated, starShape(0.6), glowMat('#ffd21f', 1.4, { metalness: 0.3 }), 0, DECK_Y + 4.75, cz - 0.6)
    tick.push((dt, t) => {
      star.rotation.y += dt * 1.6
      star.position.y = DECK_Y + 4.75 + Math.sin(t * 2) * 0.12
    })
    const light = new PointLight('#c45cff', 10, 12, 2)
    light.position.set(0, DECK_Y + 3.5, cz + 1)
    animated.add(light)
    tick.push((dt, t) => light.color.setHSL((t * 0.15) % 1, 0.9, 0.6))
    emitAt(fx, wxz.x, 3.6, wxz.z, { rate: 12, spread: 5, spreadY: 3, speed: 0.4, life: 1.5, size: 0.42, color: RB, shape: 'star' })
  }
  root.add(animated)
  return { root, animated, belts: [parts.belt], tick }
}

// Bakes a model's static meshes (everything but `keep`) into a few merged meshes.
function bakeModel(model, keep = []) {
  const out = new Group()
  const kept = []
  for (const k of keep) {
    if (!k) continue
    k.parent?.remove(k)
    kept.push(k)
  }
  out.add(bake(model.root, true))
  for (const k of kept) out.add(k)
  return out
}

// Places both rows (east: consoles against the east cliff, belts facing west; west: the reverse)
// and returns the game's `tables` handles: { data, x, z, topY, radius, color, root, sign, belt }
// where belt = { dx, dz } (unit vector from the step-on end to the console), half length / width.
export function buildTreadmills(root, fx) {
  const belts = []
  const ticks = []
  const tables = []
  const east = PLATFORMS.filter((p) => !p.price)
  const west = PLATFORMS.filter((p) => p.price)
  const place = (p, x, z, yaw, model, keep) => {
    const g = placed(root, x, 0, z, yaw)
    g.add(bakeModel(model, keep))
    belts.push(...model.belts)
    ticks.push(...model.tick)
    const toConsole = { dx: yaw < 0 ? 1 : -1 } // yaw -PI/2: console east (+X); +PI/2: west
    const sign = makeSign(0.85)
    sign.position.set(x + toConsole.dx * 1.6, p.price ? 6.6 : 5.4, z)
    root.add(sign)
    solid(LEN / 2 + 0.3, 0.375, WID / 2 + 0.2, x, 0.375, z) // 0.75 m: low enough to walk up (autostep)
    solid(0.3, 1.6, WID / 2 + (p.price ? 0.6 : 0), x + toConsole.dx * (LEN / 2 - 0.3), 1.6, z)
    tables.push({ data: p, x, z, topY: 0.75, radius: 1.4, color: p.color, root: g, sign, belt: { dx: toConsole.dx, dz: 0, halfLen: LEN / 2 - 0.4, halfWid: WID / 2 - 0.1 } })
  }
  east.forEach((t, i) => {
    const m = buildPowerTreadmill(t)
    const belt = m.root.children.find((o) => o.material?.map === m.belts[0])
    place(t, 31.5, -18 + i * 11, -Math.PI / 2, m, [belt]) // console (-Z) -> east
  })
  west.forEach((p, i) => {
    const x = -39
    const z = 8 + i * 9.5
    const m = buildPremium(p, fx, { x: x - 2, z })
    const belt = m.root.children.find((o) => o.material?.map === m.belts[0])
    place(p, x, z, Math.PI / 2, m, [belt, m.animated]) // console (-Z) -> west
  })
  return {
    tables,
    update(dt, t) {
      for (const b of belts) b.offset.y = (b.offset.y + dt * 0.9) % 1
      for (const f of ticks) f(dt, t)
    },
  }
}

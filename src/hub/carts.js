import {
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  BoxGeometry,
  Quaternion,
  RepeatWrapping,
  Vector3,
} from 'three'
import { SLINGSHOTS } from '../config.js'
import { canvasTex, legoBoxGeo, legoMat, mergedMesh } from '../legokit.js'
import { bake } from '../bake.js'
import { makeSign } from '../props.js'
import { neon } from '../propkit.js'
import { additive, C, emitAt, fmtWins, glowMat, metal, placed, put, solid, std } from './kit.js'

export const isCartStyle = (style) => typeof style === 'string' && style.startsWith('cart-')
export function cartModel(style) {
  const cart = SLINGSHOTS.find((c) => c.style === style) ?? SLINGSHOTS[0]
  const m = buildCart(cart)
  m.root.add(m.animated)
  return m.root
}

// The Cart Shop (west of the launch zone): the ten carts (SLINGSHOTS: they replaced the slingshots)
// on white display pads in two rows (the back row on a raised step), each with a status / name /
// FLY bonus / price sign, and the big CART SHOP title. Walking onto a pad buys / equips it
// (game.js checkPads). Cart model space: nose at -Z, handle at +Z. `cartModel(style)` is what
// props.js buildSlingshot returns for a cart style (inventory and reward thumbnails).

let wireTex = null
function wire() {
  if (wireTex) return wireTex
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')
  g.clearRect(0, 0, 64, 64)
  g.fillStyle = '#ffffff'
  g.fillRect(0, 0, 64, 7)
  g.fillRect(0, 0, 7, 64)
  wireTex = canvasTex(c)
  wireTex.wrapS = wireTex.wrapT = RepeatWrapping
  return wireTex
}

// Basket shell: five wire panels (bottom, sides, slanted front, back) in one geometry, UVs in
// metres so the mesh density matches on every panel.
function basketGeo() {
  const pos = []
  const uv = []
  const K = 5 // wire squares per metre
  const quad = (a, b, c, d) => {
    const u = new Vector3().subVectors(b, a)
    const v = new Vector3().subVectors(d, a)
    const lu = u.length() * K
    const lv = v.length() * K
    pos.push(...a.toArray(), ...b.toArray(), ...c.toArray(), ...a.toArray(), ...c.toArray(), ...d.toArray())
    uv.push(0, 0, lu, 0, lu, lv, 0, 0, lu, lv, 0, lv)
  }
  const V = (x, y, z) => new Vector3(x, y, z)
  const y0 = 0.82
  const y1 = 1.85
  const bb = [V(-0.62, y0, 1.0), V(0.62, y0, 1.0), V(0.58, y0, -0.85), V(-0.58, y0, -0.85)] // bottom: back L, back R, front R, front L
  const tt = [V(-0.74, y1, 1.08), V(0.74, y1, 1.08), V(0.7, y1, -1.2), V(-0.7, y1, -1.2)]
  quad(bb[0], bb[1], bb[2], bb[3])
  quad(bb[3], bb[2], tt[2], tt[3]) // front
  quad(bb[1], bb[0], tt[0], tt[1]) // back
  quad(bb[0], bb[3], tt[3], tt[0]) // left
  quad(bb[2], bb[1], tt[1], tt[2]) // right
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  g.computeVertexNormals()
  return { geo: g, top: tt, bottom: bb }
}

const up = new Vector3(0, 1, 0)
const tmpQ = new Quaternion()
// A round bar between two points.
function bar(parent, a, b, r, mat) {
  const d = new Vector3().subVectors(b, a)
  const m = put(parent, new CylinderGeometry(r, r, d.length(), 8), mat)
  m.position.copy(a).addScaledVector(d, 0.5)
  tmpQ.setFromUnitVectors(up, d.normalize())
  m.quaternion.copy(tmpQ)
  return m
}

const STYLE = {
  classic: { grip: '#e8262b' },
  bubblegum: { grip: '#ff3fb8', bubble: '#ffb3e6' },
  racer: { grip: '#1b1f2e', spoiler: '#1b1f2e' },
  ocean: { grip: '#ffffff', bars: '#e8f6ff' },
  gold: { grip: '#8a5a12', metal: true },
  neon: { grip: '#1b1f2e', glow: true },
  rocket: { grip: '#e8262b', rocket: true },
  candy: { grip: '#ffffff', candy: true },
  lava: { grip: '#1b1012', wireColor: '#3a1410', lava: true },
  galaxy: { grip: '#ffd23a', wireColor: '#4a2aa8', galaxy: true },
}

export function buildCart(cart) {
  const s = STYLE[cart.style.replace(/^cart-/, '')] ?? STYLE.classic
  const root = new Group()
  const animated = new Group()
  const color = cart.color
  const wireColor = s.wireColor ?? color
  const wireMat = new MeshStandardMaterial({
    color: wireColor,
    map: wire(),
    alphaTest: 0.45,
    side: DoubleSide,
    metalness: s.metal ? 0.85 : 0.45,
    roughness: s.metal ? 0.25 : 0.38,
    emissive: s.glow || s.lava || s.galaxy ? color : '#000000',
    emissiveIntensity: s.glow ? 0.9 : s.lava ? 0.55 : s.galaxy ? 0.35 : 0,
  })
  const barMat = s.glow ? neon(color, 2.6) : s.lava ? neon('#ff6a1f', 2.2) : s.metal ? metal(color, { emissive: '#a87a10', emissiveIntensity: 0.25 }) : std(s.bars ?? color, { metalness: 0.5, roughness: 0.35 })
  const altMat = s.candy ? std('#ffffff', { roughness: 0.35 }) : barMat
  const { geo, top, bottom } = basketGeo()
  put(root, geo, wireMat)
  // rim along the top edge and the bottom frame
  for (let i = 0; i < 4; i++) bar(root, top[i], top[(i + 1) % 4], 0.045, i % 2 && s.candy ? altMat : barMat)
  for (let i = 0; i < 4; i++) bar(root, bottom[i], bottom[(i + 1) % 4], 0.035, barMat)
  // vertical corner posts of the basket
  for (let i = 0; i < 4; i++) bar(root, bottom[i], top[i], 0.035, i % 2 && s.candy ? altMat : barMat)
  // chassis: lower tray rails + legs down to the casters
  const dark = std('#2a2e3a', { metalness: 0.5, roughness: 0.4 })
  const legs = [new Vector3(-0.55, 0.32, 1.0), new Vector3(0.55, 0.32, 1.0), new Vector3(0.5, 0.32, -0.95), new Vector3(-0.5, 0.32, -0.95)]
  for (let i = 0; i < 4; i++) {
    bar(root, legs[i], bottom[i], 0.04, barMat)
    bar(root, legs[i], legs[(i + 1) % 4], 0.03, barMat)
    // caster: fork + black wheel
    put(root, new BoxGeometry(0.06, 0.16, 0.14), dark, legs[i].x, 0.26, legs[i].z)
    put(root, new CylinderGeometry(0.15, 0.15, 0.1, 14).rotateZ(Math.PI / 2), std('#1b1d24', { roughness: 0.8 }), legs[i].x, 0.15, legs[i].z)
  }
  put(root, new BoxGeometry(1.0, 0.03, 1.8), wireMat, 0, 0.34, 0.02)
  // handle: two arms back from the top corners, the bar, the grip
  const hA = new Vector3(-0.7, 2.05, 1.38)
  const hB = new Vector3(0.7, 2.05, 1.38)
  bar(root, top[0], hA, 0.04, barMat)
  bar(root, top[1], hB, 0.04, barMat)
  bar(root, hA, hB, 0.045, barMat)
  put(root, new CylinderGeometry(0.075, 0.075, 1.1, 12).rotateZ(Math.PI / 2), s.candy ? std('#ff3b5a') : std(s.grip, { roughness: 0.5 }), 0, 2.05, 1.38)
  // style extras
  if (s.spoiler) {
    put(root, new BoxGeometry(1.7, 0.08, 0.5), std(s.spoiler, { roughness: 0.4 }), 0, 2.32, 1.3)
    for (const x of [-0.6, 0.6]) put(root, new BoxGeometry(0.06, 0.3, 0.2), std(s.spoiler), x, 2.18, 1.32)
    put(root, new BoxGeometry(0.22, 0.02, 1.95), std('#1b1f2e'), 0, 0.84, 0.07)
  }
  if (s.bubble) {
    const b = put(animated, new IcosahedronGeometry(0.42, 2), new MeshStandardMaterial({ color: s.bubble, transparent: true, opacity: 0.75, roughness: 0.1, emissive: '#ff6ad0', emissiveIntensity: 0.2 }), 0.55, 2.45, 1.38)
    animated.userData.tick = (dt, t) => b.scale.setScalar(1 + Math.sin(t * 2.4) * 0.12)
  }
  if (s.rocket) {
    const red = std('#e8262b', { roughness: 0.35 })
    const nose = put(root, new ConeGeometry(0.5, 0.9, 16).rotateX(-Math.PI / 2), red, 0, 1.3, -1.6)
    nose.scale.set(1.2, 0.95, 1)
    for (const x of [-0.82, 0.82]) {
      const fin = put(root, new BoxGeometry(0.06, 0.7, 0.6), red, x, 1.45, 0.8)
      fin.rotation.z = x > 0 ? -0.3 : 0.3
      put(root, new CylinderGeometry(0.17, 0.2, 1.0, 12).rotateX(Math.PI / 2), std('#c9d2dc', { metalness: 0.7, roughness: 0.3 }), x * 0.55, 0.6, 1.1)
    }
    const flames = []
    for (const x of [-0.45, 0.45]) flames.push(put(animated, new ConeGeometry(0.16, 0.7, 10).rotateX(Math.PI / 2), additive('#ffb21f', 0.85), x, 0.6, 1.92, false))
    animated.userData.tick = (dt, t) => flames.forEach((f, i) => f.scale.set(1, 1, 0.75 + Math.abs(Math.sin(t * 17 + i * 2)) * 0.6))
  }
  if (s.lava) for (let i = 0; i < 5; i++) put(root, new BoxGeometry(0.22, 0.12, 0.22), glowMat('#ff7a1f', 2), -0.35 + (i % 3) * 0.35, 0.9, -0.6 + i * 0.35)
  if (s.galaxy) for (let i = 0; i < 6; i++) put(root, new IcosahedronGeometry(0.06, 0), glowMat('#ffffff', 2.5), Math.sin(i * 2.1) * 0.55, 1.1 + (i % 3) * 0.25, Math.cos(i * 1.7) * 0.8, false)
  return { root, animated }
}

const STATUS = {
  equipped: { text: 'EQUIPPED', color: '#ffd23a' },
  owned: { text: 'OWNED', color: '#4dff6a' },
  unlocked: { text: 'BUY!', color: '#4dff6a' },
  locked: { text: 'LOCKED', color: '#ff3b3b' },
}

// Returns the game's `pads`: { index, x, z, y (pad top), half, setState(state) }.
export function buildCartShop(root, fx) {
  const ticks = []
  const pads = []
  // raised back step + the white pads
  const stepGeos = [legoBoxGeo(9.5, 0.75, 28.5, -39.25, 0.375, -8.75)]
  solid(4.75, 0.375, 14.25, -39.25, 0.375, -8.75)
  root.add(mergedMesh(stepGeos, legoMat(C.path)))
  const padGeos = []
  const panelGeos = []
  const stripeMats = new Map()
  const stripes = []
  let front = 0
  let back = 0
  SLINGSHOTS.forEach((c, index) => {
    const x = c.row === 0 ? -30 : -38.5
    const z = c.row === 0 ? -21 + front++ * 5 : -18.5 + back++ * 5
    const y = c.row === 0 ? 0 : 0.75
    padGeos.push(legoBoxGeo(4.4, 0.4, 4.6, x, y + 0.2, z))
    panelGeos.push(legoBoxGeo(3.4, 0.12, 3.6, x, y + 0.46, z))
    solid(2.2, (y + 0.52) / 2, 2.3, x, (y + 0.52) / 2, z)
    // coloured guide stripes on the pad (cart colour), like a parking bay
    if (!stripeMats.has(c.color)) stripeMats.set(c.color, glowMat(c.color, 0.6))
    for (const s of [-1, 1]) stripes.push({ x: x + s * 1.95, y: y + 0.42, z, mat: stripeMats.get(c.color) })
    // the cart itself (nose east, toward the shoppers), solid so you walk onto the pad around it
    const model = buildCart(c)
    const g = placed(root, x, y + 0.52, z, -Math.PI / 2)
    const anim = model.animated
    model.root.remove(anim)
    g.add(bake(model.root, true))
    g.add(anim)
    if (anim.userData.tick) ticks.push(anim.userData.tick)
    solid(1.0, 1.0, 0.75, x, y + 1.5, z)
    const sign = makeSign(0.62)
    sign.position.set(x, y + 4.1, z)
    root.add(sign)
    pads.push({
      index,
      x,
      z,
      y: y + 0.52,
      half: 2.2,
      setState(st) {
        const status = STATUS[st] ?? STATUS.locked
        sign.set([
          { ...status, size: 0.55, pill: true },
          { text: c.name, size: 0.8 },
          ...(c.tag ? [{ text: c.tag, size: 0.6 }] : [{ text: `+${c.fly}% FLY`, size: 0.85 }]),
          { text: `+${fmtWins(c.skill)} Power / click`, icon: 'bolt', size: 0.5, color: '#7fe7ff' },
          c.price === 0 ? { text: 'FREE', color: '#ffd23a', size: 0.75 } : { text: `${fmtWins(c.price)} Wins`, icon: 'trophy', color: '#ffd23a', size: 0.75 },
        ])
      },
    })
    // style particles
    if (c.style === 'cart-neon') emitAt(fx, x, y + 1.6, z, { rate: 6, spread: 2.2, spreadY: 1.2, speed: 0.3, life: 1.2, size: 0.3, color: ['#2af0ff', '#bff9ff'], shape: 'star' })
    if (c.style === 'cart-lava') emitAt(fx, x, y + 1.2, z, { rate: 8, spread: 1.6, spreadY: 0.4, speed: 0.6, up: 1, lift: 1.2, life: 1.1, size: 0.22, sizeEnd: 0.05, color: ['#ff7a1f', '#ffcf3a', '#ff3b1f'] })
    if (c.style === 'cart-galaxy') emitAt(fx, x, y + 1.6, z, { rate: 7, spread: 2.4, spreadY: 1.6, speed: 0.2, life: 1.6, size: 0.3, color: ['#b45cff', '#ffffff', '#5fd0ff'], shape: 'star' })
    if (c.style === 'cart-gold') emitAt(fx, x, y + 1.6, z, { rate: 3, spread: 2, spreadY: 1.2, speed: 0.2, life: 1.3, size: 0.28, color: ['#fff27a', '#ffcf3a'], shape: 'star' })
  })
  root.add(mergedMesh(padGeos, legoMat('#f6f4ff')))
  root.add(mergedMesh(panelGeos, legoMat('#e4e0ff'), { cast: false }))
  const stripeGeo = new BoxGeometry(0.16, 0.06, 3.6)
  for (const s of stripes) {
    const m = new Mesh(stripeGeo, s.mat)
    m.position.set(s.x, s.y, s.z)
    root.add(m)
  }
  const title = makeSign(3.0)
  title.set([{ text: 'CART SHOP', icon: 'shop', color: '#ffd23a', outline: '#3a2a10' }])
  title.position.set(-37, 8.6, -8.5)
  root.add(title)
  return {
    pads,
    update(dt, t) {
      for (const f of ticks) f(dt, t)
    },
  }
}

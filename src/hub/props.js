import {
  AdditiveBlending,
  BoxGeometry,
  CircleGeometry,
  CylinderGeometry,
  ConeGeometry,
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
  RingGeometry,
  Shape,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
  Vector2,
} from 'three'
import { EGGS, HUB, HUB_BOARDS, HUB_LAUNCH_TYPES, STAND_PETS } from '../config.js'
import { canvasTex, legoBoxGeo, legoMat, mergedMesh, withTop } from '../legokit.js'
import { bake } from '../bake.js'
import { buildEgg, makeSign } from '../props.js'
import { buildPet } from '../petModels.js'
import { neon } from '../propkit.js'
import { mulberry32, paintSoftDot } from '../textures.js'
import { additive, C, emitAt, fmtWins, glowMat, metal, outlined, placed, put, rrect, solid, solidCylinder, std } from './kit.js'

// The hub's set pieces, each returning the handle game.js drives: the WORLDS portal (the World 2
// gate), the limited pet stands (STAND_PETS), the egg court (EGGS: eggs on wooden crates, the
// Exclusive egg on a glowing pedestal with a light beam, the Race egg on a pink one), the daily
// chest (the Free Rewards chest), street lamps, the four stage leaderboards and the Possible
// Launches board.

// --- WORLDS portal --------------------------------------------------------------------------------
function paintSwirl() {
  const S = 256
  const c = document.createElement('canvas')
  c.width = c.height = S
  const g = c.getContext('2d')
  const grd = g.createRadialGradient(S / 2, S / 2, 4, S / 2, S / 2, S / 2)
  grd.addColorStop(0, '#ffffff')
  grd.addColorStop(0.25, '#8ff4ff')
  grd.addColorStop(0.6, '#1f9dff')
  grd.addColorStop(1, '#0a3fc8')
  g.fillStyle = grd
  g.beginPath()
  g.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2)
  g.fill()
  g.strokeStyle = 'rgba(255,255,255,0.55)'
  g.lineWidth = 7
  for (let k = 0; k < 5; k++) {
    g.beginPath()
    for (let a = 0; a < 7; a += 0.05) {
      const r = a * 17
      const x = S / 2 + Math.cos(a + (k * Math.PI * 2) / 5) * r
      const y = S / 2 + Math.sin(a + (k * Math.PI * 2) / 5) * r
      if (a === 0) g.moveTo(x, y)
      else g.lineTo(x, y)
    }
    g.stroke()
  }
  const t = canvasTex(c)
  t.center.set(0.5, 0.5)
  return t
}
export function buildPortal(root, fx) {
  const { x, z } = HUB.portal
  const g = placed(root, x, 0, z, Math.PI / 4) // faces south-east, toward the main path
  const stat = new Group()
  g.add(stat)
  const lav = std('#9b8cff', { roughness: 0.45 })
  const lav2 = std('#c4b8ff', { roughness: 0.45 })
  const gold = metal('#ffcf3a', { emissive: '#c88a10', emissiveIntensity: 0.35 })
  // tiered round base with a glowing rim
  put(stat, new CylinderGeometry(4.4, 4.7, 0.45, 40), std('#5a4ad8'), 0, 0.22, 0)
  put(stat, new CylinderGeometry(4.45, 4.45, 0.08, 40), glowMat('#3fe0ff', 2.2), 0, 0.47, 0, false)
  put(stat, new CylinderGeometry(3.7, 3.9, 0.4, 40), lav, 0, 0.7, 0)
  put(stat, new CylinderGeometry(3.0, 3.1, 0.2, 40), lav2, 0, 1.0, 0)
  // ring + inner gold ring
  const R = 3.0
  const ringY = R + 1.5
  put(stat, new TorusGeometry(R, 0.5, 16, 56), lav2, 0, ringY, 0)
  put(stat, new TorusGeometry(R - 0.45, 0.12, 10, 56), gold, 0, ringY, 0.12)
  put(stat, new TorusGeometry(R + 0.48, 0.1, 10, 56), gold, 0, ringY, 0.1)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    put(stat, new OctahedronGeometry(0.26), glowMat(i % 2 ? '#3fe0ff' : '#ff6af0', 1.4), Math.cos(a) * R, ringY + Math.sin(a) * R, 0.5, false)
  }
  // feet holding the ring
  for (const s of [-1, 1]) put(stat, new BoxGeometry(0.9, 1.6, 0.9), lav, s * 1.9, 1.7, 0)
  // left pillar with an orange ringed planet, right pillar with a green orb
  put(stat, new CylinderGeometry(0.35, 0.45, 3.6, 12), lav, -4.2, 2.6, 0.6)
  put(stat, new CylinderGeometry(0.3, 0.3, 3.0, 12), lav, 4.2, 2.3, 0.6)
  const planet = new Group()
  planet.position.set(-4.2, 5.2, 0.6)
  g.add(planet)
  put(planet, new SphereGeometry(0.8, 24, 16), std('#ff9a2a', { roughness: 0.5, emissive: '#c84a00', emissiveIntensity: 0.25 }))
  const pring = put(planet, new TorusGeometry(1.25, 0.09, 8, 40), std('#ffd27a'))
  pring.rotation.x = 1.2
  const orb = put(g, new SphereGeometry(0.55, 20, 14), glowMat('#3dff8a', 0.9), 4.2, 4.3, 0.6)
  const star = put(g, new OctahedronGeometry(0.6), glowMat('#ffd23a', 1.2), 0, ringY + R + 1.0, 0)
  // swirling vortex (two discs) + glow
  const swirl = paintSwirl()
  const disc = put(g, new CircleGeometry(R - 0.35, 48), new MeshBasicMaterial({ map: swirl, side: DoubleSide }), 0, ringY, 0, false)
  disc.material.color.setRGB(1.25, 1.25, 1.35)
  const disc2 = put(g, new PlaneGeometry(R * 1.7, R * 1.7), new MeshBasicMaterial({ map: swirl, transparent: true, opacity: 0.55, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }), 0, ringY, 0.06, false)
  const halo = put(g, new RingGeometry(R + 0.6, R + 1.6, 48), additive('#5fd8ff', 0.25), 0, ringY, -0.05, false)
  const light = new PointLight('#4fc8ff', 22, 18, 2)
  light.position.set(0, ringY, 2)
  g.add(light)
  const sign = makeSign(1.5)
  sign.set([{ text: 'WORLDS', color: '#5fd8ff', icon: 'star' }, { text: 'Walk in to travel!', size: 0.48 }])
  sign.position.set(0, ringY + R + 3.2, 0)
  g.add(sign)
  // colliders: the base is low enough to walk onto; the ring feet and pillars are solid
  solidCylinder(4.4, 0.45, x, z)
  emitAt(fx, x, ringY, z, { rate: 16, spread: R * 1.7, spreadY: R * 1.7, speed: 0.2, swirl: 2.4, life: 1.4, size: 0.42, color: ['#bff6ff', '#5fd8ff', '#ff9af0'], shape: 'star' })
  emitAt(fx, x, 0.6, z, { rate: 10, spread: 7, spreadY: 0.2, speed: 0.6, dir: [0, 1, 0], jitter: 0.2, life: 1.6, size: 0.3, color: ['#3fe0ff', '#ffffff'] })
  g.add(bake(stat, true))
  g.remove(stat)
  return {
    pos: { x, z },
    update(dt, t) {
      swirl.rotation -= dt * 2.4
      disc2.rotation.z += dt * 1.1
      planet.rotation.y += dt * 0.8
      orb.position.y = 4.3 + Math.sin(t * 2) * 0.15
      star.rotation.y += dt * 1.5
      halo.scale.setScalar(1 + Math.sin(t * 3) * 0.04)
      light.intensity = 20 + Math.sin(t * 3) * 5
    },
  }
}

// --- Limited pet stands (STAND_PETS) ---------------------------------------------------------
// A purple pedestal with a gold band of lights and a glowing magenta top; the pet turns slowly on it.
export function buildStands(root, fx) {
  const stands = []
  const ticks = []
  for (const sp of STAND_PETS) {
    const big = sp.id === 'seraph'
    const k = big ? 1 : 0.75
    const g = placed(root, sp.x, 0, sp.z)
    const stat = new Group()
    g.add(stat)
    put(stat, new CylinderGeometry(1.75 * k, 1.9 * k, 0.5, 32), std('#3a2fb8'), 0, 0.25, 0)
    put(stat, new CylinderGeometry(1.82 * k, 1.82 * k, 0.32, 32), metal('#ffcf3a', { emissive: '#c88a10', emissiveIntensity: 0.3 }), 0, 0.62, 0)
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2
      put(stat, new SphereGeometry(0.09, 8, 6), glowMat('#ffffff', 1.5), Math.cos(a) * 1.84 * k, 0.62, Math.sin(a) * 1.84 * k, false)
    }
    put(stat, new CylinderGeometry(1.5 * k, 1.6 * k, 0.45, 32), std('#7a3cff'), 0, 1.0, 0)
    put(stat, new CylinderGeometry(1.42 * k, 1.42 * k, 0.08, 32), glowMat('#ff4fe0', 1.8), 0, 1.26, 0, false)
    g.add(bake(stat, true))
    g.remove(stat)
    const pet = buildPet(sp.look)
    pet.scale.setScalar(big ? 2.4 : 1.7)
    pet.position.y = 1.3
    g.add(pet)
    const sign = makeSign(big ? 0.62 : 0.5)
    sign.set([
      { text: 'LIMITED', color: '#ffffff', size: 0.6, pill: true },
      { text: sp.name.toUpperCase(), color: '#ffd23a', size: 0.75 },
      { text: `${fmtWins(sp.price)} Wins`, icon: 'trophy', color: '#7dff5a', size: 0.7 },
      { text: `${sp.stock.toLocaleString('en-US')}/${sp.stock.toLocaleString('en-US')} LEFT`, size: 0.6 },
    ])
    sign.position.set(0, big ? 6.4 : 4.4, 0)
    g.add(sign)
    solidCylinder(1.9 * k, 1.3, sp.x, sp.z)
    emitAt(fx, sp.x, 2.6, sp.z, { rate: big ? 8 : 4, spread: 3 * k, spreadY: 2.4, speed: 0.25, life: 1.4, size: 0.38, color: ['#fff27a', '#ffcf3a', '#ff9af0'], shape: 'star' })
    ticks.push((dt, t) => {
      pet.rotation.y += dt * 0.7
      pet.position.y = 1.35 + Math.sin(t * 2 + sp.x) * 0.15
      const w = pet.userData.wings
      if (w) for (const c of w.children) c.rotation.z = c.userData.side * (0.3 + Math.sin(t * 6) * 0.35)
    })
    stands.push({ data: sp, x: sp.x, z: sp.z })
  }
  return { stands, update: (dt, t) => ticks.forEach((f) => f(dt, t)) }
}

// --- Eggs ------------------------------------------------------------------------------------------
function buildCrate() {
  const root = new Group()
  const wood = std('#9a5a2a', { roughness: 0.8 })
  const dark = std('#6a3818', { roughness: 0.85 })
  const iron = std('#3a3a44', { metalness: 0.6, roughness: 0.4 })
  put(root, new BoxGeometry(2.3, 0.7, 1.7), wood, 0, 0.35, 0)
  for (const z of [-0.45, 0.0, 0.45]) put(root, new BoxGeometry(2.34, 0.08, 0.08), dark, 0, 0.72, z)
  for (const s of [-1, 1]) {
    put(root, new BoxGeometry(0.12, 0.74, 1.74), dark, s * 1.1, 0.37, 0)
    put(root, new BoxGeometry(2.34, 0.12, 0.12), dark, 0, 0.12, s * 0.82)
    for (const t of [-1, 1]) put(root, new BoxGeometry(0.16, 0.16, 0.16), iron, s * 1.12, 0.62, t * 0.82)
  }
  return root
}
// The egg court (EGGS positions): eggs on wooden crates, the Exclusive egg on a glowing pedestal with
// a light beam, the Race egg on a pink pedestal. Returns the game's `eggs` handles (eggs.js).
const EGG_COLORS = { common: '#ffffff', uncommon: '#7dff5a', rare: '#5fd0ff', rainbow: '#ffd23a', exclusive: '#ff6af0', race: '#ffffff' }
export function buildEggCourt(root, fx) {
  const eggs = []
  const ticks = []
  EGGS.forEach((e, i) => {
    const { x, z } = e
    const g = placed(root, x, 0, z, -x * 0.035) // crates turn a little toward the middle
    const mythic = e.look === 'exclusive'
    let topY
    if (mythic) {
      const stand = new Group()
      put(stand, new BoxGeometry(2.2, 0.5, 2.2), std('#6a2ad8'), 0, 0.25, 0)
      put(stand, new BoxGeometry(2.3, 0.1, 2.3), glowMat('#ff4fe0', 2.2), 0, 0.55, 0, false)
      put(stand, new BoxGeometry(1.7, 0.4, 1.7), std('#9a5cff'), 0, 0.8, 0)
      g.add(bake(stand, true))
      topY = 1.0
      // light beam + glow disc + light
      const beamTex = canvasTex(paintSoftDot(64))
      const beam = put(g, new CylinderGeometry(0.95, 1.25, 10, 24, 1, true), new MeshBasicMaterial({ color: '#ff8af5', transparent: true, opacity: 0.28, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }), 0, 5.6, 0, false)
      const disc = put(g, new PlaneGeometry(3.6, 3.6).rotateX(-Math.PI / 2), new MeshBasicMaterial({ map: beamTex, color: '#ff6af0', transparent: true, opacity: 0.9, blending: AdditiveBlending, depthWrite: false }), 0, 1.02, 0, false)
      const light = new PointLight('#d06aff', 14, 12, 2)
      light.position.set(0, 2.4, 1)
      g.add(light)
      ticks.push((dt, t) => {
        beam.material.opacity = 0.22 + Math.sin(t * 2.5) * 0.08
        disc.scale.setScalar(1 + Math.sin(t * 3) * 0.08)
        light.intensity = 12 + Math.sin(t * 2.5) * 4
      })
      emitAt(fx, x, 2.5, z, { rate: 12, spread: 2.2, spreadY: 3, dir: [0, 1, 0], speed: 0.8, jitter: 0.3, life: 1.8, size: 0.38, color: ['#ff9af5', '#c48aff', '#ffffff'], shape: 'star' })
      solid(1.1, 0.5, 1.1, x, 0.5, z)
    } else if (e.currency === 'tokens') {
      const stand = new Group()
      put(stand, new CylinderGeometry(1.4, 1.5, 0.4, 24), std('#ff5fd0'), 0, 0.2, 0)
      put(stand, new CylinderGeometry(1.15, 1.25, 0.35, 24), std('#ff8ae0'), 0, 0.57, 0)
      g.add(bake(stand, true))
      topY = 0.75
      solidCylinder(1.5, 0.75, x, z)
    } else {
      g.add(bake(buildCrate(), true))
      topY = 0.76
      solid(1.15, 0.38, 0.85, x, 0.38, z)
    }
    const egg = buildEgg(e.look)
    egg.position.y = topY
    egg.scale.setScalar(1.1)
    g.add(egg)
    const sign = makeSign(0.6)
    const price = e.currency === 'tokens' ? { text: `${e.price} Race Tokens`, icon: 'token', color: '#ffd23a', size: 0.7 } : { text: `${fmtWins(e.price)} Wins`, icon: 'trophy', color: '#ffd23a', size: 0.75 }
    sign.set([{ text: e.name.replace(/ Egg$/, '').toUpperCase(), color: EGG_COLORS[e.look] ?? '#ffffff', size: 1, outline: '#1b1f2e' }, price])
    sign.position.set(0, mythic ? 4.6 : 3.7, 0)
    g.add(sign)
    eggs.push({ data: e, x, z, egg, topY, sign, phase: i * 1.3 })
  })
  return {
    eggs,
    update(dt, t) {
      for (const e of eggs) {
        e.egg.rotation.y = Math.sin(t * 0.8 + e.phase) * 0.35
        e.egg.position.y = e.topY + Math.max(0, Math.sin(t * 2 + e.phase)) * 0.06
      }
      for (const f of ticks) f(dt, t)
    },
  }
}

// --- Daily chest -------------------------------------------------------------------------------------
export function buildDailyChest(root, fx) {
  const x = -9
  const z = 47.5
  const g = placed(root, x, 0, z, 0.5)
  const stat = new Group()
  g.add(stat)
  put(stat, new CylinderGeometry(2.3, 2.45, 0.35, 40), std('#2fa8d8'), 0, 0.17, 0)
  put(stat, new CylinderGeometry(2.1, 2.1, 0.1, 40), glowMat('#5ff0ff', 1.6), 0, 0.39, 0, false)
  const orange = std('#ff9a1f', { roughness: 0.5 })
  const band = std('#c85a10', { roughness: 0.5 })
  const gold = metal('#ffd23a', { emissive: '#c88a10', emissiveIntensity: 0.3 })
  put(stat, new BoxGeometry(2.6, 1.3, 1.8), orange, 0, 1.1, 0)
  for (const s of [-1, 1]) {
    put(stat, new BoxGeometry(0.22, 1.36, 1.86), band, s * 0.85, 1.1, 0)
    put(stat, new BoxGeometry(0.18, 1.4, 1.9), gold, s * 1.3, 1.1, 0)
  }
  put(stat, new BoxGeometry(2.7, 0.18, 1.9), gold, 0, 1.78, 0)
  g.add(bake(stat, true))
  g.remove(stat)
  const lid = new Group()
  lid.position.set(0, 1.8, -0.9)
  g.add(lid)
  put(lid, new CylinderGeometry(0.9, 0.9, 2.6, 18, 1, false, 0, Math.PI).rotateZ(Math.PI / 2), orange, 0, 0, 0.9)
  for (const s of [-1, 1]) put(lid, new CylinderGeometry(0.93, 0.93, 0.22, 18, 1, false, 0, Math.PI).rotateZ(Math.PI / 2), gold, s * 1.25, 0, 0.9)
  put(lid, new CylinderGeometry(0.92, 0.92, 0.2, 18, 1, false, 0, Math.PI).rotateZ(Math.PI / 2), band, 0.85, 0, 0.9)
  put(lid, new CylinderGeometry(0.92, 0.92, 0.2, 18, 1, false, 0, Math.PI).rotateZ(Math.PI / 2), band, -0.85, 0, 0.9)
  // lock with a pink gem
  put(g, new BoxGeometry(0.62, 0.7, 0.2), gold, 0, 1.6, 0.95)
  put(g, new OctahedronGeometry(0.2), glowMat('#ff3fa8', 1.2), 0, 1.6, 1.08)
  const rings = []
  for (let i = 0; i < 2; i++) rings.push(put(g, new RingGeometry(2.4 + i * 0.5, 2.65 + i * 0.5, 48).rotateX(-Math.PI / 2), additive('#5ff0ff', 0.45 - i * 0.15), 0, 0.42 + i * 0.01, 0, false))
  const sign = makeSign(0.95) // text set by game.js refreshSigns (ready / refill timer)
  sign.position.set(0, 4.3, 0)
  g.add(sign)
  solid(1.3, 1.0, 0.95, x, 1.0, z, 0.5)
  solidCylinder(2.3, 0.35, x, z)
  emitAt(fx, x, 1.8, z, { rate: 6, spread: 3, spreadY: 1.5, speed: 0.3, life: 1.3, size: 0.35, color: ['#fff27a', '#5ff0ff', '#ffffff'], shape: 'star' })
  return {
    chest: { x, z, sign },
    update(dt, t) {
      lid.rotation.x = -0.05 - Math.max(0, Math.sin(t * 1.7)) * 0.12
      rings.forEach((r, i) => {
        const k = (t * 0.6 + i * 0.5) % 1
        r.scale.setScalar(0.9 + k * 0.25)
        r.material.opacity = (0.5 - i * 0.15) * (1 - k)
      })
    },
  }
}

// --- Street lamps ----------------------------------------------------------------------------------
export function buildLamps(root) {
  const spots = [[-6.5, 43.5], [6.5, 43.5], [-6.5, 29.5], [6.5, 29.5], [-6.5, -4], [7, 13.5], [-25, -21], [25, -21], [-24, 34.5], [20, 32]]
  const posts = []
  const heads = []
  const lights = []
  for (const [x, z] of spots) {
    posts.push(legoBoxGeo(0.32, 3.6, 0.32, x, 1.8, z))
    posts.push(legoBoxGeo(0.7, 0.3, 0.7, x, 0.15, z))
    posts.push(legoBoxGeo(0.8, 0.18, 0.8, x, 3.65, z))
    posts.push(legoBoxGeo(0.86, 0.14, 0.86, x, 4.5, z))
    heads.push(legoBoxGeo(0.62, 0.62, 0.62, x, 4.06, z))
    solidCylinder(0.25, 3.6, x, z)
  }
  root.add(mergedMesh(posts, legoMat('#1f2440')))
  root.add(mergedMesh(heads, new MeshStandardMaterial({ color: '#ffffff', emissive: '#fff6d8', emissiveIntensity: 1.6 }), { cast: false }))
  const glowTex = canvasTex(paintSoftDot(64))
  for (const [x, z] of spots) {
    const s = new Sprite(new SpriteMaterial({ map: glowTex, color: '#fff3c8', transparent: true, opacity: 0.75, blending: AdditiveBlending, depthWrite: false }))
    s.scale.set(2.6, 2.6, 1)
    s.position.set(x, 4.06, z)
    root.add(s)
    lights.push(s)
  }
  return (dt, t) => lights.forEach((s, i) => (s.material.opacity = 0.65 + Math.sin(t * 2 + i) * 0.08))
}

// --- Stage leaderboards ---------------------------------------------------------------------------
function paintBoard(title, rows, unit) {
  const W = 640
  const H = 448
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')
  g.fillStyle = '#1e8f34'
  g.fillRect(0, 0, W, H)
  g.fillStyle = '#29a83f'
  g.fillRect(14, 14, W - 28, H - 28)
  g.font = '700 20px Fredoka, Arial, sans-serif'
  g.textBaseline = 'middle'
  g.fillStyle = '#d8ffd8'
  g.textAlign = 'left'
  g.fillText('#', 30, 34)
  g.fillText('PLAYER', 110, 34)
  g.textAlign = 'right'
  g.fillText(unit, W - 30, 34)
  for (let i = 0; i < 10; i++) {
    const y = 56 + i * 32
    g.fillStyle = i % 2 ? 'rgba(10,80,25,0.55)' : 'rgba(40,150,60,0.55)'
    g.fillRect(22, y, W - 44, 30)
    const row = rows[i]
    g.textAlign = 'left'
    g.fillStyle = i < 3 ? ['#ffd23a', '#e6eef6', '#ffb27a'][i] : '#ffffff'
    g.font = '700 20px Fredoka, Arial, sans-serif'
    g.fillText(`#${i + 1}`, 30, y + 16)
    g.beginPath()
    g.arc(90, y + 15, 10, 0, Math.PI * 2)
    g.fillStyle = row?.color ?? '#5a7a5a'
    g.fill()
    g.fillStyle = row?.me ? '#ffff6a' : '#ffffff'
    g.fillText(row?.name ?? '-', 110, y + 16)
    g.textAlign = 'right'
    g.fillStyle = '#ffffff'
    g.fillText(row?.value ?? '', W - 30, y + 16)
  }
  const me = rows.find((r) => r.me)
  g.textAlign = 'center'
  g.fillStyle = '#ffff9a'
  g.font = '700 22px Fredoka, Arial, sans-serif'
  g.fillText(`YOUR ${title.replace(/^Top /, '').toUpperCase()}: ${me?.value ?? '0'}`, W / 2, H - 50)
  g.fillStyle = '#c8f5c8'
  g.font = '600 16px Fredoka, Arial, sans-serif'
  g.fillText('GLOBAL TOP 10', W / 2, H - 26)
  return c
}
export function buildBoards(root) {
  const boards = []
  // a shallow arc; each board faces north, the outer ones turned toward the middle
  // listed east -> west, i.e. left -> right as you face the stage (south)
  const spots = [[19.5, 57, 0.32], [6.5, 59, 0.08], [-6.5, 59, -0.08], [-19.5, 57, -0.32]]
  HUB_BOARDS.forEach(([title, stat, unit], i) => {
    const [x, z, yaw] = spots[i]
    const g = placed(root, x, 1.5, z, yaw)
    const stat0 = new Group()
    g.add(stat0)
    const wood = std('#8a4a22', { roughness: 0.8 })
    const dark = std('#5a2e14', { roughness: 0.85 })
    const BW = 11
    const BH = 6.6
    for (const s of [-1, 1]) put(stat0, new BoxGeometry(0.6, BH + 1.6, 0.6), dark, s * (BW / 2 + 0.1), (BH + 1.6) / 2, 0.2)
    put(stat0, new BoxGeometry(BW + 0.8, BH + 0.6, 0.4), wood, 0, BH / 2 + 1.1, 0.2)
    put(stat0, new BoxGeometry(BW + 1.4, 0.45, 0.8), dark, 0, BH + 1.55, 0.2)
    for (let k = -2; k <= 2; k++) put(stat0, new BoxGeometry(0.8, 0.3, 0.3), std('#3cc21f'), k * 2.4, BH + 1.9, 0.2)
    g.add(bake(stat0, true))
    g.remove(stat0)
    const canvas = paintBoard(title, [], unit)
    const tex = canvasTex(canvas)
    const face = put(g, new PlaneGeometry(BW - 0.2, BH - 0.2), new MeshStandardMaterial({ map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.35, roughness: 0.7 }), 0, BH / 2 + 1.1, -0.02, false)
    face.rotation.y = Math.PI
    const sign = makeSign(1.5)
    sign.set([{ text: title }])
    sign.position.set(0, BH + 3.4, 0)
    g.add(sign)
    solid(BW / 2 + 0.5, 4, 0.5, x, 5.5, z, yaw)
    boards.push({
      stat,
      set(rows) {
        const next = paintBoard(title, rows, unit)
        canvas.getContext('2d').drawImage(next, 0, 0)
        tex.needsUpdate = true
      },
    })
  })
  return boards
}

// --- Possible Launches board --------------------------------------------------------------------
function paintLaunches() {
  const W = 1024
  const H = 640
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')
  const tex = canvasTex(c)
  const draw = () => {
    g.fillStyle = '#a8662e'
    g.fillRect(0, 0, W, H)
    for (let y = 0; y < H; y += 80) {
      g.fillStyle = y % 160 ? '#9a5a26' : '#b06e34'
      g.fillRect(0, y, W, 76)
      g.fillStyle = 'rgba(60,30,10,0.35)'
      g.fillRect(0, y + 76, W, 4)
    }
    outlined(g, 'POSSIBLE LAUNCHES', W / 2, 62, { size: 70, fill: '#ffd23a', stroke: '#5a2a00' })
    HUB_LAUNCH_TYPES.forEach((l, i) => {
      const y = 160 + i * 106
      outlined(g, l.name, 60, y, { size: 46, fill: l.color, stroke: '#3a1a08', align: 'left' })
      outlined(g, l.desc, 60, y + 42, { size: 28, fill: '#fff4dc', stroke: '#3a1a08', align: 'left', width: 0.14 })
      g.fillStyle = l.pill
      rrect(g, 640, y - 26, 200, 52, 26)
      g.fill()
      outlined(g, l.rarity, 740, y, { size: 26, fill: '#ffffff', stroke: '#1b1f2e', width: 0.14 })
      outlined(g, l.odds, 960, y, { size: 30, fill: '#ffffff', stroke: '#3a1a08', width: 0.14, align: 'right' })
    })
    outlined(g, 'Luck Potions double your chances!', W / 2, H - 34, { size: 32, fill: '#7dff5a', stroke: '#1a3a08', width: 0.14 })
    tex.needsUpdate = true
  }
  draw()
  document.fonts?.load('700 70px Fredoka').then(draw)
  return tex
}
export function buildLaunchBoard(root) {
  const x = 36
  const z = -29.5
  const g = placed(root, x, 0, z, Math.PI - 0.7) // faces south-west toward the walkway
  const stat = new Group()
  g.add(stat)
  const dark = std('#5a2e14', { roughness: 0.85 })
  for (const s of [-1, 1]) put(stat, new BoxGeometry(0.45, 4.4, 0.45), dark, s * 3.3, 2.2, 0.15)
  put(stat, new BoxGeometry(7.3, 4.6, 0.3), dark, 0, 2.9, 0.15)
  put(stat, new BoxGeometry(7.6, 0.4, 0.6), dark, 0, 5.3, 0.15)
  g.add(bake(stat, true))
  g.remove(stat)
  const face = put(g, new PlaneGeometry(7.0, 4.375), new MeshStandardMaterial({ map: paintLaunches(), roughness: 0.8 }), 0, 2.9, -0.02, false)
  face.rotation.y = Math.PI
  solid(3.7, 2.6, 0.4, x, 2.6, z, Math.PI - 0.7)
}

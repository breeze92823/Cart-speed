import {
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  AdditiveBlending,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshStandardMaterial,
  NearestFilter,
  PlaneGeometry,
  RepeatWrapping,
  ShaderMaterial,
  Shape,
  Euler,
  Quaternion,
  Vector3,
} from 'three'
import { CHANNEL, CHECKER, FLY_ZONE, PLAZA, SPAWN, STUD } from '../config.js'
import { mulberry32 } from '../textures.js'
import { canvasTex, legoBoxGeo, legoMat, mergedMesh, voxelTree, withTop } from '../legokit.js'
import { terraceRun } from '../world.js'
import { C, emitAt, outlined, put, solid, solidCylinder } from './kit.js'

// The hub's ground: the lavender-path plaza on lime checker grass, the yellow LAUNCH ZONE, the
// road's ground collider (the road itself, its power lines, distance signs, region gates and
// clouds are world.js / river.js, the towns beside it roadside.js), the hub's tall checker cliffs
// with voxel trees (some pink), the leaderboard stage with the waterfall behind it, the lily pond,
// the yellow spawn pad, chevrons, and the decor (sunflowers, mushrooms, lego flowers, bricks).

const P = PLAZA
const LZ = FLY_ZONE
const HW = CHANNEL.halfWidth

// Lavender path rectangles [x0, x1, z0, z1] (local); the rest of the plaza is grass.
const PATHS = [
  [-5, 5, -26, 52], // main path: launch zone -> egg court -> stage
  [-44, 44, -26, -21.5], // walkway along the launch zone
  [-10, 6, -6, 13], // spawn hub
  [-46, -24, -25, 4], // cart shop apron
  [-24, -5, -17.5, -8], // portal square
  [-33, -24, 4, 34], // walk in front of the premium treadmills
  [-24, -5, 19.5, 24], // connector to it
  [19.5, 26, -24, 31], // walk in front of the power treadmills (east)
  [5, 19.5, 14, 18.5], // connectors east
  [5, 19.5, -16.5, -12],
  [-18, 18, 26, 46], // egg court
  [-30, 30, 46, 52], // stage front
  [6, 18, -3, 10], // pond rim
]
const WATER = [7, 17, -2, 9] // pond (inside its rim)
const NOTCHES = [
  [-10, -6.25, 9.25, 13],
  [-18, -14.25, 26, 29.75],
  [14.25, 18, 26, 29.75],
  [-46, -42.25, 0.25, 4],
  [22.25, 26, 27.25, 31],
  [-44, -40.25, -26, -24.5],
  [40.25, 44, -26, -24.5],
  [-33, -30, 30.25, 34],
  [23, 26, -24, -22.5],
]

const W = Math.round((P.maxX - P.minX) / STUD)
const H = Math.round((P.maxZ - P.minZ) / STUD)
const grid = new Uint8Array(W * H) // 0 grass, 1 path, 2 rim, 3 water, 4 launch zone
const cell = (x, z) => {
  const i = Math.floor((x - P.minX) / STUD)
  const k = Math.floor((z - P.minZ) / STUD)
  if (i < 0 || k < 0 || i >= W || k >= H) return -1
  return grid[k * W + i]
}
function fill(rects, v) {
  for (const [x0, x1, z0, z1] of rects) {
    const a = Math.max(0, Math.round((x0 - P.minX) / STUD))
    const b = Math.min(W, Math.round((x1 - P.minX) / STUD))
    const c = Math.max(0, Math.round((z0 - P.minZ) / STUD))
    const d = Math.min(H, Math.round((z1 - P.minZ) / STUD))
    for (let z = c; z < d; z++) for (let x = a; x < b; x++) grid[z * W + x] = v
  }
}
fill(PATHS, 1)
fill(NOTCHES, 0)
fill([WATER], 3)
fill([[LZ.minX, LZ.maxX, LZ.minZ, LZ.maxZ]], 4) // under the launch zone plate: not grass (no decor)
{
  const src = new Uint8Array(grid)
  for (let z = 0; z < H; z++) {
    for (let x = 0; x < W; x++) {
      if (src[z * W + x] !== 1) continue
      let edge = false
      for (let dz = -1; dz <= 1 && !edge; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx
          const nz = z + dz
          if (nx < 0 || nz < 0 || nx >= W || nz >= H) continue
          if (src[nz * W + nx] === 0) {
            edge = true
            break
          }
        }
      }
      if (edge) grid[z * W + x] = 2
    }
  }
}

// True when the whole disc around (x, z) is grass (decor placement).
export function grassAt(x, z, r = 0.8) {
  for (const [dx, dz] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]]) if (cell(x + dx, z + dz) !== 0) return false
  return true
}

function paintPlaza() {
  const PX = 4
  const c = document.createElement('canvas')
  c.width = W * PX
  c.height = H * PX
  const g = c.getContext('2d')
  const perCheck = Math.round(CHECKER / STUD)
  const ox = Math.round(P.minX / STUD)
  const oz = Math.round(P.minZ / STUD)
  for (let z = 0; z < H; z++) {
    for (let x = 0; x < W; x++) {
      const v = grid[z * W + x]
      const cx = Math.floor((ox + x) / perCheck)
      const cz = Math.floor((oz + z) / perCheck)
      g.fillStyle = v === 1 ? C.path : v === 2 ? C.rim : v === 3 ? '#2fb8e8' : v === 4 ? C.yellowA : (cx + cz) % 2 === 0 ? C.greenA : C.greenB
      g.fillRect(x * PX, z * PX, PX, PX)
    }
  }
  return c
}

// --- Painted decals --------------------------------------------------------------------------
function launchZoneDecal() {
  const Wd = LZ.maxX - LZ.minX - 1
  const Dd = LZ.maxZ - LZ.minZ - 1
  const cw = 2048
  const ch = Math.round((cw * Dd) / Wd)
  const c = document.createElement('canvas')
  c.width = cw
  c.height = ch
  const g = c.getContext('2d')
  const tex = canvasTex(c)
  const draw = () => {
    g.clearRect(0, 0, cw, ch)
    let size = ch * 0.78
    g.font = `800 ${size}px Fredoka, "Arial Black", sans-serif`
    const w = g.measureText('LAUNCH ZONE').width
    if (w > cw * 0.94) size *= (cw * 0.94) / w
    g.save()
    g.translate(cw / 2, ch / 2 + size * 0.04)
    g.transform(1, 0, -0.12, 1, 0, 0) // a slight italic lean
    outlined(g, 'LAUNCH ZONE', 0, 0, { size, fill: '#ffffff', stroke: '#2a2e38', width: 0.12, weight: 800 })
    g.restore()
    tex.needsUpdate = true
  }
  draw()
  document.fonts?.load('800 96px Fredoka').then(draw)
  const m = new Mesh(new PlaneGeometry(Wd, Dd), new MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }))
  m.rotation.x = -Math.PI / 2
  m.position.set((LZ.minX + LZ.maxX) / 2, 0.05, (LZ.minZ + LZ.maxZ) / 2)
  m.receiveShadow = true
  m.renderOrder = 2
  return m
}

// --- Small geometry helpers for merged decor ------------------------------------------------------
const mtx = new Matrix4()
const q = new Quaternion()
const e = new Euler()
const one = new Vector3(1, 1, 1)
const v = new Vector3()
function tf(geo, x, y, z, rx = 0, ry = 0, rz = 0, s = 1) {
  e.set(rx, ry, rz, 'YXZ')
  q.setFromEuler(e)
  v.set(x, y, z)
  mtx.compose(v, q, one.set(s, s, s))
  return geo.applyMatrix4(mtx)
}
const tint = new Color()
function colored(geo, hex) {
  const n = geo.attributes.position.count
  tint.set(hex)
  const arr = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    arr[i * 3] = tint.r
    arr[i * 3 + 1] = tint.g
    arr[i * 3 + 2] = tint.b
  }
  geo.setAttribute('color', new Float32BufferAttribute(arr, 3))
  return geo
}
const box = (w, h, d) => new BoxGeometry(w, h, d)

// --- Build -------------------------------------------------------------------------------------
export function buildGround(root, fx) {
  const rand = mulberry32(2207)
  const anims = []

  // Plaza floor
  const pw = P.maxX - P.minX
  const pd = P.maxZ - P.minZ
  const ptex = canvasTex(paintPlaza())
  ptex.magFilter = NearestFilter
  const floor = new Mesh(withTop(new PlaneGeometry(pw, pd).rotateX(-Math.PI / 2).translate((P.minX + P.maxX) / 2, 0, (P.minZ + P.maxZ) / 2)), legoMat('#ffffff', { map: ptex }))
  floor.receiveShadow = true
  root.add(floor)
  solid(pw / 2 + 60, 3, pd / 2 + 60, (P.minX + P.maxX) / 2, -3, (P.minZ + P.maxZ) / 2)

  // Launch zone: yellow checker plate + "LAUNCH ZONE"
  const zone = new Mesh(legoBoxGeo(LZ.maxX - LZ.minX, 2, LZ.maxZ - LZ.minZ, (LZ.minX + LZ.maxX) / 2, -0.98, (LZ.minZ + LZ.maxZ) / 2), legoMat('#ffffff', { checker: [C.yellowA, C.yellowB] }))
  zone.receiveShadow = true
  root.add(zone)
  root.add(launchZoneDecal())

  // Spawn pad (plain yellow studs) and the chevrons pointing at the launch zone
  const pad = new Mesh(legoBoxGeo(6, 0.25, 6, SPAWN.x, 0.125, SPAWN.z - 1), legoMat('#ffcf1f'))
  pad.receiveShadow = true
  root.add(pad)
  solid(3, 0.125, 3, SPAWN.x, 0.125, SPAWN.z - 1)
  root.add(chevrons())

  // Stage under the leaderboards (two lavender steps)
  const stageGeos = [legoBoxGeo(60, 0.75, 11, 0, 0.375, 57.5), legoBoxGeo(60, 0.75, 9, 0, 1.125, 58.5)]
  solid(30, 0.375, 5.5, 0, 0.375, 57.5)
  solid(30, 0.375, 4.5, 0, 1.125, 58.5)
  root.add(mergedMesh(stageGeos, legoMat(C.path)))

  // --- Along the road: the towns on both sides are roadside.js (built with the lane) -------------
  const L = CHANNEL.length
  solid(HW + 40, 3, L / 2 + 40, 0, -3, P.minZ - L / 2) // ground under the road
  solid(HW, 20, 0.5, 0, 20, P.minZ - 0.5) // walking is never allowed onto the road (launches are)
  const cliffGeos = []
  const treeSpots = []

  // --- Hub cliffs (all four sides, open where the road leaves) -----------------------------------
  const hubTiers = [
    { off: 0, jitter: 1.5, h: 3.75 },
    { off: 6, jitter: 3, h: 7.5 },
    { off: 13, jitter: 3, h: 11.25 },
    { off: 21, jitter: 4, h: 15.75 },
    { off: 30, jitter: 4, h: 21 },
  ]
  const hub = { rand, geos: cliffGeos, colliders: false, trees: treeSpots, treeEvery: 0.4, tiers: hubTiers, seg: 6 }
  terraceRun({ ...hub, along: 'z', from: P.minZ - 40, to: P.maxZ + 40, edge: P.minX, outward: -1 })
  terraceRun({ ...hub, along: 'z', from: P.minZ - 40, to: P.maxZ + 40, edge: P.maxX, outward: 1 })
  terraceRun({ ...hub, along: 'x', from: P.minX - 40, to: -10.5, edge: P.maxZ, outward: 1 })
  terraceRun({ ...hub, along: 'x', from: 10.5, to: P.maxX + 40, edge: P.maxZ, outward: 1 })
  terraceRun({ ...hub, along: 'x', from: P.minX - 40, to: -HW, edge: P.minZ, outward: -1 })
  terraceRun({ ...hub, along: 'x', from: HW, to: P.maxX + 40, edge: P.minZ, outward: -1 })
  // the tall block the waterfall pours down, behind the stage
  cliffGeos.push(legoBoxGeo(21, 27, 30, 0, 13.5 - 0.01, P.maxZ + 15))
  const cliffMat = legoMat('#ffffff', { cliff: { a: C.cliffA, b: C.cliffB, grass: C.grass, top: [C.greenA, C.greenB] } })
  root.add(mergedMesh(cliffGeos, cliffMat, { cast: false }))
  // keep everyone inside the hub
  solid(2, 20, pd, P.minX - 1.5, 10, (P.minZ + P.maxZ) / 2)
  solid(2, 20, pd, P.maxX + 1.5, 10, (P.minZ + P.maxZ) / 2)
  solid(pw, 20, 2, 0, 10, P.maxZ + 1.5)
  for (const s of [-1, 1]) solid((P.maxX - HW) / 2, 20, 0.5, s * (HW + P.maxX) / 2, 20, P.minZ - 0.5)

  // --- Trees: cliff tops + the big ones inside the plaza (some pink) -------------------------
  const PLAZA_TREES = [
    [-24, 39, 1.5], [-21.5, 45, 1.3], [-27, 47, 1.4], [-37, 41, 1.5], [-44, 48, 1.3],
    [23.5, 38, 1.5], [26, 45, 1.3], [21.5, 48, 1.4], [40, 41, 1.6], [45, 50, 1.3],
    [-16, 13, 1.3], [-20, 6, 1.2], [13, 23, 1.3], [-12, 21, 1.1], [38, -31.5, 1.3], [-38, -31.5, 1.3],
    [46, -31, 1.2], [-46, -31, 1.2], [10, 33, 0.9], [-21.5, 30, 1.1], [41, 34, 1.3], [-14, 49, 1.1], [14, 49, 1.1],
  ]
  const trunkGeos = []
  const leafGeos = []
  const pinkGeos = []
  const addTree = (x, y, z, seed, s, pink) => {
    const t = voxelTree(x, y, z, seed, s)
    trunkGeos.push(...t.trunk)
    ;(pink ? pinkGeos : leafGeos).push(...t.leaves)
  }
  treeSpots.forEach(([x, y, z], i) => {
    if (Math.abs(x) < HW + 1.5 && z < P.minZ) return
    addTree(x, y, z, 3100 + i, 0.95 + rand() * 0.6, rand() < 0.18)
  })
  PLAZA_TREES.forEach(([x, z, s], i) => {
    addTree(x, 0, z, 7700 + i, s, i % 5 === 2)
    solidCylinder(0.6 * s, 4, x, z)
  })
  root.add(mergedMesh(trunkGeos, legoMat('#6b3f1d', { roughness: 0.8 }), { cast: true }))
  root.add(mergedMesh(leafGeos, legoMat('#47d424', { roughness: 0.6 }), { cast: true }))
  root.add(mergedMesh(pinkGeos, legoMat('#ff9ee0', { roughness: 0.6 }), { cast: true }))

  // --- Pond with lily pads (shallow, walkable) --------------------------------------------------
  anims.push(buildPond(root))

  // --- Waterfall behind the stage ------------------------------------------------------------------
  anims.push(buildWaterfall(root, fx))

  // --- Decor: sunflowers, mushrooms, lego flowers, loose bricks -------------------------------
  buildDecor(root, rand)

  return {
    update(dt, t) {
      for (const a of anims) a(dt, t)
    },
  }
}

function chevrons() {
  const s = new Shape()
  const w = 3.0
  const t = 1.0
  s.moveTo(-w, -0.2)
  s.lineTo(0, -w * 0.62)
  s.lineTo(w, -0.2)
  s.lineTo(w, t - 0.2)
  s.lineTo(0, -w * 0.62 + t)
  s.lineTo(-w, t - 0.2)
  s.closePath()
  const geo = new ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.16, bevelSegments: 2 })
  geo.rotateX(-Math.PI / 2)
  const mat = new MeshStandardMaterial({ color: '#7254e6', roughness: 0.55 })
  const g = new Group()
  for (const z of [-10, -15, -20]) {
    const m = new Mesh(geo, mat)
    m.position.set(0, 0, z)
    m.receiveShadow = true
    g.add(m)
  }
  return g
}

// --- Pond -------------------------------------------------------------------------------------
function paintRipples() {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')
  g.fillStyle = '#ffffff'
  g.fillRect(0, 0, 256, 256)
  const rand = mulberry32(9)
  g.strokeStyle = 'rgba(160,240,255,0.9)'
  g.lineWidth = 3
  for (let i = 0; i < 26; i++) {
    const x = rand() * 256
    const y = rand() * 256
    g.beginPath()
    g.ellipse(x, y, 14 + rand() * 30, 6 + rand() * 10, rand() * 3, 0, Math.PI * (0.6 + rand()))
    g.stroke()
  }
  const t = canvasTex(c)
  t.wrapS = t.wrapT = RepeatWrapping
  return t
}
function buildPond(root) {
  const [x0, x1, z0, z1] = WATER
  const tex = paintRipples()
  tex.repeat.set(2, 2)
  const mat = new MeshStandardMaterial({ color: C.water, map: tex, emissive: '#0b9fd0', emissiveIntensity: 0.35, roughness: 0.06, metalness: 0.1, transparent: true, opacity: 0.94 })
  const water = new Mesh(new PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2), mat)
  water.position.set((x0 + x1) / 2, 0.04, (z0 + z1) / 2)
  water.receiveShadow = true
  root.add(water)
  const padMat = new MeshStandardMaterial({ color: '#3fc23a', roughness: 0.6 })
  const pads = []
  for (const [x, z, r] of [[9, 1, 0.7], [14.5, 3, 0.9], [11, 6.5, 0.6], [15.5, 7.5, 0.55], [8.6, 7.6, 0.5]]) {
    const pad = put(root, new CylinderGeometry(r, r, 0.06, 18, 1, false, 0.35, Math.PI * 2 - 0.7), padMat, x, 0.08, z, false)
    pad.rotation.y = x * 1.7
    pads.push(pad)
  }
  return (dt, t) => {
    tex.offset.set(t * 0.02, t * 0.035)
    pads.forEach((p, i) => (p.position.y = 0.08 + Math.sin(t * 1.3 + i) * 0.015))
  }
}

// --- Waterfall --------------------------------------------------------------------------------
function buildWaterfall(root, fx) {
  const Wf = 9
  const Hf = 27
  const z = P.maxZ - 0.15
  const uniforms = { uTime: { value: 0 } }
  const mat = new ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; varying vec2 vUv;
      float h(float n) { return fract(sin(n * 91.3) * 47453.1); }
      void main() {
        float col = floor(vUv.x * 26.0);
        float speed = 0.55 + h(col) * 0.5;
        float y = vUv.y + uTime * speed;
        float streak = smoothstep(0.55, 1.0, fract(y * (1.4 + h(col + 3.0)) + h(col) * 7.0));
        float band = 0.5 + 0.5 * sin((vUv.x * 26.0 - col) * 3.14159);
        vec3 deep = vec3(0.12, 0.62, 1.0);
        vec3 light = vec3(0.55, 0.95, 1.0);
        vec3 c = mix(deep, light, band * 0.55 + streak * 0.6);
        c += vec3(1.0) * streak * 0.35;
        float edge = smoothstep(0.0, 0.06, vUv.x) * smoothstep(1.0, 0.94, vUv.x);
        gl_FragColor = vec4(c * 1.15, 0.92 * edge);
      }`,
  })
  const sheet = new Mesh(new PlaneGeometry(Wf, Hf), mat)
  sheet.position.set(0, Hf / 2, z)
  sheet.rotation.y = Math.PI
  sheet.renderOrder = 3
  root.add(sheet)
  // soft glow around it + a pool cap on top
  put(root, new PlaneGeometry(Wf + 5, Hf + 2), new MeshBasicMaterial({ color: '#4fd8ff', transparent: true, opacity: 0.22, blending: AdditiveBlending, depthWrite: false }), 0, Hf / 2, z - 0.1, false).rotation.y = Math.PI
  put(root, new BoxGeometry(Wf, 0.4, 14), new MeshStandardMaterial({ color: '#3fd0ff', emissive: '#1a9fe0', emissiveIntensity: 0.6, roughness: 0.05 }), 0, Hf - 0.05, P.maxZ + 7, false)
  // mist + droplets where it lands behind the stage, sparkles down the sheet
  emitAt(fx, 0, 2.2, z - 1, { rate: 18, spread: Wf, spreadY: 0.8, speed: 1.2, up: 1, lift: 0.8, gravity: -0.6, life: 1.6, size: 1.6, sizeEnd: 3.2, alpha: 0.35, color: ['#e8fbff', '#bff0ff'], additive: false })
  emitAt(fx, 0, Hf * 0.5, z - 0.4, { rate: 10, spread: Wf * 0.9, spreadY: Hf * 0.9, dir: [0, -1, 0], speed: 6, jitter: 0.3, life: 0.9, size: 0.35, color: ['#ffffff', '#aef3ff'], shape: 'star' })
  return (dt, t) => (uniforms.uTime.value = t)
}

// --- Decor --------------------------------------------------------------------------------------
// Prop footprints decor must keep out of (local [x0, x1, z0, z1]).
const KEEP_OUT = [
  [-48, -32, 2, 36], // premium treadmills
  [25, 40, -24, 32], // power treadmills
  [29, 43, -35, -23], // launches board
  [10, 16, -22, -16], // race egg
  [-48, -23, -27, 6], // cart shop
  [-24, -11, -18, -6], // portal
]
const SUNFLOWERS = [
  // between the power treadmills (east) and the premium ones (west)
  [35.5, -12.5], [35.5, -1.5], [35.5, 9.5], [35.5, 20.5], [32, 30],
  [-37, 12.5], [-37, 21.5], [-42, 31], [-42, 3.5],
  // egg court, chest, around the hub
  [-19.5, 31], [19.5, 33], [-12, 43.5], [11.5, 44], [7.5, 39.5], [-6.5, 23.5], [6.5, 21.5], [-8, 15.5],
  [-27, -3.5], [-20, -21], [8, 12], [-13.5, 2], [21, 36], [-22, 15], [17.5, -8.5],
  [-27, 39.5], [32, 41], [-34, 46], [-48, -9], [-48, -17], [-41.5, -24.5], [-35.5, -24.5],
]
const MUSHROOMS = [
  [-12, 17.5, 1], [9, 24.5, 1.1], [-19, 37.5, 1], [19.5, 41, 1.2], [-9, 39.5, 0.9], [12.5, 38, 0.8],
  [24, -7, 1.3], [38, 32.5, 1], [-36, 27.5, 1.1], [-46, 8, 1], [-12.5, 30, 0.9], [-26, 43, 1.2],
  [16, 27.5, 0.8], [33, -20, 1], [-30.5, -10, 0.9], [-16, -1, 0.8], [27, 34.5, 1.2], [-47, 38, 1], [47, 15, 1.1], [5.5, 47.5, 0.8],
]
function buildDecor(root, rand) {
  // sunflowers: stem + leaves + square petals with a brown centre, heads tilted every which way
  const stems = []
  const petals = []
  const centres = []
  const sunflower = (x, z, s = 1) => {
    const yaw = rand() * Math.PI * 2
    const hgt = (1.7 + rand() * 0.6) * s
    stems.push(tf(box(0.16 * s, hgt, 0.16 * s), x, hgt / 2, z))
    stems.push(tf(box(0.5 * s, 0.1 * s, 0.24 * s), x + 0.25 * s, hgt * 0.45, z, 0, yaw, 0.5))
    const tilt = -0.5 - rand() * 0.4
    petals.push(tf(box(1.05 * s, 1.05 * s, 0.16 * s), x, hgt + 0.25 * s, z, tilt, yaw, 0))
    petals.push(tf(box(0.8 * s, 0.8 * s, 0.14 * s), x, hgt + 0.25 * s, z, tilt, yaw, Math.PI / 4))
    const cg = tf(box(0.52 * s, 0.52 * s, 0.24 * s), 0, 0, 0.07 * s)
    centres.push(tf(cg, x, hgt + 0.25 * s, z, tilt, yaw, 0))
  }
  for (const [x, z] of SUNFLOWERS) if (grassAt(x, z, 0.4)) sunflower(x, z, 1 + rand() * 0.25)

  // red-cap mushrooms with white studs/spots
  const caps = []
  const whites = []
  const mushroom = (x, z, s) => {
    whites.push(legoBoxGeo(0.7 * s, 0.9 * s, 0.7 * s, x, 0.45 * s, z))
    caps.push(legoBoxGeo(1.7 * s, 0.75 * s, 1.7 * s, x, 0.9 * s + 0.37 * s, z))
    for (const [dx, dz] of [[-0.4, -0.35], [0.45, 0.2], [-0.1, 0.5]]) whites.push(legoBoxGeo(0.42 * s, 0.1 * s, 0.42 * s, x + dx * s, 1.66 * s, z + dz * s))
    whites.push(legoBoxGeo(0.06 * s, 0.32 * s, 0.4 * s, x + 0.86 * s, 1.27 * s, z))
    whites.push(legoBoxGeo(0.4 * s, 0.32 * s, 0.06 * s, x, 1.27 * s, z - 0.86 * s))
    if (s > 0.95) solidCylinder(0.45 * s, 1.6 * s, x, z)
  }
  const clear = (x, z) => grassAt(x, z, 1) && !KEEP_OUT.some(([a, b, c, d]) => x > a && x < b && z > c && z < d)
  for (const [x, z, s] of MUSHROOMS) if (clear(x, z)) mushroom(x, z, s)

  // lego flowers: little bright bricks on stems, in clumps along the cart shop's back and the hub
  const heads = []
  const flowerStems = []
  const COLS = ['#ff3b3b', '#ffd21f', '#3f8cff', '#ff7ad0', '#ffffff', '#ff9a1f', '#b45cff']
  const clump = (cx, cz, n, r) => {
    for (let i = 0; i < n; i++) {
      const x = cx + (rand() - 0.5) * r * 2
      const z = cz + (rand() - 0.5) * r * 2
      if (!grassAt(x, z, 0.3)) continue
      const hgt = 0.4 + rand() * 0.6
      flowerStems.push(colored(tf(box(0.1, hgt, 0.1), x, hgt / 2, z), '#2fae2a'))
      heads.push(colored(tf(box(0.55, 0.45, 0.55), x, hgt + 0.2, z, 0, rand() * 1.5, 0), COLS[Math.floor(rand() * COLS.length)]))
    }
  }
  for (let z = -26; z <= 2; z += 3.5) clump(-48.5, z, 6, 1.6)
  for (const [x, z] of [[-41, -32], [41, -32], [-14, 36], [14, 36], [44, 22], [-44, 22], [42, -10], [-20, 12], [12, -22], [-12, -21], [44, 40], [-44, 42]]) clump(x, z, 9, 2.4)

  // random scatter on open grass
  let placed = 0
  for (let i = 0; i < 400 && placed < 45; i++) {
    const x = P.minX + 2 + rand() * (P.maxX - P.minX - 4)
    const z = P.minZ + 2 + rand() * (P.maxZ - P.minZ - 14)
    if (!grassAt(x, z, 1.2)) continue
    if (KEEP_OUT.some(([a, b, c, d]) => x > a && x < b && z > c && z < d)) continue
    const k = rand()
    if (k < 0.45) sunflower(x, z, 0.9 + rand() * 0.3)
    else if (k < 0.65) mushroom(x, z, 0.7 + rand() * 0.4)
    else clump(x, z, 4, 1)
    placed++
  }

  // loose lavender bricks lying around
  const bricks = []
  for (const [x, z, r] of [[-17, 36.5, 0.4], [16, 34.5, -0.3], [-25, 21, 0.2], [30.5, 25, 0.5], [-40, 26, -0.4], [12.5, -18.5, 0.3], [-8, -24.5, 0]]) {
    if (!grassAt(x, z, 0.5)) continue
    const g = legoBoxGeo(1.5, 0.75, 1.5)
    bricks.push(tf(g, x, 0.37, z, 0, r, 0))
  }

  const std = (c, extra) => new MeshStandardMaterial({ color: c, roughness: 0.55, ...extra })
  root.add(mergedMesh(stems, std('#33b52a')))
  root.add(mergedMesh(petals, std('#ffcf1a', { emissive: '#ff9a00', emissiveIntensity: 0.08 })))
  root.add(mergedMesh(centres, std('#6b3d16')))
  root.add(mergedMesh(caps, legoMat('#e8262b')))
  root.add(mergedMesh(whites, legoMat('#f6f6f6')))
  if (heads.length) {
    root.add(mergedMesh(flowerStems, new MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }), { cast: false }))
    root.add(mergedMesh(heads, new MeshStandardMaterial({ vertexColors: true, roughness: 0.45 }), { cast: true }))
  }
  if (bricks.length) root.add(mergedMesh(bricks, legoMat('#c4bdf5')))
}

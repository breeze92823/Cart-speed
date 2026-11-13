import {
  BoxGeometry,
  BufferGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshLambertMaterial,
  MeshStandardMaterial,
  NearestFilter,
  PlaneGeometry,
  RepeatWrapping,
  Shape,
} from 'three'
import { CHANNEL, CHECKER, FLY_ZONE, PLAZA, RIVER_REGIONS, STUD, powerMarks } from './config.js'
import { RAPIER, addFixed } from './physics.js'
import { mulberry32 } from './textures.js'
import { canvasTex, legoBoxGeo, legoMat, mergedMesh, voxelTree, withTop } from './legokit.js'
import { label } from './propkit.js'

// The road side of the world: the long road (the lane) north of the hub's Launch Zone with its
// power lines and distance signs, the clouds, and `terraceRun` (the terraced blocky cliffs the hub
// in src/hub/ builds its cliffs and road banks from). The lobby itself is src/hub/.

export const COLORS = {
  grey: '#d6dade',
  greyRim: '#8d939b',
  greenA: '#63e22f',
  greenB: '#4ccf22',
  cliffA: '#9a6431',
  cliffB: '#7a4a22',
  grass: '#5bd62b',
  asphalt: '#555b7a',
  roadWhite: '#f4f6fb',
  roadYellow: '#ffd21f',
  yellowA: '#ffd84a',
  yellowB: '#ffc727',
}

// --- Cliffs ---------------------------------------------------------------------------
// Terraced blocky cliffs: for every segment along an edge, tiers of boxes step up and
// away from the edge with a little random jitter so the outline reads hand-built.
export function terraceRun({ along, from, to, edge, outward, seg, tiers, rand, geos, colliders, trees, treeEvery }) {
  for (let s = from; s < to; s += seg) {
    const len = Math.min(seg, to - s)
    const mid = s + len / 2
    let prevOff = 0
    tiers.forEach((t, k) => {
      const off = t.off + Math.round(rand() * t.jitter / STUD) * STUD
      const near = edge + outward * off
      const far = edge + outward * (t.off + 70)
      const lo = t.base ?? -1
      const h = t.h + (k > 0 ? Math.round((rand() - 0.5) * 2) * STUD * 2 : 0)
      const w = Math.abs(far - near)
      const c = (near + far) / 2
      const geo = along === 'z' ? legoBoxGeo(w, h - lo, len + 0.02, c, (h + lo) / 2, mid) : legoBoxGeo(len + 0.02, h - lo, w, mid, (h + lo) / 2, c)
      geos.push(geo)
      if (colliders && k < 2) {
        if (along === 'z') addFixed(RAPIER.ColliderDesc.cuboid(w / 2, (h - lo) / 2, len / 2), { x: c, y: (h + lo) / 2, z: mid })
        else addFixed(RAPIER.ColliderDesc.cuboid(len / 2, (h - lo) / 2, w / 2), { x: mid, y: (h + lo) / 2, z: c })
      }
      // trees on the exposed top of this tier (between this tier's edge and the next one)
      if (trees && rand() < treeEvery * (k === 0 ? 0.6 : 1)) {
        const nextOff = tiers[k + 1] ? tiers[k + 1].off : off + 10
        const depth = Math.max(2.5, nextOff - off - 1)
        const d = off + 1.5 + rand() * (depth - 2)
        const p = edge + outward * d
        const q = s + 1 + rand() * Math.max(0.5, len - 2)
        trees.push(along === 'z' ? [p, h, q] : [q, h, p])
      }
      prevOff = off
    })
  }
}

// --- Sky decorations, the road, distance signs --------------------------------------
function makeClouds() {
  const rand = mulberry32(2024)
  const geo = new IcosahedronGeometry(1, 3)
  const mat = new MeshLambertMaterial({ color: '#ffffff', emissive: '#dcebff', emissiveIntensity: 0.62, fog: false })
  const group = new Group()
  for (let i = 0; i < 26; i++) {
    const ang = rand() * Math.PI * 2
    const dist = 260 + rand() * 200
    const cloud = new Group()
    const puffs = 5 + Math.floor(rand() * 4)
    const len = 22 + rand() * 26
    for (let p = 0; p < puffs; p++) {
      const t = p / (puffs - 1) - 0.5
      const r = (1 - Math.abs(t) * 1.1) * (9 + rand() * 6)
      const puff = new Mesh(geo, mat)
      puff.scale.set(r, r * 0.82, r)
      puff.position.set(t * len, r * 0.25 + rand() * 3, (rand() - 0.5) * 8)
      cloud.add(puff)
    }
    cloud.position.set(Math.cos(ang) * dist, 60 + rand() * 80, Math.sin(ang) * dist)
    cloud.lookAt(0, cloud.position.y, 0)
    group.add(cloud)
  }
  return group
}

// --- The road (the lane) -----------------------------------------------------------------
// Bluish asphalt with white edge lines, a double yellow centre line and dashed lanes,
// one canvas tile repeated down the whole length.
const ROAD_TILE = 16 // m of road per texture tile
function paintRoadTile(W) {
  const PX = 16 // px per metre
  const c = document.createElement('canvas')
  c.width = Math.round(W * PX)
  c.height = ROAD_TILE * PX
  const g = c.getContext('2d')
  g.fillStyle = COLORS.asphalt
  g.fillRect(0, 0, c.width, c.height)
  const rand = mulberry32(99)
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = rand() < 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.09)'
    const r = 1 + rand() * 2
    g.fillRect(rand() * c.width, rand() * c.height, r, r)
  }
  const X = (x) => (x + W / 2) * PX
  const line = (x, w, color, from = 0, to = ROAD_TILE) => {
    g.fillStyle = color
    g.fillRect(X(x - w / 2), from * PX, w * PX, (to - from) * PX)
  }
  const edge = CHANNEL.halfWidth - 1.4
  line(-edge, 0.5, COLORS.roadWhite)
  line(edge, 0.5, COLORS.roadWhite)
  line(-0.32, 0.24, COLORS.roadYellow)
  line(0.32, 0.24, COLORS.roadYellow)
  for (const x of [-20, -10, 10, 20]) {
    line(x, 0.32, COLORS.roadWhite, 1, 6)
    line(x, 0.32, COLORS.roadWhite, 9, 14)
  }
  return c
}
// The power lines across the road (FLIGHT.markers) with their distance painted twice,
// all quads of one atlas texture in a single mesh.
function powerLines() {
  const marks = powerMarks()
  const CW = 256
  const CH = 96
  const cols = 8
  const rows = Math.ceil((marks.length + 1) / cols)
  const c = document.createElement('canvas')
  c.width = CW * cols
  c.height = CH * rows
  const g = c.getContext('2d')
  const cell = (i) => [(i % cols) * CW, Math.floor(i / cols) * CH]
  const draw = () => {
    g.clearRect(0, 0, c.width, c.height)
    g.font = '800 68px Fredoka, "Arial Black", sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.lineJoin = 'round'
    marks.forEach((d, i) => {
      const [x, y] = cell(i)
      g.lineWidth = 12
      g.strokeStyle = 'rgba(40,44,62,0.55)'
      g.strokeText(d + ' m', x + CW / 2, y + CH / 2 + 4)
      g.fillStyle = COLORS.roadWhite
      g.fillText(d + ' m', x + CW / 2, y + CH / 2 + 4)
    })
    const [wx, wy] = cell(marks.length)
    g.fillStyle = COLORS.roadWhite
    g.fillRect(wx, wy, CW, CH)
  }
  draw()
  const tex = canvasTex(c)
  document.fonts?.load('800 68px Fredoka').then(() => {
    draw()
    tex.needsUpdate = true
  })
  const pos = []
  const uv = []
  const idx = []
  const y = CHANNEL.surfaceY + 0.02
  // quad (x0..x1, zN north edge .. zS south edge) showing atlas cell i (inset px)
  const quad = (x0, x1, zN, zS, i, inset) => {
    const [cx, cy] = cell(i)
    const u0 = (cx + inset) / c.width
    const u1 = (cx + CW - inset) / c.width
    const vT = 1 - (cy + inset) / c.height
    const vB = 1 - (cy + CH - inset) / c.height
    const n = pos.length / 3
    pos.push(x0, y, zN, x1, y, zN, x0, y, zS, x1, y, zS)
    uv.push(u0, vT, u1, vT, u0, vB, u1, vB)
    idx.push(n, n + 2, n + 1, n + 1, n + 2, n + 3)
  }
  const edge = CHANNEL.halfWidth - 1.4
  marks.forEach((d, i) => {
    const z = PLAZA.minZ - d
    quad(-edge, edge, z - 0.35, z + 0.35, marks.length, 20)
    for (const x of [-15, 15]) quad(x - 4.2, x + 4.2, z - 4.6, z - 1.4, i, 0)
  })
  const geo = new BufferGeometry()
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3))
  geo.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  geo.setAttribute('normal', new Float32BufferAttribute(pos.map((_, k) => (k % 3 === 1 ? 1 : 0)), 3))
  geo.setIndex(idx)
  const m = new Mesh(geo, new MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: 0.75, polygonOffset: true, polygonOffsetFactor: -2 }))
  m.receiveShadow = true
  m.renderOrder = 1
  return m
}

export function createWorld(scene) {
  scene.add(makeClouds())

  // The road, from the zone line to the end of the lane.
  const length = CHANNEL.length + 120
  const W = CHANNEL.halfWidth * 2 + 4
  const tex = canvasTex(paintRoadTile(W))
  tex.wrapT = RepeatWrapping
  tex.repeat.set(1, length / ROAD_TILE)
  tex.anisotropy = 8
  const roadGeo = new PlaneGeometry(W, length).rotateX(-Math.PI / 2).translate(0, CHANNEL.surfaceY, PLAZA.minZ - length / 2)
  const road = new Mesh(roadGeo, new MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0 }))
  road.receiveShadow = true
  scene.add(road)
  scene.add(powerLines())

  // Distance signs over the left bank every 250 m, and the snowy end of the river.
  const signs = new Group()
  for (let d = 250; d <= CHANNEL.length; d += 250) {
    const s = label(`${d.toLocaleString()}m`, 7, { color: '#ffffff', outline: '#1d6b12' })
    s.position.set(-CHANNEL.halfWidth - 4, 12, PLAZA.minZ - d)
    signs.add(s)
  }
  scene.add(signs)
  const endZ = PLAZA.minZ - CHANNEL.length
  const snowGeos = [legoBoxGeo(CHANNEL.halfWidth * 2 + 160, 30, 60, 0, 6, endZ - 30), legoBoxGeo(50, 12, 20, 0, 27, endZ - 40)]
  scene.add(mergedMesh(snowGeos, legoMat('#f4fbff', { roughness: 0.4 }), { cast: false }))
  const snowSign = label('World 2 Soon!', 40, { colors: ['#ffd23a'], outline: '#ffffff', outlineWidth: 18 }) // the river's end (Snow is now a region near the start)
  snowSign.material.fog = false
  snowSign.position.set(0, 70, endZ - 20)
  scene.add(snowSign)
  // a blocky snowman next to the sign
  const snowman = new Group()
  const white = new MeshLambertMaterial({ color: '#ffffff', fog: false })
  for (const [r, y] of [[9, 9], [6.5, 22], [4.5, 32]]) {
    const b = new Mesh(new BoxGeometry(r * 2, r * 1.6, r * 2), white)
    b.position.y = y
    snowman.add(b)
  }
  const hat = new Mesh(new BoxGeometry(6, 5, 6), new MeshLambertMaterial({ color: '#d42b2b', fog: false }))
  hat.position.y = 38
  snowman.add(hat)
  snowman.position.set(50, 20, endZ - 26)
  scene.add(snowman)

  return {
    update() {},
  }
}


import {
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  MeshBasicMaterial,
  MeshStandardMaterial,
} from 'three'
import { CHANNEL, COARSE_POINTER, PLAZA, RIVER_REGIONS, ROADSIDE } from './config.js'
import { legoBoxGeo, legoMat, mergedMesh } from './legokit.js'
import { mulberry32 } from './textures.js'

// The towns along both sides of the lane, region by region (RIVER_REGIONS[].town), growing
// with distance: villages (cottages with fenced yards, barns, silos, windmills, crop fields),
// rural towns (two-storey houses, a main street of shops, a church, a gas station, a water
// tower, fields at the back), urban towns (blocks of flats with shops and awnings, billboards,
// traffic lights, parked cars) and cities (glass towers with setbacks, antennas, crowns,
// helipads, neon in Neon City). No woods: nothing here is a tree.
//
// Everything is static boxes / prisms / cylinders with a per-vertex colour, merged per
// ROADSIDE.chunk metres of lane and per material (a handful of draw calls per chunk). The
// building walls use legoMat's world-space `windows`, so lots, widths and depths are kept on
// the window grid (3 m for houses / flats, 2 m for towers) to keep the panes whole.

const P = PLAZA
const HW = CHANNEL.halfWidth
const lite = COARSE_POINTER

// --- Geometry helpers --------------------------------------------------------------------------
const tmpC = new Color()
function paint(g, hex) {
  tmpC.set(hex)
  const n = g.attributes.position.count
  const a = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    a[i * 3] = tmpC.r
    a[i * 3 + 1] = tmpC.g
    a[i * 3 + 2] = tmpC.b
  }
  g.setAttribute('color', new Float32BufferAttribute(a, 3))
  return g
}

// Gable roof: w across x, ridge along z (length d), h tall, base at y = 0, centred. Indexed,
// flat faces (the roof material is flat shaded), no bottom.
function gable(w, h, d) {
  const x = w / 2
  const z = d / 2
  const pos = []
  const nor = []
  const idx = []
  const face = (pts, n) => {
    const b = pos.length / 3
    for (const p of pts) {
      pos.push(...p)
      nor.push(...n)
    }
    if (pts.length === 3) idx.push(b, b + 1, b + 2)
    else idx.push(b, b + 1, b + 2, b, b + 2, b + 3)
  }
  const s = Math.hypot(x, h)
  face([[-x, 0, z], [0, h, z], [0, h, -z], [-x, 0, -z]], [-h / s, x / s, 0])
  face([[x, 0, -z], [0, h, -z], [0, h, z], [x, 0, z]], [h / s, x / s, 0])
  face([[-x, 0, z], [x, 0, z], [0, h, z]], [0, 0, 1])
  face([[x, 0, -z], [-x, 0, -z], [0, h, -z]], [0, 0, -1])
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3))
  g.setAttribute('uv', new Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2))
  g.setIndex(idx)
  return g
}

// --- Materials (shared by every chunk) -----------------------------------------------------------
let MATS = null
function mats() {
  if (MATS) return MATS
  const W = ROADSIDE.windows
  MATS = {
    wall: legoMat('#ffffff', { vertexColors: true, windows: W.house }),
    tower: legoMat('#ffffff', { vertexColors: true, windows: W.tower }),
    night: legoMat('#ffffff', { vertexColors: true, windows: W.night }),
    plain: legoMat('#ffffff', { vertexColors: true }),
    roof: new MeshStandardMaterial({ vertexColors: true, roughness: 0.6, flatShading: true }),
    glow: new MeshBasicMaterial({ vertexColors: true }),
  }
  return MATS
}

// --- Build -------------------------------------------------------------------------------------
export function buildRoadside(scene) {
  const root = new Group()
  root.name = 'roadside-towns'
  scene.add(root)
  const R = ROADSIDE
  const CL = R.colors
  const chunks = new Map()
  // the geometry lists of the chunk that holds z
  const at = (z) => {
    const k = Math.floor((P.minZ - z) / R.chunk)
    let c = chunks.get(k)
    if (!c) chunks.set(k, (c = { wall: [], tower: [], night: [], plain: [], roof: [], glow: [] }))
    return c
  }
  const snap = (v, s) => Math.round(v / s) * s

  RIVER_REGIONS.forEach((r, ri) => {
    const rand = mulberry32(7100 + ri * 131)
    const pick = (a) => a[Math.floor(rand() * a.length)]
    const range = (a, b) => a + rand() * (b - a)
    const z0 = P.minZ - r.at // south end (nearer the hub)
    const z1 = P.minZ - (RIVER_REGIONS[ri + 1]?.at ?? CHANNEL.length + 60)
    const len = z0 - z1
    const kind = r.town
    const deep = R.depth[kind]
    const tier = RIVER_REGIONS.slice(0, ri).filter((q) => q.town === kind).length // 0 / 1: the second region of a kind is bigger

    // ground on both sides (one checker mesh per region), sidewalks, cross streets
    const groundGeos = []
    for (const side of [-1, 1]) groundGeos.push(legoBoxGeo(R.far - R.walk, 1, len, side * (R.walk + R.far) / 2, -0.45, z0 - len / 2))
    root.add(mergedMesh(groundGeos, legoMat('#ffffff', { checker: r.ground }), { cast: false }))

    // side-relative box: u = centre distance from the road axis, y = bottom
    let side = 1
    const box = (list, color, u, y, z, du, h, dz) => list.push(paint(legoBoxGeo(du, h, dz, side * u, y + h / 2, z), color))
    const roofAt = (L, color, u, y, z, w, h, d, ridgeAlongU = false) => {
      const g = gable(w, h, d)
      if (ridgeAlongU) g.rotateY(Math.PI / 2)
      g.translate(side * u, y, z)
      L.roof.push(paint(g, color))
    }
    const cyl = (L, color, u, y, z, rad, h, seg = 10, rad2 = rad) => L.roof.push(paint(new CylinderGeometry(rad2, rad, h, seg).translate(side * u, y + h / 2, z), color))
    const cone = (L, color, u, y, z, rad, h, seg = 4) => {
      const g = new ConeGeometry(rad, h, seg)
      if (seg === 4) g.rotateY(Math.PI / 4)
      L.roof.push(paint(g.translate(side * u, y + h / 2, z), color))
    }

    // cross streets (shared by both sides, they cross the road)
    const streets = []
    if (R.streetEvery[kind]) {
      for (let z = z0 - R.streetEvery[kind] * (0.5 + rand() * 0.4); z > z1 + 30; z -= R.streetEvery[kind] * (0.8 + rand() * 0.4)) streets.push(snap(z, 6))
    }
    // blocks between the streets [south, north] (snapped to the 6 m grid)
    const blocks = []
    {
      let s = snap(z0 - (ri === 0 ? R.hubGap : 6), 6)
      for (const st of streets) {
        blocks.push([s, st + R.street / 2 + 3])
        s = st - R.street / 2 - 3
      }
      blocks.push([s, snap(z1 + 6, 6)])
    }

    for (side of [-1, 1]) {
      // sidewalk + curb, a paved strip for the towns, cross streets, the back street
      for (let z = z0; z > z1; z -= 50) {
        const l = Math.min(50, z - z1)
        const L = at(z - l / 2)
        box(L.plain, CL.sidewalk, (HW + R.walk) / 2, -0.5, z - l / 2, R.walk - HW, 0.8, l)
        box(L.plain, CL.curb, HW + 0.35, -0.5, z - l / 2, 0.7, 0.95, l)
        if (kind !== 'village') box(L.plain, CL.paving, R.walk + 2, -0.4, z - l / 2, 4, 0.55, l)
        if (deep.back) box(L.plain, CL.asphalt, deep.back + 4, -0.4, z - l / 2, 8, 0.55, l)
      }
      for (const st of streets) {
        const L = at(st)
        box(L.plain, CL.asphalt, (R.walk + R.far) / 2, -0.38, st, R.far - R.walk, 0.55, R.street)
        for (let u = R.walk + 4; u < R.far - 4; u += 8) box(L.plain, CL.line, u, -0.36, st, 3, 0.55, 0.35)
        // zebra crossing on the sidewalk side + traffic light / stop sign
        for (let k = -3; k <= 3; k++) box(L.plain, '#ffffff', R.walk + 2.5, -0.36, st + k * 1.2, 2.6, 0.55, 0.6)
        const zz = st + R.street / 2 + 1
        if (kind === 'urban' || kind === 'city') {
          box(L.plain, CL.pole, HW + 3, 0, zz, 0.35, 5.5, 0.35)
          box(L.plain, CL.pole, HW + 3, 4.8, zz, 0.8, 2.4, 0.8)
          ;['#ff3a3a', '#ffcc2a', '#3aff6a'].forEach((c, i) => box(L.glow, c, HW + 2.55, 6.6 - i * 0.75, zz, 0.15, 0.5, 0.5))
        } else {
          box(L.plain, CL.pole, HW + 3, 0, zz, 0.25, 3, 0.25)
          box(L.plain, '#e8322a', HW + 3, 2.6, zz, 0.15, 1.2, 1.2)
        }
      }
      // street lamps (the villages get none)
      if (kind !== 'village') {
        for (let z = z0 - 14; z > z1 + 8; z -= R.lampEvery) {
          if (streets.some((s) => Math.abs(s - z) < R.street)) continue
          if (Math.abs(z - z0) < 8) continue
          const L = at(z)
          box(L.plain, CL.pole, HW + 3.4, 0, z, 0.3, 7, 0.3)
          box(L.plain, CL.pole, HW + 2.4, 6.8, z, 2.2, 0.25, 0.3)
          box(L.glow, CL.lamp, HW + 1.5, 6.55, z, 0.9, 0.3, 0.6)
        }
      }

      // --- the rows of lots ---
      const rows = deep.rows.filter((row, i) => !(lite && i >= deep.liteRows)).map((row) => ({ ...row })) // per side: builders keep flags on it
      rows.forEach((row) => {
        for (const [zs, zn] of row.ignoreStreets ? [[snap(z0 - (ri === 0 ? R.hubGap : 6), 6), snap(z1 + 6, 6)]] : blocks) {
          let z = zs
          let n = 0
          while (true) {
            const used = BUILD[row.kind]({ z, zn, row, n, side, tier, r, rand, pick, range, box, roofAt, cyl, cone, at, CL })
            if (!used) break
            z -= used
            n++
          }
        }
      })
    }
  })

  const M = mats()
  for (const c of chunks.values()) {
    for (const [k, list] of Object.entries(c)) if (list.length) root.add(mergedMesh(list, M[k], { cast: false }))
  }
  return root
}

// --- Lot builders ------------------------------------------------------------------------------
// Each gets the lot's south edge `z` (lots run north = -z from it), the block's north end `zn`,
// the row ({ u: front line distance from the road axis, ... }) and returns the metres of lane
// used (0 = the block is full).
const fits = (o, w) => o.z - w >= o.zn

function fence(o, L, u, zS, zN, gapZ, color) {
  const len = zS - zN
  const parts = gapZ == null ? [[zS, zN]] : [[zS, gapZ + 1], [gapZ - 1, zN]]
  for (const [a, b] of parts) {
    if (a - b < 0.5) continue
    o.box(L.plain, color, u, 0.45, (a + b) / 2, 0.15, 0.15, a - b)
    o.box(L.plain, color, u, 0.95, (a + b) / 2, 0.15, 0.15, a - b)
  }
  for (let z = zS; z >= zN - 0.01; z -= 1.5) {
    if (gapZ != null && Math.abs(z - gapZ) < 1) continue
    o.box(L.plain, color, u, 0, z, 0.25, 1.25, 0.25)
  }
  return len
}

// a pitched-roof house: front wall at u0, w along the road, d deep, floors
function house(o, L, u0, zc, w, d, floors, { porch = false, color, roof } = {}) {
  const h = floors * 3 + 0.6
  const uc = u0 + d / 2
  o.box(L.wall, color ?? o.pick(o.r.walls), uc, 0, zc, d, h, w)
  o.roofAt(L, roof ?? o.pick(o.r.roofs), uc, h, zc, d + 1.4, d * 0.5, w + 1.2)
  if (o.rand() < 0.7) o.box(L.plain, o.CL.brick, uc + d * 0.2, h + d * 0.1, zc - w * 0.25, 1.2, d * 0.45, 1.2)
  const dz = zc + (o.rand() < 0.5 ? -1 : 1) * Math.min(w / 2 - 2, 1.5)
  o.box(L.plain, o.pick(o.CL.doors), u0 - 0.1, 0, dz, 0.3, 2.3, 1.4)
  if (porch) {
    o.box(L.plain, o.r.trims[0], u0 - 1.6, 2.9, zc, 3.4, 0.3, w - 1)
    for (const s of [-1, 1]) o.box(L.plain, o.r.trims[0], u0 - 3, 0, zc + s * (w / 2 - 1), 0.3, 2.9, 0.3)
    o.box(L.plain, o.CL.paving, u0 - 1.6, 0, zc, 3.4, 0.3, w - 1)
  }
  return dz
}

const BUILD = {
  // Village front row: cottages in fenced yards, now and then a barn with a silo.
  cottage(o) {
    const barn = o.n > 0 && o.rand() < 0.16
    const w = barn ? 27 : o.pick([15, 18, 21])
    if (!fits(o, w)) return 0
    const L = o.at(o.z - w / 2)
    const zc = o.z - w / 2
    const u = o.row.u
    if (barn) {
      const bw = 12
      const bz = zc + 4
      o.box(L.plain, o.CL.barn, u + 9, 0, bz, 15, 7, bw)
      o.roofAt(L, o.CL.barnRoof, u + 9, 7, bz, 16.4, 6, bw + 1)
      o.box(L.plain, o.CL.barnDoor, u + 1.4, 0, bz, 0.3, 5, 5)
      for (const s of [-1, 1]) o.box(L.plain, '#ffffff', u + 1.2, 0, bz + s * 2.6, 0.3, 5.3, 0.4)
      o.box(L.plain, '#ffffff', u + 1.2, 5, bz, 0.3, 0.4, 5.6)
      o.box(L.plain, '#ffffff', u + 1.2, 2.3, bz, 0.3, 0.4, 5.2)
      o.cyl(L, o.CL.silo, u + 6, 0, zc - 8.5, 2.4, 13, 12)
      o.cyl(L, o.CL.barn, u + 6, 13, zc - 8.5, 0.1, 2.2, 12, 2.6)
      for (let k = 0; k < 3; k++) o.cyl(L, o.CL.hay, u - 1 + k * 1.9, 0, zc - 3, 0.9, 1.2, 10)
      return w
    }
    const front = u + 6
    const hw = w - 6
    const floors = o.rand() < 0.3 + o.tier * 0.2 ? 2 : 1
    const dz = house(o, L, front, zc, hw, o.pick([9, 9, 12]), floors)
    // path, fence, flower beds, mailbox
    o.box(L.plain, o.CL.path, (u - 1 + front) / 2, 0, dz, front - u + 1, 0.12, 1.5)
    fence(o, L, u - 0.5, o.z - 0.2, o.z - w + 0.2, dz, o.pick([o.r.trims[0], '#ffffff', '#c98a4b']))
    for (const s of [-1, 1]) {
      const bz = zc + s * (hw / 2 - 2)
      if (Math.abs(bz - dz) < 2) continue
      o.box(L.plain, o.CL.hedge, front - 1.2, 0, bz, 1.4, 0.8, 2.6)
      for (let k = -1; k <= 1; k++) o.box(L.plain, o.pick(o.CL.flowers), front - 1.2, 0.8, bz + k * 0.8, 0.5, 0.4, 0.5)
    }
    o.box(L.plain, o.CL.pole, u - 1.6, 0, dz + 1.6, 0.2, 1.1, 0.2)
    o.box(L.plain, o.pick(['#e8322a', '#3a6ad8', '#2a2a2a']), u - 1.6, 1.1, dz + 1.6, 0.6, 0.45, 0.9)
    return w
  },

  // Rural front row: mostly two-storey houses with porches; main-street blocks of shops;
  // one church and one gas station per side.
  townHouse(o) {
    if (o.n === 2 && !o.row.done?.church) return BUILD.church(o)
    if (o.n === 4 && !o.row.done?.gas) return BUILD.gas(o)
    if (o.rand() < o.row.shops) return BUILD.shop(o)
    const w = o.pick([15, 18, 18, 21])
    if (!fits(o, w)) return 0
    const L = o.at(o.z - w / 2)
    const zc = o.z - w / 2
    const front = o.row.u + 6
    const dz = house(o, L, front, zc, w - 6, 12, o.rand() < 0.75 ? 2 : 1, { porch: o.rand() < 0.6 })
    o.box(L.plain, o.CL.path, (o.row.u + front) / 2, 0, dz, front - o.row.u, 0.12, 1.5)
    if (o.rand() < 0.5) fence(o, L, o.row.u, o.z - 0.2, o.z - w + 0.2, dz, '#ffffff')
    if (o.rand() < 0.4) car(o, L, o.row.u + 3, zc + (dz > zc ? -1 : 1) * (w / 2 - 3.5))
    return w
  },
  shop(o) {
    const w = o.pick([12, 15, 18])
    if (!fits(o, w)) return 0
    const L = o.at(o.z - w / 2)
    const zc = o.z - w / 2
    const u = o.row.u
    const d = 15
    const floors = o.row.kind === 'block' ? o.row.floors[0] + Math.floor(o.rand() * (o.row.floors[1] - o.row.floors[0] + 1 + o.tier)) : o.rand() < 0.7 ? 2 : 1
    const h = floors * 3 + 0.6
    o.box(L.wall, o.pick(o.r.walls), u + d / 2, 0, zc, d, h, w - 0.2)
    o.box(L.plain, o.pick(o.r.roofs), u + d / 2, h, zc, d + 0.4, 0.6, w + 0.2)
    shopFront(o, L, u, zc, w)
    rooftop(o, L, u + d / 2, h + 0.6, zc, d, w)
    return w
  },
  church(o) {
    o.row.done = { ...o.row.done, church: true }
    const w = 24
    if (!fits(o, w)) return 0
    const L = o.at(o.z - w / 2)
    const zc = o.z - w / 2
    const u = o.row.u + 6
    o.box(L.wall, '#ffffff', u + 7, 0, zc, 14, 7.6, 12)
    o.roofAt(L, o.CL.churchRoof, u + 7, 7.6, zc, 13.2, 6, 15, true)
    o.box(L.plain, '#ffffff', u - 1, 0, zc, 5, 15, 5)
    o.box(L.plain, o.CL.churchRoof, u - 1, 15, zc, 5.6, 0.6, 5.6)
    o.cone(L, o.CL.churchRoof, u - 1, 15.6, zc, 3.6, 9)
    o.box(L.plain, o.CL.gold, u - 1, 24.4, zc, 0.35, 3, 0.35)
    o.box(L.plain, o.CL.gold, u - 1, 25.6, zc, 0.35, 0.35, 1.6)
    o.box(L.plain, o.CL.barnDoor, u - 3.6, 0, zc, 0.3, 3.6, 2.2)
    o.box(L.glow, o.CL.window, u - 3.6, 9.5, zc, 0.2, 2.2, 1.4)
    o.box(L.plain, o.CL.path, (o.row.u + u - 3.6) / 2, 0, zc, u - 3.6 - o.row.u, 0.12, 3)
    return w
  },
  gas(o) {
    o.row.done = { ...o.row.done, gas: true }
    const w = 24
    if (!fits(o, w)) return 0
    const L = o.at(o.z - w / 2)
    const zc = o.z - w / 2
    const u = o.row.u
    o.box(L.plain, o.CL.asphalt, u + 6, 0, zc, 12, 0.14, w)
    o.box(L.plain, o.CL.gasRed, u + 4, 5, zc - 2, 9, 1, 14)
    o.box(L.plain, '#ffffff', u + 4, 4.7, zc - 2, 9.2, 0.3, 14.2)
    for (const a of [-1, 1]) for (const b of [-1, 1]) o.box(L.plain, '#ffffff', u + 4 + a * 3, 0, zc - 2 + b * 5, 0.5, 4.7, 0.5)
    for (const b of [-1, 1]) {
      o.box(L.plain, '#e8eef8', u + 4, 0, zc - 2 + b * 2.5, 1.2, 1.8, 0.9)
      o.box(L.glow, '#3aff6a', u + 3.35, 1.1, zc - 2 + b * 2.5, 0.1, 0.4, 0.6)
    }
    o.box(L.wall, '#f2f2f2', u + 13.5, 0, zc - 2, 6, 3.6, 12)
    o.box(L.plain, o.CL.gasRed, u + 13.5, 3.6, zc - 2, 6.4, 0.6, 12.4)
    o.box(L.plain, o.CL.pole, u + 0.5, 0, zc + 9.5, 0.4, 7, 0.4)
    o.box(L.glow, o.CL.gasRed, u + 0.5, 7, zc + 9.5, 0.5, 2.4, 3.4)
    o.box(L.glow, '#ffffff', u + 0.2, 7.3, zc + 9.5, 0.2, 0.6, 2.6)
    return w
  },

  // back rows of a rural town: houses facing the back street, a water tower now and then
  backHouse(o) {
    const w = o.pick([18, 21, 24])
    if (!fits(o, w)) return 0
    const L = o.at(o.z - w / 2)
    const zc = o.z - w / 2
    if (o.n === 3) {
      const u = o.row.u + 9
      for (const a of [-1, 1]) for (const b of [-1, 1]) o.box(L.plain, o.CL.pole, u + a * 2.5, 0, zc + b * 2.5, 0.45, 14, 0.45)
      o.cyl(L, o.r.color, u, 14, zc, 4.4, 5.5, 14)
      o.cone(L, o.CL.steel, u, 19.5, zc, 4.8, 2.6, 14)
      o.box(L.plain, o.CL.pole, u, 0, zc, 0.5, 14, 0.5)
      return w
    }
    const front = o.row.u + 6
    const dz = house(o, L, front, zc, w - 9, o.pick([9, 12]), o.rand() < 0.5 ? 2 : 1, { porch: o.rand() < 0.4 })
    o.box(L.plain, o.CL.path, (o.row.u + front) / 2, 0, dz, front - o.row.u, 0.12, 1.5)
    if (o.rand() < 0.5) car(o, L, o.row.u + 2.5, zc + (dz > zc ? -1 : 1) * (w / 2 - 4))
    return w
  },

  // Fields behind the villages / rural towns: striped crop plots, meadows with hay bales,
  // a windmill and a barn per side.
  fields(o) {
    const w = o.pick([30, 36, 42])
    if (!fits(o, w)) return 0
    const zc = o.z - w / 2
    const L = o.at(zc)
    for (let u = o.row.u; u + 24 < o.row.to; ) {
      const du = o.pick([30, 36, 42])
      const uc = u + du / 2
      const t = o.rand()
      if (o.n % 3 === 1 && u === o.row.u && !o.row.windmill) {
        o.row.windmill = true
        windmill(o, L, uc, zc)
      } else if (t < 0.12 && u > o.row.u) {
        o.box(L.plain, o.CL.barn, uc, 0, zc, 12, 7, 15)
        o.roofAt(L, o.CL.barnRoof, uc, 7, zc, 13.4, 5.5, 16, true)
        o.cyl(L, o.CL.silo, uc + 9, 0, zc - 4, 2.2, 12, 12)
        o.cyl(L, o.CL.barn, uc + 9, 12, zc - 4, 0.1, 2, 12, 2.4)
      } else if (t < 0.32) {
        // meadow + hay bales
        for (let k = 0; k < 4; k++) {
          const g = new CylinderGeometry(0.9, 0.9, 1.4, 10).rotateX(Math.PI / 2)
          g.translate(o.side * (uc + o.range(-du / 3, du / 3)), 0.9, zc + o.range(-w / 3, w / 3))
          L.roof.push(paint(g, o.CL.hay))
        }
      } else {
        const crop = o.pick(o.CL.crops)
        o.box(L.plain, o.CL.soil, uc, 0, zc, du - 3, 0.2, w - 3)
        const step = lite ? 4.5 : 3
        for (let k = u + 3; k < u + du - 3; k += step) o.box(L.plain, o.rand() < 0.15 ? crop[1] : crop[0], k, 0.2, zc, 1.6, crop[2], w - 5)
      }
      u += du
    }
    return w
  },

  // Urban / city blocks: flats (walls with windows) or glass towers.
  block(o) {
    if (o.rand() < 0.08 && o.n > 0) return fits(o, 6) ? 6 : 0 // an alley
    return BUILD.shop(o)
  },
  tower(o) {
    const w = o.pick(o.row.w)
    if (!fits(o, w)) return 0
    if (o.row.fill && o.rand() > o.row.fill) return w
    const L = o.at(o.z - w / 2)
    const zc = o.z - w / 2
    const u = o.row.u
    const d = o.pick(o.row.d)
    const list = o.r.neon ? L.night : L.tower
    const color = o.pick(o.r.walls)
    const fl = 3.2
    const [h0, h1] = o.row.h
    const floors = Math.max(5, Math.round((o.range(h0, h1) * (1 + o.tier * 0.25)) / fl))
    let f = 0 // floors built so far
    let bw = w - 4
    let bd = d
    let bu = u + d / 2
    // the front row stands on a podium: 3 floors over the whole lot, shops under it
    if (o.row.podium) {
      o.box(list, color, bu, 0, zc, bd, 3 * fl, bw)
      o.box(L.plain, o.r.trims[1], bu, 3 * fl, zc, bd + 0.3, 0.5, bw + 0.3)
      shopFront(o, L, u, zc, bw)
      f = 3
      bw -= 4
      bd -= 4
      bu += 2
    }
    const steps = 1 + Math.floor(o.rand() * 3)
    const remain = Math.max(3, floors - f)
    let used = 0
    for (let s = 0; s < steps && bw >= 6 && bd >= 6; s++) {
      const nf = s === steps - 1 || bw < 10 || bd < 10 ? remain - used : Math.max(2, Math.round(remain / steps))
      if (nf < 1) break
      const y = f * fl
      const h = nf * fl
      o.box(list, s % 2 && o.rand() < 0.4 ? o.pick(o.r.walls) : color, bu, y, zc, bd, h, bw)
      o.box(L.plain, o.r.trims[0], bu, y + h, zc, bd + 0.3, 0.5, bw + 0.3)
      if (o.r.neon) neonEdges(o, L, bu - bd / 2, y, h, zc, bw)
      f += nf
      used += nf
      if (used >= remain) break
      bw -= 4
      bd -= 4
    }
    const y = f * fl + 0.5
    // the top
    const t = o.rand()
    if (t < 0.25) {
      o.box(L.plain, o.CL.steel, bu, y, zc, 1, 8 + o.rand() * 10, 1)
      o.box(L.plain, o.CL.steel, bu, y, zc, 0.4, 16 + o.rand() * 14, 0.4)
      o.box(L.glow, '#ff3a3a', bu, y + 30, zc, 0.8, 0.8, 0.8)
    } else if (t < 0.45) {
      o.cone(L, o.pick(o.r.roofs), bu, y, zc, Math.min(bw, bd) * 0.7, Math.min(bw, bd) * 0.9)
    } else if (t < 0.6) {
      o.box(L.plain, '#3a3f4a', bu, y, zc, Math.min(bd, 10), 0.5, Math.min(bw, 10))
      o.box(L.plain, '#ffd23a', bu - 1.2, y + 0.5, zc, 0.6, 0.1, 3)
      o.box(L.plain, '#ffd23a', bu + 1.2, y + 0.5, zc, 0.6, 0.1, 3)
      o.box(L.plain, '#ffd23a', bu, y + 0.5, zc, 3, 0.1, 0.6)
    } else {
      rooftop(o, L, bu, y, zc, bd, bw)
    }
    if (o.r.neon && o.rand() < 0.45) {
      o.box(L.glow, o.pick(o.r.neon), bu - bd / 2 - 0.3, y + 1, zc, 0.4, 4, Math.min(bw - 2, 12))
      o.box(L.plain, o.CL.pole, bu - bd / 2 + 1, y, zc, 0.4, 2, 0.4)
    }
    return w
  },
}

function shopFront(o, L, u, zc, w) {
  if (o.rand() < 0.2) return
  const [a, b] = o.pick(o.CL.awnings)
  const n = Math.max(2, Math.floor((w - 2) / 1.5))
  const step = (w - 2) / n
  for (let k = 0; k < n; k++) o.box(L.plain, k % 2 ? b : a, u - 1, 2.8, zc - (w - 2) / 2 + step * (k + 0.5), 2, 0.3, step)
  o.box(L.glow, o.pick(o.CL.signs), u - 0.15, 3.4, zc, 0.3, 0.9, Math.min(w - 4, 8))
}

function rooftop(o, L, uc, y, zc, d, w) {
  const n = 1 + Math.floor(o.rand() * 3)
  for (let k = 0; k < n; k++) o.box(L.plain, o.CL.steel, uc + o.range(-d / 4, d / 4), y, zc + o.range(-w / 4, w / 4), 2, 1.4, 2)
  if (o.rand() < 0.3 && d >= 9) {
    const tu = uc + d / 4
    for (const s of [-1, 1]) o.box(L.plain, o.CL.pole, tu, y, zc + s * 1, 0.3, 2, 0.3)
    o.cyl(L, o.CL.tank, tu, y + 2, zc, 1.6, 3, 10)
    o.cone(L, o.CL.tank, tu, y + 5, zc, 1.8, 1, 10)
  }
  if (o.rand() < 0.14 && w >= 10) {
    const bu = uc - d / 4
    for (const s of [-1, 1]) o.box(L.plain, o.CL.pole, bu, y, zc + s * 3, 0.35, 3.5, 0.35)
    o.box(L.plain, '#ffffff', bu - 0.2, y + 3.4, zc, 0.4, 3.6, 9)
    o.box(L.glow, o.pick(o.CL.signs), bu - 0.45, y + 3.7, zc, 0.15, 3, 8.4)
  }
}

function neonEdges(o, L, uf, y, h, zc, w) {
  const c = o.pick(o.r.neon)
  for (const s of [-1, 1]) o.box(L.glow, c, uf - 0.15, y, zc + s * (w / 2 - 0.1), 0.3, h - 0.6, 0.3)
  o.box(L.glow, c, uf - 0.15, y + h - 0.9, zc, 0.3, 0.3, w)
}

function car(o, L, u, z) {
  const c = o.pick(o.CL.cars)
  o.box(L.plain, c, u, 0.45, z, 2.2, 1, 4.4)
  o.box(L.plain, c, u, 1.45, z + 0.3, 2, 0.9, 2.4)
  o.box(L.glow, '#bfe6ff', u, 1.55, z + 0.3, 2.05, 0.6, 2.2)
  for (const a of [-1, 1]) for (const b of [-1, 1]) o.box(L.plain, '#22252e', u + a * 0.95, 0, z + b * 1.4, 0.5, 0.9, 0.9)
}

function windmill(o, L, uc, zc) {
  const u = uc
  o.box(L.plain, o.CL.mill, u, 0, zc, 7, 6, 7)
  o.box(L.plain, o.CL.mill, u, 6, zc, 5.6, 5, 5.6)
  o.box(L.plain, o.CL.mill, u, 11, zc, 4.4, 4, 4.4)
  o.roofAt(L, o.CL.barnRoof, u, 15, zc, 5.4, 3, 5.4)
  o.box(L.plain, o.CL.barnDoor, u - 3.6, 0, zc, 0.3, 2.6, 1.6)
  const hubU = u - 3
  o.box(L.plain, o.CL.pole, hubU, 13.2, zc, 1.6, 1.6, 1.6)
  for (let k = 0; k < 4; k++) {
    const g = legoBoxGeo(0.3, 9, 1.4, 0, 4.9, 0)
    g.rotateX((k * Math.PI) / 2 + 0.35)
    g.translate(o.side * (hubU - 1), 14, zc)
    L.plain.push(paint(g, '#fff6e0'))
  }
  for (let k = 0; k < 6; k++) {
    const g = new CylinderGeometry(0.9, 0.9, 1.4, 10).rotateX(Math.PI / 2)
    g.translate(o.side * (u + o.range(-10, 10)), 0.9, zc + 8 + o.range(0, 8))
    L.roof.push(paint(g, o.CL.hay))
  }
}

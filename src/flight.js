import { CircleGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, Quaternion, RingGeometry, Vector3 } from 'three'
import { CART, CHANNEL, COARSE_POINTER, FLIGHT, FLY_ZONE, LANE, PLAZA, RIVER_REGIONS, SPAWN, powerMarks } from './config.js'
import { inputState } from './input.js'
import { player, resetPlayer, setPlayerOverride } from './player.js'
import { setFlightView, shake, syncYawToPlayer } from './camera.js'
import { createCart } from './cart.js'
import { buildRiver } from './river.js'
import { createFlightHud } from './flightHud.js'
import { createTrail } from './trail.js'
import { PoseBuffer } from './avatar/rig.js'
import * as snd from './audio/flight.js'
import * as laneSnd from './audio/lane.js'
import { addSkill, changed, flyMult, questFlight, skillPerClick, state, trailById, winsMult } from './state.js'
import { createLane, distanceWins } from './lane/hazards.js'
import { createLaneHud } from './laneHud.js'

// The cart launch. Standing in the yellow Launch Zone shows a LAUNCH button (E on
// desktop; Auto Launch skips it). Pressing it:
//   summon  a starting gate (two red posts + a bungee) pops up and a shopping cart drops in
//   hop     the player jumps into the cart and sits down
//   pull    the cart is drawn back against the bungee, wheels clicking
//   sky     release: the bungee SHOOTS the cart up into the sky with the rider inside; it
//           climbs, tips over the apex and falls back toward the road, faster and faster
//           (its shadow and a landing marker show where it comes down); every painted
//           power line it passes over pays Skill ("+N" next to the cart, the counter
//           under the distance)
//   throw   the cart slams onto the asphalt and the rider is THROWN out over its nose: an
//           arc with somersaults (the cart crashes on and tumbles by itself)
//   tumble  a few bouncing rolls on the asphalt (each pays Skill), then a face-down skid
//   rest    confetti, "+Wins" and "+Skill" pop over the player, then a fade back to spawn
// The path is planned at release so the total distance is exactly the Skill-based
// flight distance (FLIGHT in config.js); A/D or the joystick steers sideways. Lane
// animals (lane/hazards.js) read the plan and re-plan it on hits (the cart hops).

const easeOut = (s) => 1 - (1 - s) * (1 - s)
const easeOutCubic = (s) => 1 - Math.pow(1 - s, 3)
const easeInOut = (s) => 0.5 - 0.5 * Math.cos(Math.PI * s)
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)
const lerp = (a, b, k) => a + (b - a) * k
const TAU = Math.PI * 2
const deg = (d) => (d * Math.PI) / 180

// The Skill-based distance x the ridden cart's +FLY % (state.js flyMult), capped at the road's end.
export function flightDistance() {
  return Math.min(FLIGHT.maxDistance, (FLIGHT.baseDistance + FLIGHT.scale * Math.pow(Math.max(0, state.skill), FLIGHT.exponent)) * flyMult())
}

// Body poses written over the animator (character space: +x swings a limb backward,
// legs forward = -x, knees / elbows bend with +x, ArmL z+ / ArmR z- = out to the side).
const POSES = {
  sit: {
    LegL1: { x: deg(-76), z: deg(9) }, LegR1: { x: deg(-76), z: deg(-9) }, LegL2: { x: deg(42) }, LegR2: { x: deg(42) },
    ArmL1: { x: deg(-58), z: deg(22) }, ArmR1: { x: deg(-58), z: deg(-22) }, ArmL2: { x: deg(38) }, ArmR2: { x: deg(38) },
    Spine1: { x: deg(4) },
  },
  // thrown: arms flung up and wide, legs trailing
  fling: {
    LegL1: { x: deg(18), z: deg(16) }, LegR1: { x: deg(-10), z: deg(-16) }, LegL2: { x: deg(40) }, LegR2: { x: deg(55) },
    ArmL1: { x: deg(-150), z: deg(48) }, ArmR1: { x: deg(-150), z: deg(-48) }, ArmL2: { x: deg(20) }, ArmR2: { x: deg(20) },
    Spine1: { x: deg(-12) }, Neck1: { x: deg(-18) },
  },
  // bouncing on the asphalt: limbs all over the place
  tumble: {
    LegL1: { x: deg(-40), z: deg(30) }, LegR1: { x: deg(20), z: deg(-34) }, LegL2: { x: deg(70) }, LegR2: { x: deg(35) },
    ArmL1: { x: deg(-100), z: deg(80) }, ArmR1: { x: deg(-60), z: deg(-85) }, ArmL2: { x: deg(45) }, ArmR2: { x: deg(30) },
    Spine1: { x: deg(18) },
  },
  // face down on the road, spread out like a starfish
  lie: {
    LegL1: { x: deg(-4), z: deg(20) }, LegR1: { x: deg(-4), z: deg(-22) }, LegL2: { x: deg(14) }, LegR2: { x: deg(8) },
    ArmL1: { x: deg(-128), z: deg(52) }, ArmR1: { x: deg(-122), z: deg(-58) }, ArmL2: { x: deg(16) }, ArmR2: { x: deg(22) },
    Spine1: { x: deg(-6) }, Neck1: { x: deg(-24), y: deg(18) },
  },
}

export function createFlight({ scene, camera, fx, ringPulse, blocked = () => false, onDone }) {
  const surface = CHANNEL.surfaceY
  const seatY = surface + CART.seatY
  const cart = createCart(scene, { onImpact: cartImpact })
  const vanishAt = new Vector3()
  buildRiver(scene)
  const hud = createFlightHud(camera)
  const trail = createTrail(scene)
  const trailPos = new Vector3()
  const holdTmp = new Vector3()
  const MARKS = powerMarks()
  let slowLeft = 0 // s of hit-stop slow motion left (real time)
  const lite = COARSE_POINTER ? 0.55 : 1

  // While the cart is up in the sky: its shadow on the road (darker and tighter as it
  // comes down) and a pulsing yellow marker where it is going to land.
  const decal = (geo, color, opacity) => {
    const m = new Mesh(geo.rotateX(-Math.PI / 2), new MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }))
    m.renderOrder = 3
    return m
  }
  const shadow = decal(new CircleGeometry(1, 32), '#10121a', 0)
  shadow.visible = false
  scene.add(shadow)
  const marker = new Group()
  const markRing = decal(new RingGeometry(0.84, 1, 48), '#ffe46a', 0)
  const markInner = decal(new RingGeometry(0.3, 0.42, 32), '#ffffff', 0)
  const markFill = decal(new CircleGeometry(0.84, 48), '#ffd23a', 0)
  marker.add(markFill, markRing, markInner)
  marker.visible = false
  scene.add(marker)
  function updateDecals(t) {
    const seg = f?.plan?.segs[f.seg]
    const up = !!f && f.phase === 'fly' && f.inCart && !f.held && seg?.kind === 'sky'
    shadow.visible = up
    marker.visible = up
    if (!up) return
    const p = player.renderPosition
    const h = Math.max(0, p.y - surface)
    shadow.position.set(p.x, surface + 0.05, p.z - 0.3)
    shadow.scale.setScalar(1.3 + h * 0.025)
    shadow.material.opacity = clamp(0.5 - h * 0.006, 0.1, 0.5)
    // the marker fades in partway down the fall and pulses faster as touchdown nears
    const fall = seg.ta >= 1 ? 1 : clamp((f.airS - seg.ta) / (1 - seg.ta), 0, 1)
    const show = clamp((fall - FLIGHT.sky.marker) / 0.15, 0, 1)
    const near = clamp((fall - FLIGHT.sky.marker) / (1 - FLIGHT.sky.marker), 0, 1)
    const pulse = 0.5 + 0.5 * Math.sin(t * (6 + 12 * near))
    marker.position.set(f.x, surface + 0.06, seg.z0 - seg.L)
    marker.scale.setScalar(2.6 * (1 + 0.12 * pulse) * (1.4 - 0.4 * near))
    markInner.rotation.z = t * 2
    markRing.material.opacity = show * (0.65 + 0.35 * pulse)
    markInner.material.opacity = show * 0.8
    markFill.material.opacity = show * (0.12 + 0.18 * pulse)
  }

  // Lane animals (lane/hazards.js): they read the planned path and re-plan it on hits.
  const laneHud = createLaneHud()
  const lane = createLane({
    scene,
    fx,
    hud: laneHud,
    ops: {
      timeTo: (z) => timeTo(z),
      zAfter: (s) => zAfter(s),
      yAt: (z) => yAt(z),
      endZ: () => endZ(),
      dist: () => f?.dist ?? 0,
      planD: () => f?.plan?.D ?? 0,
      getX: () => f?.x ?? player.position.x,
      setX: (x) => {
        if (f) f.x = clamp(x, -CHANNEL.halfWidth + 3, CHANNEL.halfWidth - 3)
      },
      lockSteer: (s) => {
        if (f) f.steerLock = Math.max(f.steerLock, s)
      },
      knock(o) {
        if (f?.phase === 'fly' && !f.held) replan(remainingL() * o.factor, { ...o, v: f.speed * 0.7 })
      },
      hold(get) {
        if (!f) return
        f.holdRem = remainingL()
        f.held = get
        setView('skip')
      },
      release(o) {
        if (!f || !f.held) return
        f.held = null
        if (o.resetDist) f.dist = distOf(player.position.z) // carried back: that distance is lost
        if (f.phase === 'fly') replan(f.holdRem * o.factor, { ...o, v: Math.max(8, f.speed * 0.5) })
      },
      boost(o) {
        if (f?.phase !== 'fly' || f.held || !f.inCart) return 0 // helpers only push the cart
        const before = remainingL()
        replan(before + o.add, { ...o, v: Math.max(f.speed, 14) })
        return Math.max(0, remainingL() - before)
      },
      slowMo: (s) => {
        slowLeft = Math.max(slowLeft, s)
      },
      shake: (m) => {
        if (state.settings?.shake !== false) shake(m)
      },
      renderPos: () => player.renderPosition,
      velocity: () => player.velocity,
    },
  })
  laneHud.onDash(() => LANE.enabled && f?.phase === 'fly' && lane.dash(Math.sign(inputState.move.x)))
  laneHud.onMash(() => lane.mash())

  let f = null // the launch in progress (see start)
  let autoDelay = 0
  let animator = null

  const regionAt = (d) => {
    let i = 0
    while (i + 1 < RIVER_REGIONS.length && d >= RIVER_REGIONS[i + 1].at) i++
    return i
  }
  const distOf = (z) => Math.max(0, PLAZA.minZ - z)
  const shakeOn = () => state.settings?.shake !== false

  // --- Planning -----------------------------------------------------------------------
  // In the cart: the sky arc (from wherever the cart is) -> the throw arc -> bounces -> skid.
  // Out of it (knocked mid-throw): arc -> bounces -> skid.
  function plan(p0) {
    const D = flightDistance()
    const k = Math.min(1, D / FLIGHT.maxDistance)
    const flips = Math.round(lerp(FLIGHT.flips[0], FLIGHT.flips[1], Math.sqrt(k)))
    const segs = buildSegs(p0, D + Math.max(0, p0.z - PLAZA.minZ), k, { cart: true, launch: true, flips })
    return { D, k, segs, flips }
  }
  //   apex      m the arc climbs (default from its length); airShare of L in the arc
  //   flips     somersaults (-1 = a backward tumble); v = the cart's speed going in (m/s)
  function buildSegs(p0, L, k, o = {}) {
    const segs = []
    let z = p0.z
    let rem = L
    if (o.cart) {
      // everything but a short tail is flown in the cart; the tail is the toss out of it
      const tail = clamp(rem * FLIGHT.tail.share, Math.min(FLIGHT.tail.min, rem * 0.6), FLIGHT.tail.max)
      const skyL = Math.max(0.5, rem - tail)
      segs.push(skySeg(z, p0.y, skyL, o))
      z -= skyL
      rem -= skyL
      throwSegs(segs, z, seatY, Math.max(1, rem), k, { thrown: true, flips: o.flips ?? 1 })
    } else throwSegs(segs, z, p0.y, Math.max(0.5, rem), k, o)
    return segs
  }
  // The cart's flight through the sky: forward speed eases from v0 to v1 (constant
  // deceleration, like air drag), height climbs to `apex` at share `ta` of the time and
  // falls back to the seat height on the road, quicker than it rose. From the launch the
  // apex scales with the distance; after a knock / boost mid-air it is a bump above the
  // current height (a helper's boost lifts it higher).
  function skySeg(z, y0, L, o) {
    const S = FLIGHT.sky
    let T = clamp(S.timeBase + Math.sqrt(L) * S.timePerSqrtM, S.time[0], S.time[1])
    let apex
    let ta
    if (o.launch) {
      apex = seatY + clamp(S.heightBase + L * S.heightPerMetre, S.height[0], S.height[1])
      ta = S.apexAt
    } else {
      const bump = o.add != null ? Math.max(1, (o.apex ?? 1) * 1.5) : clamp(o.apex ?? 1, 0, FLIGHT.cartHop.maxApex)
      apex = Math.max(y0 + bump, seatY + 0.6)
      const up = Math.sqrt(Math.max(0, apex - y0))
      const down = Math.sqrt(Math.max(0, apex - seatY))
      ta = up / Math.max(1e-6, up + down)
      T = Math.max(T, 0.35 * (up + down) + 0.3) // never faster than a hard fall
    }
    const r = S.endSpeed
    const v0 = (2 * L) / (T * (1 + r))
    const v1 = v0 * r
    return { kind: 'sky', cart: true, z0: z, L, T, y0, apex, yL: seatY, ta: clamp(ta, 0, 0.95), v0, v1, a: (v1 - v0) / T, launch: !!o.launch }
  }
  // [forward, vertical] speed on a sky arc at time t (m/s)
  function skyVel(s, t, out) {
    const u = clamp(t / s.T, 0, 1)
    out[0] = s.v0 + s.a * clamp(t, 0, s.T)
    if (u < s.ta) out[1] = (2 * (s.apex - s.y0) * (1 - u / s.ta)) / (s.ta * s.T)
    else out[1] = (-2 * (s.apex - s.yL) * ((u - s.ta) / (1 - s.ta))) / ((1 - s.ta) * s.T)
    return out
  }
  function throwSegs(segs, z, y0, L, k, o) {
    // a short, low toss over the cart's nose (the reference never leaves the ground for long)
    const slide = clamp(L * 0.15, Math.min(FLIGHT.slide[0], L * 0.3), FLIGHT.slide[1])
    const air = clamp(L * (o.thrown ? 0.45 : o.airShare ?? 0.45), 0.3, FLIGHT.throwMax)
    const hops = Math.max(0, L - air - slide)
    {
      const H = clamp(o.apex ?? air * FLIGHT.throwPeakPerMetre, o.thrown ? FLIGHT.throwPeak[0] : 0, FLIGHT.throwPeak[1])
      const g = FLIGHT.throwGravity
      const vy = Math.sqrt(2 * g * Math.max(0.05, H))
      const T = Math.max(0.18, (vy + Math.sqrt(vy * vy + 2 * g * Math.max(0, y0 - surface))) / g)
      segs.push({ kind: 'air', floor: surface, z0: z, L: air, T, y0, vy, g, thrown: !!o.thrown, flips: o.flips ?? 0 })
    }
    z -= air
    if (hops > 0.5) {
      const n = clamp(Math.round(FLIGHT.skips.base + Math.log2(1 + L / FLIGHT.skips.per)), o.thrown ? FLIGHT.skips.min : 1, FLIGHT.skips.max)
      const r = FLIGHT.hopDecay
      const h1 = (hops * (1 - r)) / (1 - Math.pow(r, n))
      for (let i = 0; i < n; i++) {
        const Lh = h1 * Math.pow(r, i)
        const H = clamp(Lh * FLIGHT.hopHeightPerMetre, FLIGHT.hopHeight[0], FLIGHT.hopHeight[1])
        const g = FLIGHT.hopGravity
        const vy = Math.sqrt(2 * g * H)
        segs.push({ kind: 'hop', floor: surface, z0: z, L: Lh, T: (2 * vy) / g, y0: surface, vy, g, n: i + 1 })
        z -= Lh
      }
    }
    const last = segs[segs.length - 1]
    const vLast = Math.max(2, last.L / last.T)
    segs.push({ kind: 'slide', z0: z, L: slide, T: clamp((2 * slide) / vLast, FLIGHT.slideTime[0], FLIGHT.slideTime[1]) })
  }

  // --- Path queries for the lane animals (lane/hazards.js) -----------------------------------
  function segZ(s, t) {
    if (s.kind === 'slide') return s.z0 - s.L * easeOut(clamp(t / s.T, 0, 1))
    if (s.kind === 'roll' || s.kind === 'sky') {
      const u = clamp(t, 0, s.T)
      return s.z0 - (s.v0 * u + 0.5 * s.a * u * u)
    }
    return s.z0 - s.L * clamp(t / s.T, 0, 1)
  }
  function segY(s, t) {
    if (s.kind === 'slide') return surface
    if (s.kind === 'roll') return seatY
    if (s.kind === 'sky') {
      const u = clamp(t / s.T, 0, 1)
      if (u < s.ta) {
        const w = 1 - u / s.ta
        return s.apex - (s.apex - s.y0) * w * w
      }
      const w = (u - s.ta) / (1 - s.ta)
      return s.apex - (s.apex - s.yL) * w * w
    }
    return Math.max(s.floor ?? surface, s.y0 + s.vy * t - 0.5 * s.g * t * t)
  }
  function zAfter(sec) {
    if (!f?.plan) return null
    const segs = f.plan.segs
    let t = f.segT + sec
    for (let i = f.seg; i < segs.length; i++) {
      if (t <= segs[i].T) return segZ(segs[i], t)
      t -= segs[i].T
    }
    return null
  }
  // where on the plan z is: [segment, t within it, s before it from now]
  function locate(z) {
    const segs = f.plan.segs
    let acc = -f.segT
    for (let i = f.seg; i < segs.length; i++) {
      const s = segs[i]
      if (z >= s.z0 - s.L) {
        const d = clamp(s.z0 - z, 0, s.L)
        let t
        if (s.kind === 'slide') t = s.T * (1 - Math.sqrt(1 - d / Math.max(1e-6, s.L)))
        else if (s.kind === 'roll' || s.kind === 'sky') t = Math.abs(s.a) < 1e-6 ? d / s.v0 : (-s.v0 + Math.sqrt(Math.max(0, s.v0 * s.v0 + 2 * s.a * d))) / s.a
        else t = s.T * (d / Math.max(1e-6, s.L))
        return [s, clamp(t, 0, s.T), acc]
      }
      acc += s.T
    }
    return null
  }
  function timeTo(z) {
    if (!f?.plan) return Infinity
    const at = locate(z)
    return at ? Math.max(0, at[2] + at[1]) : Infinity
  }
  function yAt(z) {
    if (!f?.plan) return surface
    const at = locate(z)
    return at ? segY(at[0], at[1]) : surface
  }
  function endZ() {
    if (!f?.plan) return 0
    const last = f.plan.segs[f.plan.segs.length - 1]
    return last.z0 - last.L
  }
  // Re-plan from where the player is now, covering L more metres.
  function replan(L, o) {
    const p = player.position
    const maxL = Math.max(0, CHANNEL.length - 60 - distOf(p.z))
    f.plan.segs = buildSegs(new Vector3(p.x, p.y, p.z), clamp(L, 0.5, maxL), f.plan.k, { ...o, cart: f.inCart })
    f.seg = 0
    f.segT = 0
    f.flipsDone = 0
    f.airS = 0
    f.braked = false
    f.pitch0 = ((pitch % TAU) + TAU) % TAU
    resetSky()
    setView(f.inCart ? 'sky' : 'air')
    if (f.inCart) {
      snd.cartHop(Math.min(1, (o.apex ?? 1) / 8))
      if (o.add != null) {
        // a helper's boost: a puff of lift under the cart
        const p = player.position
        fx.burst(24, { x: p.x, y: p.y, z: p.z, spread: 1.4, speed: 6, up: -0.6, gravity: 2, drag: 2, life: 0.9, size: 1.1, sizeEnd: 2.2, color: ['#ffffff', '#e8f4ff'], alpha: 0.6, additive: false })
        fx.burst(18, { x: p.x, y: p.y + 1, z: p.z, spread: 1.5, speed: 7, up: 1, gravity: -5, life: 0.8, size: 0.55, color: ['#ffe46a', '#ffffff', '#7dff6a'], shape: 'star' })
      }
    }
  }
  // the sky arc's one-shot events (apex twinkle, falling whistle) re-arm on every plan
  let whistleStop = null
  function resetSky() {
    whistleStop?.()
    whistleStop = null
    if (!f) return
    f.apexDone = false
    f.whistled = false
  }
  let view = null
  function setView(v) {
    if (v === view) return
    view = v
    setFlightView(v)
  }
  const remainingL = () => Math.max(0, distOf(endZ()) - distOf(player.position.z))

  // --- Start ----------------------------------------------------------------------------
  function start() {
    if (f) return
    const p = player.position
    const x = clamp(p.x, -CHANNEL.halfWidth + 4, CHANNEL.halfWidth - 4)
    const gateZ = clamp(p.z - CART.ahead, FLY_ZONE.minZ + 1.2, FLY_ZONE.maxZ - 4)
    cart.summon(x, gateZ)
    f = {
      phase: 'summon',
      t: 0,
      from: new Vector3(p.x, p.y, p.z),
      x,
      plan: null,
      seg: 0,
      segT: 0,
      dist: 0,
      region: 0,
      milestone: 0,
      mark: 0, // next power line
      bestShown: state.bestDistance < 25,
      inCart: true,
      skips: 0,
      skillGained: 0,
      speed: 0,
      spin: 0,
      spinRate: 0,
      flipsDone: 0,
      airS: 0,
      braked: false,
      rewarded: false,
      steerLock: 0, // s of no steering left (frozen)
      held: null, // fn(out) while an animal holds the player (lane/hazards.js)
      holdRem: 0,
      pitch0: 0, // body pitch when the path was last re-planned
      vh: 0, // forward / vertical speed on the sky arc (m/s)
      vy: 0,
      apexDone: false,
      whistled: false,
      armsUp: 0, // 0..1 the rider's arms thrown up in the air ("wheee")
    }
    hud.showFly(false)
    hud.setFlying(true)
    hud.power(0, false)
    setView('aim')
    player.facing = Math.PI
    setPlayerOverride(step)
    snd.summon()
    const dx = x - p.x
    const dz = gateZ - p.z
    const dl = Math.hypot(dx, 0.6, dz)
    fx.burst(26, { x: p.x, y: p.y + 1.3, z: p.z, dir: [dx / dl, 0.6 / dl, dz / dl], speed: dl / 0.45, jitter: 1.2, life: 0.5, size: 0.5, color: ['#ffffff', '#ffe46a', '#ff8fe0'], shape: 'star' })
    fx.burst(30, { x, y: 0.2, z: gateZ, spread: 3, speed: 4, up: 1.6, gravity: -4, life: 1, size: 0.55, color: ['#ffe46a', '#ffffff', '#ff4a4a'], shape: 'star' })
    ringPulse(x, 0.12, gateZ, '#ffe46a', 4)
  }
  hud.showFly(false, () => {
    if (!blocked()) start()
  })
  // E launches while the button shows (capture phase: game.js's E = train must not also fire).
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.code !== 'KeyE' || e.repeat || !hud.flyVisible()) return
      e.stopImmediatePropagation()
      if (!blocked()) start()
    },
    true,
  )
  // While riding: Space / Shift = Dash; when trapped, Space / E / A / D / arrows mash free.
  const MASH_KEYS = ['Space', 'KeyE', 'Enter', 'KeyA', 'KeyD', 'KeyW', 'KeyS', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']
  window.addEventListener(
    'keydown',
    (e) => {
      if (!LANE.enabled || !f || f.phase !== 'fly' || e.repeat) return
      if (lane.trapped()) {
        if (MASH_KEYS.includes(e.code)) {
          lane.mash()
          e.preventDefault()
        }
        return
      }
      if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        lane.dash(Math.sign(inputState.move.x))
        e.preventDefault()
      }
    },
    true,
  )

  function release() {
    const p0 = cart.seat(new Vector3())
    f.plan = plan(p0)
    f.phase = 'fly'
    f.seg = 0
    f.segT = 0
    const s0 = f.plan.segs[0]
    skyVel(s0, 0, vel2)
    f.vh = vel2[0]
    f.vy = vel2[1]
    f.speed = Math.hypot(f.vh, f.vy)
    resetSky()
    cart.release()
    const k = f.plan.k
    snd.launch(Math.sqrt(k))
    snd.skyLaunch(Math.sqrt(k), s0.ta * s0.T)
    if (shakeOn()) shake(0.45)
    setView('sky')
    hud.counter(true, 0)
    const gp = cart.position
    // the shot: a star blast along the launch line, a puff of smoke ring and a shockwave
    const dl = Math.hypot(f.vh, f.vy) || 1
    fx.burst(46, { x: p0.x, y: p0.y + 1, z: p0.z, dir: [0, f.vy / dl, -f.vh / dl], speed: 14, jitter: 6, gravity: -14, drag: 1.5, life: 0.9, size: 0.55, color: ['#ffd23a', '#ffffff', '#ff8fe0'], shape: 'star' })
    fx.burst(30, { x: p0.x, y: 0.4, z: p0.z + 0.6, spread: 2.2, speed: 6, up: 0.25, gravity: 1.5, drag: 2.4, life: 1.3, size: 1.6, sizeEnd: 3.2, color: ['#e8ecf2', '#ffffff', '#c9ced8'], alpha: 0.6, additive: false })
    fx.burst(20, { x: p0.x, y: 0.3, z: p0.z, spread: 0.6, speed: 3, up: 3, gravity: 0.5, drag: 1.6, life: 1.4, size: 1.3, sizeEnd: 2.8, color: ['#ffffff', '#fff3c0'], alpha: 0.5, additive: false })
    fx.burst(24, { x: p0.x, y: 0.3, z: p0.z, spread: 0.4, speed: 7, up: 0.1, gravity: -20, life: 0.6, size: 0.22, color: ['#fff3a0', '#ffb21f', '#ff7a1f'], colorEnd: '#ff4a1f' })
    ringPulse(p0.x, 0.12, p0.z, '#ffffff', 9)
    if (gp) ringPulse(gp.x, 0.15, gp.z, '#ff4a4a')
    // an equipped trail streams behind the rider (none by default on the road)
    const tr = trailById(state.trail)
    if (tr) {
      trail.setColors(tr.colors)
      trail.start(trailPos.set(p0.x, p0.y + 1, p0.z))
    }
    if (LANE.enabled) lane.begin() // off: no animals, helpers or bosses (LANE.enabled)
  }

  const vel2 = [0, 0]
  // Over the top of the arc: a twinkle and a ring of stars around the rider.
  function onApex(seg) {
    const p = player.position
    snd.apex(clamp((seg.apex - seg.y0) / 60, 0.2, 1))
    fx.burst(Math.round(26 * (COARSE_POINTER ? 0.6 : 1)), { x: p.x, y: p.y + 1.2, z: p.z, spread: 0.5, speed: 6, up: 0, gravity: 0, drag: 2.2, life: 1, size: 0.6, color: ['#ffffff', '#ffe46a', '#9fe6ff'], shape: 'star', swirl: 2 })
  }

  // --- Events on the road -----------------------------------------------------------------
  function dust(x, z, k, o = {}) {
    const s = clamp(k, 0.3, 1.5)
    fx.burst(Math.round(14 * s), { x, y: surface + 0.2, z, spread: 1.2 * s, speed: 4.5 * s, up: 0.5, gravity: 1, drag: 2.6, life: 0.9, size: 0.8 * s, sizeEnd: 1.8 * s, color: ['#e9e4da', '#ffffff', '#cfc7b8'], alpha: 0.42, additive: false })
    // little asphalt chips
    fx.burst(Math.round(18 * s), { x, y: surface + 0.15, z, spread: 0.8 * s, speed: 6 * s, up: 1.8, gravity: -26, life: 0.7, size: 0.22, color: ['#3a3f55', '#6a7090', '#2a2d3a'], additive: false, shape: 'square' })
    if (o.stars) fx.burst(Math.round(10 * s), { x, y: surface + 1, z, spread: 1.2, speed: 4, up: 1.4, gravity: -6, life: 0.7, size: 0.45, color: ['#ffe46a', '#ffffff'], shape: 'star' })
  }
  function sparks(x, z, n = 18) {
    fx.burst(n, { x, y: surface + 0.2, z: z + 0.6, dir: [0, 0.35, 1], speed: 9, jitter: 4, gravity: -22, life: 0.45, size: 0.18, color: ['#fff3a0', '#ffb21f', '#ff7a1f'], colorEnd: '#ff4a1f' })
  }
  // The loose cart hitting the road.
  function cartImpact(k, p, kind) {
    if (kind === 'drop') {
      snd.cartDrop()
      dust(p.x, p.z, 0.6)
      if (shakeOn()) shake(0.1)
      return
    }
    snd.cartHit(k)
    sparks(p.x, p.z - 0.6, Math.round(14 * k + 6))
    dust(p.x, p.z, 0.4 + k * 0.6)
    if (shakeOn() && k > 0.5) shake(0.08 * k)
  }
  // Pays n x Skill per click; returns the Skill added.
  function payPower(n) {
    const gain = Math.round(n * skillPerClick())
    if (gain <= 0) return 0
    addSkill(gain)
    f.skillGained += gain
    changed()
    hud.power(f.skillGained, true)
    return gain
  }
  function onMarker(i) {
    const pos = player.renderPosition
    const gain = payPower(FLIGHT.markerSkill)
    if (gain > 0) hud.pop(gain, 'bolt', { dx: -8 + (i % 2) * 3, dy: -3 })
    snd.power(i)
    fx.burst(22, { x: pos.x, y: pos.y + 1.2, z: pos.z - 1.5, spread: 2.5, speed: 6, up: 1, gravity: -6, life: 0.7, size: 0.55, color: ['#ffe46a', '#ffd21f', '#ffffff'], shape: 'star' })
    fx.burst(6, { x: pos.x, y: surface + 0.15, z: pos.z - 2, spread: 0.5, dir: [0, 0, 0], speed: 0, jitter: 0, life: 0.4, size: 2, sizeEnd: 0.4, color: '#fff3a0', alpha: 0.5 })
  }
  function brake() {
    f.braked = true
    snd.brake()
    const p = player.position
    for (const sx of [-0.55, 0.55]) sparks(p.x + sx, p.z, 10)
  }
  // The sky arc ends: the cart slams onto the asphalt (k 0..1 = how hard).
  function touchdown(prev) {
    const p = player.position
    const k = clamp((prev.apex - prev.yL) / 50, 0.25, 1)
    snd.skyLand(k)
    if (shakeOn()) shake(0.25 + 0.35 * k)
    slowLeft = Math.max(slowLeft, 0.06 + 0.08 * k) // a beat of hit stop on the slam
    ringPulse(p.x, surface + 0.08, p.z, '#ffffff', 8 + 6 * k)
    ringPulse(p.x, surface + 0.1, p.z, '#ffd23a', 5 + 3 * k)
    dust(p.x, p.z, 1.5, { stars: true })
    dust(p.x, p.z - 1.5, 1.2)
    // a low ring of smoke rolling outward
    fx.burst(Math.round(36 * (COARSE_POINTER ? 0.6 : 1)), { x: p.x, y: surface + 0.3, z: p.z, spread: 0.8, speed: 10 + 6 * k, up: 0.05, gravity: 0.4, drag: 2.6, life: 1.3, size: 1.5, sizeEnd: 3.4, color: ['#e9e4da', '#ffffff', '#cfc7b8'], alpha: 0.5, additive: false })
    // chunks of asphalt kicked up
    fx.burst(Math.round(26 * (0.6 + k)), { x: p.x, y: surface + 0.2, z: p.z, spread: 1.2, speed: 8 + 5 * k, up: 2.4, gravity: -28, life: 0.9, size: 0.32, color: ['#3a3f55', '#6a7090', '#2a2d3a', '#ffd23a'], additive: false, shape: 'square' })
    for (const sx of [-0.6, 0.6]) sparks(p.x + sx, p.z, 18)
  }
  // The cart lands (or the roll ends): the cart noses over and the rider flies out.
  function eject(seg, prev) {
    f.inCart = false
    whistleStop?.()
    whistleStop = null
    if (prev?.kind === 'sky') touchdown(prev)
    const p = player.position
    // the cart careens off to one side (never into the camera's view of the rider)
    const side = inputState.move.x ? -Math.sign(inputState.move.x) : Math.random() < 0.5 ? -1 : 1
    const v = new Vector3(side * (3.5 + Math.random() * 2), 0, -clamp(f.vh * 0.6, 7, 30))
    cart.eject(v)
    snd.eject(Math.min(1, f.speed / 40))
    if (shakeOn()) shake(0.22)
    sparks(p.x, p.z, 24)
    dust(p.x, p.z, 0.8)
    fx.burst(16, { x: p.x, y: p.y + 1.4, z: p.z, spread: 1, speed: 5, up: 1.3, gravity: -8, life: 0.7, size: 0.5, color: ['#ffffff', '#ffe46a'], shape: 'star' })
    setView('air')
    f.spinRate = (Math.random() - 0.5) * 2
    f.flipsDone = 0
  }
  function onBounce(seg) {
    f.skips++ // counts across re-plans
    const n = f.skips
    const pos = player.position
    const k = Math.min(1.3, 0.45 + seg.L / 40)
    dust(pos.x, pos.z, k, { stars: true })
    snd.thud(n, k)
    if (shakeOn()) shake(0.07 + 0.1 * Math.min(1, k))
    const gain = payPower(n * FLIGHT.skipSkill)
    if (gain > 0) hud.pop(gain, 'bolt', { dx: 7, dy: -4 })
    f.spinRate = (Math.random() - 0.5) * 6
  }
  function onSlide(seg) {
    const pos = player.position
    dust(pos.x, pos.z, 0.8)
    snd.skid(seg.T)
    setView('skip')
  }
  function finishFlight() {
    const dist = f.dist
    // Wins: distance Wins (curving up with distance) x dodge bonus + boss bonuses,
    // x the usual Wins multiplier, x2 for the first LANE.beginnerFlights flights.
    const ls = lane.summary()
    const beginner = state.flights < LANE.beginnerFlights ? LANE.beginnerMult : 1
    const wins = Math.round((distanceWins(dist) * ls.mult + ls.bonusWins) * winsMult() * beginner)
    state.wins += wins
    state.tokens += FLIGHT.raceTokensPerFlight
    state.flights++
    if (dist > state.bestDistance) state.bestDistance = dist
    questFlight(dist) // "fly N m in one launch" quests
    if (state.stats) {
      if (dist >= 1000) state.stats.longFlights = (state.stats.longFlights ?? 0) + 1
      state.stats.dodges = (state.stats.dodges ?? 0) + ls.dodges
      state.stats.closeCalls = (state.stats.closeCalls ?? 0) + ls.near
      state.stats.laneHits = (state.stats.laneHits ?? 0) + ls.hits
      state.stats.boosts = (state.stats.boosts ?? 0) + ls.boosts
    }
    changed()
    const p = player.renderPosition
    // confetti: a pop over the player and a slower rain
    const conf = ['#ff4a6a', '#ffd23a', '#3fa2ff', '#7dff6a', '#b45cff', '#ff8fe0', '#ffffff']
    fx.burst(70, { x: p.x, y: p.y + 1.2, z: p.z - 1, spread: 1, speed: 10, up: 1.7, gravity: -9, drag: 1.7, life: 2, size: 0.26, color: conf, additive: false, shape: 'square', swirl: 2 })
    fx.burst(50, { x: p.x, y: p.y + 8, z: p.z - 2, spread: 10, speed: 1, up: 0.2, gravity: -2.2, drag: 0.8, life: 2.6, size: 0.24, color: conf, additive: false, shape: 'square', swirl: 3 })
    fx.burst(24, { x: p.x, y: p.y + 2, z: p.z, spread: 2, speed: 6, up: 1.4, gravity: -5, life: 1, size: 0.6, color: ['#ffe46a', '#ffffff'], shape: 'star' })
    ringPulse(p.x, surface + 0.08, p.z, '#ffd23a', 7)
    hud.reward(wins, f.skillGained, snd.count)
    if (state.settings?.flightAlerts !== false) {
      laneHud.summary(ls, beginner)
      if (beginner > 1) laneSnd.beginnerBonus()
    }
    snd.confetti()
    snd.reward(wins)
    f.rewarded = true
  }

  // --- Physics tick (replaces the character controller during a launch) -----------------------
  function steer(dt, pl) {
    if (f.steerLock > 0) {
      f.steerLock = Math.max(0, f.steerLock - dt) // frozen: no steering
      return
    }
    f.x = clamp(f.x + inputState.move.x * FLIGHT.steer * dt, -CHANNEL.halfWidth + 3, CHANNEL.halfWidth - 3)
    pl.facing = Math.PI - inputState.move.x * 0.3
  }
  const prevPos = new Vector3()
  // player.position is a plain { x, y, z }
  const setPos = (pl, v) => {
    pl.position.x = v.x
    pl.position.y = v.y
    pl.position.z = v.z
  }
  function step(rawDt, pl) {
    if (!f) return
    prevPos.set(pl.position.x, pl.position.y, pl.position.z)
    const dt = f.phase === 'fly' && slowLeft > 0 ? rawDt * LANE.slowMo : rawDt // hit stop
    f.t += dt
    if (f.phase === 'summon') {
      setPos(pl, f.from)
      pl.facing = Math.PI
      pl.grounded = true
      if (cart.summoned() && f.t > 0.5) {
        f.phase = 'hop'
        f.t = 0
        snd.hopIn()
      }
    } else if (f.phase === 'hop') {
      const s = Math.min(1, f.t / FLIGHT.hopIn)
      const seat = cart.seat(holdTmp)
      const e = easeOut(s)
      pl.position.x = lerp(f.from.x, seat.x, e)
      pl.position.z = lerp(f.from.z, seat.z, e)
      pl.position.y = lerp(f.from.y, seat.y, e) + 4 * 1.7 * s * (1 - s)
      pl.facing = Math.PI
      pl.grounded = false
      if (s >= 1) {
        f.phase = 'settle'
        f.t = 0
        cart.thump(1)
        if (shakeOn()) shake(0.06)
      }
    } else if (f.phase === 'settle' || f.phase === 'pull') {
      if (f.phase === 'settle' && f.t >= FLIGHT.settle) {
        f.phase = 'pull'
        f.t = 0
        snd.stretch(FLIGHT.pull)
      }
      if (f.phase === 'pull') cart.setPull(easeInOut(Math.min(1, f.t / FLIGHT.pull)))
      setPos(pl, cart.seat(holdTmp))
      pl.facing = Math.PI
      pl.grounded = true
      if (f.phase === 'pull' && f.t >= FLIGHT.pull + 0.12) release()
    } else if (f.phase === 'fly' && f.held) {
      // an animal holds the player: the path waits, the feet follow its grab point
      f.held(holdTmp)
      setPos(pl, holdTmp)
      f.x = clamp(holdTmp.x, -CHANNEL.halfWidth + 3, CHANNEL.halfWidth - 3)
      pl.grounded = false
      f.speed *= Math.exp(-2 * dt)
      f.dist = Math.max(f.dist, distOf(pl.position.z))
    } else if (f.phase === 'fly') {
      steer(dt, pl)
      f.segT += dt
      let seg = f.plan.segs[f.seg]
      while (f.segT >= seg.T && f.seg < f.plan.segs.length - 1) {
        const prev = seg
        f.segT -= seg.T
        f.seg++
        seg = f.plan.segs[f.seg]
        pl.position.z = seg.z0 // land exactly where the next segment starts
        if (seg.kind === 'roll' && prev.kind === 'air') {
          // the cart lands back on its wheels
          cart.thump(1)
          snd.cartLand(Math.min(1, prev.vy / 14))
          dust(pl.position.x, pl.position.z, 0.7)
          sparks(pl.position.x, pl.position.z, 10)
          if (shakeOn()) shake(0.12)
          setView('ride')
        } else if (seg.kind === 'air' && seg.thrown) eject(seg, prev)
        else if (seg.kind === 'hop') {
          pl.position.y = surface
          onBounce(seg)
          setView('skip')
        } else if (seg.kind === 'slide') onSlide(seg)
      }
      const t = Math.min(f.segT, seg.T)
      if (seg.kind === 'slide') {
        const s = t / seg.T
        pl.position.z = seg.z0 - seg.L * easeOut(s)
        pl.position.y = surface
        pl.grounded = true
        f.speed = ((2 * seg.L) / seg.T) * (1 - s)
        if (f.segT >= seg.T) {
          f.dist = Math.max(f.dist, distOf(pl.position.z))
          f.phase = 'rest'
          f.t = 0
          f.speed = 0
          trail.stop()
          setView('rest')
          lane.end()
          finishFlight()
        }
      } else if (seg.kind === 'sky') {
        const u = t / seg.T
        f.airS = u
        pl.position.z = segZ(seg, t)
        pl.position.y = segY(seg, t)
        pl.grounded = false
        skyVel(seg, t, vel2)
        f.vh = vel2[0]
        f.vy = vel2[1]
        f.speed = Math.hypot(f.vh, f.vy)
        const rise = seg.apex - seg.y0
        if (!f.apexDone && u >= seg.ta) {
          f.apexDone = true
          if (rise > 2) onApex(seg)
        }
        // falling: the camera swings in behind, the bomb whistle drops toward the road
        if (u > seg.ta + 0.04) setView('dive')
        const left = seg.T - t
        if (!f.whistled && u > seg.ta && left < FLIGHT.sky.whistle && seg.apex - seg.yL > 6) {
          f.whistled = true
          whistleStop = snd.fallWhistle(left)
        }
      } else if (seg.kind === 'roll') {
        pl.position.z = segZ(seg, t)
        pl.position.y = seatY
        pl.grounded = true
        f.speed = seg.v0 + seg.a * t
        // the wheels lock just before the end of the last roll
        const last = f.plan.segs[f.seg + 1]?.thrown
        if (last && !f.braked && seg.T - t < 0.32) brake()
      } else {
        if (seg.kind === 'air') f.airS = t / seg.T
        pl.position.z = seg.z0 - seg.L * (t / seg.T)
        pl.position.y = Math.max(seg.floor ?? surface, seg.y0 + seg.vy * t - 0.5 * seg.g * t * t)
        pl.grounded = false
        f.speed = seg.L / seg.T
      }
      pl.position.x = f.x
      f.dist = Math.max(f.dist, distOf(pl.position.z))
    } else if (f.phase === 'rest') {
      pl.position.y = surface
      pl.grounded = true
      if (f.t >= FLIGHT.restTime) {
        f.phase = 'return'
        f.t = 0
        hud.hideReward()
        laneHud.hideSummary()
        hud.fade(true)
        snd.whooshBack()
      }
    } else if (f.phase === 'return') {
      if (f.t >= 0.32) {
        end()
        return
      }
    }
    if (rawDt > 0 && f) {
      pl.velocity.x = (pl.position.x - prevPos.x) / rawDt
      pl.velocity.y = (pl.position.y - prevPos.y) / rawDt
      pl.velocity.z = (pl.position.z - prevPos.z) / rawDt
    }
  }

  function teleportToZone() {
    resetPlayer({ x: clamp(player.position.x, -20, 20), y: 0.05, z: FLY_ZONE.maxZ - 1 }, Math.PI)
    syncYawToPlayer()
  }
  function end() {
    resetSky()
    f = null
    lane.finish()
    laneHud.hideSummary()
    cart.remove()
    setPlayerOverride(null)
    setView(null)
    hud.counter(false)
    hud.power(0, false)
    hud.region(null)
    hud.setFlying(false)
    hud.clearPops()
    snd.setWind(0)
    snd.setRoll(0)
    if (state.autoFly) {
      teleportToZone()
      autoDelay = 0.6
    } else {
      resetPlayer(SPAWN, Math.PI)
      syncYawToPlayer()
    }
    setTimeout(() => hud.fade(false), 60)
    onDone?.()
  }

  // --- Frame ---------------------------------------------------------------------------------
  function inZone() {
    const p = player.position
    return p.x > FLY_ZONE.minX && p.x < FLY_ZONE.maxX && p.z > FLY_ZONE.minZ && p.z < FLY_ZONE.maxZ && p.y < 1.2
  }
  function update(dt, t) {
    const ev = cart.update(dt)
    if (ev === 'landed') {
      const gp = cart.position
      snd.plant()
      fx.burst(22, { x: gp.x, y: 0.25, z: gp.z, spread: 3.5, speed: 4, up: 0.5, gravity: -9, drag: 2, life: 0.7, size: 0.8, color: ['#fff3c0', '#ffffff'], alpha: 0.6 })
      if (shakeOn()) shake(0.1)
    } else if (ev === 'vanishing') {
      vanishAt.copy(cart.position)
    } else if (ev === 'gone') {
      snd.poof()
      fx.burst(30, { x: vanishAt.x, y: 2.5, z: vanishAt.z, spread: 3, speed: 4, up: 0.8, drag: 2.5, life: 0.8, size: 1.3, sizeEnd: 2, color: ['#ffffff', '#e9f2ff'], alpha: 0.75, additive: false })
      fx.burst(18, { x: vanishAt.x, y: 3, z: vanishAt.z, spread: 3, speed: 6, life: 0.7, size: 0.5, color: ['#ffe46a', '#ffffff'], shape: 'star' })
    }
    const rp = player.renderPosition
    updateDecals(t)
    trail.update(dt, trailPos.set(rp.x, rp.y + 0.9, rp.z), 0.26, t)
    hud.update(dt, rp)
    // lane animals (slowed with the ride during a hit stop)
    const laneDt = f?.phase === 'fly' && slowLeft > 0 ? dt * LANE.slowMo : dt
    slowLeft = Math.max(0, slowLeft - dt)
    lane.update(laneDt, f?.phase === 'fly')
    if (!f) {
      const zone = inZone()
      const canFly = zone && !blocked()
      if (state.autoFly) {
        hud.showFly(false)
        if (!zone && player.position.z > FLY_ZONE.maxZ + 0.5 && autoDelay <= 0 && !blocked()) {
          teleportToZone() // walk-free auto launch: hop straight to the zone
          autoDelay = 0.4
        }
        autoDelay -= dt
        if (autoDelay <= 0 && zone && !blocked()) start()
      } else {
        if (canFly && !hud.flyVisible()) snd.flyReady()
        hud.showFly(canFly)
      }
      return
    }
    const p = player.renderPosition
    // counter, power lines, regions, milestones, personal best
    if (f.phase === 'fly' || f.phase === 'rest') {
      hud.counter(true, f.dist)
      while (f.phase === 'fly' && f.mark < MARKS.length && f.dist >= MARKS[f.mark]) onMarker(f.mark++)
      const r = regionAt(f.dist)
      if (r !== f.region) {
        f.region = r
        hud.region(r > 0 ? RIVER_REGIONS[r] : null)
        if (r > 0 && f.phase === 'fly') {
          snd.gate(r)
          fx.burst(30, { x: p.x, y: p.y + 1, z: p.z - 6, spread: 4, speed: 6, life: 0.9, size: 0.6, color: [RIVER_REGIONS[r].color, '#ffffff'], shape: 'star' })
        }
      }
      const m = Math.floor(f.dist / FLIGHT.milestone)
      if (m > f.milestone && f.phase === 'fly') {
        f.milestone = m
        snd.milestone(m)
      }
      if (!f.bestShown && f.dist > state.bestDistance && f.phase === 'fly') {
        f.bestShown = true
        hud.best()
        snd.best()
      }
    }
    // sound beds: wheels on the asphalt while rolling, rushing air while airborne
    const seg = f.plan?.segs[f.seg]
    const flying = f.phase === 'fly' && !f.held
    const rolling = flying && seg?.kind === 'roll'
    const sky = flying && seg?.kind === 'sky'
    const airborne = flying && (seg?.kind === 'air' || sky)
    const sp = f.speed
    snd.setRoll(rolling ? clamp(sp / 70, 0.12, 1) : 0)
    // the wind roars louder as the cart falls
    const fallK = sky && f.vy < 0 ? clamp(-f.vy / 40, 0, 0.5) : 0
    snd.setWind(airborne ? clamp(sp / 60 + fallK, 0.25, 1) : rolling ? clamp(sp / 140, 0, 0.45) : 0)
    if (rolling && Math.random() < dt * (4 + sp * 0.25)) snd.rattle(clamp(sp / 70, 0.15, 1))
    if (sky && Math.random() < dt * 2.5) snd.rattle(0.35) // the basket shivering in the wind
    // speed streaks, flying past along the direction of travel
    if ((rolling || airborne) && sp > 12 && Math.random() < 0.9) {
      const v = player.velocity
      const vl = Math.hypot(v.x, v.y, v.z) || 1
      const dx = v.x / vl
      const dy = v.y / vl
      const dz = v.z / vl
      const ahead = 12 + sp * 0.12
      fx.burst(2, { x: p.x + dx * ahead + (Math.random() - 0.5) * 16, y: p.y + 1 + dy * ahead + (Math.random() - 0.5) * 9, z: p.z + dz * ahead, dir: [-dx, -dy, -dz], speed: 40 + sp * 0.6, jitter: 0, life: 0.35, size: 0.25, color: '#ffffff', alpha: 0.7 })
    }
    // up in the sky: a puffy contrail behind the cart and a few twinkles off the wire
    if (sky) {
      // (climbing only: on the way down the trail would hang between the camera and the cart)
      if (f.vy > 1 && Math.random() < 0.8 * lite) {
        const v = player.velocity
        const vl = Math.hypot(v.x, v.y, v.z) || 1
        fx.burst(1, { x: p.x + (Math.random() - 0.5) * 0.6, y: p.y + 0.2 - (v.y / vl) * 1.2, z: p.z - (v.z / vl) * 1.2, spread: 0.2, speed: 0.4, up: 0.1, gravity: 0.1, drag: 1.4, life: 0.8, size: 0.8, sizeEnd: 1.8, color: ['#ffffff', '#f1f5ff', '#ffe6f6'], alpha: 0.4, additive: false })
      }
      if (Math.random() < 0.35 * lite) fx.burst(1, { x: p.x + (Math.random() - 0.5) * 1.6, y: p.y + 0.6 + Math.random() * 1.2, z: p.z + 0.8, spread: 0.2, speed: 1.5, life: 0.5, size: 0.45, color: ['#ffffff', '#ff8fe0', '#ffe46a'], shape: 'star' })
      // falling fast: air shearing off the cart's edges
      if (f.vy < -12 && Math.random() < 0.6 * lite) {
        for (const sx of [-0.8, 0.8]) fx.burst(1, { x: p.x + sx, y: p.y + 0.3, z: p.z, dir: [0, 1, 0], speed: -f.vy * 0.6, jitter: 1, life: 0.3, size: 0.2, color: '#ffffff', alpha: 0.6 })
      }
    }
    // wheel dust while rolling fast, skid dust while sliding
    if (rolling && sp > 8 && Math.random() < 0.5) {
      fx.burst(1, { x: p.x + (Math.random() - 0.5) * 1.2, y: surface + 0.15, z: p.z + 1.1, spread: 0.3, speed: 1.2, up: 0.6, gravity: 0.6, drag: 2, life: 0.6, size: 0.6, sizeEnd: 1.4, color: '#e8ecf2', alpha: 0.35, additive: false })
    }
    if (f.braked && rolling && Math.random() < 0.8) sparks(p.x + (Math.random() < 0.5 ? -0.55 : 0.55), p.z, 3)
    if (flying && seg?.kind === 'slide' && Math.random() < 0.4) {
      fx.burst(1, { x: p.x + (Math.random() - 0.5) * 1.2, y: surface + 0.15, z: p.z + 0.8, spread: 0.6, speed: 2, up: 0.6, gravity: 0.5, drag: 2, life: 0.6, size: 0.6, sizeEnd: 1.3, color: ['#e9e4da', '#ffffff'], alpha: 0.35, additive: false })
    }
  }

  // --- Avatar pose (after the animator; main.js has just placed the group) ----------------
  const pivot = new Vector3(0, 0.95, 0)
  const tmp = new Vector3()
  const q = new Quaternion()
  const target = new PoseBuffer()
  const mixed = new PoseBuffer()
  let poseW = 0
  let pitch = 0
  let roll = 0
  let spinYaw = 0
  let lie = 0 // 0..1 how far the body is lowered toward the road (face down)
  function writeBones(kind, time, dt) {
    if (!kind || !animator?.rig) {
      poseW = Math.max(0, poseW - dt * 6)
    } else {
      target.applyDefinition(POSES[kind])
      if (kind === 'fling') {
        // windmilling arms, kicking legs
        const a = Math.sin(time * 16)
        target.add('ArmL1', a * 0.6, 0, Math.cos(time * 13) * 0.3)
        target.add('ArmR1', -a * 0.6, 0, Math.cos(time * 14) * 0.3)
        target.add('LegL1', Math.sin(time * 18) * 0.5)
        target.add('LegR1', -Math.sin(time * 18) * 0.5)
      } else if (kind === 'tumble') {
        target.add('ArmL1', Math.sin(time * 21) * 0.5, 0, Math.sin(time * 17) * 0.3)
        target.add('ArmR1', Math.sin(time * 19 + 1) * 0.5, 0, Math.sin(time * 15) * 0.3)
        target.add('LegL1', Math.sin(time * 23) * 0.4)
        target.add('LegR1', Math.sin(time * 20 + 2) * 0.4)
      } else if (kind === 'sit' && f) {
        // grip, lean into the draw / the speed, a happy kick of the feet while rolling
        const lean = f.phase === 'pull' ? -0.25 * easeInOut(Math.min(1, f.t / FLIGHT.pull)) : f.phase === 'fly' ? Math.min(0.2, f.speed * 0.004) : 0
        target.add('Spine1', lean)
        target.add('Neck1', -lean * 0.6)
        if (f.phase === 'fly') {
          target.add('LegL1', Math.sin(time * 9) * 0.08)
          target.add('LegR1', -Math.sin(time * 9) * 0.08)
          target.add('ArmL1', -0.25)
          target.add('ArmR1', -0.25)
          // up in the sky the arms go up over the head, waving ("wheee")
          const u = f.armsUp
          if (u > 0.01) {
            const wave = Math.sin(time * 11) * 0.3 * u
            target.add('ArmL1', -1.75 * u + wave, 0, 0.35 * u)
            target.add('ArmR1', -1.75 * u - wave, 0, -0.35 * u)
            target.add('ArmL2', -0.4 * u)
            target.add('ArmR2', -0.4 * u)
            target.add('LegL1', Math.sin(time * 13) * 0.18 * u)
            target.add('LegR1', -Math.sin(time * 13) * 0.18 * u)
          }
        }
      } else if (kind === 'lie' && f?.phase === 'rest') {
        // a dazed twitch now and then
        const tw = Math.max(0, Math.sin(f.t * 5.5)) * Math.max(0, 1 - f.t / 1.4)
        target.add('LegL2', tw * 0.4)
        target.add('ArmR1', 0, 0, -tw * 0.2)
      }
      poseW = Math.min(1, poseW + dt * (kind === 'sit' ? 8 : 12))
    }
    if (poseW <= 0 || !animator?.rig) return
    mixed.lerpBetween(animator.output, target, easeInOut(poseW))
    animator.rig.applyPose(mixed)
  }
  let poseTime = 0
  function applyPose(group, dt) {
    poseTime += dt
    group.rotation.order = 'YXZ' // spin about the world vertical, tilt in the body frame (+x = head forward)
    let targetPitch = 0
    let targetRoll = 0
    let targetLie = 0
    let snap = false
    let bones = null
    if (f) {
      const seg = f.plan?.segs[f.seg]
      const ph = f.phase
      if (ph === 'settle' || ph === 'pull' || (ph === 'fly' && f.inCart)) bones = 'sit'
      if (ph === 'pull') targetPitch = -0.12 * easeInOut(Math.min(1, f.t / FLIGHT.pull))
      if (ph === 'fly' && f.held) {
        // caught: flailing
        targetPitch = (f.inCart ? 0.2 : 0.6) + Math.sin(f.t * 9) * 0.35
        targetRoll = Math.sin(f.t * 7.3) * 0.4
        if (!f.inCart) bones = 'tumble'
      } else if (ph === 'fly' && f.inCart && seg?.kind === 'sky') {
        // shot into the sky: the cart's nose follows the arc (up on the climb, tipping
        // over the apex, down into the fall) and banks with the steering
        const ang = Math.atan2(f.vy, Math.max(2, f.vh))
        targetPitch = clamp(-ang * 0.8, -0.95, 0.95)
        targetRoll = -inputState.move.x * 0.35 + Math.sin(poseTime * 1.9) * 0.05
        // arms up from just before the apex, gripping again for the last of the fall
        const fall = seg.ta >= 1 ? 1 : (f.airS - seg.ta) / (1 - seg.ta)
        const want = f.airS > seg.ta * 0.6 && fall < 0.85 ? 1 : 0
        f.armsUp += (want - f.armsUp) * Math.min(1, dt * 5)
      } else if (ph === 'fly' && f.inCart && seg?.kind === 'air') {
        // the cart hops: nose up on the way up, down on the way down; a boost flips it
        const v = seg.vy - seg.g * f.airS * seg.T
        targetPitch = clamp(-v * 0.035, -0.45, 0.45) + TAU * (seg.flips ?? 0) * easeInOut(f.airS)
        if (seg.back) targetPitch += Math.sin(f.airS * Math.PI) * -0.35
        targetRoll = -inputState.move.x * 0.25
        snap = true
      } else if (ph === 'fly' && f.inCart) {
        targetRoll = -inputState.move.x * 0.12 + Math.sin(poseTime * 21) * Math.min(0.03, f.speed * 0.0006)
      } else if (ph === 'fly' && seg?.kind === 'air' && seg.thrown) {
        // thrown: forward somersaults that settle into a belly-flop dive
        const total = TAU * (seg.flips || 1) + 1.35
        targetPitch = total * easeOutCubic(f.airS)
        const done = Math.floor(targetPitch / TAU)
        if (done > f.flipsDone) {
          f.flipsDone = done
          snd.flip()
        }
        targetRoll = -inputState.move.x * 0.4
        f.spin += f.spinRate * dt
        snap = true
        bones = 'fling'
      } else if (ph === 'fly' && seg?.kind === 'air') {
        // a re-planned arc after a hit: from the pose at the hit into a dive / tumble
        targetPitch = lerp(f.pitch0, 1.4 + TAU * Math.max(0, seg.flips ?? 0) - (seg.flips < 0 ? TAU : 0), easeOutCubic(f.airS))
        targetRoll = -inputState.move.x * 0.4
        f.spin += f.spinRate * dt
        snap = true
        bones = 'fling'
      } else if (ph === 'fly' && seg?.kind === 'hop') {
        // one forward roll per bounce, ending face down
        const s = clamp(f.segT / seg.T, 0, 1)
        targetPitch = 1.45 + TAU * easeInOut(s)
        targetRoll = Math.sin(s * Math.PI) * 0.4 * (seg.n % 2 ? 1 : -1)
        f.spinRate *= Math.exp(-1.5 * dt)
        f.spin += f.spinRate * dt
        targetLie = 1 - Math.sin(s * Math.PI) * 0.6
        snap = true
        bones = 'tumble'
      } else if (ph === 'fly' && seg?.kind === 'slide') {
        targetPitch = 1.5
        f.spinRate *= Math.exp(-3 * dt)
        f.spin += f.spinRate * dt
        targetLie = 1
        bones = 'lie'
      } else if (ph === 'rest' || ph === 'return') {
        targetPitch = 1.5
        targetLie = 1
        bones = 'lie'
      }
      spinYaw = f.spin
    } else spinYaw = 0
    if (f && !(f.phase === 'fly' && f.plan?.segs[f.seg]?.kind === 'sky')) f.armsUp = Math.max(0, f.armsUp - dt * 5)
    writeBones(bones, poseTime, dt)
    if (snap) pitch = targetPitch
    else pitch += (targetPitch - pitch) * Math.min(1, dt * 10)
    roll += (targetRoll - roll) * Math.min(1, dt * 8)
    lie += (targetLie - lie) * Math.min(1, dt * (snap ? 30 : 12))
    if (!f && Math.abs(pitch) < 1e-3) pitch = 0
    group.rotation.x = pitch
    group.rotation.z = roll
    group.rotation.y += spinYaw
    // rotate about the waist instead of the feet; lying down lowers the body onto the road
    q.setFromEuler(group.rotation)
    tmp.copy(pivot).applyQuaternion(q)
    group.position.x += pivot.x - tmp.x
    group.position.y += pivot.y - tmp.y - lie * 0.72 * Math.abs(Math.sin(pitch))
    group.position.z += pivot.z - tmp.z
    if (f?.inCart) {
      cart.follow(group, f.phase === 'fly' ? f.speed : 0, dt)
    }
  }

  return {
    update,
    applyPose,
    teleportToZone,
    setAnimator: (a) => (animator = a),
    active: () => !!f,
    // Body tilt for the other players' copy of this launch (net.js `pose`): somersault, bank, spin.
    pose: () => ({ pitch, roll, spin: f ? spinYaw : 0 }),
    debug: () => f, // dev console: __game.game.flight.debug()
    lane, // dev console: __game.game.flight.lane.debug()
  }
}

// Sounds of the cart launch (flight.js), all synthesised on the shared audio core
// (core.js / synth.js). Everything returns quietly before the first gesture or when
// the voice budget is spent.
//  - the LAUNCH button appearing, the starting gate popping up, the cart clattering in
//  - hopping into the wire basket, the bungee creaking as the cart is drawn back
//  - the bungee snap + wheel spin-up, a rolling bed of tyres on asphalt with wire rattle
//  - the shot into the sky (a rocketing whoosh and a rising whistle), the twinkle over
//    the apex, the bomb whistle dropping as the cart falls, the slam back onto the road
//  - power lines: a bright zap-and-bling climbing the scale line after line
//  - the wheels locking (screech), the cart nosing over (crash), a slide-whistle throw
//  - body thuds that climb the scale bounce by bounce, the skid, the loose cart clanging
//  - confetti popper + trophy + coins, region gates, milestones, a new best, the trip back
import { COARSE_POINTER } from '../config.js'
import { A, now, onStart, ready, voice } from './core.js'
import { bubble, burst, crinkle, env, modal, rnd, route, tone, vary } from './synth.js'

const GLOCK = [[1, 1, 1.4], [2.756, 0.32, 0.45], [5.404, 0.1, 0.18], [8.933, 0.04, 0.08]]
const COIN = [[1, 1, 0.5], [1.504, 0.6, 0.36], [2.24, 0.45, 0.26], [2.71, 0.3, 0.18], [3.47, 0.22, 0.12], [4.03, 0.12, 0.08]]
const TROPHY = [[1, 1, 0.7], [2.05, 0.5, 0.5], [3.1, 0.34, 0.32], [4.33, 0.2, 0.2], [5.6, 0.1, 0.12]]
const GLASS = [[1, 1, 0.45], [2.32, 0.5, 0.28], [4.25, 0.28, 0.16], [6.63, 0.14, 0.1]]
const WOOD = [[1, 1, 0.07], [2.57, 0.45, 0.035], [4.2, 0.22, 0.016], [6.1, 0.08, 0.01]]
// thin steel wire / tube: bright, short, a little clangy
const WIRE = [[1, 1, 0.16], [2.76, 0.5, 0.1], [5.4, 0.3, 0.06], [8.93, 0.15, 0.04]]
// the cart's steel frame struck hard: lower, longer, beating
const FRAME = [[1, 1, 0.9], [1.59, 0.7, 0.6], [2.14, 0.5, 0.45], [2.92, 0.35, 0.3], [3.6, 0.2, 0.2], [4.65, 0.12, 0.12]]
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24]
const semi = (n) => Math.pow(2, n / 12)
const C5 = 523.25
const C6 = 1046.5
const lite = COARSE_POINTER ? 0.6 : 1

const lastAt = new Map()
function limit(name, ms) {
  const t = performance.now()
  if (t - (lastAt.get(name) ?? -1e9) < ms) return false
  lastAt.set(name, t)
  return true
}
function buzz(pattern) {
  if (!COARSE_POINTER) return
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // not allowed in this frame
  }
}
function glock(t, notes, gap, gain = 0.12, verb = 0.3) {
  notes.forEach((n, i) => modal({ t: t + i * gap, f: C6 * semi(n), modes: GLOCK, gain: gain * rnd(0.85, 1), strike: 0.1, pan: (i / Math.max(1, notes.length - 1) - 0.5) * 0.5, verb }))
}
// n quick hits of the wire basket over `dur` s (a jingly shopping-cart rattle).
function jangle(t, n, dur, gain = 0.05, f0 = 1700, f1 = 4200) {
  for (let i = 0; i < n; i++) modal({ t: t + Math.pow(Math.random(), 1.4) * dur, f: rnd(f0, f1), modes: WIRE, gain: gain * rnd(0.5, 1), strike: 0.05, decay: rnd(0.6, 1.2), pan: rnd(-0.4, 0.4) })
}

// --- Launch ----------------------------------------------------------------------------------
// The LAUNCH button pops up: a soft rising bubble and two sparkles.
export function flyReady() {
  if (!limit('flyReady', 600) || !voice(0.6, 2)) return
  const t = now()
  bubble({ t, f: 380, d: 0.09, gain: 0.2, rise: 1.4, bus: A.ui })
  glock(t + 0.06, [12, 19], 0.07, 0.06)
}

// LAUNCH pressed: the gate is summoned. A magic swell, glass sparkles and a run up the glockenspiel.
export function summon() {
  if (!voice(1.2, 3)) return
  const t = now()
  burst({ t, noise: 'pink', f: 300, f2: 3200, q: 1.1, a: 0.45, d: 0.12, gain: 0.18 })
  tone({ t, type: 'triangle', f: 196, f2: 392, glide: 0.5, a: 0.35, d: 0.25, gain: 0.05, lp: 2000 })
  for (let i = 0; i < Math.round(8 * lite); i++) modal({ t: t + rnd(0, 0.5), f: rnd(2600, 5600), modes: GLASS, gain: 0.022, decay: 0.5, pan: rnd(-0.6, 0.6) })
  glock(t + 0.1, [0, 4, 7, 12, 16], 0.08, 0.085, 0.35)
}

// The gate posts land: two chunky plastic-brick clacks and a thump.
export function plant() {
  if (!voice(0.8, 3)) return
  const t = now()
  tone({ t, f: 95, f2: 45, d: 0.22, gain: 0.4 })
  burst({ t, noise: 'brown', type: 'lowpass', f: 600, q: 0.6, a: 0.003, d: 0.2, gain: 0.32, verb: 0.12 })
  modal({ t, f: vary(620, 0.05), modes: WOOD, gain: 0.3, strike: 0.25, decay: 1.4, pan: -0.3 })
  modal({ t: t + 0.04, f: vary(560, 0.05), modes: WOOD, gain: 0.26, strike: 0.25, decay: 1.4, pan: 0.3 })
  buzz(30)
}

// The cart drops in on its casters: a hollow thump and the whole basket jangling.
export function cartDrop() {
  if (!voice(0.9, 3)) return
  const t = now()
  tone({ t, f: 130, f2: 70, d: 0.16, gain: 0.3 })
  burst({ t, noise: 'brown', type: 'lowpass', f: 900, q: 0.7, a: 0.002, d: 0.14, gain: 0.25 })
  modal({ t, f: vary(520, 0.04), modes: FRAME, gain: 0.07, beat: 6, strike: 0.15, decay: 0.6 })
  jangle(t, Math.round(12 * lite), 0.35, 0.05)
  // casters bounce
  modal({ t: t + 0.11, f: 300, modes: WOOD, gain: 0.12, strike: 0.1 })
  modal({ t: t + 0.19, f: 340, modes: WOOD, gain: 0.07, strike: 0.08 })
}

// The gate sinks away: a soft cartoon poof and a sparkle.
export function poof() {
  if (!voice(0.7, 2)) return
  const t = now()
  burst({ t, noise: 'pink', f: 900, f2: 300, q: 0.7, a: 0.01, d: 0.3, gain: 0.22 })
  bubble({ t, f: 520, d: 0.08, gain: 0.16, rise: -0.5 })
  modal({ t: t + 0.05, f: C6 * semi(19), modes: GLOCK, gain: 0.05, verb: 0.4 })
}

// Jumping into the cart: a lift of air, then landing in the wire basket (clank, rattle, squeak).
export function hopIn() {
  if (!voice(0.9, 3)) return
  const t = now()
  burst({ t, noise: 'pink', f: 500, f2: 1600, q: 0.8, a: 0.08, d: 0.18, gain: 0.14 })
  const land = t + 0.4
  tone({ t: land, f: 120, f2: 62, d: 0.15, gain: 0.3 })
  burst({ t: land, noise: 'brown', type: 'lowpass', f: 800, q: 0.7, a: 0.003, d: 0.12, gain: 0.26 })
  modal({ t: land, f: vary(440, 0.04), modes: FRAME, gain: 0.06, beat: 6, strike: 0.12, decay: 0.5 })
  jangle(land, Math.round(9 * lite), 0.28, 0.045)
  tone({ t: land + 0.03, type: 'triangle', f: 1300, f2: 900, glide: 0.1, d: 0.12, gain: 0.025, lp: 3000 }) // caster squeak
}

// The cart drawn back for `dur` s: the bungee creaks tighter and the casters tick backwards.
export function stretch(dur = 1) {
  if (!voice(dur + 0.3, 3)) return
  const t = now()
  const n = Math.round(22 * lite)
  for (let i = 0; i < n; i++) {
    const k = Math.pow(i / n, 0.8)
    const at = t + k * dur + rnd(0, 0.02)
    burst({ t: at, f: 600 + 1500 * k + rnd(-150, 150), q: rnd(4, 9), a: 0.001, d: rnd(0.012, 0.03), gain: 0.04 + 0.07 * k, pan: rnd(-0.3, 0.3) })
  }
  tone({ t, type: 'sawtooth', f: 70, f2: 180, glide: dur, a: dur * 0.6, hold: dur * 0.35, d: 0.12, gain: 0.045, lp: 700 })
  tone({ t, f: 140, f2: 340, glide: dur, a: dur * 0.7, hold: dur * 0.25, d: 0.1, gain: 0.028 })
  // caster ratchet, slowing as the draw tightens
  const clicks = Math.round(10 * lite)
  for (let i = 0; i < clicks; i++) modal({ t: t + Math.pow(i / clicks, 1.5) * dur, f: vary(1500, 0.08), modes: WOOD, gain: 0.07, strike: 0.15 })
  jangle(t + dur * 0.2, Math.round(4 * lite), dur * 0.7, 0.025)
}

// Release: the bungee snaps, a deep thump, the wheels spin up, air rips past, the cord wobbles.
export function launch(k = 0.5) {
  if (!voice(2, 5)) return
  const t = now()
  burst({ t, type: 'highpass', f: 2200, q: 0.6, a: 0.0006, d: 0.03, gain: 0.42 })
  tone({ t, type: 'triangle', f: 220, f2: 70, glide: 0.12, d: 0.18, gain: 0.3, lp: 1600 })
  tone({ t, f: 66, f2: 32, d: 0.45, gain: 0.5 })
  burst({ t, noise: 'brown', type: 'lowpass', f: 520, q: 0.6, a: 0.004, d: 0.35, gain: 0.35, verb: 0.2 })
  burst({ t: t + 0.02, noise: 'pink', f: 400, f2: 3600 + 2400 * k, q: 0.7, a: 0.08, d: 0.6 + 0.5 * k, gain: 0.26 })
  // wheels spinning up: a rising whir
  tone({ t, type: 'triangle', f: 180, f2: 700 + 500 * k, glide: 0.5, a: 0.04, d: 0.6, gain: 0.05, lp: 2400 })
  jangle(t, Math.round(14 * lite), 0.4, 0.05)
  // the bungee wobble: a low "wub" whose tremolo slows as it dies
  const ctx = A.ctx
  const o = ctx.createOscillator()
  o.type = 'triangle'
  o.frequency.setValueAtTime(95, t)
  o.frequency.exponentialRampToValueAtTime(60, t + 0.9)
  const trem = ctx.createGain()
  trem.gain.value = 0
  const lfo = ctx.createOscillator()
  lfo.frequency.setValueAtTime(14, t)
  lfo.frequency.exponentialRampToValueAtTime(5, t + 0.9)
  const depth = ctx.createGain()
  depth.gain.value = 0.5
  lfo.connect(depth).connect(trem.gain)
  const g = ctx.createGain()
  env(g.gain, t + 0.05, 0.01, 0.12, 0.9)
  o.connect(trem).connect(g)
  route(g, {})
  for (const n of [o, lfo]) {
    n.start(t)
    n.stop(t + 1.1)
  }
  glock(t + 0.08, [0, 7, 12], 0.05, 0.07)
  buzz([40, 30, 70])
}

// --- Into the sky -----------------------------------------------------------------------------
// The bungee flings the cart skyward: a rocketing whoosh that rises for the climb
// (`climb` s), a slide whistle going up and a cheer of bells (k 0..1 = how big the shot).
export function skyLaunch(k = 0.5, climb = 2) {
  const up = Math.max(0.6, Math.min(4, climb))
  if (!voice(up + 0.5, 4)) return
  const t = now()
  // the shove of air off the gate, then the long rush upward
  burst({ t, noise: 'pink', f: 260, f2: 2400 + 2600 * k, sweep: 0.5, q: 0.8, a: 0.03, d: 0.55, gain: 0.32, verb: 0.15 })
  burst({ t: t + 0.08, noise: 'pink', type: 'bandpass', f: 500, f2: 3200, sweep: up, q: 1.3, a: 0.25, hold: up * 0.4, d: up * 0.6, gain: 0.12 })
  burst({ t, noise: 'brown', type: 'lowpass', f: 380, f2: 140, sweep: up, q: 0.7, a: 0.02, d: Math.min(1.6, up), gain: 0.32 })
  // slide whistle up: the cartoon "fwee-"
  tone({ t: t + 0.05, type: 'sine', f: 420, f2: 1500 + 500 * k, glide: Math.min(1.2, up * 0.6), a: 0.05, hold: Math.min(0.9, up * 0.4), d: 0.35, gain: 0.07 })
  tone({ t: t + 0.05, type: 'triangle', f: 210, f2: 760 + 250 * k, glide: Math.min(1.2, up * 0.6), a: 0.05, hold: Math.min(0.9, up * 0.4), d: 0.35, gain: 0.03, lp: 2000 })
  glock(t + 0.12, [0, 4, 7, 12, 16], 0.045, 0.07, 0.35)
  buzz([60, 40, 90])
}

// Over the top of the arc: a soft glassy twinkle and the air going still for a beat.
export function apex(k = 0.5) {
  if (!limit('apex', 500) || !voice(1.6, 2)) return
  const t = now()
  glock(t, [12, 16, 19, 24], 0.07, 0.06 + 0.03 * k, 0.5)
  for (let i = 0; i < Math.round(6 * lite); i++) modal({ t: t + rnd(0, 0.45), f: rnd(3000, 6200), modes: GLASS, gain: 0.018, decay: 0.6, pan: rnd(-0.6, 0.6), verb: 0.3 })
  burst({ t, noise: 'pink', f: 1800, f2: 600, q: 0.7, a: 0.2, d: 0.6, gain: 0.07 })
}

// Falling back down: the classic bomb whistle, dropping in pitch over `dur` s with a
// little warble. Returns a function that cuts it short (a re-plan, the landing).
export function fallWhistle(dur = 2) {
  const d = Math.max(0.4, Math.min(4, dur))
  if (!voice(d + 0.2, 2)) return () => {}
  const ctx = A.ctx
  const t = now()
  const o = ctx.createOscillator()
  o.type = 'sine'
  o.frequency.setValueAtTime(1750, t)
  o.frequency.exponentialRampToValueAtTime(420, t + d)
  const vib = ctx.createOscillator()
  vib.frequency.value = 7
  const vibDepth = ctx.createGain()
  vibDepth.gain.value = 18
  vib.connect(vibDepth).connect(o.frequency)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.linearRampToValueAtTime(0.06, t + 0.25)
  g.gain.linearRampToValueAtTime(0.09, t + d * 0.9)
  g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.05)
  o.connect(g)
  route(g, { verb: 0.15 })
  for (const n of [o, vib]) {
    n.start(t)
    n.stop(t + d + 0.1)
  }
  let stopped = false
  return () => {
    if (stopped) return
    stopped = true
    try {
      const c = ctx.currentTime
      g.gain.cancelScheduledValues(c)
      g.gain.setTargetAtTime(0.0001, c, 0.03)
      o.stop(c + 0.15)
      vib.stop(c + 0.15)
    } catch {
      // already ended
    }
  }
}

// The cart slams back onto the road from the sky (k 0..1 = how far it fell): a deep
// boom, the steel frame crashing, the basket exploding into rattles, grit raining.
export function skyLand(k = 0.6) {
  if (!voice(2.4, 6)) return
  const t = now()
  const s = Math.max(0.3, Math.min(1, k))
  tone({ t, f: 78, f2: 26, d: 0.6 + 0.4 * s, gain: 0.75 * s })
  tone({ t, type: 'triangle', f: 160, f2: 50, glide: 0.2, d: 0.3, gain: 0.25 * s, lp: 900 })
  burst({ t, noise: 'brown', type: 'lowpass', f: 1200, f2: 180, q: 0.6, a: 0.002, d: 0.6 + 0.5 * s, gain: 0.6 * s, verb: 0.25 })
  burst({ t, type: 'highpass', f: 1800, q: 0.6, a: 0.0006, d: 0.06, gain: 0.3 * s })
  modal({ t, f: vary(300, 0.04), modes: FRAME, gain: 0.2 * s, beat: 7, strike: 0.4, decay: 1.2, verb: 0.25 })
  modal({ t: t + 0.02, f: vary(470, 0.04), modes: FRAME, gain: 0.1 * s, beat: 5, strike: 0.2, decay: 0.8, pan: -0.3 })
  jangle(t, Math.round(24 * lite), 0.6, 0.06)
  crinkle({ t: t + 0.04, n: Math.round(22 * s * lite), dur: 0.6, gain: 0.05 * s, f0: 1800, f1: 6500, width: 0.8 })
  buzz([90, 40, 60])
}

// --- Rolling -----------------------------------------------------------------------------------
// A tyre bed: low road rumble + tyre hiss, pulsing over the road seams; k 0..1 = speed.
const roll = { ok: false, rumble: null, rumbleF: null, hiss: null, hissF: null, seam: null, level: 0 }
onStart((ctx) => {
  const lowSrc = ctx.createBufferSource()
  lowSrc.buffer = A.noise.brown
  lowSrc.loop = true
  const rumbleF = ctx.createBiquadFilter()
  rumbleF.type = 'lowpass'
  rumbleF.frequency.value = 220
  rumbleF.Q.value = 1.2
  const rumble = ctx.createGain()
  rumble.gain.value = 0
  const hiSrc = ctx.createBufferSource()
  hiSrc.buffer = A.noise.pinkStereo ?? A.noise.pink
  hiSrc.loop = true
  const hissF = ctx.createBiquadFilter()
  hissF.type = 'bandpass'
  hissF.frequency.value = 1400
  hissF.Q.value = 0.8
  const hiss = ctx.createGain()
  hiss.gain.value = 0
  // the seams: a square LFO dipping the level, faster with speed
  const seamGain = ctx.createGain()
  seamGain.gain.value = 1
  const seam = ctx.createOscillator()
  seam.type = 'square'
  seam.frequency.value = 3
  const seamDepth = ctx.createGain()
  seamDepth.gain.value = 0.18
  seam.connect(seamDepth).connect(seamGain.gain)
  lowSrc.connect(rumbleF).connect(rumble).connect(seamGain)
  hiSrc.connect(hissF).connect(hiss).connect(seamGain)
  seamGain.connect(A.sfx)
  lowSrc.start()
  hiSrc.start()
  seam.start()
  Object.assign(roll, { ok: true, rumble, rumbleF, hiss, hissF, seam })
})
export function setRoll(k) {
  if (!roll.ok || !ready()) return
  const c = Math.max(0, Math.min(1, k))
  if (c === 0 && roll.level === 0) return
  roll.level = c
  const t = A.ctx.currentTime
  roll.rumble.gain.setTargetAtTime(c * 0.55, t, 0.1)
  roll.rumbleF.frequency.setTargetAtTime(140 + 420 * c, t, 0.15)
  roll.hiss.gain.setTargetAtTime(c * c * 0.16, t, 0.1)
  roll.hissF.frequency.setTargetAtTime(900 + 2200 * c, t, 0.15)
  roll.seam.frequency.setTargetAtTime(2 + 14 * c, t, 0.2)
}
// One random rattle of the basket while rolling (called at a speed-dependent rate).
export function rattle(k = 0.5) {
  if (!limit('rattle', 70) || !voice(0.25, 0.5)) return
  const t = now()
  jangle(t, 1 + Math.round(Math.random() * 2 * k), 0.08, 0.02 + 0.03 * k)
  if (Math.random() < 0.3) modal({ t, f: vary(260, 0.1), modes: WOOD, gain: 0.05 * k, strike: 0.05 }) // a wheel clack
}

// Over a power line: an electric zap and a bright bling that climbs the scale line after line.
export function power(i = 0) {
  if (!limit('power', 60) || !voice(0.9, 3)) return
  const t = now()
  const note = PENTA[i % 8] + (i >= 8 ? 12 : 0)
  burst({ t, type: 'highpass', f: 4200, q: 0.7, a: 0.001, d: 0.05, gain: 0.12 })
  tone({ t, type: 'sawtooth', f: 520, f2: 1600, glide: 0.07, a: 0.002, d: 0.08, gain: 0.035, lp: 4000 })
  modal({ t: t + 0.015, f: C5 * semi(note + 12), modes: GLOCK, gain: 0.13, strike: 0.12, verb: 0.3 })
  modal({ t: t + 0.07, f: C5 * semi(note + 19), modes: GLOCK, gain: 0.08, verb: 0.35 })
  for (let k = 0; k < 3; k++) modal({ t: t + 0.03 + k * 0.035, f: rnd(3200, 4800), modes: COIN, gain: 0.03, decay: 0.4, pan: rnd(-0.4, 0.4) })
  buzz(12)
}

// The wheels lock: a squealing tyre screech and grinding casters.
export function brake() {
  if (!voice(0.8, 3)) return
  const t = now()
  burst({ t, type: 'bandpass', noise: 'white', f: 2600, f2: 1900, q: 9, a: 0.02, d: 0.42, gain: 0.16 })
  tone({ t, type: 'sawtooth', f: 1450, f2: 1180, glide: 0.4, a: 0.02, d: 0.38, gain: 0.025, lp: 3200, lpq: 4 })
  tone({ t, type: 'sawtooth', f: 1462, f2: 1191, glide: 0.4, a: 0.02, d: 0.38, gain: 0.02, lp: 3200, lpq: 4 })
  burst({ t, noise: 'pink', f: 900, f2: 400, q: 0.8, a: 0.02, d: 0.35, gain: 0.12 })
}

// The cart noses over and the rider is launched: a steel crash, the basket jangling,
// a heavy thump and a slide whistle that rises as they fly.
export function eject(k = 0.5) {
  if (!voice(2.2, 5)) return
  const t = now()
  modal({ t, f: vary(330, 0.04), modes: FRAME, gain: 0.16 + 0.08 * k, beat: 7, strike: 0.35, decay: 1, verb: 0.2 })
  modal({ t: t + 0.03, f: vary(510, 0.04), modes: FRAME, gain: 0.08, beat: 5, strike: 0.2, decay: 0.7, pan: 0.3 })
  jangle(t, Math.round(18 * lite), 0.5, 0.06)
  tone({ t, f: 90, f2: 40, d: 0.35, gain: 0.5 })
  burst({ t, noise: 'brown', type: 'lowpass', f: 900, q: 0.6, a: 0.002, d: 0.3, gain: 0.4, verb: 0.15 })
  burst({ t: t + 0.03, noise: 'pink', f: 500, f2: 3800, q: 0.9, a: 0.12, d: 0.5, gain: 0.2 })
  // slide whistle up
  tone({ t: t + 0.06, type: 'sine', f: 520, f2: 1500, glide: 0.55, a: 0.04, hold: 0.3, d: 0.25, gain: 0.07 })
  glock(t + 0.1, [7, 12, 16], 0.05, 0.06)
  buzz([50, 30, 80])
}

// The loose cart bouncing off the asphalt (k 0..1+ = how hard).
export function cartHit(k = 0.5) {
  if (!limit('cartHit', 90) || !voice(1, 2)) return
  const t = now()
  const s = Math.max(0.2, Math.min(1.2, k))
  modal({ t, f: vary(380, 0.12), modes: FRAME, gain: 0.1 * s, beat: 6, strike: 0.25 * s, decay: 0.6 + 0.4 * s, pan: rnd(-0.3, 0.3), verb: 0.15 })
  jangle(t, Math.round(10 * s * lite) + 2, 0.3, 0.05 * s)
  tone({ t, f: 110, f2: 55, d: 0.14, gain: 0.25 * s })
  burst({ t, noise: 'white', type: 'highpass', f: 3000, a: 0.001, d: 0.12 * s, gain: 0.08 * s }) // scrape
}

// The cart lands back on its wheels after a hop.
export function cartLand(k = 0.5) {
  if (!limit('cartLand', 80) || !voice(0.9, 3)) return
  const t = now()
  const s = Math.max(0.3, Math.min(1, k))
  tone({ t, f: 120, f2: 55, d: 0.18, gain: 0.4 * s })
  burst({ t, noise: 'brown', type: 'lowpass', f: 700, q: 0.7, a: 0.002, d: 0.15, gain: 0.3 * s })
  modal({ t, f: vary(460, 0.05), modes: FRAME, gain: 0.08 * s, beat: 6, strike: 0.15, decay: 0.6 })
  jangle(t, Math.round(12 * lite), 0.35, 0.05 * s)
  tone({ t: t + 0.05, type: 'triangle', f: 1250, f2: 850, glide: 0.1, d: 0.12, gain: 0.03, lp: 3000 })
  buzz(25)
}

// The cart is bumped into the air (a lane animal, a helper bounce): a bonk and a whoosh.
export function cartHop(k = 0.5) {
  if (!limit('cartHop', 120) || !voice(0.8, 2)) return
  const t = now()
  modal({ t, f: vary(600, 0.05), modes: FRAME, gain: 0.06, beat: 5, strike: 0.15, decay: 0.4 })
  jangle(t, Math.round(6 * lite), 0.2, 0.04)
  burst({ t: t + 0.02, noise: 'pink', f: 500, f2: 2200 + 1500 * k, q: 0.9, a: 0.06, d: 0.25, gain: 0.14 })
}

// One somersault: a swish past the ears.
export function flip() {
  if (!limit('flip', 250) || !voice(0.4, 1)) return
  const t = now()
  burst({ t, noise: 'pink', f: 700, f2: 2600, q: 1.1, a: 0.1, d: 0.16, gain: 0.12, pan: rnd(-0.4, 0.4) })
}

// --- Airborne --------------------------------------------------------------------------------
// Wind bed: stereo pink noise through a band that opens with speed, plus a low rumble.
const wind = { ok: false, gain: null, band: null, low: null, lowGain: null, flutter: null, level: 0 }
onStart((ctx) => {
  const src = ctx.createBufferSource()
  src.buffer = A.noise.pinkStereo ?? A.noise.pink
  src.loop = true
  const band = ctx.createBiquadFilter()
  band.type = 'bandpass'
  band.frequency.value = 600
  band.Q.value = 0.7
  const gain = ctx.createGain()
  gain.gain.value = 0
  // slow flutter so it breathes instead of hissing flat
  const flutter = ctx.createGain()
  flutter.gain.value = 1
  const lfo = ctx.createOscillator()
  lfo.frequency.value = 0.7
  const lfoDepth = ctx.createGain()
  lfoDepth.gain.value = 0.25
  lfo.connect(lfoDepth).connect(flutter.gain)
  src.connect(band).connect(flutter).connect(gain)
  const lowSrc = ctx.createBufferSource()
  lowSrc.buffer = A.noise.brown
  lowSrc.loop = true
  const low = ctx.createBiquadFilter()
  low.type = 'lowpass'
  low.frequency.value = 160
  const lowGain = ctx.createGain()
  lowGain.gain.value = 0
  lowSrc.connect(low).connect(lowGain)
  gain.connect(A.sfx)
  lowGain.connect(A.sfx)
  src.start()
  lowSrc.start()
  lfo.start()
  Object.assign(wind, { ok: true, gain, band, low, lowGain, flutter })
})
// k 0..1 = how fast (0 = silent); called every frame by flight.js.
export function setWind(k) {
  if (!wind.ok || !ready()) return
  const c = Math.max(0, Math.min(1, k))
  if (c === 0 && wind.level === 0) return
  wind.level = c
  const t = A.ctx.currentTime
  wind.gain.gain.setTargetAtTime(c * 0.3, t, 0.12)
  wind.band.frequency.setTargetAtTime(380 + 2200 * c, t, 0.15)
  wind.lowGain.gain.setTargetAtTime(c * 0.45, t, 0.15)
}

// Through a region gate: whoosh, then a bright three-note chord.
export function gate(index = 1) {
  if (!voice(1.4, 3)) return
  const t = now()
  burst({ t, noise: 'pink', f: 2600, f2: 380, q: 1.1, a: 0.06, d: 0.32, gain: 0.28 })
  tone({ t: t + 0.04, f: 110, f2: 58, d: 0.24, gain: 0.14 })
  const root = PENTA[index % 5]
  glock(t + 0.12, [root, root + 4, root + 7, root + 12], 0.06, 0.12, 0.4)
}

// Every FLIGHT.milestone metres: a soft glass note climbing with the distance.
export function milestone(n = 1) {
  if (!limit('milestone', 120) || !voice(0.8, 1)) return
  const t = now()
  const note = PENTA[Math.min(PENTA.length - 1, n - 1)]
  modal({ t, f: C5 * semi(note), modes: GLOCK, gain: 0.08, strike: 0.08, verb: 0.3 })
}

// Passed the personal best mid-ride.
export function best() {
  if (!limit('best', 2000) || !voice(1.5, 4)) return
  const t = now()
  glock(t, [0, 4, 7, 12, 16, 19, 24], 0.055, 0.12, 0.35)
  burst({ t, noise: 'pink', f: 400, f2: 3000, q: 0.8, a: 0.2, d: 0.3, gain: 0.12 })
  buzz([30, 40, 30])
}

// --- On the asphalt ----------------------------------------------------------------------------
// One body bounce (i = 1, 2, 3...; k 0..1 = how hard): a meaty thump, a cartoon "oof",
// grit scattering, and a plink that climbs the scale bounce after bounce.
export function thud(i = 1, k = 0.6) {
  if (!voice(1, 3)) return
  const t = now()
  const s = Math.max(0.3, Math.min(1, k))
  tone({ t, f: 120, f2: 48, d: 0.2, gain: 0.5 * s })
  burst({ t, noise: 'brown', type: 'lowpass', f: 900, f2: 250, q: 0.7, a: 0.002, d: 0.16 + 0.08 * s, gain: 0.42 * s })
  burst({ t, noise: 'pink', type: 'bandpass', f: 1800, q: 0.9, a: 0.001, d: 0.05, gain: 0.12 * s })
  // "oof": a short voiced formant
  tone({ t: t + 0.01, type: 'sawtooth', f: vary(210, 0.06), f2: 140, glide: 0.12, a: 0.01, d: 0.12, gain: 0.05 * s, lp: 750, lpq: 3 })
  crinkle({ t: t + 0.02, n: Math.round(10 * s * lite), dur: 0.22, gain: 0.04 * s, f0: 2400, f1: 7000 })
  const note = PENTA[Math.min(PENTA.length - 1, i - 1)]
  modal({ t: t + 0.05, f: C5 * semi(note + 12), modes: GLOCK, gain: 0.09, strike: 0.1, verb: 0.3, pan: rnd(-0.2, 0.2) })
  buzz(25 + i * 5)
}

// Skidding face down for `dur` s: a scrape that slows and a sprinkle of grit.
export function skid(dur = 1) {
  if (!voice(dur + 0.2, 2)) return
  const t = now()
  burst({ t, noise: 'pink', type: 'bandpass', f: 2200, f2: 500, sweep: dur, q: 0.7, a: 0.01, d: dur, gain: 0.2 })
  burst({ t, noise: 'brown', type: 'lowpass', f: 500, f2: 120, sweep: dur, q: 0.5, a: 0.02, d: dur * 0.8, gain: 0.24 })
  crinkle({ t, n: Math.round(16 * lite), dur, gain: 0.03, f0: 2000, f1: 6500 })
}

// --- Reward ----------------------------------------------------------------------------------
// Party popper: a crack, a cork pop, paper streamers rustling down and a little fanfare.
export function confetti() {
  if (!voice(2, 4)) return
  const t = now()
  burst({ t, type: 'highpass', f: 2500, q: 0.6, a: 0.0005, d: 0.035, gain: 0.4 })
  bubble({ t, f: 420, d: 0.05, gain: 0.25, rise: 2 })
  tone({ t, f: 180, f2: 70, d: 0.1, gain: 0.25 })
  crinkle({ t: t + 0.05, n: Math.round(40 * lite), dur: 1.2, gain: 0.05, f0: 2500, f1: 9000, width: 0.8 })
  glock(t + 0.12, [0, 4, 7, 12, 16, 19], 0.06, 0.1, 0.4)
}

// The reward: a trophy struck like a bell, coins pouring in.
export function reward(n = 1) {
  if (!voice(2, 4)) return
  const t = now() + 0.15
  modal({ t, f: 1320, modes: TROPHY, gain: 0.15, beat: 7, strike: 0.3, verb: 0.2 })
  const coins = Math.min(14, 4 + Math.round(Math.log10(n + 1) * 3))
  for (let i = 0; i < coins * lite; i++) {
    const at = t + 0.08 + Math.pow(i / coins, 1.3) * 0.55 + rnd(0, 0.02)
    modal({ t: at, f: rnd(2500, 4400), modes: COIN, gain: 0.07 * (1 - (i / coins) * 0.6), beat: 7, strike: 0.25, decay: rnd(0.5, 1), pan: rnd(-0.4, 0.4), verb: 0.08 })
  }
  buzz([30, 40, 50])
}

// The Wins counter ticking up.
export function count() {
  if (!limit('count', 45) || !voice(0.15, 1)) return
  modal({ t: now(), f: vary(3000, 0.04), modes: COIN, gain: 0.03, decay: 0.3 })
}

// Back to the lobby.
export function whooshBack() {
  if (!voice(0.8, 2)) return
  const t = now()
  burst({ t, noise: 'pink', f: 300, f2: 2800, q: 0.8, a: 0.15, d: 0.3, gain: 0.25, bus: A.ui })
  modal({ t: t + 0.3, f: C6 * semi(12), modes: GLOCK, gain: 0.05, verb: 0.4, bus: A.ui })
}

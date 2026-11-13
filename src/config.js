// Every tunable constant lives here; the rest of src/ holds no theme values.

// --- Identity -------------------------------------------------------------
export const GAME_SLUG = 'cart-speed' // slug registered on bloxity.io
export const GAME_TITLE = 'Cart Speed'

// Forces the Bloxity SDK and avatar CDN to be treated as unavailable (see .env.example).
export const DEV_MODE = import.meta.env.VITE_DEV_MODE === 'true'

// --- World (metres: +X east, +Z south, +Y up) -------------------------------
export const GROUND_Y = 0
// The lobby (src/hub/): a lavender-path lego plaza on checker grass ringed by terraced
// cliffs. North (-Z) is the yellow Launch Zone strip and the long road (the lane) beyond it.
export const STUD = 0.75 // m per lego stud
export const CHECKER = 3 // m per green checker square (4 studs)
export const PLAZA = { minX: -51, maxX: 51, minZ: -36, maxZ: 63 } // multiples of STUD and CHECKER
export const FLY_ZONE = { minX: -30, maxX: 30, minZ: -36, maxZ: -27 } // the Launch Zone: walk in here = LAUNCH button
// The lane: a long road from z = PLAZA.minZ north, flush with the plaza (surfaceY).
export const CHANNEL = { halfWidth: 30, surfaceY: 0, length: 3200 }
export const SPAWN = { x: 0, y: 0.3, z: 6 } // on the yellow spawn pad
export const SPAWN_FACING = Math.PI // yaw the character faces on spawn (PI = toward -Z)

// --- Player modes (modes.js) -------------------------------------------------
// 'character' = third-person chase cam with the avatar on screen.
// 'player' = first-person, the camera is the player's eyes and the avatar is hidden.
export const MODES = ['character', 'player']
export const START_MODE = 'character'

// --- Physics (physics.js, player.js) ------------------------------------------
export const PHYSICS = {
  gravity: -22, // m/s^2 for dynamic bodies and the player
  fixedStep: 1 / 60, // s per physics tick; rendering interpolates between ticks
  maxSubSteps: 5, // a long frame never runs more ticks than this
  walkSpeed: 8, // m/s
  sprintSpeed: 14, // m/s with Shift held
  accel: 70, // m/s^2 toward the target velocity on the ground
  airAccel: 22, // m/s^2 steering while airborne
  decel: 60, // m/s^2 when no key is held
  turnSpeed: 12, // rad/s the body turns toward its heading
  jumpSpeed: 8.5, // m/s
  coyoteTime: 0.1, // s after leaving a ledge a jump still counts
  jumpBuffer: 0.12, // s a jump pressed before landing is remembered
  stepHeight: 0.8, // m autostep (one lego terrace step is 0.75)
  maxSlope: 50, // degrees the player can walk up
  snapToGround: 0.4, // m the controller stays glued to downward steps and slopes
  pushMass: 80, // kg the character weighs when shoving crates
  killY: -6, // sank this far: respawn
}
export const PLAYER_DIMS = { radius: 0.75, height: 1.8 } // capsule the character controller moves

// --- Look ------------------------------------------------------------------
export const RENDER = { exposure: 1.0 }
export const FOG = { near: 160, far: 900 }
// The two lighting moods lighting.js blends between (key N toggles).
export const TIME_OF_DAY = {
  transition: 2.5, // s to blend day <-> night
  day: {
    zenith: '#0f8cf5',
    horizon: '#cfeeff',
    sunColor: '#fff6e6',
    // Bright toy-like daylight: saturated lime and grey plastic, soft shadows.
    sunIntensity: 2.6,
    sunElevation: 58, // degrees above the horizon
    sunAzimuth: 25, // degrees, 0 = from +Z
    hemiSky: '#eaf6ff',
    hemiGround: '#9adf7a',
    hemiIntensity: 1.0,
    envIntensity: 0.5,
    lampIntensity: 0,
    stars: 0,
    exposure: 1.0,
  },
  night: {
    zenith: '#050b22',
    horizon: '#24345e',
    sunColor: '#9fb4ff', // the moon
    sunIntensity: 0.55,
    sunElevation: 38,
    sunAzimuth: -60,
    hemiSky: '#3a4c80',
    hemiGround: '#1a1a22',
    hemiIntensity: 0.35,
    envIntensity: 0.25,
    lampIntensity: 30,
    stars: 1,
    exposure: 1.15,
  },
}
export const LIGHT = {
  shadowRange: 40, // half-width of the sun's shadow box around the player
  lampColor: '#ffb35c',
  lampDistance: 22,
}

// Default (fallback) character look, used only when player.glb cannot load.
export const CHARACTER_COLORS = { skin: '#f2c79a', suit: '#2f6fd0', hair: '#4a2f1c' }

export const MATERIAL_PBR = {
  PLAYER: { roughness: 0.7, metalness: 0 },
  GROUND: { roughness: 0.95, metalness: 0 },
}

// --- Graphics presets, picked by the Bloxity graphics_quality setting ----------
export const GRAPHICS_PRESETS = {
  Low: { shadows: false, shadowMap: 512, antialias: false, dpr: 1, bloom: false, particles: 0.35 },
  Medium: { shadows: true, shadowMap: 1024, antialias: false, dpr: 1.25, bloom: false, particles: 0.6 },
  High: { shadows: true, shadowMap: 2048, antialias: true, dpr: 2, bloom: true, particles: 1 },
  Ultra: { shadows: true, shadowMap: 4096, antialias: true, dpr: 2, bloom: true, particles: 1 },
}

// Bloom (postfx.js): only HDR-bright pixels (above threshold, linear, before
// tone mapping) glow: neon rails, waterfall, VIP gate, particles. Sunlit sand
// stays under the threshold.
export const BLOOM = { strength: 0.6, radius: 0.35, threshold: 2.0 }
// Neon materials (propkit.js): k = HDR colour multiplier with bloom on; with
// bloom off they are capped at plainMax so they stay coloured, not white.
export const NEON = { k: 3.5, plainMax: 1.2 }

// Phones and tablets default to a lighter preset when the portal sends no value,
// and any preset is capped there (a phone at DPR 3 renders 9x the pixels; bloom
// is a full-screen multi-pass blur, so it stays off on phones).
export const COARSE_POINTER = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
export const DEFAULT_GRAPHICS = COARSE_POINTER ? 'Medium' : 'High'
export const MOBILE_GRAPHICS_CAP = { dpr: 1.5, shadowMap: 1024, particles: 0.6 }

// The preset to render with on this device.
export function graphicsPreset(name) {
  const p = GRAPHICS_PRESETS[name] ?? GRAPHICS_PRESETS[DEFAULT_GRAPHICS]
  if (!COARSE_POINTER) return p
  const cap = MOBILE_GRAPHICS_CAP
  return { ...p, dpr: Math.min(p.dpr, cap.dpr), shadowMap: Math.min(p.shadowMap, cap.shadowMap), bloom: false, particles: Math.min(p.particles, cap.particles) }
}

// --- Touch controls (touch.js) --------------------------------------------------
export const TOUCH = {
  deadZone: 0.12, // fraction of the joystick radius that does nothing
  lookScale: 1.5, // touch drag pixels -> look, relative to a mouse pixel
  pinchPixelsPerNotch: 30, // finger spread change that equals one wheel notch
}

// --- Camera (camera.js) -------------------------------------------------------
export const CAMERA = {
  fov: 70,
  near: 0.1,
  far: 1200,
  startPitch: 0.14, // radians above the horizon (low chase cam)
  minPitch: -0.35,
  maxPitch: 1.25,
  firstPersonPitch: 1.45, // |pitch| limit looking up/down in player mode
  eyeHeight: 0.92, // eye height as a fraction of player height (player mode)
  distance: 12.4, // resting boom length, m
  minDistance: 2.5, // wheel in past this enters player mode
  maxDistance: 26,
  followLerp: 14, // 1/s: the one smoothing stage, on the point the camera follows
  targetHeight: 1.2, // look-at point as a fraction of player height
  lookSensitivity: 0.0026, // rad per pixel of mouse movement
  zoomStep: 0.9, // m per wheel notch
  zoomEase: 12, // 1/s the zoom glides to its target
  speedFov: 6, // degrees the FOV widens at sprint speed
  speedEase: 3, // 1/s the speed framing eases in and out
  clearEase: 6, // 1/s the boom eases back out once a wall stops blocking it
  // During a launch (flight.js drives the phase): boom length, pitch (+ = looking down),
  // follow rate. aim = sitting in the cart at the gate, ride = rolling down the road,
  // sky = shot up into the sky (high, looking down at the road), dive = the fall back
  // down, air = thrown out (or the cart hopping), skip = tumbling, rest = lying on the road.
  flight: {
    aim: { distance: 7.5, pitch: 0.2, follow: 10 },
    sky: { distance: 9, pitch: 0.4, follow: 16 },
    dive: { distance: 8, pitch: 0.3, follow: 18 },
    ride: { distance: 7.8, pitch: 0.16, follow: 24 },
    air: { distance: 10, pitch: 0.06, follow: 18 },
    skip: { distance: 9, pitch: 0.32, follow: 12 },
    rest: { distance: 7.5, pitch: 0.48, follow: 6 },
    ease: 3,
    fov: 16,
    fovSpeed: 90, // m/s that reads as full speed
  },
}

// --- Bloxity (bloxity.js, avatar/) -------------------------------------------------
// SDK setting keys this game listens for; registering a listener makes the control
// appear in the portal's settings menu.
export const SETTINGS = {
  graphics_quality: { def: DEFAULT_GRAPHICS, type: 'enum', values: ['Low', 'Medium', 'High', 'Ultra'] },
  camera_sensitivity: { def: '1', type: 'number', min: 0.1, max: 5 },
  show_fps: { def: 'false', type: 'bool' },
  fullscreen: { def: 'false', type: 'bool' },
  master_volume: { def: '80', type: 'number', min: 0, max: 100 },
  music_volume: { def: '80', type: 'number', min: 0, max: 100 },
}

// The base rig, measured from player.glb: origin at the feet, 6.4 units tall at bind pose.
export const RIG_HEIGHT = 6.4
// Bind-pose values of the rig nodes the SDK proportions drive.
export const RIG = { armOffsetX: 2, legOffsetX: 0.6, neckOffsetY: 0.6 }
// getProportions() ranges, straight from the SDK spec; clamped before they reach the scene graph.
export const PROPORTIONS = {
  height: { def: 1, min: 0.5, max: 1.6 },
  shoulderWidth: { def: 1, min: 0.5, max: 1.5 },
  armLength: { def: 1, min: 0.05, max: 3 },
  legOffsetX: { def: 1, min: -0.7, max: 5 },
  torsoScaleX: { def: 1, min: 0.3, max: 2 },
  neckHeight: { def: 1, min: 0.94, max: 1.2 },
  headScale: { def: 1, min: 0.3, max: 2.6 },
}

// Procedural animation (avatar/animator.js), ported from Clean Leaves for Loot.
// Rotations are radians in CHARACTER space: +X swings a limb backward, +Y yaws, +Z rolls.
const deg = (d) => (d * Math.PI) / 180
export const ANIM = {
  airborneDelay: 0.07, // s off the ground before the air pose (ignores a step down a ledge)
  // Walk -> run is one cycle at two depths; phase advances with distance travelled.
  locomotion: {
    minFrequency: 0.7,
    maxFrequency: 3.6,
    strideDistance: 3.8, // m per cycle
    idleSpeed: 0.6,
    walkSpeed: 2.5,
    runSpeed: 8,
    sprintSpeed: 13,
    hipSwing: { walk: deg(22), run: deg(42), sprint: deg(56) },
    kneeBend: { walk: deg(30), run: deg(58), sprint: deg(72) },
    armSwing: { walk: deg(18), run: deg(36), sprint: deg(52) },
    elbowBend: { walk: deg(14), run: deg(44), sprint: deg(70) },
    torsoTwist: { walk: deg(4), run: deg(7), sprint: deg(9) },
    torsoLean: { walk: deg(3), run: deg(10), sprint: deg(18) },
    headCounterTwist: { walk: deg(2), run: deg(4), sprint: deg(5) },
    torsoRoll: { walk: deg(2), run: deg(3), sprint: deg(3) },
    bob: { walk: 0.03, run: 0.07, sprint: 0.09 }, // m, on the avatar root
    bankAngle: deg(9),
    bankRate: 8,
  },
  idle: {
    breathFrequency: 0.35,
    breathAmount: deg(1.8),
    breathBob: 0.007,
    basePose: {
      ArmL1: { x: deg(-4), z: deg(8) },
      ArmL2: { x: deg(12) },
      ArmR1: { x: deg(-4), z: deg(-8) },
      ArmR2: { x: deg(12) },
      LegL1: { x: deg(-4) },
      LegR1: { x: deg(4) },
    },
  },
  airborne: {
    rise: {
      LegL1: { x: deg(-38) }, LegR1: { x: deg(8) }, LegL2: { x: deg(62) }, LegR2: { x: deg(40) },
      ArmL1: { x: deg(-40), z: deg(34) }, ArmR1: { x: deg(-30), z: deg(-34) },
      ArmL2: { x: deg(30) }, ArmR2: { x: deg(30) }, Spine1: { x: deg(6) },
    },
    fall: {
      LegL1: { x: deg(-14) }, LegR1: { x: deg(10) }, LegL2: { x: deg(22) }, LegR2: { x: deg(18) },
      ArmL1: { x: deg(-70), z: deg(40) }, ArmR1: { x: deg(-60), z: deg(-40) },
      ArmL2: { x: deg(20) }, ArmR2: { x: deg(20) }, Spine1: { x: deg(-4) },
    },
    velocityReference: 8, // m/s vertical speed that reads as fully rising / falling
  },
  landing: {
    duration: 0.16,
    pose: {
      LegL1: { x: deg(-34) }, LegR1: { x: deg(-34) }, LegL2: { x: deg(58) }, LegR2: { x: deg(58) },
      ArmL1: { x: deg(-18), z: deg(20) }, ArmR1: { x: deg(-18), z: deg(-20) }, Spine1: { x: deg(14) },
    },
    bobY: -0.2,
  },
  transitions: { toLocomotion: 0.14, toAirborne: 0.12, toLanding: 0.06 }, // s to blend a pose change
}

// --- Audio (src/audio/) ---------------------------------------------------------------
// Everything is synthesised at runtime (no sound files). Sound Effects / Music are
// switched in the in-game Settings window (state.settings).
export const AUDIO = {
  volume: 0.8,
  storageKey: 'cart-speed.sound',
  buses: { ui: 0.8, sfx: 0.9, amb: 0.55, engine: 0.5, music: 0.55 }, // per-bus levels before the master
  duck: 0.45, // world (music) level while a window is open
  maxVoices: 48,
  maxVoicesTouch: 24,
  latency: 0.04,
  latencyTouch: 0.07,
  lead: 0.02,
  reverb: { seconds: 1.8, preDelay: 0.012, early: [[19, 0.5], [31, 0.35], [47, 0.28], [73, 0.2], [97, 0.12]], decay: 1.4, tail: 0.18, darken: 1.6, send: 0.9 },
  music: { bpm: 104 },
}

export const FONT_FAMILY = 'Fredoka'

export function clamp(n, min, max) {
  return n < min ? min : n > max ? max : n
}

// Coerce one raw SDK string against its SETTINGS entry.
export function coerceSetting(key, raw) {
  const spec = SETTINGS[key]
  if (!spec) return raw
  const value = raw === '' || raw == null ? spec.def : raw
  if (spec.type === 'bool') return value === 'true' || value === true
  if (spec.type === 'enum') return spec.values.includes(value) ? value : spec.def
  const n = Number(value)
  return clamp(Number.isFinite(n) ? n : Number(spec.def), spec.min, spec.max)
}

// =============================================================================
// GAME DATA. Every price is in Wins (or Race Tokens): nothing is ever sold for
// premium currency (project rule, see CLAUDE.md).
// =============================================================================
export const SAVE_KEY = 'cart-speed-save-v1'

// Game server (../Cart-speed-backend, Colyseus room "world"): progress save + other players.
// `npm run dev` defaults to ws://localhost:2567; `npm run build` uses _MAIN. Leave a URL empty to let
// the Bloxity SDK resolve that channel's endpoint at runtime; with neither the game runs solo (net.js).
const SERVER_URL_DEV = import.meta.env.VITE_SERVER_URL_DEV || (import.meta.env.DEV ? 'ws://localhost:2567' : '')
const SERVER_URL_MAIN = import.meta.env.VITE_SERVER_URL_MAIN || ''
export const SERVER_URL = import.meta.env.MODE === 'production' ? SERVER_URL_MAIN : SERVER_URL_DEV
export const NET = {
  saveDebounce: 3, // s of quiet after a change before saving
  saveMaxWait: 10, // s: a stream of changes (training clicks) still saves this often
  saveEvery: 20, // s: periodic save, so playtime and boost timers persist too
  retry: 8, // s between connection attempts while the server is unreachable
  poseEvery: 0.1, // s between `pose` messages
  snap: 40, // m: a remote that jumps further than this is teleported, not eased
  follow: 12, // 1/s: how fast a remote eases toward its (extrapolated) pose
}

// Slingshots on the west terrace. skill = Skill gained per training click.
// row 0 = lower front row (south -> north), row 1 = upper back row.
export const SLINGSHOTS = [
  // The Cart Shop's carts: they replaced the slingshots (ids kept so old saves carry over). `skill` =
  // Skill per training click; `fly` = +% launch distance while riding it (state.js flyMult);
  // row 0 = the front row, row 1 = the raised back row, each listed north -> south.
  { id: 'twig', name: 'Classic', skill: 1, price: 0, style: 'cart-classic', color: '#c9d2dc', fly: 0, row: 0, tag: 'Starter cart' },
  { id: 'wrap', name: 'Bubblegum', skill: 3, price: 2, style: 'cart-bubblegum', color: '#ff7ad0', fly: 10, row: 0 },
  { id: 'ember', name: 'Lime Racer', skill: 5, price: 10, style: 'cart-racer', color: '#7dff3a', fly: 20, row: 0 },
  { id: 'steel', name: 'Ocean', skill: 12, price: 40, style: 'cart-ocean', color: '#3fb4ff', fly: 30, row: 0 },
  { id: 'royal', name: 'Gold', skill: 30, price: 150, style: 'cart-gold', color: '#ffcf3a', fly: 45, row: 0 },
  { id: 'vine', name: 'Neon', skill: 75, price: 500, style: 'cart-neon', color: '#2af0ff', fly: 60, row: 1 },
  { id: 'frost', name: 'Rocket', skill: 200, price: 1500, style: 'cart-rocket', color: '#d6dde6', fly: 80, row: 1 },
  { id: 'shadow', name: 'Candy', skill: 500, price: 4500, style: 'cart-candy', color: '#ff8ad8', fly: 100, row: 1 },
  { id: 'sun', name: 'Lava', skill: 1250, price: 14000, style: 'cart-lava', color: '#ff5a1f', fly: 125, row: 1 },
  { id: 'blaster', name: 'Galaxy', skill: 3500, price: 40000, style: 'cart-galaxy', color: '#8a5cff', fly: 150, row: 1 },
]

// Power treadmills (the hub's training spots). Standing on an unlocked one makes the avatar run on the
// belt and multiplies training. The east row unlocks with rebirths; the west row is bought with Wins
// and counts in every world (the reference sold those for premium currency).
export const PLATFORMS = [
  { id: 'tm1', mult: 1, rebirths: 0, style: 'white', color: '#3fc8ff', flower: '#4fa8ff' },
  { id: 'tm3', mult: 3, rebirths: 1, style: 'white', color: '#46d84a', flower: '#3fcf5a' },
  { id: 'tm10', mult: 10, rebirths: 2, style: 'white', color: '#ffc21f', flower: '#ffd23a' },
  { id: 'tm25', mult: 25, rebirths: 3, style: 'white', color: '#ff8a1f', flower: '#ffa53a' },
  { id: 'tm60', mult: 60, rebirths: 4, style: 'white', color: '#ff3b4a', flower: '#ff5a6a' },
  { id: 'tm100', mult: 100, price: 250e3, style: 'blossom', color: '#ff5fc8' },
  { id: 'tm250', mult: 250, price: 1.5e6, style: 'royal', color: '#ffcf3a' },
  { id: 'tm1000', mult: 1000, price: 10e6, style: 'rainbow', color: '#c45cff' },
]

// Free offline training: while the player is away they keep training on their best table at
// `rate` clicks/s for at most `cap` s (a gap under `min` s pays nothing).
export const OFFLINE = { rate: 0.3, cap: 8 * 3600, min: 60 }

// Rebirth: needs Skill, resets Skill, multiplier x(rebirths + 1).
export const REBIRTH = { base: 1000, growth: 2.5 }
export const rebirthCost = (rebirths) => Math.round(REBIRTH.base * Math.pow(REBIRTH.growth, rebirths))
// Skip Rebirth (the Rebirth window): rebirth without reaching the level, for Wins.
export const SKIP_REBIRTH = { base: 25000, growth: 5 }
export const skipRebirthPrice = (rebirths) => Math.round(SKIP_REBIRTH.base * Math.pow(SKIP_REBIRTH.growth, rebirths))

// Level from total Skill: level L -> L+1 costs (a + b L) Skill.
export const LEVEL = { a: 4, b: 1.6 }

// The cart launch (flight.js + cart.js). Press LAUNCH in the Launch Zone -> a starting
// gate (two red lego posts and a bungee) and a shopping cart pop up -> the player hops
// in -> the cart is drawn back against the bungee and the bungee SHOOTS it up into the
// sky with the rider inside: a big arc (climb, apex, then a fall that speeds up) over
// the road, crossing the painted power lines (each pays Skill = "power") -> the cart
// slams down onto the asphalt, the rider is thrown out over its nose: a short low arc,
// a few tumbling bounces and a face-down skid -> confetti + reward. The total distance
// D comes from Skill (same curve as before, so the economy is unchanged): all but a
// short tail is flown in the cart.
export const FLIGHT = {
  baseDistance: 14, // m with zero skill
  scale: 15, // distance = base + scale * skill^exponent
  exponent: 0.3,
  maxDistance: 3000,
  metresPerWin: 8,
  steer: 14, // m/s sideways with A/D / joystick
  raceTokensPerFlight: 1,
  // launch
  hopIn: 0.42, // s jumping into the cart
  settle: 0.25, // s sitting down before the pull starts
  pull: 1.0, // s the cart is drawn back against the bungee
  pullBack: 2.4, // m the cart travels back (+Z) at full draw
  // the shot into the sky (in the cart): apex = clamp(base + L * perMetre, height), time =
  // clamp(timeBase + sqrt(L) * timePerSqrtM, time); the apex comes at apexAt of the time
  // (a slower climb, a faster fall); the forward speed eases to endSpeed x the start.
  sky: {
    heightBase: 5,
    heightPerMetre: 0.2,
    height: [5, 120], // m above the road
    timeBase: 1.6,
    timePerSqrtM: 0.5,
    time: [1.8, 26], // s in the air
    apexAt: 0.52,
    endSpeed: 0.6,
    whistle: 2.6, // s before touchdown the falling whistle starts
    marker: 0.5, // share of the fall after which the landing marker shows on the road
  },
  tail: { share: 0.03, min: 7, max: 22 }, // m after the cart lands (toss + tumble + skid): clamp(D * share, ...)
  rollSpeed: [13, 90], // m/s off the gate: shortest -> longest rides (lerp by sqrt(D / maxDistance))
  rollEnd: 0.32, // speed left (x start speed) when the wheels lock
  rollMinTime: 1.1, // s: even a tiny ride lasts this long
  rollMaxTime: 40,
  cartHop: { share: 0.3, min: 1.5, max: 10, maxApex: 1.4 }, // a knock / helper while in the cart: a bump (m) on the sky arc
  // the toss out of the cart
  throwMax: 9, // m the rider flies before the first bounce
  throwPeak: [1.4, 2.8], // m apex: clamp(toss length * throwPeakPerMetre, ...)
  throwPeakPerMetre: 0.3,
  throwGravity: 30, // m/s^2
  flips: [1, 1], // forward somersaults in the toss
  // tumbling on the asphalt (bounce i is hopDecay^i of the first one)
  skips: { base: 1, per: 8, min: 2, max: 4 }, // count = base + log2(1 + L / per), L = the metres left after the cart
  hopDecay: 0.5,
  hopHeightPerMetre: 0.18,
  hopHeight: [0.25, 1.2],
  hopGravity: 42,
  skipSkill: 1, // Skill per bounce = bounce number x this x Skill per click
  slide: [1, 3.5], // m skidded face down after the last bounce: clamp(tail * 0.15, ...)
  slideTime: [0.45, 1.6],
  // power lines painted across the road: crossing one pays markerSkill x Skill per click
  markers: [[25, 200], [50, 1000], [100, 3200]], // [spacing m, up to m]
  markerSkill: 1,
  // after the ride
  restTime: 1.9, // s lying on the road with the reward before going back
  milestone: 100, // m between counter chimes
}
// Distances (m from the zone line) of the power lines painted across the road.
export function powerMarks() {
  const out = []
  let d = 0
  for (const [step, upTo] of FLIGHT.markers) while (d + step <= upTo) out.push((d += step))
  return out
}
// The starting gate + cart (cart.js). summon/linger/vanish in s; ahead = m in front of the player.
export const CART = {
  summon: 0.7,
  linger: 1.4,
  vanish: 0.45,
  ahead: 4,
  gateWidth: 3.6, // m between the two posts
  postHeight: 4.2,
  seatY: 0.32, // the rider's feet (avatar origin) relative to the cart's ground point while sitting
  color: '#ff8fe0', // the wire basket and frame
  colorDark: '#d95fc0',
  handle: '#ffffff',
  wheel: '#24262e',
  gravity: 30, // the loose cart after the throw
  bounce: 0.32,
  friction: 1.6,
}

// --- Lane animals (lane/hazards.js, models in lane/animals*.js, sounds in audio/lane.js) ---
// While flying, animals appear ahead and try to cut the flight short; the player
// dodges by steering (A/D, joystick) and the Air Dash. Easy at first, then the
// encounter rate DOUBLES every `doubleEvery` metres, warnings get shorter and hits
// cost more, while far flights also pay much more (LANE.wins) to keep it worth it.
//   kind  grab    caught for `hold` s, then dropped (Slime-Proof Suit softens it)
//         knock   knocked down / back            carry  dragged back `carry` m
//         trap    stuck until you tap free       freeze no steering for `freeze` s
//         ink     screen splattered              clip   glide clipped (knock)
//         drain   bee swarm area                 sticky snail trail (on the slime)
//         pull    magnet drags you toward it     wall   lane blocked except a gap
//   zone  low = only where the flight passes within `reach` m of the slime; any = anywhere
//   r = hit radius (m), penalty = share of the REMAINING distance lost, weight = spawn odds
export const LANE = {
  // OFF (2026-11-13): no animals, helpers or bosses during a launch, so every flight is a
  // clean sky shot that covers the full Skill distance. With it off flight.js never starts
  // the lane, the DASH button and the Gear button stay hidden. Everything below is kept
  // for turning it back on.
  enabled: false,
  tutorialFlights: 2, // the first flights are animal free
  grace: 40, // m from the zone with no animals
  startDelay: 0.7, // s after release before the first animal
  rate: 0.3, // encounters per second at the zone line ...
  doubleEvery: 650, // ... doubling every this many metres
  maxRate: 3, // per s cap
  tell: [1.6, 0.75], // s of warning: near -> far (lerp over tellAt metres), + Animal Radar
  tellAt: 2600,
  penaltyAt: 1800, // penalty x(1 + d / penaltyAt) ...
  penaltyMax: 0.8, // ... capped
  nearMiss: 3, // m outside the hit radius that still counts as a CLOSE CALL
  minAfter: 10, // m the flight must go past an encounter for it to spawn
  maxAlive: 9,
  aimJitter: 4, // m an animal aims off the player's line
  hitStop: 0.09, // s of slow motion on a hit
  slowMo: 0.18, // time scale during the hit stop
  dash: { dist: 9, time: 0.18 }, // Air Dash
  trap: { taps: 9, timeout: 2.6, perSecond: 0.1 }, // tap-free traps: taps (-Quick Escape), extra penalty per s
  pullRange: 70, // m ahead where a Magnet Mole starts pulling
  helperEvery: [4.5, 8], // s between friendly helpers
  boostFrac: 0.12, // a helper adds this x the planned flight (+ boostMin m)
  boostMin: 12,
  // Wins: distance Wins x(1 + (d / at)^exp): long flights pay far more per metre
  wins: { at: 1000, exp: 1.3 },
  dodgeBonus: 0.03, // +3% Wins per dodge this flight
  nearBonus: 0.06, // +6% per close call
  bonusMax: 1.5, // dodge bonus cap (x2.5)
  beginnerFlights: 10, // the first flights pay x beginnerMult
  beginnerMult: 2,
  streakEvery: 5, // combo fanfare every N dodges in a row
}
export const LANE_ANIMALS = [
  { id: 'frog', name: 'Sticky Frog', at: 0, kind: 'grab', zone: 'low', reach: 16, r: 3, penalty: 0.15, weight: 3, attack: 0.35, hold: 0.7, color: '#7dff5a' },
  { id: 'duck', name: 'Robo-Duck', at: 0, kind: 'knock', zone: 'any', r: 3.4, penalty: 0.18, weight: 3, attack: 0.55, boots: true, color: '#ffd23a' },
  { id: 'dragon', name: 'Slime Dragon', at: 90, kind: 'grab', zone: 'low', reach: 22, r: 4, penalty: 0.25, weight: 2, attack: 0.6, hold: 1, color: '#3fe23a' },
  { id: 'penguin', name: 'Freeze Penguin', at: 200, kind: 'freeze', zone: 'low', reach: 30, r: 3.2, penalty: 0.12, weight: 2, attack: 0.3, freeze: 1.5, color: '#9fe3ff' },
  { id: 'owl', name: 'Dive-Bomb Owl', at: 200, kind: 'knock', zone: 'any', r: 3.6, penalty: 0.22, weight: 2, attack: 0.6, boots: true, color: '#d8a46a' },
  { id: 'goat', name: 'Ram Goat', at: 200, kind: 'knock', zone: 'low', reach: 14, r: 3.4, penalty: 0.2, weight: 2, attack: 0.55, color: '#ffffff' },
  { id: 'bat', name: 'Bat Squad', at: 450, kind: 'knock', zone: 'any', r: 2.2, penalty: 0.07, weight: 2, attack: 0.4, group: 3, gap: 0.32, color: '#b45cff' },
  { id: 'chameleon', name: 'Chameleon', at: 450, kind: 'grab', zone: 'low', reach: 16, r: 3, penalty: 0.2, weight: 1.5, attack: 0.35, hold: 0.7, stealth: true, color: '#22d3a8' },
  { id: 'octopus', name: 'Slime Octopus', at: 750, kind: 'grab', wall: 12, zone: 'any', penalty: 0.28, weight: 1.5, attack: 0.45, hold: 1, color: '#ff6ad5' },
  { id: 'croc', name: 'Snap-Croc', at: 750, kind: 'grab', zone: 'low', reach: 8, r: 3, penalty: 0.2, weight: 1.5, attack: 0.3, hold: 0.7, group: 3, gap: 0.42, color: '#3fbf6a' },
  { id: 'puffer', name: 'Bubble Puffer', at: 750, kind: 'trap', zone: 'any', r: 3.4, penalty: 0.1, weight: 1.5, attack: 0.5, color: '#8fe3ff' },
  { id: 'squid', name: 'Ink Squid', at: 750, kind: 'ink', zone: 'any', r: 3.4, penalty: 0.08, weight: 1.5, attack: 0.45, ink: 2.4, color: '#5a4a8a' },
  { id: 'crab', name: 'Claw Crab', at: 750, kind: 'clip', zone: 'low', reach: 12, r: 3.2, penalty: 0.22, weight: 1.5, attack: 0.35, color: '#ff4a3a' },
  { id: 'hippo', name: 'Belly-Flop Hippo', at: 1150, kind: 'knock', wall: 12, zone: 'low', reach: 20, penalty: 0.22, weight: 1.5, attack: 0.5, color: '#b08cff' },
  { id: 'turtle', name: 'Spinning Turtle', at: 1150, kind: 'knock', zone: 'low', reach: 5, r: 3, penalty: 0.18, weight: 1.5, attack: 0.7, color: '#5dbb3a' },
  { id: 'mole', name: 'Magnet Mole', at: 1150, kind: 'pull', zone: 'low', reach: 30, r: 3.6, penalty: 0.25, weight: 1.5, attack: 0.35, pull: 10, color: '#ff4a4a' },
  { id: 'bees', name: 'Bee Swarm', at: 1150, kind: 'drain', zone: 'any', r: 7, length: 40, penalty: 0.5, weight: 1.5, attack: 0.4, color: '#ffe03a' },
  { id: 'spider', name: 'Web Spider', at: 1650, kind: 'trap', wall: 11, zone: 'any', penalty: 0.12, weight: 1.5, attack: 0.35, color: '#e8e8ff' },
  { id: 'snail', name: 'Mega Snail', at: 1650, kind: 'sticky', zone: 'low', reach: 3, r: 4, length: 60, penalty: 0.3, weight: 1.2, attack: 0.5, color: '#ff8fd0' },
  { id: 'gorilla', name: 'Clap Gorilla', at: 1650, kind: 'knock', wall: 10, zone: 'any', penalty: 0.32, weight: 1.2, attack: 0.45, color: '#5a5a6a' },
  { id: 'pelican', name: 'Pelican Scooper', at: 2250, kind: 'carry', zone: 'any', r: 3.6, penalty: 0.1, weight: 2, attack: 0.55, hold: 1.2, carry: 60, color: '#ff9a3a' },
]
// Boss shots and their attack stats (spawned by LANE_BOSSES, never at random).
export const LANE_SHOTS = {
  slimeball: { id: 'slimeball', name: 'Slime Ball', kind: 'knock', zone: 'any', r: 3.4, penalty: 0.16, attack: 0.5, color: '#3fe23a' },
  missile: { id: 'missile', name: 'Missile', kind: 'knock', zone: 'any', r: 3.6, penalty: 0.18, attack: 0.4, color: '#ff6a3a' },
  tailslam: { id: 'tailslam', name: 'Tail Slam', kind: 'knock', wall: 12, zone: 'any', penalty: 0.22, attack: 0.5, color: '#5a8cff' },
  geyser: { id: 'geyser', name: 'Geyser', helper: true, zone: 'any', r: 4, attack: 0.5, apex: 16, color: '#7ff6ff' },
}
// Friendly helpers: fly through them for a boost (+boostFrac of the flight).
export const LANE_HELPERS = [
  { id: 'mushroom', name: 'Bouncy Mushroom', zone: 'low', reach: 4, r: 3.6, apex: 14, attack: 0.5, color: '#ff4a4a' },
  { id: 'seagull', name: 'Friendly Seagull', zone: 'any', r: 3.4, apex: 6, attack: 0.5, color: '#ffffff' },
  { id: 'fan', name: 'Wind Fan', zone: 'any', r: 3.8, apex: 8, attack: 0.5, color: '#7ff6ff' },
]
// Bosses chase you once you pass `at` m (if the flight goes at least `after` m further).
// Survive all `shots` for the bonus: x`bonus` the distance Wins of `at` (x3 the first time).
export const LANE_BOSSES = [
  { id: 'kingDragon', name: 'King Slime Dragon', at: 1000, after: 150, shots: 6, every: 0.95, windup: 0.45, intro: 1.4, shot: ['slimeball'], bonus: 1, color: '#3fe23a' },
  { id: 'mechaDuck', name: 'Mecha-Duck Mk II', at: 2000, after: 150, shots: 8, every: 0.8, windup: 0.4, intro: 1.4, shot: ['missile'], bonus: 1.5, color: '#5fe0ff' },
  { id: 'skyWhale', name: 'Sky Whale', at: 2800, after: 120, shots: 6, every: 1, windup: 0.5, intro: 1.6, shot: ['tailslam', 'geyser'], bonus: 2, color: '#6a5cff' },
]
// Flight Gear (the Gear window): levels bought with Wins. per = effect per level.
export const GEAR = [
  { id: 'dash', name: 'Air Dash', icon: 'dash', desc: 'Unlocks the DASH button (Space): a quick sideways burst. Levels cut the cooldown.', prices: [250, 6000, 90000, 1.5e6], cooldown: [3.2, 2.4, 1.8, 1.3] },
  { id: 'shield', name: 'Shield Bubble', icon: 'shield', desc: 'A bubble that blocks one hit. +1 bubble per flight per level.', prices: [1200, 35000, 500000] },
  { id: 'suit', name: 'Slime-Proof Suit', icon: 'suit', desc: 'Grabs, traps and drags hold you shorter and cost less.', per: 0.12, prices: [600, 8000, 70000, 500000, 4e6] },
  { id: 'wings', name: 'Glide Wings', icon: 'wings', desc: 'Lose less distance from every hit.', per: 0.08, prices: [900, 12000, 120000, 900000, 7e6] },
  { id: 'boots', name: 'Anti-Magnet Boots', icon: 'boots', desc: 'Weaker Magnet Mole pull, owl dives and Robo-Duck kicks.', per: 0.2, prices: [2000, 25000, 250000, 2.5e6] },
  { id: 'escape', name: 'Quick Escape', icon: 'escape', desc: 'Fewer taps to break out of bubbles and webs.', per: 1.5, prices: [700, 9000, 100000, 1e6] },
  { id: 'radar', name: 'Animal Radar', icon: 'radar', desc: 'Warnings show up earlier.', per: 0.14, prices: [1500, 20000, 200000, 2e6] },
]

// Regions along the lane (distance from the zone, m): the roadside is built as towns that
// grow with distance (roadside.js): villages with farms and fields, then rural towns, urban
// towns and finally big cities (no woods). Each region gets a gate with its name over the
// road (river.js), and its name shows above the flight counter once passed.
// town = village | rural | urban | city; ground = checker colours beside the road;
// walls / roofs / trims = colour pools for the buildings; gate = [pillars, trim].
export const RIVER_REGIONS = [
  { at: 0, name: 'Meadow Village', color: '#7dff7d', icon: 'house', town: 'village', ground: ['#63e22f', '#50d22b'], gate: ['#9a6431', '#ffd23a'], walls: ['#fff4dc', '#ffe0a8', '#f4c48a', '#ffffff', '#ffd6c2'], roofs: ['#d9472b', '#b83a2a', '#6b4a3a', '#3f6fd1'], trims: ['#ffffff', '#6b3f1d'] },
  { at: 200, name: 'Hillside Village', color: '#b6ff5a', icon: 'house', town: 'village', ground: ['#7ad84a', '#68c93a'], gate: ['#7a4a22', '#ff7a3a'], walls: ['#f7f0e0', '#e8d2b0', '#ffe8b8', '#d8e8ff', '#ffffff'], roofs: ['#2f6b3a', '#c94a2a', '#5a4a8a', '#8a3a2a'], trims: ['#ffffff', '#5a3a22'] },
  { at: 450, name: 'Rural Town', color: '#ffd23a', icon: 'church', town: 'rural', ground: ['#8fd84a', '#7cc93a'], gate: ['#c94a2a', '#ffffff'], walls: ['#fff1d6', '#f2d9b0', '#d6ecff', '#ffe0e0', '#e8f7d8', '#ffffff'], roofs: ['#4a4f5a', '#a83a2a', '#2f5a8a', '#6b4a3a'], trims: ['#ffffff', '#2f3a4a'] },
  { at: 750, name: 'Market Town', color: '#ff9a3a', icon: 'church', town: 'rural', ground: ['#a8d870', '#96c95e'], gate: ['#2f5a8a', '#ffd23a'], walls: ['#ffe6c8', '#f0c8a0', '#c8e0f0', '#ffd8a8', '#e8e0ff', '#fff8e8'], roofs: ['#8a3a2a', '#3a4a5a', '#c96a2a', '#2f6b5a'], trims: ['#ffffff', '#3a2a22'] },
  { at: 1150, name: 'Urban Town', color: '#3fb4ff', icon: 'building', town: 'urban', ground: ['#c9ccd6', '#b9bcc8'], gate: ['#3a4a6a', '#3fb4ff'], walls: ['#c96a4a', '#e8d8c0', '#9aa8b8', '#d8a878', '#f0f0f0', '#8a5a4a', '#b8c8d8'], roofs: ['#4a4f5a', '#6a6f7a', '#3a3f4a'], trims: ['#ffffff', '#2a2f3a'] },
  { at: 1650, name: 'Uptown', color: '#ff6ad8', icon: 'building', town: 'urban', ground: ['#d6d0dc', '#c6c0cc'], gate: ['#5a3a6a', '#ff6ad8'], walls: ['#e8c8d8', '#d8d8e8', '#f2e2c8', '#a8b8c8', '#c8a888', '#ffffff', '#7a6a8a'], roofs: ['#4a4a5a', '#5a5f6a', '#2f3440'], trims: ['#ffffff', '#2a2a3a'] },
  { at: 2250, name: 'The City', color: '#5ae8ff', icon: 'city', town: 'city', ground: ['#b8bcc8', '#a8acb8'], gate: ['#2a3a5a', '#5ae8ff'], walls: ['#d8dde6', '#9aa8bc', '#c8b8a0', '#e8e8f0', '#7a8aa0', '#b0c0d8'], roofs: ['#3a3f4a', '#4a4f5a', '#2a2f3a'], trims: ['#e8eef8', '#2a2f3a'] },
  { at: 2800, name: 'Neon City', color: '#c98cff', icon: 'city', town: 'city', neon: ['#ff4ad8', '#3fe8ff', '#ffe23a', '#7a5cff'], ground: ['#8a8ea0', '#7a7e90'], gate: ['#1a1a3a', '#c98cff'], walls: ['#3a3f5a', '#5a5f7a', '#2a2f4a', '#6a6a8a', '#4a3a6a'], roofs: ['#1f2236', '#2a2d44'], trims: ['#c98cff', '#1a1a2a'] },
]


// The towns beside the lane (roadside.js). u = distance from the road axis (m). Each town kind
// has rows of lots (row.kind = the lot builder, row.u = its front line), an optional back street
// at u = back, and on phones only the first liteRows rows are built.
export const ROADSIDE = {
  chunk: 200, // m of lane merged into one set of meshes
  walk: 35, // the sidewalk runs from the road edge to here
  far: 260, // the ground runs out to here
  hubGap: 50, // m with no buildings right after the hub (its cliffs reach over the road banks)
  street: 9, // cross street width
  streetEvery: { village: 0, rural: 96, urban: 66, city: 78 },
  lampEvery: 24,
  depth: {
    village: { liteRows: 2, rows: [{ kind: 'cottage', u: 39 }, { kind: 'fields', u: 66, to: 250, ignoreStreets: true }] },
    rural: { back: 60, liteRows: 3, rows: [{ kind: 'townHouse', u: 39, shops: 0.3 }, { kind: 'backHouse', u: 69 }, { kind: 'fields', u: 96, to: 250 }] },
    urban: { back: 60, liteRows: 2, rows: [{ kind: 'block', u: 39, floors: [3, 6] }, { kind: 'block', u: 69, floors: [5, 9] }, { kind: 'block', u: 90, floors: [7, 12] }] },
    city: { back: 64, liteRows: 3, rows: [
      { kind: 'tower', u: 38, d: [18, 20, 24], w: [18, 24, 30], h: [22, 60], podium: true },
      { kind: 'tower', u: 74, d: [24], w: [24, 30], h: [35, 100] },
      { kind: 'tower', u: 104, d: [30], w: [24, 30, 36], h: [60, 150] },
      { kind: 'tower', u: 140, d: [30], w: [30, 36], h: [40, 120], fill: 0.6 },
    ] },
  },
  // legoMat `windows` for the building walls (houses / flats, glass towers, Neon City towers)
  windows: {
    house: { cell: [3, 3], box: [0.28, 0.72, 0.3, 0.78], glass: '#6aaee0', lit: '#ffe39a', litRate: 0.12, glow: 0.3 },
    tower: { cell: [2, 3.2], box: [0.14, 0.86, 0.2, 0.82], glass: '#3f78b0', lit: '#d8f0ff', litRate: 0.16, glow: 0.3, parapet: 0.2 },
    night: { cell: [2, 3.2], box: [0.14, 0.86, 0.2, 0.82], glass: '#232c55', lit: '#ffd0f4', litRate: 0.32, glow: 0.6, parapet: 0.2 },
  },
  colors: {
    sidewalk: '#d9dce4', curb: '#f4f4f6', paving: '#c4c0cc', asphalt: '#4a5060', line: '#f2f2f2', pole: '#3a3f4a', lamp: '#fff4c8',
    brick: '#a84a3a', path: '#e8dcc0', hedge: '#3cae2a', soil: '#8a5a32', hay: '#e8c860', silo: '#c8ccd4', steel: '#9aa3b0', tank: '#8a6a4a',
    barn: '#c8352a', barnRoof: '#4a4f5a', barnDoor: '#7a3a22', mill: '#fff1d6', gold: '#ffcf3a', churchRoof: '#3a4a6a', window: '#9fdcff', gasRed: '#e8322a',
    doors: ['#7a3a22', '#2f5a8a', '#c9352a', '#2f6b3a', '#5a3a6a'],
    flowers: ['#ff5f8a', '#ffd23a', '#ffffff', '#c86aff', '#ff7a2a'],
    // crop rows: [main, odd, height]
    crops: [['#ffd84a', '#f2c230', 0.7], ['#4fc23a', '#3a9a2a', 0.5], ['#3aa82a', '#2a8a22', 1.4], ['#ff9a2a', '#4fc23a', 0.6], ['#b06ae8', '#4fc23a', 0.5]],
    awnings: [['#e83a3a', '#ffffff'], ['#3a8ae8', '#ffffff'], ['#3ac46a', '#ffffff'], ['#ffb21f', '#ffffff'], ['#c86aff', '#ffffff']],
    signs: ['#ff4a6a', '#3fd0ff', '#ffd23a', '#7aff6a', '#ff8a2a', '#ffffff'],
    cars: ['#e8322a', '#2f6ad8', '#ffd23a', '#f2f2f2', '#2a2f3a', '#3ac46a', '#ff8a2a'],
  },
}


// Eggs: price in Wins (or race tokens). chance in %, boost = + skill multiplier.
// The last pet of each egg is its Secret: a tiny chance, shown as a black silhouette
// on the egg panel until it has been hatched once (eggs.js).
export const EGGS = [
  { id: 'common', name: 'Common Egg', price: 50, x: 11, z: 33.5, look: 'common', pets: [
    { id: 'pup', name: 'Puddle Pup', rarity: 'Common', chance: 44.9979, boost: 0.1, look: { kind: 'dog', body: '#c98a4b', accent: '#f2dcc0' } },
    { id: 'kitty', name: 'Tabby Kit', rarity: 'Common', chance: 30, boost: 0.15, look: { kind: 'cat', body: '#f0a640', accent: '#fff1d6' } },
    { id: 'bunny', name: 'Hop Bunny', rarity: 'Uncommon', chance: 18, boost: 0.25, look: { kind: 'bunny', body: '#f4f4f4', accent: '#ffb6c8' } },
    { id: 'fox', name: 'Ember Fox', rarity: 'Rare', chance: 7, boost: 0.4, look: { kind: 'fox', body: '#ff6a1f', accent: '#ffffff' } },
    { id: 'sunhound', name: 'Sunbeam Hound', rarity: 'Secret', chance: 0.0021, boost: 25, look: { kind: 'dog', body: '#fff3b0', accent: '#ffd23a', glow: '#ffe066', wings: true } },
  ] },
  { id: 'uncommon', name: 'Uncommon Egg', price: 500, x: 5.5, z: 37, look: 'uncommon', pets: [
    { id: 'penguin', name: 'Puffin Pal', rarity: 'Common', chance: 39.9985, boost: 0.5, look: { kind: 'penguin', body: '#24324a', accent: '#ffffff' } },
    { id: 'owl', name: 'Frost Owl', rarity: 'Uncommon', chance: 30, boost: 0.8, look: { kind: 'owl', body: '#b8dcff', accent: '#ffffff', wings: true } },
    { id: 'polar', name: 'Polar Cub', rarity: 'Rare', chance: 20, boost: 1.2, look: { kind: 'bear', body: '#f2f8ff', accent: '#9cc8ff' } },
    { id: 'yeti', name: 'Tiny Yeti', rarity: 'Epic', chance: 10, boost: 2, look: { kind: 'bear', body: '#d9f0ff', accent: '#4aa3ff', horn: true } },
    { id: 'glacier', name: 'Glacier Wyrm', rarity: 'Secret', chance: 0.0015, boost: 60, look: { kind: 'dragon', body: '#e6f8ff', accent: '#5fd0ff', wings: true, glow: '#9fe8ff', spiky: true } },
  ] },
  { id: 'rare', name: 'Rare Egg', price: 4000, x: -5.5, z: 37, look: 'rare', pets: [
    { id: 'turtle', name: 'Moss Turtle', rarity: 'Uncommon', chance: 39.999, boost: 2.5, look: { kind: 'turtle', body: '#5dbb3a', accent: '#8a5a2b' } },
    { id: 'frog', name: 'Bloom Frog', rarity: 'Rare', chance: 30, boost: 3.5, look: { kind: 'frog', body: '#3fd46a', accent: '#ff7ab8' } },
    { id: 'parrot', name: 'Jungle Parrot', rarity: 'Epic', chance: 20, boost: 5, look: { kind: 'bird', body: '#ff3b3b', accent: '#2f8cff', wings: true } },
    { id: 'chameleon', name: 'Prism Chameleon', rarity: 'Legendary', chance: 10, boost: 8, look: { kind: 'lizard', body: '#22d3a8', accent: '#ffd23a' } },
    { id: 'jadewyrm', name: 'Jade Leviathan', rarity: 'Secret', chance: 0.001, boost: 150, look: { kind: 'lizard', body: '#1fbf6a', accent: '#ffe46a', glow: '#5fffa0', spiky: true } },
  ] },
  { id: 'rainbow', name: 'Rainbow Egg', price: 25000, x: -11, z: 33.5, look: 'rainbow', pets: [
    { id: 'unicorn', name: 'Candy Unicorn', rarity: 'Rare', chance: 44.9992, boost: 12, look: { kind: 'horse', body: '#ffffff', accent: '#ff8fd8', horn: true } },
    { id: 'rcat', name: 'Spectrum Cat', rarity: 'Epic', chance: 30, boost: 18, look: { kind: 'cat', body: '#b07bff', accent: '#6ff0ff', glow: '#ff9cf5' } },
    { id: 'pdragon', name: 'Prism Drake', rarity: 'Legendary', chance: 20, boost: 30, look: { kind: 'dragon', body: '#5ad8ff', accent: '#ff6bd5', wings: true, glow: '#88ffff' } },
    { id: 'phoenix', name: 'Aurora Phoenix', rarity: 'Mythic', chance: 5, boost: 50, look: { kind: 'bird', body: '#ff9a1f', accent: '#ffe14a', wings: true, glow: '#ffb347' } },
    { id: 'starmane', name: 'Starmane Pegasus', rarity: 'Secret', chance: 0.0008, boost: 400, look: { kind: 'horse', body: '#fdf6ff', accent: '#b45cff', horn: true, wings: true, glow: '#e6a8ff' } },
  ] },
  { id: 'exclusive', name: 'Exclusive Egg', price: 250000, x: 0, z: 39.5, look: 'exclusive', pets: [
    { id: 'gryphon', name: 'Ruby Gryphon', rarity: 'Legendary', chance: 49.9995, boost: 80, look: { kind: 'bird', body: '#e8303a', accent: '#ffd23a', wings: true, glow: '#ff5050' } },
    { id: 'sdragon', name: 'Sapphire Wyrm', rarity: 'Mythic', chance: 35, boost: 120, look: { kind: 'dragon', body: '#2a6bff', accent: '#9ff3ff', wings: true, glow: '#44aaff' } },
    { id: 'lion', name: 'Crown Lion', rarity: 'Mythic', chance: 15, boost: 200, look: { kind: 'cat', body: '#ffc93a', accent: '#ff7a1a', mane: true, glow: '#ffd700' } },
    { id: 'voidking', name: 'Void Monarch', rarity: 'Secret', chance: 0.0005, boost: 1500, look: { kind: 'dragon', body: '#2a1450', accent: '#c98cff', wings: true, glow: '#9a5cff', spiky: true } },
  ] },
  { id: 'race', name: 'Race Egg', price: 10, currency: 'tokens', x: 13, z: -19, look: 'race', pets: [
    { id: 'snail', name: 'Turbo Snail', rarity: 'Rare', chance: 49.998, boost: 3, look: { kind: 'snail', body: '#ffcf5a', accent: '#a05ad8' } },
    { id: 'rabbit', name: 'Rocket Rabbit', rarity: 'Epic', chance: 35, boost: 6, look: { kind: 'bunny', body: '#d8c2ff', accent: '#7a3cff' } },
    { id: 'cheetah', name: 'Nitro Cheetah', rarity: 'Legendary', chance: 15, boost: 12, look: { kind: 'cat', body: '#ffd34a', accent: '#3a2a12', glow: '#ffef7a' } },
    { id: 'boltHare', name: 'Lightning Hare', rarity: 'Secret', chance: 0.002, boost: 60, look: { kind: 'bunny', body: '#fff7a8', accent: '#3fa2ff', glow: '#ffef3a', wings: true } },
  ] },
]
// Single pets sold on stands (the stock line is flavour text).
export const STAND_PETS = [
  { id: 'captain', name: 'Captain Quackers', rarity: 'Mythic', boost: 300, price: 750000, stock: 1000, better: '200%', x: -13.5, z: -7.5, look: { kind: 'duck', body: '#ffd83a', accent: '#ff8a1a', hat: true } },
  { id: 'seraph', name: 'Radiant Seraph', rarity: 'Secret', boost: 1200, price: 5000000, stock: 10000, better: '1200%', x: -10.5, z: 1.5, look: { kind: 'dragon', body: '#fff6dc', accent: '#ffd23a', wings: true, glow: '#ffe066', spiky: true } },
]
export const RARITY_COLORS = { Common: '#c9d3df', Uncommon: '#5ee35e', Rare: '#3fa2ff', Epic: '#b45cff', Legendary: '#ffb21f', Mythic: '#ff4f8b', Secret: '#ffffff' }
export const PET_SLOTS = 3 // equipped at once (+1 with the Extra Slot pass)
// Egg panel (eggs.js): E = Open 1, R = Open Max, T = Auto. Open Max hatches `hatchMax`
// eggs at once: 1 until one of the upgrades below is bought (the +3 / +8 / +16 bubbles
// beside the panel; premium items in the reference, here they cost Wins).
export const EGG_HATCH = {
  range: 4.2, // m from the egg's centre where its panel opens
  upgrades: [
    // Priced against the egg ladder (Rainbow 25k, Exclusive 250k): +3 ~ 2.5 Rainbow eggs,
    // +16 ~ 6 Exclusive eggs. They were 9k / 45k / 150k, less than one Exclusive egg.
    { n: 3, price: 60000, color: '#ffd23a' },
    { n: 8, price: 400000, color: '#3fa2ff' },
    { n: 16, price: 1500000, color: '#ff6ad5' },
  ],
  anim: 2.4, // s of the hatch animation (wobble, crack, reveal)
  autoAnim: 1.5, // s per batch while Auto is on
  autoGap: 0.25, // s between auto batches
}

// Trails behind the player while flying (the Trails window, a list of cart-shop themed trails).
// mult = Wins multiplier while equipped; emblem = the item drawn on the card art (icons.js trailCardURL);
// card = the card gradient; colors = the flight ribbon. `premium` ones were premium-currency items in the
// reference: here they cost Wins like everything else, priced a bit above the trail of the same boost.
// `daily` = only from that Daily Reward day (not for sale).
export const TRAILS = [
  { id: 'receipt', name: 'Receipt Trail', mult: 1.2, price: 10e3, emblem: 'receipt', card: ['#e9e6df', '#b7b2a8'], colors: ['#ffffff', '#ece8e0', '#b7b2a8'] },
  { id: 'bubblewrap', name: 'Bubble Wrap Trail', mult: 1.3, price: 200e3, emblem: 'bubble', card: ['#a8dcff', '#4f9ae0'], colors: ['#ffffff', '#cfeeff', '#7cc4ff'] },
  { id: 'banana', name: 'Banana Peel Trail', mult: 1.4, price: 3e6, emblem: 'banana', card: ['#f4d65a', '#c8a21a'], colors: ['#fff6a8', '#ffe03a', '#b8901a'] },
  { id: 'megasale', name: 'Mega Sale Trail', mult: 1.5, price: 40e6, emblem: 'tag', card: ['#ff5a6a', '#c81a2a'], colors: ['#ffffff', '#ff3b4a', '#a8121e'] },
  { id: 'soda', name: 'Soda Fizz Trail', mult: 1.6, price: 500e6, emblem: 'soda', card: ['#c47aff', '#7a2ad8'], colors: ['#f2d8ff', '#b45cff', '#5a14b0'] },
  { id: 'hotsauce', name: 'Hot Sauce Trail', mult: 1.7, price: 6e9, emblem: 'chili', card: ['#ff8a3a', '#d8461a'], colors: ['#ffe03a', '#ff7a1a', '#e8221a'] },
  { id: 'goldcoin', name: 'Gold Coin Trail', mult: 1.8, price: 75e9, emblem: 'coin', card: ['#f4cf4a', '#c8941a'], colors: ['#fff6c0', '#ffd23a', '#c88a12'] },
  { id: 'laser', name: 'Checkout Laser Trail', mult: 1.9, price: 900e9, emblem: 'barcode', card: ['#b03a4a', '#6a1424'], colors: ['#ffffff', '#ff2a3a', '#5a0a14'] },
  { id: 'disco', name: 'Disco Cart Trail', mult: 2, price: 2e12, emblem: 'disco', premium: true, card: ['#ff6a6a', '#ffd25a', '#7dff9a', '#6ad0ff', '#e88cff'], colors: ['#ff3b3b', '#ffb21f', '#ffef3a', '#3cff6a', '#3fa2ff', '#b45cff'] },
  { id: 'diamondcard', name: 'Diamond Card Trail', mult: 2.2, price: 12e12, emblem: 'card', card: ['#7fd0ff', '#2a6fd8'], colors: ['#ffffff', '#9fe8ff', '#3f8cff'] },
  { id: 'cosmic', name: 'Cosmic Cart Trail', mult: 2.5, price: 150e12, emblem: 'cart', card: ['#8a5cff', '#2a1470'], colors: ['#1a0a4a', '#5a2ad8', '#c98cff', '#ffffff'] },
  { id: 'blackfriday', name: 'Black Friday Trail', mult: 3, price: 400e12, emblem: 'bag', premium: true, card: ['#6a4a2a', '#2a1a10'], colors: ['#14100a', '#4a3a24', '#ffd23a'] },
  { id: 'clover', name: 'Lucky Clover Trail', mult: 1.5, daily: 7, emblem: 'clover', card: ['#7ddc5a', '#2f9a2a'], colors: ['#e0ffc0', '#5aff4a', '#1a9a2a'] },
]
// Old trail ids -> the trail with the same (or the next) boost, so saves keep what they bought.
export const TRAIL_RENAMES = { white: 'receipt', red: 'bubblewrap', blue: 'banana', green: 'megasale', yellow: 'megasale', purple: 'soda', inferno: 'hotsauce', diamond: 'goldcoin', celestial: 'laser', rainbow: 'disco', void: 'blackfriday' }
export const DEFAULT_TRAIL_COLORS = ['#ffffff', '#cfe9ff'] // flight ribbon with no trail equipped

// Shop: passes and packs, all for Wins.
export const PASSES = [
  { id: 'skill2x', name: '+2x Skill', desc: 'Double Skill from every training click, forever.', price: 2000 },
  { id: 'wins2x', name: '2x Wins', desc: 'Double Wins from every flight, forever.', price: 15000 },
  { id: 'petslot', name: '+1 Pet Slot', desc: 'Equip one more pet at a time.', price: 8000 },
  { id: 'starter', name: 'Starter Pack', desc: '+2,500 Skill, 10 Race Tokens and an Ember Fox.', price: 5000 },
]
export const SKILL_PACKS = [
  { id: 'p1', amount: 1800, price: 150, style: 'gold' },
  { id: 'p2', amount: 18000, price: 1200, style: 'red' },
  { id: 'p3', amount: 180000, price: 9000, style: 'rainbow' },
]

// Boost potions (Inventory > Potions): using one adds `minutes` of x`mult` (stacks time). icon = icons.js
// painter. The reference sold 3-packs for premium currency: here `pack3` Wins buys three.
export const BOOSTS = {
  skill: { name: 'Power Potion', short: 'POWER', mult: 2, minutes: 5, icon: 'starSkill', color: '#5fc8ff', card: ['#4fb4ff', '#1f6fd8'], pack3: 7500 },
  wins: { name: 'Wins Potion', short: 'WINS', mult: 2, minutes: 5, icon: 'starWins', color: '#ffd23a', card: ['#ffd84a', '#e0a012'], pack3: 10000 },
  luck: { name: 'Luck Potion', short: 'LUCK', mult: 2, minutes: 5, icon: 'starLuck', color: '#7dff5a', card: ['#5fdc4a', '#239a2a'], pack3: 7500 },
}

// Daily Rewards: one more day unlocks every new local calendar day (capped at 7);
// once all 7 are claimed the next day starts the cycle again at day 1. Day 7 gives
// the limited Lucky Clover Trail (or `again` if it is already owned).
export const DAILY = [
  { boost: 'skill', n: 1 },
  { pet: 'luckycat' },
  { boost: 'wins', n: 1 },
  { boost: 'luck', n: 2 },
  { boost: 'skill', n: 3 },
  { boost: 'wins', n: 3 },
  { trail: 'clover', again: [{ boost: 'skill', n: 3 }, { boost: 'wins', n: 3 }, { boost: 'luck', n: 3 }] },
]

// Playtime Rewards: minutes played this session. skill (Power) / wins are x(rebirths + 1).
// egg = a free hatch of that egg; boost = one potion; dice = one aura die (Auras window).
export const PLAYTIME = [
  { at: 1, skill: 750 },
  { at: 3, wins: 25 },
  { at: 5, egg: 'common' },
  { at: 7, boost: 'skill' },
  { at: 10, wins: 75 },
  { at: 12, dice: 'gold' },
  { at: 15, boost: 'wins' },
  { at: 30, egg: 'uncommon' },
  { at: 45, boost: 'luck' },
  { at: 55, dice: 'gold' },
  { at: 70, skill: 3000 },
  { at: 90, egg: 'exclusive' },
]
export const CHEST = { cooldown: 10 * 60, wins: 25 } // s; Wins x (rebirths + 1)
// Friend Boost: every friend who joins the game from this player's invite (link or direct Bloxity invite;
// the server credits each account once, backend invite.ts) adds +per Skill gain for good, up to max friends.
export const FRIEND_BOOST = { per: 0.1, max: 10 }

// Limited items that never sit on a pad or an egg (daily rewards).
export const LIMITED_SLINGSHOTS = [{ id: 'galaxy', name: 'Galaxy Cannon', skill: 2500, style: 'galaxy' }]
export const LIMITED_PETS = [
  { id: 'samurai', name: 'Samurai Cat', rarity: 'Legendary', boost: 10, source: 'Daily Reward', look: { kind: 'cat', body: '#ffffff', accent: '#ff8a3a', samurai: true } },
  { id: 'luckycat', name: 'Lucky Cat', rarity: 'Legendary', boost: 10, source: 'Daily Reward', look: { kind: 'cat', body: '#ffffff', accent: '#ff3b4a', glow: '#ffd23a' } },
  // Rebirth milestone pets (REBIRTH_MILESTONES): `vsBest` = always this much better than your best other pet.
  { id: 'msdragon', name: 'Milestone Dragon', rarity: 'Mythic', boost: 1, vsBest: 1, source: 'Rebirth 5 Milestone', look: { kind: 'dragon', body: '#c9a8ff', accent: '#ffd23a', wings: true, glow: '#d8b8ff' } },
  { id: 'msphoenix', name: 'Milestone Phoenix', rarity: 'Mythic', boost: 2, vsBest: 1.5, source: 'Rebirth 15 Milestone', look: { kind: 'bird', body: '#ff7a3a', accent: '#ffe14a', wings: true, glow: '#ffb347' } },
  { id: 'mstitan', name: 'Milestone Titan', rarity: 'Secret', boost: 3, vsBest: 2, source: 'Rebirth 30 Milestone', look: { kind: 'dragon', body: '#2a1450', accent: '#5ad8ff', wings: true, glow: '#7fe8ff', spiky: true } },
]

// Pet tiers: every hatch has a small chance (%, x luck) to come out Golden or Diamond.
export const PET_TIERS = [
  { id: '', name: 'Basic', mult: 1 },
  { id: 'g', name: 'Golden', mult: 2, chance: 4, look: { body: '#ffcf3a', accent: '#fff2a0', glow: '#ffd700' } },
  { id: 'd', name: 'Diamond', mult: 4, chance: 0.8, look: { body: '#a8f4ff', accent: '#ffffff', glow: '#7fe8ff' } },
]
// Inventory capacity: the "+" buttons under the Inventory window buy more (Wins).
export const PET_STORAGE = { base: 100, step: 50, prices: [2000, 8000, 30000, 100000, 400000] }
export const EXTRA_SLOT_PRICES = [15000, 60000, 250000]
// Index Luck: every `every` discoveries (any tier) can be claimed for +pct luck.
export const INDEX_LUCK = { every: 5, pct: 0.01 }

// Titles (Inventory > Titles). bonus = { skill | wins | luck: fraction } while equipped.
// req = { stat, n }: stat is a key of titleStat() in state.js; null = always owned;
// special = never unlocked in game (staff / creator titles).
export const TITLES = [
  { id: 'newbie', name: 'Newbie', color: '#ffffff', desc: 'Join the game!', bonus: { skill: 0.02 }, req: null },
  { id: 'first', name: 'First Launch', color: '#fff3c0', desc: 'Make your first flight!', bonus: { wins: 0.05 }, req: { stat: 'flights', n: 1 } },
  { id: 'pirate', name: 'Pirate Captain', color: '#8fb8ff', desc: 'Fly 250m in one flight!', bonus: { skill: 0.1 }, req: { stat: 'bestDistance', n: 250 } },
  { id: 'voyager', name: 'Star Voyager', color: '#a98cff', desc: 'Fly 500m in one flight!', bonus: { skill: 0.2 }, req: { stat: 'bestDistance', n: 500 } },
  { id: 'frost', name: 'Frost Engineer', color: '#ffd27a', desc: 'Fly 1,000m in one flight!', bonus: { skill: 0.3 }, req: { stat: 'bestDistance', n: 1000 } },
  { id: 'shogun', name: 'Shogun', color: '#ff5a5a', desc: 'Fly 1,500m in one flight!', bonus: { skill: 0.45 }, req: { stat: 'bestDistance', n: 1500 } },
  { id: 'colonist', name: 'Star Colonist', color: '#ff7a6a', desc: 'Fly 2,000m in one flight!', bonus: { skill: 0.6 }, req: { stat: 'bestDistance', n: 2000 } },
  { id: 'fairy', name: 'Fairy Monarch', color: '#ff8fd8', desc: 'Reach the Snow at the end of the river!', bonus: { skill: 0.75 }, req: { stat: 'bestDistance', n: 3000 } },
  { id: 'hopper', name: 'Sky Hopper', color: '#ff6a9a', desc: 'Make 3,000 flights!', req: { stat: 'flights', n: 3000 } },
  { id: 'slimelegend', name: 'Slime Legend', color: '#ff4a4a', desc: 'Fly over 1,000m 1,500 times!', req: { stat: 'longFlights', n: 1500 } },
  { id: 'thunder', name: 'Thunderstruck', color: '#b45cff', desc: 'Hatch 6 Mythic pets!', req: { stat: 'mythics', n: 6 } },
  { id: 'royal', name: 'Rebirth Royal', color: '#ffc83a', desc: 'Rebirth 10 times!', req: { stat: 'rebirths', n: 10 } },
  { id: 'ascendant', name: 'Ascendant', color: '#ff5a4a', desc: 'Rebirth 25 times!', req: { stat: 'rebirths', n: 25 } },
  { id: 'eggfan', name: 'Egg Fan', color: '#5fd0ff', desc: 'Hatch 1,000 eggs!', req: { stat: 'hatched', n: 1000 } },
  { id: 'indexmaster', name: 'Index Master', color: '#ff4a6a', desc: 'Discover every Basic pet in the Index!', bonus: { luck: 0.15 }, req: { stat: 'indexBasic', n: -1 } },
  { id: 'grinder', name: 'Time Grinder', color: '#ffc83a', desc: 'Play for 10 hours!', req: { stat: 'playTime', n: 36000 } },
  { id: 'dailyhero', name: 'Daily Hero', color: '#ffb21f', desc: 'Claim 30 Daily Rewards!', req: { stat: 'dailyClaims', n: 30 } },
  { id: 'supporter', name: 'Supporter', color: '#5fe0ff', desc: 'Open the Free Rewards chest 100 times!', req: { stat: 'chests', n: 100 } },
  { id: 'spender', name: 'Big Spender', color: '#ffd23a', desc: 'Spend 1,000,000 Wins!', req: { stat: 'spent', n: 1e6 } },
  { id: 'creator', name: 'Content Creator', color: '#ff4a4a', desc: 'Make videos about Cart Speed!', special: true },
  { id: 'tester', name: 'Tester', color: '#5fe0ff', desc: 'Helped test the game!', special: true },
  { id: 'developer', name: 'Developer', color: '#ff4a4a', desc: 'Made this game!', special: true },
]

// In-game Settings window (saved with the progress).
export const GAME_SETTINGS = [
  { key: 'sfx', label: 'Sound Effects', def: true },
  { key: 'music', label: 'Music', def: true },
  { key: 'shake', label: 'Camera Shake', def: true },
  { key: 'effects', label: 'Effects', def: true },
  { key: 'hideHud', label: 'Hide HUD', def: false },
  { key: 'hidePets', label: 'Hide All Pets', def: false },
  { key: 'flightAlerts', label: 'Flight Alerts', def: true },
  { key: 'hatchAnim', label: 'Hatch Animation', def: true },
]

// Rebirth milestones (the Rebirth window's bottom strip): reaching `at` rebirths gives that pet once.
export const REBIRTH_MILESTONES = [
  { at: 5, pet: 'msdragon' },
  { at: 15, pet: 'msphoenix' },
  { at: 30, pet: 'mstitan' },
]

// Auras (the Auras window: roll for one, Inventory > Auras to equip). n = 1 in n base chance; power /
// wins = x multipliers on Power (Skill) gain and Wins while equipped; colors = the glow around the player
// and the name gradient. Rolling walks from the rarest down: an aura hits with luck / n, else Dust.
export const AURAS = [
  { id: 'dust', name: 'Dust', n: 2, power: 1.05, wins: 1, colors: ['#e2d3b0', '#a8946a'] },
  { id: 'pebble', name: 'Pebble', n: 4, power: 1.1, wins: 1, colors: ['#d0d6de', '#7a8490'] },
  { id: 'breeze', name: 'Breeze', n: 8, power: 1.15, wins: 1.05, colors: ['#d8fbff', '#6fd8ff'] },
  { id: 'spark', name: 'Spark', n: 16, power: 1.25, wins: 1.05, colors: ['#fff27a', '#ffb21f'] },
  { id: 'bubble', name: 'Bubble', n: 32, power: 1.35, wins: 1.1, colors: ['#9fe8ff', '#ff9cf5'] },
  { id: 'ember', name: 'Ember', n: 64, power: 1.5, wins: 1.1, colors: ['#ffc05a', '#ff3b1f'] },
  { id: 'frost', name: 'Frost', n: 128, power: 1.65, wins: 1.15, colors: ['#f0fbff', '#5fb4ff'] },
  { id: 'thunder', name: 'Thunder', n: 300, power: 1.8, wins: 1.2, colors: ['#fff7a8', '#7a5cff'] },
  { id: 'toxic', name: 'Toxic', n: 650, power: 2, wins: 1.25, colors: ['#c8ff5a', '#2fbf3a'] },
  { id: 'solar', name: 'Solar Flare', n: 1500, power: 2.25, wins: 1.3, colors: ['#ffe46a', '#ff6a1a'] },
  { id: 'lunar', name: 'Lunar', n: 3000, power: 2.5, wins: 1.35, colors: ['#eef2ff', '#8a9cff'] },
  { id: 'prism', name: 'Prism', n: 6000, power: 3, wins: 1.45, colors: ['#ff7ad0', '#5ad8ff'] },
  { id: 'comet', name: 'Comet', n: 12000, power: 3.5, wins: 1.6, colors: ['#bfe6ff', '#3a5fe8'] },
  { id: 'aurora', name: 'Northern Lights', n: 30000, power: 4.5, wins: 1.8, colors: ['#5affc8', '#b45cff'] },
  { id: 'bloodmoon', name: 'Blood Moon', n: 80000, power: 6, wins: 2, colors: ['#ff4a4a', '#8a0a1a'] },
  { id: 'nebula', name: 'Nebula', n: 120000, power: 7, wins: 2.5, colors: ['#d8a0ff', '#ff5ad8'] },
  { id: 'kaleido', name: 'Kaleidoscope', n: 200000, power: 8, wins: 3, colors: ['#ff5a5a', '#ffd23a', '#5aff7a', '#5ab4ff'] },
  { id: 'colossus', name: 'Colossus', n: 500000, power: 10, wins: 4, colors: ['#ffe7a0', '#c88a12'] },
  { id: 'supernova', name: 'Supernova', n: 750000, power: 12, wins: 5, colors: ['#ffffff', '#ffb21f'] },
  { id: 'bigbang', name: 'Big Bang', n: 1000000, power: 15, wins: 6, colors: ['#ff5ad8', '#5ad8ff', '#ffffff'] },
]
// The four roll buttons: `luck` x the player's own luck. Gold / Diamond / Cosmic were premium dice in the
// reference: each uses one owned die (Playtime Rewards, quests) or costs `price` Wins.
export const AURA_ROLLS = [
  { id: 'roll', name: 'Roll', luck: 1, price: 200 },
  { id: 'gold', name: 'Gold', luck: 100, price: 25000 },
  { id: 'diamond', name: 'Diamond', luck: 1000, price: 150000 },
  { id: 'cosmic', name: 'Cosmic', luck: 10000, price: 500000 },
]
// Permanent aura luck upgrades (premium passes in the reference, Wins here). Owned ones multiply.
export const AURA_PASSES = [
  { id: 'auraLuck2', mult: 2, price: 60000 },
  { id: 'auraLuck3', mult: 3, price: 200000 },
]
// Auto Roll: one basic Roll every `every` s while on (paid as usual, stops when Wins run out).
export const AURA_AUTO = { every: 1.2 }
// The Luck Event (HUD "NEXT EVENT"): every `every` minutes of the wall clock (so every player shares it)
// aura rolls get x`mult` luck for `lasts` minutes.
export const AURA_EVENT = { every: 20, lasts: 3, mult: 2 }

// Quests (the HUD's QUESTS panel): QUEST_COUNT at a time from this pool, handed out in order (skipping
// ones already done). kind: oneFlight = metres in one launch; carts = carts owned; the rest count up
// from when the quest was given (flights, hatched, rolls, dodges, trains, chests, rebirths).
export const QUEST_COUNT = 3
export const QUESTS = [
  { id: 'fly300', text: 'Fly 300 m in one launch', kind: 'oneFlight', n: 300, reward: { boost: 'skill', n: 1 } },
  { id: 'hatch5', text: 'Hatch 5 pets', kind: 'hatched', n: 5, reward: { boost: 'luck', n: 1 } },
  { id: 'carts4', text: 'Own 4 carts', kind: 'carts', n: 4, reward: { boost: 'wins', n: 1 } },
  { id: 'roll25', text: 'Roll 25 auras', kind: 'rolls', n: 25, reward: { dice: 'gold', n: 1 } },
  { id: 'fly1000', text: 'Fly 1,000 m in one launch', kind: 'oneFlight', n: 1000, reward: { boost: 'skill', n: 2 } },
  { id: 'launch10', text: 'Launch 10 times', kind: 'flights', n: 10, reward: { boost: 'wins', n: 1 } },
  { id: 'train300', text: 'Train 300 times', kind: 'trains', n: 300, reward: { boost: 'skill', n: 1 } },
  { id: 'launch25', text: 'Launch 25 times', kind: 'flights', n: 25, reward: { boost: 'luck', n: 1 } },
  { id: 'carts7', text: 'Own 7 carts', kind: 'carts', n: 7, reward: { dice: 'gold', n: 1 } },
  { id: 'hatch50', text: 'Hatch 50 pets', kind: 'hatched', n: 50, reward: { dice: 'gold', n: 2 } },
  { id: 'chest3', text: 'Open the rewards chest 3 times', kind: 'chests', n: 3, reward: { boost: 'wins', n: 2 } },
  { id: 'rebirth1', text: 'Rebirth once', kind: 'rebirths', n: 1, reward: { boost: 'skill', n: 3 } },
  { id: 'fly2000', text: 'Fly 2,000 m in one launch', kind: 'oneFlight', n: 2000, reward: { dice: 'gold', n: 3 } },
  { id: 'roll250', text: 'Roll 250 auras', kind: 'rolls', n: 250, reward: { boost: 'luck', n: 3 } },
  { id: 'launch100', text: 'Launch 100 times', kind: 'flights', n: 100, reward: { dice: 'gold', n: 2 } },
]
// The area name shown at the top of the screen.
export const AREA_NAME = 'Suburbia'

export const WORLD2_SKILL = 600e6

// --- The hub (src/hub/): what PLAZA / FLY_ZONE / CHANNEL / SPAWN above don't cover ----------------
export const HUB = {
  portal: { x: -18, z: -12 }, // the WORLDS portal (the World 2 gate)
  treadmillRun: 6.5, // m/s the avatar's run animation plays at on a treadmill belt
  colors: {
    path: '#cbc5fa',
    rim: '#8a6cf0',
    greenA: '#63e23a',
    greenB: '#50d22b',
    cliffA: '#c45d2a',
    cliffB: '#93391b',
    grass: '#5bd62b',
    yellowA: '#ffd84a',
    yellowB: '#ffc727',
    water: '#3fe2ff',
  },
}
// The "Possible Launches" board by the launch zone (odds shown, not rolled yet).
export const HUB_LAUNCH_TYPES = [
  { name: 'NORMAL', desc: 'A regular launch', color: '#ffffff', rarity: 'COMMON', odds: '99%', pill: '#9aa1aa' },
  { name: 'MAX POWER', desc: 'x1.2 distance, x3 Wins', color: '#ff5a3a', rarity: 'RARE', odds: '1 in 100', pill: '#ff7a1f' },
  { name: 'THUNDERSTRIKE', desc: 'x4 distance, x10 Wins', color: '#3fb4ff', rarity: 'LEGENDARY', odds: '1 in 1,000', pill: '#1f8fff' },
  { name: 'COSMIC', desc: 'x10 distance, x100 Wins', color: '#ff6af0', rarity: 'MYTHICAL', odds: '1 in 10,000', pill: '#e83ad8' },
]
// Stage boards (south), left -> right as you face them: [title, stat, column]. The server ranks
// bestSkill/playTime/level/wins (it has no rebirth board yet, so Level stands in for it).
export const HUB_BOARDS = [
  ['Top Level', 'level', 'LEVEL'],
  ['Top Wins', 'wins', 'WINS'],
  ['Top Power', 'bestSkill', 'POWER'],
  ['Top Time Played', 'playTime', 'TIME'],
]
// Training (game.js train(), feedback in training.js + audio/training.js).
export const TRAIN = {
  interval: 0.16, // s between training clicks while held
  cooldown: 1, // s: minimum time between Skill gains (clicks and bounces)
  streakGap: 0.45, // s: a click within this of the last one continues the streak
  streakEvery: 25, // a "N Streak!" milestone every this many clicks in a row
  popLife: 0.9, // s a "+N" number stays up
  popHeight: 2.7, // m above the feet the numbers start
  popRise: 14, // vmin they float up over their life
  popSpreadX: 9, // vmin random sideways scatter
  popSpreadY: 3,
  maxPops: 16, // pooled DOM elements
  waveSize: 5, // shockwave reach on a table, m
  armSpring: 260, // arm pull spring stiffness (draw back, snap past rest, settle)
  armDamp: 13,
  // unlocked training tables are trampolines (training.js bouncer, player.js setBouncer)
  bounceHeight: 6.5, // m each bounce rises above a 1x table top
  bounceTier: 0.3, // bigger tables bounce higher: x(1 + log10(mult) * this), 50x = ~1.5x
  bounceBoost: 1.5, // x height when jump is held on landing
  hopReach: 1.2, // m past the rim where walking into a table hops you on
  hopClear: 0.9, // m the hop clears the table top by
  hopSpeed: 4, // m/s inward on the hop so you land on the table
  // glow / sparks colour per training table style
}

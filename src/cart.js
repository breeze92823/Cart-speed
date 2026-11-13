import {
  BoxGeometry,
  CanvasTexture,
  CylinderGeometry,
  DoubleSide,
  Euler,
  Group,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
} from 'three'
import { CART, CHANNEL, FLIGHT } from './config.js'
import { legoBoxGeo, legoMat, mergedMesh } from './legokit.js'
import { buildCart as buildShopModel, isCartStyle } from './hub/carts.js'

// The starting gate and the shopping cart of the launch (flight.js).
//  gate  two red lego posts with yellow knobs on white base plates, and a thick bungee
//        strung between them. It pops up out of the Launch Zone, the cart is hooked to
//        the bungee and drawn back (setPull 0..1), released (the bungee snaps forward and
//        wobbles), then the gate lingers and sinks away.
//  cart  a pink wire shopping cart. While the player rides it follows the avatar's
//        transform (follow), rattling and spinning its wheels with speed; when the rider
//        is thrown out (loose) it flips forward onto its nose, bounces and clatters to a
//        stop on the asphalt (a small rigid-body sim, impacts reported through onImpact).
// Local frames: the cart's front is +Z (the avatar's local forward), origin = the
// ground point under the cart centre. The gate's group sits at the gate line.

const easeOutBack = (k) => {
  const c = 2.4
  return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2)
}
const easeOut = (k) => 1 - (1 - k) * (1 - k)
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)
const TAU = Math.PI * 2
const UP = new Vector3(0, 1, 0)
const tmpA = new Vector3()
const tmpB = new Vector3()
const tmpQ = new Quaternion()
const tmpE = new Euler(0, 0, 0, 'YXZ')

function dispose(root) {
  root.traverse((o) => {
    o.geometry?.dispose()
    const m = o.material
    if (Array.isArray(m)) m.forEach((x) => x.dispose())
    else m?.dispose()
  })
}

// A see-through wire grid: white lines on transparent, tinted by the material colour.
let wireTex = null
function wireTexture() {
  if (wireTex) return wireTex
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')
  g.strokeStyle = '#ffffff'
  g.lineWidth = 7
  for (let i = 0; i <= 64; i += 32) {
    g.beginPath()
    g.moveTo(i, 0)
    g.lineTo(i, 64)
    g.moveTo(0, i)
    g.lineTo(64, i)
    g.stroke()
  }
  wireTex = new CanvasTexture(c)
  wireTex.colorSpace = SRGBColorSpace
  wireTex.wrapS = wireTex.wrapT = 1000 // RepeatWrapping
  wireTex.anisotropy = 4
  return wireTex
}

// A round tube from a to b.
function bar(parent, a, b, r, mat) {
  const len = a.distanceTo(b)
  const m = new Mesh(new CylinderGeometry(r, r, len, 8), mat)
  m.position.copy(a).add(b).multiplyScalar(0.5)
  m.quaternion.setFromUnitVectors(UP, tmpA.copy(b).sub(a).normalize())
  m.castShadow = true
  parent.add(m)
  return m
}

// --- Cart model ----------------------------------------------------------------------------
// The equipped shop cart (hub/carts.js, nose at -Z), turned to face +Z and scaled to the
// launch cart's size so the rider's seat, the bungee hook and the tumble box still fit.
const SHOP_SCALE = 0.82
function buildShopCart(def) {
  const root = new Group()
  root.name = 'cart'
  const body = new Group()
  root.add(body)
  const m = buildShopModel(def)
  const turn = new Group()
  turn.rotation.y = Math.PI
  turn.scale.setScalar(SHOP_SCALE)
  turn.add(m.root, m.animated)
  body.add(turn)
  const k = SHOP_SCALE
  const nose = def.style === 'cart-rocket' ? 2.0 : 1.2 // how far the nose reaches past the centre
  return {
    root,
    body,
    wheels: m.wheels,
    spinSign: -1, // the model is turned half round, so its wheels spin the other way
    tick: m.animated.userData.tick ?? null,
    hook: new Vector3(0, 0.8 * k, (def.style === 'cart-rocket' ? 1.9 : 0.95) * k),
    half: new Vector3(0.78 * k, 2.1 * k, Math.max(1.42, nose) * k),
  }
}

function buildCart() {
  const root = new Group()
  root.name = 'cart'
  const body = new Group() // squash / rattle
  root.add(body)
  const frame = new MeshStandardMaterial({ color: CART.color, roughness: 0.35, metalness: 0.25 })
  const dark = new MeshStandardMaterial({ color: CART.colorDark, roughness: 0.4, metalness: 0.2 })
  const tex = wireTexture().clone()
  tex.needsUpdate = true
  tex.repeat.set(9, 6)
  const wire = new MeshStandardMaterial({ color: CART.color, map: tex, alphaTest: 0.45, side: DoubleSide, roughness: 0.4, metalness: 0.2 })
  const hidden = new MeshStandardMaterial({ visible: false })

  // Basket: a box whose top is wider and longer than its bottom, open on top.
  const yb = 0.56 // basket floor
  const yt = 1.42 // rim
  const bw = 0.62 // half widths at the bottom / top
  const tw = 0.78
  const bl = 0.82 // half lengths
  const tl = 1.08
  const geo = new BoxGeometry(2, 1, 2, 1, 1, 1)
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const top = pos.getY(i) > 0
    pos.setXYZ(i, pos.getX(i) * (top ? tw : bw), top ? yt : yb, pos.getZ(i) * (top ? tl : bl) + (top ? -0.12 : 0))
  }
  geo.computeVertexNormals()
  const basket = new Mesh(geo, [wire, wire, hidden, wire, wire, wire])
  basket.castShadow = true
  body.add(basket)
  // rim, corner posts and floor rails
  const c = (sx, sz, top) => new Vector3(sx * (top ? tw : bw), top ? yt : yb, sz * (top ? tl : bl) + (top ? -0.12 : 0))
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]]
  for (let i = 0; i < 4; i++) {
    const [ax, az] = corners[i]
    const [bx, bz] = corners[(i + 1) % 4]
    bar(body, c(ax, az, true), c(bx, bz, true), 0.055, frame)
    bar(body, c(ax, az, false), c(bx, bz, false), 0.04, frame)
    bar(body, c(ax, az, false), c(ax, az, true), 0.045, frame)
  }
  // chassis under the basket and the wheel forks
  const wheelY = 0.17
  const wz = 0.78
  const wx = 0.52
  for (const sx of [-1, 1]) bar(body, new Vector3(sx * wx, 0.42, -wz - 0.25), new Vector3(sx * wx, 0.42, wz), 0.045, dark)
  bar(body, new Vector3(-wx, 0.42, wz), new Vector3(wx, 0.42, wz), 0.045, dark)
  bar(body, new Vector3(-wx, 0.42, -wz - 0.25), new Vector3(wx, 0.42, -wz - 0.25), 0.045, dark)
  // lower tray between the axles
  const tray = new Mesh(new BoxGeometry(wx * 2, 0.04, wz * 2 - 0.2), wire)
  tray.position.y = 0.42
  body.add(tray)
  // handle at the back (-Z): pink arms and a chunky white grip
  const grip = new MeshStandardMaterial({ color: CART.handle, roughness: 0.5 })
  const hz = -tl - 0.12 - 0.42
  for (const sx of [-1, 1]) bar(body, c(sx, -1, true), new Vector3(sx * tw * 0.95, yt + 0.14, hz), 0.05, frame)
  const handle = new Mesh(new CylinderGeometry(0.1, 0.1, tw * 2.05, 14).rotateZ(Math.PI / 2), grip)
  handle.position.set(0, yt + 0.14, hz)
  handle.castShadow = true
  body.add(handle)
  for (const sx of [-1, 1]) {
    const cap = new Mesh(new CylinderGeometry(0.12, 0.12, 0.08, 14).rotateZ(Math.PI / 2), dark)
    cap.position.set(sx * tw * 1.05, yt + 0.14, hz)
    body.add(cap)
  }
  // a little pink "Cart Speed" plate on the nose
  const plate = new Mesh(new BoxGeometry(0.7, 0.24, 0.04), dark)
  plate.position.set(0, (yb + yt) / 2 + 0.05, bl + 0.14)
  plate.rotation.x = -0.28
  body.add(plate)

  // casters
  const tire = new MeshStandardMaterial({ color: CART.wheel, roughness: 0.8 })
  const hub = new MeshStandardMaterial({ color: '#f2f2f6', roughness: 0.3, metalness: 0.4 })
  const wheelGeo = new CylinderGeometry(wheelY, wheelY, 0.13, 16).rotateZ(Math.PI / 2)
  const hubGeo = new CylinderGeometry(wheelY * 0.45, wheelY * 0.45, 0.15, 10).rotateZ(Math.PI / 2)
  const wheels = []
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const z = sz > 0 ? wz : -wz - 0.25
    bar(body, new Vector3(sx * wx, 0.42, z), new Vector3(sx * wx, wheelY + 0.04, z - 0.06), 0.035, dark)
    const w = new Group()
    w.position.set(sx * wx, wheelY, z - 0.08)
    const t = new Mesh(wheelGeo, tire)
    t.castShadow = true
    w.add(t, new Mesh(hubGeo, hub))
    body.add(w)
    wheels.push(w)
  }
  // nose point (where the bungee hooks on) in cart space
  return { root, body, wheels, hook: new Vector3(0, 0.62, bl + 0.08), half: new Vector3(tw, yt, tl + 0.55) }
}

// --- Gate model ------------------------------------------------------------------------------
function buildGate() {
  const root = new Group()
  root.name = 'start-gate'
  const W = CART.gateWidth / 2
  const H = CART.postHeight
  const posts = []
  for (const side of [-1, 1]) {
    const post = new Group()
    post.position.x = side * W
    const red = mergedMesh([legoBoxGeo(0.9, H, 0.9, 0, H / 2 + 0.3, 0)], legoMat('#ff2b2b'))
    const base = mergedMesh([legoBoxGeo(1.8, 0.3, 1.8, 0, 0.15, 0)], legoMat('#f2f4f8'))
    const knob = new Mesh(new SphereGeometry(0.62, 20, 14), new MeshStandardMaterial({ color: '#ffd21f', roughness: 0.35, emissive: '#ffb000', emissiveIntensity: 0.15 }))
    knob.position.y = H + 0.62
    knob.castShadow = true
    post.add(red, base, knob)
    root.add(post)
    posts.push(post)
  }
  // the bungee: two thick straps meeting at a moving centre point
  const bandMat = new MeshStandardMaterial({ color: '#ff3b3b', roughness: 0.6 })
  const strapGeo = new BoxGeometry(1, 1, 1).translate(0, 0, 0.5)
  const straps = [-1, 1].map(() => {
    const m = new Mesh(strapGeo, bandMat)
    m.castShadow = true
    root.add(m)
    return m
  })
  return { root, posts, straps, anchorY: 0.95 }
}

export function createCart(scene, { onImpact } = {}) {
  let cart = null
  let gate = null
  // gate state
  let gPhase = 'none' // 'summon' | 'ready' | 'linger' | 'vanish'
  let gT = 0
  let pull = 0
  let band = 0 // bungee centre: m behind (+) / ahead (-) of the gate line (gate space)
  let bandV = 0
  let springing = false
  let wobble = 0 // posts sway after the snap
  // cart state
  let mode = 'none' // 'gate' | 'ride' | 'loose'
  let dropT = 0 // the cart falling in at the gate
  let rattle = 0
  let wheelSpin = 0
  let squash = 0
  const vel = new Vector3()
  const spin = new Vector3() // rad/s about the cart's local x (pitch) / z (roll) / y
  const rot = new Euler(0, Math.PI, 0, 'YXZ')
  let rest = 0
  let elapsed = 0 // drives the cart's own animation (rocket flames, bubble)
  const spinWheels = (a, add = false) => {
    const s = cart.spinSign ?? 1
    for (const w of cart.wheels) w.rotation.x = add ? w.rotation.x + a * s : a * s
  }

  function hookWorld(out) {
    cart.root.updateMatrixWorld(true)
    return cart.body.localToWorld(out.copy(cart.hook))
  }
  function layoutBand() {
    if (!gate) return
    const gp = gate.root.position
    // the strap ends at the cart's nose while hooked, else at the free centre point
    if (mode === 'gate' && !springing) hookWorld(tmpB)
    else tmpB.set(gp.x, gp.y + gate.anchorY - Math.min(0.4, Math.abs(band) * 0.1), gp.z + band)
    gate.straps.forEach((s, k) => {
      const side = k === 0 ? -1 : 1
      tmpA.set(gp.x + side * (CART.gateWidth / 2 - 0.35) * gate.root.scale.x, gp.y + gate.anchorY * gate.root.scale.y, gp.z)
      const local = gate.root.worldToLocal(tmpA.clone())
      const len = Math.max(0.05, tmpA.distanceTo(tmpB))
      s.position.copy(local)
      s.lookAt(tmpB)
      const thin = 1 / Math.sqrt(Math.max(1, len / 1.4))
      s.scale.set(0.34 * thin, 0.2 * thin, len)
    })
  }

  return {
    get active() {
      return !!cart
    },
    get position() {
      return gate?.root.position ?? cart?.root.position
    },
    get cartPosition() {
      return cart?.root.position
    },
    get mode() {
      return mode
    },
    // Builds the gate at (x, gateZ) and drops the cart in just behind it. `def` = the equipped
    // cart (config SLINGSHOTS entry); without a cart style it is the plain pink cart.
    summon(x, gateZ, def = null) {
      this.remove()
      gate = buildGate()
      gate.root.position.set(x, CHANNEL.surfaceY, gateZ)
      gate.root.scale.setScalar(0.001)
      scene.add(gate.root)
      cart = isCartStyle(def?.style) ? buildShopCart(def) : buildCart()
      elapsed = 0
      cart.root.position.set(x, CHANNEL.surfaceY + 6, gateZ + 1.45)
      cart.root.rotation.set(0, Math.PI, 0)
      scene.add(cart.root)
      gPhase = 'summon'
      gT = 0
      pull = band = bandV = wobble = 0
      springing = false
      mode = 'gate'
      dropT = 0
      squash = 0
      layoutBand()
    },
    summoned: () => gPhase !== 'summon',
    setPull(p) {
      pull = p
      springing = false
    },
    // The cart leaves the gate: the bungee snaps forward and wobbles, the posts sway.
    release() {
      springing = true
      band = 0.3 + pull * FLIGHT.pullBack // where the hook was (behind the line)
      bandV = -38
      wobble = 1
      gPhase = 'linger'
      gT = 0
      mode = 'ride'
    },
    // World position of the rider's feet while sitting in the cart (at the gate).
    seat(out) {
      if (!cart) return out.set(0, 0, 0)
      const p = cart.root.position
      return out.set(p.x, p.y + CART.seatY + cart.body.position.y, p.z)
    },
    // A little squash when the rider lands in it / it lands on its wheels.
    thump(k = 1) {
      squash = Math.max(squash, k)
    },
    // While riding: the cart takes the avatar group's transform (feet -> cart ground point).
    follow(group, speed, dt) {
      if (!cart || mode !== 'ride') return
      tmpQ.setFromEuler(group.rotation)
      tmpA.set(0, -CART.seatY, 0).applyQuaternion(tmpQ)
      cart.root.position.copy(group.position).add(tmpA)
      cart.root.quaternion.copy(tmpQ)
      rattle += dt * (8 + speed * 0.6)
      const shakeAmt = Math.min(0.035, speed * 0.0009)
      cart.body.position.y = Math.abs(Math.sin(rattle * 3.1)) * shakeAmt
      cart.body.rotation.z = Math.sin(rattle * 2.3) * shakeAmt * 0.8
      wheelSpin += (speed / 0.17) * dt
      spinWheels(wheelSpin)
    },
    // The rider is thrown: the cart goes loose with velocity v (world) and a forward flip.
    eject(v) {
      if (!cart || mode !== 'ride') return
      mode = 'loose'
      vel.copy(v)
      vel.y = Math.max(vel.y, 2.5 + Math.min(4, v.length() * 0.06))
      rot.setFromQuaternion(cart.root.quaternion, 'YXZ')
      // nose-over: pitch forward (cart local +X tips the nose down when facing -Z)
      spin.set(3.5 + Math.min(9, v.length() * 0.18), Math.sign(v.x) * (1 + Math.random() * 2), -Math.sign(v.x) * (1 + Math.random() * 2.5))
      rest = 0
      cart.body.position.set(0, 0, 0)
      cart.body.rotation.set(0, 0, 0)
    },
    remove() {
      for (const o of [cart, gate]) {
        if (!o) continue
        scene.remove(o.root)
        dispose(o.root)
      }
      cart = gate = null
      mode = 'none'
      gPhase = 'none'
    },
    poofCart() {
      if (!cart) return null
      const p = cart.root.position.clone()
      scene.remove(cart.root)
      dispose(cart.root)
      cart = null
      mode = 'none'
      return p
    },
    // Returns an event on the frame something happens: 'landed' (gate up + cart down), 'vanishing', 'gone'.
    update(dt) {
      let event = null
      if (gate) {
        gT += dt
        if (gPhase === 'summon') {
          const k = Math.min(1, gT / CART.summon)
          gate.root.scale.setScalar(Math.max(0.001, easeOutBack(k)))
          gate.root.position.y = CHANNEL.surfaceY - (1 - k) * 1.2
          gate.posts.forEach((p, i) => (p.rotation.y = (1 - easeOut(k)) * Math.PI * (i ? 1 : -1)))
          if (k >= 1) {
            gPhase = 'ready'
            gate.posts.forEach((p) => (p.rotation.y = 0))
            event = 'landed'
          }
        } else if (gPhase === 'linger' && gT >= CART.linger) {
          gPhase = 'vanish'
          gT = 0
          event = 'vanishing'
        } else if (gPhase === 'vanish') {
          const k = Math.min(1, gT / CART.vanish)
          const s = k < 0.25 ? 1 + k * 0.5 : 1.12 * (1 - (k - 0.25) / 0.75)
          gate.root.scale.setScalar(Math.max(0.001, s))
          gate.root.rotation.y = k * Math.PI
          if (k >= 1) {
            scene.remove(gate.root)
            dispose(gate.root)
            gate = null
            event = 'gone'
          }
        }
        if (gate) {
          if (springing) {
            bandV += (-260 * band - 7 * bandV) * dt
            band += bandV * dt
            if (Math.abs(band) < 0.003 && Math.abs(bandV) < 0.03) {
              springing = false
              band = bandV = 0
            }
          }
          wobble *= Math.exp(-3.2 * dt)
          gate.posts.forEach((p, i) => {
            p.rotation.x = Math.sin(gT * 17) * wobble * 0.12
            p.rotation.z = Math.sin(gT * 15 + i) * wobble * 0.05 * (i ? 1 : -1)
          })
          layoutBand()
        }
      }
      if (!cart) return event
      elapsed += dt
      cart.tick?.(dt, elapsed)
      squash = Math.max(0, squash - dt * 4)
      if (mode === 'gate') {
        // falls in from above with a bounce, then sits; pull draws it back toward +Z (south)
        dropT += dt
        const k = Math.min(1, dropT / 0.45)
        const g = gate?.root.position
        if (g) {
          const fallY = k < 1 ? 6 * (1 - k * k) : 0
          cart.root.position.set(g.x, CHANNEL.surfaceY + fallY, g.z + 1.45 + pull * FLIGHT.pullBack)
          if (k >= 1 && dropT - dt < 0.45) {
            squash = 1
            onImpact?.(0.7, cart.root.position, 'drop')
          }
          cart.root.rotation.set(-pull * 0.08, Math.PI, 0)
          spinWheels(-pull * 9)
        }
        const sq = Math.sin(squash * Math.PI) * 0.12 * squash
        cart.body.scale.set(1 + sq, 1 - sq * 1.4, 1 + sq)
      } else if (mode === 'ride') {
        const sq = Math.sin(squash * Math.PI) * 0.1 * squash
        cart.body.scale.set(1 + sq, 1 - sq * 1.4, 1 + sq)
      } else if (mode === 'loose') {
        cart.body.scale.set(1, 1, 1)
        const p = cart.root.position
        vel.y -= CART.gravity * dt
        p.addScaledVector(vel, dt)
        rot.x += spin.x * dt
        rot.z += spin.z * dt
        rot.y += spin.y * dt
        cart.root.quaternion.setFromEuler(rot)
        // lowest of the cart's box corners
        let minY = Infinity
        const h = cart.half
        for (const sx of [-1, 1]) for (const sy of [0, 1]) for (const sz of [-1, 1]) {
          tmpA.set(sx * h.x, sy * h.y, sz * h.z).applyQuaternion(cart.root.quaternion)
          if (tmpA.y < minY) minY = tmpA.y
        }
        const floor = CHANNEL.surfaceY
        if (p.y + minY < floor) {
          p.y = floor - minY
          if (vel.y < 0) {
            const hit = -vel.y
            if (hit > 1.2) onImpact?.(clamp(hit / 14, 0.15, 1.2), p, 'hit')
            vel.y = hit > 1.5 ? hit * CART.bounce : 0
            spin.multiplyScalar(0.55)
            spin.x += (Math.random() - 0.3) * Math.min(4, hit * 0.4)
          }
          const fr = Math.exp(-CART.friction * dt)
          vel.x *= fr
          vel.z *= fr
          spin.multiplyScalar(Math.exp(-2.5 * dt))
          // settle onto the nearest flat side once slow
          if (Math.hypot(vel.x, vel.z) < 2.5 && Math.abs(vel.y) < 0.5) {
            const snap = (a) => Math.round(a / (Math.PI / 2)) * (Math.PI / 2)
            const e = 1 - Math.exp(-5 * dt)
            rot.x += (snap(rot.x) - rot.x) * e
            rot.z += (snap(rot.z) - rot.z) * e
            spin.multiplyScalar(Math.exp(-6 * dt))
            rest += dt
          }
        }
        spinWheels(spin.x * dt * 2 + Math.hypot(vel.x, vel.z) * dt * 3, true)
        rot.x = rot.x % TAU
      }
      return event
    },
  }
}

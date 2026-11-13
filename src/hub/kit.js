import { AdditiveBlending, DoubleSide, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, Vector3 } from 'three'
import { HUB } from '../config.js'
import { RAPIER, addFixed } from '../physics.js'
import { yawQuat } from '../propkit.js'

// Shared helpers for the hub's builders: colliders, emitters, materials, placing, sign text.

export const C = HUB.colors

// Fixed box collider (half extents, optional yaw).
export function solid(hx, hy, hz, x, y, z, yaw = 0) {
  addFixed(RAPIER.ColliderDesc.cuboid(hx, hy, hz), { x, y, z }, yawQuat(yaw))
}
export function solidCylinder(r, h, x, z, y0 = 0) {
  addFixed(RAPIER.ColliderDesc.cylinder(h / 2, r), { x, y: y0 + h / 2, z })
}

// Ambient particle emitter, culled when the camera is far away.
export function emitAt(fx, x, y, z, opts) {
  return fx.emitter({ ...opts, x, y, z, cull: new Vector3(x, y, z) })
}

export const std = (color, extra) => new MeshStandardMaterial({ color, roughness: 0.55, metalness: 0, ...extra })
export const metal = (color, extra) => new MeshStandardMaterial({ color, roughness: 0.28, metalness: 0.8, ...extra })
export const glowMat = (color, intensity = 1.6, extra) => new MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.4, ...extra })
export const additive = (color, opacity = 0.7) => new MeshBasicMaterial({ color, transparent: true, opacity, blending: AdditiveBlending, depthWrite: false, side: DoubleSide })

export function put(parent, geo, mat, x = 0, y = 0, z = 0, shadow = true) {
  const m = new Mesh(geo, mat)
  m.position.set(x, y, z)
  m.castShadow = shadow
  m.receiveShadow = shadow
  parent.add(m)
  return m
}

// A placed group: position, yaw.
export function placed(parent, x, y, z, yaw = 0) {
  const g = new Group()
  g.position.set(x, y, z)
  g.rotation.y = yaw
  parent.add(g)
  return g
}

export const fmtWins = (n) => {
  if (n >= 1e9) return `${+(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `${+(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${+(n / 1e3).toFixed(1)}K`
  return `${n}`
}

// Rounded-rect path on a 2D canvas context.
export function rrect(g, x, y, w, h, r) {
  g.beginPath()
  g.roundRect(x, y, w, h, r)
}

// Outlined text on a canvas (shared by the painted signs).
export function outlined(g, text, x, y, { size = 48, fill = '#ffffff', stroke = '#1b1f2e', width = 0.18, weight = 700, align = 'center' } = {}) {
  g.font = `${weight} ${size}px Fredoka, "Arial Black", sans-serif`
  g.textAlign = align
  g.textBaseline = 'middle'
  g.lineJoin = 'round'
  g.lineWidth = Math.max(3, size * width)
  g.strokeStyle = stroke
  g.strokeText(text, x, y)
  g.fillStyle = fill
  g.fillText(text, x, y)
}

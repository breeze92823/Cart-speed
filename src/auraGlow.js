import { AdditiveBlending, CanvasTexture, Color, DoubleSide, Group, Mesh, MeshBasicMaterial, RingGeometry, SRGBColorSpace, Sprite, SpriteMaterial } from 'three'

// The equipped aura (Inventory > Auras) drawn around the player: a soft column of light, two
// spinning floor rings and a few orbiting sparkles in the aura's colours. Rarer auras (bigger
// 1-in-n) glow brighter, spin faster and get more sparkles. Hidden while flying. ~9 draw calls.

let glowTex = null
function softDot() {
  if (glowTex) return glowTex
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  gr.addColorStop(0, 'rgba(255,255,255,1)')
  gr.addColorStop(0.35, 'rgba(255,255,255,0.55)')
  gr.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = gr
  g.fillRect(0, 0, 64, 64)
  glowTex = new CanvasTexture(c)
  glowTex.colorSpace = SRGBColorSpace
  return glowTex
}

const SPARKS = 6

export function createAuraGlow(scene) {
  const root = new Group()
  root.visible = false
  scene.add(root)
  const additive = (color, opacity) => ({ color, transparent: true, opacity, blending: AdditiveBlending, depthWrite: false })
  const column = new Sprite(new SpriteMaterial({ map: softDot(), ...additive('#ffffff', 0.35) }))
  column.scale.set(2.4, 4.2, 1)
  column.position.y = 1.4
  root.add(column)
  const rings = [0, 1].map((i) => {
    const m = new Mesh(new RingGeometry(i ? 1.2 : 0.85, i ? 1.42 : 1.12, 48, 1, 0, Math.PI * (i ? 1.4 : 1.7)).rotateX(-Math.PI / 2), new MeshBasicMaterial({ ...additive('#ffffff', 0.95), side: DoubleSide }))
    m.position.y = 0.08 + i * 0.04
    root.add(m)
    return m
  })
  const sparks = Array.from({ length: SPARKS }, () => {
    const s = new Sprite(new SpriteMaterial({ map: softDot(), ...additive('#ffffff', 0.9) }))
    s.scale.setScalar(0.32)
    root.add(s)
    return s
  })
  let enabled = false
  let tier = 0 // 0..1, from the aura's rarity
  let count = 0
  const tmp = new Color()

  return {
    // aura = an AURAS entry or null/undefined (none equipped)
    set(aura) {
      enabled = !!aura
      root.visible = enabled
      if (!aura) return
      tier = Math.min(1, Math.log10(aura.n) / 6)
      count = Math.round(2 + tier * (SPARKS - 2))
      const cols = aura.colors
      column.material.color.set(cols[0])
      column.material.opacity = 0.3 + tier * 0.35
      rings[0].material.color.set(cols[0])
      rings[1].material.color.set(cols[cols.length - 1])
      sparks.forEach((s, i) => {
        s.visible = i < count
        s.material.color.copy(tmp.set(cols[i % cols.length]))
      })
    },
    update(dt, t, pos, flying) {
      root.visible = enabled && !flying
      if (!root.visible) return
      root.position.set(pos.x, pos.y, pos.z)
      const spin = 0.8 + tier * 2.2
      rings[0].rotation.y = t * spin
      rings[1].rotation.y = -t * spin * 0.7
      const pulse = 1 + Math.sin(t * 3) * 0.06
      rings[0].scale.setScalar(pulse)
      column.scale.set(2.2 + tier * 0.8, (3.6 + tier * 1.6) * pulse, 1)
      for (let i = 0; i < count; i++) {
        const a = t * (1.2 + tier) + (i / count) * Math.PI * 2
        const r = 1.1 + Math.sin(t * 2 + i) * 0.15
        sparks[i].position.set(Math.cos(a) * r, 0.4 + ((t * 0.6 + i / count) % 1) * 2.4, Math.sin(a) * r)
      }
    },
  }
}

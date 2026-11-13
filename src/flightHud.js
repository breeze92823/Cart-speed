import './flightHud.css'
import { Vector3 } from 'three'
import { iconURL } from './icons.js'
import { fmtShort } from './props.js'

// DOM for the cart launch (driven by flight.js): the LAUNCH button, the big
// distance counter with the Skill picked up under it and the region name above it,
// "+N" pops that float up beside the player, the "+Wins / +Skill" reward over the
// player at the end and the fade back to the lobby. Kept apart from hud.js.

const fmt = (n) => Math.round(n).toLocaleString('en-US')
const h = (tag, cls, html) => {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (html != null) e.innerHTML = html
  return e
}

// Small region badges drawn on a canvas (both sides of the region name).
function regionIcon(kind, color) {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')
  g.lineJoin = g.lineCap = 'round'
  const ink = '#1b1f2e'
  const fs = (fill, w = 6) => {
    g.lineWidth = w
    g.strokeStyle = ink
    g.stroke()
    g.fillStyle = fill
    g.fill()
  }
  g.translate(32, 32)
  if (kind === 'snow') {
    for (let i = 0; i < 3; i++) {
      g.save()
      g.rotate((i * Math.PI) / 3)
      g.beginPath()
      g.rect(-4, -26, 8, 52)
      fs('#ffffff', 5)
      g.restore()
    }
    g.beginPath()
    g.arc(0, 0, 8, 0, 7)
    fs('#9fe3ff', 4)
  } else if (kind === 'comet') {
    g.beginPath()
    g.moveTo(-26, 26)
    g.quadraticCurveTo(-4, -2, 14, -22)
    g.lineTo(22, -10)
    g.quadraticCurveTo(0, 4, -26, 26)
    fs('#bfe9ff', 5)
    g.beginPath()
    g.arc(16, -16, 11, 0, 7)
    fs('#ffffff', 5)
  } else if (kind === 'bubble') {
    for (const [x, y, r] of [[-8, 6, 16], [14, -14, 9], [16, 16, 6]]) {
      g.beginPath()
      g.arc(x, y, r, 0, 7)
      fs('rgba(160,235,255,0.95)', 4)
    }
  } else if (kind === 'flame') {
    g.beginPath()
    g.moveTo(0, -28)
    g.bezierCurveTo(22, -6, 22, 26, 0, 26)
    g.bezierCurveTo(-22, 26, -22, -4, 0, -28)
    fs('#ff7a1f', 5)
    g.beginPath()
    g.moveTo(0, -6)
    g.bezierCurveTo(10, 6, 10, 20, 0, 20)
    g.bezierCurveTo(-10, 20, -10, 6, 0, -6)
    fs('#ffe46a', 3)
  } else if (kind === 'candy') {
    g.beginPath()
    g.arc(0, 0, 18, 0, 7)
    fs('#ffffff', 5)
    g.strokeStyle = '#ff5fa8'
    g.lineWidth = 6
    g.beginPath()
    g.arc(0, 0, 9, 0, 5)
    g.stroke()
  } else if (kind === 'sun') {
    for (let i = 0; i < 8; i++) {
      g.save()
      g.rotate((i * Math.PI) / 4)
      g.beginPath()
      g.moveTo(-6, -18)
      g.lineTo(0, -29)
      g.lineTo(6, -18)
      fs('#ffd23a', 4)
      g.restore()
    }
    g.beginPath()
    g.arc(0, 0, 15, 0, 7)
    fs('#ffe46a', 5)
  } else if (kind === 'planet') {
    g.beginPath()
    g.arc(0, 0, 16, 0, 7)
    fs('#c98cff', 5)
    g.beginPath()
    g.ellipse(0, 0, 29, 9, -0.35, 0, 7)
    g.lineWidth = 9
    g.strokeStyle = ink
    g.stroke()
    g.lineWidth = 4
    g.strokeStyle = '#6ff0ff'
    g.stroke()
  } else if (kind === 'house') {
    g.beginPath()
    g.rect(-18, -4, 36, 28)
    fs('#fff1d6', 5)
    g.beginPath()
    g.moveTo(-26, -2)
    g.lineTo(0, -26)
    g.lineTo(26, -2)
    g.closePath()
    fs('#e8452b', 5)
    g.beginPath()
    g.rect(-5, 8, 10, 16)
    fs('#7a3a22', 4)
  } else if (kind === 'church') {
    g.beginPath()
    g.rect(-14, -6, 28, 32)
    fs('#ffffff', 5)
    g.beginPath()
    g.moveTo(-18, -4)
    g.lineTo(0, -28)
    g.lineTo(18, -4)
    g.closePath()
    fs('#3a5a9a', 5)
    g.beginPath()
    g.rect(-5, 10, 10, 16)
    fs('#ffd23a', 4)
  } else if (kind === 'building') {
    g.beginPath()
    g.rect(-20, -26, 40, 52)
    fs('#c9d6e8', 5)
    g.fillStyle = '#3f78b0'
    for (let y = -18; y < 18; y += 11) for (const x of [-12, 4]) g.fillRect(x, y, 8, 6)
  } else if (kind === 'city') {
    for (const [x, y, w] of [[-26, -8, 16], [-10, -28, 18], [8, -16, 16]]) {
      g.beginPath()
      g.rect(x, y, w, 26 - y + 2)
      fs(color, 4)
    }
    g.fillStyle = '#ffffff'
    for (let y = -22; y < 24; y += 8) g.fillRect(-5, y, 7, 4)
  } else {
    g.beginPath()
    g.ellipse(0, 0, 14, 26, 0.6, 0, 7)
    fs(color, 5)
  }
  return c
}


const fmtPop = (n) => (typeof n === 'number' ? `+${fmtShort(n)}` : n)

export function createFlightHud(camera) {
  const root = h('div', 'fly-ui')
  document.body.appendChild(root)
  const boltImg = iconURL('bolt', 96)
  const trophyImg = iconURL('trophy', 192)

  // --- LAUNCH button (a green lego brick) ---
  const btn = h('button', 'fly-btn', `<span class="lbl">LAUNCH</span><span class="key">E</span>`)
  btn.dataset.silent = '' // flight.js plays its own sound on press
  root.appendChild(btn)
  let onFly = null
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (btn.classList.contains('on')) onFly?.()
  })
  // Sits just above the bottom bar (power / level), wherever that bar is.
  function placeButton() {
    const bar = document.querySelector('.hud-bottom')
    const r = bar?.getBoundingClientRect()
    const bottom = r && r.height ? window.innerHeight - r.top + Math.max(12, window.innerHeight * 0.025) : window.innerHeight * 0.3
    btn.style.bottom = `${Math.round(bottom)}px`
  }
  window.addEventListener('resize', placeButton)

  // --- Counter: distance, the Skill picked up this ride under it, region above ---
  const top = h('div', 'fly-top')
  const region = h('div', 'fly-region')
  const dist = h('div', 'fly-dist', '0 m')
  dist.dataset.text = '0 m'
  const pow = h('div', 'fly-pow', `<img src="${boltImg}" alt=""><span>+0</span>`)
  const best = h('div', 'fly-best stroke-d', 'NEW BEST!')
  top.append(region, dist, pow, best)
  root.appendChild(top)
  let shownDist = -1
  let shownPow = -1
  let regionKey = null

  const fade = h('div', 'fly-fade')
  document.body.appendChild(fade)

  // --- World-anchored pops (they follow the player on screen) ---
  const popLayer = h('div', 'fly-pops')
  root.appendChild(popLayer)
  const pops = []
  const proj = new Vector3()
  let rewardEls = []

  function addPop(el, o) {
    el.style.opacity = '0' // placed on the next update
    popLayer.appendChild(el)
    pops.push({ el, t: 0, life: o.life ?? 1.1, dx: o.dx ?? 0, dy: o.dy ?? 0, rise: o.rise ?? 7, height: o.height ?? 1.4, keep: !!o.keep })
  }

  return {
    // show = in the zone and able to launch; fn runs on press.
    showFly(show, fn) {
      if (fn) onFly = fn
      if (show === btn.classList.contains('on')) return
      if (show) placeButton()
      btn.classList.toggle('on', show)
    },
    flyVisible: () => btn.classList.contains('on'),
    setFlying(on) {
      document.body.classList.toggle('flying', on)
    },
    counter(on, d = 0) {
      top.classList.toggle('on', on)
      if (!on) {
        shownDist = -1
        return
      }
      const v = Math.floor(d)
      if (v !== shownDist) {
        if (Math.floor(v / 100) !== Math.floor(shownDist / 100) && shownDist >= 0) {
          dist.classList.remove('bump')
          void dist.offsetWidth
          dist.classList.add('bump')
        }
        shownDist = v
        dist.textContent = dist.dataset.text = `${fmt(v)} m`
      }
    },
    // The Skill picked up this ride (under the distance).
    power(n, bump) {
      const v = Math.round(n)
      if (v === shownPow) return
      shownPow = v
      pow.lastChild.textContent = `+${fmtShort(v)}`
      if (bump) {
        pow.classList.remove('bump')
        void pow.offsetWidth
        pow.classList.add('bump')
      }
    },
    // r = RIVER_REGIONS entry or null (hidden).
    region(r) {
      const key = r ? r.name : null
      if (key === regionKey) return
      regionKey = key
      region.classList.remove('on')
      if (!r) return
      region.innerHTML = ''
      region.style.color = r.color
      region.append(regionIcon(r.icon, r.color), h('span', null, r.name), regionIcon(r.icon, r.color))
      void region.offsetWidth
      region.classList.add('on')
    },
    best() {
      best.classList.remove('on')
      void best.offsetWidth
      best.classList.add('on')
    },
    // "+N" + bolt floating up beside the player. dx / dy in vmin from the anchor.
    pop(value, kind = 'bolt', o = {}) {
      const el = h('div', `fly-pop ${kind}`, `<span>${fmtPop(value)}</span><img src="${kind === 'trophy' ? trophyImg : boltImg}" alt="">`)
      addPop(el, o)
    },
    // The end of the ride: "+Wins" (trophy) counting up and "+Skill" (bolt) over the player.
    reward(wins, skill, onTick) {
      this.hideReward()
      const w = h('div', 'fly-pop reward trophy', `<span>+0</span><img src="${trophyImg}" alt="">`)
      addPop(w, { keep: true, height: 2.2, dy: -5, rise: 0 })
      rewardEls = [w]
      if (skill > 0) {
        const s = h('div', 'fly-pop reward2 bolt', `<span>${fmtPop(skill)}</span><img src="${boltImg}" alt="">`)
        addPop(s, { keep: true, height: 2.2, dy: 5, rise: 0 })
        rewardEls.push(s)
      }
      const n = w.firstChild
      const t0 = performance.now()
      const dur = 700
      let last = -1
      const tick = () => {
        if (!w.isConnected) return
        const k = Math.min(1, (performance.now() - t0) / dur)
        const v = Math.round(wins * (1 - Math.pow(1 - k, 3)))
        if (v !== last) {
          last = v
          n.textContent = `+${fmtShort(v)}`
          if (k < 1) onTick?.()
        }
        if (k < 1) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    },
    hideReward() {
      for (const el of rewardEls) {
        const p = pops.find((q) => q.el === el)
        if (!p) continue
        p.keep = false
        p.life = p.t + 0.3
        p.rise = 0
        el.classList.add('out')
      }
      rewardEls = []
    },
    clearPops() {
      for (const p of pops) p.el.remove()
      pops.length = 0
      rewardEls = []
    },
    // Every frame: place the pops over the player (at = feet, world space).
    update(dt, at) {
      if (!pops.length) return
      const vmin = Math.min(innerWidth, innerHeight) / 100
      for (let i = pops.length - 1; i >= 0; i--) {
        const q = pops[i]
        q.t += dt
        if (!q.keep && q.t >= q.life) {
          q.el.remove()
          pops.splice(i, 1)
          continue
        }
        proj.set(at.x, at.y + q.height, at.z).project(camera)
        if (proj.z > 1) {
          q.el.style.opacity = '0'
          continue
        }
        const k = q.keep ? 0 : Math.min(1, q.t / q.life)
        const x = (proj.x * 0.5 + 0.5) * innerWidth + q.dx * vmin
        const y = (-proj.y * 0.5 + 0.5) * innerHeight + q.dy * vmin - (1 - Math.pow(1 - k, 2)) * q.rise * vmin
        const s = q.t < 0.12 ? 0.4 + (q.t / 0.12) * 0.8 : q.t < 0.24 ? 1.2 - ((q.t - 0.12) / 0.12) * 0.2 : 1
        q.el.style.opacity = q.keep ? '1' : String(k > 0.7 ? Math.max(0, 1 - (k - 0.7) / 0.3) : 1)
        q.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%) scale(${s.toFixed(3)})`
      }
    },
    fade(on) {
      fade.classList.toggle('on', on)
    },
  }
}

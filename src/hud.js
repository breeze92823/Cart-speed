import './hud.css'
import { AREA_NAME, BOOSTS, EGGS, GEAR, LANE, PASSES, RARITY_COLORS, SKILL_PACKS, STAND_PETS } from './config.js'
import { iconURL, studURL } from './icons.js'
import { makeWindows, clock, setInvTab } from './windows.js'
import { gearIcon, gearWindow } from './gear.js'
import { sfx } from './audio/index.js'
import { fmtShort, buildEgg, buildSlingshot } from './props.js'
import { buildPet } from './petModels.js'
import { thumb } from './thumbs.js'
import {
  ALL_PETS,
  auraEvent,
  dailyClaimable,
  hasPass,
  levelInfo,
  petById,
  petLook,
  questById,
  questProgress,
  rebirthMult,
  rebirthProgress,
  state,
  friendBoost,
} from './state.js'

// All 2D UI: the always-on HUD (menu buttons, Power / Level bar, Wins, power packs, quests,
// passes, the Luck Event timer), toasts and number pops, the flight meter, the egg prompt, the
// windows (windows.js + Shop / Update Log / Gear) and the hatch overlay. Game logic lives in
// game.js and is reached through `actions`.

const fmt = (n) => Math.round(n).toLocaleString('en-US')
const h = (tag, cls, html) => {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (html != null) e.innerHTML = html
  return e
}
const ico = (name, size = 128) => `<img src="${iconURL(name, size)}" alt="">`
export const petThumb = (id, tier = '') => thumb(`pet:${id}:${tier}`, () => buildPet(petLook(id, tier)), 0.5)
export const eggThumb = (look) => thumb(`egg:${look}`, () => buildEgg(look), 0.4)
export const slingThumb = (style) => thumb(`sling:${style}`, () => buildSlingshot(style), 0.9)
// Quest row icons by kind, and reward icons.
const QUEST_ICON = { oneFlight: 'trail', flights: 'trail', hatched: 'paw', carts: 'cart', rolls: 'diceRoll', trains: 'bolt', dodges: 'star', chests: 'gift', rebirths: 'rebirth' }
const rewardIcon = (r) => (r.dice ? `dice${r.dice[0].toUpperCase()}${r.dice.slice(1)}` : BOOSTS[r.boost]?.icon ?? 'gift')

export function createHud(actions) {
  const root = h('div')
  root.id = 'hud'
  document.body.appendChild(root)
  document.documentElement.style.setProperty('--stud', `url(${studURL()})`)
  if (matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch')
  window.addEventListener('pointerdown', (e) => document.body.classList.toggle('touch', e.pointerType === 'touch'), { capture: true })

  // --- Left menu: the wide Shop button, then Pets / Rebirth / Trails / Inventory / Gifts / Auras ---
  const left = h('div', 'hud-left')
  const shopBtn = h('button', 'mbtn shop wide', `${ico('basket', 192)}<span class="lbl ol">Shop</span>`)
  shopBtn.addEventListener('click', () => openWindow('shop'))
  const grid = h('div', 'menu-grid')
  const menu = [
    ['pets', 'Pets', 'catface', () => openInventoryTab('pets')],
    ['rebirth', 'Rebirth', 'rebirth', () => openWindow('rebirth')],
    ['trails', 'Trails', 'trail', () => openWindow('trails')],
    ['inventory', 'Inventory', 'backpack', () => openWindow('inventory')],
    ['gifts', 'Gifts', 'gift', () => openWindow('playtime')],
    ['auras', 'Auras', 'aura', () => openWindow('auras')],
  ]
  const btn = {}
  for (const [id, label, icon, fn] of menu) {
    const b = h('button', `mbtn ${id}`, `${ico(icon, 160)}<span class="lbl ol">${label}</span>`)
    b.addEventListener('click', fn)
    grid.appendChild(b)
    btn[id] = b
  }
  const pct = h('span', 'pct ol-thin', '0%')
  btn.rebirth.appendChild(pct)
  const badge = h('span', 'badge ol-thin', '0')
  btn.gifts.appendChild(badge)
  left.append(shopBtn, grid)
  root.appendChild(left)
  // Flight Gear beside the menu
  const sideCol = h('div', 'hud-side')
  const sideBtn = {}
  for (const [id, label] of [['gear', 'Gear']]) {
    const b = h('button', 'side-btn', `<img src="${gearIcon('shield')}" alt=""><span class="lbl ol">${label}</span><span class="dot ol-thin">!</span>`)
    b.addEventListener('click', () => openWindow(id))
    sideCol.appendChild(b)
    sideBtn[id] = b
  }
  // Flight Gear only softens the lane animals: hidden while they are switched off
  if (!LANE.enabled) sideCol.style.display = 'none'
  root.appendChild(sideCol)

  // --- Bottom-left: Friend Boost line + Wins ---
  const stats = h('div', 'hud-stats')
  const friend = h('div', 'friend ol-thin', `Friend Boost +0% ${ico('plus', 48)}`)
  friend.title = 'Invite friends for +Power'
  friend.addEventListener('click', () => openWindow('invite'))
  const winStat = h('div', 'stat wins', `${ico('trophy')}<span class="ol">0</span>`)
  stats.append(friend, winStat)
  root.appendChild(stats)

  // --- Bottom centre: Power + multiplier, Level bar, power packs ---
  const bottom = h('div', 'hud-bottom')
  const skillrow = h('div', 'skillrow')
  const skillEl = h('div', 'skill ol', `${ico('bolt')}<span>0 POWER</span>`)
  const multEl = h('div', 'mult ol', 'x1 Multiplier')
  skillrow.append(skillEl, multEl)
  const bar = h('div', 'levelbar', '<div class="fill"></div><div class="txt ol"><span class="lv">Level 1</span><span class="xp">0 / 0</span></div>')
  const lvTxt = bar.querySelector('.lv')
  const xpTxt = bar.querySelector('.xp')
  const packs = h('div', 'packs')
  for (const p of SKILL_PACKS) {
    const b = h('button', `pack ${p.style}`, `<img class="pb" src="${iconURL('bolt', 128)}" alt=""><span class="amt ol">+${fmtShort(p.amount)}</span><span class="price ol-thin">${ico('trophy', 48)}${fmtShort(p.price)}</span>`)
    b.addEventListener('click', () => actions.buyPack(p.id))
    packs.appendChild(b)
  }
  bottom.append(skillrow, bar, packs)
  root.appendChild(bottom)

  // --- Right side: quests, starter pack, passes, Luck Event ---
  const right = h('div', 'hud-right')
  const quests = h('div', 'hud-quests')
  const qHead = h('button', 'q-head', `${ico('scroll', 96)}<span class="ol">QUESTS</span><span class="q-n ol">0/3</span><span class="q-arrow ol">▼</span>`)
  const qList = h('div', 'q-list')
  // collapsed by default on phones (portrait, or short landscape where it would cover the TRAIN button)
  let questsOpen = !matchMedia('(orientation: portrait) and (max-width: 820px), (max-height: 520px)').matches
  qHead.addEventListener('click', () => {
    questsOpen = !questsOpen
    questKey = ''
    renderQuests()
  })
  quests.append(qHead, qList)
  const starter = h('button', 'starter', `${ico('starter', 192)}<span class="lbl ol-thin">STARTER PACK<br><small>ONLY ${ico('trophy', 48)}${fmtShort(PASSES.find((p) => p.id === 'starter').price)}</small></span>`)
  starter.addEventListener('click', () => openWindow('shop'))
  const passSkill = h('button', 'pass skill', `<img class="ic" src="${iconURL('bolt')}" alt=""><span class="t ol">+2x POWER</span><span class="p ol-thin"></span>`)
  const passWins = h('button', 'pass wins', `<img class="ic" src="${iconURL('trophy')}" alt=""><span class="t ol">2x WINS</span><span class="p ol-thin"></span>`)
  passSkill.addEventListener('click', () => actions.buyPass('skill2x'))
  passWins.addEventListener('click', () => actions.buyPass('wins2x'))
  const eventBox = h('button', 'luck-event', `${ico('diceCosmic', 128)}<span class="ev-t ol">NEXT EVENT</span><span class="ev-c ol">00:00</span>`)
  eventBox.title = 'Luck Event: x2 aura luck'
  eventBox.addEventListener('click', () => openWindow('auras'))
  right.append(starter, passSkill, passWins, eventBox)
  root.append(quests, right)

  // --- Top: area name, calendar (Daily Rewards), settings, update log ---
  const area = h('div', 'area-name ol-thin', `🏠 ${AREA_NAME}`)
  root.appendChild(area)
  const topright = h('div', 'topright')
  const calBtn = h('button', 'cal', `${ico('calendar', 128)}<span class="dot ol-thin">!</span>`)
  calBtn.setAttribute('aria-label', 'Daily Rewards')
  calBtn.addEventListener('click', () => openWindow('daily'))
  const gearBtn = h('button', 'gear', ico('gear', 96))
  gearBtn.setAttribute('aria-label', 'Settings')
  gearBtn.addEventListener('click', () => openWindow('settings'))
  const logBtn = h('button', 'pill', 'Update Log')
  logBtn.addEventListener('click', () => openWindow('log'))
  topright.append(logBtn, gearBtn, calBtn)
  root.appendChild(topright)

  // --- Overlays ---
  const toasts = h('div', 'toasts')
  const meter = h('div', 'flightmeter', `<div class="d ol">0m</div><div class="w ol-thin">${ico('trophy', 48)}<span>+0</span></div>`)
  const prompt = h('div', 'prompt')
  const trainBtn = h('button', 'trainbtn', `${ico('bolt')}<span class="ol-thin">TRAIN</span>`)
  trainBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    actions.trainHold(true)
  })
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) trainBtn.addEventListener(ev, () => actions.trainHold(false))
  const boostRow = h('div', 'boost-row')
  root.append(toasts, meter, prompt, trainBtn, boostRow)

  // --- Windows ---
  // windows.css: the dark slate frame (icon, floating title, red X) or the studded `head: 'bar'`
  // frame. Shop and Update Log keep their card layouts inside the same frame.
  const back = h('div', 'win-back')
  back.addEventListener('pointerdown', (e) => {
    if (e.target === back) closeWindow()
  })
  // a tap anywhere else in a window closes an open tooltip
  back.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' && !e.target.closest('[data-tip="1"]')) back.querySelector('.rw-tip')?.remove()
  }, true)
  document.body.appendChild(back)
  let openId = null
  let tickers = []
  const NEW = makeWindows({ actions, petThumb, eggThumb, slingThumb })
  const WINDOWS = {
    ...NEW.windows,
    gear: { iconSrc: gearIcon('shield'), ...gearWindow({ toast: (text, color) => toast(text, color) }) },
    shop: { title: 'Shop', icon: 'basket', size: 'lg', render: (api) => renderShop(legacy(api)) },
    log: { title: 'Update Log', icon: 'book', size: 'md', render: (api) => renderLog(legacy(api)) },
  }
  function legacy(api) {
    const b = h('div', 'rw-legacy')
    b.dataset.keep = 'y'
    api.body.appendChild(b)
    return b
  }
  let frame = null // { wrap, body, side, below, count, title, icon }
  function api() {
    return {
      wrap: frame.wrap,
      body: frame.body,
      side: frame.side,
      below: frame.below,
      setCount: (t) => (frame.count.innerHTML = t),
      setTitle: (t, icon) => {
        frame.title.textContent = t
        if (icon) frame.icon.src = iconURL(icon, 192)
      },
      onTick: (fn) => tickers.push(fn),
      refresh: refreshWindow,
    }
  }
  function build(id, still = false) {
    const w = WINDOWS[id]
    back.innerHTML = ''
    tickers = []
    const wrap = h('div', `rw-wrap w-${id} ${w.size ?? 'md'} ${w.side ? 'side' : ''} ${w.head === 'bar' ? 'head-bar' : ''} ${still ? 'still' : ''}`)
    const icon = h('img', 'rw-icon')
    icon.alt = ''
    icon.draggable = false
    if (w.iconSrc || w.icon) icon.src = w.iconSrc ?? iconURL(w.icon, 192)
    else icon.style.display = 'none'
    const win = h('div', 'rw')
    const head = h('div', 'rw-head')
    const title = h('span', 'rw-title o', w.title)
    const count = h('span', 'rw-count o')
    const close = h('button', 'rw-x')
    close.setAttribute('aria-label', 'Close')
    close.addEventListener('click', closeWindow)
    head.append(title, count, close)
    const body = h('div', 'rw-body')
    win.append(head, body)
    const side = h('div', 'rw-side')
    const below = h('div', 'rw-below')
    wrap.append(win, icon, side, below)
    back.appendChild(wrap)
    frame = { wrap, body, side, below, count, title, icon }
    w.render(api())
  }
  function openWindow(id) {
    if (!WINDOWS[id]) return
    if (openId === id) return closeWindow()
    const was = openId
    openId = id
    build(id)
    back.classList.add('on')
    document.body.classList.add('win-open')
    if (!was) sfx.windowOpen()
    else sfx.tab()
    actions.windowOpened?.(true)
  }
  function openInventoryTab(tab) {
    setInvTab(tab)
    if (openId === 'inventory') refreshWindow()
    else openWindow('inventory')
  }
  function closeWindow() {
    if (!openId) return
    openId = null
    tickers = []
    document.body.classList.remove('win-open')
    sfx.windowClose()
    const wrap = back.querySelector('.rw-wrap')
    wrap?.classList.add('closing')
    setTimeout(() => {
      if (openId) return
      back.classList.remove('on')
      back.innerHTML = ''
    }, 130)
    actions.windowOpened?.(false)
  }
  // Re-render the open window, keeping the scroll positions of its [data-keep] areas.
  function refreshWindow() {
    if (!openId || !frame) return
    const keep = [...back.querySelectorAll('[data-keep]')].map((el) => [el.className, el.scrollTop, el.scrollLeft])
    build(openId, true)
    for (const [cls, top, left] of keep) {
      const el = [...back.querySelectorAll('[data-keep]')].find((e) => e.className === cls)
      if (el) {
        el.scrollTop = top
        el.scrollLeft = left
      }
    }
  }
  function tickWindow() {
    for (const fn of tickers) fn()
  }
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && openId) closeWindow()
  })

  function card({ img, name, meta, metaIcon, tag, tagColor, button, cls = '' }) {
    const c = h('div', `card ${cls}`)
    c.innerHTML = `${img ? `<img class="thumb" src="${img}" alt="">` : ''}<div class="name">${name}</div>${meta ? `<div class="meta">${metaIcon ? ico(metaIcon, 48) : ''}${meta}</div>` : ''}`
    if (tag) {
      const t = h('span', 'tag', tag)
      t.style.background = tagColor
      c.appendChild(t)
    }
    if (button) c.appendChild(button)
    return c
  }
  function button(text, color, fn, disabled = false) {
    const b = h('button', `btn ${color} ol-thin`, text)
    b.style.color = '#fff'
    b.disabled = disabled
    b.addEventListener('click', fn)
    return b
  }

  function renderShop(body) {
    body.appendChild(h('div', 'sub', 'Passes'))
    const g1 = h('div', 'grid')
    for (const p of PASSES) {
      const owned = hasPass(p.id)
      g1.appendChild(
        card({
          img: iconURL(p.id === 'skill2x' ? 'bolt' : p.id === 'wins2x' ? 'trophy' : p.id === 'petslot' ? 'bag' : 'starter', 192),
          name: p.name,
          meta: p.desc,
          button: owned ? button('Owned', 'grey', () => {}, true) : button(`${ico('trophy', 48)} ${fmtShort(p.price)}`, 'green', () => actions.buyPass(p.id)),
        }),
      )
    }
    body.appendChild(g1)
    body.appendChild(h('div', 'sub', 'Power Packs'))
    const g2 = h('div', 'grid')
    for (const p of SKILL_PACKS) {
      g2.appendChild(card({ img: iconURL('bolt', 192), name: `+${fmt(p.amount)} Power`, meta: 'Instant Power boost', button: button(`${ico('trophy', 48)} ${fmtShort(p.price)}`, 'blue', () => actions.buyPack(p.id)) }))
    }
    body.appendChild(g2)
    body.appendChild(h('div', 'sub', 'Limited Pets'))
    const g3 = h('div', 'grid')
    for (const sp of STAND_PETS) {
      const owned = state.pets.some((p) => p.id === sp.id)
      g3.appendChild(card({ img: petThumb(sp.id), name: sp.name, meta: `x${fmt(sp.boost + 1)} Power`, tag: sp.rarity, tagColor: '#ff4f8b', button: button(owned ? 'Buy again' : `${ico('trophy', 48)} ${fmtShort(sp.price)}`, 'gold', () => actions.buyStand(sp.id)) }))
    }
    body.appendChild(g3)
  }

  function renderLog(body) {
    body.innerHTML = `<div class="sub">Auras Update</div><ul class="loglist">
      <li><b>Auras!</b> Roll for 20 auras (Dust 1 in 2 up to Big Bang 1 in 1,000,000). Each one multiplies your Power and Wins. Gold, Diamond and Cosmic dice roll with x100 / x1,000 / x10,000 luck. Auto Roll and the x2 / x3 Luck upgrades are bought with Wins.</li>
      <li>A <b>Luck Event</b> every 20 minutes: x2 aura luck for 3 minutes (the NEXT EVENT box).</li>
      <li><b>Quests</b>: three at a time, each pays a potion or a Gold Die.</li>
      <li>New Inventory: My Pets (Lock, Fuse 3 into Golden / Diamond, Fuse All), My Auras, My Carts (each cart adds +FLY distance) and My Potions (Power / Wins / Luck, 3-packs for Wins).</li>
      <li>12 new cart-shop Trails, the Lucky Clover Trail on Daily day 7 and the Lucky Cat on day 2.</li>
      <li>Rebirth milestones: the Milestone Dragon at Rebirth 5 is always +100% better than your best pet.</li></ul>
      <div class="sub">Launch Update</div><ul class="loglist">
      <li>Walk onto the yellow <b>LAUNCH ZONE</b> and press <b>LAUNCH</b>: the bungee shoots your cart up into the sky, over the power lines for Power, then it crashes back onto the road and throws you out. More Power = longer flights = more Wins.</li>
      <li>Ten carts in the Cart Shop: step on a pad (or use My Carts) to buy or equip one.</li>
      <li>Power treadmills multiply your training: unlock them with Rebirths or Wins.</li>
      <li>Six eggs with ${ALL_PETS.length} pets to collect (Golden and Diamond ones too), plus limited pets.</li>
      <li>Everything is bought with Wins. Coming next: World 2 (needs 600M Power).</li></ul>
      <div class="sub">Controls</div><ul class="loglist">
      <li>WASD / joystick to move, Space to jump, Shift to sprint.</li>
      <li>Click or E (desktop) / TRAIN button (touch) to train.</li>
      <li>While flying: A/D or the joystick steers.</li>
      <li>E / F: hatch 1 or 3 eggs when standing at an egg. Esc closes a window.</li></ul>`
  }

  // --- Quests panel ---
  let questKey = ''
  function renderQuests() {
    const prog = state.quests.map((q) => [q, questProgress(q)])
    const key = `${questsOpen}|${prog.map(([q, p]) => `${q.id}:${p.n}`).join(',')}`
    if (key === questKey) return
    questKey = key
    qHead.querySelector('.q-n').textContent = `${prog.filter(([, p]) => p.done).length}/${prog.length}`
    qHead.querySelector('.q-arrow').textContent = questsOpen ? '▼' : '▲'
    quests.classList.toggle('closed', !questsOpen)
    qList.innerHTML = ''
    if (!questsOpen) return
    for (const [q, p] of prog) {
      const d = questById(q.id)
      const unit = d.kind === 'oneFlight' ? ' m' : ''
      const row = h('button', `q-row ${p.done ? 'done' : ''}`)
      row.innerHTML = `${ico(QUEST_ICON[d.kind] ?? 'star', 96)}<div class="q-mid"><div class="q-t ol-thin">${d.text}</div><div class="q-bar"><div style="width:${(p.n / p.goal) * 100}%"></div><span class="ol-thin">${p.done ? 'CLAIM!' : `${fmt(p.n)} / ${fmt(p.goal)}${unit}`}</span></div></div><div class="q-rw"><img src="${iconURL(rewardIcon(d.reward), 96)}" alt=""><span class="ol-thin">x${d.reward.n ?? 1}</span></div>`
      row.addEventListener('click', () => (p.done ? actions.claimQuest(q.id) : null))
      qList.appendChild(row)
    }
  }

  // --- Live HUD values ---
  let lastLevel = -1
  function update() {
    const lv = levelInfo()
    skillEl.lastChild.textContent = `${fmtShort(state.skill)} POWER`
    multEl.textContent = `x${fmt(rebirthMult())} Multiplier`
    bar.firstChild.style.width = `${lv.progress * 100}%`
    lvTxt.textContent = `Level ${fmt(lv.level)}`
    xpTxt.textContent = `${fmtShort(lv.into)} / ${fmtShort(lv.need)}`
    winStat.lastChild.textContent = fmtShort(state.wins)
    // Friend Boost (bottom left): +% Power from friends who joined through our invites; tap to invite more.
    const fb = Math.round(friendBoost() * 100)
    if (friend.dataset.fb !== String(fb)) {
      friend.dataset.fb = String(fb)
      friend.innerHTML = `Friend Boost +${fb}% ${ico('plus', 48)}`
    }
    pct.textContent = `${Math.floor(rebirthProgress() * 100)}%`
    for (const [el, id] of [[passSkill, 'skill2x'], [passWins, 'wins2x']]) {
      const own = hasPass(id)
      el.classList.toggle('owned', own)
      const html = own ? 'OWNED' : `ONLY ${ico('trophy', 48)}${fmtShort(PASSES.find((p) => p.id === id).price)}`
      if (el.lastChild.dataset.h !== html) {
        el.lastChild.dataset.h = html
        el.lastChild.innerHTML = html
      }
    }
    starter.style.display = hasPass('starter') ? 'none' : ''
    if (openId === 'rebirth' && lv.level !== lastLevel) refreshWindow()
    lastLevel = lv.level
    calBtn.classList.toggle('alert', dailyClaimable().length > 0)
    sideBtn.gear.classList.toggle('alert', GEAR.some((g) => (g.prices[state.gear?.[g.id] ?? 0] ?? Infinity) <= state.wins))
    document.body.classList.toggle('hide-hud', !!state.settings.hideHud)
    renderBoosts()
    renderQuests()
  }
  function setBadge(n) {
    badge.textContent = String(n)
    badge.style.display = n > 0 ? '' : 'none'
  }
  // Active boost potions: chips at the top with the time left (tap = open My Potions).
  let boostKey = ''
  function renderBoosts() {
    const active = Object.keys(BOOSTS).filter((k) => state.boostLeft[k] > 0)
    const key = active.join(',')
    if (key !== boostKey) {
      boostKey = key
      boostRow.innerHTML = ''
      for (const k of active) {
        const c = h('button', 'boost-chip', `${ico(BOOSTS[k].icon, 96)}<span class="ol-thin">x${BOOSTS[k].mult}</span><span class="t ol-thin"></span>`)
        c.dataset.k = k
        c.style.setProperty('--c', BOOSTS[k].color)
        c.addEventListener('click', () => openInventoryTab('potions'))
        boostRow.appendChild(c)
      }
    }
    for (const c of boostRow.children) c.querySelector('.t').textContent = clock(state.boostLeft[c.dataset.k])
  }
  // The Luck Event box: time to the next one, or the time left of the running one.
  function renderEvent() {
    const ev = auraEvent()
    eventBox.classList.toggle('on', ev.on)
    eventBox.children[1].textContent = ev.on ? `LUCK x${ev.mult}!` : 'NEXT EVENT'
    eventBox.children[2].textContent = clock(ev.on ? ev.left : ev.next)
  }
  // Once a second from game.js: window timers, boost chips, the event box.
  function tick() {
    tickWindow()
    renderBoosts()
    renderEvent()
  }
  renderEvent()

  function toast(text, color = '#ffffff') {
    const t = h('div', 'toast ol', text)
    t.style.color = color
    toasts.appendChild(t)
    setTimeout(() => t.remove(), 2400)
    while (toasts.children.length > 4) toasts.firstChild.remove()
  }
  function pop(text, color = '#5fe0ff', x = 50, y = 46) {
    const p = h('div', 'pop ol', text)
    p.style.color = color
    p.style.left = `${x + (Math.random() - 0.5) * 8}%`
    p.style.top = `${y + (Math.random() - 0.5) * 6}%`
    root.appendChild(p)
    setTimeout(() => p.remove(), 1000)
  }
  function flight(on, dist = 0, wins = 0) {
    meter.classList.toggle('on', on)
    if (on) {
      meter.firstChild.textContent = `${fmt(dist)}m`
      meter.lastChild.lastChild.textContent = `+${fmtShort(wins)}`
    }
  }
  function result(dist, wins, tokens) {
    const r = h('div', 'result', `<div class="big ol">${ico('trophy')}+${fmtShort(wins)}</div><div class="small ol">${fmt(dist)}m flight${tokens ? ` · +${tokens} Race Token` : ''}</div>`)
    root.appendChild(r)
    setTimeout(() => r.remove(), 1800)
  }

  // Egg prompt: shown while standing at an egg.
  let promptKey = null
  function showEggPrompt(egg) {
    const key = egg ? egg.id : null
    if (key === promptKey) return
    promptKey = key
    prompt.classList.toggle('on', !!egg)
    if (!egg) return
    prompt.innerHTML = ''
    const c = h('div', 'pcard')
    for (const p of egg.pets) {
      const seen = state.discovered.includes(p.id)
      const el = h('div', `pet ${seen ? '' : 'locked'}`, `<img src="${petThumb(p.id)}" alt=""><div class="ol-thin" style="color:${RARITY_COLORS[p.rarity]}">${p.chance}%</div>`)
      c.appendChild(el)
    }
    const row = h('div', 'row')
    const priceTxt = egg.currency === 'tokens' ? `${egg.price} ${ico('token', 48)}` : `${ico('trophy', 48)} ${fmtShort(egg.price)}`
    row.appendChild(button(`Hatch 1<small>${priceTxt} · E</small>`, 'green', () => actions.hatch(egg.id, 1)))
    row.appendChild(button(`Hatch 3<small>${egg.currency === 'tokens' ? `${egg.price * 3} ${ico('token', 48)}` : `${ico('trophy', 48)} ${fmtShort(egg.price * 3)}`} · F</small>`, 'blue', () => actions.hatch(egg.id, 3)))
    prompt.append(h('div', 'ol', `<span style="font-size:clamp(16px,3vmin,28px)">${egg.name}</span>`), c, row)
  }
  function refreshPrompt() {
    const k = promptKey
    promptKey = null
    showEggPrompt(EGGS.find((e) => e.id === k) ?? null)
  }
  // Generic buy prompt (locked tables, limited pets): { key, title, text, img, price, onBuy } or null.
  function showBuy(info) {
    const key = info ? `buy:${info.key}` : null
    if (key === promptKey) return
    if (!info && promptKey && !promptKey.startsWith('buy:')) return
    promptKey = key
    prompt.classList.toggle('on', !!info)
    if (!info) return
    prompt.innerHTML = ''
    prompt.appendChild(h('div', 'ol', `<span style="font-size:clamp(16px,3vmin,28px)">${info.title}</span>`))
    if (info.img || info.text) {
      const c = h('div', 'pcard', `${info.img ? `<div class="pet"><img src="${info.img}" alt=""></div>` : ''}<div class="hint" style="max-width:40vmin;align-self:center">${info.text ?? ''}</div>`)
      prompt.appendChild(c)
    }
    if (info.onBuy) {
      const row = h('div', 'row')
      row.appendChild(button(`Buy<small>${ico('trophy', 48)} ${fmtShort(info.price)} · E</small>`, 'gold', info.onBuy))
      prompt.appendChild(row)
    }
    // A rewarded ad (Free Rewards Chest): { onAd, adText }.
    if (info.onAd) {
      const row = h('div', 'row')
      row.appendChild(button(`Watch Ad<small>▶ ${info.adText} · E</small>`, 'gold', info.onAd))
      prompt.appendChild(row)
    }
  }

  // Hatch overlay: eggs shake, flash, then the pets pop out.
  const hatchEl = h('div', 'hatch')
  document.body.appendChild(hatchEl)
  let hatchBusy = false
  function hatchAnim(egg, petIds, done) {
    hatchBusy = true
    hatchEl.innerHTML = ''
    const stage = h('div', 'stage')
    const slots = petIds.map(() => {
      const s = h('div', 'slot', `<img class="egg" src="${eggThumb(egg.look)}" alt="">`)
      stage.appendChild(s)
      return s
    })
    hatchEl.appendChild(stage)
    hatchEl.classList.add('on')
    setTimeout(() => {
      hatchEl.appendChild(h('div', 'flash'))
      slots.forEach((s, i) => {
        const p = petById(petIds[i])
        s.innerHTML = `<img class="pet" src="${petThumb(p.id)}" alt=""><div class="nm ol">${p.name}</div><div class="rr ol-thin" style="color:${RARITY_COLORS[p.rarity]}">${p.rarity} · +${fmt(p.boost * 100)}%</div>`
      })
      done?.()
    }, 1300)
    setTimeout(() => {
      hatchEl.classList.remove('on')
      hatchBusy = false
    }, 3300)
  }
  hatchEl.addEventListener('pointerdown', () => {
    if (hatchEl.querySelector('.pet')) {
      hatchEl.classList.remove('on')
      hatchBusy = false
    }
  })

  return {
    update,
    tick,
    setBadge,
    toast,
    pop,
    flight,
    result,
    showEggPrompt,
    showBuy,
    refreshPrompt,
    hatchAnim,
    isHatching: () => hatchBusy,
    openWindow,
    openInventoryTab,
    // An aura roll (buttons or Auto Roll): the Auras window shuffles, then shows it.
    auraRolled(res, spin = 750) {
      if (openId === 'auras') NEW.showRoll(res, spin)
    },
    closeWindow,
    refreshWindow,
    isWindowOpen: () => !!openId,
    get openId() {
      return openId
    },
  }
}

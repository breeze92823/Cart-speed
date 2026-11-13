import './windows.css'
import {
  AURAS,
  AURA_PASSES,
  AURA_ROLLS,
  BOOSTS,
  DAILY,
  EGGS,
  FRIEND_BOOST,
  GAME_SETTINGS,
  INDEX_LUCK,
  LIMITED_PETS,
  PET_TIERS,
  PLAYTIME,
  RARITY_COLORS,
  REBIRTH_MILESTONES,
  SLINGSHOTS,
  STAND_PETS,
  TITLES,
  TRAILS,
  skipRebirthPrice,
} from './config.js'
import { iconURL, studURL, trailCardURL } from './icons.js'
import { fmtShort } from './props.js'
import * as bloxity from './bloxity.js'
import { refreshInvites, sendInvited } from './net.js'
import {
  ALL_PETS,
  ALL_SLINGSHOTS,
  auraById,
  auraEvent,
  auraLuck,
  auraOdds,
  dailyClaimable,
  friendBoost,
  friends,
  hasPass,
  indexKey,
  indexLuck,
  levelInfo,
  msToNextDay,
  nextRebirthCost,
  nextSlotPrice,
  nextStoragePrice,
  petById,
  petPower,
  petSlots,
  petStorage,
  rebirthLevel,
  rebirthMult,
  slingById,
  state,
  tierById,
  titleById,
  titleOwned,
  titleStat,
  titleTarget,
  winsMult,
} from './state.js'

// The game's menu windows: a dark slate window with its icon at the top left, a big outlined
// title floating over the top edge and a red X (the Auras roller uses the studded "bar" header
// instead). Daily Rewards, Playtime Rewards, Trails, Inventory (My Pets / Auras / Carts / Potions /
// Titles), Auras (the roller), Settings, Rebirth, Index, Invite and the offline report. hud.js owns
// the frame (open / close / refresh); each window here renders into it through `api`:
//   api.body, api.side (tabs left of the window), api.below (bar under it),
//   api.setCount(text) (right side of the header), api.setTitle(text, icon), api.onTick(fn)
//   (every second), api.wrap (the positioned window wrapper, for tooltips), api.refresh().
// Game logic lives in game.js and is reached through `actions`.

const fmt = (n) => Math.round(n).toLocaleString('en-US')
const pct = (f) => `${Math.round(f * 100)}%`
export const h = (tag, cls, html) => {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (html != null) e.innerHTML = html
  return e
}
const ico = (name, size = 128, cls = '') => `<img class="${cls}" src="${iconURL(name, size)}" alt="" draggable="false">`
const img = (src, cls = '') => `<img class="${cls}" src="${src}" alt="" draggable="false">`
export function clock(s) {
  s = Math.max(0, Math.ceil(s))
  const hh = Math.floor(s / 3600)
  const mm = Math.floor((s % 3600) / 60)
  const ss = s % 60
  return hh ? `${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}
const twoDigitClock = (s) => {
  s = Math.max(0, Math.ceil(s))
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((x) => String(x).padStart(2, '0')).join(':')
}
const BONUS_ICON = { skill: 'bolt', wins: 'trophy', luck: 'clover' }
const BONUS_NAME = { skill: 'Power', wins: 'Wins', luck: 'Luck' }
function bonusText(bonus) {
  const [k, v] = Object.entries(bonus)[0]
  return `${ico(BONUS_ICON[k], 64, 'bi')}<span>• +${Math.round(v * 100)}% ${BONUS_NAME[k]}</span>`
}
function rbtn(text, color, fn, { disabled = false, cls = '' } = {}) {
  const b = h('button', `rb ${color} ${cls}`, `<span class="o">${text}</span>`)
  b.disabled = disabled
  b.addEventListener('click', (e) => {
    e.stopPropagation()
    fn?.()
  })
  return b
}
// Hover (mouse) or tap (touch) tooltip anchored over an element of the window.
function tooltip(api, el, build) {
  const show = () => {
    api.wrap.querySelector('.rw-tip')?.remove()
    const tip = h('div', 'rw-tip')
    build(tip)
    api.wrap.appendChild(tip)
    const w = api.wrap.getBoundingClientRect()
    const r = el.getBoundingClientRect()
    const tw = tip.offsetWidth
    const x = Math.max(0, Math.min(w.width - tw, r.left - w.left + r.width / 2 - tw / 2))
    tip.style.left = `${x}px`
    tip.style.top = `${Math.max(0, r.top - w.top + r.height * 0.42)}px`
  }
  const hide = () => api.wrap.querySelector('.rw-tip')?.remove()
  el.addEventListener('pointerenter', (e) => e.pointerType === 'mouse' && show())
  el.addEventListener('pointerleave', (e) => e.pointerType === 'mouse' && hide())
  el.addEventListener('click', () => (api.wrap.querySelector('.rw-tip') && el.dataset.tip === '1' ? (hide(), (el.dataset.tip = '')) : (show(), api.wrap.querySelectorAll('[data-tip]').forEach((n) => (n.dataset.tip = '')), (el.dataset.tip = '1'))))
}
// "1 in 1,000,000" (whole numbers; tiny odds below 1 in 2 read "1 in 1").
const oneIn = (n) => `1 in ${fmt(Math.max(1, n))}`
// Aura name in its colours (a gradient for multi-colour auras).
function auraName(a, cls = '') {
  const c = a.colors
  const style = c.length > 1 ? `background:linear-gradient(90deg,${c.join(',')});-webkit-background-clip:text;background-clip:text;color:transparent` : `color:${c[0]}`
  return `<span class="aname ${cls}" style="${style}">${a.name}</span>`
}
// The cart's ordered unlock rule (same as the shop pads): the previous cart must be owned first.
const cartLocked = (i) => i > 0 && !state.slingshots.includes(SLINGSHOTS[i - 1].id)
const PET_SORTS = ['best', 'rarity', 'new']
const RARITY_ORDER = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic', 'Secret']

// UI state that survives a refresh (tabs, selection, modes).
const ui = { invTab: 'pets', indexTab: '', title: null, deleting: false, pet: null, petSort: 'best', cart: null, oddsTab: 0, roll: null, spinUntil: 0 }
export const setInvTab = (t) => (ui.invTab = t)

export function makeWindows({ actions, petThumb, eggThumb, slingThumb }) {
  // --- Daily Rewards -------------------------------------------------------------------------
  function rewardLook(r) {
    if (r.boost) return { img: iconURL(BOOSTS[r.boost].icon, 192), label: `${r.n} ${BOOSTS[r.boost].short} POTION${r.n > 1 ? 'S' : ''}` }
    if (r.pet) return { img: petThumb(r.pet), label: petById(r.pet).name.toUpperCase() }
    if (r.trail) {
      const t = TRAILS.find((x) => x.id === r.trail)
      return { img: trailCardURL(t, 256), label: t.name.toUpperCase() }
    }
    return { img: '', label: '' }
  }
  function renderDaily(api) {
    const panel = h('div', 'daily')
    const unlocked = state.daily.unlocked
    DAILY.forEach((r, i) => {
      const claimed = state.daily.claimed.includes(i)
      const ready = i < unlocked && !claimed
      const look = rewardLook(r)
      const big = i === DAILY.length - 1
      const c = h('button', `dcard ${big ? 'd7' : ''} ${ready ? 'ready' : ''} ${claimed ? 'done' : ''}`)
      c.innerHTML = `<div class="dday o">DAY ${i + 1}</div>${big ? '<div class="lim o">Limited!</div>' : ''}<div class="dlbl o">${look.label}</div>${img(look.img, 'dimg')}`
      if (big) c.querySelector('.dimg').before(Object.assign(h('div', 'drays'), {}))
      if (ready) c.appendChild(h('div', 'dclaim o', 'Claim!'))
      if (claimed) c.insertAdjacentHTML('beforeend', ico('check', 192, 'dcheck'))
      c.addEventListener('click', () => ready && actions.claimDaily(i))
      panel.appendChild(c)
    })
    api.body.appendChild(panel)
    const next = h('div', 'rw-foot o')
    const tick = () => (next.textContent = dailyClaimable().length ? 'REWARDS READY TO CLAIM!' : `NEXT REWARD IN ${twoDigitClock(msToNextDay() / 1000)}`)
    tick()
    api.onTick(tick)
    api.below.appendChild(next)
  }

  // --- Playtime Rewards ----------------------------------------------------------------------
  function playLook(p) {
    if (p.skill) return { title: `+${fmtShort(p.skill * rebirthMult())} POWER`, img: iconURL('bolt', 192) }
    if (p.wins) return { title: `+${fmtShort(p.wins * rebirthMult())} WINS`, img: iconURL('trophy', 192) }
    if (p.egg) {
      const egg = EGGS.find((e) => e.id === p.egg)
      return { title: egg.name.toUpperCase(), img: eggThumb(egg.look) }
    }
    if (p.dice) return { title: `1 ${p.dice.toUpperCase()} DICE`, img: iconURL(`dice${p.dice[0].toUpperCase()}${p.dice.slice(1)}`, 192) }
    const b = BOOSTS[p.boost]
    return { title: `1 ${b.short} POTION`, img: iconURL(b.icon, 192) }
  }
  function renderPlaytime(api) {
    const panel = h('div', 'play')
    PLAYTIME.forEach((p, i) => {
      const claimed = state.claimedGifts.includes(i)
      const look = playLook(p)
      const row = i === PLAYTIME.length - 1 ? 'rainbow' : ['blue', 'purple', 'orange'][Math.floor(i / 4)] ?? 'orange'
      const t = h('button', `ptile ${row} ${claimed ? 'done' : ''}`)
      t.innerHTML = `<div class="pt o">${look.title}</div>${img(look.img, 'pimg')}`
      const b = rbtn('', 'grey', () => actions.claimPlaytime(i), { cls: 'pbtn' })
      t.appendChild(b)
      const set = () => {
        const left = p.at * 60 - actions.sessionMinutes() * 60
        const ready = left <= 0 && !claimed
        b.className = `rb ${claimed ? 'grey' : ready ? 'green' : 'red'} pbtn`
        b.disabled = claimed || !ready
        b.firstChild.textContent = claimed ? 'Claimed' : ready ? 'Claim' : twoDigitClock(left)
        t.classList.toggle('ready', ready)
      }
      set()
      if (!claimed) api.onTick(set)
      t.addEventListener('click', () => !b.disabled && actions.claimPlaytime(i))
      panel.appendChild(t)
    })
    api.body.appendChild(panel)
  }

  // --- Trails --------------------------------------------------------------------------------
  function renderTrails(api) {
    api.body.appendChild(h('div', 'rw-sub o', `${ico('trophy', 64, 'si')}<span>All your Wins boosts: x${fmtShort(winsMult())}</span>`))
    const list = h('div', 'trail-list rw-sc')
    list.dataset.keep = 'y'
    const order = [...TRAILS].sort((a, b) => (a.daily ? 2 : a.premium ? 1 : 0) - (b.daily ? 2 : b.premium ? 1 : 0) || (a.price ?? 0) - (b.price ?? 0))
    for (const t of order) {
      const owned = state.trails.includes(t.id)
      const on = state.trail === t.id
      const c = h('div', `tcard ${on ? 'on' : ''}`)
      const grad = t.card.length > 2 ? `linear-gradient(90deg, ${t.card.join(',')})` : `linear-gradient(${t.card[0]}, ${t.card[1]})`
      c.style.background = `var(--stud) 0 0 / calc(var(--k) * 32) calc(var(--k) * 32), ${grad}`
      c.innerHTML = `${img(trailCardURL(t), 'tart')}<div class="tinfo"><div class="tname o">${t.name}</div><div class="tmult">${ico('trophy', 64, 'ti')}<span class="o">x${t.mult} Wins Boost</span></div></div>`
      let b
      if (on) b = rbtn(`${ico('check', 64, 'bi')}Equipped`, 'grey', () => actions.equipTrail(''), { cls: 'tbtn' })
      else if (owned) b = rbtn('Equip', 'blue', () => actions.equipTrail(t.id), { cls: 'tbtn' })
      else if (t.daily) b = rbtn(`${ico('calendar', 64, 'bi')}Daily Day ${t.daily}`, 'grey', () => actions.closeWindow?.() ?? null, { cls: 'tbtn', disabled: true })
      else {
        const can = state.wins >= t.price
        b = rbtn(`${fmtShort(t.price)} Wins`, can ? (t.premium ? 'purple' : 'green') : 'grey', () => actions.buyTrail(t.id), { cls: 'tbtn' })
      }
      c.querySelector('.tinfo').appendChild(b)
      list.appendChild(c)
    }
    api.body.appendChild(list)
  }

  // --- Inventory: My Pets / Auras / Carts / Potions / Titles ----------------------------------
  const INV_TABS = [
    ['pets', 'Pets', 'catface', 'My Pets'],
    ['auras', 'Auras', 'aura', 'My Auras'],
    ['carts', 'Carts', 'cart', 'My Carts'],
    ['potions', 'Potions', 'starWins', 'My Potions'],
    ['titles', 'Titles', 'titles', 'My Titles'],
  ]
  function sideTabs(api, tabs, current, pick, cls = '') {
    for (const [id, label, icon] of tabs) {
      const b = h('button', `rw-tab ${cls} ${id === current ? 'on' : ''}`, icon ? `${ico(icon, 160)}<span class="o">${label}</span>` : `<span class="o">${label}</span>`)
      b.dataset.tab = id
      b.addEventListener('click', () => pick(id))
      api.side.appendChild(b)
    }
  }
  function renderInventory(api) {
    if (!INV_TABS.some((t) => t[0] === ui.invTab)) ui.invTab = 'pets'
    sideTabs(api, INV_TABS, ui.invTab, (id) => {
      ui.invTab = id
      ui.deleting = false
      api.refresh()
    }, 'itile')
    const tab = INV_TABS.find((t) => t[0] === ui.invTab)
    api.setTitle(tab[3], tab[2])
    api.wrap.classList.add(`inv-${ui.invTab}`)
    if (ui.invTab === 'pets') renderPets(api)
    else if (ui.invTab === 'auras') renderMyAuras(api)
    else if (ui.invTab === 'carts') renderCarts(api)
    else if (ui.invTab === 'potions') renderPotions(api)
    else renderTitles(api)
  }
  // Header row inside the body: left (count) and right (equipped) parts.
  function infoRow(api, left, right) {
    const r = h('div', 'inv-row')
    const l = h('div', 'inv-l')
    const rt = h('div', 'inv-r')
    l.append(...left)
    rt.append(...right)
    r.append(l, rt)
    api.body.appendChild(r)
    return r
  }
  const txt = (html, cls = '') => h('span', `o ${cls}`, html)
  function plusBtn(fn, price, what) {
    const b = h('button', 'capplus', ico('plus', 64))
    b.disabled = price == null
    b.title = price == null ? `${what}: maxed` : `${what}: ${fmt(price)} Wins`
    b.addEventListener('click', fn)
    return b
  }
  function sortedPets() {
    const list = [...state.pets]
    if (ui.petSort === 'new') return list.sort((a, b) => b.uid - a.uid)
    if (ui.petSort === 'rarity') return list.sort((a, b) => RARITY_ORDER.indexOf(petById(b.id).rarity) - RARITY_ORDER.indexOf(petById(a.id).rarity) || petPower(b) - petPower(a))
    return list.sort((a, b) => b.equipped - a.equipped || petPower(b) - petPower(a))
  }
  function renderPets(api) {
    const eq = state.pets.filter((p) => p.equipped).length
    infoRow(
      api,
      [txt(`${ico('paw', 64, 'ci')}${state.pets.length} / ${petStorage()}`), plusBtn(() => actions.buyStorage(), nextStoragePrice(), '+50 Storage')],
      [txt(`Equipped: ${eq} / ${petSlots()}`), plusBtn(() => actions.buySlot(), nextSlotPrice(), '+1 Pet Slot')],
    )
    const lay = h('div', `inv-lay pets ${ui.deleting ? 'deleting' : ''}`)
    const list = sortedPets()
    let sel = state.pets.find((p) => p.uid === ui.pet) ?? list[0] ?? null
    ui.pet = sel?.uid ?? null
    // detail card
    const det = h('div', 'inv-det')
    if (sel) {
      const d = petById(sel.id)
      const tier = tierById(sel.tier)
      const nextTier = PET_TIERS[PET_TIERS.findIndex((t) => t.id === (sel.tier || '')) + 1]
      const same = state.pets.filter((p) => p.id === sel.id && p.tier === sel.tier && !p.locked).length
      det.innerHTML = `<div class="dn o">${tier.id ? tier.name + ' ' : ''}${d.name}</div><div class="dimgwrap t-${sel.tier || 'b'}">${img(petThumb(sel.id, sel.tier), 'dthumb')}</div><div class="dr o" style="color:${RARITY_COLORS[d.rarity]}">${d.rarity}</div><div class="dp o">${ico('bolt', 64, 'bi')}+${fmtShort(petPower(sel) * 100)}%</div>${d.vsBest ? `<div class="dnote o">Always +${Math.round(d.vsBest * 100)}% vs your best pet</div>` : ''}`
      const g = h('div', 'dbtns')
      g.append(
        rbtn(`${ico('lock', 48, 'bi')}${sel.locked ? 'UNLOCK' : 'LOCK'}`, sel.locked ? 'gold' : 'slate', () => actions.lockPet(sel.uid), { cls: 'half' }),
        rbtn(sel.equipped ? 'UNEQUIP' : 'EQUIP', sel.equipped ? 'red' : 'green', () => actions.togglePet(sel.uid), { cls: 'half' }),
        rbtn(nextTier ? `${ico('star', 48, 'bi')}FUSE ${nextTier.name.toUpperCase()} ${Math.min(same, 3)}/3` : 'MAX TIER', 'slate', () => actions.fusePet(sel.uid), { disabled: !nextTier, cls: 'full' }),
        rbtn(`${ico('star', 48, 'bi')}FUSE ALL`, 'slate', () => actions.fuseAll(), { cls: 'full' }),
      )
      det.appendChild(g)
    } else det.innerHTML = '<div class="rw-empty o">No pets yet! Hatch eggs in the egg court south of spawn.</div>'
    // grid
    const grid = h('div', 'inv-grid rw-sc')
    grid.dataset.keep = 'y'
    for (const p of list) {
      const d = petById(p.id)
      const t = h('button', `rw-tile pet t-${p.tier || 'b'} ${p.equipped ? 'eq' : ''} ${p.uid === ui.pet ? 'sel' : ''} ${p.locked ? 'locked' : ''}`)
      t.innerHTML = `${img(petThumb(p.id, p.tier), 'pthumb')}<div class="pb o">${ico('bolt', 48, 'bi')}+${fmtShort(petPower(p) * 100)}%</div>${p.equipped ? ico('check', 64, 'pchk') : ''}${p.locked ? ico('lock', 48, 'plock') : ''}${ui.deleting && !p.equipped && !p.locked ? ico('trash', 64, 'ptrash') : ''}`
      t.style.setProperty('--rar', RARITY_COLORS[d.rarity])
      t.addEventListener('click', () => {
        if (ui.deleting) return actions.deletePet(p.uid)
        ui.pet = p.uid
        api.refresh()
      })
      t.addEventListener('dblclick', () => !ui.deleting && actions.togglePet(p.uid))
      grid.appendChild(t)
    }
    lay.append(det, grid)
    api.body.appendChild(lay)
    if (ui.deleting) lay.appendChild(h('div', 'rw-hint o', 'Tap pets to delete them (equipped and locked pets are kept)'))
    const bar = h('div', 'inv-bar')
    bar.append(
      rbtn('INDEX', 'blue', () => actions.openWindow?.('index'), { cls: 'b-index' }),
      rbtn(`${ico('trash', 64, 'bi')}${ui.deleting ? 'Done' : 'Delete Pets'}`, 'red', () => {
        ui.deleting = !ui.deleting
        api.refresh()
      }, { cls: 'b-del' }),
      rbtn('Equip Best', 'green', () => actions.equipBest(), { cls: 'b-best' }),
      rbtn(`↑↓${ui.petSort[0].toUpperCase()}${ui.petSort.slice(1)}`, 'gold', () => {
        ui.petSort = PET_SORTS[(PET_SORTS.indexOf(ui.petSort) + 1) % PET_SORTS.length]
        api.refresh()
      }, { cls: 'b-sort' }),
    )
    api.body.appendChild(bar)
  }
  function auraTile(a, { owned = true, eq = false } = {}) {
    const t = h('button', `rw-tile atile ${eq ? 'eq' : ''} ${owned ? '' : 'unknown'}`)
    t.style.setProperty('--a1', a.colors[0])
    t.style.setProperty('--a2', a.colors[a.colors.length - 1])
    t.innerHTML = `<div class="an o">${owned ? a.name : '???'}</div><div class="ai o">${oneIn(a.n)}</div><div class="ap o">${ico('bolt', 48, 'bi')}x${a.power}</div>${eq ? ico('check', 64, 'pchk') : ''}`
    return t
  }
  function renderMyAuras(api) {
    const eq = auraById(state.aura)
    infoRow(api, [txt(`${ico('star', 64, 'ci')}${state.auras.length} / ${AURAS.length} Auras`)], [txt(`Equipped: ${eq ? eq.name : 'none'}`)])
    const grid = h('div', 'inv-grid aura-grid rw-sc')
    grid.dataset.keep = 'y'
    const owned = AURAS.filter((a) => state.auras.includes(a.id)).reverse()
    for (const a of owned) {
      const t = auraTile(a, { eq: state.aura === a.id })
      t.addEventListener('click', () => actions.equipAura(state.aura === a.id ? '' : a.id))
      tooltip(api, t, (tip) => (tip.innerHTML = `<div class="tip-h o">${a.name}</div><div class="tip-b"><div class="tip-m">${ico('bolt', 64, 'ti')}<span class="o">x${a.power} Power</span></div><div class="tip-m">${ico('trophy', 64, 'ti')}<span class="o">x${a.wins} Wins</span></div><div class="tip-p o">${state.aura === a.id ? 'Tap to unequip' : 'Tap to equip'}</div></div>`))
      grid.appendChild(t)
    }
    if (!owned.length) grid.appendChild(h('div', 'rw-empty o', 'No auras yet! Roll for one.'))
    api.body.appendChild(grid)
    const bar = h('div', 'inv-bar')
    bar.append(rbtn(`${ico('diceRoll', 64, 'bi')}Roll Auras`, 'purple', () => actions.openWindow?.('auras'), { cls: 'b-wide' }))
    api.body.appendChild(bar)
  }
  function renderCarts(api) {
    const riding = slingById(state.equippedSling)
    const carts = [...SLINGSHOTS, ...ALL_SLINGSHOTS.filter((s) => !SLINGSHOTS.includes(s) && state.slingshots.includes(s.id))]
    infoRow(api, [txt(`${ico('cart', 64, 'ci')}${state.slingshots.length} / ${carts.length} Carts`)], [txt(`Riding: ${riding?.name ?? '-'}`)])
    const lay = h('div', 'inv-lay carts')
    const sel = slingById(ui.cart) ?? riding ?? SLINGSHOTS[0]
    ui.cart = sel.id
    const owned = state.slingshots.includes(sel.id)
    const on = state.equippedSling === sel.id
    const idx = SLINGSHOTS.indexOf(sel)
    const det = h('div', 'inv-det')
    det.innerHTML = `<div class="dn o">${sel.name}</div><div class="dimgwrap rays">${img(slingThumb(sel.style), 'dthumb')}</div><div class="dr o">${on ? 'Riding' : owned ? 'Owned' : 'Not owned'}</div><div class="dp fly o">${ico('bolt', 64, 'bi')}+${sel.fly ?? 0}% FLY</div><div class="dnote o">+${fmtShort(sel.skill)} Power per click</div>`
    let b
    if (on) b = rbtn('EQUIPPED', 'grey', null, { disabled: true, cls: 'full big' })
    else if (owned) b = rbtn('EQUIP', 'green', () => actions.equipSling(sel.id), { cls: 'full big' })
    else if (idx >= 0 && cartLocked(idx)) b = rbtn(`Buy ${SLINGSHOTS[idx - 1].name} first`, 'grey', null, { disabled: true, cls: 'full big' })
    else b = rbtn(`${ico('trophy', 48, 'bi')}${fmtShort(sel.price)}`, state.wins >= sel.price ? 'green' : 'grey', () => actions.buyCart(sel.id), { cls: 'full big' })
    det.appendChild(b)
    const grid = h('div', 'inv-grid cart-grid rw-sc')
    grid.dataset.keep = 'y'
    carts.forEach((c) => {
      const have = state.slingshots.includes(c.id)
      const t = h('button', `rw-tile cart ${state.equippedSling === c.id ? 'eq' : ''} ${c.id === sel.id ? 'sel' : ''} ${have ? '' : 'locked'}`)
      t.innerHTML = `${img(slingThumb(c.style), 'cthumb')}<div class="cb o">${have ? `${ico('bolt', 48, 'bi')}+${c.fly ?? 0}%` : `${ico('lock', 48, 'bi')}${fmtShort(c.price ?? 0)}`}</div>${state.equippedSling === c.id ? ico('check', 64, 'pchk') : ''}`
      t.addEventListener('click', () => {
        ui.cart = c.id
        api.refresh()
      })
      t.addEventListener('dblclick', () => have && actions.equipSling(c.id))
      grid.appendChild(t)
    })
    lay.append(det, grid)
    api.body.appendChild(lay)
  }
  function renderPotions(api) {
    const mins = BOOSTS.skill.minutes
    infoRow(api, [txt(`${ico('starLuck', 64, 'ci')}Use one for a ${mins} minute boost!`)], [])
    const row = h('div', 'potion-row')
    for (const [k, b] of Object.entries(BOOSTS)) {
      const n = state.potions[k] ?? 0
      const c = h('div', `pcard p-${k}`)
      c.style.background = `var(--stud) 0 0 / calc(var(--k) * 30) calc(var(--k) * 30), linear-gradient(${b.card[0]}, ${b.card[1]})`
      c.innerHTML = `<div class="pn o">${b.name}</div>${ico(b.icon, 192, 'pimg2')}<div class="pm o">x${b.mult} ${b.short}</div><div class="pf o">for ${b.minutes} minutes</div><div class="ph o">You have: ${fmt(n)}</div><div class="pa o"></div>`
      const act = c.querySelector('.pa')
      const tick = () => (act.textContent = state.boostLeft[k] > 0 ? `Active ${clock(state.boostLeft[k])}` : '')
      tick()
      api.onTick(tick)
      c.append(
        rbtn('USE', n ? 'green' : 'grey', () => actions.useBoost(k), { cls: 'puse' }),
        rbtn(`x3 ${ico('trophy', 48, 'bi')}${fmtShort(b.pack3)}`, 'purple', () => actions.buyPotions(k), { cls: 'pbuy' }),
      )
      row.appendChild(c)
    }
    api.body.appendChild(row)
  }
  function renderTitles(api) {
    const owned = TITLES.filter(titleOwned)
    const unowned = TITLES.filter((t) => !titleOwned(t))
    if (!ui.title || !titleById(ui.title)) ui.title = state.title || 'newbie'
    infoRow(api, [txt(`${ico('titles', 64, 'ci')}${owned.length} / ${TITLES.length} Titles`)], [txt(`Equipped: ${titleOwned(titleById(state.title)) ? titleById(state.title).name : 'none'}`)])
    const lay = h('div', 'titles')
    const list = h('div', 'tlist rw-sc')
    list.dataset.keep = 'y'
    const tile = (t, have) => {
      const b = h('button', `rw-tile ttile ${have ? '' : 'locked'} ${state.title === t.id && have ? 'eq' : ''} ${ui.title === t.id ? 'sel' : ''}`)
      let inner = `<div class="tn o" style="color:${t.color}">${t.name}</div>`
      if (t.bonus) inner += `<div class="tb o">${bonusText(t.bonus)}</div>`
      else if (t.req && !have) {
        const n = titleStat(t.req.stat)
        const goal = titleTarget(t)
        inner += `<div class="tbar"><div style="width:${Math.min(100, (n / goal) * 100)}%"></div><span class="o">${fmt(Math.min(n, goal))}/${fmt(goal)}</span></div>`
      }
      if (state.title === t.id && have) inner += ico('check', 64, 'pchk')
      if (!have) inner += ico('lock', 64, 'tlock')
      b.innerHTML = inner
      b.addEventListener('click', () => {
        ui.title = t.id
        api.refresh()
      })
      return b
    }
    list.appendChild(h('div', 'tsub o', 'Owned'))
    const g1 = h('div', 'rw-grid tgrid')
    owned.forEach((t) => g1.appendChild(tile(t, true)))
    list.appendChild(g1)
    if (unowned.length) {
      list.appendChild(h('div', 'tsub o', 'Unowned'))
      const g2 = h('div', 'rw-grid tgrid')
      unowned.forEach((t) => g2.appendChild(tile(t, false)))
      list.appendChild(g2)
    }
    const sel = titleById(ui.title)
    const have = titleOwned(sel)
    const det = h('div', 'tdetail')
    let progress = ''
    if (!have && sel.req) progress = `<div class="tprog o">${fmt(Math.min(titleStat(sel.req.stat), titleTarget(sel)))} / ${fmt(titleTarget(sel))}</div>`
    det.innerHTML = `<div class="dn o" style="color:${sel.color}">${sel.name}</div><div class="dd o">${sel.desc}</div>${progress}<div class="dsp"></div>${sel.bonus ? `<div class="db o">${bonusText(sel.bonus)}</div>` : '<div class="db o dim">Cosmetic title</div>'}`
    const eq = state.title === sel.id
    det.appendChild(have ? rbtn(eq ? 'Unequip' : 'Equip', eq ? 'red' : 'green', () => actions.equipTitle(eq ? '' : sel.id)) : rbtn('Locked', 'grey', null, { disabled: true }))
    lay.append(det, list)
    api.body.appendChild(lay)
  }

  // --- Auras (the roller) --------------------------------------------------------------------
  // Left: the last roll (shuffles while rolling), the equipped aura, the four dice, Auto Roll and the
  // x2 / x3 luck upgrades. Right: the odds of every aura at the chosen die's luck.
  const DICE_ICON = { roll: 'diceRoll', gold: 'diceGold', diamond: 'diceDiamond', cosmic: 'diceCosmic' }
  const shortLuck = (n) => (n >= 1000 ? `${fmt(n / 1000)}K` : fmt(n))
  function renderAuras(api) {
    api.setCount(`${ico('trophy', 64, 'ci')}${fmtShort(state.wins)}`)
    const lay = h('div', 'ar-lay')
    const left = h('div', 'ar-left')
    // result box
    const box = h('div', 'ar-box')
    const spinning = performance.now() < ui.spinUntil
    const r = ui.roll
    const fill = () => {
      if (spinning || !r) {
        const a = spinning ? AURAS[Math.floor(Math.random() * AURAS.length)] : null
        box.innerHTML = `<div class="ar-name o">${a ? auraName(a) : '- ??? -'}</div><div class="ar-odds o">(1 in ???)</div>`
        return
      }
      const a = r.aura
      const eqd = state.aura === a.id
      box.innerHTML = `<div class="ar-name o">${auraName(a)}</div><div class="ar-odds o">(${oneIn(a.n)})</div>`
      const tags = h('div', 'ar-tags')
      if (r.isNew) tags.appendChild(h('span', 'tag-new o', 'NEW!'))
      tags.appendChild(eqd ? h('span', 'tag-eq o', 'Equipped') : rbtn('Equip', 'green', () => actions.equipAura(a.id), { cls: 'tag-btn' }))
      box.appendChild(tags)
    }
    fill()
    if (spinning) {
      const iv = setInterval(() => {
        if (!box.isConnected) return clearInterval(iv)
        if (performance.now() >= ui.spinUntil) {
          clearInterval(iv)
          return api.refresh()
        }
        const a = AURAS[Math.floor(Math.random() * AURAS.length)]
        box.querySelector('.ar-name').innerHTML = auraName(a)
      }, 70)
    }
    const eq = auraById(state.aura)
    left.append(box, h('div', 'ar-eq o', eq ? `Equipped: ${auraName(eq)} · x${eq.power} Power` : 'Equipped: none'))
    // dice
    const dice = h('div', 'ar-dice')
    for (const d of AURA_ROLLS) {
      const have = d.id === 'roll' ? 0 : state.dice[d.id] ?? 0
      const c = h('div', 'ar-die')
      const b = h('button', `ar-dbtn d-${d.id}`, `${d.luck > 1 ? `<span class="ar-x o">x${fmt(d.luck)}</span>` : ''}${ico(DICE_ICON[d.id], 160, 'ar-dimg')}<span class="ar-dn o">${d.name}</span>`)
      b.addEventListener('click', () => {
        const res = actions.rollAura(d.id)
        if (res) showRoll(res, 750)
      })
      const price = h('div', 'ar-price o', have ? `${ico(DICE_ICON[d.id], 48, 'bi')}x${fmt(have)}` : `${ico('trophy', 48, 'bi')}${fmtShort(d.price)}`)
      c.append(b, price)
      dice.appendChild(c)
    }
    left.appendChild(dice)
    // auto roll + luck upgrades
    const row = h('div', 'ar-row')
    const auto = h('button', `ar-auto ${actions.autoRolling?.() ? 'on' : ''}`, `<span class="o">Auto Roll</span><span class="ar-onoff o">${actions.autoRolling?.() ? 'On' : 'Off'}</span>`)
    auto.addEventListener('click', () => {
      actions.toggleAutoRoll()
      api.refresh()
    })
    row.appendChild(auto)
    for (const p of AURA_PASSES) {
      const own = hasPass(p.id)
      const b = h('button', `ar-pass x${p.mult} ${own ? 'owned' : ''}`, `${ico(p.mult === 2 ? 'diceRoll' : 'diceGold', 96, 'ar-pimg')}<span class="ar-pt o">x${p.mult} LUCK</span><span class="ar-pp o">${own ? 'OWNED' : `${ico('trophy', 48, 'bi')}${fmtShort(p.price)}`}</span>`)
      b.addEventListener('click', () => !own && actions.buyAuraPass(p.id))
      row.appendChild(b)
    }
    left.appendChild(row)
    // odds
    const right = h('div', 'ar-right')
    right.appendChild(h('div', 'ar-oh o', 'Odds'))
    const tabs = h('div', 'ar-tabs')
    AURA_ROLLS.forEach((d, i) => {
      const t = rbtn(d.luck > 1 ? `x${shortLuck(d.luck)}` : 'Roll', i === ui.oddsTab ? 'green' : 'slate', () => {
        ui.oddsTab = i
        api.refresh()
      })
      tabs.appendChild(t)
    })
    right.appendChild(tabs)
    const die = AURA_ROLLS[ui.oddsTab]
    const luck = auraLuck(die.luck)
    const ev = auraEvent()
    right.appendChild(h('div', 'ar-luck o', `${die.name} · x${fmtShort(luck)} Luck${ev.on ? ' · EVENT x' + ev.mult : ''}`))
    const odds = auraOdds(luck)
    const list = h('div', 'ar-list rw-sc')
    list.dataset.keep = 'y'
    for (let i = AURAS.length - 1; i >= 0; i--) {
      const a = AURAS[i]
      const p = odds[i]
      const own = state.auras.includes(a.id)
      const rowEl = h('div', `ar-item ${own ? 'own' : ''}`)
      rowEl.innerHTML = `<div class="ai-l"><div class="ai-n o">${auraName(a)}${own ? ico('check', 48, 'ai-c') : ''}</div><div class="ai-b o">${oneIn(a.n)}</div></div><div class="ai-r"><div class="ai-e o">${p > 0 ? oneIn(1 / p < 1000 ? 1 / p : Number((1 / p).toPrecision(3))) : 'never'}</div><div class="ai-m o">${ico('bolt', 48, 'bi')}x${a.power} ${ico('trophy', 48, 'bi')}x${a.wins}</div></div>`
      list.appendChild(rowEl)
    }
    right.appendChild(list)
    lay.append(left, right)
    api.body.appendChild(lay)
  }
  // A roll result from the buttons or Auto Roll: shuffle the name for `spin` ms, then show it.
  let auraApi = null
  function showRoll(res, spin = 750) {
    ui.roll = res
    ui.spinUntil = performance.now() + spin
    auraApi?.refresh()
  }

  // --- Invite Friends ------------------------------------------------------------------------
  // Opened from the Friend Boost line at the bottom left of the HUD. A friend who JOINS through our link
  // or our direct Bloxity invite gives +FRIEND_BOOST.per Skill gain for good (the server credits each
  // account once); Boxity draws its own invite button too, which works the same way.
  let friendList = null // the last Bloxity friends list
  let friendsAt = 0
  const invitedNow = new Set() // friend ids invited this session
  function renderInvite(api) {
    const per = Math.round(FRIEND_BOOST.per * 100)
    const got = Math.min(friends.joined, FRIEND_BOOST.max)
    const info = h('div', 'inv-info')
    info.innerHTML = `<div class="inv-big o">Friend Boost: +${Math.round(friendBoost() * 100)}%</div><div class="inv-sub o">Every friend who joins the game from your invite gives you +${per}% Power gain, forever!</div><div class="inv-bar"><div style="width:${(got / FRIEND_BOOST.max) * 100}%"></div><span class="o">${got} / ${FRIEND_BOOST.max} friends</span></div>`
    api.body.appendChild(info)
    const note = (text) => api.body.appendChild(h('div', 'inv-note o', text))
    if (!bloxity.canInvite()) return note('Invites work when you play on Bloxity.')
    if (!bloxity.authState.user) return note('Sign in to Bloxity (top-left menu) to invite friends and earn the boost.')

    const copy = rbtn('Copy Invite Link', 'lime', async () => {
      const url = bloxity.inviteLink()
      if (!url) return actions.toast?.('Could not make an invite link. Try again!', '#ff6a6a')
      try {
        await navigator.clipboard.writeText(url)
        actions.toast?.('Invite link copied! Send it to a friend', '#7dff7d')
      } catch {
        window.prompt('Copy your invite link:', url)
      }
    }, { cls: 'inv-copy' })
    api.body.appendChild(copy)

    api.body.appendChild(h('div', 'inv-h o', 'Your Bloxity friends'))
    const list = h('div', 'inv-list')
    list.dataset.keep = 'y'
    api.body.appendChild(list)
    if (!friendList || Date.now() - friendsAt > 60000) {
      list.appendChild(h('div', 'inv-note o', 'Loading friends...'))
      refreshInvites() // a friend may have been credited in another room since the load
      bloxity.getFriends().then((f) => {
        friendList = f
        friendsAt = Date.now()
        if (document.body.classList.contains('win-open')) api.refresh()
      })
      return
    }
    if (!friendList.length) return list.appendChild(h('div', 'inv-note o', 'No Bloxity friends yet: share your invite link instead!'))
    const order = { 'in-game': 0, online: 1, away: 2, offline: 3 }
    const sorted = [...friendList].sort((a, b) => (order[a.presence?.status] ?? 4) - (order[b.presence?.status] ?? 4))
    for (const f of sorted.slice(0, 40)) {
      const name = f.displayName || f.username || 'Friend'
      const status = f.presence?.status ?? 'offline'
      const row = h('div', `inv-row st-${status}`)
      const nm = h('span', 'inv-name o')
      nm.textContent = name // friend names are user text
      row.append(nm, h('span', 'inv-st o', status))
      const done = invitedNow.has(f._id)
      const b = rbtn(done ? 'Invited' : 'Invite', done ? 'grey' : 'lime', async () => {
        b.disabled = true
        const ok = await bloxity.inviteFriend(f._id)
        if (!ok) {
          b.disabled = false
          return actions.toast?.(`Could not invite ${name}. Try again!`, '#ff6a6a')
        }
        invitedNow.add(f._id)
        sendInvited(f._id)
        actions.toast?.(`Invite sent to ${name}!`, '#7dff7d')
        api.refresh()
      }, { disabled: done, cls: 'inv-btn' })
      row.appendChild(b)
      list.appendChild(row)
    }
  }

  // --- Settings ------------------------------------------------------------------------------
  function renderSettings(api) {
    const list = h('div', 'set-list')
    list.dataset.keep = 'y'
    for (const s of GAME_SETTINGS) {
      const on = !!state.settings[s.key]
      const row = h('div', 'set-row', `<span class="sl o">${s.label}</span>`)
      const b = rbtn(on ? 'ON' : 'OFF', on ? 'on' : 'off', () => actions.setSetting(s.key, !on), { cls: 'toggle-btn' })
      row.appendChild(b)
      list.appendChild(row)
    }
    // Auto Rebirth / Auto Fly moved here from the HUD.
    for (const [key, label] of [['autoRebirth', 'Auto Rebirth'], ['autoFly', 'Auto Fly']]) {
      const on = !!state[key]
      const row = h('div', 'set-row', `<span class="sl o">${label}</span>`)
      row.appendChild(rbtn(on ? 'ON' : 'OFF', on ? 'on' : 'off', () => {
        actions.toggle(key)
        api.refresh()
      }, { cls: 'toggle-btn' }))
      list.appendChild(row)
    }
    api.body.appendChild(list)
  }

  // --- Rebirth -------------------------------------------------------------------------------
  function renderRebirth(api) {
    const lv = levelInfo().level
    const need = rebirthLevel()
    const ready = lv >= need
    const frac = Math.min(1, state.totalSkill / Math.max(1, nextRebirthCost()))
    const p = h('div', 'rebirth')
    p.innerHTML = `
      <div class="rb-cols">
        <div class="rb-col"><div class="rb-h o">Before</div><div class="rb-box">${ico('bolt', 128, 'rbi')}<div class="o">x${fmt(rebirthMult())}<br>POWER</div></div></div>
        <div class="rb-arrow"></div>
        <div class="rb-col"><div class="rb-h o">After</div><div class="rb-box">${ico('bolt', 128, 'rbi')}<div class="o">x${fmt(rebirthMult() + 1)}<br>POWER</div></div></div>
      </div>
      <div class="rb-warn o">Resets your LEVEL and POWER!</div>
      <div class="rb-bar"><div style="width:${(ready ? 1 : frac) * 100}%"></div><span class="o">Level ${fmt(lv)} / Level ${fmt(need)} (${Math.floor((ready ? 1 : frac) * 100)}%)</span></div>`
    const row = h('div', 'rb-btns')
    row.append(
      rbtn('Rebirth', ready ? 'green' : 'grey', () => actions.rebirth(), { disabled: !ready, cls: 'rb-go' }),
      rbtn(`Skip Rebirth<small>${ico('trophy', 48, 'bi')}${fmtShort(skipRebirthPrice(state.rebirths))}</small>`, 'purple', () => actions.skipRebirth(), { cls: 'rb-skip' }),
    )
    p.appendChild(row)
    // the next milestone pet
    const m = REBIRTH_MILESTONES.find((x) => !state.milestones.includes(x.pet))
    const ms = h('div', 'rb-ms')
    if (m) {
      const d = petById(m.pet)
      ms.innerHTML = `${img(petThumb(m.pet), 'ms-img')}<div class="ms-t"><div class="ms-h o">${ico('trophy', 48, 'bi')}Milestone at Rebirth ${m.at}</div><div class="ms-d o">${d.name}: always +${Math.round(d.vsBest * 100)}% vs your best pet!</div></div><div class="ms-n o">${fmt(Math.min(state.rebirths, m.at))} / ${m.at}</div>`
    } else ms.innerHTML = `<div class="ms-t"><div class="ms-h o">${ico('trophy', 48, 'bi')}Every rebirth milestone claimed!</div></div>`
    p.appendChild(ms)
    api.body.appendChild(p)
  }

  // --- Index ---------------------------------------------------------------------------------
  function renderIndex(api) {
    const tier = ui.indexTab
    sideTabs(api, PET_TIERS.map((t) => [t.id, t.name]), tier, (id) => {
      ui.indexTab = id
      api.refresh()
    }, 'itab')
    api.side.querySelectorAll('.itab').forEach((b) => b.classList.add(`it-${b.dataset.tab || 'b'}`))
    const seen = ALL_PETS.filter((p) => state.discovered.includes(indexKey(p.id, tier))).length
    api.setCount(`${seen} / ${ALL_PETS.length}`)
    const list = h('div', 'idx-list')
    list.dataset.keep = 'y'
    const groups = [...EGGS.map((e) => ({ name: e.name, pets: e.pets })), { name: 'Limited Pets', pets: [...STAND_PETS, ...LIMITED_PETS] }]
    for (const g of groups) {
      const got = g.pets.filter((p) => state.discovered.includes(indexKey(p.id, tier))).length
      list.appendChild(h('div', 'idx-h o', `${g.name}&nbsp; (${got}/${g.pets.length})`))
      const row = h('div', 'rw-grid idx-row')
      for (const p of g.pets) {
        const known = state.discovered.includes(indexKey(p.id, tier))
        const t = h('button', `rw-tile idx t-${tier || 'b'} ${known ? '' : 'unknown'}`, `${img(petThumb(p.id, tier), 'xthumb')}<div class="xn o">${known ? p.name : '???'}</div>`)
        tooltip(api, t, (tip) => {
          const d = petById(p.id)
          tip.innerHTML = `<div class="tip-h o">${known ? `${tierById(tier).id ? tierById(tier).name + ' ' : ''}${d.name}` : '???'}<div class="tip-r o" style="color:${RARITY_COLORS[d.rarity]}">${d.rarity}</div></div><div class="tip-b"><div class="tip-e o">${d.eggName}</div>${p.chance ? `<div class="tip-p o">${p.chance}% chance</div>` : ''}</div>`
        })
        row.appendChild(t)
      }
      list.appendChild(row)
    }
    api.body.appendChild(list)
    // Index Luck bar
    const total = state.discovered.length
    const earned = Math.floor(total / INDEX_LUCK.every)
    const claimable = earned - state.indexClaims
    const into = claimable > 0 ? INDEX_LUCK.every : total - earned * INDEX_LUCK.every
    const luck = h('div', 'idx-luck')
    luck.innerHTML = `<span class="il-t o">Index Luck +${Math.round(indexLuck() * 100)}%</span><div class="il-bar"><div style="width:${(into / INDEX_LUCK.every) * 100}%"></div><span class="o">${into} / ${INDEX_LUCK.every}</span>${ico('clover', 128, 'il-c')}<span class="il-p o">+${Math.round(INDEX_LUCK.pct * 100)}%</span></div>`
    luck.appendChild(rbtn(claimable > 0 ? `Claim!${claimable > 1 ? ` x${claimable}` : ''}` : 'Claim!', claimable > 0 ? 'lime' : 'grey', () => actions.claimIndexLuck(), { disabled: claimable <= 0, cls: 'il-btn' }))
    api.below.appendChild(luck)
  }

  // --- Offline training report (shown once after logging back in) -----------------------------
  function hms(sec) {
    sec = Math.floor(sec)
    const d = Math.floor(sec / 86400)
    const hh = Math.floor((sec % 86400) / 3600)
    const mm = Math.floor((sec % 3600) / 60)
    return d ? `${d}d ${hh}h` : hh ? `${hh}h ${mm}m` : `${Math.max(1, mm)}m`
  }
  function renderOffline(api) {
    const r = actions.offlineReport?.()
    const box = h('div', 'rw-panel off')
    if (!r) {
      box.innerHTML = '<div class="rw-empty o">No offline training yet. Come back after a break!</div>'
      api.body.appendChild(box)
      return
    }
    box.innerHTML = `<div class="off-t o">Free Training while you were away!</div>
      <div class="off-time o">Away for ${hms(r.away)}</div>
      ${img(iconURL('bolt', 192), 'off-img')}
      <div class="off-gain o">+${fmt(r.skill)} Power</div>
      <div class="off-sub o">${r.capped ? `Trained for the max ${hms(r.secs)}. Log in more often to earn more!` : `Trained for ${hms(r.secs)} on your best treadmill`}</div>`
    box.appendChild(rbtn('Awesome!', 'lime', () => actions.closeWindow?.(), { cls: 'off-btn' }))
    api.body.appendChild(box)
  }

  return {
    windows: {
      offline: { title: 'Welcome Back!', icon: 'bolt', size: 'sm', render: renderOffline },
      daily: { title: 'Daily Rewards', icon: 'calendar', size: 'md', render: renderDaily },
      playtime: { title: 'Playtime Rewards', icon: 'gift', size: 'md', render: renderPlaytime },
      trails: { title: 'Trails', icon: 'trail', size: 'tall', render: renderTrails },
      inventory: { title: 'My Pets', icon: 'catface', size: 'inv', side: true, render: renderInventory },
      auras: {
        title: 'Auras',
        icon: 'aura',
        size: 'aura',
        head: 'bar',
        render: (api) => {
          auraApi = api
          renderAuras(api)
        },
      },
      settings: { title: 'Settings', icon: 'gear', size: 'sm', render: renderSettings },
      invite: { title: 'Invite Friends', icon: 'plus', size: 'md', render: renderInvite },
      rebirth: { title: 'Rebirth', icon: 'rebirth', size: 'rbw', render: renderRebirth },
      index: { title: 'Index', icon: 'book', size: 'lg', side: true, render: renderIndex },
    },
    showRoll,
  }
}
export { pct, studURL }

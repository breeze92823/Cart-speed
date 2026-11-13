import { Group, Matrix4, Mesh, MeshBasicMaterial, Quaternion, RingGeometry, Vector3, AdditiveBlending, DoubleSide } from 'three'
import {
  CHANNEL,
  CHEST,
  EGGS,
  FLIGHT,
  FLY_ZONE,
  BOOSTS,
  DAILY,
  INDEX_LUCK,
  PLAYTIME,
  OFFLINE,
  PASSES,
  PLATFORMS,
  SKILL_PACKS,
  SLINGSHOTS,
  SPAWN,
  STAND_PETS,
  TRAILS,
  skipRebirthPrice,
  TRAIN,
  WORLD2_SKILL,
  HUB,
  rebirthCost,
  AURA_AUTO,
  AURA_PASSES,
  AURA_ROLLS,
  PET_TIERS,
  REBIRTH_MILESTONES,
} from './config.js'
import { inputState, onKey } from './input.js'
import { player, resetPlayer, setPlayerOverride } from './player.js'
import { syncYawToPlayer } from './camera.js'
import * as bloxity from './bloxity.js'
import { buildSlingshot, fmtShort, makeSign } from './props.js'
import { isCartStyle } from './hub/carts.js'
import { animatePet, buildPet } from './petModels.js'
import { createFlight } from './flight.js'
import { createTraining } from './training.js'
import { createEggs } from './eggs.js'
import { petThumb } from './hud.js'
import { sfx, setMusicOn, setSfxOn } from './audio/index.js'
import {
  addPet,
  addSkill,
  dailyClaimable,
  petLook,
  levelInfo,
  titleOwned,
  titleById,
  rollDaily,
  rebirthLevel,
  petStorage,
  nextStoragePrice,
  nextSlotPrice,
  canRebirth,
  changed,
  equipBest,
  hasPass,
  nextRebirthCost,
  petById,
  petSlots,
  platformUnlocked,
  rebirthMult,
  skillPerClick,
  awayMs,
  offlineSkillPerSec,
  slingById,
  state,
  trailById,
  winsMult,
  auraById,
  auraLuck,
  fillQuests,
  questById,
  questProgress,
  rollAura,
} from './state.js'
import { createAuraGlow } from './auraGlow.js'

// Gameplay: training clicks, the Cart Shop pads (carts = the old slingshots), the treadmills, eggs + hatching,
// limited pet stands, the flight over the slime, rebirths, passes / packs /
// trails, the rewards chest and playtime gifts, pets following the player,
// the held slingshot, name tag and leaderboards. Driven once per frame by main.js.

const fmt = (n) => Math.round(n).toLocaleString('en-US')
const BOT_NAMES = ['SlimeSurfer', 'SkyHopper', 'BrickBaron', 'NovaKid', 'PixelPilot', 'JellyJumper', 'TurboTomas', 'CloudRider', 'StudMaster', 'GreenGlider', 'ZoomZebra', 'MintyMoss']
const BOT_COLORS = ['#ff6a6a', '#5fb4ff', '#ffd23a', '#7dff7d', '#c98cff', '#ff9a3a', '#6ff0ff', '#ff8fd8', '#a8ff5a', '#f2f2f2', '#3a8cff', '#ffb6c8']

export function createGame({ scene, camera, fx, props, hud }) {
  const sessionStart = performance.now()
  const sessionMinutes = () => (performance.now() - sessionStart) / 60000
  let windowOpen = false

  // ---------------------------------------------------------------------------
  // Purchases
  // ---------------------------------------------------------------------------
  function spend(price) {
    if (state.wins < price) {
      hud.toast(`Not enough Wins! Need ${fmtShort(price - state.wins)} more`, '#ff6a6a')
      sfx.deny()
      return false
    }
    state.wins -= price
    state.stats.spent += price
    return true
  }
  function celebrate(color = ['#ffd23a', '#5fe0ff', '#ff6ad5', '#7dff7d']) {
    const p = player.position
    fx.burst(40, { x: p.x, y: p.y + 2, z: p.z, spread: 1, speed: 7, up: 1.2, gravity: -14, drag: 1, life: 1.4, size: 0.35, color, additive: false, shape: 'square' })
    fx.burst(18, { x: p.x, y: p.y + 1.5, z: p.z, spread: 1.5, speed: 3, life: 0.9, size: 0.7, color: '#ffffff', shape: 'star' })
  }
  function doRebirth() {
    state.skill = 0
    state.totalSkill = 0
    state.rebirths++
    sfx.rebirth()
    hud.toast(`Rebirth ${state.rebirths}! Now x${rebirthMult()} Power`, '#6fd4ff')
    checkMilestones()
    const p = player.position
    fx.burst(70, { x: p.x, y: p.y + 1, z: p.z, spread: 0.5, speed: 9, up: 0.3, drag: 2, life: 1.2, size: 0.6, color: ['#ff3b4e', '#2f9bff', '#ffffff'], shape: 'star' })
    ringPulse(p.x, p.y + 0.2, p.z, '#6fd4ff')
    changed()
    hud.refreshWindow()
  }
  // Daily / Playtime reward payout: { boost, n } | { pet } | { sling }.
  function grant(r) {
    if (r.boost) {
      state.potions[r.boost] += r.n ?? 1
      sfx.gift('potion')
      hud.toast(`+${r.n ?? 1} ${BOOSTS[r.boost].name}${(r.n ?? 1) > 1 ? 's' : ''}! (Inventory > Potions)`, BOOSTS[r.boost].color)
    } else if (r.pet) {
      addPet(r.pet)
      rebuildPets()
      sfx.gift('pet')
      hud.toast(`${petById(r.pet).name} joined you!`, '#ff8fd8')
    } else if (r.dice) {
      state.dice[r.dice] = (state.dice[r.dice] ?? 0) + (r.n ?? 1)
      sfx.gift('potion')
      hud.toast(`+${r.n ?? 1} ${r.dice[0].toUpperCase()}${r.dice.slice(1)} Dice! (Auras)`, '#ffd23a')
    } else if (r.trail) {
      const t = trailById(r.trail)
      if (!state.trails.includes(r.trail)) state.trails.push(r.trail)
      state.trail = r.trail
      sfx.gift('clover')
      hud.toast(`${t.name} unlocked! x${t.mult} Wins`, '#7dff5a')
    } else if (r.sling) {
      if (!state.slingshots.includes(r.sling)) state.slingshots.push(r.sling)
      state.equippedSling = r.sling
      sfx.gift('bolt')
      hud.toast(`${slingById(r.sling).name} unlocked! +${fmtShort(slingById(r.sling).skill)} Skill per click`, '#c98cff')
    }
  }
  // Free offline training: pay the Skill earned while away (once per session) and open the report window.
  let offlineReport = null
  function checkOffline() {
    if (offlineReport) return
    const away = awayMs()
    if (away < OFFLINE.min * 1000) return
    const secs = Math.min(away / 1000, OFFLINE.cap)
    const skill = Math.floor(secs * offlineSkillPerSec())
    if (skill <= 0) return
    addSkill(skill)
    offlineReport = { away: away / 1000, secs, skill, capped: away / 1000 > OFFLINE.cap }
    changed()
    hud.update()
    hud.openWindow('offline')
  }
  // The Settings window: sound, music, effects, HUD and pets visibility.
  function applySettings() {
    const st = state.settings
    setSfxOn(st.sfx)
    setMusicOn(st.music)
    fx.setEnabled?.(st.effects)
    petRoot.visible = !st.hidePets
    document.body.classList.toggle('hide-hud', !!st.hideHud)
  }
  function refreshBadge() {
    const mins = sessionMinutes()
    hud.setBadge(PLAYTIME.filter((g, i) => mins >= g.at && !state.claimedGifts.includes(i)).length)
  }
  const actions = {
    sessionMinutes,
    offlineReport: () => offlineReport,
    closeWindow: () => hud.closeWindow(),
    toast: (text, color) => hud.toast(text, color),
    windowOpened: (on) => {
      windowOpen = on
      bloxity.adsScreen(on ? 'panel' : 'gameplay')
    },
    toggle(key) {
      state[key] = !state[key]
      if (key === 'autoFly' && state.autoFly && !fl.active()) teleportToZone()
      changed()
    },
    buyPass(id) {
      if (hasPass(id)) return hud.toast('Already owned!', '#ffd23a')
      const p = PASSES.find((x) => x.id === id)
      if (!spend(p.price)) return
      state.passes[id] = true
      if (id === 'starter') {
        addSkill(2500 * rebirthMult())
        state.tokens += 10
        addPet('fox')
        rebuildPets()
      }
      if (id === 'petslot') equipBest()
      sfx.purchase()
      hud.toast(`${p.name} unlocked!`, '#7dff7d')
      celebrate()
      changed()
      hud.refreshWindow()
    },
    buyPack(id) {
      const p = SKILL_PACKS.find((x) => x.id === id)
      if (!spend(p.price)) return
      addSkill(p.amount)
      sfx.purchase()
      hud.toast(`+${fmt(p.amount)} Skill!`, '#5fe0ff')
      celebrate(['#5fe0ff', '#ffffff', '#3f8cff'])
      changed()
    },
    buyStand(id) {
      const sp = STAND_PETS.find((x) => x.id === id)
      if (!spend(sp.price)) return
      addPet(sp.id)
      sfx.purchase()
      hud.toast(`${sp.name} joined you!`, '#ff8fd8')
      celebrate()
      rebuildPets()
      changed()
      hud.refreshWindow()
    },
    rebirth() {
      if (!canRebirth()) {
        sfx.deny()
        return hud.toast(`Reach Level ${fmt(rebirthLevel())} to rebirth`, '#ff6a6a')
      }
      doRebirth()
    },
    skipRebirth() {
      if (canRebirth()) return doRebirth()
      if (!spend(skipRebirthPrice(state.rebirths))) return
      doRebirth()
    },
    togglePet(uid) {
      const pet = state.pets.find((p) => p.uid === uid)
      if (!pet) return
      if (!pet.equipped && state.pets.filter((p) => p.equipped).length >= petSlots()) {
        sfx.deny()
        return hud.toast(`Only ${petSlots()} pets can be equipped`, '#ff6a6a')
      }
      pet.equipped = !pet.equipped
      sfx.pop(pet.equipped)
      rebuildPets()
      changed()
      hud.refreshWindow()
    },
    equipBest() {
      equipBest()
      sfx.equip()
      rebuildPets()
      changed()
      hud.refreshWindow()
    },
    unequipAll() {
      for (const p of state.pets) p.equipped = false
      sfx.pop(false)
      rebuildPets()
      changed()
      hud.refreshWindow()
    },
    deletePet(uid) {
      const pet = state.pets.find((p) => p.uid === uid)
      if (!pet) return
      if (pet.equipped || pet.locked) {
        sfx.deny()
        return hud.toast(pet.locked ? 'Unlock a pet before deleting it' : 'Unequip a pet before deleting it', '#ff6a6a')
      }
      state.pets = state.pets.filter((p) => p.uid !== uid)
      sfx.trash()
      changed()
      hud.refreshWindow()
    },
    deleteUnequipped() {
      const n = state.pets.filter((p) => !p.equipped && !p.locked).length
      state.pets = state.pets.filter((p) => p.equipped || p.locked)
      sfx.trash()
      hud.toast(`Removed ${n} pets`, '#ffffff')
      changed()
      hud.refreshWindow()
    },
    buySlot() {
      const price = nextSlotPrice()
      if (price == null) return hud.toast('Pet slots are maxed!', '#ffd23a')
      if (!spend(price)) return
      state.extraSlots++
      sfx.purchase()
      hud.toast(`+1 Pet Slot! (${petSlots()} equipped)`, '#7dff7d')
      changed()
      hud.refreshWindow()
    },
    buyStorage() {
      const price = nextStoragePrice()
      if (price == null) return hud.toast('Storage is maxed!', '#ffd23a')
      if (!spend(price)) return
      state.storageBuys++
      sfx.purchase()
      hud.toast(`Pet storage is now ${petStorage()}!`, '#7dff7d')
      changed()
      hud.refreshWindow()
    },
    buyTrail(id) {
      const t = TRAILS.find((x) => x.id === id)
      if (!t || state.trails.includes(id) || !t.price) return
      if (!spend(t.price)) return
      state.trails.push(id)
      state.trail = id
      sfx.purchase()
      hud.toast(`${t.name} unlocked! x${t.mult} Wins`, '#7dff7d')
      celebrate(t.colors)
      changed()
      hud.refreshWindow()
    },
    equipTrail(id) {
      if (id && !state.trails.includes(id)) return
      state.trail = id
      if (id) sfx.equip()
      else sfx.pop(false)
      changed()
      hud.refreshWindow()
    },
    equipSling(id) {
      if (!state.slingshots.includes(id) || state.equippedSling === id) return
      state.equippedSling = id
      sfx.equip()
      hud.toast(`Equipped ${slingById(id).name}`, '#7dff7d')
      changed()
      hud.refreshWindow()
    },
    useBoost(kind) {
      const b = BOOSTS[kind]
      if (!state.potions[kind]) {
        sfx.deny()
        return hud.toast(`No ${b.name}s left! Get them from Daily and Playtime Rewards`, '#ff6a6a')
      }
      state.potions[kind]--
      state.boostLeft[kind] += b.minutes * 60
      sfx.drink()
      hud.toast(`${b.name} active! x${b.mult} for ${b.minutes} min`, b.color)
      changed()
      hud.refreshWindow()
      hud.tick()
    },
    equipTitle(id) {
      const t = id ? titleById(id) : null
      if (t && !titleOwned(t)) return sfx.deny()
      state.title = id
      if (t) sfx.fanfare()
      else sfx.pop(false)
      updateNameTag()
      changed()
      hud.refreshWindow()
    },
    setSetting(key, value) {
      state.settings[key] = value
      applySettings()
      changed()
      hud.refreshWindow()
    },
    claimIndexLuck() {
      const earned = Math.floor(state.discovered.length / INDEX_LUCK.every)
      if (earned <= state.indexClaims) return sfx.deny()
      const n = earned - state.indexClaims
      state.indexClaims = earned
      sfx.gift('clover')
      hud.toast(`Index Luck +${Math.round(n * INDEX_LUCK.pct * 100)}%!`, '#7dff5a')
      celebrate(['#7dff5a', '#ffffff', '#2fbf3a'])
      changed()
      hud.refreshWindow()
    },
    claimDaily(i) {
      rollDaily()
      if (i >= state.daily.unlocked || state.daily.claimed.includes(i)) return sfx.deny()
      state.daily.claimed.push(i)
      state.stats.dailyClaims++
      const r = DAILY[i]
      if ((r.sling && state.slingshots.includes(r.sling)) || (r.trail && state.trails.includes(r.trail))) {
        for (const x of r.again) grant(x)
        hud.toast('Day 7 again: 3 of every Boost!', '#ffd23a')
      } else grant(r)
      celebrate()
      changed()
      hud.refreshWindow()
    },
    claimPlaytime(i) {
      const g = PLAYTIME[i]
      if (state.claimedGifts.includes(i) || sessionMinutes() < g.at) return
      if (g.egg && !actions.hatch(g.egg, 1, { free: true })) return
      state.claimedGifts.push(i)
      if (g.wins) {
        state.wins += g.wins * rebirthMult()
        sfx.gift('trophy')
        hud.toast(`+${fmt(g.wins * rebirthMult())} Wins!`, '#ffd23a')
      }
      if (g.skill) {
        addSkill(g.skill * rebirthMult())
        sfx.gift('bolt')
        hud.toast(`+${fmt(g.skill * rebirthMult())} Power!`, '#5fe0ff')
      }
      if (g.boost) grant({ boost: g.boost, n: 1 })
      if (g.dice) grant({ dice: g.dice, n: 1 })
      if (!g.egg) celebrate()
      changed()
      hud.refreshWindow()
      refreshBadge()
    },
    openWindow: (id) => hud.openWindow(id),
    // --- My Pets: lock, fuse ---
    lockPet(uid) {
      const pet = state.pets.find((p) => p.uid === uid)
      if (!pet) return
      pet.locked = !pet.locked
      if (!pet.locked) delete pet.locked
      sfx.pop(!!pet.locked)
      changed()
      hud.refreshWindow()
    },
    // Three of the same pet + tier (not locked) become one of the next tier (Golden, then Diamond).
    fusePet(uid, quiet = false) {
      const pet = state.pets.find((p) => p.uid === uid)
      if (!pet) return false
      const ti = PET_TIERS.findIndex((t) => t.id === (pet.tier || ''))
      const next = PET_TIERS[ti + 1]
      if (!next) return false
      const same = state.pets.filter((p) => p.id === pet.id && p.tier === pet.tier && !p.locked).sort((a, b) => a.equipped - b.equipped)
      if (same.length < 3) {
        if (!quiet) {
          sfx.deny()
          hud.toast(`Fusing needs 3 unlocked ${petById(pet.id).name}s (you have ${same.length})`, '#ff6a6a')
        }
        return false
      }
      const used = same.slice(0, 3)
      const wasEquipped = used.some((p) => p.equipped)
      state.pets = state.pets.filter((p) => !used.includes(p))
      const made = addPet(pet.id, next.id)
      if (wasEquipped && !made.equipped && state.pets.filter((p) => p.equipped).length < petSlots()) made.equipped = true
      if (!quiet) {
        sfx.fanfare()
        hud.toast(`Fused into a ${next.name} ${petById(pet.id).name}!`, next.id === 'd' ? '#9fe8ff' : '#ffd23a')
        celebrate(next.id === 'd' ? ['#9fe8ff', '#ffffff', '#5fc8ff'] : ['#ffd23a', '#ffffff', '#ffb21f'])
        rebuildPets()
        changed()
        hud.refreshWindow()
      }
      return made
    },
    fuseAll() {
      let n = 0
      for (let guard = 0; guard < 500; guard++) {
        const groups = new Map()
        for (const p of state.pets) if (!p.locked && p.tier !== 'd') groups.set(`${p.id}:${p.tier}`, [...(groups.get(`${p.id}:${p.tier}`) ?? []), p])
        const g = [...groups.values()].find((x) => x.length >= 3)
        if (!g) break
        if (actions.fusePet(g[0].uid, true)) n++
        else break
      }
      if (!n) {
        sfx.deny()
        return hud.toast('Nothing to fuse: you need 3 of the same unlocked pet', '#ff6a6a')
      }
      sfx.fanfare()
      hud.toast(`Fused ${n} time${n > 1 ? 's' : ''}!`, '#ffd23a')
      celebrate()
      rebuildPets()
      changed()
      hud.refreshWindow()
    },
    // --- My Carts: buy (in shop order) ---
    buyCart(id) {
      const i = SLINGSHOTS.findIndex((c) => c.id === id)
      const c = SLINGSHOTS[i]
      if (!c || state.slingshots.includes(id)) return
      if (i > 0 && !state.slingshots.includes(SLINGSHOTS[i - 1].id)) {
        sfx.deny()
        return hud.toast(`Buy the ${SLINGSHOTS[i - 1].name} first!`, '#ff6a6a')
      }
      if (!spend(c.price)) return
      state.slingshots.push(id)
      state.equippedSling = id
      sfx.purchase()
      hud.toast(`Bought ${c.name}! +${c.fly}% FLY`, '#7dff7d')
      celebrate()
      changed()
      hud.refreshWindow()
    },
    // --- My Potions: a 3-pack for Wins ---
    buyPotions(kind) {
      const b = BOOSTS[kind]
      if (!b || !spend(b.pack3)) return
      state.potions[kind] = (state.potions[kind] ?? 0) + 3
      sfx.purchase()
      hud.toast(`+3 ${b.name}s!`, b.color)
      changed()
      hud.refreshWindow()
    },
    // --- Auras ---
    // One roll with die `id` (AURA_ROLLS): uses an owned die, else pays its Wins price. Returns
    // { aura, isNew } (the window shows it) or null.
    rollAura(id, auto = false) {
      const d = AURA_ROLLS.find((x) => x.id === id)
      if (!d) return null
      if (d.id !== 'roll' && (state.dice[d.id] ?? 0) > 0) state.dice[d.id]--
      else if (state.wins < d.price) {
        if (!auto) {
          sfx.deny()
          hud.toast(`Not enough Wins! Need ${fmtShort(d.price - state.wins)} more`, '#ff6a6a')
        }
        return null
      } else {
        state.wins -= d.price
        state.stats.spent += d.price
      }
      const aura = rollAura(auraLuck(d.luck))
      const isNew = !state.auras.includes(aura.id)
      if (isNew) state.auras.push(aura.id)
      state.stats.rolls = (state.stats.rolls ?? 0) + 1
      // equip it when it beats the equipped one
      const cur = auraById(state.aura)
      if (!cur || aura.power > cur.power) state.aura = aura.id
      if (isNew || aura.n >= 1000) {
        sfx.fanfare()
        hud.toast(`${isNew ? 'NEW AURA: ' : ''}${aura.name}! (1 in ${fmt(aura.n)})`, aura.colors[0])
        if (aura.n >= 300) celebrate(aura.colors)
      } else sfx.pop(true)
      glow.set(auraById(state.aura))
      changed()
      return { aura, isNew }
    },
    toggleAutoRoll() {
      autoRoll = !autoRoll
      autoAcc = 0
      hud.toast(autoRoll ? 'Auto Roll on' : 'Auto Roll off', autoRoll ? '#7dff7d' : '#ffffff')
    },
    autoRolling: () => autoRoll,
    buyAuraPass(id) {
      const p = AURA_PASSES.find((x) => x.id === id)
      if (!p || hasPass(id)) return
      if (!spend(p.price)) return
      state.passes[id] = true
      sfx.purchase()
      hud.toast(`x${p.mult} Aura Luck forever!`, '#7dff5a')
      celebrate(['#7dff5a', '#ffd23a', '#ffffff'])
      changed()
      hud.refreshWindow()
    },
    equipAura(id) {
      if (id && !state.auras.includes(id)) return
      state.aura = id
      if (id) sfx.equip()
      else sfx.pop(false)
      glow.set(auraById(state.aura))
      changed()
      hud.refreshWindow()
    },
    // --- Quests ---
    claimQuest(id) {
      const q = state.quests.find((x) => x.id === id)
      if (!q || !questProgress(q).done) return
      const d = questById(id)
      state.quests = state.quests.filter((x) => x !== q)
      state.questsDone = (state.questsDone ?? 0) + 1
      grant(d.reward)
      celebrate()
      fillQuests()
      changed()
      hud.update()
    },
    openItems() {
      hud.openInventoryTab?.('potions')
    },
    hatch(eggId, n = 1, opts) {
      return eggs.hatch(eggId, n, opts)
    },
    trainHold(on) {
      trainHeld = on
    },
  }

  // ---------------------------------------------------------------------------
  // Training
  // ---------------------------------------------------------------------------
  let trainHeld = false
  let keyTrain = false
  let trainTimer = 0
  let currentTable = null
  // pops, sounds, streak, level ups, table effects, arm spring: training.js
  // Every trampoline landing (none in the hub: treadmills train by running) counts as one click.
  const onBounce = () => {
    if (!fl.active() && !windowOpen && !eggs.busy()) train(true)
  }
  const training = createTraining({ scene, camera, fx, player, tables: props.tables, onBounce })
  const slingPos = new Vector3()
  let lastTrainAt = -Infinity
  function train(bounce = false) {
    const now = performance.now() / 1000
    if (now - lastTrainAt < TRAIN.cooldown) return
    lastTrainAt = now
    const mult = currentTable && platformUnlocked(currentTable.data) ? currentTable.data.mult : 1
    const gain = skillPerClick(mult)
    addSkill(gain)
    state.stats.trains = (state.stats.trains ?? 0) + 1
    training.shot({ gain, mult, table: currentTable, bounce, from: !bounce && heldSling ? heldSling.getWorldPosition(slingPos) : null })
    if (state.autoRebirth && canRebirth()) actions.rebirth()
    changed()
  }
  window.addEventListener('pointerdown', (e) => {
    if (e.target?.tagName === 'CANVAS' && e.button === 0 && e.pointerType === 'mouse') trainHeld = true
  })
  window.addEventListener('pointerup', (e) => {
    if (e.pointerType === 'mouse') trainHeld = false
  })
  window.addEventListener('blur', () => {
    trainHeld = false
    keyTrain = false
  })

  // E: buy at a prompt / else hold to train. At an egg, eggs.js owns E / R / T.
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return
    if (e.code === 'KeyE') {
      if (eggs.near()) return
      if (buyInfo?.onBuy) buyInfo.onBuy()
      else if (buyInfo?.onAd) buyInfo.onAd()
      else keyTrain = true
    }
  })
  window.addEventListener('keyup', (e) => {
    if (e.code === 'KeyE') keyTrain = false
  })

  // ---------------------------------------------------------------------------
  // Held slingshot, name tag, arm pose
  // ---------------------------------------------------------------------------
  let avatar = null
  let animator = null
  let heldSling = null
  let heldStyle = null
  let playerGroup = null
  let armBinding = null
  const holdQ = new Quaternion()
  const nameTag = makeSign(0.42)
  function attachSling() {
    if (!playerGroup) return
    const style = slingById(state.equippedSling)?.style ?? 'twig'
    if (heldSling && heldStyle === style && heldSling.parent) return
    heldSling?.parent?.remove(heldSling)
    heldStyle = style
    if (isCartStyle(style)) {
      // carts are ridden in the launch, not held: no item in the hand, the arm stays down
      heldSling = null
      armBinding = null
      return
    }
    heldSling = buildSlingshot(style)
    heldSling.traverse((o) => (o.castShadow = true))
    const arm1 = avatar?.nodes?.ArmR1
    const arm2 = avatar?.nodes?.ArmR2
    armBinding = animator?.rig?.bindings?.find((b) => b.bone === arm1) ?? null
    if (arm1 && arm2 && armBinding) {
      // Solve the attach once in the hold pose so the slingshot then follows the arm.
      animator.rig.resetToBindPose()
      armBinding.bone.quaternion.premultiply(holdQ.setFromAxisAngle(armBinding.axisX, -1.25))
      playerGroup.updateMatrixWorld(true)
      const inv = new Matrix4().copy(playerGroup.matrixWorld).invert()
      const m1 = new Matrix4().multiplyMatrices(inv, arm1.matrixWorld)
      const m2 = new Matrix4().multiplyMatrices(inv, arm2.matrixWorld)
      const p1 = new Vector3().setFromMatrixPosition(m1)
      const p2 = new Vector3().setFromMatrixPosition(m2)
      const hand = p2.clone().add(p2.clone().sub(p1).multiplyScalar(0.95))
      const desired = new Matrix4().compose(hand.add(new Vector3(0, -0.25, 0.05)), new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), 0.25), new Vector3(0.48, 0.48, 0.48))
      const local = new Matrix4().copy(m2).invert().multiply(desired)
      heldSling.matrixAutoUpdate = false
      heldSling.matrix.copy(local)
      arm2.add(heldSling)
    } else {
      heldSling.position.set(0.45, 0.75, 0.45)
      heldSling.scale.setScalar(0.48)
      playerGroup.add(heldSling)
    }
  }
  function setAvatar(group, av, anim) {
    playerGroup = group
    avatar = av
    animator = anim
    heldSling = null
    fl.setAnimator(anim)
    attachSling()
    if (!nameTag.parent) {
      nameTag.position.set(0, 2.75, 0)
      group.add(nameTag)
    }
  }
  function titleFor() {
    const t = titleById(state.title)
    return t && titleOwned(t) ? [t.name, t.color] : null
  }
  function updateNameTag() {
    const tt = titleFor()
    if (!tt) return nameTag.set([{ text: bloxity.displayName?.() || 'Player', size: 0.75 }])
    const [title, color] = tt
    nameTag.set([{ text: title, color, size: 1 }, { text: bloxity.displayName?.() || 'Player', size: 0.75 }])
  }

  // ---------------------------------------------------------------------------
  // Pads, tables, labels
  // ---------------------------------------------------------------------------
  function refreshPads() {
    for (const pad of props.pads) {
      const sl = SLINGSHOTS[pad.index]
      pad.setState(state.equippedSling === sl.id ? 'equipped' : state.slingshots.includes(sl.id) ? 'owned' : pad.index > 0 && !state.slingshots.includes(SLINGSHOTS[pad.index - 1].id) ? 'locked' : 'unlocked')
    }
  }
  function refreshTables() {
    for (const t of props.tables) {
      const p = t.data
      const open = platformUnlocked(p)
      const lines = []
      if (p.price) {
        lines.push({ text: 'IN EVERY WORLD', size: 0.4 })
        lines.push({ text: `${fmtShort(p.price)} Wins`, icon: 'trophy', color: '#ffd23a', pill: true, size: 0.48 })
      } else if (p.rebirths) lines.push({ text: `${p.rebirths}`, icon: 'rebirth', pill: true, size: 0.5 })
      lines.push({ text: open ? 'UNLOCKED' : 'LOCKED', color: open ? '#4dff6a' : '#ff3b3b', pill: true, size: 0.42 })
      lines.push({ text: `x${p.mult.toLocaleString('en-US')} POWER`, color: p.style === 'royal' ? '#ffe27a' : '#ffffff', size: 0.95 })
      t.sign.set(lines)
    }
  }
  let padInside = -1
  function checkPads() {
    const p = player.position
    let inside = -1
    for (const pad of props.pads) {
      if (Math.abs(p.x - pad.x) < pad.half && Math.abs(p.z - pad.z) < pad.half && p.y > pad.y - 0.2 && p.y < pad.y + 1.5) inside = pad.index
    }
    if (inside !== padInside && inside >= 0) {
      const sl = SLINGSHOTS[inside]
      if (state.slingshots.includes(sl.id)) {
        if (state.equippedSling !== sl.id) {
          state.equippedSling = sl.id
          hud.toast(`Equipped ${sl.name}`, '#7dff7d')
          training.equipSling()
          changed()
        }
      } else if (inside > 0 && !state.slingshots.includes(SLINGSHOTS[inside - 1].id)) {
        // slingshots unlock in order: the previous one must be owned first
        hud.toast(`Buy the ${SLINGSHOTS[inside - 1].name} first!`, '#ff6a6a')
        training.cantAfford()
      } else if (state.wins >= sl.price) {
        state.wins -= sl.price
        state.slingshots.push(sl.id)
        state.equippedSling = sl.id
        hud.toast(`Bought ${sl.name}! +${fmt(sl.skill)} Skill per click`, '#7dff7d')
        celebrate()
        training.buySling()
        changed()
      } else {
        hud.toast(`${sl.name} costs ${fmt(sl.price)} Wins`, '#ff6a6a')
        training.cantAfford()
      }
    }
    padInside = inside
  }
  let tableInside = null
  let tableToastAt = 0
  let running = false // running in place on a treadmill belt (main.js animates it, see runSpeed)
  // On a treadmill's belt: inside its oriented rectangle (t.belt), at deck height.
  function onBelt(t, p) {
    if (p.y < t.topY - 0.5 || p.y > t.topY + 1.5) return false
    const b = t.belt
    const dx = p.x - t.x
    const dz = p.z - t.z
    return Math.abs(dx * b.dx + dz * b.dz) < b.halfLen && Math.abs(dz * b.dx - dx * b.dz) < b.halfWid
  }
  function checkTables(now) {
    const p = player.position
    let on = null
    for (const t of props.tables) if (onBelt(t, p)) on = t
    if (on !== tableInside) {
      tableInside = on
      training.enterTable(on)
      if (on && !platformUnlocked(on.data) && now - tableToastAt > 1500) {
        tableToastAt = now
        hud.toast(on.data.price ? `Locked: ${fmtShort(on.data.price)} Wins to unlock` : `Locked: needs ${on.data.rebirths} Rebirths`, '#ff6a6a')
      }
    }
    currentTable = on
    // Standing still on an unlocked belt: face the console and run in place; every step trains
    // (train() is rate-limited by TRAIN.cooldown, like holding the click).
    running = !!on && platformUnlocked(on.data) && player.grounded && Math.hypot(player.velocity.x, player.velocity.z) < 0.5 && !windowOpen && !eggs.busy()
    if (running) {
      player.facing = Math.atan2(on.belt.dx, on.belt.dz)
      train()
      if (Math.random() < 0.3) fx.burst(1, { x: p.x - on.belt.dx * 0.6, y: p.y + 0.15, z: p.z - on.belt.dz * 0.6, spread: 0.8, speed: 1.2, lift: 1.5, life: 0.6, size: 0.3, color: [on.color, '#ffffff'], shape: 'star' })
    }
  }

  // ---------------------------------------------------------------------------
  // Eggs, stands, chest, portal (proximity prompts)
  // ---------------------------------------------------------------------------
  // Egg panel, hatching, Auto, the +3/+8/+16 upgrades: eggs.js.
  const eggs = createEggs({ camera, fx, props, hud, spend, celebrate, onPets: () => rebuildPets() })
  let nearEgg = null
  let buyInfo = null
  function checkNear() {
    const p = player.position
    nearEgg = eggs.near()?.data ?? null
    buyInfo = null
    if (fl.active()) {
      hud.showEggPrompt(null)
      return
    }
    if (!nearEgg) {
      for (const s of props.stands) {
        if (Math.hypot(p.x - s.x, p.z - s.z) < 3.8) {
          const sp = s.data
          buyInfo = { key: sp.id, title: sp.name, img: petThumb(sp.id), text: `${sp.rarity} pet · +${fmt(sp.boost * 100)}% Skill`, price: sp.price, onBuy: () => actions.buyStand(sp.id) }
        }
      }
      if (tableInside && !platformUnlocked(tableInside.data) && tableInside.data.price) {
        const t = tableInside.data
        buyInfo = { key: t.id, title: `x${t.mult} Power Treadmill`, text: 'Unlock this treadmill in every world.', price: t.price, onBuy: () => buyTable(t) }
      }
    }
    // Free Rewards Chest + a rewarded ad: double the reward just claimed, or open it while it refills.
    if (!buyInfo && !nearEgg && chestNear && !adBusy && bloxity.rewardedReady()) {
      if (chestBonus) buyInfo = { key: 'chest-double', title: 'Free Rewards Chest', text: `Watch a short ad to double it: +${fmt(chestBonus)} Wins`, adText: 'Double Reward', onAd: () => chestAd('double') }
      else if (Date.now() < state.chestAt) buyInfo = { key: 'chest-open', title: 'Free Rewards Chest', text: 'Watch a short ad to open it right now!', adText: 'Open Now', onAd: () => chestAd('open') }
    }
    if (buyInfo && !nearEgg) hud.showBuy(buyInfo)
    else hud.showEggPrompt(null)
  }
  function buyTable(t) {
    if (state.platforms.includes(t.id) || !spend(t.price)) return
    state.platforms.push(t.id)
    hud.toast(`x${t.mult} Power treadmill unlocked!`, '#7dff7d')
    celebrate()
    changed()
  }
  let chestNear = false
  let chestBonus = 0 // Wins the chest just paid: a rewarded ad can double them while the player stays here
  let adBusy = false // a rewarded ad is playing
  // Pays the chest (the free one, or the one a rewarded ad opened early) and restarts its cooldown.
  function claimChest(nowMs) {
    const w = CHEST.wins * rebirthMult()
    state.wins += w
    state.chestAt = nowMs + CHEST.cooldown * 1000
    state.stats.chests++
    sfx.gift('trophy')
    hud.toast(`Free Rewards! +${fmt(w)} Wins`, '#ffd23a')
    celebrate(['#ffd23a', '#ff3b3b', '#ffffff'])
    changed()
    return w
  }
  // Rewarded ad at the chest: 'double' = the reward just claimed again, 'open' = open it before it
  // refills. The reward is granted only when the ad was watched to the end (bloxity.showRewarded).
  async function chestAd(kind) {
    if (adBusy) return
    adBusy = true
    const ok = await bloxity.showRewarded(kind === 'double' ? 'chest-double' : 'chest-open')
    adBusy = false
    if (!ok) return hud.toast('No reward: the ad did not finish', '#ff6a6a')
    if (kind === 'double') {
      if (!chestBonus) return
      state.wins += chestBonus
      sfx.gift('trophy')
      hud.toast(`Ad bonus! +${fmt(chestBonus)} Wins`, '#ffd23a')
      celebrate(['#ffd23a', '#7dff7d', '#ffffff'])
      chestBonus = 0
      changed()
    } else if (Date.now() < state.chestAt) {
      claimChest(Date.now())
      chestBonus = 0 // one ad per opening
    }
  }
  function checkChest(nowMs) {
    const c = props.chest
    const p = player.position
    const near = Math.hypot(p.x - c.x, p.z - c.z) < 4.2
    const ready = nowMs >= state.chestAt
    if (near && !chestNear) {
      if (ready) chestBonus = claimChest(nowMs)
      else hud.toast('Chest refills soon!', '#ffffff')
    }
    if (!near) chestBonus = 0
    chestNear = near
  }
  let portalNear = false
  function checkPortal() {
    const p = player.position
    const near = Math.hypot(p.x - props.portal.x, p.z - props.portal.z) < 5
    if (near && !portalNear) hud.toast(state.bestSkill >= WORLD2_SKILL ? 'World 2 opens in the next update!' : `World 2 needs ${fmtShort(WORLD2_SKILL)} Skill`, '#ffd23a')
    portalNear = near
  }

  // ---------------------------------------------------------------------------
  // The cart launch: the whole sequence lives in flight.js (LAUNCH button, starting
  // gate + cart, the ride, the throw, tumble, reward, region gates, sounds).
  // ---------------------------------------------------------------------------
  const fl = createFlight({
    scene,
    camera,
    fx,
    ringPulse: (...a) => ringPulse(...a),
    blocked: () => windowOpen || eggs.busy(),
    onDone: () => updateNameTag(),
  })
  const teleportToZone = () => fl.teleportToZone()

  // Expanding glow ring (launch, splash, rebirth).
  const rings = []
  function ringPulse(x, y, z, color, size = 6) {
    const m = new Mesh(new RingGeometry(0.7, 1, 40).rotateX(-Math.PI / 2), new MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }))
    m.position.set(x, y, z)
    scene.add(m)
    rings.push({ m, t: 0, size })
  }
  function updateRings(dt) {
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i]
      r.t += dt
      const k = r.t / 0.8
      r.m.scale.setScalar(1 + k * r.size)
      r.m.material.opacity = 0.9 * (1 - k)
      if (k >= 1) {
        scene.remove(r.m)
        r.m.geometry.dispose()
        r.m.material.dispose()
        rings.splice(i, 1)
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Pets following the player
  // ---------------------------------------------------------------------------
  const petRoot = new Group()
  scene.add(petRoot)
  let petModels = [] // { uid, mesh, pos }
  function rebuildPets() {
    const eq = state.pets.filter((p) => p.equipped)
    const key = eq.map((p) => p.uid).join(',')
    if (petRoot.userData.key === key) return
    petRoot.userData.key = key
    for (const pm of petModels) petRoot.remove(pm.mesh)
    petModels = eq.map((p) => {
      const mesh = buildPet(petById(p.id).look)
      mesh.scale.setScalar(1.05)
      const pos = new Vector3(player.position.x, player.position.y, player.position.z + 2)
      mesh.position.copy(pos)
      petRoot.add(mesh)
      return { uid: p.uid, mesh, pos }
    })
  }
  const tmpV = new Vector3()
  function updatePets(dt, t) {
    const n = petModels.length
    const p = player.renderPosition
    const f = player.facing
    petModels.forEach((pm, i) => {
      // fan out behind the player
      const spread = (i - (n - 1) / 2) * 1.8
      const back = 2.4 + Math.abs(spread) * 0.3
      const bx = p.x - Math.sin(f) * back + Math.cos(f) * spread
      const bz = p.z - Math.cos(f) * back - Math.sin(f) * spread
      const fly = petById(state.pets.find((q) => q.uid === pm.uid)?.id)?.look?.wings
      const by = p.y + (fly ? 1.2 : 0) + Math.abs(Math.sin(t * 6 + i)) * (fl.active() ? 0 : 0.25)
      tmpV.set(bx, by, bz)
      if (pm.pos.distanceToSquared(tmpV) > 60 * 60) pm.pos.copy(tmpV)
      pm.pos.lerp(tmpV, 1 - Math.exp(-(fl.active() ? 14 : 7) * dt))
      pm.mesh.position.copy(pm.pos)
      pm.mesh.rotation.y = f
      animatePet(pm.mesh, t + i, true)
    })
  }

  // ---------------------------------------------------------------------------
  // Leaderboards, signs, gifts
  // ---------------------------------------------------------------------------
  function boardRows(myValue, unitFmt, scale) {
    const rows = BOT_NAMES.slice(0, 11).map((name, i) => ({ name, raw: scale * Math.pow(0.82, i) * (1 + (i * 37) % 7 * 0.01), color: BOT_COLORS[i] }))
    rows.push({ name: bloxity.displayName?.() || 'You', raw: myValue, color: '#7dff7d', me: true })
    rows.sort((a, b) => b.raw - a.raw)
    return rows.slice(0, 11).map((r) => ({ ...r, value: unitFmt(r.raw) }))
  }
  const hm = (s) => `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h`
  // Real boards from the server (net.js `leaderboard`: the top saved players per stat + this player's
  // rank), set by setBoards(); until the first one arrives (solo play / no server) the bot rows show.
  let serverBoards = null
  function realRows(stat, myValue, unitFmt) {
    const top = serverBoards.boards?.[stat] ?? []
    const myRank = serverBoards.ranks?.[stat] ?? null
    const rows = top.map((r, i) => ({ name: r.name, raw: r.value, value: unitFmt(r.value), color: BOT_COLORS[i % BOT_COLORS.length], me: myRank === i + 1 }))
    // Not in the top list (or not saved yet): show this player's own row anyway.
    if (!rows.some((r) => r.me)) rows.push({ name: bloxity.displayName?.() || 'You', raw: myValue, value: unitFmt(myValue), color: '#7dff7d', me: true })
    return rows.slice(0, 11)
  }
  function refreshBoards() {
    const lv = levelInfo().level
    if (serverBoards) {
      props.boards[0].set(realRows('bestSkill', state.bestSkill, fmtShort))
      props.boards[1].set(realRows('playTime', state.playTime, hm))
      props.boards[2].set(realRows('level', lv, fmt))
      props.boards[3].set(realRows('wins', state.wins, fmtShort))
      return
    }
    props.boards[0].set(boardRows(state.bestSkill, fmtShort, 8.2e9))
    props.boards[1].set(boardRows(state.playTime, hm, 4.3e5))
    props.boards[2].set(boardRows(lv, fmt, 19091))
    props.boards[3].set(boardRows(state.wins, fmtShort, 6.2e9))
  }
  function setBoards(msg) {
    serverBoards = msg
    refreshBoards()
  }
  // A saved game loaded from the server replaced `state`: rebuild everything derived from it.
  function resync() {
    checkMilestones()
    fillQuests()
    glow.set(auraById(state.aura))
    applySettings()
    rebuildPets()
    refreshPads()
    refreshTables()
    updateNameTag()
    attachSling()
    hud.update()
    hud.refreshWindow()
  }
  function refreshSigns(nowMs) {
    const left = Math.max(0, state.chestAt - nowMs) / 1000
    props.chest.sign.set([{ text: 'DAILY CHEST', color: '#ffd23a', outline: '#5a2a00', size: 1 }, { text: left > 0 ? `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}` : 'Ready!', color: left > 0 ? '#ffffff' : '#7dff7d', size: 0.7 }])
    refreshBadge()
    if (rollDaily()) {
      changed()
      if (hud.openId === 'daily') hud.refreshWindow()
    }
    hud.tick()
  }

  // Rebirth milestones (REBIRTH_MILESTONES): each pet is given once when the rebirths reach it.
  function checkMilestones() {
    let got = false
    for (const m of REBIRTH_MILESTONES) {
      if (state.rebirths >= m.at && !state.milestones.includes(m.pet)) {
        state.milestones.push(m.pet)
        addPet(m.pet)
        hud.toast(`Milestone! ${petById(m.pet).name} joined you!`, '#d8a8ff')
        got = true
      }
    }
    if (got) {
      sfx.gift('pet')
      rebuildPets()
      changed()
    }
  }
  // Auras: the glow around the player (auraGlow.js) and Auto Roll (a basic Roll every AURA_AUTO.every s).
  const glow = createAuraGlow(scene)
  let autoRoll = false
  let autoAcc = 0
  function updateAutoRoll(dt) {
    if (!autoRoll) return
    autoAcc += dt
    if (autoAcc < AURA_AUTO.every) return
    autoAcc = 0
    const res = actions.rollAura('roll', true)
    if (!res) {
      autoRoll = false
      hud.toast('Auto Roll stopped: not enough Wins', '#ff6a6a')
      return hud.refreshWindow()
    }
    hud.auraRolled(res, 350)
  }

  // ---------------------------------------------------------------------------
  // Frame
  // ---------------------------------------------------------------------------
  let secAcc = 1
  let boardAcc = 0
  let trainingActive = false
  let lastEquipped = null
  function update(dt, t) {
    const now = performance.now()
    const nowMs = Date.now()
    state.playTime += dt
    for (const k in state.boostLeft) {
      if (state.boostLeft[k] > 0) {
        state.boostLeft[k] = Math.max(0, state.boostLeft[k] - dt)
        if (state.boostLeft[k] === 0) {
          hud.toast(`${BOOSTS[k].name} ran out`, '#ffffff')
          changed()
        }
      }
    }

    // training (not while flying, hatching or in a window)
    const trainingNow = (trainHeld || keyTrain) && !fl.active() && !windowOpen && !eggs.busy()
    trainingActive = trainingNow
    trainTimer -= dt
    if (trainingNow && trainTimer <= 0) {
      train()
      trainTimer = TRAIN.interval
    }

    lastDt = dt
    running = false
    if (!fl.active()) {
      checkPads()
      checkTables(now)
      checkChest(nowMs)
      checkPortal()
    }
    eggs.update(dt, t, { blocked: fl.active() || windowOpen })
    checkNear()
    fl.update(dt, t)

    if (state.equippedSling !== lastEquipped) {
      lastEquipped = state.equippedSling
      refreshPads()
      attachSling()
    }
    if (heldSling) heldSling.visible = !fl.active()

    updatePets(dt, t)
    updateRings(dt)
    updateAutoRoll(dt)
    glow.update(dt, t, player.renderPosition, fl.active())
    training.update(dt, { table: currentTable, active: !fl.active() })

    secAcc += dt
    if (secAcc >= 1) {
      secAcc = 0
      refreshSigns(nowMs)
      refreshTables()
    }
    boardAcc -= dt
    if (boardAcc <= 0) {
      boardAcc = 20
      refreshBoards()
    }
  }
  // After the animator: raise the right arm to hold the slingshot (with a pull-back on each shot).
  let lastDt = 1 / 60
  function afterAnimator() {
    if (playerGroup) fl.applyPose(playerGroup, lastDt)
    if (!armBinding || fl.active()) return
    armBinding.bone.quaternion.premultiply(holdQ.setFromAxisAngle(armBinding.axisX, -1.25 + training.armPull() * 0.5))
  }

  // initial state
  rollDaily()
  checkMilestones()
  fillQuests()
  glow.set(auraById(state.aura))
  applySettings()
  rebuildPets()
  refreshPads()
  refreshTables()
  updateNameTag()
  bloxity.subscribeAuth?.(() => updateNameTag())

  return { actions, checkOffline, update, afterAnimator, setAvatar, isFlying: () => fl.active(), isTraining: () => trainingActive, runSpeed: () => (running ? HUB.treadmillRun : 0), setBoards, resync, flight: fl, eggs }
}

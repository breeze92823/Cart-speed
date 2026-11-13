import { Group } from 'three'
import { HUB } from '../config.js'
import { buildGround } from './ground.js'
import { buildTreadmills } from './treadmills.js'
import { buildCartShop } from './carts.js'
import { buildBoards, buildDailyChest, buildEggCourt, buildLamps, buildLaunchBoard, buildPortal, buildStands } from './props.js'

// The lobby (the hub): builds the ground and every set piece, and returns the handles game.js,
// eggs.js and training.js drive (the same shape the old lobby props had):
//   pads    the Cart Shop pads (SLINGSHOTS: the carts)      tables  the treadmills (PLATFORMS)
//   eggs    the egg court (EGGS)                            stands  the limited pet stands
//   chest   the daily (Free Rewards) chest                  boards  [skill, time, level, wins]
//   portal  the WORLDS portal (World 2 gate)                update(dt, t)
export function buildHub(scene, fx) {
  const root = new Group()
  root.name = 'hub'
  scene.add(root)

  const ground = buildGround(root, fx)
  const treadmills = buildTreadmills(root, fx)
  const shop = buildCartShop(root, fx)
  const portal = buildPortal(root, fx)
  const stands = buildStands(root, fx)
  const eggs = buildEggCourt(root, fx)
  const chest = buildDailyChest(root, fx)
  const anims = [ground.update, treadmills.update, shop.update, portal.update, stands.update, eggs.update, chest.update, buildLamps(root)]
  buildLaunchBoard(root)
  const boards = buildBoards(root)
  const byStat = (stat) => boards.find((b) => b.stat === stat)

  return {
    pads: shop.pads,
    tables: treadmills.tables,
    eggs: eggs.eggs,
    stands: stands.stands,
    chest: chest.chest,
    boards: [byStat('bestSkill'), byStat('playTime'), byStat('level'), byStat('wins')],
    portal: { x: HUB.portal.x, z: HUB.portal.z },
    update(dt, t) {
      for (const a of anims) a(dt, t)
    },
  }
}

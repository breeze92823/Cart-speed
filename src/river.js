import { Group } from 'three'
import { CHANNEL, PLAZA, RIVER_REGIONS } from './config.js'
import { legoBoxGeo, legoMat, mergedMesh } from './legokit.js'
import { label } from './propkit.js'
import { buildRoadside } from './roadside.js'

// Region dressing along the lane: the towns on both sides (roadside.js: villages, rural
// towns, urban towns, cities) and a gate at the start of every region after the first (two
// lego pillars on the sidewalks, a beam across the road and the region's name floating above
// it). Static; one merged mesh per material.

export function buildRiver(scene) {
  const root = new Group()
  root.name = 'river-regions'
  scene.add(root)
  buildRoadside(root)
  const W = CHANNEL.halfWidth
  const gateH = 19

  RIVER_REGIONS.forEach((r, i) => {
    if (i === 0) return
    const z = PLAZA.minZ - r.at
    const geos = []
    const trims = []
    for (const side of [-1, 1]) {
      const x = side * (W + 1.5)
      geos.push(legoBoxGeo(3, gateH + 7, 3, x, (gateH - 7) / 2, z))
      trims.push(legoBoxGeo(3.8, 1.2, 3.8, x, gateH + 0.1, z), legoBoxGeo(3.8, 1.2, 3.8, x, 4, z))
    }
    geos.push(legoBoxGeo(W * 2 + 6, 1.8, 2.2, 0, gateH + 1.5, z))
    root.add(mergedMesh(geos, legoMat(r.gate[0]), { cast: false }))
    root.add(mergedMesh(trims, legoMat(r.gate[1], { emissive: r.color, emissiveIntensity: 0.25 }), { cast: false }))
    const sign = label(r.name, 11, { colors: [r.color], outline: '#ffffff', outlineWidth: 20 })
    sign.position.set(0, gateH + 10, z)
    root.add(sign)
  })
  return root
}

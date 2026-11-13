// Body poses of the cart launch, written over the animator output: used by flight.js for the local
// player and by remotePlayers.js for everyone else's launch (from the `body` / `arms` / `pull` pose
// fields), so both look the same. Character space: +x swings a limb backward, legs forward = -x,
// knees / elbows bend with +x, ArmL z+ / ArmR z- = out to the side.
const deg = (d) => (d * Math.PI) / 180

export const POSES = {
  sit: {
    LegL1: { x: deg(-76), z: deg(9) }, LegR1: { x: deg(-76), z: deg(-9) }, LegL2: { x: deg(42) }, LegR2: { x: deg(42) },
    ArmL1: { x: deg(-58), z: deg(22) }, ArmR1: { x: deg(-58), z: deg(-22) }, ArmL2: { x: deg(38) }, ArmR2: { x: deg(38) },
    Spine1: { x: deg(4) },
  },
  // thrown: arms flung up and wide, legs trailing
  fling: {
    LegL1: { x: deg(18), z: deg(16) }, LegR1: { x: deg(-10), z: deg(-16) }, LegL2: { x: deg(40) }, LegR2: { x: deg(55) },
    ArmL1: { x: deg(-150), z: deg(48) }, ArmR1: { x: deg(-150), z: deg(-48) }, ArmL2: { x: deg(20) }, ArmR2: { x: deg(20) },
    Spine1: { x: deg(-12) }, Neck1: { x: deg(-18) },
  },
  // bouncing on the asphalt: limbs all over the place
  tumble: {
    LegL1: { x: deg(-40), z: deg(30) }, LegR1: { x: deg(20), z: deg(-34) }, LegL2: { x: deg(70) }, LegR2: { x: deg(35) },
    ArmL1: { x: deg(-100), z: deg(80) }, ArmR1: { x: deg(-60), z: deg(-85) }, ArmL2: { x: deg(45) }, ArmR2: { x: deg(30) },
    Spine1: { x: deg(18) },
  },
  // face down on the road, spread out like a starfish
  lie: {
    LegL1: { x: deg(-4), z: deg(20) }, LegR1: { x: deg(-4), z: deg(-22) }, LegL2: { x: deg(14) }, LegR2: { x: deg(8) },
    ArmL1: { x: deg(-128), z: deg(52) }, ArmR1: { x: deg(-122), z: deg(-58) }, ArmL2: { x: deg(16) }, ArmR2: { x: deg(22) },
    Spine1: { x: deg(-6) }, Neck1: { x: deg(-24), y: deg(18) },
  },
}

// The pose kinds as sent over the network (pose `body`): index = code.
export const BODY_KINDS = ['', 'sit', 'fling', 'tumble', 'lie']

// Fills `target` (a PoseBuffer) with pose `kind` at `time` s. o: { lean (rad, sitting), riding (in
// the cart on the way: kicking feet, gripping), armsUp (0..1, arms up over the head), twitch (0..1,
// a dazed twitch lying down) }.
export function writeRidePose(target, kind, time, o = {}) {
  target.applyDefinition(POSES[kind])
  if (kind === 'fling') {
    // windmilling arms, kicking legs
    const a = Math.sin(time * 16)
    target.add('ArmL1', a * 0.6, 0, Math.cos(time * 13) * 0.3)
    target.add('ArmR1', -a * 0.6, 0, Math.cos(time * 14) * 0.3)
    target.add('LegL1', Math.sin(time * 18) * 0.5)
    target.add('LegR1', -Math.sin(time * 18) * 0.5)
  } else if (kind === 'tumble') {
    target.add('ArmL1', Math.sin(time * 21) * 0.5, 0, Math.sin(time * 17) * 0.3)
    target.add('ArmR1', Math.sin(time * 19 + 1) * 0.5, 0, Math.sin(time * 15) * 0.3)
    target.add('LegL1', Math.sin(time * 23) * 0.4)
    target.add('LegR1', Math.sin(time * 20 + 2) * 0.4)
  } else if (kind === 'sit') {
    // grip, lean into the draw / the speed, a happy kick of the feet while riding
    const lean = o.lean ?? 0
    target.add('Spine1', lean)
    target.add('Neck1', -lean * 0.6)
    if (o.riding) {
      target.add('LegL1', Math.sin(time * 9) * 0.08)
      target.add('LegR1', -Math.sin(time * 9) * 0.08)
      target.add('ArmL1', -0.25)
      target.add('ArmR1', -0.25)
      // up in the sky the arms go up over the head, waving ("wheee")
      const u = o.armsUp ?? 0
      if (u > 0.01) {
        const wave = Math.sin(time * 11) * 0.3 * u
        target.add('ArmL1', -1.75 * u + wave, 0, 0.35 * u)
        target.add('ArmR1', -1.75 * u - wave, 0, -0.35 * u)
        target.add('ArmL2', -0.4 * u)
        target.add('ArmR2', -0.4 * u)
        target.add('LegL1', Math.sin(time * 13) * 0.18 * u)
        target.add('LegR1', -Math.sin(time * 13) * 0.18 * u)
      }
    }
  } else if (kind === 'lie') {
    const tw = o.twitch ?? 0
    target.add('LegL2', tw * 0.4)
    target.add('ArmR1', 0, 0, -tw * 0.2)
  }
  return target
}

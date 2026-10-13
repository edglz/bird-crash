# Research: how Angry Birds works

Base document for the clone. It separates what is **verified in sources** from what is **assumed or approximate**. Rovio's exact formulas are not public.

## 1. Physics engine

- Angry Birds uses **Box2D** for birds, wood, blocks, and pigs. Rovio confirmed this at GDC 2011, according to [TechCrunch](https://techcrunch.com/2011/02/28/creator-of-angry-birds-physics-engine-calls-out-rovio-for-not-giving-him-credit/) and [PocketGamer](https://www.pocketgamer.com/angry-birds/physics-engine-creator-calls-out-angry-birds-developer-rovio-at-gdc/).
- The 2022 remake uses Unity but keeps Box2D, according to a [fan wiki](https://angrybirds.fandom.com/wiki/Rovio_Classics:_Angry_Birds) (secondary source).
- **Implication for the clone:** a rigid 2D engine with bodies, friction, restitution, and contacts is enough. We used **Matter.js** (the same rigid-body approach with contact impulses, without native Box2D) in the prototype.

## 2. Launch physics

- The launch is **ballistic**: the bird leaves with an initial velocity and gravity curves it into a parabola. A physics exercise describes it this way and observes that the red bird follows a parabolic trajectory (source: [APlusPhysics](https://aplusphysics.com/community/index.php?%2Fblogs%2Fentry%2F31034-physics-of-angry-birds%2F=); we could not read it in full).
- In the real game, speed depends on how far you pull the slingshot and on its angle: more pull, more speed and range ([StrategyWiki](https://strategywiki.org/wiki/Angry_Birds/Controls)).
- **Decision in the clone:** velocity = `-pull × LAUNCH_K`, with a maximum pull of 90 px. No air resistance (`frictionAir = 0`), so the displayed trajectory matches the real one.

## 3. Damage (impulse)

- Damage is based on the **normal impulse** of the contact: stronger collisions deal more damage. A Box2D clone uses it as the main input ([clone reference](https://github.com/saumyaparmar/AngryBirdsCloneBox2d)).
- A tutorial by Feronato computes the collision force in `PostSolve` and compares it with a fixed threshold to kill pigs ([tutorial](https://emanueleferonato.com/2011/10/21/develop-a-flash-game-like-angry-birds-using-box2d-killing-the-pigs/)). It is a simplified example, not Rovio's code.
- A Matter.js project approximates the impulse as `reduced mass × relative speed` and applies damage only above a threshold ([Slingshot Siege](https://github.com/Tanneywanney25/impact-damage-system)). It is a fan reconstruction.
- **Decision in the clone:** impulse ≈ `reduced mass × relative speed`, damage = impulse − threshold per material (glass < wood < stone). The values of `MATS` and `PIG` in `game.js` were **tuned by hand** with headless tests, not measured from the original game.

## 4. Game rules

| Rule | Status | Notes |
|---|---|---|
| One bird per turn; the next one is used when the previous one stops | Verified in general usage | The clone waits until the bird is nearly still (1 s) or leaves the screen. |
| Level cleared when all pigs are destroyed | Verified in general usage | |
| No birds left with pigs alive = defeat | Verified in general usage | |
| Points per pig and per block | Approximate | The clone uses 5000 per pig and 500 per block. Values not verified. |
| Birds: red (no ability), yellow (accelerates), blue (splits into three), black (explodes) | Verified in the [wiki](https://angrybirds.fandom.com/wiki/Angry_Birds_(game)) | Tapping mid-flight triggers the ability (see the next point). |
| White bird (egg that falls) | Not implemented | We found no source describing its ability. |

## 5. Controls (verified)

- **Aim and shoot:** drag the bird on the slingshot with the mouse (or finger). The angle and force come from the drag position. On release, it flies out ([StrategyWiki](https://strategywiki.org/wiki/Angry_Birds/Controls)).
- **Trajectory:** sources mention a trajectory line, but not how it works in the original. The clone shows points calculated with the same engine.
- **Ability:** tapping the screen (clicking on PC) during flight triggers the bird's ability. Except for red, all birds have one ([StrategyWiki](https://strategywiki.org/wiki/Angry_Birds/Controls)).
- **Black:** tapping in flight makes it explode like a bomb ([angrybirdsnest](https://www.angrybirdsnest.com/angry-birds-pc-mac-control-guide/), fan source, use with caution).

## 6. Clone controls

| Action | Control |
|---|---|
| Aim and shoot | Drag from the slingshot and release |
| Ability | Click/tap while the bird is flying |
| Pause | ⏸ button or `Esc` |
| Restart | ↻ button or `R` |

## 7. What is not verified

- Masses, densities, gravity, and the real damage values of the original game. No accessible primary source exists; the clone uses its own values.
- Exact shape of the original's trajectory line.
- The white bird's ability.

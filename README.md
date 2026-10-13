# Bird Crash

Fan clone of Angry Birds in TypeScript. Stack:

- **PixiJS 8**: 2D rendering (sprites, layers, particles).
- **Planck.js**: a TypeScript port of Box2D; the physics engine the original game uses.
- **React 19**: menus, HUD, and pause and end-of-level panels.
- **Vite** + **pnpm**.

## Commands

```bash
pnpm install
pnpm dev      # development server (http://localhost:5173)
pnpm test     # rules and physics simulation tests (node:test + tsx)
pnpm build    # type-check and production build
```

## Controls

- Drag the bird on the slingshot and release to shoot.
- Drag anywhere else to move the view; use the wheel, the − / + buttons, or the `-` / `+` keys to zoom.
- Tap while a bird is flying to trigger its ability.
- `Esc` pauses, `R` restarts, `M` mutes.

## Structure

- `src/game/config.ts`: constants (px, meters, pull, HP, points).
- `src/game/levels.ts`: loads and validates the JSON levels in `public/levels/` (`index.json` + `level-XX.json`).
- `scripts/gen-levels.mjs`: generates the 30 JSON levels. Levels 1-4 are hand-designed; levels 5-30 are generated from templates and have not been verified one by one. To edit a level, change its JSON directly.
- `src/game/physics.ts`: Planck world, launch, abilities, explosions, trajectory.
- `src/game/rules.ts`: damage rules (pure functions, tested).
- `src/game/game.ts`: fixed-step loop, input, camera and zoom, PixiJS rendering, body and sprite sync.
- `src/game/audio.ts`: sound effects (Web Audio) and looping music.
- `src/game/progress.ts`: stars and unlocked levels (localStorage).
- `src/App.tsx`: React UI over the canvas.
- `public/assets`: sprites taken from The Spriters Resource (see below).
- `public/audio`: sound effects and music from the AngryBirdsRemakeUnity repository.
- `legacy-js/`: earlier JavaScript prototype (reference only).

## Implemented rules

Taken from AngryBirdsRemakeUnity (MIT code) and the Angry Birds wiki:

- Pig: damage = relative speed × 8. A bird kills it in one hit, except the king.
- Block: damage = relative speed × 5, doubled when a bird hits it. HP: wood 100, stone 200, glass 50.
- Pigs: medium 75, helmet 200, large 125, king 200.
- Points: 5000 per pig, 500 per block, 10000 per unused bird on a win.
- Abilities on tap in flight: yellow accelerates, blue splits into three, black explodes, white lays an egg that explodes and is launched upward.
- The black bird also explodes when it lands.
- Stars 1-3 based on score. The thresholds (5000 and 12000) are our own.

## Attribution and licenses

- **Rules logic code**: adapted from [JdomiDev/AngryBirdsRemakeUnity](https://github.com/JdomiDev/AngryBirdsRemakeUnity) (MIT).
- **Sprites**: [The Spriters Resource](https://www.spriters-resource.com/mobile/angrybirds/) (Angry Birds, Rovio). Sprites extracted from sheets by Mr Peabody, Superjustinbros, and other users of the site.
- **Sounds and music**: from the AngryBirdsRemakeUnity repository. They are owned by Rovio. Personal and educational use only; do not redistribute or use commercially.
- This game is unofficial and not affiliated with Rovio.

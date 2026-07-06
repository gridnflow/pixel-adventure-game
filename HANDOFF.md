# HANDOFF — Handoff Document for the Next Agent (Opus)

> Last updated: 2026-07-06. Audience: the AI agent/developer taking over this project.
> This document is meant to be enough on its own to start working immediately: current state, design decisions, pitfalls, density roadmap, and the episodic expansion guide.
> The full code structure is documented in `README.md`, so overlapping content is omitted here.

---

## 1. Current Project State

- **Pure vanilla JS, single-file game** (one `game.js`, no build, no dependencies). Keeping this structure is intentional.
- Side-scrolling platformer built on Kenney Pixel Platformer assets. 480×270 logical resolution, 18px tiles.
- **50 stages total = 5 worlds (10 stages = 1 world)**:

| World | Stages | Theme | Unlocked elements | Opening |
|---|---|---|---|---|
| W1 Grassland | 1–10 | green | Basics, bounce mushroom | Handmade `buildLevel1` (stage 1) |
| W2 Desert | 11–20 | desert | Spikes `^`, walkers | Handmade `buildLevel2` (stage 11) |
| W3 Snowfield | 21–30 | snow | Bees, hearts `H`, slippery ground | Handmade `buildLevel3` (stage 21) |
| W4 Badlands | 31–40 | rock | Key `K` + lock `L` gate | Generated |
| W5 Night Forest | 41–50 | night | Everything combined, starry sky | Generated |

- All remaining stages are seeded procedural generation (`buildGeneratedLevel(stage)`) — the same stage always produces the same terrain.
- Last major commits: `15fa16c` (world structure), `a0d6319` (asset density), `59db7a3` (stage 4–50 generator).
- Remote: https://github.com/gridnflow/pixel-adventure-game (main branch)

### How to Run
```bash
cd pixel-adventure-game
python3 -m http.server 8080   # port 8000 is sometimes taken by another process on this machine
open http://localhost:8080
```
- Dev cheats: `#dev37` (start at stage 37), `#dev31x200` (stage 31 at tile X=200 — right in front of the lock gate)
- World entrances: `#dev11` Desert, `#dev21` Snowfield, `#dev31` Badlands, `#dev41` Night Forest

---

## 2. Architecture Essentials (Generator-Centric)

- `mulberry32(seed)` seeded PRNG, **seed = `stage * 1013904223 + 5`**.
- `WORLDS` table + `worldOf(levelIdx)` → determines theme and unlock gates. The generator reads `L.world`.
- Difficulty `d = clamp((stage - 2) / 45, 0, 1)` — feeds into enemy count, saw/walker ratio, pit width, and map length (up to 250 tiles).
- Seven segment functions are chained along a cursor `x`:

| Function | Content | Forces ground after? |
|---|---|---|
| `segFlat` | Flat ground + coins/enemies/spikes/hearts/boxes/decorations/powerups | – |
| `segPit` | Water-filled pit (mid platform if 4+ tiles wide) | ✅ `needGround` |
| `segStones` | Stepping stones over water | – |
| `segLadder` | Platform ladder + gem challenge | ✅ |
| `segPlateau` | Plateau (top 7) climb→drop | ✅ |
| `segHill` | Stair-block hill | – |
| `segBounce` | Pit + bounce mushroom (super jump) reward | ✅ |

- `needGround` flag: pit-type segments must be followed by `segFlat`. **Break this logic and you get unclearable maps.**
- W4+: a key section (platforms + `K`) is inserted after the main loop → a 9-tile lock pillar (`L`, too tall to jump) before the goal.
- Gems: `state.gem` guarantees at least 1 gem per level.

---

## 3. Hard Constraints (Pitfalls)

1. **Jump physics**: `GRAV=830, MOVE=130, JUMP_V=292, BOUNCE_V=460` → a single jump covers ~5 tiles horizontally and ~2.5 tiles up; the bounce mushroom gives ~7.5 tiles of rise. Generated levels must be designed for single jump only (double jump is slack). The 7-tile pit in handmade stage 21 is an intentional double-jump design.
2. **The PRNG call order IS the map.** Adding/removing/reordering `rng()` calls in segment functions regenerates all terrain for stages 4–50. If progress saving is ever added, you MUST bump `mapVersion`.
3. **Grid symbols** (`isSolid`: `# X ! x B L`): `=` one-way platform, `^` spikes, `B` mushroom, `w` water (decoration), `H` heart, `K` key, `d` door. Lowercase decorations live in the `DECO_TILES` table. New symbols must not clash with existing ones.
4. **Enemy placement y-coordinate**: in `L.enemy(type, tx, ty)`, `ty` is "ground top − 1". `loadLevel()` converts it via `(ty+1)*TS - box.h`.
5. **Slimes/saws/walkers turn around at ledges.** Never place them on terrain less than 2 tiles wide.
6. **`LEVELS` is an array of factories** — `LEVELS[idx]()` rebuilds the level each time. Stages 1/11/21 use handmade builders; the rest are `buildGeneratedLevel.bind(null, s)`.
7. **bg.png has 8 columns (0–7)** — bgCol pairs: 0–1 snowscape, 2–3 light forest, 4–5 desert dunes, 6–7 grassland forest. Out-of-range indices silently draw nothing (this was a real bug in the past).
8. **Night theme UI readability**: HUD text switches to bright colors when `THEMES[...].night`. Always double-check anything you add over dark backgrounds.

---

## 4. Verification (3 Steps Before Every Commit — Mandatory)

### 4-1. Structural Integrity (Node, no browser needed)
```bash
node tools/test-levels.js   # "all stages OK" + exit 0
```
Checks: door exists / spawn is safe / pit width ≤3 (handmade stage 21's 7 is an exception, `GAP_EXCEPTIONS`) / W4+ has a key and it comes before the lock.
When you add a new gimmick, **adding a matching check here is the rule** (e.g. like the key/lock check).

### 4-2. Rendering Smoke Test (headless Chrome)
```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu \
  --window-size=980,600 --virtual-time-budget=4000 \
  --screenshot=/tmp/stage.png "http://localhost:8080/#dev42"
```
**Actually read** the screenshot and verify it. Blank screen = load failure. At least one shot per theme.

### 4-3. Physics/Mechanics Simulation (Node vm)
Loading `game.js` in a vm sandbox exposes `loadLevel/update/player` directly. Past verification worked by teleporting the player and stepping `update(1/60)` — e.g. bounce (-460 launch), key→gate unlock. Verify new mechanics the same way. See the top of `tools/test-levels.js` for the sandbox stubs.

---

## 5. Density Roadmap — How to Develop "Denser" Going Forward

> Principle: **don't add more stages; add one new thing to learn per stage.**
> The biggest risk right now is that generated-stage patterns become readable by around stage 10.
> Following the order below gives the largest perceived-quality gain per unit of effort.

### 5-1. [P0] Game feel (juice) — minimum cost, maximum impact
All of these are a few lines each and need no assets:
- Landing/running dust particles (reuse `spawnBurst`, white, 2–3 particles, short lifetime)
- 2–3 frame hitstop on a successful stomp (a single freeze timer in `update`)
- Screen shake on hit (damped offset on camX/camY)
- Randomize sound pitch ±10% (`a.playbackRate = 0.9 + Math.random()*0.2` in `play()`)
- Squash & stretch on jump/landing (add a scale parameter to drawChar)

### 5-2. [P0] Deepen each world's signature gimmick (setup→payoff pacing)
Deepen each world's unlock gimmick by adding segments in an "introduce → apply → combine → test" arc.
- First stage of a world (x1): introduce the gimmick somewhere safe (a layout that can't kill you)
- Midway (x4–x7): applied segments (e.g. W2 spikes+pit combos, W3 slippery ground + stepping stones)
- Late (x8–x9): combine with previous worlds' gimmicks
- Final (x0): the exam stage → **ideally replaced with a world boss stage** (see 5-3)
- Implementation: branch the segment pool on `L.world` and add world-specific segments. E.g. a W3-only "ice slide + jump" segment, a W4-only "lock maze", a W5-only "coin trail in the dark".
- ⚠️ Pitfall #2: adding segments changes rng consumption and regenerates terrain. Finish this before introducing progress saving, or bump mapVersion.

### 5-3. [P1] World bosses (stages 10/20/30/40/50)
- For those stages only, use a dedicated builder (a short arena) instead of the generator: in the `LEVELS` assembly loop, if `s % 10 === 0` use `buildBossLevel(world)`.
- Asset candidates (unused parts of chars.png): C11/12 yellow angry block (stomper pattern), C15–17 rocket (projectile), C21–23 blue box monster (large boss body), C26 drone.
- Draft spec: 3–5 health (stompable), 2 patterns (charge↔jump or falling objects), 1s post-hit invincibility, door appears on defeat.
- Add boss to `ENEMY_BOX` + a type branch in the update loop. Reuse the existing stomp logic for the stomp check.

### 5-4. [P1] Data-driven difficulty tuning
- Just logging death locations (stage, tile x, cause) to localStorage is enough to reveal difficulty spikes.
- Adding a simulation bot (greedy move-right+jump) under `tools/` to automatically verify "actually clearable" would cover the heuristic gaps in 4-1 (extreme vertical cases).
- Tuning knobs are generator constants only: enemy chance `0.35+d*0.55`, saws `0.18+d*0.32`, spikes `0.25+d*0.4`, pit width `2~3+round(d*2)`. **Do not touch the seed formula.**

### 5-5. [P1] Retention structure (progress saving + star ratings)
- One localStorage key `pixelAdventure.v1` holding JSON: highest stage reached, per-stage clear/best-time/stars, high score, **mapVersion**.
- Stars: clear ★ / 80% of coins ★ / gem collected ★ — gives a reason to replay cleared stages.
- Title screen "Continue (W3-5)" + a stage select screen (10×5 grid, add `select` to `game.state`).

### 5-6. [P2] Ambient effects (theme polish)
- W3 Snowfield: falling snow particles / W5 Night: fireflies (floating light dots on the dark background) / W2 Desert: heat haze or a tumbleweed
- All doable by reusing the particle system. The stars (night) implementation is the reference pattern: the `theme.night` branch in `render()`.

### Do NOT
- Do not build infrastructure (level editor/replay etc.) before gimmicks and game feel (maintenance debt).
- No build tools or frameworks.
- Do not bundle multiple features into one commit — one feature → 3-step verification (§4) → commit.

---

## 6. Episodic Stage Expansion Guide — W6+ / Stage 51+

The project is set up to keep expanding world by world, like an episodic series. Procedure for adding a new world:

1. **Prepare the theme**: add a `TOP_*` terrain set to `T` (4 indices, [single,left,middle,right] convention) → add sky colors, bgCol, and gimmick flags to `THEMES` → add 6 decorations to `DECOS`.
   - Remaining asset candidates: lava/cave (dark sky + reuse `TOP_ROCK` + instant-death floor), mushroom kingdom (red mushroom tiles 12–15 as terrain), underwater (water tiles 32–35/52–55 + buoyancy physics).
   - To find unused tiles: compare the `T` table in `game.js` against the sheet. To view the sheet, build a 3x-zoomed HTML page with index overlays in the scratchpad and take a headless screenshot (the method used in this session).
2. **Add one row to WORLDS** + raise `STAGE_COUNT` (e.g. 60). `worldOf` adapts automatically.
3. **Add 1 world signature gimmick** (the §5-2 pattern). Gate the unlock with `L.world >= 5`.
4. **Write 1 handmade opening level** (`buildLevel4` etc.) → add an `s === 51` branch to the `LEVELS` assembly loop.
5. **Extend verification**: add a check for the new gimmick to `tools/test-levels.js`, screenshot the new world.
6. **Docs**: update the README world table + the §1 table in this document.

Balance caveat when serializing: if the denominator of the `d` formula (currently 45) isn't raised to match the total stage count, everything from 51+ is pinned at d=1. When expanding, generalize it, e.g. `d = clamp((stage - 2) / (STAGE_COUNT - 5), 0, 1)` — but note this also changes existing stage terrain (pitfall #2), so handle it together with mapVersion.

---

## 7. Working Rules (Repo-Wide)

- Commit messages in **English**, **no Co-Authored-By lines**.
- Keep the single `game.js` + static serving structure.
- Any change to levels/generator/physics: run the 3-step verification in §4 before committing.
- If gameplay rules change, update `README.md`; if the handoff state changes, update this file.

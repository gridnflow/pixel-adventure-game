# Pixel Adventure

A browser-based 2D platformer built with Kenney assets. Pure JavaScript implementation using Canvas 2D, including a physics engine, collision detection, enemy AI, particle effects, and a powerup system.

## Quick Start

```bash
cd pixel-adventure-game
python3 -m http.server 8000
```

Open `http://localhost:8000` in a browser, or simply double-click `index.html` directly.

---

## Gameplay

### Controls
| Key | Action |
|---|---|
| ← → / A D | Move |
| Space / ↑ / W | Jump (hold longer to jump higher) |
| Space (mid-air) | Double jump (requires powerup) |
| Enter | Start / next level |
| R | Restart current level |

### Game Rules
- **Start**: You begin with 3 hearts (restored on stage clear)
- **Defeating enemies**: Stomp slimes/walkers/flies/bees from above (avoid saws!)
- **Collectibles**: Coins (yellow) and gems (blue)
- **Boxes**: Hit `!` boxes from below with your head to open them
- **Spikes**: Stepping on them deals damage (jump over them)
- **Red bounce mushroom**: Stepping on it gives a super jump (about 2.5x normal jump height)
- **Powerups**:
  - **S (Shield)**: Orange orb, absorbs 2 hits (faded color means 1 hit left)
  - **D (Double Jump)**: Amber orb, allows one extra jump in mid-air
- **Heart item (W3+)**: Grab a floating heart to restore 1 health (max 3)
- **Key and lock gate (W4+)**: Collect the key late in the level to open the lock gate in front of the goal
- **Clear**: Reach the door (d) in each level to advance to the next
- **Score**: Bonus points for fast clears (within 3 seconds)

### World Structure (50 stages total, 10 stages = 1 world)
| World | Stages | Theme | New elements |
|---|---|---|---|
| W1 Grassland | 1–10 | green | Basics + bounce mushroom |
| W2 Desert | 11–20 | desert | Spikes, walkers |
| W3 Snowfield | 21–30 | snow | Bees, heart items, **slippery ground** |
| W4 Badlands | 31–40 | rock (sunset) | Key + lock gate |
| W5 Night Forest | 41–50 | night (starry sky) | Everything combined, highest difficulty |

- Handmade levels open each world: stage 1 (Grassland), 11 (Desert), 21 (Snowfield)
- The rest are seeded procedural generation (difficulty rises with stage number)
- A world banner is shown at the top of the screen when a world begins

### State Flow
```
title → play → clear → play → win
             ↑ (R key)      ↓ (on falling/being hit)
             └── gameover ──┘
```

---

## Code Structure

### Core Files

#### `index.html`
- Canvas 480x270 (16:9, image rendering optimized for pixel art)
- Dark background (#1a1c2c)
- Loads `game.js`

#### `game.js` (about 770 lines)

**Sections:**
1. **Asset loading** (lines 14-35)
   - Images: tiles.png, chars.png, bg.png
   - Sound effects: jump, coin, gem, stomp, hurt, win, start, boxhit (mp3)

2. **Sprite indices** (lines 37-61)
   - `T` object: tile sprite IDs (tilemap_packed.png, 20 columns × 18px)
   - `CH` object: character sprite IDs (tilemap-characters_packed.png, 9 columns × 24px)

3. **Drawing functions** (lines 63-83)
   - `drawTile(idx, x, y)`: renders a tile
   - `drawChar(idx, x, y, flip)`: draws a character (horizontal flip)
   - `drawEnemy(e, idx, flip, yOff)`: renders an enemy (bottom-aligned to its box)

4. **Level builder** (lines 86-106)
   - `LevelBuilder` class
   - Grid-based level definition (`#` block, `=` platform, `!` box, etc.)
   - Methods: `ground()`, `block()`, `plat()`, `coin()`, `gem()`, `enemy()`, etc.

5. **Level construction** (lines 109-225)
   - `buildLevel1()`: Grassland (140 tiles × 15 high)
   - `buildLevel2()`: Desert (150 tiles × 15 high)
   - Each level places pits, platforms, enemies, and collectibles

6. **Game state** (lines 228-248)
   - `game` object: state, levelIdx, coins, gems, hearts, time
   - `level`, `player`, `enemies`, `particles`, `popups` variables

7. **Physics & collision** (lines 250-387)
   - `moveAndCollide(ent, dt, oneWay)`: AABB collision, movement
   - `overlaps(a, b)`: enemy-player overlap check
   - `hurtPlayer()`: damage handling (invincibility frames, knockback)
   - `spawnBurst()`: particle effects

8. **Update** (lines 389-488)
   - Player input handling (acceleration/deceleration, jump mechanics)
   - Coyote time (0.1s): jump is still possible just after leaving a ledge
   - Jump buffering (0.12s): jump input registered slightly early
   - Variable-height jump: releasing the key cuts the jump short
   - Enemy AI (slime/saw: turn around on wall hit, fly: sine-wave pattern)
   - Collection logic (coins, gems, boxes)
   - Fall-death detection

9. **Rendering** (lines 491-738)
   - Sky gradient
   - Camera (smooth follow)
   - Background (parallax scroll × 0.3)
   - Clouds (slower parallax × 0.5)
   - Tilemap rendering
   - Enemy and player rendering
   - Particles & popups
   - HUD (hearts, coins, gems, level number)
   - Overlays (clear, game over)
   - Title screen
   - Victory screen

10. **Main loop** (lines 741-766)
    - `requestAnimationFrame` based
    - Fixed 60fps (STEP = 1/60)
    - Accumulator-based fixed timestep
    - Dev hash cheat (`#dev<level>x<tile>`)

---

## Key Constants & Magic Numbers

```javascript
const TS = 18;                      // tile size (pixels)
const VIEW_W = 480, VIEW_H = 270;   // viewport size
const GRAV = 830;                   // gravity (px/s²)
const MOVE = 130;                   // horizontal speed (px/s)
const JUMP_V = 292;                 // initial jump velocity (px/s)
const MAX_FALL = 320;               // fall speed cap
const STEP = 1 / 60;                // physics timestep (60fps)
```

### Enemy Box Sizes (rendered sprite is bottom-aligned to the box)
```javascript
const ENEMY_BOX = {
  slime: { w: 18, h: 14 },
  fly:   { w: 18, h: 12 },
  saw:   { w: 18, h: 18 },
};
```

### Player State Object
```javascript
{
  x, y,                   // position
  w: 14, h: 20,           // box size
  vx, vy,                 // velocity
  onGround,               // grounded state
  flip,                   // horizontal flip (false=facing right, true=facing left)
  coyote,                 // remaining coyote time (jump-allowed window)
  jumpBuf,                // remaining jump buffer time
  iframes,                // invincibility time
  anim,                   // animation counter
  doubleJumpsLeft,        // remaining double jumps
  shieldHealth,           // shield health (0=none, 1=1 hit, 2=2 hits)
  shieldTimer,            // shield duration timer
}
```

### Game State Object
```javascript
{
  state,       // 'title' | 'play' | 'clear' | 'gameover' | 'win'
  levelIdx,    // current level index
  coins,       // coins collected
  gems,        // gems collected
  hearts,      // hearts remaining
  time,        // total game time
  levelTime,   // time in current level
  totalScore,  // accumulated score
  stateTime,   // per-state timer
}
```

### Level Grid Symbols
- `#` : block (top row renders differently)
- `=` : platform (one-way, passable only from above)
- `X` : crate
- `!` : question box (openable by hitting from below)
- `x` : opened box
- `o` : coin
- `*` : gem
- `S` : shield powerup (rendered as an orange orb)
- `D` : double jump powerup (rendered as an amber orb)
- `^` : spikes (damage on overlap with the lower half)
- `B` : bounce mushroom (super jump when stepped on, solid)
- `w` : water (pit decoration, non-solid)
- `H` : heart recovery item
- `K` : key / `L` : lock block (solid, all unlocked by the key)
- `d` : door (goal)
- ` ` : empty space
- Decorations (all non-solid, see the `DECO_TILES` table):
  `s` sign, `t` tree, `c` cactus, `m` mushroom, `f` fence, `n` snowman,
  `r` snow pile, `g`/`h` sprouts, `l` flower, `k` dead tree, `u` fence gate

### Enemy Types and Behavior
- **slime**: moves horizontally (vx=-25), turns around at walls/ledges
- **walker**: same as slime but faster (vx=-45)
- **saw**: moves horizontally (vx=-35), spinning animation, cannot be stomped
- **fly**: sine-wave vertical motion, moves left/right within a range (vx=30)
- **bee**: stronger variant of fly (vx=45, larger amplitude and frequency)

---

## Newly Added Features (v2.0)

### 1. Double Jump System
- Press Space in mid-air for an extra jump
- Collecting the D powerup increases double jump count
- Automatically resets on landing
- Amber particle effect on activation

### 2. Shield System
- Collecting the S powerup grants 2 hits of protection
- On hit, the shield absorbs the damage (health decreases)
- A circular shield is rendered around the player while active
- Color indicates state (yellow=2 hits, red=1 hit)

### 3. Level 3 Added (Mountain Theme)
- Higher difficulty
- Advanced jump challenges (ledge timing)
- Includes double jump and shield powerups
- More complex enemy placement

### 4. Score System
- Time bonus calculated on each level clear
- Maximum bonus for clearing within 3 seconds
- Total score shown on the final victory screen
- Displayed alongside coin/gem counts

### 5. HUD Improvements
- DJ: remaining double jump count
- SH: remaining shield health

## Extensibility

### 1. Adding a New Level
```javascript
function buildLevel4() {
  const L = new LevelBuilder(170, 15, 'ice');  // new theme
  L.spawn(2, 10);
  L.ground(0, 20, 12);
  // ... level layout ...
  L.powerup(50, 5, 'shield');
  L.powerup(100, 3, 'double');
  return L;
}
const LEVELS = [buildLevel1, buildLevel2, buildLevel3, buildLevel4];
```

### 2. Adding a New Theme
```javascript
const THEMES = {
  green:  { skyTop: '#bdefff', skyBot: '#e3f8ff', bgCol: 6, topSet: T.TOP_GRASS },
  desert: { skyTop: '#ffe6b3', skyBot: '#fff4d6', bgCol: 4, topSet: T.TOP_SAND },
  mountain: { skyTop: '#8ba5d9', skyBot: '#c5d9f1', bgCol: 8, topSet: T.TOP_GRASS },
  ice:    { skyTop: '#e8f4f8', skyBot: '#f5f9fa', bgCol: 10, topSet: T.TOP_GRASS },  // new theme
};
```

### 3. Adding a New Enemy Type
- Define the box size in `ENEMY_BOX`
- Add enemy AI logic in `update()`
- Add draw logic in `render()`
- Place with `LevelBuilder.enemy()`

### 4. Adding a New Collectible
- Define a symbol in the level grid (e.g. `$`)
- Add a `cellAt()` check in `update()`
- Define the rendering tile

### 5. Powerup System
- Change player abilities on item collection (e.g. double jump, shield)
- Add state to the `player` object (powerupTime, etc.)
- Auto-expire with a timer

---

## Performance Optimization Tips

### 1. Rendering
- Skip tiles outside the screen (compute tx0, tx1 bounds)
- Background pattern uses tiling only (wrap() function)
- Save the canvas rendering context only once (ctx.save/restore)

### 2. Physics
- Collision checks only against relevant tiles (bounds computed in tile coordinates)
- AABB (axis-aligned bounding box) only (simple and fast)

### 3. Object Management
- enemies, particles, popups arrays are rebuilt every frame (memory cleanup)
- Dead enemies are still rendered briefly before removal (disappear animation)

---

## Debugging & Dev Mode

### Hash-Based Cheats
```
http://localhost:8000#dev1x60   → start at level 1, tile 60
http://localhost:8000#dev2      → start at level 2 from the beginning
```

Implementation: `game.js` lines 758-764

### Debug Features You Could Add
- Show colliders (draw bounds with drawRect)
- Show velocity vectors
- FPS counter
- Grid overlay

---

## Known Limitations

1. **Sound loading**: mp3 files required in the `assets/` folder
   - `jump.mp3`, `coin.mp3`, `gem.mp3`, `stomp.mp3`, `hurt.mp3`, `win.mp3`, `start.mp3`, `boxhit.mp3`
   
2. **Tile images**: fixed layout required
   - tiles.png: 20 columns, 18px tiles
   - chars.png: 9 columns, 24px characters
   - bg.png: background pattern

3. **One-way platforms**: platforms (`=`) are only passable from above
   - Cannot climb up from below (by design)

4. **Enemy infinite turning**: enemies on a platform just keep turning at the edges (no ledge detection)

---

## Assets Used (all CC0)

- [Kenney Pixel Platformer](https://kenney.nl/assets/pixel-platformer) — tiles, characters, backgrounds
- [Kenney Interface Sounds](https://kenney.nl/assets/interface-sounds) — sound effects (converted to mp3)

---

## Future Improvement Ideas

- [x] Add level 3
- [x] Add double jump
- [x] Add shield system
- [x] Add score system
- [x] Add stages 4–50 (seeded procedural generation)
- [ ] New themes (ice, lava, etc.)
- [ ] Boss enemies (high health, special patterns)
- [ ] Advanced movement (wall slide, dash, etc.)
- [ ] Sound volume UI
- [ ] Mobile touch input (joystick)
- [ ] Level editor (web-based)
- [ ] Replay system
- [ ] Save data (LocalStorage - high score)
- [ ] Difficulty selection (Easy/Normal/Hard)
- [ ] Speedrun mode (time limit)
- [ ] Multiplayer (local 2P)

---

## Tech Stack

- **Language**: Pure JavaScript (ES6+)
- **Rendering**: Canvas 2D API
- **Physics**: hand-rolled (AABB)
- **Input**: Keyboard Events
- **Sound**: HTML5 Audio API
- **Assets**: PNG (tilemaps), MP3 (sound effects)

---

**Last updated**: 2026-07-03

// Consistency check for all stages (no browser needed)
// Run: node tools/test-levels.js
// Checks: (1) door (d) exists (2) ground below spawn point (3) width of consecutive gaps with no footing
//       (generated stages must be ≤3; handcrafted stage 3's gap run of 7 is exempt as a double-jump design)
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const noop = () => {};
const ctx2d = new Proxy({}, {
  get: (t, k) => (k === 'canvas' ? {} : (...a) => ({ addColorStop: noop })),
  set: () => true,
});
const sandbox = {
  document: { getElementById: () => ({ getContext: () => ctx2d }) },
  Image: class { set src(v) {} },
  Audio: class { constructor() { this.preload = ''; } cloneNode() { return this; } play() { return { catch: noop }; } },
  window: { addEventListener: noop },
  location: { hash: '' },
  requestAnimationFrame: noop,
  Math, Promise, Array, Object, String, Number, console,
};
sandbox.globalThis = sandbox;
const context = vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'game.js'), 'utf8'), context);

// Intended handcrafted-level exception: stage 21 (handcrafted snowfield level) has a 7-tile pit that assumes double jump
const GAP_EXCEPTIONS = { 21: 7 };

const result = vm.runInContext(`
(() => {
  const problems = [];
  const maxRuns = [];
  for (let i = 0; i < LEVELS.length; i++) {
    const L = LEVELS[i]();
    const stage = i + 1;
    let hasDoor = false;
    for (const row of L.grid) if (row.includes('d')) hasDoor = true;
    if (!hasDoor) problems.push('stage ' + stage + ': no door');
    const sx = Math.floor(L.spawnX / 18);
    let grounded = false;
    for (let y = 0; y < L.h; y++) if (L.grid[y][sx] === '#') grounded = true;
    if (!grounded) problems.push('stage ' + stage + ': spawn over void');
    let run = 0, maxRun = 0;
    for (let x = 0; x < L.w; x++) {
      let support = false;
      for (let y = 0; y < L.h; y++) {
        const c = L.grid[y][x];
        if (c === '#' || c === '=' || c === 'X' || c === '!' || c === 'B') support = true;
      }
      run = support ? 0 : run + 1;
      maxRun = Math.max(maxRun, run);
    }
    maxRuns.push(maxRun);
    // Key/lock (W4+, from stage 31): a key must exist and sit before (left of) the lock
    if (stage >= 31) {
      let keyX = -1, lockX = -1;
      for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
        if (L.grid[y][x] === 'K' && keyX < 0) keyX = x;
        if (L.grid[y][x] === 'L' && lockX < 0) lockX = x;
      }
      if (keyX < 0) problems.push('stage ' + stage + ': no key');
      if (lockX < 0) problems.push('stage ' + stage + ': no lock gate');
      if (keyX >= 0 && lockX >= 0 && keyX >= lockX) problems.push('stage ' + stage + ': key after lock');
    }
  }
  return { count: LEVELS.length, problems, maxRuns };
})()
`, context);

for (let i = 0; i < result.maxRuns.length; i++) {
  const stage = i + 1;
  const limit = GAP_EXCEPTIONS[stage] || 3;
  if (result.maxRuns[i] > limit) {
    result.problems.push(`stage ${stage}: gap run ${result.maxRuns[i]} (limit ${limit})`);
  }
}

console.log('levels:', result.count);
if (result.problems.length) {
  console.log(result.problems.join('\n'));
  process.exit(1);
}
console.log('all stages OK');

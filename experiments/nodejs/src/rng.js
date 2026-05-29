/** Seeded RNG (mulberry32) + Poisson sampling
 * Full copy for JSS standalone package.
 * CRN strategy: setRunSeed(JSS_BASE_SEED, r) gives same arrivals across algorithms.
 */

export function createRng(seed) {
  let s = seed >>> 0;
  return function next() {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function poisson(lambda, rng) {
  if (lambda <= 0) return 0;
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k += 1;
    p *= rng();
  } while (p > L);
  return k - 1;
}

export function setRunSeed(baseSeed, repeatIndex) {
  return createRng(baseSeed + repeatIndex);
}

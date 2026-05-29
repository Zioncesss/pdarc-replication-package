import {
  STEP_MS,
  WARMUP_S,
  SCENARIO_BASE_RATE,
  SCENARIO_BURST_RATE,
  SCENARIO_PULSE_BASE,
  INTERFERENCE_LIGHT,
  INTERFERENCE_HEAVY,
} from './config.js';

export function createScenario(name, steps) {
  const rates = new Array(steps).fill(SCENARIO_BASE_RATE);
  const interferences = new Array(steps).fill(0);
  const stepS = STEP_MS / 1000;

  // ── Original per-step scenarios ───────────────────────────────────────────
  for (let i = 0; i < steps; i++) {
    const t = i * stepS;
    if (name === 'step_burst' && t >= 40 && t < 80) {
      rates[i] = SCENARIO_BURST_RATE;
    } else if (name === 'pulse_burst') {
      rates[i] = SCENARIO_PULSE_BASE;
      if ((t % 10) < 2) rates[i] = SCENARIO_BURST_RATE;
    } else if (name === 'interference_light' && t >= 40 && t < 80) {
      interferences[i] = INTERFERENCE_LIGHT;
    } else if (name === 'interference_heavy' && t >= 40 && t < 80) {
      interferences[i] = INTERFERENCE_HEAVY;
    } else if (name === 'spike_io') {
      const period = Math.round(2.0 / stepS);
      const spikeDur = 3;
      if ((i % period) < spikeDur) interferences[i] = 0.95;
    } else if (name === 'erratic') {
      // Capacity oscillates 0%<->80% every 4 steps — EMA cannot track; iCap dampens
      const block = 4;
      interferences[i] = ((Math.floor(i / block) % 2) === 1) ? 0.80 : 0.0;
    } else if (name === 'ramp_interference') {
      if (t >= 40 && t <= 45) {
        interferences[i] = 0.7 * (t - 40) / 5;
      } else if (t > 45 && t < 80) {
        interferences[i] = 0.7;
      } else if (t >= 80) {
        interferences[i] = 0.0;
      }
    }
  }

  // ── New scenarios (JSS revision) ─────────────────────────────────────────

  if (name === 'io_mixed') {
    // Models mixed CPU/I/O workloads under slight overload.
    // Arrival 900/s (13.5 tasks/step) exceeds average capacity:
    //   every 8-step period, 2 steps stall at ι=0.85 (sync I/O: db query, fs.readFileSync)
    //   average capacity = (6×15 + 2×2.25)/8 ≈ 11.8 tasks/step < 13.5 arrivals/step
    // Without control the queue grows at ~1.7 tasks/step; P-DARC detects the
    // capacity drop via N_out and pre-emptively reduces admission.
    const ioPeriod = 8;
    const ioBurst  = 2;
    const ioIota   = 0.85;
    for (let i = 0; i < steps; i++) {
      rates[i] = 900;
      if ((i % ioPeriod) < ioBurst) interferences[i] = ioIota;
    }
  } else if (name === 'trace_like') {
    // Production-like scenario: normal traffic → load+GC surge → recovery.
    // Phase 1 (t=10–50 s): 800/s, minor GC baseline (ι=0.15, every 133 steps, 1 step)
    // Phase 2 (t=50–90 s): Traffic 950/s + periodic GC bursts (ι=0.50, every 8 steps, 2 steps)
    //   avg capacity in Phase 2 = (6×15 + 2×7.5)/8 = 13.1 tasks/step < 14.25 arrivals/step
    //   Models production service under allocation-intensive load surge causing GC pressure.
    // Phase 3 (t=90–120 s): 800/s recovery, minor GC only.
    const warmupSteps = Math.ceil(WARMUP_S / stepS);
    const phase2Start = Math.round(50 / stepS);
    const phase3Start = Math.round(90 / stepS);

    for (let i = 0; i < steps; i++) {
      if (i < warmupSteps) {
        rates[i] = 800; interferences[i] = 0; continue;
      }
      if (i >= phase2Start && i < phase3Start) {
        // Phase 2: traffic surge + periodic GC bursts
        rates[i] = 950;
        if ((i % 8) < 2) interferences[i] = 0.50;
      } else {
        // Phase 1 / Phase 3: baseline traffic + minor GC
        rates[i] = 800;
        if ((i % 133) === 0) interferences[i] = 0.15;
      }
    }
  }

  const valid = [
    'steady', 'step_burst', 'pulse_burst',
    'interference_light', 'interference_heavy',
    'ramp_interference', 'spike_io', 'erratic',
    'io_mixed', 'trace_like',
  ];
  if (!valid.includes(name)) throw new Error(`Unknown scenario: ${name}`);

  return { rates, interferences };
}

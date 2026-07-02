/**
 * Experiment configuration 鈥?modified from paper_v2 baseline
 *
 * Key changes vs original (experiments/nodejs/src/config.js):
 *   - REPEATS: 10 鈫?30  (Requirement: 鈮?0 independent runs for statistical tests)
 *   - BASE_SEED: 1000 (different from original 42; avoids seed-space overlap)
 *   - SCENARIOS: added 'erratic' (needed for RQ2: integral contribution validation)
 *   - All algorithm parameters UNCHANGED (same controller as paper 搂3鈥?)
 */

export const STEP_MS   = 15;
export const STEP_S    = STEP_MS / 1000;
export const DURATION_S = 120;
export const WARMUP_S  = 10;

// 30 reps per configuration (was 10)
export const REPEATS = 30;

// Base seed for this study 鈥?deliberately different from original (42)
// to prevent seed-space overlap between original and current datasets.
// CRN (common random numbers) is preserved: same repeatIndex 鈫?same Poisson arrivals
// across all algorithms within a scenario, maximising paired comparison power.
export const BASE_SEED = 1000;

export const CAPACITY  = 1000;
export const EPS       = 1e-9;

export const NOMINAL_N_PER_STEP = Math.round(CAPACITY * STEP_S);  // 15 tasks/step
export const N_MIN     = 1;
export const N_MAX     = Math.round(CAPACITY * STEP_S * 3.0);      // 45
export const LAMBDA_MAX = CAPACITY * 2.0;

export const D_REF        = 0.2;
export const L_REF_STATIC = Math.floor(D_REF * CAPACITY);   // 200 tasks

// P-DARC controller parameters (paper 搂3, unchanged)
export const PDARC_ALPHA   = 0.2;
export const PDARC_BETA    = 1.0;
export const PDARC_GAMMA   = 0.2;
export const PDARC_GAMMA_REF = 0.03;
export const PDARC_THETA   = 0.90;
export const PDARC_GAMMA_I = 0.3;
export const PDARC_RHO     = 0.90;
export const PDARC_GAMMA_Q = 0.15;
export const PDARC_RHO_Q   = 0.85;

// PIE parameters (unchanged)
export const PIE_ALPHA     = 0.125;
export const PIE_BETA      = 1.25;
export const PIE_BETA_STEP = PIE_BETA * STEP_S;
export const PIE_IDLE_DECAY = PIE_ALPHA * D_REF * 0.5;

// Scenario parameters (unchanged)
export const SCENARIO_BASE_RATE  = 800.0;
export const SCENARIO_BURST_RATE = 1500.0;
export const SCENARIO_PULSE_BASE = 500.0;
export const INTERFERENCE_LIGHT  = 0.20;
export const INTERFERENCE_HEAVY  = 0.50;

// AIMD parameters (unchanged)
export const AIMD_LAMBDA_MIN  = N_MIN / STEP_S;
export const AIMD_LAMBDA_MAX  = LAMBDA_MAX;
export const AIMD_MD_FACTOR   = 0.5;
export const AIMD_AI_STEP     = CAPACITY * 0.05;
export const AIMD_INIT_LAMBDA = SCENARIO_BASE_RATE;

// Evaluation scenarios:
//   'erratic' added for RQ2 (integral contribution validation, 60ms oscillation period)
export const SCENARIOS = [
  'steady',
  'step_burst',
  'pulse_burst',
  'interference_light',
  'interference_heavy',
  'erratic',           // GC-pause model: capacity oscillates 0%鈫?0% every 4 steps (60ms)
];

// Primary comparison algorithms (RQ1, RQ4)
export const ALGORITHMS = [
  'Fixed Backpressure',
  'AIMD',
  'PIE',
  'P-DARC',
  'P-DARC-noI',
];

// Ablation set for RQ2 component contribution analysis
export const ABLATION_ALGORITHMS = [
  'P-DARC',
  'P-DARC-noI',
  'P-DARC-noEMA',
  'P-DARC-staticL',
  'Fixed Backpressure',
  'AIMD',
  'PIE',
];

export function clip(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}


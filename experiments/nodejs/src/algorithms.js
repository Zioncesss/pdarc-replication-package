import {
  CAPACITY,
  D_REF,
  L_REF_STATIC,
  N_MIN,
  N_MAX,
  STEP_S,
  EPS,
  LAMBDA_MAX,
  NOMINAL_N_PER_STEP,
  PDARC_ALPHA,
  PDARC_BETA,
  PDARC_GAMMA,
  PDARC_GAMMA_REF,
  PDARC_THETA,
  PDARC_GAMMA_I,
  PDARC_RHO,
  PDARC_GAMMA_Q,
  PDARC_RHO_Q,
  PIE_ALPHA,
  PIE_BETA,
  PIE_BETA_STEP,
  PIE_IDLE_DECAY,
  AIMD_LAMBDA_MIN,
  AIMD_LAMBDA_MAX,
  AIMD_MD_FACTOR,
  AIMD_AI_STEP,
  AIMD_INIT_LAMBDA,
  clip,
} from './config.js';

export class StepContext {
  constructor(nOut, tProc, qlen, nArrived, nAdmitted, nRejected, avgDelay, interference, stepS) {
    this.nOut = nOut;
    this.tProc = tProc;
    this.qlen = qlen;
    this.nArrived = nArrived;
    this.nAdmitted = nAdmitted;
    this.nRejected = nRejected;
    this.avgDelay = avgDelay;
    this.interference = interference;
    this.stepS = stepS;
  }
}

export class QuotaAlgorithm {
  constructor() {
    this.nAllow = NOMINAL_N_PER_STEP;
    this.muHat = CAPACITY;
    this.controlSignal = 0;
  }

  beginRun() {
    this.nAllow = NOMINAL_N_PER_STEP;
    this.muHat = CAPACITY;
    this.controlSignal = 0;
  }

  getNAllow() {
    return this.nAllow;
  }

  estimateMu(ctx, gamma) {
    const sample = ctx.nOut / Math.max(ctx.stepS, EPS);
    this.muHat = gamma * sample + (1 - gamma) * this.muHat;
  }

  toNAllow(lambdaAllow) {
    const lam = clip(lambdaAllow, 0, LAMBDA_MAX);
    const n = Math.round(lam * STEP_S);
    return Math.round(clip(n, N_MIN, N_MAX));
  }

  update(_ctx) {
    throw new Error('not implemented');
  }
}

export class FixedBackpressure extends QuotaAlgorithm {
  constructor(lRef = L_REF_STATIC) {
    super();
    this.lRef = lRef;
  }

  update(ctx) {
    if (ctx.qlen >= this.lRef) {
      // Complete admission stop when queue exceeds threshold.
      // Fixed BP does not apply the N_min liveness floor — see §Baselines.
      this.nAllow = 0;
      this.controlSignal = 0;
    } else {
      const lam = CAPACITY;
      this.nAllow = this.toNAllow(lam);
      this.controlSignal = lam;
    }
  }
}

export class AIMD extends QuotaAlgorithm {
  constructor(lambdaMin = AIMD_LAMBDA_MIN, lambdaMax = AIMD_LAMBDA_MAX, dRef = D_REF, initLambda = AIMD_INIT_LAMBDA) {
    super();
    this.lambdaMin = lambdaMin;
    this.lambdaMax = lambdaMax;
    this.dRef = dRef;
    this.initLambda = initLambda;
    this.lambdaLimit = initLambda;
  }

  beginRun() {
    super.beginRun();
    this.lambdaLimit = this.initLambda;
  }

  update(ctx) {
    let congested = false;
    if (ctx.avgDelay !== null && ctx.avgDelay > this.dRef) congested = true;
    if (ctx.qlen >= Math.floor(L_REF_STATIC * 0.9)) congested = true;

    if (congested) {
      this.lambdaLimit = Math.max(this.lambdaMin, this.lambdaLimit * AIMD_MD_FACTOR);
    } else {
      this.lambdaLimit = Math.min(this.lambdaMax, this.lambdaLimit + AIMD_AI_STEP);
    }

    this.nAllow = this.toNAllow(this.lambdaLimit);
    this.controlSignal = this.lambdaLimit;
  }
}

export class PIE extends QuotaAlgorithm {
  constructor(dRef = D_REF, alpha = PIE_ALPHA, betaStep = PIE_BETA_STEP) {
    super();
    this.dRef = dRef;
    this.alpha = alpha;
    this.betaStep = betaStep;
    this.p = 0;
    this.oldDelay = 0;
  }

  beginRun() {
    super.beginRun();
    this.p = 0;
    this.oldDelay = 0;
  }

  /** RFC 8033 style queueing delay: backlog / dequeue rate.
   *  Dequeue-rate floor prevents division-by-zero under throughput collapse. */
  queueingDelay(ctx) {
    if (ctx.qlen === 0) return 0;
    const dequeueRate = Math.max(ctx.nOut / ctx.stepS, CAPACITY * 0.05);
    return ctx.qlen / dequeueRate;
  }

  update(ctx) {
    const delay = this.queueingDelay(ctx);

    this.p += this.alpha * (delay - this.dRef) + this.betaStep * (delay - this.oldDelay);

    if (ctx.qlen === 0 && delay < this.dRef * 0.5) {
      this.p = Math.max(0, this.p - PIE_IDLE_DECAY);
    }

    this.p = clip(this.p, 0, 1);
    this.oldDelay = delay;

    const lam = Math.max(0, (1 - this.p) * CAPACITY);
    this.nAllow = this.toNAllow(lam);
    this.controlSignal = this.p;
  }
}

// P-DARC v5 — Bipolar Dual-Path Integral (paper §3)
// Path 1: I_cap  — capacity gap (muHat < theta * muRef)
// Path 2: I_queue — queue overshoot (L > L_ref)
// Control law: lambda = max(0, muHat + alpha*(L_ref-L)/T_step - beta*(I_cap+I_queue))
export class PDARC extends QuotaAlgorithm {
  constructor(dRef = D_REF, alpha = PDARC_ALPHA, beta = PDARC_BETA, gamma = PDARC_GAMMA,
              gammaRef = PDARC_GAMMA_REF, theta = PDARC_THETA,
              gammaI = PDARC_GAMMA_I, rho = PDARC_RHO,
              gammaQ = PDARC_GAMMA_Q, rhoQ = PDARC_RHO_Q) {
    super();
    this.dRef = dRef;
    this.alpha = alpha;
    this.beta = beta;
    this.gamma = gamma;
    this.gammaRef = gammaRef;
    this.theta = theta;
    this.gammaI = gammaI;
    this.rho = rho;
    this.gammaQ = gammaQ;
    this.rhoQ = rhoQ;
    this.iCap = 0;
    this.iQueue = 0;
    this.muRef = CAPACITY;
    this.muInitialized = false;
  }

  beginRun() {
    super.beginRun();
    this.iCap = 0;
    this.iQueue = 0;
    this.muRef = CAPACITY;
    this.muInitialized = false;
  }

  update(ctx) {
    const stepS = Math.max(ctx.stepS, EPS);
    const sampleMu = ctx.nOut / stepS;

    if (!this.muInitialized) {
      this.muHat = ctx.nOut > 0 ? sampleMu : CAPACITY;
      this.muInitialized = true;
    } else {
      this.muHat = this.gamma * sampleMu + (1 - this.gamma) * this.muHat;
    }

    this.muRef = this.gammaRef * sampleMu + (1 - this.gammaRef) * this.muRef;

    const lRef = this.dRef * this.muHat;

    // Path 1 — Capacity Gap Accumulator
    if (this.muHat < this.theta * this.muRef && ctx.qlen > 0) {
      this.iCap += this.gammaI * Math.max(0, this.muRef - this.muHat);
    } else {
      this.iCap *= this.rho;
    }

    // Path 2 — Queue Overshoot Accumulator
    if (ctx.qlen > lRef) {
      this.iQueue += this.gammaQ * (ctx.qlen - lRef) / stepS;
    } else {
      this.iQueue *= this.rhoQ;
    }

    const iTotal = this.iCap + this.iQueue;
    const backlogTerm = this.alpha * (lRef - ctx.qlen) / stepS;
    const lam = Math.max(0, this.muHat + backlogTerm - this.beta * iTotal);

    this.nAllow = this.toNAllow(lam);
    this.controlSignal = iTotal;
  }
}

/**
 * GradientDescent — step-granularity gradient controller in the spirit of
 * Envoy Adaptive Concurrency, adapted to per-step in-process signals.
 *
 * On each step: estimate per-task queuing latency = queue_length / dequeue_rate.
 * If latency > dRef: proportionally reduce admission (reactive gradient).
 * If latency ≤ dRef: additively increase admission (TCP-like recovery).
 *
 * This is the "reactive" baseline that lacks P-DARC's predictive EMA capacity
 * estimate. Added to directly address the "why no Netflix-style baseline?"
 * reviewer concern (§Discussion).
 */
export class GradientDescent extends QuotaAlgorithm {
  constructor(dRef = D_REF, gradientStep = 0.05, windowSize = 3) {
    super();
    this.dRef = dRef;
    this.gradientStep = gradientStep;
    this.windowSize = windowSize;
    this.lambdaLimit = CAPACITY;
    this.latencyHistory = [];
  }

  beginRun() {
    super.beginRun();
    this.lambdaLimit = CAPACITY;
    this.latencyHistory = [];
  }

  update(ctx) {
    const dequeueRate = Math.max(ctx.nOut / ctx.stepS, CAPACITY * 0.01);
    const latency = ctx.qlen > 0 ? ctx.qlen / dequeueRate : 0;

    this.latencyHistory.push(latency);
    if (this.latencyHistory.length > this.windowSize) this.latencyHistory.shift();

    if (this.latencyHistory.length >= 2) {
      const cur = this.latencyHistory[this.latencyHistory.length - 1];
      if (cur > this.dRef) {
        const excess = Math.min((cur - this.dRef) / this.dRef, 1.0);
        this.lambdaLimit *= (1 - this.gradientStep * excess);
      } else {
        this.lambdaLimit += this.gradientStep * CAPACITY;
      }
    }

    this.lambdaLimit = clip(this.lambdaLimit, CAPACITY * 0.01, LAMBDA_MAX);
    this.nAllow = this.toNAllow(this.lambdaLimit);
    this.controlSignal = this.lambdaLimit;
  }
}

// Ablation: static L_ref = D_ref * mu_0 (no adaptive backlog target)
class PDARCStaticL extends PDARC {
  update(ctx) {
    const stepS = Math.max(ctx.stepS, EPS);
    const sampleMu = ctx.nOut / stepS;

    if (!this.muInitialized) {
      this.muHat = ctx.nOut > 0 ? sampleMu : CAPACITY;
      this.muInitialized = true;
    } else {
      this.muHat = this.gamma * sampleMu + (1 - this.gamma) * this.muHat;
    }

    this.muRef = this.gammaRef * sampleMu + (1 - this.gammaRef) * this.muRef;

    const lRef = this.dRef * CAPACITY;  // STATIC — no adaptive scaling

    if (this.muHat < this.theta * this.muRef && ctx.qlen > 0) {
      this.iCap += this.gammaI * Math.max(0, this.muRef - this.muHat);
    } else {
      this.iCap *= this.rho;
    }

    if (ctx.qlen > lRef) {
      this.iQueue += this.gammaQ * (ctx.qlen - lRef) / stepS;
    } else {
      this.iQueue *= this.rhoQ;
    }

    const iTotal = this.iCap + this.iQueue;
    const backlogTerm = this.alpha * (lRef - ctx.qlen) / stepS;
    const lam = Math.max(0, this.muHat + backlogTerm - this.beta * iTotal);

    this.nAllow = this.toNAllow(lam);
    this.controlSignal = iTotal;
  }
}

export function createAlgorithm(name) {
  switch (name) {
    case 'Fixed Backpressure': return new FixedBackpressure();
    case 'AIMD':               return new AIMD();
    case 'PIE':                return new PIE();
    case 'GradientDescent':    return new GradientDescent();
    case 'P-DARC':             return new PDARC();
    case 'P-DARC-noI':         return new PDARC(D_REF, PDARC_ALPHA, 0.0);
    case 'P-DARC-noEMA':       return new PDARC(D_REF, PDARC_ALPHA, PDARC_BETA, 1.0);
    case 'P-DARC-staticL':     return new PDARCStaticL();
    default: throw new Error(`Unknown algorithm: ${name}`);
  }
}

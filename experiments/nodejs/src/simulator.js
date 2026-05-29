import { CAPACITY, STEP_MS, EPS } from './config.js';
import { StepContext } from './algorithms.js';
import { poisson } from './rng.js';

class Task {
  constructor(arrivalTime) {
    this.arrivalTime = arrivalTime;
    this.finishTime = -1;
  }
}

/**
 * Discrete-step SED queue simulator on Node.js event-loop tick model.
 * Each step k corresponds to one T_step measurement window (paper §3).
 */
export class Simulator {
  constructor(algo, {
    capacityPerSec = CAPACITY,
    stepMs = STEP_MS,
    durationS = 120,
    warmupS = 10,
  } = {}) {
    this.algo = algo;
    this.capacityPerSec = capacityPerSec;
    this.stepMs = stepMs;
    this.stepS = stepMs / 1000;
    this.durationS = durationS;
    this.warmupS = warmupS;
    this.steps = Math.floor((durationS * 1000) / stepMs);
    this.taskServiceTime = 1 / capacityPerSec;
    this.queue = [];
    this.metrics = {
      time: [],
      qlen: [],
      nAllow: [],
      nAdmitted: [],
      nRejected: [],
      controlSignal: [],
      throughput: [],
      interference: [],
      muHat: [],
    };
    this.finishedTasks = [];
  }

  run(arrivalRates, interferences, rng) {
    // Input validation
    if (!Array.isArray(arrivalRates)) {
      throw new Error('arrivalRates must be an array');
    }
    if (!Array.isArray(interferences)) {
      throw new Error('interferences must be an array');
    }
    if (arrivalRates.length !== interferences.length) {
      throw new Error(`arrivalRates and interferences length mismatch: ${arrivalRates.length} vs ${interferences.length}`);
    }
    if (arrivalRates.length !== this.steps) {
      throw new Error(`arrivalRates length ${arrivalRates.length} does not match expected steps ${this.steps}`);
    }
    if (typeof rng !== 'function') {
      throw new Error('rng must be a function');
    }

    this.queue = [];
    this.finishedTasks = [];
    for (const key of Object.keys(this.metrics)) this.metrics[key] = [];

    this.algo.beginRun();

    for (let step = 0; step < this.steps; step++) {
      const t = step * this.stepS;
      const isWarmup = t < this.warmupS;
      const rate = arrivalRates[step];
      const interference = interferences[step];

      const nAllow = this.algo.getNAllow();
      const expected = rate * this.stepS;
      const nArrived = poisson(expected, rng);
      const nAdmitted = Math.min(nArrived, nAllow);
      const nRejected = nArrived - nAdmitted;

      for (let i = 0; i < nAdmitted; i++) {
        this.queue.push(new Task(t));
      }

      let availableTime = this.stepS * (1 - interference);
      let tProc = 0;
      let nOut = 0;
      const stepDelays = [];

      while (this.queue.length > 0 && availableTime + EPS >= this.taskServiceTime) {
        const task = this.queue.shift();
        const startTime = t + this.stepS - availableTime;
        availableTime -= this.taskServiceTime;
        task.finishTime = startTime + this.taskServiceTime;
        const delay = task.finishTime - task.arrivalTime;
        stepDelays.push(delay);
        tProc += this.taskServiceTime;
        nOut += 1;
        if (!isWarmup) this.finishedTasks.push(delay);
      }

      const qlen = this.queue.length;
      const avgDelay = stepDelays.length > 0
        ? stepDelays.reduce((a, b) => a + b, 0) / stepDelays.length
        : null;

      const ctx = new StepContext(
        nOut, tProc, qlen, nArrived, nAdmitted, nRejected,
        avgDelay, interference, this.stepS,
      );
      this.algo.update(ctx);

      this.metrics.time.push(t);
      this.metrics.qlen.push(qlen);
      this.metrics.nAllow.push(nAllow);
      this.metrics.nAdmitted.push(nAdmitted);
      this.metrics.nRejected.push(nRejected);
      this.metrics.controlSignal.push(this.algo.controlSignal ?? 0);
      this.metrics.throughput.push(nOut / this.stepS);
      this.metrics.interference.push(interference);
      this.metrics.muHat.push(this.algo.muHat ?? 0);
    }

    return { metrics: this.metrics, finishedTasks: this.finishedTasks };
  }
}

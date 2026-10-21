import type { Client } from "discord.js";

interface CacheEntry {
  value: any;
  expires: number;
}

class StateTracker {
  states: Map<string, any>;
  cache: Map<string, CacheEntry>;
  intervalFunctions: Map<string, () => void>;
  interval: NodeJS.Timeout | undefined;
  intervalMs: number;
  isActive: boolean;

  constructor() {
    this.states = new Map();
    this.cache = new Map();
    this.intervalFunctions = new Map();

    this.interval = undefined;
    this.intervalMs = 5_000;

    this.isActive = true;
  }

  setInactive() {
    this.isActive = false;
  }

  getClient(): Client {
    return this.states.get("client");
  }

  // ========== State ==========
  setState(key: string, value: any) {
    this.states.set(key, value);
  }

  setStateIfNotSet(key: string, value: any) {
    if (!this.states.has(key)) this.states.set(key, value);
  }

  getState(key: string) {
    return this.states.get(key);
  }

  removeState(key: string) {
    this.states.delete(key);
  }

  // ========== Cache ==========
  /**
   * Set a cached value with optional TTL (ms)
   */
  setCache(key: string, value: any, ttlMs = 60_000) {
    const expires = Date.now() + ttlMs;
    this.cache.set(key, { value, expires });
  }

  /**
   * Get a cached value, returns null if expired or not found
   */
  getCache(key: string) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }
    return entry.value;
  }

  /**
   * Delete a cached value
   */
  removeCache(key: string) {
    this.cache.delete(key);
  }

  /**
   * Clean expired cache entries (runs automatically via interval)
   */
  cleanCache() {
    const now = Date.now();
    for (const [key, { expires }] of this.cache.entries()) {
      if (now > expires) this.cache.delete(key);
    }
  }

  // ========== Interval Functions ==========
  setIntervalMs(ms: number) {
    this.intervalMs = ms;
  }

  setIntervalFunction(key: string, func: () => void) {
    this.intervalFunctions.set(key, func);

    if (!this.interval) {
      this.interval = setInterval(() => {
        this.cleanCache();

        if (this.intervalFunctions.size === 0) {
          clearInterval(this.interval);
          this.interval = undefined;
          return;
        }

        console.log(`[IntervalFunctions] Running ${this.intervalFunctions.size} functions.`);
        for (const [key, func] of this.intervalFunctions.entries()) {
          console.log(`[IntervalFunctions] Running ${key}.`);
          func();
        }
      }, this.intervalMs);
    }
  }

  removeIntervalFunction(key: string) {
    this.intervalFunctions.delete(key);

    if (this.intervalFunctions.size === 0) {
      clearInterval(this.interval);
      this.interval = undefined;
    }
  }
}

const globalState = new StateTracker();
export default globalState;

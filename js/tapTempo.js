// タップテンポ: 連続タップの間隔平均からBPMを算出する

const MAX_INTERVAL_MS = 2000; // これより間隔が空いたらリセット
const MAX_SAMPLES = 6;

export class TapTempo {
  constructor() {
    this.taps = [];
  }

  tap() {
    const now = performance.now();
    const last = this.taps[this.taps.length - 1];
    if (last != null && now - last > MAX_INTERVAL_MS) {
      this.taps = [];
    }
    this.taps.push(now);
    if (this.taps.length > MAX_SAMPLES) {
      this.taps.shift();
    }
    return this.getBpm();
  }

  getBpm() {
    if (this.taps.length < 2) return null;
    const intervals = [];
    for (let i = 1; i < this.taps.length; i++) {
      intervals.push(this.taps[i] - this.taps[i - 1]);
    }
    const avgMs = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    return Math.round(60000 / avgMs);
  }

  reset() {
    this.taps = [];
  }
}

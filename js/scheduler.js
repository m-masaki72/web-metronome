// Web Audio lookaheadスケジューラ（Chris Wilson "A Tale of Two Clocks" パターン）
import { playClick } from "./sounds.js";

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_SEC = 0.1;

export class Scheduler {
  constructor({ onBeat } = {}) {
    this.audioCtx = null;
    this.timerId = null;
    this.nextNoteTime = 0;
    this.beatInBar = 0; // 0-indexed
    this.barCount = 0;
    this.onBeat = onBeat || (() => {});

    this.bpm = 120;
    this.beatsPerBar = 4;
    this.soundType = "click";
    this.silent = false;

    this.shuffleEnabled = false;
    this.swingRatio = 0.6;

    this.countInEnabled = false;
    this.countInBars = 1;
    this.countInRemaining = 0;
    this.inCountIn = false;

    this.trainerEnabled = false;
    this.trainerTarget = 160;
    this.trainerStep = 4;
    this.trainerBars = 2;
    this.trainerBarsElapsed = 0;

    this.playing = false;
  }

  isPlaying() {
    return this.playing;
  }

  start() {
    if (this.playing) return;
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.audioCtx.state === "suspended") {
      this.audioCtx.resume();
    }

    this.beatInBar = 0;
    this.barCount = 0;
    this.trainerBarsElapsed = 0;
    this.inCountIn = this.countInEnabled;
    this.countInRemaining = this.countInEnabled ? this.countInBars * this.beatsPerBar : 0;

    this.nextNoteTime = this.audioCtx.currentTime + 0.05;
    this.playing = true;
    this._tick();
  }

  stop() {
    this.playing = false;
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  setBpm(bpm) {
    this.bpm = Math.max(30, Math.min(300, bpm));
  }

  setBeatsPerBar(n) {
    this.beatsPerBar = n;
  }

  setSoundType(type) {
    this.soundType = type;
  }

  setSilent(silent) {
    this.silent = silent;
  }

  setShuffle(enabled, ratio) {
    this.shuffleEnabled = enabled;
    if (ratio != null) this.swingRatio = ratio;
  }

  setCountIn(enabled, bars) {
    this.countInEnabled = enabled;
    if (bars != null) this.countInBars = bars;
  }

  setTrainer(enabled, { target, step, bars } = {}) {
    this.trainerEnabled = enabled;
    if (target != null) this.trainerTarget = target;
    if (step != null) this.trainerStep = step;
    if (bars != null) this.trainerBars = bars;
  }

  _secondsPerBeat() {
    return 60.0 / this.bpm;
  }

  _tick() {
    if (!this.playing) return;

    while (this.nextNoteTime < this.audioCtx.currentTime + SCHEDULE_AHEAD_SEC) {
      this._scheduleBeat(this.nextNoteTime, this.beatInBar, this.inCountIn);
      this._advanceNote();
    }

    this.timerId = setTimeout(() => this._tick(), LOOKAHEAD_MS);
  }

  _scheduleBeat(time, beatIndex, isCountIn) {
    const accent = beatIndex === 0 && !isCountIn;
    const weak = isCountIn;

    if (!this.silent) {
      playClick(this.audioCtx, time, {
        soundType: this.soundType,
        accent,
        weak,
        gain: isCountIn ? 0.7 : 1,
      });
    }

    // シャッフル: 拍の裏（8分音符位置）にも弱いクリックを追加
    if (this.shuffleEnabled && !isCountIn) {
      const beatDur = this._secondsPerBeat();
      const offTime = time + beatDur * this.swingRatio;
      if (!this.silent) {
        playClick(this.audioCtx, offTime, {
          soundType: this.soundType,
          accent: false,
          weak: true,
          gain: 0.5,
        });
      }
      this._notifyBeat(offTime, -1, false, true);
    }

    this._notifyBeat(time, beatIndex, accent, false, isCountIn);
  }

  _notifyBeat(time, beatIndex, accent, isOffBeat, isCountIn) {
    const delayMs = Math.max(0, (time - this.audioCtx.currentTime) * 1000);
    setTimeout(() => {
      if (!this.playing) return;
      this.onBeat({ beatIndex, accent, isOffBeat, isCountIn, beatsPerBar: this.beatsPerBar });
    }, delayMs);
  }

  _advanceNote() {
    const secondsPerBeat = this._secondsPerBeat();
    this.nextNoteTime += secondsPerBeat;

    if (this.inCountIn) {
      this.countInRemaining--;
      this.beatInBar = (this.beatInBar + 1) % this.beatsPerBar;
      if (this.countInRemaining <= 0) {
        this.inCountIn = false;
        this.beatInBar = 0;
      }
      return;
    }

    this.beatInBar++;
    if (this.beatInBar >= this.beatsPerBar) {
      this.beatInBar = 0;
      this.barCount++;
      this._maybeAdvanceTrainer();
    }
  }

  _maybeAdvanceTrainer() {
    if (!this.trainerEnabled) return;
    this.trainerBarsElapsed++;
    if (this.trainerBarsElapsed >= this.trainerBars) {
      this.trainerBarsElapsed = 0;
      const direction = this.trainerTarget >= this.bpm ? 1 : -1;
      const next = this.bpm + direction * this.trainerStep;
      if ((direction > 0 && next >= this.trainerTarget) || (direction < 0 && next <= this.trainerTarget)) {
        this.bpm = this.trainerTarget;
        this.trainerEnabled = false;
      } else {
        this.bpm = next;
      }
      this.onBeat({ bpmChanged: true, bpm: this.bpm });
    }
  }
}

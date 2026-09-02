// 画面フラッシュ・拍数表示・振り子アニメーションの制御
import { BPM_MIN, BPM_MAX } from "./bpmRange.js";

const MAX_ANGLE = 24; // 振り子の最大振れ角(deg)

// 重り位置(0=支点寄り/速い 〜 1=先端/遅い) <-> BPM の相互変換。
// ドラッグ操作(main.js)とアニメーション同期(setPendulumBpm)の両方から使う共通ロジック。
function clamp01(t) {
  return Math.max(0, Math.min(1, t));
}

export function weightPosToBpm(pos) {
  return Math.round(BPM_MIN + (1 - clamp01(pos)) * (BPM_MAX - BPM_MIN));
}

export class VisualBeat {
  // getAudioTime: AudioContext.currentTime を返す関数（振り子をクリック音に厳密同期させる時刻源）
  constructor({ flashEl, numberEl, dotsEl, pendulumEl, weightEl, getAudioTime }) {
    this.flashEl = flashEl;
    this.numberEl = numberEl;
    this.dotsEl = dotsEl;
    this.pendulumEl = pendulumEl;
    this.weightEl = weightEl;
    this.getAudioTime = getAudioTime || (() => null);
    this.enabled = true;
    this.beatsPerBar = 4;

    // 振り子の位相状態（rAF駆動）
    this.rafId = null;
    this.bpm = 120;
    this.beatAnchorTime = null; // 直近に発火した拍の絶対時刻(AudioContext基準) = 中心通過の瞬間
    this.beatSpb = 0.5;         // その拍時点の1拍の長さ(秒) = 中心通過から次の中心通過までの半周期
    this.beatParity = 0;        // 0:この拍の後は右へ振れる / 1:左へ振れる
    this.reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    this.buildDots();
  }

  setEnabled(enabled) {
    this.enabled = enabled;
  }

  // 振り子は1往復で2拍（左端→右端で1拍、右端→左端で1拍）
  // 実物同様、遅いBPMほど重りは先端側（支点から遠く）、速いBPMほど支点寄りに移動する
  setPendulumBpm(bpm) {
    this.bpm = bpm;
    if (this.weightEl) {
      this.weightEl.style.setProperty("--weight-pos", bpmToWeightPos(bpm).toFixed(3));
    }
  }

  startPendulum() {
    if (!this.pendulumEl) return;
    // 開始時は基準拍が未確定。最初のfire()で確定するまで中央で待機する
    this.beatAnchorTime = null;
    this.beatParity = 0;
    this._setAngle(0);
    if (this.reduceMotion) return;
    if (this.rafId === null) {
      this.rafId = requestAnimationFrame(() => this._frame());
    }
  }

  stopPendulum() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.beatAnchorTime = null;
    this._setAngle(0);
  }

  _setAngle(deg) {
    if (!this.pendulumEl) return;
    this.pendulumEl.style.transform = `rotate(${deg.toFixed(3)}deg)`;
  }

  // 拍の絶対時刻を基準に、次の拍までの進行度から角度を毎フレーム再計算する。
  // BPM変更・スピードトレーナーの加速時も、次拍時刻が変わるだけで滑らかに追従する。
  _frame() {
    this.rafId = requestAnimationFrame(() => this._frame());
    const now = this.getAudioTime();
    if (now === null) return;
    this._frameAt(now);
  }

  // 指定時刻における角度を求めてDOMに反映する。
  // 拍＝振り子が中心(0deg)を通過する瞬間（実物の脱進機がカチッと鳴る位置）。
  // 拍と拍の間で中心→端→中心と半周期分動くサイン波でモデル化する。
  _frameAt(now) {
    if (this.beatAnchorTime === null) return;

    const spb = this.beatSpb > 0 ? this.beatSpb : 60 / this.bpm;
    let progress = (now - this.beatAnchorTime) / spb; // 0.0=中心(この拍) 〜 1.0=中心(次の拍)
    if (progress < 0) progress = 0;
    progress %= 1; // 次拍が来ないまま進んでも周期的に振れ続ける（fire()で再同期）

    const dir = this.beatParity === 0 ? 1 : -1; // この拍の後、最初にどちら向きへ振れるか
    const angle = dir * MAX_ANGLE * Math.sin(Math.PI * progress);

    this._setAngle(angle);
  }

  setBeatsPerBar(n) {
    this.beatsPerBar = n;
    this.buildDots();
  }

  buildDots() {
    this.dotsEl.textContent = "";
    for (let i = 0; i < this.beatsPerBar; i++) {
      const dot = document.createElement("div");
      dot.className = "dot" + (i === 0 ? " accent" : "");
      this.dotsEl.appendChild(dot);
    }
  }

  reset() {
    this.numberEl.textContent = "1";
    [...this.dotsEl.children].forEach((d, i) => d.classList.toggle("active", i === 0));
  }

  fire({ beatIndex, accent, isOffBeat, isCountIn, time, secondsPerBeat }) {
    // 裏拍は音のみで視覚には反映しない。フラッシュ頻度が上がると光過敏性リスクが増すため意図的に無視している。
    if (isOffBeat) return;

    // 振り子の再同期: この拍の瞬間に必ず中心(0deg)を通過させる。
    // 通過後に振れる向きは拍ごとに交互（1往復=2拍）。
    if (time != null && this.rafId !== null) {
      if (this.beatAnchorTime !== null) {
        this.beatParity = 1 - this.beatParity;
      }
      this.beatAnchorTime = time;
      if (secondsPerBeat > 0) this.beatSpb = secondsPerBeat;
    }

    if (!isCountIn) {
      this.numberEl.textContent = String(beatIndex + 1);
      [...this.dotsEl.children].forEach((d, i) => d.classList.toggle("active", i === beatIndex));
    } else {
      this.numberEl.textContent = "•";
    }

    // 数字の点灯：クラス付与→次フレームで解除しCSS transitionでフェードさせる
    this.numberEl.classList.remove("pulse", "pulse-accent");
    void this.numberEl.offsetWidth; // reflowで前回のtransitionを打ち切る
    this.numberEl.classList.add(accent ? "pulse-accent" : "pulse");
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.numberEl.classList.remove("pulse", "pulse-accent");
      });
    });

    if (!this.enabled) return;
    this.flashEl.classList.toggle("accent", accent);
    this.flashEl.classList.add("on");
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.flashEl.classList.remove("on");
      });
    });
  }
}

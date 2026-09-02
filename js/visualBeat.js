// 画面フラッシュ・拍数表示の制御

export class VisualBeat {
  constructor({ flashEl, numberEl, dotsEl }) {
    this.flashEl = flashEl;
    this.numberEl = numberEl;
    this.dotsEl = dotsEl;
    this.enabled = true;
    this.beatsPerBar = 4;
    this.buildDots();
  }

  setEnabled(enabled) {
    this.enabled = enabled;
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

  fire({ beatIndex, accent, isOffBeat, isCountIn }) {
    if (isOffBeat) return; // 裏拍は数字/ドット表示を更新しない（フラッシュのみ軽く）

    if (!isCountIn) {
      this.numberEl.textContent = String(beatIndex + 1);
      [...this.dotsEl.children].forEach((d, i) => d.classList.toggle("active", i === beatIndex));
    } else {
      this.numberEl.textContent = "•";
    }

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

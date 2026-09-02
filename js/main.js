import { Scheduler } from "./scheduler.js";
import { TapTempo } from "./tapTempo.js";
import { hapticsSupported, vibrateBeat } from "./haptics.js";
import { acquireWakeLock, releaseWakeLock } from "./wakeLock.js";
import { loadPresets, addPreset, removePreset } from "./presets.js";
import { VisualBeat } from "./visualBeat.js";

const $ = (id) => document.getElementById(id);

const els = {
  themeToggle: $("theme-toggle"),
  beatNumber: $("beat-number"),
  beatDots: $("beat-dots"),
  flashOverlay: $("flash-overlay"),
  bpmDown: $("bpm-down"),
  bpmUp: $("bpm-up"),
  bpmInput: $("bpm-input"),
  bpmSlider: $("bpm-slider"),
  playToggle: $("play-toggle"),
  tapTempo: $("tap-tempo"),
  presetList: $("preset-list"),
  presetAdd: $("preset-add"),
  timeSignature: $("time-signature"),
  soundType: $("sound-type"),
  visualToggle: $("visual-toggle"),
  hapticsToggle: $("haptics-toggle"),
  silentToggle: $("silent-toggle"),
  shuffleToggle: $("shuffle-toggle"),
  swingRange: $("swing-range"),
  swingValue: $("swing-value"),
  countinToggle: $("countin-toggle"),
  countinBars: $("countin-bars"),
  trainerToggle: $("trainer-toggle"),
  trainerTarget: $("trainer-target"),
  trainerStep: $("trainer-step"),
  trainerBars: $("trainer-bars"),
};

const visualBeat = new VisualBeat({
  flashEl: els.flashOverlay,
  numberEl: els.beatNumber,
  dotsEl: els.beatDots,
});

const scheduler = new Scheduler({
  onBeat: (info) => {
    if (info.bpmChanged) {
      els.bpmInput.value = info.bpm;
      els.bpmSlider.value = info.bpm;
      return;
    }
    visualBeat.fire(info);
    if (els.hapticsToggle.checked) {
      vibrateBeat(info.accent);
    }
  },
});

const tapTempo = new TapTempo();

if (!hapticsSupported) {
  els.hapticsToggle.checked = false;
  els.hapticsToggle.disabled = true;
  els.hapticsToggle.parentElement.title = "この端末/ブラウザはハプティクス非対応ですわ";
}

function clampBpm(v) {
  return Math.max(30, Math.min(300, v));
}

function setBpm(v) {
  const bpm = clampBpm(v);
  els.bpmInput.value = bpm;
  els.bpmSlider.value = bpm;
  scheduler.setBpm(bpm);
}

els.bpmInput.addEventListener("change", () => setBpm(parseInt(els.bpmInput.value, 10) || 120));
els.bpmSlider.addEventListener("input", () => setBpm(parseInt(els.bpmSlider.value, 10)));
els.bpmDown.addEventListener("click", () => setBpm(parseInt(els.bpmInput.value, 10) - 1));
els.bpmUp.addEventListener("click", () => setBpm(parseInt(els.bpmInput.value, 10) + 1));

els.tapTempo.addEventListener("click", () => {
  const bpm = tapTempo.tap();
  if (bpm) setBpm(bpm);
});

els.timeSignature.addEventListener("change", () => {
  const n = parseInt(els.timeSignature.value, 10);
  scheduler.setBeatsPerBar(n);
  visualBeat.setBeatsPerBar(n);
  visualBeat.reset();
});

els.soundType.addEventListener("change", () => scheduler.setSoundType(els.soundType.value));
els.visualToggle.addEventListener("change", () => visualBeat.setEnabled(els.visualToggle.checked));
els.silentToggle.addEventListener("change", () => scheduler.setSilent(els.silentToggle.checked));

els.shuffleToggle.addEventListener("change", () => {
  scheduler.setShuffle(els.shuffleToggle.checked, els.swingRange.value / 100);
});
els.swingRange.addEventListener("input", () => {
  els.swingValue.textContent = `${els.swingRange.value}%`;
  scheduler.setShuffle(els.shuffleToggle.checked, els.swingRange.value / 100);
});

els.countinToggle.addEventListener("change", () => {
  scheduler.setCountIn(els.countinToggle.checked, parseInt(els.countinBars.value, 10));
});
els.countinBars.addEventListener("change", () => {
  scheduler.setCountIn(els.countinToggle.checked, parseInt(els.countinBars.value, 10));
});

function syncTrainer() {
  scheduler.setTrainer(els.trainerToggle.checked, {
    target: parseInt(els.trainerTarget.value, 10),
    step: parseInt(els.trainerStep.value, 10),
    bars: parseInt(els.trainerBars.value, 10),
  });
}
[els.trainerToggle, els.trainerTarget, els.trainerStep, els.trainerBars].forEach((el) =>
  el.addEventListener("change", syncTrainer)
);

async function play() {
  scheduler.setBpm(parseInt(els.bpmInput.value, 10));
  scheduler.setBeatsPerBar(parseInt(els.timeSignature.value, 10));
  scheduler.setSoundType(els.soundType.value);
  scheduler.setSilent(els.silentToggle.checked);
  scheduler.setShuffle(els.shuffleToggle.checked, els.swingRange.value / 100);
  scheduler.setCountIn(els.countinToggle.checked, parseInt(els.countinBars.value, 10));
  syncTrainer();

  scheduler.start();
  els.playToggle.textContent = "■";
  els.playToggle.classList.add("playing");
  await acquireWakeLock();
}

async function pause() {
  scheduler.stop();
  els.playToggle.textContent = "▶";
  els.playToggle.classList.remove("playing");
  await releaseWakeLock();
}

els.playToggle.addEventListener("click", () => {
  if (scheduler.isPlaying()) {
    pause();
  } else {
    play();
  }
});

document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState === "visible" && scheduler.isPlaying()) {
    await acquireWakeLock();
  }
});

// --- プリセット ---
function renderPresets() {
  const presets = loadPresets();
  els.presetList.textContent = "";
  presets.forEach((p) => {
    const chip = document.createElement("div");
    chip.className = "preset-chip";
    const label = document.createElement("span");
    label.textContent = `${p.name} (${p.bpm})`;
    chip.appendChild(label);

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.textContent = "×";
    delBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      removePreset(p.id);
      renderPresets();
    });
    chip.appendChild(delBtn);

    chip.addEventListener("click", () => {
      setBpm(p.bpm);
      els.timeSignature.value = String(p.timeSignature);
      els.timeSignature.dispatchEvent(new Event("change"));
      els.soundType.value = p.soundType;
      els.soundType.dispatchEvent(new Event("change"));
      if (scheduler.isPlaying()) {
        scheduler.setBpm(p.bpm);
      }
    });

    els.presetList.appendChild(chip);
  });
}

els.presetAdd.addEventListener("click", () => {
  const name = prompt("プリセット名を入力してくださいまし");
  if (!name) return;
  addPreset({
    name,
    bpm: parseInt(els.bpmInput.value, 10),
    timeSignature: parseInt(els.timeSignature.value, 10),
    soundType: els.soundType.value,
  });
  renderPresets();
});

renderPresets();

// --- テーマ ---
const THEME_KEY = "metronome_theme";
function applyTheme(theme) {
  document.documentElement.classList.toggle("light", theme === "light");
  els.themeToggle.textContent = theme === "light" ? "☀" : "🌙";
  localStorage.setItem(THEME_KEY, theme);
}
const savedTheme = localStorage.getItem(THEME_KEY) || "dark";
applyTheme(savedTheme);
els.themeToggle.addEventListener("click", () => {
  const current = document.documentElement.classList.contains("light") ? "light" : "dark";
  applyTheme(current === "light" ? "dark" : "light");
});

// --- Service Worker登録 ---
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

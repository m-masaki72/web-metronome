import { Scheduler } from "./scheduler.js";
import { TapTempo } from "./tapTempo.js";
import { hapticsSupported, vibrateBeat } from "./haptics.js";
import { acquireWakeLock, releaseWakeLock } from "./wakeLock.js";
import { loadSlots, saveSlot, loadActiveSlot, saveActiveSlot, SLOT_COUNT } from "./quickSlots.js";
import { VisualBeat, weightPosToBpm } from "./visualBeat.js";

const $ = (id) => document.getElementById(id);

const els = {
  themeToggle: $("theme-toggle"),
  beatNumber: $("beat-number"),
  beatDots: $("beat-dots"),
  flashOverlay: $("flash-overlay"),
  metronomeScale: $("metronome-scale"),
  pendulum: $("pendulum"),
  pendulumWeight: $("pendulum-weight"),
  bpmDown: $("bpm-down"),
  bpmUp: $("bpm-up"),
  bpmInput: $("bpm-input"),
  bpmSlider: $("bpm-slider"),
  playToggle: $("play-toggle"),
  tapTempo: $("tap-tempo"),
  quickSlots: $("quick-slots"),
  timeSignature: $("time-signature"),
  soundType: $("sound-type"),
  bellToggle: $("bell-toggle"),
  bellInterval: $("bell-interval"),
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
  summaryTimeSound: $("summary-time-sound"),
  summaryVisualHaptics: $("summary-visual-haptics"),
  summaryShuffle: $("summary-shuffle"),
  summaryCountin: $("summary-countin"),
  summaryTrainer: $("summary-trainer"),
};

const visualBeat = new VisualBeat({
  flashEl: els.flashOverlay,
  numberEl: els.beatNumber,
  dotsEl: els.beatDots,
  pendulumEl: els.pendulum,
  weightEl: els.pendulumWeight,
  // 振り子をクリック音に厳密同期させるための時刻源
  getAudioTime: () => scheduler.currentTime(),
});
visualBeat.setEnabled(els.visualToggle.checked);
visualBeat.setPendulumBpm(parseInt(els.bpmInput.value, 10));

const scheduler = new Scheduler({
  onBeat: (info) => {
    if (info.bpmChanged) {
      els.bpmInput.value = info.bpm;
      els.bpmSlider.value = info.bpm;
      visualBeat.setPendulumBpm(info.bpm);
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
  els.pendulumWeight.setAttribute("aria-valuenow", bpm);
  scheduler.setBpm(bpm);
  visualBeat.setPendulumBpm(bpm);
}

els.bpmInput.addEventListener("change", () => setBpm(parseInt(els.bpmInput.value, 10) || 120));
els.bpmSlider.addEventListener("input", () => setBpm(parseInt(els.bpmSlider.value, 10)));
els.bpmDown.addEventListener("click", () => setBpm(parseInt(els.bpmInput.value, 10) - 1));
els.bpmUp.addEventListener("click", () => setBpm(parseInt(els.bpmInput.value, 10) + 1));

els.tapTempo.addEventListener("click", () => {
  const bpm = tapTempo.tap();
  if (bpm) setBpm(bpm);
});

// --- 重りドラッグでBPM変更 ---
// 実物同様、重りを支点(下)〜先端(上)にスライドさせてテンポを変える。
// 再生中は振り子が回転しておりドラッグ方向と角度がずれるため、掴んだ瞬間だけ振り子を垂直に固定する。
(() => {
  let dragging = false;
  let wasPlaying = false;

  // 0.20/0.72 は css/style.css の `.pendulum-weight { top: calc(72% - var(--weight-pos) * 52%) }` の逆算値。
  // CSS側の可動範囲(20%〜72%)を変更したらここも合わせて変更すること。
  function posFromClientY(clientY) {
    const rect = els.metronomeScale.getBoundingClientRect();
    const topMin = rect.top + rect.height * 0.20;
    const topMax = rect.top + rect.height * 0.72;
    const ratio = (clientY - topMin) / (topMax - topMin); // 0(先端/上)〜1(支点/下)
    return 1 - Math.max(0, Math.min(1, ratio)); // weightPos: 0(支点)〜1(先端) に合わせて反転
  }

  function onMove(e) {
    if (!dragging) return;
    const pos = posFromClientY(e.clientY);
    setBpm(weightPosToBpm(pos));
  }

  function endDrag() {
    if (!dragging) return;
    dragging = false;
    els.pendulumWeight.classList.remove("dragging");
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", endDrag);
    if (wasPlaying) visualBeat.startPendulum();
    persistSettings();
  }

  els.pendulumWeight.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    dragging = true;
    wasPlaying = scheduler.isPlaying();
    els.pendulumWeight.classList.add("dragging");
    if (wasPlaying) visualBeat.stopPendulum();
    onMove(e);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", endDrag);
  });

  // キーボード操作（アクセシビリティ）
  els.pendulumWeight.addEventListener("keydown", (e) => {
    if (e.key === "ArrowUp" || e.key === "ArrowRight") {
      e.preventDefault();
      setBpm(parseInt(els.bpmInput.value, 10) + 1);
      persistSettings();
    } else if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
      e.preventDefault();
      setBpm(parseInt(els.bpmInput.value, 10) - 1);
      persistSettings();
    }
  });
})();

els.timeSignature.addEventListener("change", () => {
  const n = parseInt(els.timeSignature.value, 10);
  scheduler.setBeatsPerBar(n);
  visualBeat.setBeatsPerBar(n);
  visualBeat.reset();
});

els.soundType.addEventListener("change", () => scheduler.setSoundType(els.soundType.value));
function syncBell() {
  scheduler.setBellEnabled(els.bellToggle.checked, parseInt(els.bellInterval.value, 10));
}
els.bellToggle.addEventListener("change", syncBell);
els.bellInterval.addEventListener("change", syncBell);
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
  syncBell();
  scheduler.setShuffle(els.shuffleToggle.checked, els.swingRange.value / 100);
  scheduler.setCountIn(els.countinToggle.checked, parseInt(els.countinBars.value, 10));
  syncTrainer();

  scheduler.start();
  visualBeat.setPendulumBpm(parseInt(els.bpmInput.value, 10));
  visualBeat.startPendulum();
  els.playToggle.textContent = "■";
  els.playToggle.classList.add("playing");
  await acquireWakeLock();
}

async function pause() {
  scheduler.stop();
  visualBeat.stopPendulum();
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

// --- 設定バンク(1〜5) ---
// 5つの独立した設定（BPM・拍子・音色・各種トグル）を切り替えて使う。
// 選択中バンクの中身はBPM等を変更するたびに自動的に上書き保存される（明示的な保存操作はない）。
let activeSlot = loadActiveSlot();

function collectSettings() {
  return {
    bpm: parseInt(els.bpmInput.value, 10),
    timeSignature: els.timeSignature.value,
    soundType: els.soundType.value,
    bell: els.bellToggle.checked,
    bellInterval: els.bellInterval.value,
    visual: els.visualToggle.checked,
    haptics: els.hapticsToggle.checked,
    silent: els.silentToggle.checked,
    shuffle: els.shuffleToggle.checked,
    swing: els.swingRange.value,
    countin: els.countinToggle.checked,
    countinBars: els.countinBars.value,
    trainer: els.trainerToggle.checked,
    trainerTarget: els.trainerTarget.value,
    trainerStep: els.trainerStep.value,
    trainerBars: els.trainerBars.value,
  };
}

function persistSettings() {
  saveSlot(activeSlot, collectSettings());
  renderSummaries();
}

// 折りたたんだ<details>のsummaryに現在値を簡易表示する
function renderSummaries() {
  const timeSigLabel = els.timeSignature.selectedOptions[0].text;
  const soundLabel = els.soundType.selectedOptions[0].text;
  els.summaryTimeSound.textContent = `${timeSigLabel}・${soundLabel}${els.bellToggle.checked ? "・ベル" : ""}`;

  const visualHapticsOn = [
    els.visualToggle.checked && "フラッシュ",
    els.hapticsToggle.checked && "ハプティクス",
    els.silentToggle.checked && "サイレント",
  ].filter(Boolean);
  els.summaryVisualHaptics.textContent = visualHapticsOn.length ? visualHapticsOn.join("・") : "なし";

  els.summaryShuffle.textContent = els.shuffleToggle.checked ? `ON ${els.swingRange.value}%` : "OFF";
  els.summaryCountin.textContent = els.countinToggle.checked ? `ON ${els.countinBars.value}小節` : "OFF";
  els.summaryTrainer.textContent = els.trainerToggle.checked ? `ON →${els.trainerTarget.value}` : "OFF";
}

// 保存済みの設定一式をUI/スケジューラに適用する
function applyConfig(s) {
  if (s.bpm) {
    els.bpmInput.value = s.bpm;
    els.bpmSlider.value = s.bpm;
  }
  if (s.timeSignature) els.timeSignature.value = s.timeSignature;
  if (s.soundType) els.soundType.value = s.soundType;
  if (typeof s.bell === "boolean") els.bellToggle.checked = s.bell;
  if (s.bellInterval) els.bellInterval.value = s.bellInterval;
  if (typeof s.visual === "boolean") els.visualToggle.checked = s.visual;
  if (typeof s.haptics === "boolean" && !els.hapticsToggle.disabled) els.hapticsToggle.checked = s.haptics;
  if (typeof s.silent === "boolean") els.silentToggle.checked = s.silent;
  if (typeof s.shuffle === "boolean") els.shuffleToggle.checked = s.shuffle;
  if (s.swing) {
    els.swingRange.value = s.swing;
    els.swingValue.textContent = `${s.swing}%`;
  }
  if (typeof s.countin === "boolean") els.countinToggle.checked = s.countin;
  if (s.countinBars) els.countinBars.value = s.countinBars;
  if (typeof s.trainer === "boolean") els.trainerToggle.checked = s.trainer;
  if (s.trainerTarget) els.trainerTarget.value = s.trainerTarget;
  if (s.trainerStep) els.trainerStep.value = s.trainerStep;
  if (s.trainerBars) els.trainerBars.value = s.trainerBars;

  scheduler.setBpm(parseInt(els.bpmInput.value, 10));
  scheduler.setBeatsPerBar(parseInt(els.timeSignature.value, 10));
  scheduler.setSoundType(els.soundType.value);
  scheduler.setSilent(els.silentToggle.checked);
  syncBell();
  scheduler.setShuffle(els.shuffleToggle.checked, els.swingRange.value / 100);
  scheduler.setCountIn(els.countinToggle.checked, parseInt(els.countinBars.value, 10));
  syncTrainer();

  els.pendulumWeight.setAttribute("aria-valuenow", els.bpmInput.value);
  visualBeat.setEnabled(els.visualToggle.checked);
  visualBeat.setPendulumBpm(parseInt(els.bpmInput.value, 10));
  visualBeat.setBeatsPerBar(parseInt(els.timeSignature.value, 10));
  visualBeat.reset();

  renderSummaries();
}

function renderSlotTabs() {
  els.quickSlots.textContent = "";
  for (let i = 0; i < SLOT_COUNT; i++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "quick-slot-btn" + (i === activeSlot ? " active" : "");
    btn.textContent = String(i + 1);
    btn.addEventListener("click", () => {
      if (i === activeSlot) return;
      activeSlot = i;
      saveActiveSlot(activeSlot);
      applyConfig(loadSlots()[activeSlot]);
      renderSlotTabs();
    });
    els.quickSlots.appendChild(btn);
  }
}

applyConfig(loadSlots()[activeSlot]);
renderSlotTabs();

const SETTINGS_WATCH_IDS = [
  "bpm-input", "bpm-slider", "time-signature", "sound-type",
  "bell-toggle", "bell-interval",
  "visual-toggle", "haptics-toggle", "silent-toggle",
  "shuffle-toggle", "swing-range",
  "countin-toggle", "countin-bars",
  "trainer-toggle", "trainer-target", "trainer-step", "trainer-bars",
];
SETTINGS_WATCH_IDS.forEach((id) => {
  const el = $(id);
  el.addEventListener("change", persistSettings);
  if (el.type === "range" || el.type === "number") {
    el.addEventListener("input", persistSettings);
  }
});

// --- Service Worker登録 ---
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

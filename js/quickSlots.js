// 1〜5の設定バンク。名前付きプリセットのような保存操作は持たず、
// 選択中バンクの中身はBPM等の変更のたびに自動的に上書きされる（常時自動保存）。
// 「今どのバンクにいるか」もあわせて永続化する。

const STORAGE_KEY = "metronome_slots";
const ACTIVE_KEY = "metronome_active_slot";
const SLOT_COUNT = 5;

const DEFAULT_SLOT = {
  bpm: 120, timeSignature: 4, soundType: "click", bell: true, bellInterval: 1,
  visual: false, haptics: false, silent: false, shuffle: false, swing: 60,
  countin: false, countinBars: 1,
  trainer: false, trainerTarget: 160, trainerStep: 4, trainerBars: 2,
};

const DEFAULT_SLOTS = [
  { ...DEFAULT_SLOT, bpm: 60 },
  { ...DEFAULT_SLOT, bpm: 90 },
  { ...DEFAULT_SLOT, bpm: 120 },
  { ...DEFAULT_SLOT, bpm: 140, soundType: "wood", bell: true, bellInterval: 2 },
  { ...DEFAULT_SLOT, bpm: 180, soundType: "beep", bell: true, bellInterval: 4 },
];

export function loadSlots() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const stored = raw ? JSON.parse(raw) : [];
    return DEFAULT_SLOTS.map((def, i) => ({ ...def, ...(stored[i] || {}) }));
  } catch {
    return DEFAULT_SLOTS.slice();
  }
}

export function saveSlot(index, config) {
  const slots = loadSlots();
  slots[index] = config;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slots));
  } catch {
    // ストレージ制限・プライベートモード等でも致命的ではないので無視する
  }
}

export function loadActiveSlot() {
  const raw = localStorage.getItem(ACTIVE_KEY);
  const i = raw ? parseInt(raw, 10) : 0;
  return Number.isInteger(i) && i >= 0 && i < SLOT_COUNT ? i : 0;
}

export function saveActiveSlot(index) {
  try {
    localStorage.setItem(ACTIVE_KEY, String(index));
  } catch {
    // ストレージ制限・プライベートモード等でも致命的ではないので無視する
  }
}

export { SLOT_COUNT };

// プリセット（名前付きBPM+拍子+音色）のlocalStorage CRUD

const STORAGE_KEY = "metronome_presets";

export function loadPresets() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function savePresets(presets) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
}

export function addPreset(preset) {
  const presets = loadPresets();
  presets.push({ id: crypto.randomUUID(), ...preset });
  savePresets(presets);
  return presets;
}

export function removePreset(id) {
  const presets = loadPresets().filter((p) => p.id !== id);
  savePresets(presets);
  return presets;
}

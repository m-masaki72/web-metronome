// Vibration API ラッパー（iOS Safari等の非対応環境ではno-op）

export const hapticsSupported = "vibrate" in navigator;

export function vibrateBeat(accent = false) {
  if (!hapticsSupported) return;
  try {
    navigator.vibrate(accent ? 40 : 15);
  } catch {
    // 一部環境で例外になる場合があるが再生自体は継続する
  }
}

// Screen Wake Lock API ラッパー。非対応ブラウザではサイレントに無視する。

let sentinel = null;

export async function acquireWakeLock() {
  if (!("wakeLock" in navigator)) return;
  try {
    sentinel = await navigator.wakeLock.request("screen");
  } catch {
    sentinel = null;
  }
}

export async function releaseWakeLock() {
  if (sentinel) {
    try {
      await sentinel.release();
    } catch {
      // 既に解放済み等は無視
    }
    sentinel = null;
  }
}

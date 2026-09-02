// BPMの有効範囲。main.js/scheduler.js/visualBeat.jsで共通利用する。
export const BPM_MIN = 30;
export const BPM_MAX = 300;

export function clampBpm(v) {
  return Math.max(BPM_MIN, Math.min(BPM_MAX, v));
}

// クリック音再生。sounds/配下の実サンプル音声をAudioBufferとしてロード・キャッシュし、
// AudioBufferSourceNodeで正確なタイミング再生する。読込前/失敗時はOscillator合成にフォールバックする。

const SOUND_FILES = {
  click: "sounds/click.wav",
  wood: "sounds/wood.wav",
  beep: "sounds/beep.wav",
  block: "sounds/block.wav",
};
const BELL_FILE = "sounds/bell.wav";

const OSC_PARAMS = {
  click: { freq: 1500, accentFreq: 2200, type: "sine", duration: 0.05 },
  wood: { freq: 800, accentFreq: 1100, type: "square", duration: 0.03 },
  beep: { freq: 1000, accentFreq: 1500, type: "triangle", duration: 0.08 },
  block: { freq: 900, accentFreq: 1300, type: "square", duration: 0.06 },
};
const BELL_OSC_PARAMS = { freq: 2000, accentFreq: 2600, type: "sine", duration: 0.4 };

const bufferCache = new Map(); // audioCtx -> Map(url -> AudioBuffer|Promise)

function getCtxCache(audioCtx) {
  let cache = bufferCache.get(audioCtx);
  if (!cache) {
    cache = new Map();
    bufferCache.set(audioCtx, cache);
  }
  return cache;
}

function loadBuffer(audioCtx, url) {
  const cache = getCtxCache(audioCtx);
  if (cache.has(url)) return cache.get(url);

  const promise = fetch(url)
    .then((res) => res.arrayBuffer())
    .then((data) => audioCtx.decodeAudioData(data))
    .then((buffer) => {
      cache.set(url, buffer);
      return buffer;
    })
    .catch(() => {
      cache.delete(url);
      return null;
    });

  cache.set(url, promise);
  return promise;
}

// 起動直後にまとめてプリロードしておく（初回再生時のフェッチ遅延を避ける）
export function preloadSounds(audioCtx) {
  Object.values(SOUND_FILES).forEach((url) => loadBuffer(audioCtx, url));
  loadBuffer(audioCtx, BELL_FILE);
}

function playOscFallback(audioCtx, time, params, accent, weak, gain) {
  const osc = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();

  osc.type = params.type;
  osc.frequency.value = accent ? params.accentFreq : params.freq;

  const peakGain = (accent ? 0.9 : weak ? 0.35 : 0.6) * gain;
  gainNode.gain.setValueAtTime(0, time);
  gainNode.gain.linearRampToValueAtTime(peakGain, time + 0.002);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, time + params.duration);

  osc.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  osc.start(time);
  osc.stop(time + params.duration + 0.02);
}

function playBuffer(audioCtx, buffer, time, { accent = false, weak = false, gain = 1 } = {}) {
  const source = audioCtx.createBufferSource();
  const gainNode = audioCtx.createGain();
  source.buffer = buffer;

  const peakGain = (accent ? 1.0 : weak ? 0.45 : 0.8) * gain;
  gainNode.gain.setValueAtTime(peakGain, time);

  source.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  source.start(time);
}

// キャッシュ済みAudioBufferがあればそれを再生し、なければロードを開始しつつOscillator合成で即時代替する。
function playSample(audioCtx, url, oscParams, time, { accent = false, weak = false, gain = 1 } = {}) {
  const cached = getCtxCache(audioCtx).get(url);
  if (cached instanceof AudioBuffer) {
    playBuffer(audioCtx, cached, time, { accent, weak, gain });
  } else {
    loadBuffer(audioCtx, url);
    playOscFallback(audioCtx, time, oscParams, accent, weak, gain);
  }
}

export function playClick(audioCtx, time, { soundType = "click", accent = false, weak = false, gain = 1 } = {}) {
  const url = SOUND_FILES[soundType] || SOUND_FILES.click;
  playSample(audioCtx, url, OSC_PARAMS[soundType] || OSC_PARAMS.click, time, { accent, weak, gain });
}

// 小節頭専用の「チーン」ベル。通常のクリック音色とは独立して重ねて鳴らす。
export function playBell(audioCtx, time, { gain = 1 } = {}) {
  playSample(audioCtx, BELL_FILE, BELL_OSC_PARAMS, time, { accent: true, gain });
}

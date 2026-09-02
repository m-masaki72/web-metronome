// クリック音をOscillator+GainNodeで合成生成する（外部音声ファイル不要）

const SOUND_PARAMS = {
  click: { freq: 1500, accentFreq: 2200, type: "sine", duration: 0.05 },
  wood: { freq: 800, accentFreq: 1100, type: "square", duration: 0.03 },
  beep: { freq: 1000, accentFreq: 1500, type: "triangle", duration: 0.08 },
  cowbell: { freq: 560, accentFreq: 840, type: "square", duration: 0.12 },
};

export function playClick(audioCtx, time, { soundType = "click", accent = false, weak = false, gain = 1 } = {}) {
  const params = SOUND_PARAMS[soundType] || SOUND_PARAMS.click;
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

const BPM_MIN = 60;
const BPM_MAX = 300;

export async function detectBpmFromAudioUrl(url: string): Promise<number> {
  try {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();

    const OfflineAudioCtxClass =
      window.OfflineAudioContext ||
      (window as any).webkitOfflineAudioContext;
    if (!OfflineAudioCtxClass) return 170;

    const sampleRate = 44100;
    const offlineCtx = new OfflineAudioCtxClass(1, sampleRate * 35, sampleRate);

    const audioBuffer = await new Promise<AudioBuffer>((resolve, reject) => {
      offlineCtx.decodeAudioData(arrayBuffer, resolve, reject);
    });

    const channelData = audioBuffer.getChannelData(0);
    const length = Math.min(channelData.length, sampleRate * 35);
    const samples = channelData.subarray ? channelData.subarray(0, length) : new Float32Array(channelData.buffer, 0, length);

    const rawBpm = detectBpmOnset(samples, sampleRate) || detectBpmEnergy(samples, sampleRate);

    if (!rawBpm || rawBpm <= 0) return fallbackBpm(url);

    if (rawBpm >= 140 && rawBpm <= 220) {
      return Math.round(rawBpm);
    }

    const multipliers = [0.5, 0.67, 0.75, 1, 1.5, 2, 3, 4];
    const candidates: number[] = [];

    for (const mult of multipliers) {
      const candidate = rawBpm * mult;
      if (candidate >= 140 && candidate <= 220) {
        candidates.push(candidate);
      }
    }

    if (candidates.length === 0) {
      return Math.max(BPM_MIN, Math.min(BPM_MAX, Math.round(rawBpm)));
    }

    // Pick candidate closest to the mean (avoids 180 bias)
    const mean = candidates.reduce((a, b) => a + b, 0) / candidates.length;
    let best = candidates[0];
    let bestDist = Infinity;
    for (const c of candidates) {
      const dist = Math.abs(c - mean);
      if (dist < bestDist) { bestDist = dist; best = c; }
    }

    return Math.max(BPM_MIN, Math.min(BPM_MAX, Math.round(best)));
  } catch (err) {
    console.warn('BPM detection failed:', err);
    return fallbackBpm(url);
  }
}

function fallbackBpm(url: string): number {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    hash = url.charCodeAt(i) + ((hash << 5) - hash);
  }
  const bpmOptions = [150, 155, 160, 165, 170, 175, 180, 185, 190, 195];
  const index = Math.abs(hash) % bpmOptions.length;
  return bpmOptions[index];
}

function detectBpmEnergy(samples: Float32Array, sr: number): number | null {
  const windowSize = Math.floor(sr * 0.02);
  const energy: number[] = [];

  for (let i = 0; i < samples.length; i += windowSize) {
    let sum = 0;
    const end = Math.min(i + windowSize, samples.length);
    for (let j = i; j < end; j++) sum += samples[j] * samples[j];
    energy.push(Math.sqrt(sum / (end - i)));
  }

  let maxEnergy = 0;
  for (const e of energy) if (e > maxEnergy) maxEnergy = e;
  if (maxEnergy < 1e-6) return null;

  const threshold = maxEnergy * 0.62;
  const peaks: number[] = [];

  for (let i = 1; i < energy.length - 1; i++) {
    if (energy[i] > threshold && energy[i] > energy[i - 1] && energy[i] > energy[i + 1]) {
      const t = (i * windowSize) / sr;
      if (peaks.length === 0 || t - peaks[peaks.length - 1] > 0.22) peaks.push(t);
    }
  }

  if (peaks.length < 3) return null;

  const intervals: number[] = [];
  for (let i = 1; i < peaks.length; i++) intervals.push(peaks[i] - peaks[i - 1]);

  const bins: Record<string, number> = {};
  for (const iv of intervals) {
    const bin = (Math.round(iv * 50) / 50).toFixed(2);
    bins[bin] = (bins[bin] || 0) + 1;
  }

  let bestBin = '', maxCount = 0;
  for (const [bin, count] of Object.entries(bins)) {
    if (count > maxCount) { maxCount = count; bestBin = bin; }
  }

  const bpm = Math.round(60 / parseFloat(bestBin));
  if (bpm < BPM_MIN || bpm > BPM_MAX) return null;
  return bpm;
}

function detectBpmOnset(samples: Float32Array, sr: number): number | null {
  const hopSize = Math.floor(sr * 0.006);
  const ws = Math.floor(sr * 0.032);
  const env: number[] = [];

  for (let i = 0; i + ws < samples.length; i += hopSize) {
    let sum = 0;
    for (let j = 0; j < ws; j++) sum += Math.abs(samples[i + j]);
    env.push(sum / ws);
  }

  const onsets: number[] = [];
  for (let i = 5; i < env.length; i++) {
    let avg = 0;
    for (let j = 1; j <= 5; j++) avg += env[i - j];
    avg /= 5;
    if (avg > 1e-6 && env[i] / avg > 1.4) {
      const t = (i * hopSize) / sr;
      if (onsets.length === 0 || t - onsets[onsets.length - 1] > 0.22) onsets.push(t);
    }
  }

  if (onsets.length < 4) return null;

  let bestBpm = 170, bestScore = -Infinity;
  for (let bpm = BPM_MIN; bpm <= BPM_MAX; bpm++) {
    const period = 60 / bpm;
    let score = 0;
    for (let i = 1; i < onsets.length; i++) {
      const iv = onsets[i] - onsets[i - 1];
      const d = Math.min(
        Math.abs(iv / period - Math.round(iv / period)),
        Math.abs(iv / (period / 2) - Math.round(iv / (period / 2)))
      );
      if (d < 0.2) score += 1 - d * 2;
    }
    if (score > bestScore) { bestScore = score; bestBpm = bpm; }
  }

  return bestBpm;
}

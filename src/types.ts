export type BeatSoundType = 'tick' | 'drum' | 'bass' | 'woodblock' | 'cowbell' | 'chime' | 'sub_boom' | 'double_bass' | 'hihat';

export type MusicStyle = 'none' | 'synthwave' | 'techno' | 'ambient' | 'custom' | 'ten_minutes' | 'animal';

export type VisualStyle = 'sunset' | 'mountains' | 'tunnel' | 'aurora' | 'minimal' | 'ekg' | 'orbit' | 'mesh' | 'matrix' | 'video';

export interface RunningStats {
  isPlaying: boolean;
  bpm: number;
  elapsedTime: number; // in seconds
  steps: number;
  calories: number;
  level: number;
}

export interface BeatSoundOption {
  value: BeatSoundType;
  label: string;
  emoji: string;
}

export interface MusicStyleOption {
  value: MusicStyle;
  label: string;
  emoji: string;
  description: string;
}

export interface Track {
  id: string;
  name: string;
  url: string; // Blob URL
  originalBpm: number;
  isUploaded?: boolean;
}

export interface VideoTrack {
  id: string;
  name: string;
  url: string; // Blob URL
  detectedBpm?: number;
}

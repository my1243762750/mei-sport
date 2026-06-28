import React, { useEffect, useMemo, useState } from 'react';
import { detectBpmFromAudioUrl } from '../utils/bpmDetector';
import type { BeatSoundType, MusicStyle, Track, VideoTrack, VisualStyle } from '../types';

interface ControlPanelProps {
  bpm: number;
  setBpm: (bpm: number) => void;
  soundType: BeatSoundType;
  setSoundType: (type: BeatSoundType) => void;
  setMusicStyle: (style: MusicStyle) => void;
  metronomeVolume: number;
  setMetronomeVolume: (vol: number) => void;
  musicVolume: number;
  setMusicVolume: (vol: number) => void;
  customPlaylist: Track[];
  setCustomPlaylist: React.Dispatch<React.SetStateAction<Track[]>>;
  currentTrackIndex: number;
  setCurrentTrackIndex: (idx: number) => void;
  onPlayTrack: (idx: number) => void;
  onPlayUploadedTrack: (track: Track) => void;
  videoPlaylist: VideoTrack[];
  setVideoPlaylist: React.Dispatch<React.SetStateAction<VideoTrack[]>>;
  currentVideoIndex: number;
  setCurrentVideoIndex: (idx: number) => void;
  visualStyle: VisualStyle;
  setVisualStyle: (style: VisualStyle) => void;
  videoMuted: boolean;
  setVideoMuted: (val: boolean) => void;
  videoVolume: number;
  setVideoVolume: (vol: number) => void;
}

const BPM_PRESETS = [160, 180, 200, 220];

const SOUND_OPTIONS: { value: BeatSoundType; label: string }[] = [
  { value: 'tick', label: 'Clear Tick' },
  { value: 'drum', label: 'Kick' },
  { value: 'bass', label: 'Deep Bass' },
  { value: 'woodblock', label: 'Wood' },
  { value: 'cowbell', label: 'Bell' },
  { value: 'chime', label: 'Chime' },
];

const VISUAL_OPTIONS: { value: VisualStyle; label: string }[] = [
  { value: 'video', label: 'Video' },
  { value: 'minimal', label: 'Pulse' },
  { value: 'aurora', label: 'Aurora' },
  { value: 'sunset', label: 'Track' },
];

const isAudioFile = (file: File) =>
  file.type.startsWith('audio/') || /\.(mp3|wav|m4a|aac|flac|ogg)$/i.test(file.name);

const isVideoFile = (file: File) =>
  file.type.startsWith('video/') || /\.(mp4|mov|webm|mkv|avi)$/i.test(file.name);

export const ControlPanel: React.FC<ControlPanelProps> = ({
  bpm,
  setBpm,
  soundType,
  setSoundType,
  setMusicStyle,
  metronomeVolume,
  setMetronomeVolume,
  musicVolume,
  setMusicVolume,
  customPlaylist,
  setCustomPlaylist,
  currentTrackIndex,
  setCurrentTrackIndex,
  onPlayTrack,
  onPlayUploadedTrack,
  videoPlaylist,
  setVideoPlaylist,
  currentVideoIndex,
  setCurrentVideoIndex,
  visualStyle,
  setVisualStyle,
  videoMuted,
  setVideoMuted,
  videoVolume,
  setVideoVolume,
}) => {
  const [bpmInput, setBpmInput] = useState(String(bpm));

  useEffect(() => {
    setBpmInput(String(bpm));
  }, [bpm]);

  const mediaItems = useMemo(() => {
    const audio = customPlaylist.map((item, index) => ({
      id: item.id,
      type: 'audio' as const,
      name: item.name,
      bpm: item.originalBpm,
      index,
      active: index === currentTrackIndex,
    }));
    const video = videoPlaylist.map((item, index) => ({
      id: item.id,
      type: 'video' as const,
      name: item.name,
      bpm: item.detectedBpm,
      index,
      active: index === currentVideoIndex && visualStyle === 'video',
    }));

    return [...audio, ...video];
  }, [customPlaylist, currentTrackIndex, currentVideoIndex, videoPlaylist, visualStyle]);

  const commitBpmInput = () => {
    const next = Number.parseInt(bpmInput, 10);
    if (Number.isNaN(next)) {
      setBpmInput(String(bpm));
      return;
    }
    const clamped = Math.max(100, Math.min(300, next));
    setBpm(clamped);
    setBpmInput(String(clamped));
  };

  const importAudioFiles = async (files: File[]) => {
    const firstNewTrackIndex = customPlaylist.length;
    const newTracks = await Promise.all(
      files.map(async (file, index): Promise<Track> => {
        const url = URL.createObjectURL(file);
        let detectedBpm = 170;
        try {
          detectedBpm = await detectBpmFromAudioUrl(url);
        } catch (error) {
          console.error('Error detecting uploaded music BPM:', error);
        }

        return {
          id: `audio-${Date.now()}-${index}`,
          name: file.name.replace(/\.[^/.]+$/, ''),
          url,
          originalBpm: detectedBpm,
          isUploaded: true,
        };
      }),
    );

    setCustomPlaylist((prev) => [...prev, ...newTracks]);
    if (newTracks.length > 0) {
      setCurrentTrackIndex(firstNewTrackIndex);
      setMusicStyle('custom');
      setBpm(newTracks[0].originalBpm);
      onPlayUploadedTrack(newTracks[0]);
    }
  };

  const importVideoFiles = async (files: File[]) => {
    const newVideos = await Promise.all(
      files.map(async (file, index): Promise<VideoTrack> => {
        const url = URL.createObjectURL(file);
        let detectedBpm = 170;
        try {
          detectedBpm = await detectBpmFromAudioUrl(url);
        } catch (error) {
          console.error('Error detecting uploaded video BPM:', error);
        }

        return {
          id: `video-${Date.now()}-${index}`,
          name: file.name.replace(/\.[^/.]+$/, ''),
          url,
          detectedBpm,
        };
      }),
    );

    setVideoPlaylist((prev) => [...prev, ...newVideos]);
    if (newVideos.length > 0) {
      setVisualStyle('video');
      setCurrentVideoIndex(videoPlaylist.length);
      if (newVideos[0].detectedBpm) {
        setBpm(newVideos[0].detectedBpm);
      }
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    const audioFiles = files.filter(isAudioFile);
    const videoFiles = files.filter(isVideoFile);

    if (audioFiles.length > 0) {
      await importAudioFiles(audioFiles);
    }
    if (videoFiles.length > 0) {
      await importVideoFiles(videoFiles);
    }

    event.target.value = '';
  };

  const removeAudioTrack = (id: string, index: number) => {
    setCustomPlaylist((prev) => prev.filter((track) => track.id !== id));
    if (index === currentTrackIndex) {
      setCurrentTrackIndex(Math.max(0, currentTrackIndex - 1));
    }
  };

  const removeVideoTrack = (id: string, index: number) => {
    setVideoPlaylist((prev) => prev.filter((track) => track.id !== id));
    if (index === currentVideoIndex) {
      setCurrentVideoIndex(Math.max(0, currentVideoIndex - 1));
    }
  };

  const playMediaItem = (item: (typeof mediaItems)[number]) => {
    if (item.type === 'audio') {
      onPlayTrack(item.index);
      return;
    }

    setCurrentVideoIndex(item.index);
    setVisualStyle('video');
    if (item.bpm) {
      setBpm(item.bpm);
    }
  };

  const removeMediaItem = (item: (typeof mediaItems)[number]) => {
    if (item.type === 'audio') {
      removeAudioTrack(item.id, item.index);
      return;
    }
    removeVideoTrack(item.id, item.index);
  };

  return (
    <div className="panel-card control-panel-flat">
      <label className="media-upload-button">
        <span className="media-upload-icon">+</span>
        <span>Upload File</span>
        <input type="file" accept="audio/*,video/*" multiple onChange={handleFileUpload} />
      </label>

      <section className="control-section bpm-compact-section">
        <div className="compact-section-header">
          <span>Cadence</span>
          <strong>{bpm} BPM</strong>
        </div>

        <div className="bpm-controls-row compact-bpm-row">
          <button onClick={() => setBpm(Math.max(100, bpm - 1))} className="btn-adjust">-</button>
          <div className="bpm-display-container">
            <input
              type="range"
              min="100"
              max="300"
              value={bpm}
              onChange={(event) => setBpm(Number.parseInt(event.target.value, 10))}
              className="slider-input-range"
            />
            <input
              type="number"
              min="100"
              max="300"
              value={bpmInput}
              onChange={(event) => setBpmInput(event.target.value)}
              onBlur={commitBpmInput}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur();
              }}
              className="compact-bpm-input"
              aria-label="BPM"
            />
          </div>
          <button onClick={() => setBpm(Math.min(300, bpm + 1))} className="btn-adjust">+</button>
        </div>

        <div className="preset-row">
          {BPM_PRESETS.map((preset) => (
            <button
              type="button"
              key={preset}
              onClick={() => setBpm(preset)}
              className={`btn-preset compact-preset ${bpm === preset ? 'active' : ''}`}
            >
              {preset}
            </button>
          ))}
        </div>
      </section>

      <section className="control-section">
        <div className="compact-section-header">
          <span>Visual</span>
          <strong>{VISUAL_OPTIONS.find((item) => item.value === visualStyle)?.label ?? 'Custom'}</strong>
        </div>
        <div className="visual-compact-grid">
          {VISUAL_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setVisualStyle(option.value)}
              className={`compact-choice ${visualStyle === option.value ? 'active' : ''}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <section className="control-section settings-grid">
        <label className="compact-field">
          <span>Beat</span>
          <select value={soundType} onChange={(event) => setSoundType(event.target.value as BeatSoundType)}>
            {SOUND_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        <label className="compact-field">
          <span>Click</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={metronomeVolume}
            onChange={(event) => setMetronomeVolume(Number.parseFloat(event.target.value))}
          />
        </label>

        <label className="compact-field">
          <span>Audio</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={musicVolume}
            onChange={(event) => setMusicVolume(Number.parseFloat(event.target.value))}
          />
        </label>

        <label className="compact-field">
          <span>Video</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={videoVolume}
            disabled={videoMuted}
            onChange={(event) => setVideoVolume(Number.parseFloat(event.target.value))}
          />
        </label>

        <button
          type="button"
          className={`compact-choice mute-choice ${videoMuted ? 'active' : ''}`}
          onClick={() => setVideoMuted(!videoMuted)}
        >
          {videoMuted ? 'Video Muted' : 'Video Sound'}
        </button>
      </section>

      <section className="control-section media-section">
        <div className="compact-section-header">
          <span>Files</span>
          <strong>{mediaItems.length}</strong>
        </div>

        <div className="media-list">
          {mediaItems.length === 0 ? (
            <div className="media-empty">Upload audio or video files here.</div>
          ) : (
            mediaItems.map((item) => (
              <div
                key={`${item.type}-${item.id}`}
                className={`media-row ${item.active ? 'active' : ''}`}
                onDoubleClick={() => playMediaItem(item)}
              >
                <button type="button" className="media-main" onClick={() => playMediaItem(item)}>
                  <span className="media-type">{item.type === 'audio' ? 'M' : 'V'}</span>
                  <span className="media-name">{item.name}</span>
                  {item.bpm && <span className="media-bpm">{item.bpm}</span>}
                </button>
                <button type="button" className="media-remove" onClick={() => removeMediaItem(item)}>
                  x
                </button>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
};

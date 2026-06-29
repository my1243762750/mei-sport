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
  { value: 'bass', label: '深沉贝斯' },
  { value: 'sub_boom', label: '重低音鼓' },
  { value: 'tick', label: '清脆滴答' },
  { value: 'drum', label: '大鼓' },
  { value: 'snare', label: '小鼓' },
  { value: 'tom_high', label: '高音通鼓' },
  { value: 'mellow', label: '柔和通鼓' },
  { value: 'woodblock', label: '木鱼' },
  { value: 'cowbell', label: '牛铃' },
  { value: 'agogo', label: '阿哥哥铃' },
  { value: 'chime', label: '风铃' },
  { value: 'hihat', label: '踩镲' },
  { value: 'blop1', label: '水泡 1' },
  { value: 'blop2', label: '水泡 2' },
  { value: 'blop3', label: '水泡 3' },
  { value: 'pluck', label: '弹拨' },
  { value: 'shaker', label: '沙锤' },
  { value: 'maracas', label: '响板' },
  { value: 'rim', label: '鼓边' },
];

const VISUAL_OPTIONS: { value: VisualStyle; label: string }[] = [
  { value: 'video', label: '视频' },
  { value: 'minimal', label: '脉冲' },
  { value: 'aurora', label: '极光' },
  { value: 'sunset', label: '跑道' },
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
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingBpmValue, setEditingBpmValue] = useState('');
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
  const [draggedItemType, setDraggedItemType] = useState<'audio' | 'video' | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

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

  const startEditingBpm = (item: (typeof mediaItems)[number], event: React.MouseEvent) => {
    event.stopPropagation();
    setEditingItemId(`${item.type}-${item.id}`);
    setEditingBpmValue(String(item.bpm ?? 180));
  };

  const commitInlineBpm = (item: (typeof mediaItems)[number]) => {
    const nextBpm = Number.parseInt(editingBpmValue, 10);
    setEditingItemId(null);
    if (Number.isNaN(nextBpm) || nextBpm < 50 || nextBpm > 350) return;

    if (item.type === 'audio') {
      setCustomPlaylist((prev) =>
        prev.map((track) => (track.id === item.id ? { ...track, originalBpm: nextBpm } : track)),
      );
    } else {
      setVideoPlaylist((prev) =>
        prev.map((track) => (track.id === item.id ? { ...track, detectedBpm: nextBpm } : track)),
      );
    }

    if (item.active) setBpm(nextBpm);
  };

  const handleDragStart = (type: 'audio' | 'video', index: number) => {
    setDraggedItemIndex(index);
    setDraggedItemType(type);
  };

  const handleDragOver = (event: React.DragEvent, type: 'audio' | 'video', index: number) => {
    event.preventDefault();
    if (draggedItemType !== type || draggedItemIndex === index) return;
    setDragOverIndex(index);
  };

  const handleDrop = (type: 'audio' | 'video', targetIndex: number) => {
    if (draggedItemIndex === null || draggedItemType !== type) return;

    if (type === 'audio') {
      const newList = [...customPlaylist];
      const [draggedItem] = newList.splice(draggedItemIndex, 1);
      newList.splice(targetIndex, 0, draggedItem);
      setCustomPlaylist(newList);

      if (currentTrackIndex === draggedItemIndex) {
        setCurrentTrackIndex(targetIndex);
      } else if (currentTrackIndex > draggedItemIndex && currentTrackIndex <= targetIndex) {
        setCurrentTrackIndex(currentTrackIndex - 1);
      } else if (currentTrackIndex < draggedItemIndex && currentTrackIndex >= targetIndex) {
        setCurrentTrackIndex(currentTrackIndex + 1);
      }
    } else {
      const newList = [...videoPlaylist];
      const [draggedItem] = newList.splice(draggedItemIndex, 1);
      newList.splice(targetIndex, 0, draggedItem);
      setVideoPlaylist(newList);

      if (currentVideoIndex === draggedItemIndex) {
        setCurrentVideoIndex(targetIndex);
      } else if (currentVideoIndex > draggedItemIndex && currentVideoIndex <= targetIndex) {
        setCurrentVideoIndex(currentVideoIndex - 1);
      } else if (currentVideoIndex < draggedItemIndex && currentVideoIndex >= targetIndex) {
        setCurrentVideoIndex(currentVideoIndex + 1);
      }
    }

    setDraggedItemIndex(null);
    setDraggedItemType(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedItemIndex(null);
    setDraggedItemType(null);
    setDragOverIndex(null);
  };

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
          console.error('检测上传音乐 BPM 失败:', error);
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
          console.error('检测上传视频 BPM 失败:', error);
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
      if (newVideos[0].detectedBpm) setBpm(newVideos[0].detectedBpm);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    const audioFiles = files.filter(isAudioFile);
    const videoFiles = files.filter(isVideoFile);

    if (audioFiles.length > 0) await importAudioFiles(audioFiles);
    if (videoFiles.length > 0) await importVideoFiles(videoFiles);

    event.target.value = '';
  };

  const removeAudioTrack = (id: string, index: number) => {
    setCustomPlaylist((prev) => prev.filter((track) => track.id !== id));
    if (index === currentTrackIndex) setCurrentTrackIndex(Math.max(0, currentTrackIndex - 1));
  };

  const removeVideoTrack = (id: string, index: number) => {
    setVideoPlaylist((prev) => prev.filter((track) => track.id !== id));
    if (index === currentVideoIndex) setCurrentVideoIndex(Math.max(0, currentVideoIndex - 1));
  };

  const playMediaItem = (item: (typeof mediaItems)[number]) => {
    if (item.type === 'audio') {
      onPlayTrack(item.index);
      return;
    }

    setCurrentVideoIndex(item.index);
    setVisualStyle('video');
    if (item.bpm) setBpm(item.bpm);
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
        <span>上传文件</span>
        <input type="file" accept="audio/*,video/*" multiple onChange={handleFileUpload} />
      </label>

      <section className="control-section bpm-compact-section">
        <div className="compact-section-header">
          <span>步频</span>
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
          <span>画面</span>
          <strong>{VISUAL_OPTIONS.find((item) => item.value === visualStyle)?.label ?? '自定义'}</strong>
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
          <span>鼓点</span>
          <select value={soundType} onChange={(event) => setSoundType(event.target.value as BeatSoundType)}>
            {SOUND_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        <label className="compact-field">
          <span>鼓点音量</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={metronomeVolume}
            onInput={(event) => setMetronomeVolume(Number.parseFloat(event.currentTarget.value))}
            onChange={(event) => setMetronomeVolume(Number.parseFloat(event.target.value))}
          />
        </label>

        <label className="compact-field">
          <span>音乐</span>
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
          <span>视频</span>
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
          {videoMuted ? '视频已静音' : '视频有声'}
        </button>
      </section>

      <section className="control-section media-section">
        <div className="compact-section-header">
          <span>文件</span>
          <strong>{mediaItems.length}</strong>
        </div>

        <div className="media-list">
          {mediaItems.length === 0 ? (
            <div className="media-empty">上传音乐或视频文件</div>
          ) : (
            mediaItems.map((item) => {
              const isDragging = draggedItemIndex === item.index && draggedItemType === item.type;
              const isHoveredOver = dragOverIndex === item.index && draggedItemType === item.type;

              return (
                <div
                  key={`${item.type}-${item.id}`}
                  className={`media-row ${item.active ? 'active' : ''} ${isDragging ? 'dragging' : ''} ${isHoveredOver ? 'drag-over' : ''}`}
                  draggable
                  onDragStart={() => handleDragStart(item.type, item.index)}
                  onDragOver={(event) => handleDragOver(event, item.type, item.index)}
                  onDrop={() => handleDrop(item.type, item.index)}
                  onDragEnd={handleDragEnd}
                  onDoubleClick={() => playMediaItem(item)}
                  style={{ opacity: isDragging ? 0.4 : 1, cursor: 'grab' }}
                >
                  <button type="button" className="media-main" onClick={() => playMediaItem(item)}>
                    <span className="media-type">
                      {item.type === 'audio' ? '音' : '视'}
                    </span>
                    <span className="media-name">{item.name}</span>
                    {item.bpm && (
                      editingItemId === `${item.type}-${item.id}` ? (
                        <input
                          type="number"
                          className="media-bpm-input"
                          value={editingBpmValue}
                          onChange={(event) => setEditingBpmValue(event.target.value)}
                          onBlur={() => commitInlineBpm(item)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') commitInlineBpm(item);
                            if (event.key === 'Escape') setEditingItemId(null);
                          }}
                          onClick={(event) => event.stopPropagation()}
                          autoFocus
                          min={50}
                          max={350}
                        />
                      ) : (
                        <span
                          className="media-bpm editable"
                          onClick={(event) => startEditingBpm(item, event)}
                          title="点击修改 BPM"
                        >
                          {item.bpm}
                        </span>
                      )
                    )}
                  </button>
                  <button type="button" className="media-remove" onClick={() => removeMediaItem(item)}>
                    x
                  </button>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
};

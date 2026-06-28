import { useEffect, useRef, useState } from 'react';
import type { BeatSoundType, MusicStyle, RunningStats, Track, VideoTrack, VisualStyle } from './types';
import { AudioEngine } from './audio/AudioEngine';
import { BeatVisualizer } from './components/BeatVisualizer';
import { ComboGame } from './components/ComboGame';
import { ControlPanel } from './components/ControlPanel';
import { RunStatsOverlay } from './components/RunStatsOverlay';

const DEFAULT_TRACKS: Track[] = [];

export default function App() {
  const [bpm, setBpm] = useState(180);
  const [soundType, setSoundType] = useState<BeatSoundType>('bass');
  const [musicStyle, setMusicStyle] = useState<MusicStyle>('none');
  const [metronomeVolume, setMetronomeVolume] = useState(1.3);
  const [musicVolume, setMusicVolume] = useState(0.35);
  const [isPlaying, setIsPlaying] = useState(false);
  const [beatTrigger, setBeatTrigger] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [customPlaylist, setCustomPlaylist] = useState<Track[]>(DEFAULT_TRACKS);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [videoPlaylist, setVideoPlaylist] = useState<VideoTrack[]>([]);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [visualStyle, setVisualStyle] = useState<VisualStyle>('sunset');
  const [videoMuted, setVideoMuted] = useState(false);
  const [videoVolume, setVideoVolume] = useState(0.4);
  const [isVideoCovered, setIsVideoCovered] = useState(false);
  const [showSidePanel, setShowSidePanel] = useState(true);
  const [stats, setStats] = useState<RunningStats>({
    isPlaying: false,
    bpm: 180,
    elapsedTime: 0,
    steps: 0,
    calories: 0,
    combo: 0,
    maxCombo: 0,
    level: 0,
    streakMultiplier: 1,
  });

  const audioEngineRef = useRef<AudioEngine | null>(null);
  const lastPlayedUrlRef = useRef('');

  useEffect(() => {
    audioEngineRef.current = new AudioEngine();
    return () => audioEngineRef.current?.stop();
  }, []);

  useEffect(() => {
    audioEngineRef.current?.setBpm(bpm);
    setStats((prev) => ({ ...prev, bpm }));

    if (visualStyle !== 'video') {
      const lowRange = ['aurora', 'minimal'];
      const midRange = ['sunset', 'minimal'];
      const highRange = ['minimal', 'aurora'];
      const isCurrentValid =
        (bpm < 165 && lowRange.includes(visualStyle)) ||
        (bpm >= 165 && bpm < 185 && midRange.includes(visualStyle)) ||
        (bpm >= 185 && highRange.includes(visualStyle));

      if (!isCurrentValid) {
        if (bpm < 165) setVisualStyle('aurora');
        else if (bpm < 185) setVisualStyle('sunset');
        else setVisualStyle('minimal');
      }
    }
  }, [bpm, visualStyle]);

  useEffect(() => {
    audioEngineRef.current?.setSoundType(soundType);
  }, [soundType]);

  useEffect(() => {
    if (musicStyle === 'custom' && customPlaylist.length > 0) {
      playCurrentCustomTrack();
    } else {
      audioEngineRef.current?.setMusicStyle(musicStyle);
    }
  }, [musicStyle]);

  useEffect(() => {
    if (visualStyle === 'video' && videoPlaylist.length > 0) {
      const activeVideo = videoPlaylist[currentVideoIndex];
      if (activeVideo?.detectedBpm) setBpm(activeVideo.detectedBpm);
    }
  }, [currentVideoIndex, videoPlaylist, visualStyle]);

  useEffect(() => {
    if (musicStyle === 'custom' && customPlaylist.length > 0) {
      const activeTrack = customPlaylist[currentTrackIndex];
      if (activeTrack?.originalBpm) setBpm(activeTrack.originalBpm);
    }
  }, [currentTrackIndex, customPlaylist, musicStyle]);

  useEffect(() => {
    audioEngineRef.current?.setMetronomeVolume(metronomeVolume);
  }, [metronomeVolume]);

  useEffect(() => {
    audioEngineRef.current?.setMusicVolume(musicVolume);
  }, [musicVolume]);

  useEffect(() => {
    setStats((prev) => ({ ...prev, combo, maxCombo }));
  }, [combo, maxCombo]);

  useEffect(() => {
    if (musicStyle === 'custom') playCurrentCustomTrack();
  }, [currentTrackIndex, customPlaylist]);

  useEffect(() => {
    let interval: number | null = null;
    if (isPlaying) {
      interval = window.setInterval(() => {
        setStats((prev) => {
          const nextTime = prev.elapsedTime + 1;
          const caloriesPerSec = bpm * 0.0011;
          const nextLevel =
            nextTime >= 1200 ? 4 :
            nextTime >= 600 ? 3 :
            nextTime >= 300 ? 2 :
            nextTime >= 60 ? 1 : 0;

          return {
            ...prev,
            elapsedTime: nextTime,
            calories: prev.calories + caloriesPerSec,
            level: nextLevel,
          };
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, bpm]);

  const handleBeat = () => {
    setBeatTrigger((prev) => prev + 1);
    setStats((prev) => ({ ...prev, steps: prev.steps + 1 }));
  };

  const handleTrackEnded = () => {
    if (customPlaylist.length > 0) {
      setCurrentTrackIndex((prev) => (prev + 1) % customPlaylist.length);
    }
  };

  const playCurrentCustomTrack = () => {
    const track = customPlaylist[currentTrackIndex];
    if (!track || lastPlayedUrlRef.current === track.url) return;

    lastPlayedUrlRef.current = track.url;
    audioEngineRef.current?.setMusicStyle('custom');
    audioEngineRef.current?.playCustomTrack(track.url, track.originalBpm, handleTrackEnded);
  };

  const handlePlayTrack = (index: number) => {
    const track = customPlaylist[index];
    if (!track) return;

    setCurrentTrackIndex(index);
    setMusicStyle('custom');
    lastPlayedUrlRef.current = track.url;
    audioEngineRef.current?.setMusicStyle('custom');
    audioEngineRef.current?.playCustomTrack(track.url, track.originalBpm, handleTrackEnded);

    if (!isPlaying) {
      audioEngineRef.current?.unlockAudio();
      audioEngineRef.current?.start(bpm, soundType, 'custom', handleBeat);
      setIsPlaying(true);
      setStats((prev) => ({ ...prev, isPlaying: true }));
    }
  };

  const handlePlayUploadedTrack = (track: Track) => {
    setMusicStyle('custom');
    lastPlayedUrlRef.current = track.url;
    audioEngineRef.current?.unlockAudio();
    audioEngineRef.current?.setMusicStyle('custom');
    audioEngineRef.current?.playCustomTrack(track.url, track.originalBpm, handleTrackEnded);

    if (!isPlaying) {
      audioEngineRef.current?.start(bpm, soundType, 'custom', handleBeat);
      setIsPlaying(true);
      setStats((prev) => ({ ...prev, isPlaying: true }));
    }
  };

  const handleVideoEnded = () => {
    if (videoPlaylist.length > 0) {
      setCurrentVideoIndex((prev) => (prev + 1) % videoPlaylist.length);
    }
  };

  const handleTogglePlay = () => {
    if (!audioEngineRef.current) return;

    if (isPlaying) {
      audioEngineRef.current.stop();
      setIsPlaying(false);
      setCombo(0);
      setStats((prev) => ({ ...prev, isPlaying: false }));
      return;
    }

    audioEngineRef.current.unlockAudio();
    if (musicStyle === 'custom' && customPlaylist.length > 0) {
      playCurrentCustomTrack();
    }
    audioEngineRef.current.start(bpm, soundType, musicStyle, handleBeat);
    setIsPlaying(true);
    setStats((prev) => ({ ...prev, isPlaying: true }));
  };

  const handleResetStats = () => {
    setStats({
      isPlaying,
      bpm,
      elapsedTime: 0,
      steps: 0,
      calories: 0,
      combo: 0,
      maxCombo: 0,
      level: 0,
      streakMultiplier: 1,
    });
    setCombo(0);
    setMaxCombo(0);
  };

  return (
    <div className="app-container">
      <header className="header-section">
        <div className="brand-lockup">
          <span className="brand-mark">RUN</span>
          <div className="brand-copy">
            <h1 className="title-text">RunBeat</h1>
            <p className="subtitle-text">跑步节奏训练</p>
          </div>
        </div>
      </header>

      <button
        type="button"
        onClick={() => setShowSidePanel((prev) => !prev)}
        className={`floating-settings-button ${showSidePanel ? 'active' : ''}`}
        aria-pressed={showSidePanel}
        title={showSidePanel ? '隐藏设置面板' : '显示设置面板'}
      >
        ⚙
      </button>

      <main className="main-grid">
        <section className="center-column">
          <div className="visualizer-stage">
            <BeatVisualizer
              bpm={bpm}
              isPlaying={isPlaying}
              beatTrigger={beatTrigger}
              combo={combo}
              visualStyle={visualStyle}
              videoUrl={videoPlaylist.length > 0 ? videoPlaylist[currentVideoIndex].url : null}
              onVideoEnded={handleVideoEnded}
              onTogglePlay={handleTogglePlay}
              videoMuted={videoMuted}
              videoVolume={videoVolume}
              isVideoCovered={isVideoCovered}
              setIsVideoCovered={setIsVideoCovered}
            />
            <ComboGame
              bpm={bpm}
              isPlaying={isPlaying}
              beatTrigger={beatTrigger}
              setCombo={setCombo}
              setMaxCombo={setMaxCombo}
            />
            <RunStatsOverlay stats={stats} resetStats={handleResetStats} />
          </div>
        </section>

        <section className={`side-column ${showSidePanel ? '' : 'collapsed'}`}>
          <ControlPanel
            bpm={bpm}
            setBpm={setBpm}
            soundType={soundType}
            setSoundType={setSoundType}
            setMusicStyle={setMusicStyle}
            metronomeVolume={metronomeVolume}
            setMetronomeVolume={setMetronomeVolume}
            musicVolume={musicVolume}
            setMusicVolume={setMusicVolume}
            customPlaylist={customPlaylist}
            setCustomPlaylist={setCustomPlaylist}
            currentTrackIndex={currentTrackIndex}
            setCurrentTrackIndex={setCurrentTrackIndex}
            onPlayTrack={handlePlayTrack}
            onPlayUploadedTrack={handlePlayUploadedTrack}
            videoPlaylist={videoPlaylist}
            setVideoPlaylist={setVideoPlaylist}
            currentVideoIndex={currentVideoIndex}
            setCurrentVideoIndex={setCurrentVideoIndex}
            visualStyle={visualStyle}
            setVisualStyle={setVisualStyle}
            videoMuted={videoMuted}
            setVideoMuted={setVideoMuted}
            videoVolume={videoVolume}
            setVideoVolume={setVideoVolume}
          />
        </section>
      </main>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import type { BeatSoundType, MusicStyle, RunningStats, Track, VideoTrack, VisualStyle } from './types';
import { AudioEngine } from './audio/AudioEngine';
import { BeatVisualizer } from './components/BeatVisualizer';
import { ControlPanel } from './components/ControlPanel';
import { LeftRightFootGuide } from './components/LeftRightFootGuide';
import { RunStatsOverlay } from './components/RunStatsOverlay';

const DEFAULT_TRACKS: Track[] = [];

type RewardNotice =
  | { type: 'countdown'; targetMinutes: number; remainingSeconds: number }
  | { type: 'complete'; targetMinutes: number };

export default function App() {
  const [bpm, setBpm] = useState(180);
  const [soundType, setSoundType] = useState<BeatSoundType>('bass');
  const [musicStyle, setMusicStyle] = useState<MusicStyle>('none');
  const [metronomeVolume, setMetronomeVolume] = useState(0.75);
  const [musicVolume, setMusicVolume] = useState(0.35);
  const [isPlaying, setIsPlaying] = useState(false);
  const [beatTrigger, setBeatTrigger] = useState(0);
  const [customPlaylist, setCustomPlaylist] = useState<Track[]>(DEFAULT_TRACKS);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [videoPlaylist, setVideoPlaylist] = useState<VideoTrack[]>([]);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [visualStyle, setVisualStyle] = useState<VisualStyle>('sunset');
  const [videoMuted, setVideoMuted] = useState(false);
  const [videoVolume, setVideoVolume] = useState(0.4);
  const [isVideoCovered, setIsVideoCovered] = useState(false);
  const [showSidePanel, setShowSidePanel] = useState(true);
  const [rewardNotice, setRewardNotice] = useState<RewardNotice | null>(null);
  const [stats, setStats] = useState<RunningStats>({
    isPlaying: false,
    bpm: 180,
    elapsedTime: 0,
    steps: 0,
    calories: 0,
    level: 0,
  });

  const audioEngineRef = useRef<AudioEngine | null>(null);
  const lastPlayedUrlRef = useRef('');
  const playedRewardCuesRef = useRef<Set<string>>(new Set());

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

  const handleMetronomeVolumeChange = (volume: number) => {
    setMetronomeVolume(volume);
    audioEngineRef.current?.setMetronomeVolume(volume);
  };

  useEffect(() => {
    if (musicStyle === 'custom') playCurrentCustomTrack();
  }, [currentTrackIndex, customPlaylist]);

  useEffect(() => {
    if (!isPlaying || stats.elapsedTime <= 0) return;

    const milestoneInterval = 600;
    const nextTarget = Math.ceil(stats.elapsedTime / milestoneInterval) * milestoneInterval;
    const remainingSeconds = nextTarget - stats.elapsedTime;

    if (remainingSeconds >= 1 && remainingSeconds <= 4) {
      const cueKey = `countdown-${nextTarget}-${remainingSeconds}`;
      if (!playedRewardCuesRef.current.has(cueKey)) {
        playedRewardCuesRef.current.add(cueKey);
        audioEngineRef.current?.playMilestoneCountdownCue();
      }
      setRewardNotice({
        type: 'countdown',
        targetMinutes: nextTarget / 60,
        remainingSeconds,
      });
      return;
    }

    if (stats.elapsedTime % milestoneInterval === 0) {
      const cueKey = `complete-${stats.elapsedTime}`;
      if (!playedRewardCuesRef.current.has(cueKey)) {
        playedRewardCuesRef.current.add(cueKey);
        audioEngineRef.current?.playMilestoneCompleteCue();
      }
      setRewardNotice({
        type: 'complete',
        targetMinutes: stats.elapsedTime / 60,
      });
    }
  }, [isPlaying, stats.elapsedTime]);

  useEffect(() => {
    if (!rewardNotice) return;

    const clearDelay = rewardNotice.type === 'complete' ? 6000 : 980;
    const timer = window.setTimeout(() => setRewardNotice(null), clearDelay);
    return () => window.clearTimeout(timer);
  }, [rewardNotice]);

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
    playedRewardCuesRef.current.clear();
    setRewardNotice(null);
    setStats({
      isPlaying,
      bpm,
      elapsedTime: 0,
      steps: 0,
      calories: 0,
      level: 0,
    });
  };

  return (
    <div className="app-container">
      <header className="header-section">
        <div className="brand-lockup">
          <img className="brand-mark" src="/runbeat-logo.svg" alt="RunBeat" />
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
              visualStyle={visualStyle}
              videoUrl={videoPlaylist.length > 0 ? videoPlaylist[currentVideoIndex].url : null}
              onVideoEnded={handleVideoEnded}
              onTogglePlay={handleTogglePlay}
              videoMuted={videoMuted}
              videoVolume={videoVolume}
              isVideoCovered={isVideoCovered}
              setIsVideoCovered={setIsVideoCovered}
            />
            <LeftRightFootGuide isPlaying={isPlaying} beatTrigger={beatTrigger} />
            <RunStatsOverlay stats={stats} resetStats={handleResetStats} rewardNotice={rewardNotice} />
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
            setMetronomeVolume={handleMetronomeVolumeChange}
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

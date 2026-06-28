import type { BeatSoundType, MusicStyle } from '../types';

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private isRunning: boolean = false;
  private timerId: number | null = null;
  private nextStepTime: number = 0;
  private current16thStep: number = 0;
  private bpm: number = 180;
  private soundType: BeatSoundType = 'tick';
  private musicStyle: MusicStyle = 'none';
  private onBeatCallback: ((stepIndex: number, beatTime: number) => void) | null = null;

  // Custom audio elements for playlist playback
  private audioEl: HTMLAudioElement | null = null;
  private audioSourceNode: MediaElementAudioSourceNode | null = null;
  private currentTrackOriginalBpm: number = 120;
  private onTrackEndedCallback: (() => void) | null = null;

  // Master volumes
  private metronomeVolume: number = 1.3;
  private musicVolume: number = 0.35;

  // Synthesizer nodes/gains for mixing
  private masterGain: GainNode | null = null;
  private metronomeGain: GainNode | null = null;
  private musicGain: GainNode | null = null;

  private readonly lookahead: number = 0.1;
  private readonly scheduleInterval: number = 25.0;

  private readonly chordFrequencies = {
    synthwave: [
      [110.0, 130.81, 164.81], // Am
      [87.31, 130.81, 174.61],  // F
      [130.81, 164.81, 196.0],  // C
      [98.0, 146.83, 196.0]     // G
    ],
    ambient: [
      [220.0, 261.63, 329.63, 392.0], // Am7
      [174.61, 261.63, 349.23, 392.0], // Fmaj7
      [261.63, 329.63, 392.0, 493.88], // Cmaj7
      [196.0, 293.66, 392.0, 440.0]     // G6
    ]
  };

  private currentBar: number = 0;

  constructor() {
    // AudioContext lazy loaded
  }

  public init() {
    if (this.ctx) return;
    
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
      console.error("Web Audio API is not supported in this browser");
      return;
    }

    this.ctx = new AudioContextClass();
    
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.9, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);

    this.metronomeGain = this.ctx.createGain();
    this.metronomeGain.gain.setValueAtTime(this.metronomeVolume, this.ctx.currentTime);
    this.metronomeGain.connect(this.masterGain);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.setValueAtTime(this.musicVolume, this.ctx.currentTime);
    this.musicGain.connect(this.masterGain);
  }

  // Plays a custom track URL using dynamic HTML5 Audio element routed to AudioContext
  public playCustomTrack(url: string, originalBpm: number, onTrackEnded: () => void) {
    this.init();
    if (!this.ctx || !this.musicGain) return;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    this.currentTrackOriginalBpm = originalBpm;
    this.onTrackEndedCallback = onTrackEnded;

    if (!this.audioEl) {
      this.audioEl = new Audio();
      
      // Route audio tag through web audio graph for mixing and volume controls
      this.audioSourceNode = this.ctx.createMediaElementSource(this.audioEl);
      this.audioSourceNode.connect(this.musicGain);

      // Handle track completion
      this.audioEl.addEventListener('ended', () => {
        if (this.onTrackEndedCallback) {
          this.onTrackEndedCallback();
        }
      });
    }

    this.audioEl.src = url;
    
    // Scale speed to match BPM
    this.audioEl.playbackRate = this.bpm / this.currentTrackOriginalBpm;

    this.audioEl.play().catch((err) => {
      console.warn("Custom audio play error (likely interaction needed):", err);
    });
  }

  public start(
    bpm: number, 
    soundType: BeatSoundType, 
    musicStyle: MusicStyle, 
    onBeatCallback: (stepIndex: number, beatTime: number) => void
  ) {
    this.init();
    if (!this.ctx) return;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    this.bpm = bpm;
    this.soundType = soundType;
    this.musicStyle = musicStyle;
    this.onBeatCallback = onBeatCallback;

    // Start playing custom audio track if it exists and musicStyle is custom
    if (this.musicStyle === 'custom' && this.audioEl && this.audioEl.paused) {
      this.audioEl.playbackRate = this.bpm / this.currentTrackOriginalBpm;
      this.audioEl.play().catch(e => console.warn("Failed to resume custom track:", e));
    }

    if (this.isRunning) return;

    this.isRunning = true;
    this.current16thStep = 0;
    this.currentBar = 0;
    this.nextStepTime = this.ctx.currentTime + 0.05;

    this.scheduler();
  }

  public stop() {
    this.isRunning = false;
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }

    // Pause custom track
    if (this.audioEl && !this.audioEl.paused) {
      this.audioEl.pause();
    }
  }

  public setBpm(bpm: number) {
    this.bpm = Math.max(60, Math.min(300, bpm));
    
    // Scale custom music track playback speed dynamically in real-time
    if (this.audioEl && this.currentTrackOriginalBpm) {
      this.audioEl.playbackRate = this.bpm / this.currentTrackOriginalBpm;
    }
  }

  public setSoundType(soundType: BeatSoundType) {
    this.soundType = soundType;
  }

  public setMusicStyle(musicStyle: MusicStyle) {
    this.musicStyle = musicStyle;
    
    // Manage custom track playback based on style selection
    if (this.audioEl) {
      if (this.musicStyle === 'custom') {
        this.audioEl.playbackRate = this.bpm / this.currentTrackOriginalBpm;
        this.audioEl.play().catch(e => console.warn(e));
      } else {
        this.audioEl.pause();
      }
    }
  }

  public setMetronomeVolume(volume: number) {
    this.metronomeVolume = Math.max(0, Math.min(2, volume));
    if (this.metronomeGain && this.ctx) {
      this.metronomeGain.gain.setTargetAtTime(this.metronomeVolume * 1.5, this.ctx.currentTime, 0.01);
    }
  }

  public setMusicVolume(volume: number) {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setTargetAtTime(this.musicVolume, this.ctx.currentTime, 0.01);
    }
  }

  public unlockAudio() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  private scheduler = () => {
    if (!this.isRunning || !this.ctx) return;

    while (this.nextStepTime < this.ctx.currentTime + this.lookahead) {
      this.scheduleNote(this.current16thStep, this.nextStepTime);
      this.advanceNote();
    }

    this.timerId = window.setTimeout(this.scheduler, this.scheduleInterval);
  };

  private advanceNote() {
    const secondsPerBeat = 60.0 / this.bpm;
    const secondsPer16thNote = secondsPerBeat / 4.0;
    
    this.nextStepTime += secondsPer16thNote;

    this.current16thStep = (this.current16thStep + 1) % 16;
    if (this.current16thStep === 0) {
      this.currentBar = (this.currentBar + 1) % 4;
    }
  }

  private scheduleNote(step: number, time: number) {
    if (!this.ctx || !this.metronomeGain || !this.musicGain) return;

    const isQuarterNote = step % 4 === 0;

    if (isQuarterNote) {
      this.playMetronomeSound(time, step === 0);
      
      if (this.onBeatCallback) {
        const delayMs = Math.max(0, (time - this.ctx.currentTime) * 1000);
        setTimeout(() => {
          if (this.isRunning && this.onBeatCallback) {
            this.onBeatCallback(step, time);
          }
        }, delayMs);
      }
    }

    // Play procedural synth loops only if style is NOT custom and NOT none
    if (this.musicStyle !== 'none' && this.musicStyle !== 'custom') {
      this.playProceduralMusic(step, time);
    }
  }

  private playMetronomeSound(time: number, isAccent: boolean) {
    if (!this.ctx || !this.metronomeGain) return;

    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();

    osc.connect(gainNode);
    gainNode.connect(this.metronomeGain);

    const volume = isAccent ? 1.0 : 0.7;
    const pitchMultiplier = isAccent ? 1.3 : 1.0;

    switch (this.soundType) {
      case 'tick':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1250 * pitchMultiplier, time);
        gainNode.gain.setValueAtTime(volume * 2.0, time);
        gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.035);
        osc.start(time);
        osc.stop(time + 0.045);
        break;

      case 'drum':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(200 * pitchMultiplier, time);
        osc.frequency.exponentialRampToValueAtTime(60, time + 0.1);
        gainNode.gain.setValueAtTime(volume * 1.5, time);
        gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.12);

        const noise = this.createNoiseBufferNode();
        if (noise) {
          const noiseGain = this.ctx.createGain();
          const filter = this.ctx.createBiquadFilter();
          filter.type = 'bandpass';
          filter.frequency.setValueAtTime(1200, time);
          noise.connect(filter);
          filter.connect(noiseGain);
          noiseGain.connect(this.metronomeGain);
          noiseGain.gain.setValueAtTime(volume * 0.5, time);
          noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
          noise.start(time);
          noise.stop(time + 0.11);
        }
        osc.start(time);
        osc.stop(time + 0.13);
        break;

      case 'bass':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150 * pitchMultiplier, time);
        osc.frequency.exponentialRampToValueAtTime(40, time + 0.14);
        gainNode.gain.setValueAtTime(volume * 1.5, time);
        gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.18);
        osc.start(time);
        osc.stop(time + 0.2);
        break;

      case 'woodblock':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200 * pitchMultiplier, time);
        gainNode.gain.setValueAtTime(volume * 1.5, time);
        gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.08);

        const osc2 = this.ctx.createOscillator();
        const gain2 = this.ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1600 * pitchMultiplier, time);
        gain2.gain.setValueAtTime(volume * 1.0, time);
        gain2.gain.exponentialRampToValueAtTime(0.001, time + 0.06);
        osc2.connect(gain2);
        gain2.connect(this.metronomeGain);

        osc.start(time);
        osc.stop(time + 0.09);
        osc2.start(time);
        osc2.stop(time + 0.07);
        break;

      case 'cowbell':
        const oscC1 = this.ctx.createOscillator();
        const oscC2 = this.ctx.createOscillator();
        const gainC1 = this.ctx.createGain();
        const gainC2 = this.ctx.createGain();
        const filterC = this.ctx.createBiquadFilter();

        oscC1.type = 'square';
        oscC1.frequency.setValueAtTime(587 * pitchMultiplier, time);
        oscC2.type = 'square';
        oscC2.frequency.setValueAtTime(845 * pitchMultiplier, time);

        filterC.type = 'bandpass';
        filterC.frequency.setValueAtTime(800, time);
        filterC.Q.setValueAtTime(3.5, time);

        gainC1.gain.setValueAtTime(volume * 0.9, time);
        gainC1.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
        gainC2.gain.setValueAtTime(volume * 0.9, time);
        gainC2.gain.exponentialRampToValueAtTime(0.001, time + 0.13);

        oscC1.connect(gainC1);
        oscC2.connect(gainC2);
        gainC1.connect(filterC);
        gainC2.connect(filterC);
        filterC.connect(this.metronomeGain);

        oscC1.start(time);
        oscC2.start(time);
        oscC1.stop(time + 0.14);
        oscC2.stop(time + 0.14);
        break;

      case 'chime':
        const chimeFreqs = [1800, 2200, 2700, 3100];
        const chimeGainNode = this.ctx.createGain();
        chimeGainNode.gain.setValueAtTime(volume * 0.7, time);
        chimeGainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.3);
        chimeGainNode.connect(this.metronomeGain);

        chimeFreqs.forEach((freq) => {
          if (!this.ctx) return;
          const oscCh = this.ctx.createOscillator();
          oscCh.type = 'sine';
          oscCh.frequency.setValueAtTime(freq * pitchMultiplier, time);
          oscCh.connect(chimeGainNode);
          oscCh.start(time);
          oscCh.stop(time + 0.32);
        });
        break;

      case 'sub_boom':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(90 * pitchMultiplier, time);
        osc.frequency.exponentialRampToValueAtTime(32, time + 0.25);
        gainNode.gain.setValueAtTime(volume * 1.8, time);
        gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.32);
        osc.start(time);
        osc.stop(time + 0.35);
        break;

      case 'double_bass':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(140 * pitchMultiplier, time);
        osc.frequency.exponentialRampToValueAtTime(45, time + 0.08);
        gainNode.gain.setValueAtTime(volume * 1.4, time);
        gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
        osc.start(time);
        osc.stop(time + 0.12);

        const time2 = time + 0.08;
        const oscDb2 = this.ctx.createOscillator();
        const gainDb2 = this.ctx.createGain();
        oscDb2.type = 'sine';
        oscDb2.frequency.setValueAtTime(120 * pitchMultiplier, time2);
        oscDb2.frequency.exponentialRampToValueAtTime(40, time2 + 0.08);
        gainDb2.gain.setValueAtTime(volume * 1.2, time2);
        gainDb2.gain.exponentialRampToValueAtTime(0.001, time2 + 0.1);
        oscDb2.connect(gainDb2);
        gainDb2.connect(this.metronomeGain);
        oscDb2.start(time2);
        oscDb2.stop(time2 + 0.12);
        break;

      case 'hihat':
        const hhSource = this.createNoiseBufferNode();
        if (hhSource) {
          const hhGain = this.ctx.createGain();
          const filter = this.ctx.createBiquadFilter();
          filter.type = 'highpass';
          filter.frequency.setValueAtTime(8000, time);
          hhSource.connect(filter);
          filter.connect(hhGain);
          hhGain.connect(this.metronomeGain);
          hhGain.gain.setValueAtTime(volume * 0.9, time);
          hhGain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
          hhSource.start(time);
          hhSource.stop(time + 0.06);
        }
        break;

    }
  }

  private createNoiseBufferNode(): AudioBufferSourceNode | null {
    if (!this.ctx) return null;
    const bufferSize = this.ctx.sampleRate * 0.2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    return source;
  }

  private playProceduralMusic(step: number, time: number) {
    if (!this.ctx || !this.musicGain) return;
    const chordIndex = this.currentBar;

    if (this.musicStyle === 'synthwave') {
      const bassSteps = [0, 2, 3, 4, 6, 7, 8, 10, 11, 12, 14, 15];
      if (bassSteps.includes(step)) {
        const rootFreq = this.chordFrequencies.synthwave[chordIndex][0] / 2;
        const noteLength = 0.12;
        const osc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const gainNode = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(rootFreq, time);
        const velocity = step % 4 === 0 ? 0.7 : 0.5;

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(200, time);
        filter.frequency.exponentialRampToValueAtTime(700, time + 0.03);
        filter.frequency.exponentialRampToValueAtTime(150, time + noteLength);
        filter.Q.setValueAtTime(4, time);

        gainNode.gain.setValueAtTime(velocity, time);
        gainNode.gain.exponentialRampToValueAtTime(0.001, time + noteLength);

        osc.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.musicGain);
        osc.start(time);
        osc.stop(time + noteLength + 0.05);
      }

      if (step % 4 === 1) {
        const chord = this.chordFrequencies.synthwave[chordIndex];
        const chordGain = this.ctx.createGain();
        chordGain.gain.setValueAtTime(0.18, time);
        chordGain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);
        chordGain.connect(this.musicGain);

        chord.forEach((freq) => {
          if (!this.ctx) return;
          const osc = this.ctx.createOscillator();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq * 2, time);
          osc.connect(chordGain);
          osc.start(time);
          osc.stop(time + 0.35);
        });
      }

      if (step % 4 === 2) {
        const hat = this.createNoiseBufferNode();
        if (hat) {
          const filter = this.ctx.createBiquadFilter();
          filter.type = 'highpass';
          filter.frequency.setValueAtTime(7000, time);
          const gain = this.ctx.createGain();
          gain.gain.setValueAtTime(0.1, time);
          gain.gain.exponentialRampToValueAtTime(0.001, time + 0.06);
          hat.connect(filter);
          filter.connect(gain);
          gain.connect(this.musicGain);
          hat.start(time);
          hat.stop(time + 0.07);
        }
      }
    } 
    
    else if (this.musicStyle === 'techno') {
      if (step % 4 === 0) {
        const rootFreq = this.chordFrequencies.synthwave[chordIndex][0] / 2.5;
        const osc = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(rootFreq, time);
        gainNode.gain.setValueAtTime(0.6, time);
        gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.22);
        osc.connect(gainNode);
        gainNode.connect(this.musicGain);
        osc.start(time);
        osc.stop(time + 0.25);
      }

      if (step % 2 === 0) {
        const isOpen = step === 6 || step === 14;
        const hatLength = isOpen ? 0.18 : 0.06;
        const hatVolume = isOpen ? 0.12 : 0.07;
        const hat = this.createNoiseBufferNode();
        if (hat) {
          const filter = this.ctx.createBiquadFilter();
          filter.type = 'highpass';
          filter.frequency.setValueAtTime(8000, time);
          const gain = this.ctx.createGain();
          gain.gain.setValueAtTime(hatVolume, time);
          gain.gain.exponentialRampToValueAtTime(0.001, time + hatLength);
          hat.connect(filter);
          filter.connect(gain);
          gain.connect(this.musicGain);
          hat.start(time);
          hat.stop(time + hatLength + 0.02);
        }
      }

      if (step % 4 === 3) {
        const chord = this.chordFrequencies.synthwave[chordIndex];
        const freqIndex = Math.floor(step / 4) % chord.length;
        const freq = chord[freqIndex] * 1.5;
        const osc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const gainNode = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, time);
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1500, time);
        filter.frequency.exponentialRampToValueAtTime(3000, time + 0.05);
        filter.frequency.exponentialRampToValueAtTime(500, time + 0.1);
        filter.Q.setValueAtTime(6, time);

        gainNode.gain.setValueAtTime(0.12, time);
        gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.12);

        osc.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.musicGain);
        osc.start(time);
        osc.stop(time + 0.15);
      }
    } 
    
    else if (this.musicStyle === 'ambient') {
      if (step === 0) {
        const chord = this.chordFrequencies.ambient[chordIndex];
        const chordDuration = (60.0 / this.bpm) * 4;
        const attack = chordDuration * 0.3;
        const decay = chordDuration * 0.7;
        const padGain = this.ctx.createGain();
        padGain.gain.setValueAtTime(0.0, time);
        padGain.gain.linearRampToValueAtTime(0.08, time + attack);
        padGain.gain.exponentialRampToValueAtTime(0.001, time + decay);
        padGain.connect(this.musicGain);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(400, time);
        filter.frequency.linearRampToValueAtTime(700, time + attack);
        filter.frequency.linearRampToValueAtTime(350, time + decay);
        filter.connect(padGain);

        chord.forEach((freq) => {
          if (!this.ctx) return;
          const osc = this.ctx.createOscillator();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, time);
          osc.detune.setValueAtTime((Math.random() - 0.5) * 15, time);
          osc.connect(filter);
          osc.start(time);
          osc.stop(time + decay + 0.1);
        });
      }

      if (step === 5 || step === 11) {
        const chord = this.chordFrequencies.ambient[chordIndex];
        const freq = chord[Math.floor(Math.random() * chord.length)] * 4;
        const osc = this.ctx.createOscillator();
        const oscRing = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, time);
        oscRing.type = 'sine';
        oscRing.frequency.setValueAtTime(freq * 1.5, time);
        gainNode.gain.setValueAtTime(0.04, time);
        gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.4);

        const bellGain = this.ctx.createGain();
        bellGain.gain.setValueAtTime(0.5, time);
        oscRing.connect(bellGain);
        bellGain.connect(gainNode);

        osc.connect(gainNode);
        gainNode.connect(this.musicGain);

        osc.start(time);
        osc.stop(time + 0.45);
        oscRing.start(time);
        oscRing.stop(time + 0.4);
      }
    } 
    
    else if (this.musicStyle === 'ten_minutes') {
      // Bassline in D minor
      const bassNotes = [146.83, 146.83, 174.61, 196.00, 130.81, 130.81, 164.81, 146.83];
      if (step % 2 === 0) {
        const bassFreq = bassNotes[Math.floor(step / 2)];
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(bassFreq / 2, time);
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(150, time);
        filter.frequency.exponentialRampToValueAtTime(400, time + 0.05);
        filter.frequency.exponentialRampToValueAtTime(120, time + 0.18);
        
        gain.gain.setValueAtTime(0.45, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
        
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.musicGain);
        osc.start(time);
        osc.stop(time + 0.22);
      }

      // Melody Hook
      const melodyFreqs: { [key: number]: number } = {
        0: 440.00, // A4
        2: 440.00, // A4
        3: 493.88, // B4
        4: 523.25, // C5
        6: 493.88, // B4
        8: 440.00, // A4
        10: 392.00, // G4
        12: 440.00, // A4
        14: 329.63  // E4
      };
      if (melodyFreqs[step] !== undefined) {
        const freq = melodyFreqs[step];
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq * 1.5, time);
        
        gain.gain.setValueAtTime(0.2, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
        
        osc.connect(gain);
        gain.connect(this.musicGain);
        osc.start(time);
        osc.stop(time + 0.22);
      }
    } 
    
    else if (this.musicStyle === 'animal') {
      // Chord progressions F#m -> D -> A -> E
      const bassProg = [92.50, 73.42, 110.00, 82.41];
      const bassFreq = bassProg[chordIndex];
      
      if (step % 2 === 0) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(bassFreq, time);
        
        gain.gain.setValueAtTime(0.5, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.25);
        
        osc.connect(gain);
        gain.connect(this.musicGain);
        osc.start(time);
        osc.stop(time + 0.28);
      }

      // Melody
      const melodyFreqs: { [key: number]: number } = {
        0: 440.00, // A4
        3: 369.99, // F#4
        6: 440.00, // A4
        8: 493.88, // B4
        11: 554.37, // C#5
        14: 493.88  // B4
      };
      if (melodyFreqs[step] !== undefined) {
        const freq = melodyFreqs[step];
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, time);
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, time);
        filter.frequency.exponentialRampToValueAtTime(200, time + 0.15);
        
        gain.gain.setValueAtTime(0.12, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
        
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.musicGain);
        osc.start(time);
        osc.stop(time + 0.22);
      }
    }
  }
}

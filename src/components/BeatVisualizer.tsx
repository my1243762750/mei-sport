import React, { useEffect, useRef, useState } from 'react';
import type { VisualStyle } from '../types';

interface BeatVisualizerProps {
  bpm: number;
  isPlaying: boolean;
  beatTrigger: number;
  combo: number;
  visualStyle: VisualStyle;
  videoUrl: string | null;
  onVideoEnded: () => void;
  onTogglePlay: () => void;
  videoMuted: boolean;
  videoVolume: number;
  isVideoCovered: boolean;
  setIsVideoCovered: React.Dispatch<React.SetStateAction<boolean>>;
}

export const BeatVisualizer: React.FC<BeatVisualizerProps> = ({
  bpm,
  isPlaying,
  beatTrigger,
  combo,
  visualStyle,
  videoUrl,
  onVideoEnded,
  onTogglePlay,
  videoMuted,
  videoVolume,
  isVideoCovered,
  setIsVideoCovered,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  
  // Spring-based kinetic pulse ref parameters
  const pulseRef = useRef<number>(1.0);
  const pulseVelocityRef = useRef<number>(0);

  const isHoveringCoreRef = useRef<boolean>(false);
  const particlesRef = useRef<{ x: number; y: number; z: number; color: string }[]>([]);

  // Dynamic aspect ratio tracking for uploaded video
  const [videoRatio, setVideoRatio] = useState<number>(1.77); // Default to 16:9

  // Fullscreen state and handlers
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Focus mode background theme state
  const [focusBgTheme, setFocusBgTheme] = useState<'aurora' | 'emerald' | 'abyss' | 'sunrise'>('aurora');
  const bgImagesRef = useRef<{ [key: string]: HTMLImageElement }>({});

  // Preload Unsplash dynamic wallpaper images
  useEffect(() => {
    const urls = {
      aurora: 'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?auto=format&fit=crop&w=1600&q=80',
      emerald: 'https://images.unsplash.com/photo-1511497584788-876760111969?auto=format&fit=crop&w=1600&q=80',
      abyss: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=80',
      sunrise: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1600&q=80'
    };

    Object.entries(urls).forEach(([key, url]) => {
      const img = new Image();
      img.src = url;
      img.onload = () => {
        bgImagesRef.current[key] = img;
      };
    });
  }, []);

  const handleToggleFocusBg = () => {
    setFocusBgTheme((prev) => {
      if (prev === 'aurora') return 'emerald';
      if (prev === 'emerald') return 'abyss';
      if (prev === 'abyss') return 'sunrise';
      return 'aurora';
    });
  };

  const getFocusBgName = () => {
    if (focusBgTheme === 'aurora') return '星夜极光';
    if (focusBgTheme === 'emerald') return '静谧翠林';
    if (focusBgTheme === 'abyss') return '深海沙滩';
    return '晨曦山脉';
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(
        !!(document.fullscreenElement ||
           (document as any).webkitFullscreenElement ||
           (document as any).mozFullScreenElement ||
           (document as any).msFullscreenElement)
      );
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  const handleToggleFullscreen = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const element = canvas.closest('.visualizer-stage') || canvas.closest('.visualizer-container');
    if (!element) return;

    if (!document.fullscreenElement && 
        !(document as any).webkitFullscreenElement && 
        !(document as any).mozFullScreenElement && 
        !(document as any).msFullscreenElement) {
      if (element.requestFullscreen) {
        element.requestFullscreen();
      } else if ((element as any).webkitRequestFullscreen) {
        (element as any).webkitRequestFullscreen();
      } else if ((element as any).mozRequestFullScreen) {
        (element as any).mozRequestFullScreen();
      } else if ((element as any).msRequestFullscreen) {
        (element as any).msRequestFullscreen();
      }
    } else {
      const exitFs = document.exitFullscreen || 
                     (document as any).webkitExitFullscreen || 
                     (document as any).mozCancelFullScreen || 
                     (document as any).msExitFullscreen;
      if (exitFs) {
        exitFs.call(document);
      }
    }
  };

  // Track color theme based on BPM
  const getBpmThemeColor = (currentBpm: number, alpha: number = 1) => {
    if (currentBpm < 165) {
      return `hsla(35, 100%, 62%, ${alpha})`; // Warmup: Bright Orange-Gold
    } else if (currentBpm < 185) {
      return `hsla(265, 100%, 78%, ${alpha})`; // Endurance: Bright Neon Violet-Pink
    } else {
      return `hsla(0, 100%, 62%, ${alpha})`; // HIIT: Bright Neon Red
    }
  };

  const getBpmDarkTextColor = (currentBpm: number) => {
    if (currentBpm < 165) {
      return '#3b1401'; // Deep bronze-black
    } else if (currentBpm < 185) {
      return '#1a0035'; // Deep violet-black
    } else {
      return '#3f000b'; // Deep burgundy-black
    }
  };

  const getVideoControlColor = (alpha: number = 1) => `rgba(52, 211, 153, ${alpha})`;

  // Detect video dimensions on load
  const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    if (video.videoWidth && video.videoHeight) {
      setVideoRatio(video.videoWidth / video.videoHeight);
    }
  };

  // Sync video speed with BPM
  useEffect(() => {
    if (videoRef.current && isPlaying) {
      const speed = bpm / 180;
      videoRef.current.playbackRate = Math.max(0.5, Math.min(2.0, speed));
      
      if (videoRef.current.paused) {
        videoRef.current.play().catch(e => console.warn("Video play error:", e));
      }
    } else if (videoRef.current && !isPlaying) {
      videoRef.current.pause();
    }
  }, [bpm, isPlaying, videoUrl, visualStyle]);

  // Sync video volume and muted state
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = videoVolume;
      videoRef.current.muted = videoMuted;
    }
  }, [videoVolume, videoMuted]);

  // Handle beat pulses — ONLY spring impulse, no particle spawning
  useEffect(() => {
    if (isPlaying && beatTrigger > 0) {
      pulseVelocityRef.current += 0.095;
    }
  }, [beatTrigger, isPlaying]);

  // Handle resizing smoothly using ResizeObserver
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const parent = canvas.parentElement;
    if (!parent) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        
        canvas.width = width * window.devicePixelRatio;
        canvas.height = height * window.devicePixelRatio;
        
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        }
      }
    });

    resizeObserver.observe(parent);

    const rect = parent.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [visualStyle, videoRatio, isVideoCovered]);

  // Main Canvas render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let rotationAngle = 0;
    let waveTime = 0;

    // Render loop
    const render = () => {
      const width = canvas.width / window.devicePixelRatio;
      const height = canvas.height / window.devicePixelRatio;
      const centerX = width / 2;
      const centerY = height / 2;

      const isVideoMode = visualStyle === 'video';
      const hoverScale = isHoveringCoreRef.current ? 1.12 : 1.0;
      const baseBorderRadius = isVideoMode ? 210 : 180;

      // Draw background
      if (isVideoMode) {
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = 'rgba(10, 10, 15, 0.2)';
        ctx.fillRect(0, 0, width, height);
      } else {
        ctx.fillStyle = 'rgba(10, 10, 15, 0.2)';
        ctx.fillRect(0, 0, width, height);
      }

      rotationAngle += 0.018;
      waveTime += 0.035;

      if (isVideoCovered) {
        ctx.clearRect(0, 0, width, height);
        
        // Draw dynamic image wallpaper with Ken Burns panning effect
        const activeImg = bgImagesRef.current[focusBgTheme];
        if (activeImg) {
          // Calculate Ken Burns scale and offsets based on slow waveTime
          const scale = 1.06 + Math.sin(waveTime * 0.02) * 0.04;
          const dx = Math.sin(waveTime * 0.015) * 20;
          const dy = Math.cos(waveTime * 0.01) * 12;
          
          const drawW = width * scale;
          const drawH = height * scale;
          const drawX = (width - drawW) / 2 + dx;
          const drawY = (height - drawH) / 2 + dy;
          
          ctx.save();
          // Draw the landscape image covering the screen
          ctx.drawImage(activeImg, drawX, drawY, drawW, drawH);
          
          // Draw a dark dim overlay to ensure the HUD stands out and is eye-friendly
          ctx.fillStyle = 'rgba(7, 10, 20, 0.52)';
          ctx.fillRect(0, 0, width, height);
          ctx.restore();
        } else {
          // Fallback solid gradient color if image hasn't loaded yet
          const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
          skyGrad.addColorStop(0, '#0a0518');
          skyGrad.addColorStop(1, '#020106');
          ctx.fillStyle = skyGrad;
          ctx.fillRect(0, 0, width, height);
        }
      }

      else if (visualStyle === 'video') {
        // STYLE 10: Real Video overlay — extremely clean, no distracting particles
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = 'rgba(10, 10, 15, 0.15)'; // minimal dim overlay
        ctx.fillRect(0, 0, width, height);

        // 1. Pulsing edge vignette - darkens corners, brightens on beat
        const pulse = pulseRef.current;
        const vignetteGrad = ctx.createRadialGradient(centerX, centerY, Math.min(width, height) * 0.25, centerX, centerY, Math.max(width, height) * 0.7);
        vignetteGrad.addColorStop(0, 'transparent');
        vignetteGrad.addColorStop(0.5, 'transparent');
        vignetteGrad.addColorStop(1, `rgba(10, 10, 15, ${0.45 - (pulse - 1.0) * 0.2})`);
        ctx.fillStyle = vignetteGrad;
        ctx.fillRect(0, 0, width, height);
      } 
      
      else if (visualStyle === 'sunset') {
        // STYLE 1: Retrowave Sunset Infinite Highway (沉浸式无限日落跑道)
        // Highly engaging for runners (matches forward movement), yet low eye fatigue
        const horizonY = centerY + height * 0.05;

        // 1. Sky Gradient (Midnight blue to deep pink)
        const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
        skyGrad.addColorStop(0, '#0a0a16');
        skyGrad.addColorStop(0.4, '#1b0c26');
        skyGrad.addColorStop(0.7, '#4e1245');
        skyGrad.addColorStop(1, '#9e2b53');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, width, horizonY);

        // 2. Giant Glowing Synthwave Sun (pulsing gently with the beat)
        const sunRadius = Math.min(width, height) * 0.16 * (1.0 + (pulseRef.current - 1.0) * 0.35);
        const sunGrad = ctx.createLinearGradient(centerX, horizonY - sunRadius, centerX, horizonY);
        sunGrad.addColorStop(0, '#fde047'); // Golden yellow
        sunGrad.addColorStop(1, '#ec4899'); // Neon hot pink
        
        ctx.fillStyle = sunGrad;
        ctx.beginPath();
        ctx.arc(centerX, horizonY, sunRadius, Math.PI, 0); // Semicircle above horizon
        ctx.fill();

        // Sun scanline gaps (classic retro aesthetic)
        ctx.fillStyle = '#0a0a16';
        const scanlineCount = 7;
        for (let i = 0; i < scanlineCount; i++) {
          const y = horizonY - (sunRadius / scanlineCount) * i;
          const thickness = 1.5 + (i * 0.8);
          ctx.fillRect(centerX - sunRadius * 1.05, y, sunRadius * 2.1, thickness);
        }

        // 3. Silhouette Hills / Mountains (slow parallax scrolling)
        ctx.fillStyle = '#11091e';
        ctx.beginPath();
        ctx.moveTo(0, horizonY);
        const hillScroll = waveTime * 0.08;
        for (let x = 0; x <= width + 10; x += 15) {
          const y = horizonY - Math.sin(x * 0.006 + hillScroll) * 16 
                            - Math.cos(x * 0.003 - hillScroll * 0.5) * 8;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(width, horizonY);
        ctx.closePath();
        ctx.fill();

        // 4. Ground Floor (Dark Grid Bed)
        ctx.fillStyle = '#050309';
        ctx.fillRect(0, horizonY, width, height - horizonY);

        // Grid speed calculated from runner's BPM & playing state
        const roadSpeed = waveTime * (isPlaying ? 14 : 2) * (bpm / 180);

        // 5. Horizontal perspective grid lines (moving forward)
        const gridLines = 11;
        for (let i = 0; i < gridLines; i++) {
          const z = ((i + (roadSpeed % 1.0)) / gridLines);
          const y = horizonY + (height - horizonY) * (z * z); // Exponential perspective
          
          ctx.strokeStyle = `rgba(139, 92, 246, ${z * 0.6})`; // Fade out near horizon
          ctx.lineWidth = 0.5 + z * 1.8;
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
        }

        // 6. Vertical perspective road lines
        const roadWidth = width * 0.4;
        const roadSegments = 10;
        for (let i = 0; i <= roadSegments; i++) {
          const ratio = i / roadSegments;
          const bottomX = centerX - roadWidth + ratio * (roadWidth * 2);
          
          // Outer highway borders are brighter neon cyan, inner grid is purple
          const isBorder = i === 0 || i === roadSegments;
          ctx.strokeStyle = isBorder ? `rgba(6, 182, 212, 0.65)` : `rgba(139, 92, 246, 0.28)`;
          ctx.lineWidth = isBorder ? 2.2 : 0.8;
          
          ctx.beginPath();
          ctx.moveTo(centerX, horizonY);
          ctx.lineTo(bottomX, height);
          ctx.stroke();
        }

        // 7. Neon Roadside streetposts flying past (creates strong velocity feedback)
        const postSegments = 4;
        for (let i = 0; i < postSegments; i++) {
          const z = ((i + (roadSpeed * 0.45) % 1.0)) / postSegments;
          const size = z * 32;
          const y = horizonY + (height - horizonY) * (z * z);
          const alpha = z * 0.85;

          if (z > 0.05) {
            // Left post
            const lx = centerX - roadWidth * 1.15 * z;
            ctx.strokeStyle = `rgba(236, 72, 153, ${alpha})`;
            ctx.lineWidth = 1.0 + z * 2.5;
            ctx.beginPath();
            ctx.moveTo(lx, y);
            ctx.lineTo(lx, y - size);
            ctx.stroke();

            // Right post
            const rx = centerX + roadWidth * 1.15 * z;
            ctx.strokeStyle = `rgba(236, 72, 153, ${alpha})`;
            ctx.lineWidth = 1.0 + z * 2.5;
            ctx.beginPath();
            ctx.moveTo(rx, y);
            ctx.lineTo(rx, y - size);
            ctx.stroke();
          }
        }
      } 
      
      else if (visualStyle === 'mountains') {
        // STYLE 2: Rhythmic Peaks (山脊波形 - Parallax scrolling landscape)
        ctx.fillStyle = '#05040a';
        ctx.fillRect(0, 0, width, height);

        // Sky stars (slow background drift, very subtle)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        for (let i = 0; i < 20; i++) {
          const x = (i * 97 + waveTime * 5) % width;
          const y = (i * 23) % (centerY - 50);
          ctx.fillRect(x, y, 1.2, 1.2);
        }

        // Parallax Mountain Layer 1 (Back, slower, dark purple)
        ctx.fillStyle = '#100c1e';
        ctx.beginPath();
        ctx.moveTo(0, height);
        const backScroll = waveTime * 0.05;
        for (let x = 0; x <= width + 20; x += 20) {
          const ratio = x / width;
          const hillY = centerY - 10 + Math.sin(ratio * Math.PI * 2.2 + backScroll) * 45 
                                   + Math.cos(ratio * Math.PI * 4 - backScroll * 0.4) * 20;
          ctx.lineTo(x, hillY);
        }
        ctx.lineTo(width, height);
        ctx.closePath();
        ctx.fill();

        // Parallax Mountain Layer 2 (Front, EKG rhythm heights, matching BPM color)
        ctx.fillStyle = getBpmThemeColor(bpm, 0.22);
        ctx.beginPath();
        ctx.moveTo(0, height);
        const frontScroll = waveTime * 0.12;
        // Mountain peak height scales dynamically with the step-beat spring physics
        const peakFactor = 60 + (pulseRef.current - 1.0) * 180;
        
        for (let x = 0; x <= width + 15; x += 15) {
          const ratio = x / width;
          const hillY = centerY + 30 + Math.sin(ratio * Math.PI * 3.5 - frontScroll) * peakFactor
                                    + Math.cos(ratio * Math.PI * 6.0 + frontScroll * 0.7) * (peakFactor * 0.25);
          ctx.lineTo(x, hillY);
        }
        ctx.lineTo(width, height);
        ctx.closePath();
        ctx.fill();
      }

      else if (visualStyle === 'tunnel') {
        // STYLE 3: Light Tunnel (时空隧道 - Concentric glowing octagons)
        ctx.fillStyle = '#030308';
        ctx.fillRect(0, 0, width, height);

        const tunnelCount = 6;
        const maxRadius = Math.max(width, height) * 0.75;
        const tunnelSpeed = (waveTime * 1.5) % (maxRadius / tunnelCount);
        
        for (let i = 0; i < tunnelCount; i++) {
          const radius = i * (maxRadius / tunnelCount) + tunnelSpeed;
          const alpha = (1.0 - radius / maxRadius) * 0.72;
          
          if (alpha > 0.01) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            
            const sides = 8;
            const drawOctagon = () => {
              ctx.beginPath();
              for (let s = 0; s <= sides; s++) {
                const angle = (s / sides) * Math.PI * 2 + waveTime * 0.08;
                const sx = centerX + Math.cos(angle) * radius;
                const sy = centerY + Math.sin(angle) * radius;
                if (s === 0) ctx.moveTo(sx, sy);
                else ctx.lineTo(sx, sy);
              }
              ctx.stroke();
            };

            // Outer glow line
            ctx.strokeStyle = getBpmThemeColor(bpm, alpha * 0.25);
            ctx.lineWidth = (1.5 + (radius / maxRadius) * 3.0) * 3.2;
            drawOctagon();

            // Inner core bright line
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.85})`;
            ctx.lineWidth = 1.0 + (radius / maxRadius) * 1.5;
            drawOctagon();

            ctx.restore();
          }
        }
      }

      else if (visualStyle === 'aurora') {
        // STYLE 4: Liquid Aurora (流光极光 - Flowing elegant wave bands)
        ctx.fillStyle = '#040408';
        ctx.fillRect(0, 0, width, height);

        const palette = bpm < 165
          ? [200, 220, 240] // Warmup: Cyan/Blue
          : bpm < 185
          ? [265, 285, 305] // Endurance: Violet/Pink
          : [0, 20, 40];    // HIIT: Neon Red/Orange

        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        
        for (let r = 0; r < 3; r++) {
          const hue = palette[r % 3];
          ctx.beginPath();
          const step = 8;
          const t = waveTime * 0.32 + r * Math.PI * 0.5;
          
          for (let x = 0; x <= width + step; x += step) {
            const progress = x / width;
            const waveAmp = height * (0.12 + Math.sin(waveTime * 0.18 + r) * 0.04);
            const y = centerY + Math.sin(progress * Math.PI * 1.5 + t) * waveAmp
                              + Math.cos(progress * Math.PI * 3.2 - t * 0.5) * waveAmp * 0.28;
                              
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          
          // Wide glow pass
          ctx.strokeStyle = `hsla(${hue}, 100%, 72%, 0.2)`;
          ctx.lineWidth = 15.0 - r * 3;
          ctx.stroke();

          // Bright center core pass
          ctx.strokeStyle = `hsla(${hue}, 100%, 90%, 0.65)`;
          ctx.lineWidth = 2.0;
          ctx.stroke();
        }
        ctx.restore();
      }

      else if (visualStyle === 'minimal') {
        // STYLE 5: Minimalist Beat Ripple (极简脉动 - expanding foot ripples)
        ctx.fillStyle = '#030306';
        ctx.fillRect(0, 0, width, height);

        // 1. Concentric pulse ripple expanding outwards on music beat
        const rippleRadius = baseBorderRadius * hoverScale * (1.0 + (pulseRef.current - 1.0) * 3.6);
        const rippleAlpha = Math.max(0, 0.65 - (pulseRef.current - 1.0) * 1.8);
        
        if (rippleAlpha > 0.01) {
          ctx.strokeStyle = getBpmThemeColor(bpm, rippleAlpha);
          ctx.lineWidth = 2.0;
          ctx.beginPath();
          ctx.arc(centerX, centerY, rippleRadius, 0, Math.PI * 2);
          ctx.stroke();
        }

        // 2. Clean left/right foot indicators representing step balance
        ctx.fillStyle = getBpmThemeColor(bpm, 0.4);
        ctx.font = '800 13px Rajdhani, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('L', centerX - 120, centerY);
        ctx.fillText('R', centerX + 120, centerY);

        const isLeft = pulseVelocityRef.current > 0.032;
        const isRight = pulseVelocityRef.current < -0.032;

        if (isLeft && isPlaying) {
          ctx.fillStyle = getBpmThemeColor(bpm, 1.0);
          ctx.beginPath();
          ctx.arc(centerX - 120, centerY, 12, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.fillText('L', centerX - 120, centerY + 4);
        }
        if (isRight && isPlaying) {
          ctx.fillStyle = getBpmThemeColor(bpm, 1.0);
          ctx.beginPath();
          ctx.arc(centerX + 120, centerY, 12, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.fillText('R', centerX + 120, centerY + 4);
        }
      }

      else if (visualStyle === 'ekg') {
        // STYLE 6: Cardio Pulse (心流脉搏 - Sporty EKG monitor line)
        ctx.fillStyle = '#030408';
        ctx.fillRect(0, 0, width, height);

        // 1. Grid backdrop
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
        ctx.lineWidth = 1.0;
        const grid = 36;
        for (let x = 0; x < width; x += grid) {
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
        }
        for (let y = 0; y < height; y += grid) {
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
        }

        // 2. Render sweeping EKG heartbeat line
        const sweepX = (waveTime * 145) % width;
        ctx.strokeStyle = getBpmThemeColor(bpm, 0.9);
        ctx.lineWidth = 2.8;
        ctx.beginPath();
        
        for (let x = 0; x < width; x += 3) {
          let y = centerY;
          const distToSweep = Math.abs(x - sweepX);
          
          if (distToSweep < 25) {
            // High-voltage EKG spikes correspond to beat spring pulse
            const spikeIntensity = (pulseRef.current - 0.96);
            const phase = (x - sweepX) / 25 * Math.PI;
            // Standard EKG signature: short dip -> big spike -> deep dip -> back to flatline
            y = centerY - Math.sin(phase * 4) * 95 * spikeIntensity;
          }
          
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // 3. Glowing sweep scan tip
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(sweepX, centerY, 4.2, 0, Math.PI * 2);
        ctx.fill();
      }

      else if (visualStyle === 'orbit') {
        // STYLE 7: Star Orbit (极夜星轨 - Concentric slow polar star trails)
        ctx.fillStyle = '#030306';
        ctx.fillRect(0, 0, width, height);

        const orbits = 4;
        for (let i = 0; i < orbits; i++) {
          const radius = 85 + i * 52;
          
          // Outer polar circular path
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.025)';
          ctx.lineWidth = 1.0;
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
          ctx.stroke();

          // Star revolving slowly along orbit path (highly calming, no eye fatigue)
          const angle = waveTime * (0.12 / (i + 1)) + i * Math.PI * 0.42;
          const sx = centerX + Math.cos(angle) * radius;
          const sy = centerY + Math.sin(angle) * radius;
          
          // Star glow
          ctx.fillStyle = getBpmThemeColor(bpm, 0.35);
          ctx.beginPath();
          ctx.arc(sx, sy, 5.0, 0, Math.PI * 2);
          ctx.fill();
          
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(sx, sy, 2.0, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      else if (visualStyle === 'mesh') {
        // STYLE 8: Audio Wave Grid (声网涟漪 - 3D wireframe mesh grid)
        ctx.fillStyle = '#030307';
        ctx.fillRect(0, 0, width, height);

        const cols = 18;
        const rows = 11;
        const gridHorizon = centerY - 10;
        
        for (let r = 0; r < rows; r++) {
          const z = r / rows;
          const y = gridHorizon + (height - gridHorizon) * (z * z); // Perspective height
          const alpha = z * 0.45;
          
          ctx.strokeStyle = getBpmThemeColor(bpm, alpha);
          ctx.lineWidth = 0.5 + z * 1.5;
          ctx.beginPath();
          
          for (let c = 0; c <= cols; c++) {
            const ratio = c / cols;
            const x = ratio * width;
            
            // Rippling grid is deformed dynamically near center on music steps
            const dist = Math.abs(ratio - 0.5);
            const ripple = Math.sin(dist * 10 - waveTime * 3.8) * 15 * (pulseRef.current - 0.95);
            
            if (c === 0) ctx.moveTo(x, y + ripple);
            else ctx.lineTo(x, y + ripple);
          }
          ctx.stroke();
        }
      }

      else if (visualStyle === 'matrix') {
        // STYLE 9: Matrix Runway (数字雨道 - Peripheral scrolling speed code)
        ctx.fillStyle = '#020205';
        ctx.fillRect(0, 0, width, height);

        // Center clean runner track
        const roadW = width * 0.28;
        ctx.strokeStyle = getBpmThemeColor(bpm, 0.5);
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.moveTo(centerX - roadW * 0.1, centerY);
        ctx.lineTo(centerX - roadW, height);
        ctx.moveTo(centerX + roadW * 0.1, centerY);
        ctx.lineTo(centerX + roadW, height);
        ctx.stroke();

        // Draw falling digital rain in the peripheral regions (safe zone in center)
        ctx.font = '800 9px monospace';
        const rainSpeed = isPlaying ? 2.2 : 0.4;
        
        for (let col = 0; col < 12; col++) {
          const isLeft = col < 6;
          // Space columns to left and right margins of screen
          const x = isLeft ? (col * 32) : (width - (11 - col) * 32 - 16);
          
          for (let row = 0; row < 24; row++) {
            const charY = ((row * 24 + waveTime * 85 * rainSpeed) % height);
            const char = Math.random() > 0.55 ? '1' : '0';
            const charAlpha = Math.max(0, 1.0 - charY / height);
            
            ctx.fillStyle = getBpmThemeColor(bpm, charAlpha * 0.55);
            ctx.fillText(char, x, charY);
          }
        }
      }

      // Initialize speed particles once
      if (particlesRef.current.length === 0) {
        for (let i = 0; i < 45; i++) {
          particlesRef.current.push({
            x: (Math.random() - 0.5) * 800,
            y: (Math.random() - 0.5) * 800,
            z: Math.random() * 800 + 100,
            color: Math.random() > 0.5 ? '#34d399' : '#06b6d4',
          });
        }
      }

      // Draw speed particles
      const speedFactor = (isPlaying ? (bpm / 180) * 15 : 0.8);
      ctx.lineWidth = 1.5;
      
      particlesRef.current.forEach((p) => {
        // Project 3D coordinate to 2D
        const px = (p.x / p.z) * width + centerX;
        const py = (p.y / p.z) * height + centerY;
        
        // Move closer
        p.z -= speedFactor;
        
        // Reset if reached viewer
        if (p.z <= 10) {
          p.z = 800 + Math.random() * 100;
          p.x = (Math.random() - 0.5) * 600;
          p.y = (Math.random() - 0.5) * 600;
        }
        
        // Project new 2D position
        const nx = (p.x / p.z) * width + centerX;
        const ny = (p.y / p.z) * height + centerY;
        
        // Draw speed line
        const alpha = Math.max(0, Math.min(0.7, (800 - p.z) / 600));
        ctx.strokeStyle = p.color === '#34d399' 
          ? `rgba(52, 211, 153, ${alpha * 0.45})` 
          : `rgba(6, 182, 212, ${alpha * 0.45})`;
          
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(nx, ny);
        ctx.stroke();
      });

      // Subtle beat expansion ripple
      const rippleRadius = baseBorderRadius * hoverScale * (1.0 + (pulseRef.current - 1.0) * 2.5);
      const rippleAlpha = Math.max(0, 0.4 - (pulseRef.current - 1.0) * 1.8);
      if (rippleAlpha > 0.01) {
        ctx.strokeStyle = isVideoMode 
          ? `rgba(52, 211, 153, ${rippleAlpha})` 
          : getBpmThemeColor(bpm, rippleAlpha);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(centerX, centerY, rippleRadius, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Update spring physics for core pulse
      const k = 0.055;
      const d = 0.13;
      const displacement = pulseRef.current - 1.0;
      const springForce = -k * displacement;
      const dampingForce = -d * pulseVelocityRef.current;
      pulseVelocityRef.current += springForce + dampingForce;
      pulseRef.current += pulseVelocityRef.current;
      pulseRef.current = Math.min(1.4, Math.max(0.7, pulseRef.current));

      // Draw Core Glow Orb (UNTOUCHED — spring beat pulsing)
      const baseOrbRadius = isVideoMode ? 200 : 170;
      const orbRadius = baseOrbRadius * pulseRef.current * hoverScale;

      if (isVideoMode) {
        // Draw solid dark background core
        ctx.fillStyle = 'rgba(7, 10, 20, 0.88)';
        ctx.beginPath();
        ctx.arc(centerX, centerY, orbRadius, 0, Math.PI * 2);
        ctx.fill();

        // Sharp clean border with no shadow / glow
        ctx.strokeStyle = isHoveringCoreRef.current ? '#a7f3d0' : getVideoControlColor(0.86 * pulseRef.current);
        ctx.lineWidth = isHoveringCoreRef.current ? 3.0 : 2.0;
        ctx.beginPath();
        ctx.arc(centerX, centerY, orbRadius, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        const themeColorBase = getBpmThemeColor(bpm, 1.0);
        ctx.fillStyle = getBpmDarkTextColor(bpm);
        ctx.beginPath();
        ctx.arc(centerX, centerY, orbRadius, 0, Math.PI * 2);
        ctx.fill();

        // Sharp clean border with no shadow / glow
        ctx.strokeStyle = isHoveringCoreRef.current ? '#ffffff' : themeColorBase;
        ctx.lineWidth = isHoveringCoreRef.current ? 3.0 : 2.0;
        ctx.beginPath();
        ctx.arc(centerX, centerY, orbRadius, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Draw subtle tech-grid background inside the orb (carbon fiber aesthetic)
      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, orbRadius * 0.95, 0, Math.PI * 2);
      ctx.clip();
      ctx.strokeStyle = isVideoMode 
        ? 'rgba(52, 211, 153, 0.05)' 
        : 'rgba(255, 255, 255, 0.035)';
      ctx.lineWidth = 1.0;
      const stepSize = 18;
      for (let x = -orbRadius; x <= orbRadius; x += stepSize) {
        ctx.beginPath();
        ctx.moveTo(centerX + x, centerY - orbRadius);
        ctx.lineTo(centerX + x + orbRadius * 2, centerY + orbRadius);
        ctx.stroke();
      }
      for (let x = -orbRadius * 2; x <= orbRadius; x += stepSize) {
        ctx.beginPath();
        ctx.moveTo(centerX + x, centerY + orbRadius);
        ctx.lineTo(centerX + x + orbRadius * 2, centerY - orbRadius);
        ctx.stroke();
      }
      ctx.restore();

      // Draw dual-wave liquid holographic plasma core inside the orb (fully audio reactive!)
      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, orbRadius * 0.95, 0, Math.PI * 2);
      ctx.clip();
      
      const waveAmp = 22 * (pulseRef.current - 0.9);
      const waveFreq = 0.024;
      const waveOffset = waveTime * 4.0;
      
      // Wave 1: Green Wave
      ctx.strokeStyle = isVideoMode ? 'rgba(52, 211, 153, 0.26)' : getBpmThemeColor(bpm, 0.26);
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      for (let x = -orbRadius; x <= orbRadius; x += 5) {
        const y = Math.sin(x * waveFreq + waveOffset) * waveAmp + (orbRadius * 0.12);
        if (x === -orbRadius) ctx.moveTo(centerX + x, centerY + y);
        else ctx.lineTo(centerX + x, centerY + y);
      }
      ctx.stroke();
      
      // Wave 2: Cyan/White Wave (Phase-offset, floating slightly higher)
      ctx.strokeStyle = isVideoMode ? 'rgba(6, 182, 212, 0.22)' : 'rgba(255, 255, 255, 0.18)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let x = -orbRadius; x <= orbRadius; x += 5) {
        const y = Math.cos(x * waveFreq - waveOffset * 0.78) * waveAmp * 0.88 - (orbRadius * 0.08);
        if (x === -orbRadius) ctx.moveTo(centerX + x, centerY + y);
        else ctx.lineTo(centerX + x, centerY + y);
      }
      ctx.stroke();
      
      ctx.restore();

      // Draw spinning sci-fi turbine blades inside the core
      const turbineAngle = rotationAngle * (isPlaying ? 2.5 : 0.4);
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(turbineAngle);
      const bladeColor = isVideoMode 
        ? 'rgba(52, 211, 153, 0.09)' 
        : getBpmThemeColor(bpm, 0.09);
      ctx.fillStyle = bladeColor;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, orbRadius * 0.9, 0, Math.PI * 0.28);
        ctx.closePath();
        ctx.fill();
        ctx.rotate((Math.PI * 2) / 3);
      }
      ctx.restore();

      // Circular Audio Spectrum Visualizer around the core border
      const barsCount = 60;
      const spectrumThemeColor = isVideoMode 
        ? getVideoControlColor(0.85) 
        : getBpmThemeColor(bpm, 0.85);
      ctx.save();
      ctx.lineWidth = 2.0;
      ctx.lineCap = 'round';
      for (let i = 0; i < barsCount; i++) {
        const angle = (i / barsCount) * Math.PI * 2 + rotationAngle * 0.15;
        const noise = Math.sin(i * 0.5 + waveTime * 4.5) * Math.cos(i * 0.3 - waveTime * 2.2);
        const beatImpact = (pulseRef.current - 1.0) * 120;
        const baseHeight = isPlaying ? 8 + Math.abs(noise) * 16 : 4 + Math.abs(noise) * 5;
        const barHeight = Math.max(2, baseHeight + beatImpact);
        const startRad = orbRadius + 3;
        const endRad = startRad + barHeight;
        const sx = centerX + Math.cos(angle) * startRad;
        const sy = centerY + Math.sin(angle) * startRad;
        const ex = centerX + Math.cos(angle) * endRad;
        const ey = centerY + Math.sin(angle) * endRad;
        ctx.strokeStyle = spectrumThemeColor;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      }
      ctx.restore();

      // Concentric Tech Segmented Rings
      ctx.save();
      const outerRad = baseBorderRadius * hoverScale + 10;
      ctx.strokeStyle = isVideoMode ? 'rgba(52, 211, 153, 0.45)' : getBpmThemeColor(bpm, 0.45);
      ctx.lineWidth = 1.5;
      ctx.setLineDash([35, 12, 10, 12]);
      ctx.lineDashOffset = -rotationAngle * 35;
      ctx.beginPath();
      ctx.arc(centerX, centerY, outerRad, 0, Math.PI * 2);
      ctx.stroke();

      const innerRad = baseBorderRadius * hoverScale - 8;
      ctx.strokeStyle = isVideoMode ? 'rgba(6, 182, 212, 0.55)' : getBpmThemeColor(bpm, 0.55);
      ctx.lineWidth = 1.0;
      ctx.setLineDash([60, 25, 5, 25]);
      ctx.lineDashOffset = rotationAngle * 45;
      ctx.beginPath();
      ctx.arc(centerX, centerY, innerRad, 0, Math.PI * 2);
      ctx.stroke();

      ctx.setLineDash([]);
      ctx.strokeStyle = isVideoMode ? 'rgba(52, 211, 153, 0.65)' : getBpmThemeColor(bpm, 0.65);
      ctx.lineWidth = 2.0;
      const tickLength = 8;
      const crosshairAngles = [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5];
      crosshairAngles.forEach((a) => {
        const sx = centerX + Math.cos(a) * (outerRad - 4);
        const sy = centerY + Math.sin(a) * (outerRad - 4);
        const ex = centerX + Math.cos(a) * (outerRad + tickLength);
        const ey = centerY + Math.sin(a) * (outerRad + tickLength);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      });
      ctx.restore();

      // Draw 2 Vibrating Outer Rings (同步弹簧物理律动的振动氛围外环)
      if (isPlaying) {
        const vRadius1 = baseBorderRadius * 1.38 * pulseRef.current * hoverScale;
        ctx.strokeStyle = isVideoMode
          ? getVideoControlColor(0.46 * (pulseRef.current - 0.15))
          : getBpmThemeColor(bpm, 0.48 * (pulseRef.current - 0.15));
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(centerX, centerY, vRadius1, 0, Math.PI * 2);
        ctx.stroke();

        const vRadius2 = baseBorderRadius * 1.68 * pulseRef.current * hoverScale;
        ctx.strokeStyle = isVideoMode
          ? getVideoControlColor(0.24 * (pulseRef.current - 0.25))
          : getBpmThemeColor(bpm, 0.25 * (pulseRef.current - 0.25));
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.arc(centerX, centerY, vRadius2, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Sharp outer ring for hover state (no shadow / glow)
      if (isHoveringCoreRef.current) {
        ctx.strokeStyle = isVideoMode ? 'rgba(52, 211, 153, 0.6)' : getBpmThemeColor(bpm, 0.6);
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.arc(centerX, centerY, baseBorderRadius * hoverScale + 8, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Draw central command text and sub-labels
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = isVideoMode 
        ? (isHoveringCoreRef.current ? '#ecfdf5' : '#34d399') 
        : getBpmDarkTextColor(bpm);
      ctx.font = `800 ${isVideoMode ? 44 : 38}px Rajdhani, system-ui, sans-serif`;

      let mainText = '';
      let subText = '';
      let subColor = '';

      if (!isPlaying && isHoveringCoreRef.current) {
        mainText = '▶ START';
        subText = 'INITIALIZE TRAIN';
        subColor = isVideoMode ? '#6ee7b7' : '#fbbf24';
      } else if (isPlaying && isHoveringCoreRef.current) {
        mainText = '⏹ STOP';
        subText = 'HALT ENGINE';
        subColor = '#f43f5e';
      } else {
        mainText = isPlaying ? 'RUNNING' : 'READY';
        subText = isPlaying ? 'METRIC SYNCED' : 'SYSTEM IDLE';
        subColor = isPlaying 
          ? (isVideoMode ? '#34d399' : getBpmThemeColor(bpm, 0.9))
          : 'rgba(255, 255, 255, 0.4)';
      }

      ctx.fillText(mainText, centerX, centerY - 6);

      ctx.fillStyle = subColor;
      ctx.font = `800 11px monospace`;
      ctx.fillText(subText, centerX, centerY + 24);

      ctx.strokeStyle = subColor;
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(centerX - 35, centerY + 12);
      ctx.lineTo(centerX + 35, centerY + 12);
      ctx.stroke();

      ctx.restore();

      // Lightning sparks
      if (combo >= 15 && isPlaying && Math.random() < 0.4) {
        ctx.strokeStyle = `hsla(${Math.random() * 360}, 100%, 75%, 0.8)`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        let currX = centerX + (Math.random() - 0.5) * 80;
        let currY = centerY + (Math.random() - 0.5) * 80;
        ctx.moveTo(currX, currY);
        for (let i = 0; i < 4; i++) {
          currX += (Math.random() - 0.5) * 20;
          currY += (Math.random() - 0.5) * 20;
          ctx.lineTo(currX, currY);
        }
        ctx.stroke();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [bpm, isPlaying, combo, visualStyle, isVideoCovered, focusBgTheme]);

  // Click canvas to trigger engine start/stop if clicked in central core
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const dist = Math.sqrt((clickX - centerX) ** 2 + (clickY - centerY) ** 2);

    const isVideoMode = visualStyle === 'video';
    const baseBorderRadius = isVideoMode ? 210 : 180;
    const clickThreshold = baseBorderRadius * 1.3;

    if (dist <= clickThreshold) {
      onTogglePlay();
      pulseVelocityRef.current = 0.14; // tactile spring force feedback!
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const dist = Math.sqrt((mouseX - centerX) ** 2 + (mouseY - centerY) ** 2);

    const isVideoMode = visualStyle === 'video';
    const baseBorderRadius = isVideoMode ? 210 : 180;
    const hoverThreshold = baseBorderRadius * 1.3;

    if (dist <= hoverThreshold) {
      canvas.style.cursor = 'pointer';
      isHoveringCoreRef.current = true;
    } else {
      canvas.style.cursor = 'default';
      isHoveringCoreRef.current = false;
    }
  };

  // Determine container dimensions dynamically
  const getContainerStyle = () => {
    const stageHeight = 'calc(100vh - 4.25rem)';

    if (visualStyle === 'video' && videoUrl && !isVideoCovered && videoRatio < 1.0) {
      // Portrait video (9:16) — use full height matching landscape, centered with exact aspect ratio
      return {
        position: 'relative' as const,
        height: stageHeight,
        maxHeight: 'none',
        minHeight: '30rem',
        aspectRatio: `${videoRatio}`,
        width: 'auto',
        maxWidth: '100%',
        borderRadius: '1rem',
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        background: 'rgba(0, 0, 0, 0.9)',
        boxShadow: '0 0.4rem 1.2rem rgba(0,0,0,0.4)',
        margin: '0 auto',
      };
    }
    // Landscape video (16:9) & all other visual styles — fill viewport height
    return {
      position: 'relative' as const,
      width: '100%',
      height: stageHeight,
      minHeight: '30rem',
      maxHeight: 'none',
      borderRadius: '1rem',
      overflow: 'hidden',
      border: '1px solid rgba(255, 255, 255, 0.05)',
      background: visualStyle === 'video' ? 'rgba(0, 0, 0, 0.85)' : 'rgba(10, 10, 15, 0.6)',
      boxShadow: '0 0.4rem 1.2rem rgba(0,0,0,0.4)',
      transition: 'border-color 0.2s ease, box-shadow 0.2s ease'
    };
  };

  return (
    <div className="visualizer-container" style={getContainerStyle()}>
      
      {visualStyle === 'video' && videoUrl && (
        <video
          ref={videoRef}
          src={videoUrl ?? undefined}
          muted={videoMuted}
          playsInline
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={onVideoEnded}
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            left: 0,
            top: 0,
            zIndex: 0,
            display: isVideoCovered ? 'none' : 'block',
          }}
        />
      )}

      {(
        <>
          <button
            type="button"
            className={`video-cover-toggle ${isVideoCovered ? 'active' : ''}`}
            onClick={() => setIsVideoCovered((prev) => !prev)}
            aria-pressed={isVideoCovered}
            title={isVideoCovered ? '显示画面' : '隐藏画面'}
          >
            {isVideoCovered ? '显示画面' : '隐藏画面'}
          </button>

          {isVideoCovered && (
            <button
              type="button"
              className="video-bg-toggle"
              onClick={handleToggleFocusBg}
              title="切换背景样式"
            >
              🎨 切换背景 ({getFocusBgName()})
            </button>
          )}

          {visualStyle === 'video' && videoUrl && (
            <button
              type="button"
              className={`video-fullscreen-toggle ${isFullscreen ? 'active' : ''}`}
              onClick={handleToggleFullscreen}
              aria-pressed={isFullscreen}
              title={isFullscreen ? '退出全屏' : '全屏播放'}
            >
              {isFullscreen ? '退出全屏' : '全屏播放'}
            </button>
          )}

          <div className={`video-focus-cover ${isVideoCovered ? 'visible' : ''}`} aria-hidden={!isVideoCovered}>
            <div className="video-focus-aurora" />
            <div className="video-focus-grid" />
            <div className="video-focus-panel">
              <span className="video-focus-kicker">FOCUS MODE</span>
              <span className="video-focus-bpm">{bpm}</span>
              <span className="video-focus-unit">BPM</span>
            </div>
          </div>
        </>
      )}

      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        onMouseMove={handleMouseMove}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          display: 'block',
          width: '100%',
          height: '100%',
          zIndex: 2,
        }}
      />

      {combo > 0 && (
        <div className="visualizer-hud-combo" style={{ zIndex: 5 }}>
          <span className="combo-hud-label">Combo</span>
          <span className="combo-hud-value">{combo}x</span>
        </div>
      )}
    </div>
  );
};

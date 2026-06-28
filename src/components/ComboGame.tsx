import React, { useState, useEffect, useRef } from 'react';

interface ComboGameProps {
  bpm: number;
  isPlaying: boolean;
  beatTrigger: number;
  setCombo: React.Dispatch<React.SetStateAction<number>>;
  setMaxCombo: React.Dispatch<React.SetStateAction<number>>;
}

interface FloatingText {
  id: number;
  text: string;
  rating: 'perfect' | 'great' | 'good' | 'miss' | 'wrong';
  x: number; // percentage width
  y: number; // percentage height
}

const FootprintsIcon: React.FC<{ active: boolean }> = ({ active }) => (
  <svg 
    width="80" 
    height="80" 
    viewBox="0 0 36 36" 
    style={{ 
      color: active ? '#10b981' : 'rgba(255, 255, 255, 0.08)',
      marginBottom: '4px',
    }}
  >
    <path 
      d="M25.776 4.708c1.333 0 6.833 1.333 6.833 7.75s-6.261 15.73-8.625 15.959c-2.583.25-4.208-1.375-4.208-4s4.083-4.334 2.208-8.292-2.333-11.417 3.792-11.417zm7.081 2.232c-.432.733-.323 1.598.242 1.93.565.333 1.374.007 1.805-.727.432-.734.323-1.599-.242-1.931-.565-.332-1.374-.006-1.805.728zm-2.902-2.862c-.117.843.342 1.604 1.025 1.699.684.095 1.334-.511 1.451-1.355.117-.843-.342-1.604-1.025-1.699-.683-.095-1.334.511-1.451 1.355zm-3.221-1.37c0 .921.598 1.667 1.334 1.667.736 0 1.333-.746 1.333-1.667 0-.92-.597-1.667-1.333-1.667s-1.334.747-1.334 1.667zm-3.791-.687c0 1.024.635 1.854 1.416 1.854.783 0 1.417-.83 1.417-1.854S25.142.167 24.359.167c-.781 0-1.416.83-1.416 1.854zm-5.307 2.156c.378 1.459 1.604 2.405 2.741 2.111 1.137-.294 1.751-1.715 1.373-3.174-.377-1.459-1.604-2.404-2.74-2.11-1.137.293-1.751 1.715-1.374 3.173zm-7.719 7.531c-1.333 0-6.833 1.333-6.833 7.75s6.261 15.73 8.625 15.959c2.583.25 4.208-1.375 4.208-4s-4.083-4.334-2.208-8.292 2.333-11.417-3.792-11.417zM2.836 13.94c.432.733.323 1.598-.242 1.93-.566.333-1.375.007-1.805-.727-.432-.734-.323-1.599.242-1.931.566-.332 1.374-.006 1.805.728zm2.902-2.862c.117.843-.342 1.604-1.025 1.699-.684.095-1.334-.511-1.451-1.354-.117-.843.342-1.604 1.025-1.699.684-.096 1.334.51 1.451 1.354zm3.22-1.37c0 .921-.597 1.667-1.333 1.667s-1.333-.746-1.333-1.667c0-.92.597-1.667 1.333-1.667.737.001 1.333.747 1.333 1.667zm3.792-.687c0 1.024-.634 1.854-1.417 1.854s-1.417-.83-1.417-1.854.634-1.854 1.417-1.854 1.417.83 1.417 1.854zm5.308 2.156c-.377 1.459-1.604 2.405-2.741 2.111-1.137-.294-1.752-1.715-1.374-3.174.377-1.459 1.604-2.404 2.74-2.11 1.137.293 1.752 1.715 1.375 3.173z" 
      fill="currentColor" 
    />
  </svg>
);

// Mirrored Version for the Right Foot Pad
const FootprintsIconMirrored: React.FC<{ active: boolean }> = ({ active }) => (
  <svg 
    width="80" 
    height="80" 
    viewBox="0 0 36 36" 
    style={{ 
      color: active ? '#10b981' : 'rgba(255, 255, 255, 0.08)',
      marginBottom: '4px',
      transform: 'scaleX(-1)',
    }}
  >
    <path 
      d="M25.776 4.708c1.333 0 6.833 1.333 6.833 7.75s-6.261 15.73-8.625 15.959c-2.583.25-4.208-1.375-4.208-4s4.083-4.334 2.208-8.292-2.333-11.417 3.792-11.417zm7.081 2.232c-.432.733-.323 1.598.242 1.93.565.333 1.374.007 1.805-.727.432-.734.323-1.599-.242-1.931-.565-.332-1.374-.006-1.805.728zm-2.902-2.862c-.117.843.342 1.604 1.025 1.699.684.095 1.334-.511 1.451-1.355.117-.843-.342-1.604-1.025-1.699-.683-.095-1.334.511-1.451 1.355zm-3.221-1.37c0 .921.598 1.667 1.334 1.667.736 0 1.333-.746 1.333-1.667 0-.92-.597-1.667-1.333-1.667s-1.334.747-1.334 1.667zm-3.791-.687c0 1.024.635 1.854 1.416 1.854.783 0 1.417-.83 1.417-1.854S25.142.167 24.359.167c-.781 0-1.416.83-1.416 1.854zm-5.307 2.156c.378 1.459 1.604 2.405 2.741 2.111 1.137-.294 1.751-1.715 1.373-3.174-.377-1.459-1.604-2.404-2.74-2.11-1.137.293-1.751 1.715-1.374 3.173zm-7.719 7.531c-1.333 0-6.833 1.333-6.833 7.75s6.261 15.73 8.625 15.959c2.583.25 4.208-1.375 4.208-4s-4.083-4.334-2.208-8.292 2.333-11.417-3.792-11.417zM2.836 13.94c.432.733.323 1.598-.242 1.93-.566.333-1.375.007-1.805-.727-.432-.734-.323-1.599.242-1.931.566-.332 1.374-.006 1.805.728zm2.902-2.862c.117.843-.342 1.604-1.025 1.699-.684.095-1.334-.511-1.451-1.354-.117-.843.342-1.604 1.025-1.699.684-.096 1.334.51 1.451 1.354zm3.22-1.37c0 .921-.597 1.667-1.333 1.667s-1.333-.746-1.333-1.667c0-.92.597-1.667 1.333-1.667.737.001 1.333.747 1.333 1.667zm3.792-.687c0 1.024-.634 1.854-1.417 1.854s-1.417-.83-1.417-1.854.634-1.854 1.417-1.854 1.417.83 1.417 1.854zm5.308 2.156c-.377 1.459-1.604 2.405-2.741 2.111-1.137-.294-1.752-1.715-1.374-3.174.377-1.459 1.604-2.404 2.74-2.11 1.137.293 1.752 1.715 1.375 3.173z" 
      fill="currentColor" 
    />
  </svg>
);

export const ComboGame: React.FC<ComboGameProps> = ({
  bpm,
  isPlaying,
  beatTrigger,
  setCombo,
  setMaxCombo,
}) => {
  const [feedback, setFeedback] = useState<string>('');
  const [feedbackColor, setFeedbackColor] = useState<string>('');
  const [floatingTexts, setFloatingTexts] = useState<FloatingText[]>([]);
  
  const lastBeatTimeRef = useRef<number>(0);
  const nextTextIdRef = useRef<number>(0);

  // Active target alternates left/right foot on each beat tick
  // beatTrigger % 2 === 0 (Left Foot), beatTrigger % 2 === 1 (Right Foot)
  const activeFoot = (beatTrigger % 2 === 0) ? 'L' : 'R';

  // Track the timestamp of the last beat trigger in main thread
  useEffect(() => {
    if (isPlaying && beatTrigger > 0) {
      lastBeatTimeRef.current = performance.now();
    }
  }, [beatTrigger, isPlaying]);

  // Handle tap event for either Left ('L') or Right ('R') foot
  const handleTap = (foot: 'L' | 'R', e?: React.MouseEvent | React.TouchEvent) => {
    if (!isPlaying) {
      setFeedback('请先开启节拍器！');
      setFeedbackColor('text-amber-400');
      return;
    }

    const tapTime = performance.now();
    const beatPeriodMs = (60 / bpm) * 1000;
    
    // Calculate difference between tap and nearest beat
    const timeSinceLastBeat = tapTime - lastBeatTimeRef.current;
    const timeToNextBeat = beatPeriodMs - timeSinceLastBeat;
    const diff = Math.min(timeSinceLastBeat, timeToNextBeat);

    // Calculate relative floating text coordinates inside target pad column
    let clickX = 50;
    let clickY = 50;

    if (e) {
      const rect = e.currentTarget.getBoundingClientRect();
      let clientX = 0;
      let clientY = 0;

      if ('touches' in e && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else if ('clientX' in e) {
        clientX = e.clientX;
        clientY = e.clientY;
      }

      if (clientX > 0) {
        clickX = ((clientX - rect.left) / rect.width) * 100;
        clickY = ((clientY - rect.top) / rect.height) * 100;
      }
    }

    let rating: 'perfect' | 'great' | 'good' | 'miss' | 'wrong';
    let text = '';
    let colorClass = '';

    // RULE 1: Must hit the CORRECT alternating landing foot!
    if (foot !== activeFoot) {
      rating = 'wrong';
      text = '踩错脚了! 🚫';
      colorClass = 'text-rose-500 scale-95';
      setCombo(0);
    } else {
      // RULE 2: Correct foot, check timing alignment (accuracy)
      if (diff <= 70) {
        rating = 'perfect';
        text = 'PERFECT! 🔥';
        colorClass = 'text-amber-400 scale-110 font-bold';
        setCombo((prev) => {
          const next = prev + 1;
          setMaxCombo((m) => Math.max(m, next));
          return next;
        });
      } else if (diff <= 145) {
        rating = 'great';
        text = 'GREAT! 👍';
        colorClass = 'text-emerald-400 font-semibold';
        setCombo((prev) => {
          const next = prev + 1;
          setMaxCombo((m) => Math.max(m, next));
          return next;
        });
      } else if (diff <= 230) {
        rating = 'good';
        text = 'GOOD! 👀';
        colorClass = 'text-sky-400';
        setCombo((prev) => {
          const next = prev + 1;
          setMaxCombo((m) => Math.max(m, next));
          return next;
        });
      } else {
        rating = 'miss';
        text = 'MISS! ⚠️';
        colorClass = 'text-rose-500';
        setCombo(0);
      }
    }

    setFeedback(text);
    setFeedbackColor(colorClass);

    // Spawn floating text overlay over the tapped pad
    // Map L to left column, R to right column positioning
    const layoutX = foot === 'L' ? (clickX * 0.5) : (50 + clickX * 0.5);

    const newText: FloatingText = {
      id: nextTextIdRef.current++,
      text,
      rating,
      x: layoutX,
      y: clickY,
    };

    setFloatingTexts((prev) => [...prev, newText]);

    setTimeout(() => {
      setFloatingTexts((prev) => prev.filter((t) => t.id !== newText.id));
    }, 850);
  };

  // Listen to keyboard binds (A/LeftArrow -> Left Foot, D/RightArrow -> Right Foot)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isPlaying) return;

      if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') {
        handleTap('L');
      } else if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') {
        handleTap('R');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isPlaying, beatTrigger, bpm]);

  const isLeftActive = isPlaying && activeFoot === 'L';
  const isRightActive = isPlaying && activeFoot === 'R';

  return (
    <div className="panel-card combo-game-card" style={{ userSelect: 'none', WebkitUserSelect: 'none', position: 'relative' }}>
      {/* Floating text rendering container */}
      {floatingTexts.map((ft) => (
        <span
          key={ft.id}
          style={{ 
            position: 'absolute', 
            pointerEvents: 'none', 
            transform: 'translate(-50%, -50%)', 
            left: `${ft.x}%`, 
            top: `${42 + ft.y * 0.72}px`, 
            userSelect: 'none', 
            whiteSpace: 'nowrap',
            fontWeight: 900,
            fontSize: '1.25rem',
            letterSpacing: '0.05em',
            zIndex: 10
          }}
          className={`${
            ft.rating === 'perfect' 
              ? 'text-yellow-400' 
              : ft.rating === 'great' 
              ? 'text-emerald-400' 
              : ft.rating === 'good' 
              ? 'text-sky-400' 
              : 'text-rose-500'
          }`}
        >
          {ft.text}
        </span>
      ))}

      {/* Bilateral Left/Right Tapping Pads Row */}
      <div className="foot-pads-row">
        
        {/* Left Foot Pad */}
        <button
          onTouchStart={(e) => handleTap('L', e)}
          onMouseDown={(e) => {
            if (e.type === 'mousedown' && 'ontouchstart' in window) return;
            handleTap('L', e);
          }}
          className={`foot-pad left-pad ${!isPlaying ? 'disabled-mode' : ''}`}
          style={{
            border: '2.5px solid rgba(255, 255, 255, 0.045)',
            background: 'rgba(0, 0, 0, 0.15)',
            boxShadow: 'none',
            opacity: isPlaying && !isLeftActive ? 0.72 : 1.0,
          }}
        >
          <FootprintsIcon active={isLeftActive} />
          <span 
            className="foot-label"
            style={{
              color: isLeftActive ? '#ffffff' : 'rgba(255, 255, 255, 0.25)',
              fontWeight: 800,
              textShadow: 'none',
            }}
          >
            左脚
          </span>
        </button>

        {/* Right Foot Pad */}
        <button
          onTouchStart={(e) => handleTap('R', e)}
          onMouseDown={(e) => {
            if (e.type === 'mousedown' && 'ontouchstart' in window) return;
            handleTap('R', e);
          }}
          className={`foot-pad right-pad ${!isPlaying ? 'disabled-mode' : ''}`}
          style={{
            border: '2.5px solid rgba(255, 255, 255, 0.045)',
            background: 'rgba(0, 0, 0, 0.15)',
            boxShadow: 'none',
            opacity: isPlaying && !isRightActive ? 0.72 : 1.0,
          }}
        >
          <FootprintsIconMirrored active={isRightActive} />
          <span 
            className="foot-label"
            style={{
              color: isRightActive ? '#ffffff' : 'rgba(255, 255, 255, 0.25)',
              fontWeight: 800,
              textShadow: 'none',
            }}
          >
            右脚
          </span>
        </button>

      </div>

      {/* Simplified status feedback bar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: '-0.3rem' }}>
        <div className={`tap-live-feedback ${feedbackColor}`} style={{ position: 'static' }}>
          {feedback}
        </div>
      </div>

    </div>
  );
};

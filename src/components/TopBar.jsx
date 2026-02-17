import React, { useRef, useCallback, useState } from 'react';
import EnergyBar from './EnergyBar';
import { audioManager } from '../utils/audioManager';
import { TEACHER_PANEL_CLICKS, TEACHER_PANEL_TIMEOUT } from '../utils/constants';

// --- Custom volume slider using PNG track + thumb ---
function VolumeSlider({ value, onChange }) {
  const trackRef = useRef(null);
  const dragging = useRef(false);

  const calcValue = (clientX) => {
    const rect = trackRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    return Math.round((x / rect.width) * 20) / 20; // snap to 0.05 steps
  };

  const handlePointerDown = (e) => {
    e.preventDefault();
    dragging.current = true;
    const val = calcValue(e.clientX);
    onChange(val);
    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
  };

  const handlePointerMove = (e) => {
    if (!dragging.current) return;
    const val = calcValue(e.clientX);
    onChange(val);
  };

  const handlePointerUp = () => {
    dragging.current = false;
    document.removeEventListener('pointermove', handlePointerMove);
    document.removeEventListener('pointerup', handlePointerUp);
  };

  // Thumb constrained within track: left ranges from 0 to (trackWidth - thumbWidth)
  const TRACK_W = 90;
  const THUMB_W = 24;
  const frac = Math.max(0, Math.min(1, value));
  const thumbLeft = frac * (TRACK_W - THUMB_W);

  return (
    <div
      ref={trackRef}
      onPointerDown={handlePointerDown}
      style={{
        position: 'relative',
        width: TRACK_W,
        height: 28,
        cursor: 'pointer',
        touchAction: 'none',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      {/* Track */}
      <div style={{
        width: '100%',
        height: 14,
        backgroundImage: 'url(/images/ui/volume-slider-track.png)',
        backgroundSize: '100% 100%',
        backgroundRepeat: 'no-repeat',
        borderRadius: 7,
      }} />
      {/* Thumb */}
      <div style={{
        position: 'absolute',
        left: thumbLeft,
        top: '50%',
        transform: 'translateY(-50%)',
        width: THUMB_W,
        height: THUMB_W,
        backgroundImage: 'url(/images/ui/volume-slider-thumb.png)',
        backgroundSize: 'contain',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
        pointerEvents: 'none',
      }} />
    </div>
  );
}

// --- PNG button helper ---
function PngButton({ src, alt, size, onClick, title }) {
  const [imgOk, setImgOk] = useState(true);
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: 2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {imgOk ? (
        <img
          src={src}
          alt={alt}
          style={{ width: size, height: size, objectFit: 'contain' }}
          onError={() => setImgOk(false)}
        />
      ) : (
        <span style={{ fontSize: size * 0.6, color: '#8B5A2B' }}>{alt}</span>
      )}
    </button>
  );
}

// --- Save status indicator ---
function SaveIndicator({ status }) {
  if (!status) return null;
  const config = {
    idle:   { text: '\u2601\uFE0F', color: '#999',    opacity: 0.35, animation: undefined },
    saving: { text: '\u2601\uFE0F', color: '#999',    opacity: 0.6,  animation: 'pulse 1.2s ease-in-out infinite' },
    saved:  { text: '\u2713',       color: '#00C48C',  opacity: 1,    animation: undefined },
    error:  { text: '\u26A0',       color: '#E65100',  opacity: 1,    animation: undefined },
  };
  const c = config[status] || config.idle;
  return (
    <div style={{
      width: 24,
      height: 24,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 16,
      color: c.color,
      opacity: c.opacity,
      transition: 'opacity 0.3s, color 0.3s',
      animation: c.animation,
      fontWeight: 'bold',
    }} title={status === 'saved' ? 'Gespeichert' : status === 'saving' ? 'Wird gespeichert...' : status === 'error' ? 'Speicherfehler' : 'Cloud'}>
      {c.text}
    </div>
  );
}

export default function TopBar({ energy, volume, onVolumeChange, dayName, dayId, dayColor, onOpenTeacherPanel, onTitleClick, isIntro, onOpenBoard, onOpenQuiz, onOpenChat, onOpenArtStudio, onOpenArtRoom, onLightningClick, className: klassenName, saveStatus, projectName, onDashboard }) {
  const clickCountRef = useRef(0);
  const clickTimerRef = useRef(null);
  const [muted, setMuted] = useState(false);
  const prevVolRef = useRef(0.3);
  const [artDropdownOpen, setArtDropdownOpen] = useState(false);

  const handleTitleClick = useCallback(() => {
    clickCountRef.current += 1;

    if (clickCountRef.current >= TEACHER_PANEL_CLICKS) {
      clickCountRef.current = 0;
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
      if (onOpenTeacherPanel) onOpenTeacherPanel();
      return;
    }

    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    clickTimerRef.current = setTimeout(() => {
      if (clickCountRef.current < TEACHER_PANEL_CLICKS && onTitleClick) {
        onTitleClick();
      }
      clickCountRef.current = 0;
    }, TEACHER_PANEL_TIMEOUT);
  }, [onOpenTeacherPanel, onTitleClick]);

  const handleMuteToggle = () => {
    if (muted) {
      setMuted(false);
      if (onVolumeChange) onVolumeChange(prevVolRef.current || 0.3);
    } else {
      prevVolRef.current = volume;
      setMuted(true);
      if (onVolumeChange) onVolumeChange(0);
    }
  };

  const handleVolumeSlider = (val) => {
    if (onVolumeChange) onVolumeChange(val);
    if (val > 0 && muted) setMuted(false);
    if (val === 0 && !muted) setMuted(true);
  };

  // Intro mode: just show volume control with transparent bg (high z-index)
  if (isIntro) {
    return (
      <div style={styles.barIntro}>
        <div style={styles.volumeControl}>
          <PngButton
            src={muted || volume === 0 ? '/images/ui/button-sound-off.png' : '/images/ui/button-sound-on.png'}
            alt={muted || volume === 0 ? '\u{1F507}' : '\u{1F50A}'}
            size={30}
            onClick={handleMuteToggle}
            title="Ton ein/aus"
          />
          <VolumeSlider value={volume} onChange={handleVolumeSlider} />
        </div>
      </div>
    );
  }

  return (
    <div style={styles.bar}>
      {/* Left: Settings + Logo */}
      <div style={styles.left}>
        <PngButton
          src="/images/ui/button-settings.png"
          alt={'\u2699\uFE0F'}
          size={32}
          onClick={() => { if (onOpenTeacherPanel) onOpenTeacherPanel(); }}
          title="Lehrermenü"
        />
        <div style={styles.titleArea} onClick={handleTitleClick}>
          <div style={styles.titleBacking}>
            <img
              src="/images/ui/title-projektwoche-kinderrechte.png"
              alt="Projektwoche: Kinderrechte"
              style={{ height: 55, width: 'auto', objectFit: 'contain' }}
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.parentNode.nextSibling.style.display = 'flex';
              }}
            />
          </div>
          <div style={{ display: 'none', alignItems: 'center', gap: 8 }}>
            <span style={styles.globe}>{'\u{1F30D}'}</span>
            <span style={styles.title}>Projektwoche: Kinderrechte</span>
          </div>
        </div>
      </div>

      {/* Center: intentionally empty — day titles shown in day content area */}
      <div style={styles.center} />

      {/* Right: Class name + Board + Energy + Skip + Sound + Volume */}
      <div style={styles.right}>
        {onDashboard && (
          <button onClick={onDashboard} title="Zum Dashboard" style={styles.dashboardButton}>
            {'\u{1F3E0}'}
          </button>
        )}
        {projectName && (
          <span style={styles.className}>{projectName}{klassenName ? ` (${klassenName})` : ''}</span>
        )}
        {onOpenBoard && (
          <PngButton
            src="/images/ui/button-board.png"
            alt={'\u{1F4CB}'}
            size={30}
            onClick={onOpenBoard}
            title="Klassen-Board"
          />
        )}
        {onOpenQuiz && (
          <PngButton
            src="/images/ui/button-quiz.png"
            alt={'\u2753'}
            size={30}
            onClick={onOpenQuiz}
            title="Quiz"
          />
        )}
        {onOpenChat && (
          <PngButton
            src="/images/ui/button-chat.png"
            alt={'\u{1F4AC}'}
            size={30}
            onClick={onOpenChat}
            title="Chat"
          />
        )}
        {(onOpenArtStudio || onOpenArtRoom) && (
          <div style={{ position: 'relative' }}>
            <PngButton
              src="/images/ui/button-art.png"
              alt={'\u{1F3A8}'}
              size={30}
              onClick={() => setArtDropdownOpen(!artDropdownOpen)}
              title="KI-Kunststudio"
            />
            {artDropdownOpen && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 199 }} onClick={() => setArtDropdownOpen(false)} />
                <div style={styles.artDropdown}>
                  {onOpenArtRoom && (
                    <button onClick={() => { setArtDropdownOpen(false); onOpenArtRoom(); }} style={styles.artDropdownItem}>
                      {'\u{1F3A8}'} Kunstraum
                    </button>
                  )}
                  {onOpenArtStudio && (
                    <button onClick={() => { setArtDropdownOpen(false); onOpenArtStudio(); }} style={styles.artDropdownItem}>
                      {'\u270F\uFE0F'} Eigene Kreation
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
        <EnergyBar energy={energy} onLightningClick={onLightningClick} />
        {saveStatus && <SaveIndicator status={saveStatus} />}
        <PngButton
          src="/images/ui/button-skip.png"
          alt={'\u23ED'}
          size={30}
          onClick={() => audioManager.skipTrack()}
          title="Nächster Song"
        />
        <div style={styles.volumeControl}>
          <PngButton
            src={muted || volume === 0 ? '/images/ui/button-sound-off.png' : '/images/ui/button-sound-on.png'}
            alt={muted || volume === 0 ? '\u{1F507}' : '\u{1F50A}'}
            size={30}
            onClick={handleMuteToggle}
            title="Ton ein/aus"
          />
          <VolumeSlider value={volume} onChange={handleVolumeSlider} />
        </div>
      </div>
    </div>
  );
}

const styles = {
  bar: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    height: 56,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 20px',
    background: 'rgba(255, 245, 235, 0.35)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    borderBottom: '1px solid rgba(255, 166, 107, 0.15)',
    boxShadow: '0 1px 8px rgba(139, 90, 43, 0.06)',
    zIndex: 100,
    boxSizing: 'border-box',
  },
  barIntro: {
    position: 'fixed',
    top: 12,
    right: 16,
    display: 'flex',
    alignItems: 'center',
    zIndex: 5000,
    background: 'rgba(255, 248, 240, 0.8)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    borderRadius: 24,
    padding: '6px 14px',
    boxShadow: '0 2px 8px rgba(139, 90, 43, 0.1)',
    border: '1px solid rgba(255, 166, 107, 0.2)',
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  titleArea: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    cursor: 'pointer',
    userSelect: 'none',
  },
  titleBacking: {
    background: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 6,
    padding: '2px 6px',
    boxShadow: '0 1px 4px rgba(139, 90, 43, 0.08)',
    display: 'flex',
    alignItems: 'center',
  },
  globe: {
    fontSize: 26,
  },
  title: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 20,
    color: '#8B5A2B',
    textShadow: '0 1px 2px rgba(255, 200, 100, 0.3)',
  },
  center: {
    position: 'absolute',
    left: '50%',
    transform: 'translateX(-50%)',
  },
  dayName: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 20,
  },
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
  },
  volumeControl: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  className: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 14,
    fontWeight: 700,
    color: '#FF6B35',
    whiteSpace: 'nowrap',
    background: 'rgba(255, 107, 53, 0.1)',
    padding: '3px 10px',
    borderRadius: 10,
    border: '1.5px solid rgba(255, 107, 53, 0.25)',
  },
  dashboardButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 22,
    padding: '2px 4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  artDropdown: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: 6,
    background: 'rgba(255, 248, 240, 0.97)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    borderRadius: 14,
    boxShadow: '0 4px 20px rgba(139, 90, 43, 0.18)',
    border: '1px solid rgba(255, 166, 107, 0.25)',
    overflow: 'hidden',
    zIndex: 200,
    minWidth: 180,
  },
  artDropdownItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    padding: '10px 16px',
    background: 'none',
    border: 'none',
    borderBottom: '1px solid rgba(139, 90, 43, 0.06)',
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 14,
    fontWeight: 600,
    color: '#8B5A2B',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    textAlign: 'left',
  },
};

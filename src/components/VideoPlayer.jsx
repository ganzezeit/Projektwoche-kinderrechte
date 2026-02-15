import React, { useState, useRef, useEffect } from 'react';
import { audioManager } from '../utils/audioManager';
import { playSuccessSound } from '../utils/audio';

export default function VideoPlayer({ step, dayColor, onComplete }) {
  const { content } = step;
  const [error, setError] = useState(false);
  const [ended, setEnded] = useState(false);
  const videoRef = useRef(null);

  // Pause music while playing video
  useEffect(() => {
    audioManager.pause();
    return () => audioManager.resumeMenu();
  }, []);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') { playSuccessSound(); onComplete(); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onComplete]);

  // Set start time once video is loaded
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const handleLoaded = () => {
      if (content.startTime) video.currentTime = content.startTime;
    };
    video.addEventListener('loadedmetadata', handleLoaded);
    return () => video.removeEventListener('loadedmetadata', handleLoaded);
  }, [content.startTime]);

  // Watch for endTime
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !content.endTime) return;
    const handleTime = () => {
      if (video.currentTime >= content.endTime) {
        video.pause();
        setEnded(true);
      }
    };
    video.addEventListener('timeupdate', handleTime);
    return () => video.removeEventListener('timeupdate', handleTime);
  }, [content.endTime]);

  const handleEnd = () => setEnded(true);
  const handleDone = () => { playSuccessSound(); onComplete(); };

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.errorArea}>
          <span style={{ fontSize: 56 }}>{'\u{1F3AC}'}</span>
          <p style={styles.errorText}>Datei wird noch hinzugef{'\u00fc'}gt:</p>
          <p style={styles.errorFile}>{content.src}</p>
          <button onClick={handleDone} style={{ ...styles.doneBtn, background: dayColor }}>
            Zur{'\u00fc'}ck
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Close button */}
      <button onClick={(e) => { e.stopPropagation(); handleDone(); }} style={styles.closeBtn}>{'\u2715'}</button>

      <div style={styles.videoArea}>
        <video
          ref={videoRef}
          src={content.src}
          style={styles.video}
          controls
          controlsList="nodownload"
          autoPlay
          onEnded={handleEnd}
          onError={() => setError(true)}
        />
      </div>

      <div style={styles.bottomBar}>
        {ended && (
          <div style={styles.endedBanner}>Video beendet!</div>
        )}
        <button onClick={handleDone} style={{ ...styles.doneBtn, background: dayColor }}>
          {ended ? 'Weiter \u2705' : 'Zur\u00fcck'}
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    position: 'fixed',
    inset: 0,
    background: '#000',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
  },
  closeBtn: {
    position: 'fixed',
    top: 16,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.2)',
    border: 'none',
    fontSize: 20,
    color: 'white',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
  },
  videoArea: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    padding: '16px 24px',
  },
  video: {
    width: '100%',
    maxHeight: 'calc(100vh - 100px)',
    maxWidth: 1100,
    objectFit: 'contain',
    background: '#000',
    borderRadius: 12,
  },
  bottomBar: {
    height: 56,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    background: 'rgba(0,0,0,0.5)',
    width: '100%',
  },
  endedBanner: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: 600,
  },
  doneBtn: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 18,
    padding: '8px 30px',
    color: 'white',
    borderRadius: 24,
    border: 'none',
    cursor: 'pointer',
  },
  errorArea: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 14,
    padding: 40,
  },
  errorText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 18,
    fontFamily: "'Fredoka', sans-serif",
    fontWeight: 500,
  },
  errorFile: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 15,
    fontFamily: 'monospace',
    background: 'rgba(255,255,255,0.05)',
    padding: '6px 14px',
    borderRadius: 8,
  },
};

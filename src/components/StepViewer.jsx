import React, { useState } from 'react';
import ActivityScreen from './ActivityScreen';
import SlideViewer from './SlideViewer';
import VideoPlayer from './VideoPlayer';
import MultiStepViewer from './MultiStepViewer';
import GlossaryTooltip from './GlossaryTooltip';
import { playClickSound, playSuccessSound } from '../utils/audio';

export default function StepViewer({ step, dayColor, onComplete, onBack }) {
  // Music pause/resume is now handled by individual fullscreen viewers
  // (VideoPlayer, SlideViewer, LandeskundeViewer, EnergizerScreen)

  switch (step.type) {
    case 'slides':
      return <SlideViewer step={step} dayColor={dayColor} onComplete={onComplete} />;
    case 'video':
      return <VideoPlayer step={step} dayColor={dayColor} onComplete={onComplete} />;
    case 'multi-step':
      return <MultiStepViewer step={step} dayColor={dayColor} onComplete={onComplete} onBack={onBack} />;
    case 'kahoot':
      return <ExternalLink step={step} dayColor={dayColor} onComplete={onComplete} type="kahoot" />;
    case 'meet':
      return <ExternalLink step={step} dayColor={dayColor} onComplete={onComplete} type="meet" />;
    case 'activity':
    default:
      return <ActivityScreen step={step} dayColor={dayColor} onComplete={onComplete} />;
  }
}

function ExternalLink({ step, dayColor, onComplete, type }) {
  const [opened, setOpened] = useState(false);
  const { content } = step;

  const handleOpen = () => {
    playClickSound();
    window.open(content.url, '_blank');
    setOpened(true);
  };

  const handleReturn = () => {
    playSuccessSound();
    onComplete();
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <span style={{ fontSize: 56 }}>
          {type === 'meet' ? '\u{1F4F9}' : '\u{1F3AF}'}
        </span>
        <h2 style={{ ...styles.title, color: dayColor }}>
          {step.title}
        </h2>
        {content.description && (
          <p style={styles.desc}><GlossaryTooltip text={content.description} /></p>
        )}
        {!opened ? (
          <button onClick={handleOpen} style={{ ...styles.openBtn, background: dayColor }}>
            {content.label || '\u00d6ffnen'} {'\u{1F517}'}
          </button>
        ) : (
          <div style={styles.returnArea}>
            <p style={styles.waitText}>
              {type === 'meet' ? 'Video-Call l\u00e4uft...' : 'Kahoot l\u00e4uft...'}
            </p>
            <button onClick={handleReturn} style={{ ...styles.returnBtn, background: '#00C48C' }}>
              Zur{'\u00fc'}ck zur App {'\u2705'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(255, 250, 245, 0.7)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1500,
    padding: 40,
  },
  card: {
    background: 'rgba(255, 255, 255, 0.85)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    borderRadius: 24,
    padding: '40px 48px',
    boxShadow: '0 6px 30px rgba(0,0,0,0.1)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
    maxWidth: 500,
    textAlign: 'center',
    animation: 'popIn 0.4s ease-out',
  },
  title: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 28,
  },
  desc: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 20,
    color: '#444',
    fontWeight: 600,
    lineHeight: 1.5,
  },
  openBtn: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 22,
    padding: '14px 44px',
    color: 'white',
    borderRadius: 40,
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
    marginTop: 8,
  },
  returnArea: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
    marginTop: 8,
  },
  waitText: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 18,
    color: '#777',
    fontWeight: 600,
    animation: 'pulse 2s ease-in-out infinite',
  },
  returnBtn: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 22,
    padding: '14px 44px',
    color: 'white',
    borderRadius: 40,
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
    animation: 'pulse 2s ease-in-out infinite',
  },
};

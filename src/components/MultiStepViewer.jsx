import React, { useState } from 'react';
import GlossaryTooltip from './GlossaryTooltip';
import LandeskundeViewer from './LandeskundeViewer';
import MatchingGameSubStep from './MatchingGameSubStep';
import SlideViewer from './SlideViewer';
import VideoPlayer from './VideoPlayer';
import { playClickSound, playSuccessSound } from '../utils/audio';

export default function MultiStepViewer({ step, dayColor, onComplete, onBack }) {
  const { content } = step;
  const subSteps = content.subSteps || [];
  const [currentSub, setCurrentSub] = useState(0);
  const sub = subSteps[currentSub];
  const isLast = currentSub === subSteps.length - 1;

  const handleNext = () => {
    playClickSound();
    if (isLast) {
      playSuccessSound();
      onComplete();
    } else {
      setCurrentSub(prev => prev + 1);
    }
  };

  // Sub-type: landeskunde — fullscreen, no wrapper needed
  if (sub && sub.subType === 'landeskunde') {
    return <LandeskundeViewer mode="landeskunde" dayColor={dayColor} onComplete={handleNext} />;
  }

  // Sub-type: slides — fullscreen, no wrapper needed
  if (sub && sub.subType === 'slides') {
    const slideContent = sub.content || {};
    const slideStep = {
      title: sub.title,
      icon: step.icon,
      content: {
        slides: slideContent.slides || sub.slides,
        slideCount: slideContent.slideCount || sub.slideCount,
      },
    };
    return <SlideViewer step={slideStep} dayColor={dayColor} onComplete={handleNext} />;
  }

  // Sub-type: video — fullscreen, no wrapper needed
  if (sub && sub.subType === 'video') {
    const videoContent = sub.content || {};
    const videoStep = {
      title: sub.title,
      icon: step.icon,
      content: {
        src: videoContent.src || sub.src,
        startTime: videoContent.startTime ?? sub.startTime ?? 0,
        endTime: videoContent.endTime !== undefined ? videoContent.endTime : sub.endTime,
      },
    };
    return <VideoPlayer step={videoStep} dayColor={dayColor} onComplete={handleNext} />;
  }

  // Back arrow
  const backArrow = onBack ? (
    <button onClick={() => { playClickSound(); onBack(); }} style={styles.backArrow}>
      {'\u2190'}
    </button>
  ) : null;

  // Sub-type: quiz (legacy)
  if (sub && sub.subType === 'quiz') {
    return (
      <div style={styles.container}>
        {backArrow}
        <LandeskundeViewer mode="quiz" dayColor={dayColor} onComplete={handleNext} />
      </div>
    );
  }

  // Sub-type: matching-game (receives pairs from data)
  if (sub && sub.subType === 'matching-game') {
    return (
      <div style={styles.container}>
        {backArrow}
        <ProgressDots subSteps={subSteps} currentSub={currentSub} dayColor={dayColor} />
        <div style={styles.counter}>
          Schritt {currentSub + 1} von {subSteps.length}
        </div>
        <MatchingGameSubStep pairs={sub.pairs} dayColor={dayColor} onComplete={handleNext} />
        <StickyButton isLast={isLast} dayColor={dayColor} onNext={handleNext} />
      </div>
    );
  }

  // Sub-type: kahoot (external link)
  if (sub && sub.subType === 'kahoot') {
    const kahootContent = sub.content || {};
    return (
      <KahootSubStep
        sub={{ ...sub, url: kahootContent.url || sub.url, label: kahootContent.label || sub.label }}
        step={step}
        subSteps={subSteps}
        currentSub={currentSub}
        dayColor={dayColor}
        onNext={handleNext}
        onBack={onBack}
      />
    );
  }

  // Default: text/bullet sub-step
  return (
    <div style={styles.container}>
      {backArrow}
      <ProgressDots subSteps={subSteps} currentSub={currentSub} dayColor={dayColor} />
      <div style={styles.counter}>
        Schritt {currentSub + 1} von {subSteps.length}
      </div>

      <div style={styles.card} key={currentSub}>
        <h2 style={{ ...styles.title, color: dayColor }}>
          {step.icon} {sub.title}
        </h2>

        {sub.text && (
          <p style={styles.text}>
            <GlossaryTooltip text={sub.text} />
          </p>
        )}

        {sub.bullets && sub.bullets.length > 0 && (
          <ul style={styles.bullets}>
            {sub.bullets.map((b, i) => (
              <li key={i} style={{ ...styles.bullet, borderLeft: `4px solid ${dayColor}` }}>
                <GlossaryTooltip text={b} />
              </li>
            ))}
          </ul>
        )}

        {sub.note && (
          <div style={{ ...styles.note, borderColor: dayColor }}>
            <span style={{ fontSize: 16 }}>{'\u{1F4CC}'}</span>
            <GlossaryTooltip text={sub.note} />
          </div>
        )}
      </div>

      <StickyButton isLast={isLast} dayColor={dayColor} onNext={handleNext} />
    </div>
  );
}

function ProgressDots({ subSteps, currentSub, dayColor }) {
  return (
    <div style={styles.dots}>
      {subSteps.map((_, i) => (
        <div key={i} style={{
          width: 10, height: 10, borderRadius: '50%',
          background: i === currentSub ? dayColor : i < currentSub ? '#00C48C' : 'rgba(0,0,0,0.1)',
          transition: 'background 0.3s',
        }} />
      ))}
    </div>
  );
}

function StickyButton({ isLast, dayColor, onNext }) {
  return (
    <button onClick={onNext} style={{
      ...styles.nextBtn,
      background: isLast ? '#00C48C' : dayColor,
      position: 'sticky',
      bottom: 20,
    }}>
      {isLast ? 'Fertig \u2705' : 'Weiter \u2192'}
    </button>
  );
}

function KahootSubStep({ sub, step, subSteps, currentSub, dayColor, onNext, onBack }) {
  const [opened, setOpened] = useState(false);

  const handleOpen = () => {
    playClickSound();
    window.open(sub.url, '_blank');
    setOpened(true);
  };

  const handleReturn = () => {
    playSuccessSound();
    onNext();
  };

  return (
    <div style={styles.container}>
      {onBack && (
        <button onClick={() => { playClickSound(); onBack(); }} style={styles.backArrow}>
          {'\u2190'}
        </button>
      )}
      <ProgressDots subSteps={subSteps} currentSub={currentSub} dayColor={dayColor} />
      <div style={styles.counter}>
        Schritt {currentSub + 1} von {subSteps.length}
      </div>

      <div style={styles.kahootCard}>
        <span style={{ fontSize: 56 }}>{'\u{1F3AF}'}</span>
        <h2 style={{ ...styles.title, color: dayColor }}>{sub.title}</h2>
        {!opened ? (
          <button onClick={handleOpen} style={{ ...styles.nextBtn, background: dayColor }}>
            {sub.label || '\u00d6ffnen'} {'\u{1F517}'}
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <p style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 17, color: '#6B5B4B', fontWeight: 600, animation: 'pulse 2s ease-in-out infinite' }}>
              Kahoot l{'\u00e4'}uft...
            </p>
            <button onClick={handleReturn} style={{ ...styles.nextBtn, background: '#00C48C' }}>
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
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1500,
    padding: '80px 40px 40px',
    overflow: 'auto',
    background: 'rgba(255, 250, 245, 0.7)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
  },
  backArrow: {
    position: 'fixed',
    top: 72,
    left: 20,
    width: 44,
    height: 44,
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.9)',
    border: 'none',
    fontSize: 22,
    color: '#444',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  dots: {
    display: 'flex',
    gap: 8,
    marginBottom: 12,
  },
  counter: {
    fontFamily: "'Baloo 2', cursive",
    fontSize: 16,
    color: '#6B5B4B',
    fontWeight: 700,
    marginBottom: 16,
  },
  card: {
    background: 'rgba(255, 255, 255, 0.85)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    borderRadius: 22,
    padding: '32px 36px',
    maxWidth: 700,
    width: '100%',
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
    animation: 'popIn 0.35s ease-out forwards',
  },
  kahootCard: {
    background: 'white',
    borderRadius: 24,
    padding: '40px 48px',
    boxShadow: '0 6px 30px rgba(0,0,0,0.08)',
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
    fontSize: 30,
    marginBottom: 14,
    textAlign: 'center',
  },
  text: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 22,
    color: '#333',
    lineHeight: 1.6,
    fontWeight: 600,
    marginBottom: 16,
    textAlign: 'center',
  },
  bullets: {
    listStyle: 'none',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    marginBottom: 16,
  },
  bullet: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 18,
    color: '#333',
    padding: '10px 16px',
    borderRadius: 12,
    background: 'rgba(255,255,255,0.9)',
    fontWeight: 600,
  },
  note: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    padding: '10px 14px',
    borderLeft: '4px solid',
    borderRadius: '0 10px 10px 0',
    background: 'rgba(0,0,0,0.03)',
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 16,
    color: '#4A3728',
    fontWeight: 600,
    fontStyle: 'italic',
  },
  nextBtn: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 22,
    padding: '14px 46px',
    minHeight: 52,
    minWidth: 200,
    color: 'white',
    borderRadius: 40,
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
    marginTop: 24,
  },
};

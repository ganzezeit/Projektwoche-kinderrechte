import React, { useState, useEffect, useRef } from 'react';
import GlossaryTooltip from './GlossaryTooltip';
import { playClickSound, playSuccessSound } from '../utils/audio';

export default function ActivityScreen({ step, dayColor, onComplete }) {
  const { content } = step;
  const [elapsed, setElapsed] = useState(null);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const startTimer = () => {
    playClickSound();
    setElapsed(0);
    setRunning(true);
    intervalRef.current = setInterval(() => {
      setElapsed(prev => prev + 1);
    }, 1000);
  };

  const pauseTimer = () => {
    clearInterval(intervalRef.current);
    setRunning(false);
  };

  const resumeTimer = () => {
    playClickSound();
    setRunning(true);
    intervalRef.current = setInterval(() => {
      setElapsed(prev => prev + 1);
    }, 1000);
  };

  const fmt = (s) => {
    if (s === null) return '';
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`;
  };

  const handleComplete = () => {
    clearInterval(intervalRef.current);
    playSuccessSound();
    onComplete();
  };

  // Group-cards layout
  if (content.layout === 'group-cards' && content.groups) {
    return (
      <div style={styles.container}>
        <h1 style={{ ...styles.title, color: dayColor }}>
          {step.icon} {content.title}
        </h1>
        {content.text && (
          <p style={styles.text}>
            <GlossaryTooltip text={content.text} />
          </p>
        )}

        <div style={styles.groupGrid}>
          {content.groups.map((group, i) => (
            <div key={i} style={{
              ...styles.groupCard,
              borderTop: `4px solid ${dayColor}`,
              animation: `popIn 0.4s ease-out ${i * 0.08}s forwards`,
              opacity: 0,
            }}>
              {group.icon && <span style={{ fontSize: 36 }}>{group.icon}</span>}
              <div style={{ ...styles.groupName, color: dayColor }}>{group.name}</div>
              {group.members && (
                <div style={styles.groupMembers}>
                  {group.members.map((m, j) => (
                    <span key={j} style={styles.memberChip}>{m}</span>
                  ))}
                </div>
              )}
              {group.task && <p style={styles.groupTask}><GlossaryTooltip text={group.task} /></p>}
            </div>
          ))}
        </div>

        <button onClick={handleComplete} style={{ ...styles.doneBtn, background: dayColor }}>
          Fertig {'\u2705'}
        </button>
      </div>
    );
  }

  // Default activity layout
  return (
    <div style={styles.container}>
      <h1 style={{ ...styles.title, color: dayColor }}>
        {step.icon} {content.title}
      </h1>

      {content.text && (
        <p style={styles.text}>
          <GlossaryTooltip text={content.text} />
        </p>
      )}

      {content.bullets && content.bullets.length > 0 && (
        <ul style={styles.bullets}>
          {content.bullets.map((b, i) => (
            <li key={i} style={{
              ...styles.bullet,
              borderLeft: `4px solid ${dayColor}`,
              animation: `slideInLeft 0.4s ease-out ${0.15 + i * 0.08}s forwards`,
              opacity: 0,
            }}>
              <GlossaryTooltip text={b} />
            </li>
          ))}
        </ul>
      )}

      {content.image && (
        <img
          src={content.image}
          alt=""
          style={styles.image}
          onError={e => { e.target.style.display = 'none'; }}
        />
      )}

      {/* Count-up elapsed timer */}
      {step.energyCost >= 10 && (
        <div style={styles.timerArea}>
          {elapsed !== null && (
            <div style={{
              fontFamily: "'Baloo 2', cursive",
              fontSize: 48,
              fontWeight: 800,
              color: '#333',
            }}>
              {fmt(elapsed)}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            {elapsed === null && (
              <button onClick={startTimer} style={{ ...styles.timerBtn, background: dayColor }}>
                {'\u23F1'} Timer starten
              </button>
            )}
            {elapsed !== null && !running && (
              <button onClick={resumeTimer} style={{ ...styles.timerBtn, background: dayColor }}>
                {'\u25B6'} Weiter
              </button>
            )}
            {running && (
              <button onClick={pauseTimer} style={{ ...styles.timerBtn, background: '#FFB347' }}>
                {'\u23F8'} Pause
              </button>
            )}
          </div>
        </div>
      )}

      <button onClick={handleComplete} style={{ ...styles.doneBtn, background: dayColor }}>
        Fertig {'\u2705'}
      </button>
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
  title: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 40,
    marginBottom: 16,
    textAlign: 'center',
    animation: 'slideUp 0.4s ease-out',
  },
  text: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 24,
    color: '#333',
    textAlign: 'center',
    maxWidth: 750,
    lineHeight: 1.6,
    fontWeight: 600,
    marginBottom: 20,
    animation: 'slideUp 0.4s ease-out 0.1s forwards',
    opacity: 0,
  },
  bullets: {
    listStyle: 'none',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    marginBottom: 24,
    maxWidth: 650,
    width: '100%',
  },
  bullet: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 20,
    color: '#333',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    background: 'rgba(255, 255, 255, 0.9)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    padding: '12px 20px',
    borderRadius: 14,
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    fontWeight: 600,
  },
  image: {
    maxWidth: 450,
    maxHeight: 280,
    borderRadius: 16,
    marginBottom: 20,
    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
  },
  timerArea: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  timerBtn: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 16,
    fontWeight: 600,
    padding: '8px 22px',
    color: 'white',
    borderRadius: 20,
    border: 'none',
    cursor: 'pointer',
  },
  doneBtn: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 24,
    padding: '14px 50px',
    color: 'white',
    borderRadius: 40,
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
    animation: 'fadeIn 0.5s ease-out 0.4s forwards',
    opacity: 0,
  },
  groupGrid: {
    display: 'flex',
    gap: 16,
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 24,
    maxWidth: 900,
  },
  groupCard: {
    background: 'white',
    borderRadius: 16,
    padding: '20px 24px',
    minWidth: 180,
    maxWidth: 250,
    boxShadow: '0 3px 16px rgba(0,0,0,0.06)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    textAlign: 'center',
  },
  groupName: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 20,
  },
  groupMembers: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
  },
  memberChip: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 16,
    fontWeight: 600,
    padding: '4px 12px',
    background: '#F5F5F5',
    borderRadius: 12,
    color: '#4A3728',
  },
  groupTask: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 16,
    color: '#555',
    fontWeight: 600,
    fontStyle: 'italic',
    marginTop: 4,
  },
};

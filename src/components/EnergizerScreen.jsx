import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ENERGIZERS } from '../data/energizers';
import { audioManager } from '../utils/audioManager';
import { playClickSound, playSuccessSound } from '../utils/audio';
import { ENERGIZER_RESTORE_MIN, ENERGIZER_RESTORE_MAX } from '../utils/constants';
import GlossaryTooltip from './GlossaryTooltip';

export default function EnergizerScreen({ usedEnergizers, dayColor, onComplete }) {
  const [phase, setPhase] = useState('pick');
  const [selected, setSelected] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef(null);

  const options = useMemo(() => {
    let available = ENERGIZERS.filter(e => !usedEnergizers.includes(e.id));
    if (available.length < 3) available = [...ENERGIZERS];
    const shuffled = [...available].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 3);
  }, [usedEnergizers]);

  // Pause menu music on mount; cleanup on unmount
  useEffect(() => {
    audioManager.pause();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      audioManager.stopCurrent();
      audioManager.playMenu();
    };
  }, []);

  const handleSelect = (e) => {
    playClickSound();
    setSelected(e);
    setTimeLeft(e.duration);
    setPhase('active');
  };

  const startTimer = () => {
    playClickSound();
    setRunning(true);
    audioManager.playEnergizer();
    intervalRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current);
          setRunning(false);
          audioManager.stopCurrent();
          playSuccessSound();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const pauseTimer = () => {
    clearInterval(intervalRef.current);
    setRunning(false);
    audioManager.pause();
  };

  const addTime = (seconds) => {
    playClickSound();
    setTimeLeft(prev => Math.max(0, prev + seconds));
  };

  const handleFinish = () => {
    clearInterval(intervalRef.current);
    setRunning(false);
    audioManager.stopCurrent();
    playSuccessSound();
    setPhase('done');
  };

  const handleDone = () => {
    const reward = ENERGIZER_RESTORE_MIN + Math.floor(Math.random() * (ENERGIZER_RESTORE_MAX - ENERGIZER_RESTORE_MIN + 1));
    onComplete({ ...selected, energyReward: reward });
  };

  const fmt = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div style={styles.container}>
      {phase === 'pick' && (
        <>
          <h1 style={styles.heading}>{'\u26A1'} Energizer-Zeit!</h1>
          <p style={styles.sub}>W{'\u00e4'}hlt einen Energizer aus!</p>
          <div style={styles.options}>
            {options.map((e, i) => (
              <button
                key={e.id}
                onClick={() => handleSelect(e)}
                style={{
                  ...styles.optionCard,
                  animation: `popIn 0.4s ease-out ${i * 0.12}s forwards`,
                  opacity: 0,
                }}
              >
                <span style={{ fontSize: 44 }}>{e.emoji}</span>
                <span style={{ ...styles.optName, color: dayColor }}>{e.name}</span>
                <span style={styles.optDesc}>{e.description}</span>
                <span style={styles.optDur}>{Math.ceil(e.duration / 60)} Min.</span>
              </button>
            ))}
          </div>
        </>
      )}

      {phase === 'active' && selected && (
        <div style={styles.activeArea}>
          <span style={{ fontSize: 72, animation: 'bounce 0.8s ease-out' }}>{selected.emoji}</span>
          <h1 style={{ ...styles.heading, color: dayColor }}>{selected.name}</h1>
          <p style={styles.activeDesc}><GlossaryTooltip text={selected.description} /></p>
          <div style={{
            ...styles.timer,
            color: timeLeft === 0 ? '#AFFFAA' : 'white',
            animation: running ? 'pulse 1s ease-in-out infinite' : 'none',
          }}>
            {fmt(timeLeft)}
          </div>

          {/* +1min / -1min teacher buttons */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <button onClick={() => addTime(-60)} style={styles.timeAdjBtn}>-1 Min</button>
            <button onClick={() => addTime(60)} style={styles.timeAdjBtn}>+1 Min</button>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            {!running && timeLeft > 0 && (
              <button onClick={startTimer} style={{ ...styles.actionBtn, background: dayColor }}>
                {'\u25B6'} Start!
              </button>
            )}
            {running && (
              <button onClick={pauseTimer} style={{ ...styles.actionBtn, background: '#FFB347' }}>
                {'\u23F8'} Pause
              </button>
            )}
            <button onClick={handleFinish} style={styles.skipBtn}>
              {timeLeft === 0 ? 'Fertig! \u2705' : '\u23ED Fertig'}
            </button>
          </div>
        </div>
      )}

      {phase === 'done' && selected && (
        <div style={{ ...styles.activeArea, animation: 'popIn 0.5s ease-out' }}>
          <span style={{ fontSize: 72 }}>{'\u{1F389}'}</span>
          <h1 style={{ ...styles.heading, color: '#AFFFAA' }}>Super gemacht!</h1>
          <p style={styles.activeDesc}>Energie wird aufgeladen!</p>
          <button onClick={handleDone} style={{ ...styles.actionBtn, background: '#00C48C', fontSize: 22, padding: '14px 50px' }}>
            Weiter! {'\u{1F680}'}
          </button>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    position: 'fixed',
    inset: 0,
    background: 'linear-gradient(135deg, #FF6B35 0%, #FF8E53 25%, #FFB347 50%, #FF6B6B 75%, #FF5E7D 100%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
    padding: 40,
    overflow: 'hidden',
  },
  heading: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 38,
    color: 'white',
    textShadow: '0 2px 8px rgba(0,0,0,0.2)',
    marginBottom: 6,
    textAlign: 'center',
  },
  sub: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 20,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: 600,
    marginBottom: 28,
    textShadow: '0 1px 4px rgba(0,0,0,0.15)',
  },
  options: {
    display: 'flex',
    gap: 20,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  optionCard: {
    width: 240,
    padding: 22,
    background: 'rgba(255,255,255,0.9)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    borderRadius: 20,
    boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    cursor: 'pointer',
    border: '2px solid rgba(255,255,255,0.5)',
    transition: 'all 0.2s ease',
  },
  optName: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 18,
  },
  optDesc: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 16,
    color: '#4A3728',
    textAlign: 'center',
    lineHeight: 1.4,
    fontWeight: 600,
  },
  optDur: {
    fontFamily: "'Baloo 2', cursive",
    fontSize: 15,
    color: '#6B5B4B',
    fontWeight: 700,
  },
  activeArea: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 14,
  },
  activeDesc: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 20,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    maxWidth: 550,
    lineHeight: 1.5,
    fontWeight: 600,
    textShadow: '0 1px 4px rgba(0,0,0,0.15)',
  },
  timer: {
    fontFamily: "'Baloo 2', cursive",
    fontSize: 64,
    fontWeight: 800,
    color: 'white',
    textShadow: '0 2px 8px rgba(0,0,0,0.2)',
  },
  timeAdjBtn: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 14,
    fontWeight: 600,
    padding: '6px 16px',
    background: 'rgba(255,255,255,0.25)',
    color: 'white',
    borderRadius: 16,
    border: 'none',
    cursor: 'pointer',
    textShadow: '0 1px 2px rgba(0,0,0,0.15)',
  },
  actionBtn: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 20,
    padding: '12px 36px',
    color: 'white',
    borderRadius: 30,
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
  },
  skipBtn: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 16,
    fontWeight: 600,
    padding: '12px 24px',
    background: 'rgba(255,255,255,0.25)',
    color: 'white',
    borderRadius: 30,
    border: 'none',
    cursor: 'pointer',
    textShadow: '0 1px 2px rgba(0,0,0,0.15)',
  },
};

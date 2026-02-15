import React, { useState, useMemo } from 'react';
import { ENERGIZERS } from '../data/energizers';
import { playClickSound, playSuccessSound } from '../utils/audio';
import GlossaryTooltip from './GlossaryTooltip';

export default function DayIntroScreen({ day, onContinue }) {
  const { dayIntro } = day;
  const [phase, setPhase] = useState('recap');
  const [statementIdx, setStatementIdx] = useState(-1);

  // Support useRandom: pick a random energizer from pool
  const randomEnergizer = useMemo(() => {
    if (dayIntro?.energizer?.useRandom && ENERGIZERS.length > 0) {
      const idx = Math.floor(Math.random() * ENERGIZERS.length);
      return ENERGIZERS[idx];
    }
    return null;
  }, [dayIntro]);

  if (!dayIntro) { onContinue(); return null; }

  const hasEnergizer = dayIntro.energizer && (dayIntro.energizer.statements || dayIntro.energizer.useRandom);

  const handleRecapDone = () => {
    playClickSound();
    if (hasEnergizer) {
      setPhase('energizer');
    } else {
      playSuccessSound();
      onContinue();
    }
  };

  // For useRandom energizer: just show info and continue
  if (phase === 'energizer' && dayIntro.energizer?.useRandom && randomEnergizer) {
    return (
      <div style={styles.container}>
        <div style={styles.content}>
          <span style={{ fontSize: 64, marginBottom: 12 }}>{randomEnergizer.emoji}</span>
          <h1 style={{ ...styles.title, color: day.color }}>
            {'\u26A1'} Energizer: {randomEnergizer.name}
          </h1>
          <p style={styles.text}><GlossaryTooltip text={randomEnergizer.description} /></p>
          <p style={styles.subText}>
            {Math.ceil(randomEnergizer.duration / 60)} Minuten
          </p>
          <button onClick={() => { playSuccessSound(); onContinue(); }} style={{ ...styles.button, background: day.color }}>
            Weiter {'\u2192'}
          </button>
        </div>
      </div>
    );
  }

  const handleEnergizerStart = () => {
    playClickSound();
    setStatementIdx(0);
  };

  const handleNextStatement = () => {
    playClickSound();
    if (statementIdx < dayIntro.energizer.statements.length - 1) {
      setStatementIdx(prev => prev + 1);
    } else {
      playSuccessSound();
      onContinue();
    }
  };

  return (
    <div style={styles.container}>
      {phase === 'recap' && dayIntro.recap && (
        <div style={styles.content}>
          <span style={{ fontSize: 56, marginBottom: 16 }}>{day.emoji}</span>
          <h1 style={{ ...styles.title, color: day.color }}>
            {dayIntro.recap.title}
          </h1>
          <p style={styles.text}><GlossaryTooltip text={dayIntro.recap.text} /></p>
          <button onClick={handleRecapDone} style={{ ...styles.button, background: day.color }}>
            {hasEnergizer ? 'Weiter zum Energizer \u2192' : 'Weiter \u2192'}
          </button>
        </div>
      )}

      {phase === 'energizer' && dayIntro.energizer && dayIntro.energizer.statements && (
        <div style={styles.content}>
          <h1 style={{ ...styles.title, color: day.color }}>
            {'\u26A1'} {dayIntro.energizer.title}
          </h1>
          <p style={styles.text}><GlossaryTooltip text={dayIntro.energizer.text} /></p>

          {statementIdx < 0 ? (
            <button onClick={handleEnergizerStart} style={{ ...styles.button, background: day.color }}>
              Aussagen starten {'\u{1F680}'}
            </button>
          ) : (
            <div style={styles.statementArea}>
              <div style={styles.counter}>
                {statementIdx + 1} / {dayIntro.energizer.statements.length}
              </div>
              <div style={styles.statementCard} key={statementIdx}>
                <p style={styles.statementText}>
                  &ldquo;{dayIntro.energizer.statements[statementIdx]}&rdquo;
                </p>
              </div>
              <button onClick={handleNextStatement} style={{ ...styles.button, background: day.color }}>
                {statementIdx < dayIntro.energizer.statements.length - 1
                  ? 'N\u00e4chste Aussage \u2192'
                  : 'Fertig \u2705'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    position: 'fixed',
    inset: 0,
    background: 'linear-gradient(160deg, #FFFAF5 0%, #F0F4FB 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1500,
    padding: 40,
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
    maxWidth: 650,
    animation: 'fadeIn 0.4s ease-out',
  },
  title: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 36,
    textAlign: 'center',
  },
  text: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 22,
    color: '#555',
    textAlign: 'center',
    lineHeight: 1.6,
    fontWeight: 500,
    marginBottom: 8,
  },
  subText: {
    fontFamily: "'Baloo 2', cursive",
    fontSize: 18,
    color: '#aaa',
    fontWeight: 700,
  },
  button: {
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
  statementArea: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
  },
  counter: {
    fontFamily: "'Baloo 2', cursive",
    fontSize: 16,
    color: '#aaa',
    fontWeight: 700,
  },
  statementCard: {
    background: 'white',
    borderRadius: 20,
    padding: '28px 40px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
    animation: 'popIn 0.3s ease-out forwards',
  },
  statementText: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 26,
    color: '#2D2D2D',
    textAlign: 'center',
    fontWeight: 600,
    lineHeight: 1.4,
  },
};

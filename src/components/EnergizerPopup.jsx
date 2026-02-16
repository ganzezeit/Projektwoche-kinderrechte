import React, { useState, useCallback } from 'react';
import { ENERGIZERS } from '../data/energizers';
import { playClickSound } from '../utils/audio';

function pickRandom3() {
  const shuffled = [...ENERGIZERS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3);
}

export default function EnergizerPopup({ onSelect, onClose }) {
  const [options, setOptions] = useState(() => pickRandom3());

  const handleReshuffle = useCallback(() => {
    playClickSound();
    setOptions(pickRandom3());
  }, []);

  const handleSelect = useCallback((energizer) => {
    playClickSound();
    onSelect(energizer);
  }, [onSelect]);

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <button onClick={onClose} style={styles.closeBtn}>{'\u2715'}</button>

        <h2 style={styles.title}>{'\u26A1'} Energizer-Pause!</h2>
        <p style={styles.subtitle}>W\u00e4hle einen Energizer:</p>

        <div style={styles.cards}>
          {options.map((e, i) => (
            <div
              key={e.id}
              style={{
                ...styles.card,
                animation: `popIn 0.4s ease-out ${i * 0.1}s forwards`,
                opacity: 0,
              }}
            >
              <span style={{ fontSize: 44 }}>{e.emoji}</span>
              <span style={styles.cardName}>{e.name}</span>
              <span style={styles.cardDesc}>{e.description}</span>
              <span style={styles.cardDur}>{Math.ceil(e.duration / 60)} Min.</span>
              <button
                onClick={() => handleSelect(e)}
                style={styles.goBtn}
              >
                Los geht's!
              </button>
            </div>
          ))}
        </div>

        <button onClick={handleReshuffle} style={styles.reshuffleBtn}>
          {'\uD83D\uDD00'} Neue Auswahl
        </button>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5000,
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
  },
  modal: {
    background: 'linear-gradient(160deg, #FFF8F0 0%, #FFE5D9 50%, #D4E4F7 100%)',
    borderRadius: 24,
    padding: '32px 36px',
    maxWidth: 820,
    width: '90%',
    position: 'relative',
    boxShadow: '0 8px 40px rgba(139, 90, 43, 0.2)',
    border: '2px solid rgba(255, 166, 107, 0.3)',
    textAlign: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 16,
    background: 'none',
    border: 'none',
    fontSize: 24,
    color: '#8B5A2B',
    cursor: 'pointer',
    padding: 4,
    lineHeight: 1,
  },
  title: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 32,
    color: '#FF6B35',
    margin: '0 0 4px 0',
    textShadow: '0 1px 4px rgba(255, 107, 53, 0.2)',
  },
  subtitle: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 18,
    color: '#6B5B4B',
    fontWeight: 600,
    margin: '0 0 24px 0',
  },
  cards: {
    display: 'flex',
    gap: 18,
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  card: {
    width: 220,
    padding: 20,
    background: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 18,
    boxShadow: '0 3px 16px rgba(139, 90, 43, 0.1)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    border: '2px solid rgba(255, 166, 107, 0.2)',
  },
  cardName: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 17,
    color: '#FF6B35',
  },
  cardDesc: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 14,
    color: '#4A3728',
    textAlign: 'center',
    lineHeight: 1.4,
    fontWeight: 500,
  },
  cardDur: {
    fontFamily: "'Baloo 2', cursive",
    fontSize: 14,
    color: '#6B5B4B',
    fontWeight: 700,
  },
  goBtn: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 16,
    padding: '8px 24px',
    color: 'white',
    background: 'linear-gradient(135deg, #FF6B35, #FF8E53)',
    borderRadius: 20,
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 3px 10px rgba(255, 107, 53, 0.3)',
    marginTop: 4,
  },
  reshuffleBtn: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 16,
    fontWeight: 600,
    padding: '10px 24px',
    background: 'rgba(255, 255, 255, 0.7)',
    color: '#8B5A2B',
    borderRadius: 20,
    border: '2px solid rgba(139, 90, 43, 0.15)',
    cursor: 'pointer',
  },
};

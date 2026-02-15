import React, { useState } from 'react';
import { PROJEKTREGELN } from '../data/projektregeln';
import { playClickSound, playSuccessSound } from '../utils/audio';

export default function ProjektregelnScreen({ onContinue }) {
  const [flipped, setFlipped] = useState({});
  const allFlipped = PROJEKTREGELN.every(r => flipped[r.id]);

  const handleFlip = (id) => {
    playClickSound();
    setFlipped(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleContinue = () => {
    playSuccessSound();
    onContinue();
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.heading}>
        {'\u{1F4DC}'} Unsere Regeln f{'\u00fc'}r die Projektwoche
      </h1>
      <p style={styles.sub}>Tippe auf jede Karte, um sie umzudrehen!</p>

      <div style={styles.grid}>
        {PROJEKTREGELN.map((regel, i) => {
          const isFlipped = !!flipped[regel.id];
          return (
            <div
              key={regel.id}
              style={{
                ...styles.cardWrapper,
                animation: `popIn 0.4s ease-out ${i * 0.12}s forwards`,
                opacity: 0,
              }}
              onClick={() => handleFlip(regel.id)}
            >
              <div style={{
                ...styles.cardInner,
                transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
              }}>
                {/* Front */}
                <div style={{
                  ...styles.cardFace,
                  ...styles.cardFront,
                  borderTop: `5px solid ${regel.color}`,
                }}>
                  <span style={{ fontSize: 48 }}>{regel.emoji}</span>
                  <span style={{ ...styles.frontText, color: regel.color }}>
                    {regel.front}
                  </span>
                </div>
                {/* Back */}
                <div style={{
                  ...styles.cardFace,
                  ...styles.cardBack,
                  background: `linear-gradient(135deg, ${regel.color}15, ${regel.color}08)`,
                  borderTop: `5px solid ${regel.color}`,
                }}>
                  <span style={styles.backText}>{regel.back}</span>
                  <span style={{ fontSize: 12, color: '#aaa', marginTop: 8 }}>{'\u2705'} Verstanden!</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {allFlipped && (
        <button onClick={handleContinue} style={styles.button}>
          Weiter {'\u2192'}
        </button>
      )}
    </div>
  );
}

const styles = {
  container: {
    position: 'fixed',
    inset: 0,
    background: 'linear-gradient(160deg, #FFF5EE 0%, #E8F0FE 100%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
    padding: 40,
    overflow: 'auto',
  },
  heading: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 36,
    color: '#2D2D2D',
    marginBottom: 6,
    textAlign: 'center',
  },
  sub: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 18,
    color: '#888',
    fontWeight: 500,
    marginBottom: 32,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 260px)',
    gap: 20,
    marginBottom: 32,
  },
  cardWrapper: {
    width: 260,
    height: 180,
    perspective: 800,
    cursor: 'pointer',
  },
  cardInner: {
    width: '100%',
    height: '100%',
    position: 'relative',
    transformStyle: 'preserve-3d',
    transition: 'transform 0.5s ease',
  },
  cardFace: {
    position: 'absolute',
    inset: 0,
    backfaceVisibility: 'hidden',
    WebkitBackfaceVisibility: 'hidden',
    borderRadius: 18,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    boxShadow: '0 3px 16px rgba(0,0,0,0.08)',
  },
  cardFront: {
    background: 'white',
    gap: 10,
  },
  cardBack: {
    transform: 'rotateY(180deg)',
  },
  frontText: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 24,
  },
  backText: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 17,
    color: '#333',
    textAlign: 'center',
    lineHeight: 1.5,
    fontWeight: 500,
  },
  button: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 24,
    padding: '14px 50px',
    background: 'linear-gradient(135deg, #9B5DE5, #C77DFF)',
    color: 'white',
    borderRadius: 40,
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 4px 20px rgba(155,93,229,0.3)',
    animation: 'popIn 0.4s ease-out forwards',
  },
};

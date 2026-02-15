import React, { useState, useMemo, useEffect } from 'react';
import { LERNKARTEN } from '../data/lernkarten';
import { playClickSound, playSuccessSound, playWrongSound, playCompleteSound } from '../utils/audio';

export default function LernkartenGame({ onComplete }) {
  // Build card pairs: each entry becomes two cards (word + definition)
  const cards = useMemo(() => {
    const pairs = [];
    LERNKARTEN.forEach((item, idx) => {
      pairs.push({ id: `w-${idx}`, pairId: idx, text: item.word, type: 'word' });
      pairs.push({ id: `d-${idx}`, pairId: idx, text: item.definition, type: 'def' });
    });
    // Shuffle
    for (let i = pairs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
    }
    return pairs;
  }, []);

  const [flipped, setFlipped] = useState([]);
  const [matched, setMatched] = useState([]);
  const [checking, setChecking] = useState(false);
  const allMatched = matched.length === LERNKARTEN.length * 2;

  const handleCardClick = (card) => {
    if (checking) return;
    if (flipped.includes(card.id)) return;
    if (matched.includes(card.id)) return;

    playClickSound();
    const newFlipped = [...flipped, card.id];
    setFlipped(newFlipped);

    if (newFlipped.length === 2) {
      setChecking(true);
      const first = cards.find(c => c.id === newFlipped[0]);
      const second = cards.find(c => c.id === newFlipped[1]);

      if (first.pairId === second.pairId && first.type !== second.type) {
        // Match!
        setTimeout(() => {
          playSuccessSound();
          setMatched(prev => [...prev, first.id, second.id]);
          setFlipped([]);
          setChecking(false);
        }, 600);
      } else {
        // No match
        setTimeout(() => {
          playWrongSound();
          setFlipped([]);
          setChecking(false);
        }, 1000);
      }
    }
  };

  useEffect(() => {
    if (allMatched) {
      setTimeout(() => playCompleteSound(), 300);
    }
  }, [allMatched]);

  return (
    <div style={styles.container}>
      <h1 style={styles.heading}>
        {'\u{1F9E9}'} Lernkarten-Memory
      </h1>
      <p style={styles.sub}>Finde die passenden Paare! Wort + Bedeutung</p>

      {/* Skip button */}
      {!allMatched && (
        <button
          onClick={() => { playClickSound(); onComplete(); }}
          style={styles.skipBtn}
        >
          {'\u00dc'}berspringen {'\u23ED'}
        </button>
      )}

      {!allMatched && (
        <div style={styles.grid}>
          {cards.map((card) => {
            const isFlipped = flipped.includes(card.id);
            const isMatched = matched.includes(card.id);
            const showFace = isFlipped || isMatched;

            return (
              <div
                key={card.id}
                onClick={() => handleCardClick(card)}
                style={{
                  ...styles.card,
                  ...(showFace ? styles.cardRevealed : {}),
                  ...(isMatched ? styles.cardMatched : {}),
                  ...(card.type === 'word' && showFace ? styles.wordCard : {}),
                  ...(card.type === 'def' && showFace ? styles.defCard : {}),
                  cursor: isMatched ? 'default' : 'pointer',
                }}
              >
                {showFace ? (
                  <span style={{
                    ...styles.cardText,
                    fontSize: card.type === 'word' ? 18 : 15,
                    fontWeight: card.type === 'word' ? 700 : 500,
                  }}>
                    {card.text}
                  </span>
                ) : (
                  <span style={styles.cardBack}>?</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {allMatched && (
        <div style={styles.doneArea}>
          <span style={{ fontSize: 64 }}>{'\u{1F389}'}</span>
          <p style={styles.doneText}>Alle Paare gefunden! Super!</p>
          <button onClick={onComplete} style={styles.doneButton}>
            Zur Karte! {'\u{1F5FA}\uFE0F'}
          </button>
        </div>
      )}

      <div style={styles.matchCount}>
        {matched.length / 2} / {LERNKARTEN.length} Paare
      </div>
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
    padding: 32,
    overflow: 'auto',
  },
  heading: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 36,
    color: '#2D2D2D',
    marginBottom: 4,
    textAlign: 'center',
  },
  sub: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 18,
    color: '#5A4A3A',
    fontWeight: 600,
    marginBottom: 24,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(6, 140px)',
    gap: 10,
    maxWidth: 900,
  },
  card: {
    width: 140,
    height: 90,
    borderRadius: 14,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #FF6B35, #FF8C42)',
    boxShadow: '0 3px 12px rgba(0,0,0,0.1)',
    transition: 'transform 0.3s ease, box-shadow 0.3s ease',
    padding: 8,
  },
  cardRevealed: {
    background: 'white',
    boxShadow: '0 3px 16px rgba(0,0,0,0.08)',
  },
  cardMatched: {
    background: '#E8F5E9',
    opacity: 0.85,
    transform: 'scale(0.97)',
  },
  wordCard: {
    borderBottom: '3px solid #00B4D8',
  },
  defCard: {
    borderBottom: '3px solid #9B5DE5',
  },
  cardText: {
    fontFamily: "'Fredoka', sans-serif",
    color: '#333',
    textAlign: 'center',
    lineHeight: 1.3,
  },
  cardBack: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 28,
    color: 'white',
  },
  matchCount: {
    fontFamily: "'Baloo 2', cursive",
    fontSize: 16,
    color: '#6B5B4B',
    fontWeight: 700,
    marginTop: 20,
  },
  doneArea: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
    animation: 'popIn 0.5s ease-out forwards',
  },
  doneText: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 28,
    color: '#2D2D2D',
    fontWeight: 600,
  },
  skipBtn: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 16,
    fontWeight: 600,
    padding: '6px 16px',
    color: '#6B5B4B',
    background: 'rgba(255,255,255,0.9)',
    border: '1px solid #ddd',
    borderRadius: 20,
    cursor: 'pointer',
    marginBottom: 16,
  },
  doneButton: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 26,
    padding: '16px 50px',
    background: 'linear-gradient(135deg, #00C48C, #00E5A0)',
    color: 'white',
    borderRadius: 40,
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 4px 20px rgba(0,196,140,0.3)',
  },
};

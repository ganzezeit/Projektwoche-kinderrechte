import React, { useState, useMemo } from 'react';
import { playClickSound, playSuccessSound, playWrongSound, playCompleteSound } from '../utils/audio';

const DEFAULT_PAIRS = [
  { term: "Schutz", definition: "Kinder m\u00fcssen vor Gewalt gesch\u00fctzt werden" },
  { term: "Bildung", definition: "Jedes Kind hat das Recht auf Schule" },
  { term: "Gesundheit", definition: "Kinder haben das Recht auf Gesundheit" },
  { term: "Mitbestimmung", definition: "Kinder d\u00fcrfen mitbestimmen" },
  { term: "Gleichheit", definition: "Alle Kinder sind gleich viel wert" },
  { term: "Freizeit", definition: "Kinder d\u00fcrfen spielen und sich erholen" },
  { term: "Familie", definition: "Kinder haben das Recht auf eine Familie" },
  { term: "Privatsph\u00e4re", definition: "Kinder haben ein Recht auf Privatsph\u00e4re" },
];

export default function MatchingGameSubStep({ pairs, dayColor, onComplete }) {
  const gamePairs = useMemo(() => {
    const src = (pairs && pairs.length > 0) ? pairs : DEFAULT_PAIRS;
    return src.map((p, i) => ({ id: i + 1, term: p.term, definition: p.definition }));
  }, [pairs]);

  const [matched, setMatched] = useState([]);
  const [selectedLeft, setSelectedLeft] = useState(null);
  const [selectedRight, setSelectedRight] = useState(null);
  const [wrongPair, setWrongPair] = useState(null);
  const done = matched.length === gamePairs.length;

  const shuffledLeft = useMemo(() => [...gamePairs].sort(() => Math.random() - 0.5), [gamePairs]);
  const shuffledRight = useMemo(() => [...gamePairs].sort(() => Math.random() - 0.5), [gamePairs]);

  const handleLeftClick = (pair) => {
    if (matched.find(m => m.id === pair.id)) return;
    playClickSound();
    setSelectedLeft(pair);
    setWrongPair(null);
    if (selectedRight) checkMatch(pair, selectedRight);
  };

  const handleRightClick = (pair) => {
    if (matched.find(m => m.id === pair.id)) return;
    playClickSound();
    setSelectedRight(pair);
    setWrongPair(null);
    if (selectedLeft) checkMatch(selectedLeft, pair);
  };

  const checkMatch = (left, right) => {
    if (left.id === right.id) {
      playSuccessSound();
      const newMatched = [...matched, left];
      setMatched(newMatched);
      setSelectedLeft(null);
      setSelectedRight(null);
      if (newMatched.length === gamePairs.length) {
        setTimeout(() => playCompleteSound(), 300);
      }
    } else {
      playWrongSound();
      setWrongPair({ left: left.id, right: right.id });
      setTimeout(() => {
        setSelectedLeft(null);
        setSelectedRight(null);
        setWrongPair(null);
      }, 800);
    }
  };

  if (done) {
    return (
      <div style={styles.container}>
        <div style={{ ...styles.doneArea, animation: 'popIn 0.5s ease-out' }}>
          <span style={{ fontSize: 64 }}>{'\u{1F389}'}</span>
          <h2 style={{ ...styles.heading, color: '#00C48C' }}>Alle gefunden!</h2>
          <p style={styles.doneText}>Super gemacht!</p>
          <button
            onClick={() => { playSuccessSound(); onComplete(); }}
            style={{ ...styles.doneBtn, background: dayColor }}
          >
            Weiter {'\u2192'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Skip button */}
      <button
        onClick={() => { playClickSound(); onComplete(); }}
        style={styles.skipBtn}
      >
        {'\u00dc'}berspringen {'\u23ED'}
      </button>

      <h2 style={{ ...styles.heading, color: dayColor }}>
        {'\u{1F3AF}'} Zuordnen
      </h2>
      <p style={styles.sub}>
        Verbinde die Begriffe! ({matched.length}/{gamePairs.length})
      </p>

      <div style={styles.gameArea}>
        <div style={styles.column}>
          {shuffledLeft.map((pair) => {
            const isMatched = matched.find(m => m.id === pair.id);
            const isSelected = selectedLeft?.id === pair.id;
            const isWrong = wrongPair?.left === pair.id;
            return (
              <button
                key={pair.id}
                onClick={() => handleLeftClick(pair)}
                disabled={!!isMatched}
                style={{
                  ...styles.card,
                  background: isMatched ? '#E8F5E9' : isWrong ? '#FFEBEE' : isSelected ? `${dayColor}18` : 'white',
                  border: isMatched ? '2px solid #00C48C' : isWrong ? '2px solid #FF6B6B' : isSelected ? `2px solid ${dayColor}` : '2px solid #eee',
                  opacity: isMatched ? 0.6 : 1,
                  animation: isWrong ? 'shake 0.4s ease' : undefined,
                }}
              >
                <span style={styles.cardText}>{pair.term}</span>
              </button>
            );
          })}
        </div>

        <div style={styles.column}>
          {shuffledRight.map((pair) => {
            const isMatched = matched.find(m => m.id === pair.id);
            const isSelected = selectedRight?.id === pair.id;
            const isWrong = wrongPair?.right === pair.id;
            return (
              <button
                key={pair.id}
                onClick={() => handleRightClick(pair)}
                disabled={!!isMatched}
                style={{
                  ...styles.card,
                  background: isMatched ? '#E8F5E9' : isWrong ? '#FFEBEE' : isSelected ? `${dayColor}18` : 'white',
                  border: isMatched ? '2px solid #00C48C' : isWrong ? '2px solid #FF6B6B' : isSelected ? `2px solid ${dayColor}` : '2px solid #eee',
                  opacity: isMatched ? 0.6 : 1,
                  animation: isWrong ? 'shake 0.4s ease' : undefined,
                }}
              >
                <span style={styles.descText}>{pair.definition}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: 20,
    width: '100%',
  },
  heading: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 28,
    textAlign: 'center',
    marginBottom: 6,
  },
  sub: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 17,
    color: '#5A4A3A',
    fontWeight: 600,
    marginBottom: 20,
    textAlign: 'center',
  },
  gameArea: {
    display: 'flex',
    gap: 20,
    maxWidth: 800,
    width: '100%',
    justifyContent: 'center',
  },
  column: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    flex: 1,
    maxWidth: 360,
  },
  card: {
    padding: '10px 14px',
    borderRadius: 12,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    transition: 'all 0.2s ease',
    textAlign: 'left',
    minHeight: 44,
  },
  cardText: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 17,
    color: '#333',
  },
  descText: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 15,
    color: '#4A3728',
    fontWeight: 600,
    lineHeight: 1.3,
  },
  doneArea: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    padding: 40,
  },
  doneText: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 18,
    color: '#4A3728',
    fontWeight: 600,
  },
  doneBtn: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 20,
    padding: '12px 40px',
    color: 'white',
    borderRadius: 30,
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
    marginTop: 8,
  },
  skipBtn: {
    position: 'absolute',
    top: 16,
    right: 60,
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 16,
    fontWeight: 600,
    padding: '6px 16px',
    color: '#6B5B4B',
    background: 'rgba(255,255,255,0.9)',
    border: '1px solid #ddd',
    borderRadius: 20,
    cursor: 'pointer',
    zIndex: 10,
  },
};

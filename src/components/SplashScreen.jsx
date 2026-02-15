import React, { useState, useEffect, useRef } from 'react';
import AnimatedBackground from './AnimatedBackground';

const KENNENLERNEN_GAMES = [
  {
    id: 'zwei-wahrheiten',
    emoji: '🧐',
    name: 'Zwei Wahrheiten, eine Lüge',
    description: 'Erzähle 3 Dinge über dich — die Klasse rät, was die Lüge ist!',
    steps: [
      'Eine Person steht vorne.',
      'Sie sagt 3 Sätze über sich — 2 sind wahr, 1 ist gelogen.',
      'Die Klasse rät: Welcher Satz ist die Lüge?',
      'Auflösung! Dann ist die nächste Person dran.',
    ],
    tip: 'Einfache Sätze ermutigen: "Ich habe einen Hund." / "Ich mag Pizza."',
  },
  {
    id: 'aufstellung',
    emoji: '📏',
    name: 'Aufstellung',
    description: 'Stellt euch in einer Reihe auf — ohne zu sprechen!',
    steps: [
      'Alle stehen auf.',
      'Die Lehrkraft gibt eine Kategorie (z.\u202fB. Geburtstagsmonat).',
      'Stellt euch in der richtigen Reihenfolge auf — nur mit Gesten, ohne Worte!',
      'Am Ende prüft ihr gemeinsam, ob die Reihenfolge stimmt.',
    ],
    tip: 'Kategorien: Geburtstagsmonat, Schuhgröße, Anfangsbuchstabe des Vornamens, Hausnummer.',
  },
  {
    id: 'namenskette',
    emoji: '🔗',
    name: 'Namenskette',
    description: 'Sag deinen Namen mit einer Bewegung — alle machen nach!',
    steps: [
      'Alle stehen im Kreis.',
      'Die erste Person sagt ihren Namen und macht eine Bewegung dazu.',
      'Die nächste Person wiederholt alle bisherigen Namen + Bewegungen und fügt ihren eigenen hinzu.',
      'Weiter im Kreis, bis alle dran waren!',
    ],
    tip: 'Bei großen Gruppen: immer nur die letzten 3 Namen wiederholen.',
  },
  {
    id: 'plaetze-tauschen',
    emoji: '💺',
    name: 'Plätze tauschen',
    description: 'Tauscht die Plätze, wenn die Aussage auf euch zutrifft!',
    steps: [
      'Alle sitzen im Stuhlkreis.',
      'Eine Person steht in der Mitte und sagt: "Plätze tauschen, wenn..."',
      'Alle, auf die es zutrifft, stehen auf und suchen einen neuen Platz.',
      'Wer keinen Platz findet, macht die nächste Aussage.',
    ],
    tip: 'Beispiele: "...wenn du gerne Fußball spielst", "...wenn du Geschwister hast".',
  },
  {
    id: 'zip-zap-boing',
    emoji: '⚡',
    name: 'Zip Zap Boing',
    description: 'Ein schnelles Kreisspiel mit drei Kommandos!',
    steps: [
      'Alle stehen im Kreis.',
      '"Zip" — schickt den Impuls nach links weiter.',
      '"Zap" — schickt den Impuls nach rechts weiter.',
      '"Boing" — blockt und schickt den Impuls zurück.',
      'Wer zu langsam ist oder falsch reagiert, setzt eine Runde aus.',
    ],
    tip: 'Erst langsam üben, dann immer schneller werden!',
  },
];

export default function SplashScreen({ onStart }) {
  const [visible, setVisible] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [phase, setPhase] = useState('splash'); // 'splash' | 'select' | 'game'
  const [selectedGame, setSelectedGame] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  // Keyboard shortcut: Enter or Space to start (only on splash phase)
  useEffect(() => {
    if (phase !== 'splash') return;
    const handleKey = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onStart();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onStart, phase]);

  // Timer logic
  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => {
        setElapsed(prev => prev + 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerRunning]);

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const handleSelectGame = (game) => {
    setSelectedGame(game);
    setElapsed(0);
    setTimerRunning(false);
    setPhase('game');
  };

  const handleBackToSelect = () => {
    setTimerRunning(false);
    setElapsed(0);
    setSelectedGame(null);
    setPhase('select');
  };

  const handleBackToSplash = () => {
    setPhase('splash');
  };

  // ---- Phase: Game Detail ----
  if (phase === 'game' && selectedGame) {
    return (
      <div style={styles.container}>
        <AnimatedBackground
          basePath="/images/splash-background"
          fallbackGradient="radial-gradient(ellipse at 50% 30%, #FFF0E8 0%, #FFE5D9 30%, #D4E4F7 80%, #C1D9F2 100%)"
        />
        <div style={styles.content}>
          {/* Back button */}
          <button onClick={handleBackToSelect} style={styles.backButton}>
            ← Zurück
          </button>

          {/* Game emoji */}
          <div style={{ fontSize: 72, marginBottom: 12 }}>{selectedGame.emoji}</div>

          {/* Game title */}
          <h2 style={styles.gameTitle}>{selectedGame.name}</h2>

          {/* Instructions */}
          <div style={styles.instructionsCard}>
            <ol style={styles.instructionsList}>
              {selectedGame.steps.map((step, i) => (
                <li key={i} style={styles.instructionItem}>{step}</li>
              ))}
            </ol>
            {selectedGame.tip && (
              <div style={styles.tipBox}>
                <span style={{ marginRight: 8 }}>💡</span>
                <span>{selectedGame.tip}</span>
              </div>
            )}
          </div>

          {/* Timer */}
          <div style={styles.timerSection}>
            <div style={styles.timerDisplay}>{formatTime(elapsed)}</div>
            <div style={{ display: 'flex', gap: 12 }}>
              {!timerRunning ? (
                <button onClick={() => setTimerRunning(true)} style={styles.timerButton}>
                  {elapsed > 0 ? '▶ Weiter' : '▶ Start'}
                </button>
              ) : (
                <button onClick={() => setTimerRunning(false)} style={styles.timerButtonPause}>
                  ⏸ Pause
                </button>
              )}
              {elapsed > 0 && (
                <button onClick={() => { setTimerRunning(false); setElapsed(0); }} style={styles.timerButtonReset}>
                  ↻ Reset
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---- Phase: Game Selection ----
  if (phase === 'select') {
    return (
      <div style={styles.container}>
        <AnimatedBackground
          basePath="/images/splash-background"
          fallbackGradient="radial-gradient(ellipse at 50% 30%, #FFF0E8 0%, #FFE5D9 30%, #D4E4F7 80%, #C1D9F2 100%)"
        />
        <div style={styles.content}>
          {/* Decorative shapes */}
          {SHAPES.map((s, i) => (
            <div key={i} style={{
              position: 'absolute',
              left: s.x, top: s.y,
              fontSize: s.size,
              opacity: 0.15,
              animation: `floatY ${3 + i * 0.5}s ease-in-out ${i * 0.3}s infinite`,
              pointerEvents: 'none',
            }}>{s.emoji}</div>
          ))}

          <button onClick={handleBackToSplash} style={styles.backButton}>
            ← Zurück
          </button>

          <h2 style={styles.selectTitle}>Kennenlernen-Spiele</h2>
          <p style={styles.selectSubtitle}>Wählt ein Spiel aus!</p>

          <div style={styles.gameGrid}>
            {KENNENLERNEN_GAMES.map((game) => (
              <button
                key={game.id}
                onClick={() => handleSelectGame(game)}
                style={styles.gameCard}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)';
                  e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.12)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0) scale(1)';
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.06)';
                }}
              >
                <div style={{ fontSize: 44, marginBottom: 8 }}>{game.emoji}</div>
                <div style={styles.gameCardName}>{game.name}</div>
                <div style={styles.gameCardDesc}>{game.description}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ---- Phase: Splash (default) ----
  return (
    <div style={styles.container}>
      <AnimatedBackground
        basePath="/images/splash-background"
        fallbackGradient="radial-gradient(ellipse at 50% 30%, #FFF0E8 0%, #FFE5D9 30%, #D4E4F7 80%, #C1D9F2 100%)"
      />

      <div style={styles.content}>
        {/* Decorative shapes */}
        {SHAPES.map((s, i) => (
          <div key={i} style={{
            position: 'absolute',
            left: s.x, top: s.y,
            fontSize: s.size,
            opacity: 0.15,
            animation: `floatY ${3 + i * 0.5}s ease-in-out ${i * 0.3}s infinite`,
            pointerEvents: 'none',
          }}>{s.emoji}</div>
        ))}

        {/* Globe */}
        <div style={{
          marginBottom: 24,
          opacity: visible ? 1 : 0,
          transform: visible ? 'scale(1)' : 'scale(0.5)',
          transition: 'all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
          animation: visible ? 'floatY 4s ease-in-out 1s infinite' : 'none',
        }}>
          {!imgError ? (
            <img
              src="/images/globe-placeholder.png"
              alt="Globe"
              style={{ width: 130, height: 130, objectFit: 'contain' }}
              onError={() => setImgError(true)}
            />
          ) : (
            <span style={{ fontSize: 110 }}>🌍</span>
          )}
        </div>

        {/* Title */}
        <h1 style={{
          ...styles.title,
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(30px)',
          transition: 'all 0.6s ease-out 0.3s',
        }}>
          Projektwoche: Kinderrechte
        </h1>

        {/* Subtitle */}
        <p style={{
          ...styles.subtitle,
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(20px)',
          transition: 'all 0.6s ease-out 0.5s',
        }}>
          Deine Stimme zählt — Gemeinsam für Kinderrechte weltweit!
        </p>

        {/* Start button */}
        <button
          onClick={onStart}
          style={{
            ...styles.button,
            opacity: visible ? 1 : 0,
            transform: visible ? 'scale(1)' : 'scale(0.8)',
            transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.8s',
          }}
        >
          🚀 Los geht's!
        </button>

        {/* Kennenlernen button */}
        <button
          onClick={() => setPhase('select')}
          style={{
            ...styles.secondaryButton,
            opacity: visible ? 1 : 0,
            transform: visible ? 'scale(1)' : 'scale(0.8)',
            transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 1s',
          }}
        >
          🤝 Kennenlernen
        </button>

        {/* School name */}
        <p style={{
          ...styles.school,
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.5s ease 1.2s',
        }}>
          Andersen Grundschule — 18.02. bis 24.02.2026
        </p>
      </div>
    </div>
  );
}

const SHAPES = [
  { emoji: '❤️', x: '8%', y: '15%', size: 40 },
  { emoji: '⭐', x: '85%', y: '12%', size: 36 },
  { emoji: '🤝', x: '90%', y: '70%', size: 44 },
  { emoji: '🌈', x: '5%', y: '75%', size: 48 },
  { emoji: '⚖️', x: '15%', y: '45%', size: 32 },
  { emoji: '📚', x: '82%', y: '42%', size: 34 },
  { emoji: '🌏', x: '50%', y: '85%', size: 38 },
];

const styles = {
  container: {
    position: 'fixed',
    inset: 0,
    zIndex: 2000,
    overflow: 'hidden',
  },
  content: {
    position: 'relative',
    zIndex: 2,
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    overflowY: 'auto',
  },
  title: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 52,
    color: 'white',
    textAlign: 'center',
    lineHeight: 1.2,
    marginBottom: 12,
    textShadow: '0 2px 4px rgba(0,0,0,0.3), 0 4px 12px rgba(0,0,0,0.15), 0 0 40px rgba(255,255,255,0.3)',
    WebkitTextStroke: '1px rgba(0,0,0,0.08)',
  },
  subtitle: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 22,
    color: '#4A3728',
    fontWeight: 600,
    marginBottom: 32,
    textAlign: 'center',
    maxWidth: 600,
  },
  button: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 28,
    padding: '20px 72px',
    minHeight: 64,
    background: 'linear-gradient(135deg, #FF6B35, #FF8C42)',
    color: 'white',
    borderRadius: 50,
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 6px 30px rgba(255,107,53,0.35), 0 0 40px rgba(255,107,53,0.2)',
    animation: 'pulse 2.5s ease-in-out infinite, glow 2s ease-in-out infinite',
  },
  secondaryButton: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 20,
    fontWeight: 600,
    padding: '14px 48px',
    marginTop: 16,
    background: 'rgba(255,255,255,0.85)',
    color: '#4A3728',
    borderRadius: 50,
    border: '2px solid rgba(255,107,53,0.3)',
    cursor: 'pointer',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
    backdropFilter: 'blur(8px)',
  },
  school: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 16,
    color: '#6B5B4B',
    marginTop: 32,
    fontWeight: 600,
  },

  // Select phase
  selectTitle: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 40,
    color: '#FF6B35',
    marginBottom: 4,
    textAlign: 'center',
    filter: 'drop-shadow(0 2px 6px rgba(255,107,53,0.2))',
  },
  selectSubtitle: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 20,
    color: '#4A3728',
    fontWeight: 600,
    marginBottom: 28,
  },
  gameGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 16,
    maxWidth: 900,
    width: '90%',
    padding: '0 16px 32px',
  },
  gameCard: {
    background: 'rgba(255,255,255,0.92)',
    borderRadius: 20,
    padding: '24px 16px 20px',
    border: 'none',
    borderTop: '4px solid #FF6B35',
    cursor: 'pointer',
    textAlign: 'center',
    boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    backdropFilter: 'blur(8px)',
  },
  gameCardName: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 18,
    fontWeight: 700,
    color: '#2D2D2D',
    marginBottom: 6,
  },
  gameCardDesc: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 14,
    color: '#6B5B4B',
    lineHeight: 1.4,
  },

  // Game detail phase
  backButton: {
    position: 'absolute',
    top: 80,
    left: 24,
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 18,
    fontWeight: 600,
    color: '#4A3728',
    background: 'rgba(255,255,255,0.8)',
    border: 'none',
    borderRadius: 12,
    padding: '8px 20px',
    cursor: 'pointer',
    backdropFilter: 'blur(8px)',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    zIndex: 10,
  },
  gameTitle: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 36,
    color: '#FF6B35',
    marginBottom: 20,
    textAlign: 'center',
    filter: 'drop-shadow(0 2px 6px rgba(255,107,53,0.2))',
  },
  instructionsCard: {
    background: 'rgba(255,255,255,0.92)',
    borderRadius: 20,
    padding: '28px 32px',
    maxWidth: 600,
    width: '90%',
    boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
    backdropFilter: 'blur(8px)',
    marginBottom: 24,
  },
  instructionsList: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 19,
    color: '#2D2D2D',
    lineHeight: 1.7,
    paddingLeft: 24,
    margin: 0,
  },
  instructionItem: {
    marginBottom: 6,
  },
  tipBox: {
    marginTop: 16,
    padding: '12px 16px',
    background: 'rgba(255,107,53,0.08)',
    borderRadius: 12,
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 15,
    color: '#6B5B4B',
    display: 'flex',
    alignItems: 'flex-start',
    lineHeight: 1.5,
  },

  // Timer
  timerSection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
  },
  timerDisplay: {
    fontFamily: "'Baloo 2', cursive",
    fontSize: 48,
    color: '#2D2D2D',
    fontWeight: 700,
    letterSpacing: 2,
  },
  timerButton: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 18,
    fontWeight: 600,
    padding: '10px 32px',
    background: 'linear-gradient(135deg, #00B4D8, #0096B7)',
    color: 'white',
    border: 'none',
    borderRadius: 50,
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(0,180,216,0.3)',
  },
  timerButtonPause: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 18,
    fontWeight: 600,
    padding: '10px 32px',
    background: 'linear-gradient(135deg, #FF6B35, #FF8C42)',
    color: 'white',
    border: 'none',
    borderRadius: 50,
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(255,107,53,0.3)',
  },
  timerButtonReset: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 18,
    fontWeight: 600,
    padding: '10px 32px',
    background: 'rgba(255,255,255,0.85)',
    color: '#4A3728',
    border: '2px solid rgba(0,0,0,0.1)',
    borderRadius: 50,
    cursor: 'pointer',
  },
};

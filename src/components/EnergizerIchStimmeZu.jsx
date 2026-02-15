import React, { useState } from 'react';
import { playClickSound, playSuccessSound } from '../utils/audio';

const STATEMENTS = [
  "Ich bin heute topfit und ausgeschlafen",
  "Ich habe heute gefr\u00fchst\u00fcckt.",
  "Ich f\u00fchle mich heute sicher.",
  "Ich habe jemanden, der auf mich aufpasst.",
  "Ich kann heute lernen.",
  "Ich war schonmal bei einer Demo",
  "Ich habe schonmal etwas von Kinderrechten geh\u00f6rt",
  "Ich habe mich schon Mal zum Klassensprecher*in w\u00e4hlen lassen",
  "Ich kann erkl\u00e4ren, was Kinderrechte sind",
  "Ich freue mich auf die Projektwoche!"
];

export default function EnergizerIchStimmeZu({ onComplete }) {
  const [currentIndex, setCurrentIndex] = useState(-1);
  const started = currentIndex >= 0;
  const finished = currentIndex >= STATEMENTS.length;

  const handleStart = () => {
    playClickSound();
    setCurrentIndex(0);
  };

  const handleNext = () => {
    playClickSound();
    setCurrentIndex(prev => prev + 1);
  };

  const handleFinish = () => {
    playSuccessSound();
    onComplete();
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.heading}>
        {'\u{1F64B}'} Ich stimme zu und stehe auf!
      </h1>

      {!started && (
        <div style={styles.intro}>
          <p style={styles.instructions}>
            Es werden gleich verschiedene Aussagen vorgelesen.{'\n'}
            Wenn du denkst, dass das zu dir passt, <strong>stehst du auf!</strong>
          </p>
          <button onClick={handleStart} style={styles.startButton}>
            Los geht&apos;s! {'\u{1F680}'}
          </button>
        </div>
      )}

      {started && !finished && (
        <div style={styles.statementArea}>
          <div style={styles.counter}>
            {currentIndex + 1} / {STATEMENTS.length}
          </div>
          <div style={styles.statementCard} key={currentIndex}>
            <p style={styles.statementText}>
              &ldquo;{STATEMENTS[currentIndex]}&rdquo;
            </p>
          </div>
          <p style={styles.hint}>Steh auf, wenn das zu dir passt!</p>
          <button onClick={handleNext} style={styles.nextButton}>
            {currentIndex < STATEMENTS.length - 1
              ? `N\u00e4chste Aussage \u2192`
              : 'Letzte Aussage \u2192'}
          </button>
        </div>
      )}

      {finished && (
        <div style={styles.finishArea}>
          <span style={{ fontSize: 64, marginBottom: 16 }}>{'\u{1F389}'}</span>
          <p style={styles.finishText}>Super gemacht! Ihr seid toll!</p>
          <button onClick={handleFinish} style={styles.finishButton}>
            Fertig {'\u2705'}
          </button>
        </div>
      )}

      {/* Progress dots */}
      {started && !finished && (
        <div style={styles.dots}>
          {STATEMENTS.map((_, i) => (
            <div key={i} style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: i <= currentIndex ? '#FF6B35' : 'rgba(0,0,0,0.1)',
              transition: 'background 0.3s',
            }} />
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    position: 'fixed',
    inset: 0,
    background: 'linear-gradient(160deg, #FFF5EE 0%, #FFE5D9 50%, #E8F0FE 100%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
    padding: 40,
  },
  heading: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 38,
    color: '#2D2D2D',
    marginBottom: 24,
    textAlign: 'center',
  },
  intro: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 24,
  },
  instructions: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 22,
    color: '#444',
    textAlign: 'center',
    maxWidth: 600,
    lineHeight: 1.6,
    fontWeight: 500,
  },
  startButton: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 26,
    padding: '16px 50px',
    background: 'linear-gradient(135deg, #FF6B35, #FF8C42)',
    color: 'white',
    borderRadius: 40,
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 4px 20px rgba(255,107,53,0.3)',
  },
  statementArea: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 20,
  },
  counter: {
    fontFamily: "'Baloo 2', cursive",
    fontSize: 18,
    color: '#999',
    fontWeight: 700,
  },
  statementCard: {
    background: 'white',
    borderRadius: 24,
    padding: '36px 48px',
    boxShadow: '0 6px 30px rgba(0,0,0,0.08)',
    maxWidth: 650,
    animation: 'popIn 0.4s ease-out forwards',
  },
  statementText: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 30,
    color: '#2D2D2D',
    textAlign: 'center',
    fontWeight: 600,
    lineHeight: 1.4,
  },
  hint: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 18,
    color: '#FF6B35',
    fontWeight: 600,
  },
  nextButton: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 22,
    padding: '14px 44px',
    background: 'linear-gradient(135deg, #00B4D8, #48CAE4)',
    color: 'white',
    borderRadius: 40,
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 4px 20px rgba(0,180,216,0.3)',
  },
  finishArea: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    animation: 'popIn 0.5s ease-out forwards',
  },
  finishText: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 26,
    color: '#333',
    fontWeight: 600,
    marginBottom: 24,
  },
  finishButton: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 24,
    padding: '14px 50px',
    background: 'linear-gradient(135deg, #00C48C, #00E5A0)',
    color: 'white',
    borderRadius: 40,
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 4px 20px rgba(0,196,140,0.3)',
  },
  dots: {
    display: 'flex',
    gap: 8,
    marginTop: 24,
  },
};

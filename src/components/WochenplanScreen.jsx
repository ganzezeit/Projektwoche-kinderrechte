import React from 'react';
import { playClickSound } from '../utils/audio';
import GlossaryTooltip from './GlossaryTooltip';

const PLAN = [
  { tag: 'Tag 1', title: 'Kinderrechte entdecken', emoji: '\u{1F4DA}', color: '#FF6B35' },
  { tag: 'Tag 2', title: 'Austausch mit Tansania', emoji: '\u{1F30D}', color: '#00B4D8' },
  { tag: 'Tag 3', title: 'Game Design & Projektstart', emoji: '\u{1F3AE}', color: '#9B5DE5' },
  { tag: 'Tag 4', title: 'Projektarbeit', emoji: '\u{1F680}', color: '#00F5D4' },
  { tag: 'Tag 5', title: 'Pr\u00e4sentationen & Abschluss', emoji: '\u{1F389}', color: '#FFD166' },
];

export default function WochenplanScreen({ onContinue }) {
  return (
    <div style={styles.container}>
      <h1 style={styles.heading}>
        {'\u{1F5D3}\uFE0F'} Unsere Projektwoche
      </h1>
      <p style={styles.sub}>5 Tage voller Abenteuer!</p>

      <div style={styles.cards}>
        {PLAN.map((day, i) => (
          <div
            key={i}
            style={{
              ...styles.card,
              borderLeft: `5px solid ${day.color}`,
              animation: `slideUp 0.5s ease-out ${i * 0.1}s forwards`,
              opacity: 0,
            }}
          >
            <span style={{ fontSize: 36 }}>{day.emoji}</span>
            <div>
              <div style={{ ...styles.cardTag, color: day.color }}>{day.tag}</div>
              <div style={styles.cardTitle}><GlossaryTooltip text={day.title} /></div>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => { playClickSound(); onContinue(); }}
        style={styles.button}
      >
        Weiter {'\u2192'}
      </button>
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
    fontSize: 40,
    color: '#2D2D2D',
    marginBottom: 6,
    textAlign: 'center',
  },
  sub: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 20,
    color: '#5A4A3A',
    fontWeight: 600,
    marginBottom: 32,
  },
  cards: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    width: '100%',
    maxWidth: 550,
    marginBottom: 36,
  },
  card: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    background: 'white',
    borderRadius: 16,
    padding: '16px 20px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
  },
  cardTag: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 16,
  },
  cardTitle: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 18,
    color: '#333',
    fontWeight: 600,
  },
  button: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 24,
    padding: '14px 50px',
    background: 'linear-gradient(135deg, #00B4D8, #48CAE4)',
    color: 'white',
    borderRadius: 40,
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 4px 20px rgba(0,180,216,0.3)',
  },
};

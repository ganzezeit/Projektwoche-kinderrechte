import React, { useState } from 'react';
import { DAYS } from '../data/days';
import { playClickSound } from '../utils/audio';

export default function TeacherPanel({
  currentDay,
  currentStep,
  energy,
  onClose,
  onGoBack,
  onResetDay,
  onAddEnergy,
  onJumpToDay,
  onSkipStep,
  onSkipDay,
  onFillEnergy,
  onResetIntro,
  onResetAll,
}) {
  const [confirmReset, setConfirmReset] = useState(false);

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      playClickSound();
      onClose();
    }
  };

  const handleButton = (action) => {
    playClickSound();
    if (action) action();
  };

  const handleResetAll = () => {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    playClickSound();
    if (onResetAll) onResetAll();
    setConfirmReset(false);
  };

  return (
    <div style={styles.overlay} onClick={handleOverlayClick}>
      <div style={styles.card}>
        <h2 style={styles.title}>{'\u{1F510}'} Lehrer-Panel</h2>

        {/* Current state */}
        <div style={styles.stateBox}>
          <div style={styles.stateRow}>
            <span style={styles.stateLabel}>Tag:</span>
            <span style={styles.stateValue}>{currentDay}</span>
          </div>
          <div style={styles.stateRow}>
            <span style={styles.stateLabel}>Schritt:</span>
            <span style={styles.stateValue}>{currentStep}</span>
          </div>
          <div style={styles.stateRow}>
            <span style={styles.stateLabel}>Energie:</span>
            <span style={styles.stateValue}>{energy}%</span>
          </div>
        </div>

        {/* Navigation section */}
        <div style={styles.sectionHeader}>Navigation</div>
        <div style={styles.actions}>
          {onSkipStep && (
            <button style={styles.actionButton} onClick={() => handleButton(onSkipStep)}>
              {'\u23ED'} Schritt {'\u00fc'}berspringen
            </button>
          )}
          {onSkipDay && (
            <button style={styles.actionButton} onClick={() => handleButton(onSkipDay)}>
              {'\u23ED'} Tag {'\u00fc'}berspringen
            </button>
          )}
          <button style={styles.actionButton} onClick={() => handleButton(onGoBack)}>
            {'\u23EA'} Einen Schritt zur{'\u00fc'}ck
          </button>
          <button style={styles.actionButton} onClick={() => handleButton(onResetDay)}>
            {'\u{1F504}'} Tag zur{'\u00fc'}cksetzen
          </button>
        </div>

        {/* Energy section */}
        <div style={styles.sectionHeader}>Energie</div>
        <div style={styles.actions}>
          {onFillEnergy && (
            <button style={{ ...styles.actionButton, ...styles.energyButton }} onClick={() => handleButton(onFillEnergy)}>
              {'\u26A1'} Energie auf 100% f{'\u00fc'}llen
            </button>
          )}
          <button style={{ ...styles.actionButton, ...styles.energyButton }} onClick={() => handleButton(onAddEnergy)}>
            {'\u26A1'} +30 Energie
          </button>
        </div>

        {/* Day jump */}
        <div style={styles.sectionHeader}>Zu Tag springen</div>
        <div style={styles.dayButtons}>
          {DAYS.map((day) => (
            <button
              key={day.id}
              style={{ ...styles.dayButton, backgroundColor: day.color }}
              onClick={() => handleButton(() => onJumpToDay(day.id))}
            >
              {day.emoji} Tag {day.id}
            </button>
          ))}
        </div>

        {/* Reset section */}
        <div style={styles.sectionHeader}>Zur{'\u00fc'}cksetzen</div>
        <div style={styles.actions}>
          {onResetIntro && (
            <button style={styles.actionButton} onClick={() => handleButton(onResetIntro)}>
              {'\u{1F504}'} Intro zur{'\u00fc'}cksetzen
            </button>
          )}
          <button
            style={{ ...styles.actionButton, ...(confirmReset ? styles.dangerButton : styles.dangerButtonIdle) }}
            onClick={handleResetAll}
          >
            {confirmReset
              ? '\u26A0\uFE0F Wirklich ALLES zur\u00fccksetzen?'
              : '\u{1F5D1}\uFE0F Alles zur\u00fccksetzen'}
          </button>
        </div>

        {/* Close */}
        <button style={styles.closeButton} onClick={() => handleButton(onClose)}>
          Schlie{'\u00df'}en
        </button>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9000,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: '24px',
    padding: '32px',
    maxWidth: '500px',
    width: '90%',
    maxHeight: '90vh',
    overflowY: 'auto',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.2)',
  },
  title: {
    fontFamily: "'Lilita One', cursive",
    fontSize: '26px',
    color: '#D32F2F',
    textAlign: 'center',
    margin: '0 0 16px 0',
  },
  stateBox: {
    backgroundColor: '#F8F8F8',
    borderRadius: '14px',
    padding: '14px 18px',
    marginBottom: '16px',
  },
  stateRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '3px 0',
    fontFamily: "'Fredoka', sans-serif",
    fontSize: '16px',
  },
  stateLabel: { color: '#555', fontWeight: 500 },
  stateValue: {
    fontFamily: "'Baloo 2', cursive",
    fontWeight: 'bold',
    color: '#333',
  },
  sectionHeader: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: '14px',
    fontWeight: 700,
    color: '#777',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginTop: '12px',
    marginBottom: '8px',
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginBottom: '8px',
  },
  actionButton: {
    width: '100%',
    padding: '12px 18px',
    border: 'none',
    borderRadius: '12px',
    backgroundColor: '#F0F0F0',
    fontFamily: "'Fredoka', sans-serif",
    fontSize: '16px',
    fontWeight: 600,
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
    color: '#333',
  },
  energyButton: {
    backgroundColor: '#E8F5E9',
    color: '#2E7D32',
  },
  dangerButtonIdle: {
    backgroundColor: '#FFF3E0',
    color: '#E65100',
  },
  dangerButton: {
    backgroundColor: '#FFEBEE',
    color: '#C62828',
    fontWeight: 600,
  },
  dayButtons: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    marginBottom: '12px',
  },
  dayButton: {
    padding: '10px 14px',
    border: 'none',
    borderRadius: '12px',
    color: '#fff',
    fontFamily: "'Fredoka', sans-serif",
    fontSize: '15px',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'transform 0.15s ease',
    textShadow: '0 1px 2px rgba(0,0,0,0.2)',
  },
  closeButton: {
    width: '100%',
    padding: '14px',
    border: '2px solid #ddd',
    borderRadius: '14px',
    backgroundColor: '#fff',
    fontFamily: "'Fredoka', sans-serif",
    fontSize: '16px',
    fontWeight: 600,
    color: '#555',
    cursor: 'pointer',
    marginTop: '8px',
  },
};

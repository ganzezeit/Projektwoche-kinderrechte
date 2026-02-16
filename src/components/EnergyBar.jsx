import React, { useState } from 'react';

const BAR_WIDTH = 200;
const BAR_HEIGHT = 30;

export default function EnergyBar({ energy, maxEnergy = 100, onLightningClick }) {
  const percentage = Math.round(Math.max(0, Math.min(100, (energy / maxEnergy) * 100)));
  const [iconOk, setIconOk] = useState(true);

  return (
    <div style={styles.wrapper}>
      <button
        onClick={onLightningClick}
        style={styles.lightningBtn}
        title="Energizer-Pause!"
      >
        {iconOk ? (
          <img
            src="/images/ui/icon-energy.png"
            alt={'\u26A1'}
            style={{ width: 40, height: 40, objectFit: 'contain' }}
            onError={() => setIconOk(false)}
          />
        ) : (
          <span style={styles.emoji}>{'\u26A1'}</span>
        )}
      </button>
      <div style={styles.bar}>
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          height: '100%',
          width: `${percentage}%`,
          backgroundImage: 'url(/images/ui/energy-bar-fill.png)',
          backgroundSize: `${BAR_WIDTH}px 100%`,
          backgroundRepeat: 'no-repeat',
          transition: 'width 0.5s ease',
        }} />
      </div>
      <span style={styles.percentText}>{percentage}%</span>
    </div>
  );
}

const styles = {
  wrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  lightningBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'transform 0.2s ease',
  },
  emoji: {
    fontSize: 16,
  },
  bar: {
    width: BAR_WIDTH,
    height: BAR_HEIGHT,
    position: 'relative',
    overflow: 'hidden',
    backgroundImage: 'url(/images/ui/energy-bar-frame.png)',
    backgroundSize: '100% 100%',
    backgroundRepeat: 'no-repeat',
  },
  percentText: {
    fontFamily: "'Baloo 2', cursive",
    fontWeight: 'bold',
    fontSize: 15,
    color: '#8B5A2B',
    minWidth: 34,
  },
};

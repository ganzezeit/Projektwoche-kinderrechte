import React, { useState, useEffect, useRef } from 'react';

const COLORS = ['#FF6B35', '#00B4D8', '#9B5DE5', '#00F5D4', '#FFD166', '#FF6B6B', '#F72585'];

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

export default function Confetti({ active, duration = 3000 }) {
  const [particles, setParticles] = useState([]);
  const timerRef = useRef(null);

  useEffect(() => {
    if (active) {
      const newParticles = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        x: randomBetween(0, 100),
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        delay: randomBetween(0, 1.5),
        animDuration: randomBetween(1.5, 3),
        size: randomBetween(6, 14),
      }));
      setParticles(newParticles);

      timerRef.current = setTimeout(() => {
        setParticles([]);
      }, duration);
    } else {
      setParticles([]);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [active, duration]);

  if (!active && particles.length === 0) return null;

  return (
    <div style={styles.container}>
      <style>{keyframes}</style>
      {particles.map((p) => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            left: `${p.x}%`,
            top: '-10px',
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.color,
            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
            animation: `confettiFall ${p.animDuration}s ease-in ${p.delay}s forwards`,
            opacity: 0,
          }}
        />
      ))}
    </div>
  );
}

const keyframes = `
@keyframes confettiFall {
  0% {
    transform: translateY(0) rotate(0deg);
    opacity: 1;
  }
  100% {
    transform: translateY(100vh) rotate(720deg);
    opacity: 0;
  }
}
`;

const styles = {
  container: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: 9999,
    overflow: 'hidden',
  },
};

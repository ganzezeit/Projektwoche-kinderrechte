import React, { useMemo, useState } from 'react';
import { DAYS } from '../data/days';
import { CHARACTER_EMOJI } from '../utils/constants';
import { playClickSound } from '../utils/audio';
import AnimatedBackground from './AnimatedBackground';

const NODE_POS = [
  { x: 10, y: 61 },
  { x: 28, y: 38 },
  { x: 50, y: 64 },
  { x: 72, y: 36 },
  { x: 90, y: 60 },
];

export default function MapScreen({ currentDay, completedDays, onDayClick }) {
  const decos = useMemo(() => [
    { e: '\u2764\uFE0F', x: '5%', y: '18%', s: 28, d: 4 },
    { e: '\u2B50', x: '42%', y: '12%', s: 24, d: 5 },
    { e: '\u{1F308}', x: '78%', y: '14%', s: 30, d: 3.5 },
    { e: '\u{1F30F}', x: '20%', y: '80%', s: 26, d: 4.5 },
    { e: '\u2696\uFE0F', x: '62%', y: '82%', s: 22, d: 5.5 },
    { e: '\u{1F91D}', x: '94%', y: '78%', s: 28, d: 3.8 },
  ], []);

  return (
    <div style={styles.container}>
      <AnimatedBackground
        basePath="/images/map-background"
        fallbackGradient="linear-gradient(160deg, #FFF0E8 0%, #FFE5D9 30%, #D4E4F7 70%, #C1D9F2 100%)"
      />

      {/* Decorations */}
      {decos.map((d, i) => (
        <div key={i} style={{
          position: 'absolute', left: d.x, top: d.y,
          fontSize: d.s, opacity: 0.12, pointerEvents: 'none',
          animation: `floatY ${d.d}s ease-in-out ${i * 0.4}s infinite`,
          zIndex: 2,
        }}>{d.e}</div>
      ))}

      {/* Map area with title above */}
      <div style={styles.mapArea}>
        {/* Title — positioned absolutely in the sky area above day nodes */}
        <div style={{
          position: 'absolute',
          top: '3%',
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          pointerEvents: 'none',
          zIndex: 3,
        }}>
          <img
            src="/images/ui/title-eure-projektwoche-animated.gif"
            alt="Eure Projektwoche"
            style={{ height: 420, width: 'auto', pointerEvents: 'none' }}
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = '/images/ui/title-eure-projektwoche.png';
            }}
          />
          <span style={{ display: 'none', fontFamily: "'Lilita One', cursive", fontSize: 34, color: '#8B5A2B' }}>
            {'\u{1F30D}'} Eure Projektwoche {'\u{1F30D}'}
          </span>
        </div>

        <div style={styles.mapInner}>
          {/* Adventure trail SVG */}
          <svg style={styles.pathSvg} viewBox="0 0 100 100" preserveAspectRatio="none">
            {NODE_POS.slice(0, -1).map((pos, i) => {
              const next = NODE_POS[i + 1];
              const midX = (pos.x + next.x) / 2;
              const midY = pos.y + (i % 2 === 0 ? -16 : 16);
              const done = completedDays.includes(i + 1);
              return (
                <g key={i}>
                  {/* Trail shadow for depth */}
                  <path
                    d={`M ${pos.x} ${pos.y} Q ${midX} ${midY} ${next.x} ${next.y}`}
                    fill="none"
                    stroke="rgba(139,90,43,0.06)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  {/* Main trail */}
                  <path
                    d={`M ${pos.x} ${pos.y} Q ${midX} ${midY} ${next.x} ${next.y}`}
                    fill="none"
                    stroke={done ? DAYS[i].color : 'rgba(139,90,43,0.25)'}
                    strokeWidth={done ? '1' : '0.8'}
                    strokeDasharray={done ? '3 2' : '2 2.5'}
                    strokeLinecap="round"
                  />
                </g>
              );
            })}
          </svg>

          {/* Day nodes */}
          {DAYS.map((day, i) => {
            const pos = NODE_POS[i];
            const isCompleted = completedDays.includes(day.id);
            const isActive = day.id === currentDay;
            const isLocked = day.id > currentDay && !isCompleted;
            const canClick = !isLocked;

            return (
              <DayNode
                key={day.id}
                day={day}
                pos={pos}
                index={i}
                isCompleted={isCompleted}
                isActive={isActive}
                isLocked={isLocked}
                canClick={canClick}
                onDayClick={onDayClick}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DayIcon({ src, alt, size, fallback }) {
  const [status, setStatus] = useState('loading'); // 'loading' | 'ok' | 'error'

  if (status === 'error' || !src) return fallback;

  return (
    <>
      <img
        src={src}
        alt={alt}
        loading="lazy"
        style={{
          width: size, height: size,
          objectFit: 'contain',
          borderRadius: '50%',
          display: status === 'ok' ? 'block' : 'none',
        }}
        onLoad={(e) => {
          // Vite SPA fallback returns HTML with 0 naturalWidth for images
          if (e.target.naturalWidth === 0) setStatus('error');
          else setStatus('ok');
        }}
        onError={() => setStatus('error')}
      />
      {status === 'loading' && fallback}
    </>
  );
}

function DayNode({ day, pos, index, isCompleted, isActive, isLocked, canClick, onDayClick }) {

  return (
    <div
      style={{
        position: 'absolute',
        left: `${pos.x}%`,
        top: `${pos.y}%`,
        transform: 'translate(-50%, -50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        cursor: canClick ? 'pointer' : 'default',
        zIndex: isActive ? 20 : 10,
        animation: `popIn 0.5s ease-out ${index * 0.1}s forwards`,
        opacity: 0,
      }}
      onClick={() => {
        if (canClick) { playClickSound(); onDayClick(day.id); }
      }}
    >
      {/* Character — animated GIF, no CSS idle animation */}
      {isActive && (
        <div style={{
          position: 'absolute',
          top: -120,
          filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.2))',
          zIndex: 30,
          transition: 'left 1s ease-in-out, top 1s ease-in-out',
        }}>
          <img
            src="/images/day-icons/character-animated.gif"
            alt="Character"
            style={{ width: 130, height: 'auto', pointerEvents: 'none' }}
            onError={(e) => { e.target.src = '/images/day-icons/character.png'; }}
          />
        </div>
      )}

      {/* Node circle with frosted glass */}
      <div style={{
        width: isActive ? 110 : 94,
        height: isActive ? 110 : 94,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: isActive ? 36 : 28,
        background: isLocked
          ? 'rgba(200,190,180,0.5)'
          : isCompleted
            ? `linear-gradient(135deg, ${day.color}cc, ${day.color}88)`
            : 'rgba(255, 248, 240, 0.85)',
        backdropFilter: isLocked ? 'none' : 'blur(8px)',
        WebkitBackdropFilter: isLocked ? 'none' : 'blur(8px)',
        border: isActive
          ? `4px solid ${day.color}`
          : isCompleted
            ? `3px solid ${day.color}88`
            : '3px solid rgba(255, 166, 107, 0.3)',
        boxShadow: isActive
          ? `0 0 0 8px ${day.color}22, 0 4px 20px rgba(139,90,43,0.15)`
          : '0 4px 20px rgba(139,90,43,0.1)',
        filter: isLocked ? 'grayscale(1) opacity(0.5)' : 'none',
        transition: 'all 0.3s ease',
        animation: isActive ? 'pulse 2.5s ease-in-out infinite' : 'none',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {isCompleted && (
          <div style={{
            position: 'absolute', top: -4, right: -4,
            width: 24, height: 24, borderRadius: '50%',
            background: '#00C48C', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontSize: 13, color: 'white',
            boxShadow: '0 2px 6px rgba(0,196,140,0.4)',
            zIndex: 2,
          }}>{'\u2714'}</div>
        )}
        {isLocked && (
          <div style={{
            position: 'absolute', top: -4, right: -4, fontSize: 16, zIndex: 2,
          }}>{'\u{1F512}'}</div>
        )}
        <DayIcon
          src={day.iconImage}
          alt={day.name}
          size={isActive ? 86 : 72}
          fallback={<span>{day.emoji}</span>}
        />
      </div>

      {/* Label with frosted glass backing */}
      <div style={{
        marginTop: 10,
        textAlign: 'center',
        background: 'rgba(255, 248, 240, 0.8)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        borderRadius: 12,
        padding: '6px 12px',
        border: '1px solid rgba(255, 166, 107, 0.2)',
        boxShadow: '0 2px 8px rgba(139,90,43,0.06)',
      }}>
        <div style={{
          fontFamily: "'Lilita One', cursive",
          fontSize: isActive ? 18 : 16,
          color: isLocked ? '#8B7B6B' : isActive ? day.color : '#8B5A2B',
        }}>{day.name}</div>
        <div style={{
          fontFamily: "'Fredoka', sans-serif",
          fontSize: 14,
          color: isLocked ? '#9B8B7B' : '#7B6B5B',
          fontWeight: 600,
          marginTop: 2,
          maxWidth: 120,
        }}>{day.sub}</div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    position: 'fixed',
    inset: 0,
    overflow: 'hidden',
  },
  title: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 34,
    color: '#8B5A2B',
    textShadow: '0 2px 8px rgba(255,200,100,0.35), 0 1px 2px rgba(139,90,43,0.15)',
    textAlign: 'center',
    marginBottom: 40,
    letterSpacing: 1,
    animation: 'slideUp 0.5s ease-out',
    pointerEvents: 'none',
  },
  mapArea: {
    position: 'absolute',
    top: 56, left: 0, right: 0, bottom: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  mapInner: {
    position: 'relative',
    width: '58%',
    maxWidth: 900,
    height: '55%',
  },
  pathSvg: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
  },
};

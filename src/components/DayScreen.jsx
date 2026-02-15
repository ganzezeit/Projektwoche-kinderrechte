import React, { useMemo, useState } from 'react';
import { playClickSound } from '../utils/audio';
import AnimatedBackground from './AnimatedBackground';
import GlossaryTooltip from './GlossaryTooltip';

// --- 34a: Task title → icon file lookup ---
// More specific keys MUST come before generic ones
const TASK_ICONS = [
  ['pausenspiel im hof', 'pausenspiel-hof.png'],
  ['pausenspiel und', 'pausenspiel.png'],
  ['kinderrechte entdecken', 'kinderrechte-entdecken.png'],
  ['kinderrechte vertiefen', 'kinderrechte-vertiefen.png'],
  ['kahoot', 'kahoot-quiz.png'],
  ['lebensweltkarten', 'lebensweltkarten.png'],
  ['fotorallye', 'fotorallye.png'],
  ['tansania entdecken', 'tansania-entdecken.png'],
  ['vorbereitung', 'vorbereitung-austausch.png'],
  ['video-call mit', 'videocall-tansania.png'],
  ['video-call nr', 'videocall-nr2.png'],
  ['ausblick', 'ausblick-reflexion.png'],
  ['auswertung', 'auswertung-lernprodukt.png'],
  ['feedback', 'feedback-321.png'],
  ['game design', 'game-design-lab..png'],
  ['gruppeneinteilung', 'gruppeneinteilung.png'],
  ['projektarbeit fortsetzen', 'projektarbeit-fortsetzen.png'],
  ['letzte projektarbeit', 'letzte-projektarbeit.png'],
  ['spiele ausprobieren', 'spiele-ausprobieren.png'],
  ['präsentationen', 'praesentationen.png'],
  ['präsentation', 'praesentationen.png'],
  ['abschluss', 'abschluss-reflexion.png'],
  ['projektarbeit', 'projektarbeit.png'],
];

function getTaskIconPath(title) {
  const lower = title.toLowerCase();
  for (const [key, file] of TASK_ICONS) {
    if (lower.includes(key)) return `/images/task-icons/${file}`;
  }
  return null;
}

// Horizontal wave layout — left to right with gentle up-down wave.
// Same style as the weekly overview map's day nodes.
function computePositions(n) {
  if (n <= 0) return [];
  if (n === 1) return [{ x: 50, y: 35 }];

  const xStart = 15;
  const xEnd = 85;
  const yHigh = 30;   // odd tasks (0, 2, 4…) slightly higher
  const yLow = 42;    // even tasks (1, 3, 5…) slightly lower

  const positions = [];
  for (let i = 0; i < n; i++) {
    const x = xStart + (i / (n - 1)) * (xEnd - xStart);
    const y = i % 2 === 0 ? yHigh : yLow;
    positions.push({ x, y });
  }
  return positions;
}

// --- Task icon component with fallback ---
function TaskIcon({ src, alt, size, fallback, locked }) {
  const [status, setStatus] = useState('loading');

  if (status === 'error' || !src) return fallback;

  return (
    <>
      <img
        src={src}
        alt={alt}
        style={{
          width: size,
          height: size,
          objectFit: 'contain',
          display: status === 'ok' ? 'block' : 'none',
          filter: locked ? 'grayscale(1) opacity(0.45)' : 'none',
        }}
        onLoad={(e) => {
          if (e.target.naturalWidth === 0) setStatus('error');
          else setStatus('ok');
        }}
        onError={() => setStatus('error')}
      />
      {status === 'loading' && fallback}
    </>
  );
}

export default function DayScreen({ day, activeStepIndex, completedSteps, onStepClick, onBack }) {
  const positions = useMemo(() => computePositions(day.steps.length), [day.steps.length]);

  return (
    <div style={styles.container}>
      <AnimatedBackground
        basePath={`/images/day-backgrounds/tag${day.id}-background`}
        fallbackGradient="linear-gradient(160deg, #FFF8F0 0%, #F0E6D6 100%)"
      />

      <div style={styles.contentLayer}>
        {/* Header */}
        <div style={styles.header}>
          <button
            onClick={() => { playClickSound(); onBack(); }}
            style={styles.backBtn}
          >
            {'\u2190'} Karte
          </button>
          <div style={{
            background: 'rgba(255, 255, 255, 0.75)',
            padding: '6px 14px',
            borderRadius: 12,
          }}>
            <h1 style={styles.dayTitle}>
              <img
                src={`/images/ui/title-tag${day.id}.png`}
                alt={`Tag ${day.id}`}
                style={{ height: 70, width: 'auto', verticalAlign: 'middle' }}
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'inline';
                }}
              />
              <span style={{ display: 'none' }}>{day.emoji} {day.name}</span>
            </h1>
            <p style={styles.daySub}><GlossaryTooltip text={day.sub} /></p>
          </div>
        </div>

        {/* Map-style step area */}
        <div style={styles.mapArea}>
          <div style={styles.mapInner}>
            {/* SVG adventure trail */}
            <svg style={styles.pathSvg} viewBox="0 0 100 100" preserveAspectRatio="none">
              {positions.slice(0, -1).map((pos, i) => {
                const next = positions[i + 1];
                const done = !!completedSteps[day.steps[i].id];
                const isVertical = Math.abs(next.y - pos.y) > 20;
                let cpX, cpY;
                if (isVertical) {
                  cpX = pos.x + 12;
                  cpY = (pos.y + next.y) / 2;
                } else {
                  cpX = (pos.x + next.x) / 2;
                  cpY = pos.y + (pos.y < 50 ? -10 : 10);
                }
                return (
                  <g key={i}>
                    <path
                      d={`M ${pos.x} ${pos.y} Q ${cpX} ${cpY} ${next.x} ${next.y}`}
                      fill="none"
                      stroke="rgba(139,90,43,0.06)"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                    <path
                      d={`M ${pos.x} ${pos.y} Q ${cpX} ${cpY} ${next.x} ${next.y}`}
                      fill="none"
                      stroke={done ? '#00C48C55' : 'rgba(139,90,43,0.22)'}
                      strokeWidth={done ? '1' : '0.8'}
                      strokeDasharray={done ? '3 2' : '2 2.5'}
                      strokeLinecap="round"
                    />
                  </g>
                );
              })}
            </svg>

            {/* Step nodes */}
            {day.steps.map((step, index) => {
              const pos = positions[index];
              if (!pos) return null;
              const isCompleted = !!completedSteps[step.id];
              const isActive = index === activeStepIndex;
              const isLocked = index > activeStepIndex;
              const iconPath = getTaskIconPath(step.title);
              const iconSize = isActive ? 110 : 100;

              return (
                <div
                  key={step.id}
                  style={{
                    position: 'absolute',
                    left: `${pos.x}%`,
                    top: `${pos.y}%`,
                    transform: 'translate(-50%, -50%)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    cursor: isActive ? 'pointer' : 'default',
                    zIndex: isActive ? 20 : 10,
                    animation: `popIn 0.5s ease-out ${index * 0.1}s forwards`,
                    opacity: 0,
                  }}
                  onClick={() => {
                    if (isActive) { playClickSound(); onStepClick(index); }
                  }}
                >
                  {/* 34b: Icon without circle — just the image */}
                  <div style={{
                    position: 'relative',
                    width: iconSize,
                    height: iconSize,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    animation: isActive ? 'pulse 2.5s ease-in-out infinite' : 'none',
                    transition: 'all 0.3s ease',
                    filter: isLocked ? 'grayscale(1) opacity(0.45)' : 'drop-shadow(0 3px 8px rgba(0,0,0,0.15))',
                  }}>
                    {/* Completed checkmark badge */}
                    {isCompleted && (
                      <div style={{
                        position: 'absolute', top: -4, right: -4,
                        width: 22, height: 22, borderRadius: '50%',
                        background: '#00C48C', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, color: 'white',
                        boxShadow: '0 2px 6px rgba(0,196,140,0.4)',
                        zIndex: 3,
                      }}>{'\u2714'}</div>
                    )}
                    {isLocked && !iconPath
                      ? <span style={{ fontSize: 28 }}>{'\u{1F512}'}</span>
                      : (
                        <TaskIcon
                          src={iconPath}
                          alt={step.title}
                          size={iconSize}
                          locked={isLocked}
                          fallback={
                            isLocked
                              ? <span style={{ fontSize: 28 }}>{'\u{1F512}'}</span>
                              : <span style={{ fontSize: isActive ? 36 : 28 }}>{step.icon}</span>
                          }
                        />
                      )}
                  </div>

                  {/* Card label */}
                  <div style={{
                    marginTop: 10,
                    textAlign: 'center',
                    background: isActive
                      ? 'rgba(255,255,255,0.93)'
                      : isCompleted
                        ? 'rgba(255,255,255,0.85)'
                        : isLocked
                          ? 'rgba(255,248,240,0.65)'
                          : 'rgba(255,248,240,0.8)',
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    borderRadius: 14,
                    padding: isActive ? '10px 16px' : '8px 14px',
                    border: isActive
                      ? `2px solid ${day.color}88`
                      : isCompleted
                        ? '2px solid rgba(0,196,140,0.3)'
                        : '1px solid rgba(255,166,107,0.2)',
                    boxShadow: isActive
                      ? `0 4px 20px ${day.color}20, 0 2px 10px rgba(0,0,0,0.08)`
                      : '0 2px 8px rgba(0,0,0,0.06)',
                    minWidth: 110,
                    maxWidth: 170,
                    opacity: isLocked ? 0.7 : 1,
                  }}>
                    <div style={{
                      fontFamily: "'Lilita One', cursive",
                      fontSize: isActive ? 18 : 16,
                      color: isActive ? day.color : isCompleted ? '#5A4A3A' : '#6B5B4B',
                      lineHeight: 1.2,
                    }}>
                      {step.title}
                    </div>
                    <div style={{
                      fontFamily: "'Baloo 2', cursive",
                      fontSize: 16,
                      color: isActive ? '#5A3A1A' : '#7B6B5B',
                      fontWeight: 700,
                      marginTop: 3,
                    }}>
                      {step.energyCost} Energie
                    </div>
                    {isActive && (
                      <div style={{
                        fontFamily: "'Fredoka', sans-serif",
                        fontSize: 16,
                        color: day.color,
                        fontWeight: 700,
                        marginTop: 5,
                      }}>
                        Starten {'\u25B6'}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    position: 'fixed',
    inset: 0,
    paddingTop: 56,
    overflow: 'hidden',
  },
  contentLayer: {
    position: 'relative',
    zIndex: 2,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    padding: '12px 28px 4px',
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    flexShrink: 0,
  },
  backBtn: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 16,
    fontWeight: 600,
    color: '#E8713A',
    padding: '8px 16px',
    borderRadius: 12,
    background: 'rgba(255,255,255,0.75)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    border: '1px solid rgba(232,113,58,0.25)',
    cursor: 'pointer',
  },
  dayTitle: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 30,
    color: 'white',
    textShadow: '0 2px 6px rgba(0,0,0,0.3)',
  },
  daySub: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 16,
    color: '#E8713A',
    fontWeight: 600,
  },
  mapArea: {
    flex: 1,
    position: 'relative',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingTop: '1vh',
  },
  mapInner: {
    position: 'relative',
    width: '92%',
    maxWidth: 1100,
    height: '92%',
  },
  pathSvg: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
  },
};

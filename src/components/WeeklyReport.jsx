import React, { useState, useEffect } from 'react';
import { ref, get } from 'firebase/database';
import { db } from '../firebase';
import { DAYS } from '../data/days';

function formatDate(ts) {
  if (!ts) return '\u2014';
  const d = new Date(ts);
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(startMs, endMs) {
  if (!startMs || !endMs) return null;
  const diff = Math.round((endMs - startMs) / 1000);
  if (diff < 60) return `${diff}s`;
  const mins = Math.floor(diff / 60);
  const secs = diff % 60;
  return `${mins}m ${secs}s`;
}

export default function WeeklyReport({ className: klassenName, onClose }) {
  const [loading, setLoading] = useState(true);
  const [gameState, setGameState] = useState(null);
  const [taskTimings, setTaskTimings] = useState({});
  const [quizResults, setQuizResults] = useState({});
  const [savedBoards, setSavedBoards] = useState({});

  useEffect(() => {
    if (!klassenName) { setLoading(false); return; }
    let cancelled = false;
    Promise.all([
      get(ref(db, 'classes/' + klassenName + '/state')),
      get(ref(db, 'classes/' + klassenName + '/taskTimings')),
      get(ref(db, 'quizResults/' + klassenName)),
      get(ref(db, 'savedBoards')),
    ]).then(([stateSnap, timingsSnap, quizSnap, boardsSnap]) => {
      if (cancelled) return;
      setGameState(stateSnap.val());
      setTaskTimings(timingsSnap.val() || {});
      setQuizResults(quizSnap.val() || {});
      setSavedBoards(boardsSnap.val() || {});
      setLoading(false);
    }).catch((err) => {
      console.error('[WeeklyReport] Error fetching data:', err);
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [klassenName]);

  const handlePrint = () => window.print();

  // Computed values
  const completedSteps = gameState?.completedSteps || {};
  const completedDays = Array.isArray(gameState?.completedDays) ? gameState.completedDays : [];
  const totalSteps = DAYS.reduce((sum, d) => sum + d.steps.length, 0);
  const completedStepCount = Object.keys(completedSteps).length;
  const quizEntries = Object.entries(quizResults);
  const boardEntries = Object.entries(savedBoards);

  if (loading) {
    return (
      <div className="weekly-report-overlay" style={s.overlay}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <div style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 20, fontWeight: 600, color: '#999' }}>
            Bericht wird geladen...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="weekly-report-overlay" style={s.overlay}>
      <div className="weekly-report-content" style={s.content}>

        {/* Cover */}
        <div style={s.coverSection}>
          <h1 style={s.coverTitle}>{'\u{1F4CB}'} Wochenbericht</h1>
          <h2 style={s.coverSubtitle}>Projektwoche Kinderrechte</h2>
          <div style={s.coverMeta}>
            <span style={s.coverClass}>{klassenName}</span>
            <span style={s.coverDate}>{new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
          </div>
        </div>

        {/* Overview */}
        <div className="report-section" style={s.section}>
          <h3 style={s.sectionTitle}>{'\u{1F4CA}'} Übersicht</h3>
          <div style={s.overviewGrid}>
            <div style={s.overviewCard}>
              <span style={s.overviewValue}>{completedDays.length}/5</span>
              <span style={s.overviewLabel}>Tage abgeschlossen</span>
            </div>
            <div style={s.overviewCard}>
              <span style={s.overviewValue}>{completedStepCount}/{totalSteps}</span>
              <span style={s.overviewLabel}>Schritte abgeschlossen</span>
            </div>
            <div style={s.overviewCard}>
              <span style={s.overviewValue}>{quizEntries.length}</span>
              <span style={s.overviewLabel}>Quizze gespielt</span>
            </div>
            <div style={s.overviewCard}>
              <span style={s.overviewValue}>{boardEntries.length}</span>
              <span style={s.overviewLabel}>Boards erstellt</span>
            </div>
          </div>
        </div>

        {/* Day-by-Day */}
        <div className="report-page-break" />
        <div className="report-section" style={s.section}>
          <h3 style={s.sectionTitle}>{'\u{1F4C5}'} Tag für Tag</h3>
          {DAYS.map(day => {
            const dayCompleted = completedDays.includes(day.id);
            const dayStepsCompleted = day.steps.filter(st => completedSteps[st.id]).length;
            return (
              <div key={day.id} style={{ ...s.dayCard, borderLeft: `4px solid ${day.color}` }}>
                <div style={s.dayHeader}>
                  <span style={{ ...s.dayBadge, background: day.color }}>
                    {day.emoji} {day.name}
                  </span>
                  <span style={s.daySub}>{day.sub}</span>
                  <span style={{
                    ...s.dayStatus,
                    background: dayCompleted ? '#E8F5E9' : '#FFF3E0',
                    color: dayCompleted ? '#2E7D32' : '#E65100',
                  }}>
                    {dayCompleted ? '\u2713 Abgeschlossen' : `${dayStepsCompleted}/${day.steps.length} Schritte`}
                  </span>
                </div>
                <div style={s.stepList}>
                  {day.steps.map(step => {
                    const done = !!completedSteps[step.id];
                    const timing = taskTimings[step.id];
                    const duration = timing ? formatDuration(timing.startedAt, timing.completedAt) : null;
                    return (
                      <div key={step.id} style={s.stepRow}>
                        <span style={{ fontSize: 14, color: done ? '#27AE60' : '#CCC', width: 20, textAlign: 'center' }}>
                          {done ? '\u2713' : '\u25CB'}
                        </span>
                        <span style={{ ...s.stepIcon }}>{step.icon}</span>
                        <span style={{ ...s.stepTitle, color: done ? '#333' : '#999' }}>{step.title}</span>
                        {duration && (
                          <span style={s.stepDuration}>{duration}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Board Summaries */}
        {boardEntries.length > 0 && (
          <>
            <div className="report-page-break" />
            <div className="report-section" style={s.section}>
              <h3 style={s.sectionTitle}>{'\u{1F4CC}'} Boards</h3>
              {boardEntries.map(([key, board]) => {
                const columns = board.columns || [];
                const totalPosts = columns.reduce((sum, col) => sum + (col.posts ? Object.keys(col.posts).length : 0), 0);
                return (
                  <div key={key} style={s.boardCard}>
                    <div style={s.boardHeader}>
                      <span style={s.boardTitle}>{board.title || 'Board'}</span>
                      <span style={s.boardMeta}>
                        {formatDate(board.createdAt)} &middot; {totalPosts} Beiträge
                      </span>
                    </div>
                    <div style={s.boardColumns}>
                      {columns.map((col, i) => {
                        const postCount = col.posts ? Object.keys(col.posts).length : 0;
                        return (
                          <div key={i} style={s.boardColChip}>
                            <span style={s.boardColName}>{col.title || `Spalte ${i + 1}`}</span>
                            <span style={s.boardColCount}>{postCount}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Quiz Results */}
        {quizEntries.length > 0 && (
          <>
            <div className="report-page-break" />
            <div className="report-section" style={s.section}>
              <h3 style={s.sectionTitle}>{'\u{1F3AE}'} Quiz-Ergebnisse</h3>
              {quizEntries.map(([code, result]) => {
                const playerEntries = Object.entries(result.players || {});
                const sortedPlayers = playerEntries
                  .map(([name, data]) => ({ name, score: data.score || 0 }))
                  .sort((a, b) => b.score - a.score);
                const top3 = sortedPlayers.slice(0, 3);
                const avgScore = sortedPlayers.length > 0
                  ? Math.round(sortedPlayers.reduce((s, p) => s + p.score, 0) / sortedPlayers.length)
                  : 0;
                const medals = ['\u{1F947}', '\u{1F948}', '\u{1F949}'];

                // Find hardest question (lowest % correct)
                let hardestQ = null;
                const questions = result.questions || [];
                const answers = result.answers || {};
                let lowestPct = 101;
                questions.forEach((q, qIdx) => {
                  if (q.type === 'wordcloud') return;
                  const qAnswers = answers[qIdx] || {};
                  const totalA = Object.keys(qAnswers).length;
                  if (totalA === 0) return;
                  let correct = 0;
                  Object.values(qAnswers).forEach(ans => {
                    if (q.type === 'mc' || q.type === 'tf') {
                      if (ans.answer === q.correctIndex) correct++;
                    } else if (q.type === 'open') {
                      const accepted = q.acceptedAnswers || [];
                      const sa = (ans.answer || '').trim();
                      if (q.ignoreCase !== false
                        ? accepted.some(a => a.trim().toLowerCase() === sa.toLowerCase())
                        : accepted.some(a => a.trim() === sa)) correct++;
                    } else if (q.type === 'sorting') {
                      const order = Array.isArray(ans.answer) ? ans.answer : [];
                      if ((q.items || []).every((_, i) => order[i] === i)) correct++;
                    } else if (q.type === 'slider') {
                      const val = typeof ans.answer === 'number' ? ans.answer : 0;
                      if (Math.abs(val - q.correctValue) <= (q.tolerance || 1)) correct++;
                    }
                  });
                  const pct = Math.round((correct / totalA) * 100);
                  if (pct < lowestPct) {
                    lowestPct = pct;
                    hardestQ = { text: q.text, pct, qNum: qIdx + 1 };
                  }
                });

                return (
                  <div key={code} style={s.quizCard}>
                    <div style={s.quizHeader}>
                      <span style={s.quizTitle}>{result.quizTitle || 'Quiz'}</span>
                      <span style={s.quizMeta}>
                        {formatDate(result.savedAt)} &middot; {result.playerCount || playerEntries.length} Spieler &middot; {result.questionCount || questions.length} Fragen
                      </span>
                    </div>
                    <div style={s.quizStats}>
                      <div style={s.quizStatItem}>
                        <span style={s.quizStatValue}>{avgScore}</span>
                        <span style={s.quizStatLabel}>Durchschnitt</span>
                      </div>
                      {top3.map((p, i) => (
                        <div key={p.name} style={s.quizStatItem}>
                          <span style={s.quizStatValue}>{medals[i]} {p.name}</span>
                          <span style={s.quizStatLabel}>{p.score} Punkte</span>
                        </div>
                      ))}
                    </div>
                    {hardestQ && (
                      <div style={s.hardestQ}>
                        <span style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 13, fontWeight: 600, color: '#C62828' }}>
                          Schwierigste Frage (#{hardestQ.qNum}): {hardestQ.pct}% richtig
                        </span>
                        <span style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 12, color: '#999', fontStyle: 'italic' }}>
                          "{hardestQ.text}"
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Footer */}
        <div className="no-print" style={s.footer}>
          <button onClick={handlePrint} style={s.printBtn}>
            {'\u{1F5A8}\uFE0F'} Als PDF drucken
          </button>
          <button onClick={onClose} style={s.closeBtn}>
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
}

const s = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 9600,
    background: 'rgba(255, 250, 245, 0.98)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    overflowY: 'auto',
  },
  content: {
    maxWidth: 800,
    margin: '0 auto',
    padding: '24px 20px 60px',
  },
  // Cover
  coverSection: {
    textAlign: 'center',
    padding: '40px 20px 32px',
    marginBottom: 32,
    background: 'linear-gradient(160deg, #FFE5D9 0%, #D4E4F7 100%)',
    borderRadius: 20,
  },
  coverTitle: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 36,
    color: '#333',
    margin: '0 0 6px',
  },
  coverSubtitle: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 18,
    fontWeight: 600,
    color: '#666',
    margin: '0 0 16px',
  },
  coverMeta: {
    display: 'flex',
    gap: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverClass: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 16,
    fontWeight: 700,
    background: 'white',
    padding: '4px 16px',
    borderRadius: 10,
    color: '#333',
  },
  coverDate: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 14,
    fontWeight: 600,
    color: '#777',
  },
  // Section
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 22,
    color: '#333',
    margin: '0 0 14px',
  },
  // Overview
  overviewGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: 12,
  },
  overviewCard: {
    background: 'white',
    borderRadius: 14,
    padding: '20px 16px',
    textAlign: 'center',
    boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  overviewValue: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 28,
    color: '#FF6B35',
  },
  overviewLabel: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 13,
    fontWeight: 600,
    color: '#777',
  },
  // Day card
  dayCard: {
    background: 'white',
    borderRadius: 14,
    padding: '16px 20px',
    marginBottom: 12,
    boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
  },
  dayHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  dayBadge: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 16,
    color: 'white',
    padding: '3px 14px',
    borderRadius: 10,
  },
  daySub: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 14,
    fontWeight: 600,
    color: '#666',
    flex: 1,
  },
  dayStatus: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 12,
    fontWeight: 700,
    padding: '3px 10px',
    borderRadius: 8,
  },
  stepList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  stepRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '4px 0',
  },
  stepIcon: {
    fontSize: 14,
    width: 20,
    textAlign: 'center',
    flexShrink: 0,
  },
  stepTitle: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 14,
    fontWeight: 600,
    flex: 1,
  },
  stepDuration: {
    fontFamily: "'Baloo 2', cursive",
    fontSize: 12,
    fontWeight: 700,
    color: '#999',
    background: '#F5F5F5',
    padding: '2px 8px',
    borderRadius: 6,
  },
  // Board card
  boardCard: {
    background: 'white',
    borderRadius: 14,
    padding: '14px 18px',
    marginBottom: 10,
    boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
  },
  boardHeader: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 10,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  boardTitle: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 16,
    fontWeight: 700,
    color: '#333',
  },
  boardMeta: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 12,
    fontWeight: 500,
    color: '#999',
  },
  boardColumns: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
  boardColChip: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: '#F5F5F5',
    padding: '4px 10px',
    borderRadius: 8,
  },
  boardColName: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 13,
    fontWeight: 600,
    color: '#555',
  },
  boardColCount: {
    fontFamily: "'Baloo 2', cursive",
    fontSize: 13,
    fontWeight: 700,
    color: '#999',
  },
  // Quiz card
  quizCard: {
    background: 'white',
    borderRadius: 14,
    padding: '16px 20px',
    marginBottom: 12,
    boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
  },
  quizHeader: {
    marginBottom: 10,
  },
  quizTitle: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 16,
    fontWeight: 700,
    color: '#333',
    display: 'block',
  },
  quizMeta: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 12,
    fontWeight: 500,
    color: '#999',
  },
  quizStats: {
    display: 'flex',
    gap: 12,
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  quizStatItem: {
    display: 'flex',
    flexDirection: 'column',
    background: '#F8F8F8',
    padding: '8px 14px',
    borderRadius: 10,
  },
  quizStatValue: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 14,
    fontWeight: 700,
    color: '#333',
  },
  quizStatLabel: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 11,
    fontWeight: 500,
    color: '#999',
  },
  hardestQ: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    background: '#FFEBEE',
    padding: '8px 12px',
    borderRadius: 8,
  },
  // Footer
  footer: {
    display: 'flex',
    gap: 10,
    justifyContent: 'center',
    marginTop: 24,
  },
  printBtn: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 16,
    padding: '12px 28px',
    color: 'white',
    background: '#FF6B35',
    border: 'none',
    borderRadius: 14,
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
  },
  closeBtn: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 16,
    fontWeight: 600,
    padding: '12px 28px',
    background: 'rgba(0,0,0,0.06)',
    color: '#666',
    border: 'none',
    borderRadius: 14,
    cursor: 'pointer',
  },
};

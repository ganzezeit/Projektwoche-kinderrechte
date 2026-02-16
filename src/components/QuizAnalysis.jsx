import React from 'react';

const CLOUD_COLORS = ['#E74C3C', '#2980B9', '#9B59B6', '#FF6B35', '#00B4D8', '#27AE60', '#F1C40F', '#E91E63'];
const MC_COLORS = ['#E74C3C', '#2980B9', '#F1C40F', '#27AE60'];
const MC_SHAPES = ['\u25B2', '\u25CF', '\u25A0', '\u25C6'];

function WordCloudDisplay({ words }) {
  const grouped = {};
  words.forEach(w => {
    const key = (w.word || '').trim().toLowerCase();
    if (!key) return;
    if (!grouped[key]) grouped[key] = { word: w.word, count: 0 };
    grouped[key].count++;
  });
  const entries = Object.values(grouped).sort((a, b) => b.count - a.count);
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 8, padding: '8px 0' }}>
      {entries.map((entry, i) => {
        const fontSize = Math.min(48, 14 + entry.count * 10);
        return (
          <span key={entry.word.toLowerCase()} style={{
            fontFamily: "'Lilita One', cursive",
            fontSize,
            color: CLOUD_COLORS[i % CLOUD_COLORS.length],
            padding: '2px 8px',
            display: 'inline-block',
          }}>
            {entry.word} <span style={{ fontSize: 12, opacity: 0.6 }}>({entry.count})</span>
          </span>
        );
      })}
    </div>
  );
}

function getCorrectCountForPlayer(name, questions, answers) {
  let correct = 0;
  questions.forEach((q, qIdx) => {
    const ans = answers?.[qIdx]?.[name];
    if (!ans) return;
    if (q.type === 'wordcloud') return;
    if (q.type === 'mc' || q.type === 'tf') {
      if (ans.answer === q.correctIndex) correct++;
    } else if (q.type === 'open') {
      const accepted = q.acceptedAnswers || [];
      const studentAnswer = (ans.answer || '').trim();
      const match = q.ignoreCase !== false
        ? accepted.some(a => a.trim().toLowerCase() === studentAnswer.toLowerCase())
        : accepted.some(a => a.trim() === studentAnswer);
      if (match) correct++;
    } else if (q.type === 'sorting') {
      const order = Array.isArray(ans.answer) ? ans.answer : [];
      const allRight = (q.items || []).every((_, i) => order[i] === i);
      if (allRight) correct++;
    } else if (q.type === 'slider') {
      const val = typeof ans.answer === 'number' ? ans.answer : 0;
      if (Math.abs(val - q.correctValue) <= (q.tolerance || 1)) correct++;
    }
  });
  return correct;
}

export default function QuizAnalysis({ quiz, sessionSnapshot, leaderboard, dayColor, onClose }) {
  const color = dayColor || '#FF6B35';
  const questions = quiz.questions || [];
  const allAnswers = sessionSnapshot?.answers || {};
  const allWordCloud = sessionSnapshot?.wordCloud || {};
  const players = sessionSnapshot?.players || {};

  // Scorable question count (excluding wordcloud)
  const scorableCount = questions.filter(q => q.type !== 'wordcloud').length;

  // Enhanced leaderboard with correct count + accuracy
  const enhancedLeaderboard = leaderboard.map(entry => {
    const correctCount = getCorrectCountForPlayer(entry.name, questions, allAnswers);
    const accuracy = scorableCount > 0 ? Math.round((correctCount / scorableCount) * 100) : 0;
    return { ...entry, correctCount, accuracy };
  });

  const handlePrint = () => window.print();

  return (
    <div className="quiz-analysis-overlay" style={s.overlay}>
      <div className="quiz-analysis-content" style={s.content}>
        {/* Header */}
        <div style={s.header}>
          <h1 style={{ ...s.title, color }}>{'\u{1F4CA}'} Quiz-Analyse</h1>
          <h2 style={s.subtitle}>{quiz.title}</h2>
          <div className="no-print" style={s.actionBar}>
            <button onClick={handlePrint} style={{ ...s.actionBtn, background: color }}>
              {'\u{1F5A8}\uFE0F'} Als PDF speichern
            </button>
            <button onClick={onClose} style={s.closeBtn}>Schließen</button>
          </div>
        </div>

        {/* Enhanced Leaderboard */}
        <div style={s.section}>
          <h3 style={s.sectionTitle}>{'\u{1F3C6}'} Rangliste</h3>
          <div style={s.table}>
            <div style={s.tableHeader}>
              <span style={{ ...s.tableCell, width: 50 }}>Rang</span>
              <span style={{ ...s.tableCell, flex: 1 }}>Name</span>
              <span style={{ ...s.tableCell, width: 80, textAlign: 'right' }}>Punkte</span>
              <span style={{ ...s.tableCell, width: 70, textAlign: 'right' }}>Richtig</span>
              <span style={{ ...s.tableCell, width: 80, textAlign: 'right' }}>Genauigkeit</span>
            </div>
            {enhancedLeaderboard.map((entry, i) => {
              const medals = ['\u{1F947}', '\u{1F948}', '\u{1F949}'];
              return (
                <div key={entry.name} style={{
                  ...s.tableRow,
                  background: i < 3 ? ['#FFF8E1', '#F5F5F5', '#FFF3E0'][i] : (i % 2 === 0 ? '#FAFAFA' : 'white'),
                }}>
                  <span style={{ ...s.tableCell, width: 50, fontWeight: 700, fontSize: 18 }}>
                    {i < 3 ? medals[i] : `${i + 1}.`}
                  </span>
                  <span style={{ ...s.tableCell, flex: 1, fontWeight: 600 }}>{entry.name}</span>
                  <span style={{ ...s.tableCell, width: 80, textAlign: 'right', fontFamily: "'Baloo 2', cursive", fontWeight: 700 }}>
                    {entry.score}
                  </span>
                  <span style={{ ...s.tableCell, width: 70, textAlign: 'right', fontFamily: "'Baloo 2', cursive", fontWeight: 700, color: '#27AE60' }}>
                    {entry.correctCount}/{scorableCount}
                  </span>
                  <span style={{ ...s.tableCell, width: 80, textAlign: 'right', fontFamily: "'Baloo 2', cursive", fontWeight: 700, color: entry.accuracy >= 70 ? '#27AE60' : entry.accuracy >= 40 ? '#F39C12' : '#E74C3C' }}>
                    {entry.accuracy}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Per-Question Analysis */}
        <div style={s.section}>
          <h3 style={s.sectionTitle}>{'\u{1F4DD}'} Fragen-Analyse</h3>
          {questions.map((q, qIdx) => (
            <QuestionAnalysis
              key={qIdx}
              question={q}
              questionIndex={qIdx}
              answers={allAnswers[qIdx] || {}}
              wordCloudEntries={allWordCloud[qIdx] ? Object.values(allWordCloud[qIdx]) : []}
              playerNames={Object.keys(players)}
              color={color}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="no-print" style={s.footer}>
          <button onClick={handlePrint} style={{ ...s.actionBtn, background: color }}>
            {'\u{1F5A8}\uFE0F'} Als PDF speichern
          </button>
          <button onClick={onClose} style={s.closeBtn}>Schließen</button>
        </div>
      </div>
    </div>
  );
}

function QuestionAnalysis({ question: q, questionIndex: qIdx, answers, wordCloudEntries, playerNames, color }) {
  const answerEntries = Object.entries(answers);
  const totalAnswers = answerEntries.length;
  const typeLabels = { mc: 'Multiple Choice', tf: 'Wahr/Falsch', open: 'Offene Frage', wordcloud: 'Wortwolke', sorting: 'Sortierung', slider: 'Schieberegler' };

  return (
    <div style={s.questionCard}>
      <div style={s.questionHeader}>
        <span style={{ ...s.qBadge, background: color }}>Frage {qIdx + 1}</span>
        <span style={s.qType}>{typeLabels[q.type] || q.type}</span>
      </div>
      <p style={s.qText}>{q.text}</p>

      {/* MC / TF */}
      {(q.type === 'mc' || q.type === 'tf') && (() => {
        const options = q.options || [];
        const counts = options.map(() => 0);
        let correctCount = 0;
        answerEntries.forEach(([, ans]) => {
          if (ans.answer >= 0 && ans.answer < options.length) counts[ans.answer]++;
          if (ans.answer === q.correctIndex) correctCount++;
        });
        const maxCount = Math.max(...counts, 1);
        const pctCorrect = totalAnswers > 0 ? Math.round((correctCount / totalAnswers) * 100) : 0;
        const isMc = q.type === 'mc';

        return (
          <>
            <div style={s.barChart}>
              {options.map((opt, oi) => {
                const isCorrect = oi === q.correctIndex;
                const bgColor = isMc ? MC_COLORS[oi] : (oi === 0 ? '#27AE60' : '#E74C3C');
                const barWidth = counts[oi] > 0 ? Math.max(8, (counts[oi] / maxCount) * 100) : 3;
                return (
                  <div key={oi} style={s.barRow}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 16, color: bgColor }}>{isMc ? MC_SHAPES[oi] : (oi === 0 ? '\u2713' : '\u2717')}</span>
                      <span style={s.barLabel}>{opt}</span>
                      {isCorrect && <span style={s.correctBadge}>{'\u2713'} richtig</span>}
                    </div>
                    <div style={s.barTrack}>
                      <div style={{ height: 20, borderRadius: 10, width: `${barWidth}%`, background: isCorrect ? '#27AE60' : bgColor, opacity: isCorrect ? 1 : 0.4, transition: 'width 0.3s' }} />
                      <span style={s.barCount}>{counts[oi]}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={s.statRow}>
              <span style={{ ...s.statChip, background: '#E8F5E9', color: '#2E7D32' }}>{pctCorrect}% richtig</span>
              <span style={{ ...s.statChip, background: '#F5F5F5', color: '#666' }}>{totalAnswers} Antworten</span>
            </div>
          </>
        );
      })()}

      {/* Open */}
      {q.type === 'open' && (() => {
        const accepted = q.acceptedAnswers || [];
        let correctCount = 0;
        const answerList = answerEntries.map(([name, ans]) => {
          const studentAnswer = (ans.answer || '').trim();
          const isCorrect = q.ignoreCase !== false
            ? accepted.some(a => a.trim().toLowerCase() === studentAnswer.toLowerCase())
            : accepted.some(a => a.trim() === studentAnswer);
          if (isCorrect) correctCount++;
          return { name, answer: studentAnswer, isCorrect };
        });
        const pctCorrect = totalAnswers > 0 ? Math.round((correctCount / totalAnswers) * 100) : 0;

        return (
          <>
            <div style={{ ...s.infoBox, background: '#E8F5E9' }}>
              <span style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 14, fontWeight: 600, color: '#2E7D32' }}>
                Akzeptierte Antworten: {accepted.join(', ')}
              </span>
            </div>
            <div style={s.answerList}>
              {answerList.map((a, i) => (
                <div key={i} style={{ ...s.answerRow, background: a.isCorrect ? '#E8F5E9' : '#FFEBEE' }}>
                  <span style={{ fontSize: 16, color: a.isCorrect ? '#2E7D32' : '#C62828' }}>{a.isCorrect ? '\u2713' : '\u2717'}</span>
                  <span style={{ flex: 1, fontFamily: "'Fredoka', sans-serif", fontSize: 14, fontWeight: 600, color: '#555' }}>{a.name}</span>
                  <span style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 14, fontWeight: 700, color: a.isCorrect ? '#2E7D32' : '#C62828' }}>{a.answer || '\u2014'}</span>
                </div>
              ))}
            </div>
            <div style={s.statRow}>
              <span style={{ ...s.statChip, background: '#E8F5E9', color: '#2E7D32' }}>{pctCorrect}% richtig</span>
              <span style={{ ...s.statChip, background: '#F5F5F5', color: '#666' }}>{totalAnswers} Antworten</span>
            </div>
          </>
        );
      })()}

      {/* WordCloud */}
      {q.type === 'wordcloud' && (() => {
        const uniqueAuthors = new Set(wordCloudEntries.map(e => e.author)).size;
        // Top words
        const grouped = {};
        wordCloudEntries.forEach(w => {
          const key = (w.word || '').trim().toLowerCase();
          if (!key) return;
          if (!grouped[key]) grouped[key] = { word: w.word, count: 0 };
          grouped[key].count++;
        });
        const topWords = Object.values(grouped).sort((a, b) => b.count - a.count).slice(0, 10);

        return (
          <>
            {wordCloudEntries.length > 0 && (
              <div style={{ background: 'white', borderRadius: 14, padding: '16px 20px', border: '1px solid #eee' }}>
                <WordCloudDisplay words={wordCloudEntries} />
              </div>
            )}
            {topWords.length > 0 && (
              <div style={s.answerList}>
                <div style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 13, fontWeight: 600, color: '#777', marginBottom: 4 }}>Top Wörter:</div>
                {topWords.map((tw, i) => (
                  <div key={i} style={{ ...s.answerRow, background: '#F5F5F5' }}>
                    <span style={{ fontFamily: "'Baloo 2', cursive", fontSize: 16, fontWeight: 700, color: CLOUD_COLORS[i % CLOUD_COLORS.length], width: 28, textAlign: 'center' }}>{i + 1}.</span>
                    <span style={{ flex: 1, fontFamily: "'Fredoka', sans-serif", fontSize: 14, fontWeight: 600, color: '#333' }}>{tw.word}</span>
                    <span style={{ fontFamily: "'Baloo 2', cursive", fontSize: 14, fontWeight: 700, color: '#666' }}>{tw.count}x</span>
                  </div>
                ))}
              </div>
            )}
            <div style={s.statRow}>
              <span style={{ ...s.statChip, background: '#E3F2FD', color: '#1976D2' }}>{wordCloudEntries.length} Wörter</span>
              <span style={{ ...s.statChip, background: '#F5F5F5', color: '#666' }}>{uniqueAuthors} Spieler</span>
            </div>
          </>
        );
      })()}

      {/* Sorting */}
      {q.type === 'sorting' && (() => {
        const items = q.items || [];
        const positionCorrect = items.map(() => 0);
        let allCorrectCount = 0;
        answerEntries.forEach(([, ans]) => {
          const order = Array.isArray(ans.answer) ? ans.answer : [];
          let allRight = true;
          for (let i = 0; i < items.length; i++) {
            if (order[i] === i) positionCorrect[i]++;
            else allRight = false;
          }
          if (allRight) allCorrectCount++;
        });

        return (
          <>
            <div style={{ ...s.infoBox, background: '#FFF3E0' }}>
              <span style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 14, fontWeight: 600, color: '#E65100' }}>Richtige Reihenfolge:</span>
            </div>
            <div style={s.answerList}>
              {items.map((item, i) => {
                const pct = totalAnswers > 0 ? Math.round((positionCorrect[i] / totalAnswers) * 100) : 0;
                return (
                  <div key={i} style={{ ...s.answerRow, background: '#F8F8F8' }}>
                    <span style={{ fontFamily: "'Baloo 2', cursive", fontSize: 18, fontWeight: 800, color: '#D35400', width: 28, textAlign: 'center' }}>{i + 1}.</span>
                    <span style={{ flex: 1, fontFamily: "'Fredoka', sans-serif", fontSize: 15, fontWeight: 600, color: '#333' }}>{item}</span>
                    <span style={{ fontFamily: "'Baloo 2', cursive", fontSize: 14, fontWeight: 700, color: pct >= 70 ? '#27AE60' : pct >= 40 ? '#F39C12' : '#E74C3C' }}>{pct}%</span>
                  </div>
                );
              })}
            </div>
            <div style={s.statRow}>
              <span style={{ ...s.statChip, background: '#E8F5E9', color: '#2E7D32' }}>{allCorrectCount} alles richtig</span>
              <span style={{ ...s.statChip, background: '#F5F5F5', color: '#666' }}>{totalAnswers} Antworten</span>
            </div>
          </>
        );
      })()}

      {/* Slider */}
      {q.type === 'slider' && (() => {
        const answerList = answerEntries.map(([name, ans]) => {
          const val = typeof ans.answer === 'number' ? ans.answer : 0;
          const distance = Math.abs(val - q.correctValue);
          return { name, value: val, distance };
        }).sort((a, b) => a.distance - b.distance);
        const withinTol = answerList.filter(a => a.distance <= (q.tolerance || 1)).length;
        const pctInTol = totalAnswers > 0 ? Math.round((withinTol / totalAnswers) * 100) : 0;

        return (
          <>
            <div style={{ ...s.infoBox, background: '#E8F5E9', textAlign: 'center' }}>
              <div style={{ fontFamily: "'Lilita One', cursive", fontSize: 28, color: '#2E7D32' }}>
                {q.correctValue}{q.unit ? ` ${q.unit}` : ''}
              </div>
              <div style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 13, fontWeight: 600, color: '#2E7D32' }}>
                Toleranz: \u00B1{q.tolerance}{q.unit ? ` ${q.unit}` : ''}
              </div>
            </div>
            <div style={s.answerList}>
              {answerList.map((a, i) => {
                const inTol = a.distance <= (q.tolerance || 1);
                return (
                  <div key={i} style={{ ...s.answerRow, background: inTol ? '#E8F5E9' : '#FFEBEE' }}>
                    <span style={{ fontSize: 16, color: inTol ? '#2E7D32' : '#C62828' }}>{inTol ? '\u2713' : '\u2717'}</span>
                    <span style={{ flex: 1, fontFamily: "'Fredoka', sans-serif", fontSize: 14, fontWeight: 600, color: '#555' }}>{a.name}</span>
                    <span style={{ fontFamily: "'Baloo 2', cursive", fontSize: 16, fontWeight: 700, color: inTol ? '#2E7D32' : '#C62828' }}>
                      {a.value}{q.unit ? ` ${q.unit}` : ''}
                    </span>
                    <span style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 11, color: '#999' }}>(\u00B1{a.distance})</span>
                  </div>
                );
              })}
            </div>
            <div style={s.statRow}>
              <span style={{ ...s.statChip, background: '#E8F5E9', color: '#2E7D32' }}>{pctInTol}% im Toleranzbereich</span>
              <span style={{ ...s.statChip, background: '#F5F5F5', color: '#666' }}>{totalAnswers} Antworten</span>
            </div>
          </>
        );
      })()}
    </div>
  );
}

const s = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 10001,
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
  header: {
    textAlign: 'center',
    marginBottom: 32,
  },
  title: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 32,
    margin: '0 0 4px',
  },
  subtitle: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 18,
    fontWeight: 600,
    color: '#777',
    margin: '0 0 16px',
  },
  actionBar: {
    display: 'flex',
    gap: 10,
    justifyContent: 'center',
  },
  actionBtn: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 16,
    padding: '10px 24px',
    color: 'white',
    border: 'none',
    borderRadius: 12,
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
  },
  closeBtn: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 16,
    fontWeight: 600,
    padding: '10px 24px',
    background: 'rgba(0,0,0,0.06)',
    color: '#666',
    border: 'none',
    borderRadius: 12,
    cursor: 'pointer',
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 22,
    color: '#333',
    margin: '0 0 14px',
  },
  // Table
  table: {
    background: 'white',
    borderRadius: 16,
    overflow: 'hidden',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
  },
  tableHeader: {
    display: 'flex',
    padding: '10px 16px',
    background: '#F5F5F5',
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 13,
    fontWeight: 700,
    color: '#777',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    display: 'flex',
    padding: '10px 16px',
    alignItems: 'center',
    borderTop: '1px solid #F0F0F0',
  },
  tableCell: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 15,
    color: '#333',
  },
  // Question card
  questionCard: {
    background: 'white',
    borderRadius: 16,
    padding: '20px 24px',
    marginBottom: 16,
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  questionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  qBadge: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 13,
    fontWeight: 700,
    color: 'white',
    padding: '3px 12px',
    borderRadius: 8,
  },
  qType: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 13,
    fontWeight: 600,
    color: '#999',
  },
  qText: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 20,
    color: '#333',
    margin: 0,
    lineHeight: 1.4,
  },
  // Bar chart
  barChart: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  barRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
  },
  barLabel: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 14,
    fontWeight: 600,
    color: '#333',
  },
  correctBadge: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 11,
    fontWeight: 700,
    color: '#27AE60',
    background: '#E8F5E9',
    padding: '2px 8px',
    borderRadius: 6,
  },
  barTrack: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  barCount: {
    fontFamily: "'Baloo 2', cursive",
    fontSize: 14,
    fontWeight: 700,
    color: '#555',
    minWidth: 20,
  },
  // Info box
  infoBox: {
    borderRadius: 10,
    padding: '10px 14px',
  },
  // Answer list
  answerList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  answerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 10px',
    borderRadius: 8,
  },
  // Stats
  statRow: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
  statChip: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 13,
    fontWeight: 700,
    padding: '4px 12px',
    borderRadius: 8,
  },
  // Footer
  footer: {
    display: 'flex',
    gap: 10,
    justifyContent: 'center',
    marginTop: 24,
  },
};

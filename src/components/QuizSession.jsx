import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ref, set, get, onValue, update } from 'firebase/database';
import { db } from '../firebase';
import { QRCodeSVG } from 'qrcode.react';
import Confetti from './Confetti';

const QuizAnalysis = React.lazy(() => import('./QuizAnalysis'));

const MC_COLORS = ['#E74C3C', '#2980B9', '#F1C40F', '#27AE60'];
const MC_SHAPES = ['\u25B2', '\u25CF', '\u25A0', '\u25C6'];
const CLOUD_COLORS = ['#E74C3C', '#2980B9', '#9B59B6', '#FF6B35', '#00B4D8', '#27AE60', '#F1C40F', '#E91E63'];

function calculatePoints(answeredAt, questionStartedAt, timeLimit) {
  const elapsed = (answeredAt - questionStartedAt) / 1000;
  const timeFraction = Math.max(0, Math.min(1, 1 - elapsed / timeLimit));
  return Math.round(500 + 500 * timeFraction);
}

function ConfirmDialog({ message, confirmLabel, onConfirm, onCancel, danger }) {
  return (
    <div style={s.confirmOverlay}>
      <div style={s.confirmCard}>
        <p style={s.confirmText}>{message}</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button onClick={onConfirm} style={{ ...s.confirmBtn, background: danger ? '#E74C3C' : '#FF6B35' }}>
            {confirmLabel}
          </button>
          <button onClick={onCancel} style={s.confirmCancelBtn}>Abbrechen</button>
        </div>
      </div>
    </div>
  );
}

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
    <div style={s.wordCloud}>
      {entries.map((entry, i) => {
        const fontSize = Math.min(60, 16 + entry.count * 12);
        return (
          <span
            key={entry.word.toLowerCase()}
            style={{
              fontFamily: "'Lilita One', cursive",
              fontSize,
              color: CLOUD_COLORS[i % CLOUD_COLORS.length],
              padding: '4px 10px',
              display: 'inline-block',
              transform: `rotate(${((i * 7) % 11) - 5}deg)`,
              transition: 'font-size 0.3s ease',
            }}
          >
            {entry.word}
          </span>
        );
      })}
    </div>
  );
}

function QuestionImage({ url }) {
  if (!url) return null;
  return (
    <div style={{ textAlign: 'center', margin: '8px 0' }}>
      <img src={url} alt="" style={{ maxWidth: '100%', maxHeight: 240, borderRadius: 12, objectFit: 'contain' }} />
    </div>
  );
}

export default function QuizSession({ quiz, sessionCode, onEnd, dayColor, className: klassenName }) {
  const color = dayColor || '#FF6B35';
  const questions = quiz.questions || [];
  const totalQ = questions.length;

  const [phase, setPhase] = useState('lobby');
  const [currentQ, setCurrentQ] = useState(-1);
  const [players, setPlayers] = useState({});
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [confirm, setConfirm] = useState(null);
  const [questionStartedAt, setQuestionStartedAt] = useState(null);
  const [wordCloudEntries, setWordCloudEntries] = useState([]);
  const [shuffledOrder, setShuffledOrder] = useState(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [sessionSnapshot, setSessionSnapshot] = useState(null);

  const timerRef = useRef(null);
  const sessionRef = useRef(ref(db, 'sessions/' + sessionCode));

  const quizUrl = `${window.location.origin}/quiz/${sessionCode}`;

  // Subscribe to players
  useEffect(() => {
    const playersRef = ref(db, 'sessions/' + sessionCode + '/players');
    const unsub = onValue(playersRef, (snap) => {
      setPlayers(snap.val() || {});
    });
    return () => unsub();
  }, [sessionCode]);

  // Subscribe to answers for current question
  useEffect(() => {
    if (currentQ < 0) return;
    const answersRef = ref(db, 'sessions/' + sessionCode + '/answers/' + currentQ);
    const unsub = onValue(answersRef, (snap) => {
      setAnswers(snap.val() || {});
    });
    return () => unsub();
  }, [sessionCode, currentQ]);

  // Subscribe to word cloud entries for wordcloud questions
  useEffect(() => {
    if (currentQ < 0) return;
    const q = questions[currentQ];
    if (!q || q.type !== 'wordcloud') {
      setWordCloudEntries([]);
      return;
    }
    const wcRef = ref(db, 'sessions/' + sessionCode + '/wordCloud/' + currentQ);
    const unsub = onValue(wcRef, (snap) => {
      const data = snap.val();
      setWordCloudEntries(data ? Object.values(data) : []);
    });
    return () => unsub();
  }, [sessionCode, currentQ, questions]);

  // Timer countdown (not for wordcloud)
  useEffect(() => {
    if (phase !== 'question' || timeLeft <= 0) return;
    const q = questions[currentQ];
    if (q && q.type === 'wordcloud') return;
    timerRef.current = setTimeout(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          showResults();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearTimeout(timerRef.current);
  }, [phase, timeLeft]);

  // Auto-advance when all players answered (not for wordcloud)
  useEffect(() => {
    if (phase !== 'question') return;
    const q = questions[currentQ];
    if (q && q.type === 'wordcloud') return;
    const playerNames = Object.keys(players);
    const answerNames = Object.keys(answers);
    if (playerNames.length > 0 && answerNames.length >= playerNames.length) {
      clearTimeout(timerRef.current);
      showResults();
    }
  }, [answers, players, phase]);

  const startQuiz = useCallback(() => {
    goToQuestion(0);
  }, []);

  const goToQuestion = useCallback((qIdx) => {
    const q = questions[qIdx];
    if (!q) return;
    setCurrentQ(qIdx);
    setAnswers({});
    setWordCloudEntries([]);
    setShuffledOrder(null);

    if (q.type === 'wordcloud') {
      setTimeLeft(0);
      setQuestionStartedAt(null);
      setPhase('question');
      update(sessionRef.current, {
        status: 'question',
        currentQuestion: qIdx,
        questionStartedAt: null,
      }).catch(console.error);
    } else if (q.type === 'sorting') {
      // Fisher-Yates shuffle
      const indices = q.items.map((_, i) => i);
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }
      setShuffledOrder(indices);
      const now = Date.now();
      setTimeLeft(q.timeLimit);
      setQuestionStartedAt(now);
      setPhase('question');
      update(sessionRef.current, {
        status: 'question',
        currentQuestion: qIdx,
        questionStartedAt: now,
        shuffledOrder: indices,
      }).catch(console.error);
    } else {
      const now = Date.now();
      setTimeLeft(q.timeLimit);
      setQuestionStartedAt(now);
      setPhase('question');
      update(sessionRef.current, {
        status: 'question',
        currentQuestion: qIdx,
        questionStartedAt: now,
      }).catch(console.error);
    }
  }, [questions]);

  const showResults = useCallback(() => {
    setPhase('results');
    clearTimeout(timerRef.current);

    const q = questions[currentQ];
    if (!q) return;

    // Word cloud has no scoring
    if (q.type === 'wordcloud') {
      update(sessionRef.current, { status: 'results' }).catch(console.error);
      return;
    }

    const updates = {};
    const playersCopy = { ...players };

    Object.entries(answers).forEach(([name, ans]) => {
      let isCorrect = false;
      let points = 0;

      if (q.type === 'sorting') {
        const studentOrder = Array.isArray(ans.answer) ? ans.answer : [];
        const itemCount = (q.items || []).length;
        let correctPositions = 0;
        for (let i = 0; i < itemCount; i++) {
          if (studentOrder[i] === i) correctPositions++;
        }
        isCorrect = correctPositions === itemCount;
        const basePoints = correctPositions * 200 + (isCorrect ? 200 : 0);
        if (questionStartedAt) {
          const elapsed = (ans.answeredAt - questionStartedAt) / 1000;
          const timeFactor = Math.max(0.5, Math.min(1, 1 - elapsed / q.timeLimit));
          points = Math.round(basePoints * timeFactor);
        } else {
          points = basePoints;
        }
      } else if (q.type === 'slider') {
        const studentValue = typeof ans.answer === 'number' ? ans.answer : 0;
        const distance = Math.abs(studentValue - q.correctValue);
        const tol = q.tolerance || 1;
        let basePoints = 0;
        if (distance <= tol) basePoints = 1000;
        else if (distance <= tol * 2) basePoints = 800;
        else if (distance <= tol * 4) basePoints = 500;
        else if (distance <= tol * 8) basePoints = 200;
        isCorrect = distance <= tol;
        if (questionStartedAt) {
          const elapsed = (ans.answeredAt - questionStartedAt) / 1000;
          const timeFactor = Math.max(0.5, Math.min(1, 1 - elapsed / q.timeLimit));
          points = Math.round(basePoints * timeFactor);
        } else {
          points = basePoints;
        }
      } else if (q.type === 'open') {
        const studentAnswer = (ans.answer || '').trim();
        const accepted = q.acceptedAnswers || [];
        if (q.ignoreCase !== false) {
          isCorrect = accepted.some(a => a.trim().toLowerCase() === studentAnswer.toLowerCase());
        } else {
          isCorrect = accepted.some(a => a.trim() === studentAnswer);
        }
        if (isCorrect && questionStartedAt) {
          points = calculatePoints(ans.answeredAt, questionStartedAt, q.timeLimit);
        }
      } else {
        isCorrect = ans.answer === q.correctIndex;
        if (isCorrect && questionStartedAt) {
          points = calculatePoints(ans.answeredAt, questionStartedAt, q.timeLimit);
        }
      }

      const prevScore = playersCopy[name]?.score || 0;
      const prevStreak = playersCopy[name]?.streak || 0;
      const newStreak = isCorrect ? prevStreak + 1 : 0;
      const newScore = prevScore + points;

      updates['players/' + name + '/score'] = newScore;
      updates['players/' + name + '/streak'] = newStreak;
      playersCopy[name] = { ...playersCopy[name], score: newScore, streak: newStreak };
    });

    // Reset streak for no-answer players
    Object.keys(playersCopy).forEach(name => {
      if (!answers[name]) {
        updates['players/' + name + '/streak'] = 0;
      }
    });

    updates['status'] = 'results';
    update(sessionRef.current, updates).catch(console.error);
  }, [currentQ, questions, answers, players, questionStartedAt]);

  const showLeaderboard = useCallback(() => {
    setPhase('leaderboard');
    update(sessionRef.current, { status: 'leaderboard' }).catch(console.error);
  }, []);

  const nextOrFinal = useCallback(() => {
    if (currentQ + 1 >= totalQ) {
      setPhase('final');
      update(sessionRef.current, { status: 'final' }).catch(console.error);
      // Snapshot full session for analysis + auto-save results
      get(ref(db, 'sessions/' + sessionCode)).then((snap) => {
        const data = snap.val();
        if (data) {
          setSessionSnapshot(data);
          // Auto-save to quizResults/{className}/{sessionCode}
          if (klassenName) {
            const resultData = {
              quizTitle: quiz.title,
              savedAt: Date.now(),
              playerCount: Object.keys(data.players || {}).length,
              questionCount: (data.questions || []).length,
              players: data.players || {},
              questions: data.questions || [],
              answers: data.answers || {},
              wordCloud: data.wordCloud || {},
            };
            set(ref(db, 'quizResults/' + klassenName + '/' + sessionCode), resultData).catch(console.error);
          }
        }
      }).catch(console.error);
    } else {
      goToQuestion(currentQ + 1);
    }
  }, [currentQ, totalQ, goToQuestion, sessionCode, klassenName, quiz.title]);

  const handleEnd = useCallback(() => {
    setConfirm({
      message: 'Quiz beenden und Session l\u00F6schen?',
      confirmLabel: 'Beenden',
      danger: true,
      onConfirm: () => {
        setConfirm(null);
        onEnd();
      },
    });
  }, [onEnd]);

  // Sorted leaderboard
  const leaderboard = Object.entries(players)
    .map(([name, data]) => ({ name, score: data.score || 0, streak: data.streak || 0 }))
    .sort((a, b) => b.score - a.score);

  const playerCount = Object.keys(players).length;
  const answerCount = Object.keys(answers).length;

  // --- LOBBY ---
  if (phase === 'lobby') {
    return (
      <div style={s.container}>
        {confirm && <ConfirmDialog {...confirm} onCancel={() => setConfirm(null)} />}
        <div style={s.lobbyContent}>
          <h1 style={{ ...s.lobbyTitle, color }}>{'\u{1F3AE}'} {quiz.title}</h1>

          <div style={s.qrSection}>
            <QRCodeSVG value={quizUrl} size={220} level="M" />
            <div style={s.codeDisplay}>
              <span style={s.codeLabel}>Code:</span>
              <span style={s.codeValue}>{sessionCode}</span>
            </div>
            <span style={s.qrUrl}>{quizUrl}</span>
          </div>

          <div style={s.playerSection}>
            <h3 style={s.playerTitle}>{'\u{1F465}'} Spieler ({playerCount})</h3>
            <div style={s.playerChips}>
              {Object.keys(players).map((name) => (
                <span key={name} style={{ ...s.playerChip, borderColor: color }}>
                  {name}
                </span>
              ))}
              {playerCount === 0 && (
                <span style={s.waitingText}>Warte auf Spieler...</span>
              )}
            </div>
          </div>

          <div style={s.lobbyActions}>
            <button
              onClick={startQuiz}
              disabled={playerCount === 0}
              style={{
                ...s.startBtn,
                background: playerCount > 0 ? color : '#CCC',
                cursor: playerCount > 0 ? 'pointer' : 'default',
              }}
            >
              Quiz starten!
            </button>
            <button onClick={handleEnd} style={s.endBtn}>Abbrechen</button>
          </div>
        </div>
      </div>
    );
  }

  // --- QUESTION ---
  if (phase === 'question') {
    const q = questions[currentQ];
    const isWordCloud = q.type === 'wordcloud';
    const isOpen = q.type === 'open';
    const isMc = q.type === 'mc';
    const isTf = q.type === 'tf';
    const isSorting = q.type === 'sorting';
    const isSlider = q.type === 'slider';
    const options = q.options || [];

    // Word cloud question - no timer, live visualization
    if (isWordCloud) {
      const uniqueAuthors = new Set(wordCloudEntries.map(e => e.author)).size;
      return (
        <div style={s.container}>
          {confirm && <ConfirmDialog {...confirm} onCancel={() => setConfirm(null)} />}
          <div style={s.questionContainer}>
            <div style={s.qHeader}>
              <span style={s.qNumber}>Frage {currentQ + 1}/{totalQ}</span>
              <span style={s.answerCounter}>{wordCloudEntries.length} W\u00F6rter von {uniqueAuthors} Spielern</span>
            </div>

            <div style={s.qTextBox}>
              <QuestionImage url={q.imageUrl} />
              <h2 style={s.qText}>{q.text}</h2>
            </div>

            {wordCloudEntries.length > 0 ? (
              <div style={s.wordCloudBox}>
                <WordCloudDisplay words={wordCloudEntries} />
              </div>
            ) : (
              <div style={{ ...s.qTextBox, background: '#F8F8F8' }}>
                <p style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 18, color: '#AAA', fontWeight: 600, margin: 0, fontStyle: 'italic' }}>
                  Warte auf Antworten...
                </p>
              </div>
            )}

            <button onClick={showLeaderboard} style={{ ...s.nextBtn, background: color }}>
              Weiter
            </button>
            <button onClick={handleEnd} style={s.endBtn}>Quiz beenden</button>
          </div>
        </div>
      );
    }

    // MC, TF, Open - with timer
    return (
      <div style={s.container}>
        {confirm && <ConfirmDialog {...confirm} onCancel={() => setConfirm(null)} />}
        <div style={s.questionContainer}>
          {/* Header bar */}
          <div style={s.qHeader}>
            <span style={s.qNumber}>Frage {currentQ + 1}/{totalQ}</span>
            <div style={s.timerCircle}>
              <span style={s.timerText}>{timeLeft}</span>
            </div>
            <span style={s.answerCounter}>{answerCount}/{playerCount} Antworten</span>
          </div>

          {/* Question text + image */}
          <div style={s.qTextBox}>
            <QuestionImage url={q.imageUrl} />
            <h2 style={s.qText}>{q.text}</h2>
          </div>

          {/* Options display for MC/TF */}
          {(isMc || isTf) && (
            <div style={isMc ? s.optionGrid : s.tfGrid}>
              {options.map((opt, oi) => {
                const bgColor = isMc ? MC_COLORS[oi] : (oi === 0 ? '#27AE60' : '#E74C3C');
                const shape = isMc ? MC_SHAPES[oi] : (oi === 0 ? '\u2713' : '\u2717');
                return (
                  <div key={oi} style={{ ...s.optionBlock, background: bgColor }}>
                    <span style={s.optionBlockShape}>{shape}</span>
                    <span style={s.optionBlockText}>{opt}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Open question message */}
          {isOpen && (
            <div style={{ ...s.qTextBox, background: '#F0F4FF' }}>
              <p style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 20, color: '#555', fontWeight: 600, margin: 0 }}>
                {'\u{1F4DD}'} Die Spieler tippen ihre Antwort...
              </p>
            </div>
          )}

          {/* Sorting question display */}
          {isSorting && shuffledOrder && (
            <div style={s.sortingDisplay}>
              <div style={s.sortingHint}>{'\u{1F522}'} Bringe in die richtige Reihenfolge:</div>
              <div style={s.sortingItems}>
                {shuffledOrder.map((origIdx, pos) => (
                  <div key={pos} style={s.sortingItem}>
                    <span style={s.sortingItemText}>{q.items[origIdx]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Slider question display */}
          {isSlider && (
            <div style={s.sliderDisplay}>
              <div style={s.sliderRange}>
                <span style={s.sliderRangeLabel}>{q.min}{q.unit ? ` ${q.unit}` : ''}</span>
                <div style={s.sliderTrack}>
                  <div style={s.sliderTrackFill} />
                  <span style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 16, fontWeight: 600, color: '#999' }}>?</span>
                </div>
                <span style={s.sliderRangeLabel}>{q.max}{q.unit ? ` ${q.unit}` : ''}</span>
              </div>
            </div>
          )}

          {/* Teacher skip button */}
          <button onClick={showResults} style={s.skipTimerBtn}>
            Antworten zeigen
          </button>
        </div>
      </div>
    );
  }

  // --- RESULTS ---
  if (phase === 'results') {
    const q = questions[currentQ];

    // Word cloud results (graceful fallback)
    if (q.type === 'wordcloud') {
      return (
        <div style={s.container}>
          {confirm && <ConfirmDialog {...confirm} onCancel={() => setConfirm(null)} />}
          <div style={s.resultsContainer}>
            <h2 style={s.resultsTitle}>Wortwolke</h2>
            <p style={s.resultsQuestion}>{q.text}</p>
            {wordCloudEntries.length > 0 && (
              <div style={s.wordCloudBox}>
                <WordCloudDisplay words={wordCloudEntries} />
              </div>
            )}
            <button onClick={showLeaderboard} style={{ ...s.nextBtn, background: color }}>
              Rangliste
            </button>
          </div>
        </div>
      );
    }

    // Open answer results
    if (q.type === 'open') {
      const accepted = q.acceptedAnswers || [];
      let correctCount = 0;
      let wrongCount = 0;
      const answerList = Object.entries(answers).map(([name, ans]) => {
        const studentAnswer = (ans.answer || '').trim();
        let isCorrect;
        if (q.ignoreCase !== false) {
          isCorrect = accepted.some(a => a.trim().toLowerCase() === studentAnswer.toLowerCase());
        } else {
          isCorrect = accepted.some(a => a.trim() === studentAnswer);
        }
        if (isCorrect) correctCount++; else wrongCount++;
        return { name, answer: studentAnswer, isCorrect };
      });

      return (
        <div style={s.container}>
          {confirm && <ConfirmDialog {...confirm} onCancel={() => setConfirm(null)} />}
          <div style={s.resultsContainer}>
            <h2 style={s.resultsTitle}>Ergebnis</h2>
            <p style={s.resultsQuestion}>{q.text}</p>
            <QuestionImage url={q.imageUrl} />

            {/* Accepted answers */}
            <div style={{ ...s.barChart, background: '#E8F5E9', padding: '12px 16px' }}>
              <div style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 14, fontWeight: 600, color: '#2E7D32' }}>
                Akzeptierte Antworten: {accepted.join(', ')}
              </div>
            </div>

            {/* Student answers list */}
            <div style={s.barChart}>
              {answerList.map((a, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                  borderRadius: 10, background: a.isCorrect ? '#E8F5E9' : '#FFEBEE',
                }}>
                  <span style={{ fontSize: 18, flexShrink: 0, color: a.isCorrect ? '#2E7D32' : '#C62828' }}>
                    {a.isCorrect ? '\u2713' : '\u2717'}
                  </span>
                  <span style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 15, fontWeight: 600, color: '#555', flex: 1 }}>
                    {a.name}
                  </span>
                  <span style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 15, fontWeight: 700, color: a.isCorrect ? '#2E7D32' : '#C62828' }}>
                    {a.answer || '\u2014'}
                  </span>
                </div>
              ))}
              {answerList.length === 0 && (
                <div style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 15, color: '#999', textAlign: 'center', padding: 8 }}>
                  Keine Antworten
                </div>
              )}
            </div>

            <div style={s.resultsSummary}>
              <span style={{ ...s.summaryChip, background: '#E8F5E9', color: '#2E7D32' }}>
                {'\u2713'} {correctCount} richtig
              </span>
              <span style={{ ...s.summaryChip, background: '#FFEBEE', color: '#C62828' }}>
                {'\u2717'} {wrongCount} falsch
              </span>
            </div>

            <button onClick={showLeaderboard} style={{ ...s.nextBtn, background: color }}>
              Rangliste
            </button>
          </div>
        </div>
      );
    }

    // Sorting results
    if (q.type === 'sorting') {
      const items = q.items || [];
      const positionCorrect = items.map(() => 0);
      let allCorrectCount = 0;
      const totalAnswers = Object.keys(answers).length;
      Object.values(answers).forEach(ans => {
        const order = Array.isArray(ans.answer) ? ans.answer : [];
        let allRight = true;
        for (let i = 0; i < items.length; i++) {
          if (order[i] === i) positionCorrect[i]++;
          else allRight = false;
        }
        if (allRight) allCorrectCount++;
      });

      return (
        <div style={s.container}>
          {confirm && <ConfirmDialog {...confirm} onCancel={() => setConfirm(null)} />}
          <div style={s.resultsContainer}>
            <h2 style={s.resultsTitle}>Ergebnis</h2>
            <p style={s.resultsQuestion}>{q.text}</p>
            <QuestionImage url={q.imageUrl} />

            <div style={s.barChart}>
              <div style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 14, fontWeight: 600, color: '#777', marginBottom: 4 }}>
                Richtige Reihenfolge:
              </div>
              {items.map((item, i) => {
                const pct = totalAnswers > 0 ? Math.round((positionCorrect[i] / totalAnswers) * 100) : 0;
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 10, background: '#F8F8F8' }}>
                    <span style={{ fontFamily: "'Baloo 2', cursive", fontSize: 20, fontWeight: 800, color: '#D35400', width: 28, textAlign: 'center', flexShrink: 0 }}>{i + 1}.</span>
                    <span style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 16, fontWeight: 600, color: '#333', flex: 1 }}>{item}</span>
                    <span style={{ fontFamily: "'Baloo 2', cursive", fontSize: 14, fontWeight: 700, color: '#27AE60' }}>{pct}%</span>
                  </div>
                );
              })}
            </div>

            <div style={s.resultsSummary}>
              <span style={{ ...s.summaryChip, background: '#E8F5E9', color: '#2E7D32' }}>
                {'\u2713'} {allCorrectCount} alles richtig
              </span>
              <span style={{ ...s.summaryChip, background: '#FFF3E0', color: '#E65100' }}>
                {totalAnswers} Antworten
              </span>
            </div>

            <button onClick={showLeaderboard} style={{ ...s.nextBtn, background: color }}>
              Rangliste
            </button>
          </div>
        </div>
      );
    }

    // Slider results
    if (q.type === 'slider') {
      const answerList = Object.entries(answers).map(([name, ans]) => {
        const val = typeof ans.answer === 'number' ? ans.answer : 0;
        const distance = Math.abs(val - q.correctValue);
        return { name, value: val, distance };
      }).sort((a, b) => a.distance - b.distance);
      const withinTol = answerList.filter(a => a.distance <= q.tolerance).length;

      return (
        <div style={s.container}>
          {confirm && <ConfirmDialog {...confirm} onCancel={() => setConfirm(null)} />}
          <div style={s.resultsContainer}>
            <h2 style={s.resultsTitle}>Ergebnis</h2>
            <p style={s.resultsQuestion}>{q.text}</p>
            <QuestionImage url={q.imageUrl} />

            {/* Correct answer highlight */}
            <div style={{ ...s.barChart, background: '#E8F5E9', padding: '16px 20px' }}>
              <div style={{ fontFamily: "'Lilita One', cursive", fontSize: 32, color: '#2E7D32', textAlign: 'center' }}>
                {q.correctValue}{q.unit ? ` ${q.unit}` : ''}
              </div>
              <div style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 14, fontWeight: 600, color: '#2E7D32', textAlign: 'center' }}>
                Toleranz: \u00B1{q.tolerance}{q.unit ? ` ${q.unit}` : ''}
              </div>
            </div>

            {/* Student guesses list */}
            <div style={s.barChart}>
              {answerList.map((a, i) => {
                const inTol = a.distance <= q.tolerance;
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                    borderRadius: 10, background: inTol ? '#E8F5E9' : '#FFEBEE',
                  }}>
                    <span style={{ fontSize: 18, flexShrink: 0, color: inTol ? '#2E7D32' : '#C62828' }}>
                      {inTol ? '\u2713' : '\u2717'}
                    </span>
                    <span style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 15, fontWeight: 600, color: '#555', flex: 1 }}>
                      {a.name}
                    </span>
                    <span style={{ fontFamily: "'Baloo 2', cursive", fontSize: 18, fontWeight: 700, color: inTol ? '#2E7D32' : '#C62828' }}>
                      {a.value}{q.unit ? ` ${q.unit}` : ''}
                    </span>
                    <span style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 12, fontWeight: 500, color: '#999' }}>
                      (\u00B1{a.distance})
                    </span>
                  </div>
                );
              })}
              {answerList.length === 0 && (
                <div style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 15, color: '#999', textAlign: 'center', padding: 8 }}>
                  Keine Antworten
                </div>
              )}
            </div>

            <div style={s.resultsSummary}>
              <span style={{ ...s.summaryChip, background: '#E8F5E9', color: '#2E7D32' }}>
                {'\u2713'} {withinTol} im Toleranzbereich
              </span>
              <span style={{ ...s.summaryChip, background: '#FFF3E0', color: '#E65100' }}>
                {answerList.length} Antworten
              </span>
            </div>

            <button onClick={showLeaderboard} style={{ ...s.nextBtn, background: color }}>
              Rangliste
            </button>
          </div>
        </div>
      );
    }

    // MC / TF results
    const options = q.options || [];
    const correctIdx = q.correctIndex;

    // Count per option
    const counts = options.map(() => 0);
    let correctCount = 0;
    let wrongCount = 0;
    Object.values(answers).forEach(ans => {
      if (ans.answer >= 0 && ans.answer < options.length) {
        counts[ans.answer]++;
      }
      if (ans.answer === correctIdx) correctCount++;
      else wrongCount++;
    });
    const maxCount = Math.max(...counts, 1);

    const isMc = q.type === 'mc';

    return (
      <div style={s.container}>
        {confirm && <ConfirmDialog {...confirm} onCancel={() => setConfirm(null)} />}
        <div style={s.resultsContainer}>
          <h2 style={s.resultsTitle}>Ergebnis</h2>
          <p style={s.resultsQuestion}>{q.text}</p>
          <QuestionImage url={q.imageUrl} />

          {/* Bar chart */}
          <div style={s.barChart}>
            {options.map((opt, oi) => {
              const isCorrect = oi === correctIdx;
              const bgColor = isMc ? MC_COLORS[oi] : (oi === 0 ? '#27AE60' : '#E74C3C');
              const barWidth = counts[oi] > 0 ? Math.max(10, (counts[oi] / maxCount) * 100) : 4;
              return (
                <div key={oi} style={s.barRow}>
                  <div style={s.barLabel}>
                    <span style={{ ...s.barShape, color: bgColor }}>{isMc ? MC_SHAPES[oi] : (oi === 0 ? '\u2713' : '\u2717')}</span>
                    <span style={s.barLabelText}>{opt}</span>
                    {isCorrect && <span style={s.correctMark}>{'\u2713'}</span>}
                  </div>
                  <div style={s.barTrack}>
                    <div style={{
                      ...s.barFill,
                      width: `${barWidth}%`,
                      background: isCorrect ? '#27AE60' : bgColor,
                      opacity: isCorrect ? 1 : 0.5,
                    }} />
                    <span style={s.barCount}>{counts[oi]}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={s.resultsSummary}>
            <span style={{ ...s.summaryChip, background: '#E8F5E9', color: '#2E7D32' }}>
              {'\u2713'} {correctCount} richtig
            </span>
            <span style={{ ...s.summaryChip, background: '#FFEBEE', color: '#C62828' }}>
              {'\u2717'} {wrongCount} falsch
            </span>
          </div>

          <button onClick={showLeaderboard} style={{ ...s.nextBtn, background: color }}>
            Rangliste
          </button>
        </div>
      </div>
    );
  }

  // --- LEADERBOARD ---
  if (phase === 'leaderboard') {
    const top5 = leaderboard.slice(0, 5);
    const medals = ['\u{1F947}', '\u{1F948}', '\u{1F949}'];
    const podiumColors = ['#FFD700', '#C0C0C0', '#CD7F32'];

    return (
      <div style={s.container}>
        {confirm && <ConfirmDialog {...confirm} onCancel={() => setConfirm(null)} />}
        <div style={s.leaderboardContainer}>
          <h2 style={{ ...s.leaderboardTitle, color }}>{'\u{1F3C6}'} Rangliste</h2>
          <p style={s.leaderboardSub}>Nach Frage {currentQ + 1}/{totalQ}</p>

          <div style={s.podium}>
            {top5.map((entry, i) => (
              <div key={entry.name} style={{
                ...s.podiumEntry,
                background: i < 3 ? `${podiumColors[i]}15` : '#F8F8F8',
                border: i < 3 ? `2px solid ${podiumColors[i]}40` : '2px solid transparent',
              }}>
                <span style={s.podiumRank}>{i < 3 ? medals[i] : `${i + 1}.`}</span>
                <span style={s.podiumName}>{entry.name}</span>
                <span style={s.podiumScore}>{entry.score}</span>
              </div>
            ))}
          </div>

          <button
            onClick={nextOrFinal}
            style={{ ...s.nextBtn, background: color }}
          >
            {currentQ + 1 >= totalQ ? 'Endergebnis' : 'N\u00E4chste Frage'}
          </button>
          <button onClick={handleEnd} style={s.endBtn}>Quiz beenden</button>
        </div>
      </div>
    );
  }

  // --- FINAL ---
  if (phase === 'final') {
    const medals = ['\u{1F947}', '\u{1F948}', '\u{1F949}'];
    const podiumColors = ['#FFD700', '#C0C0C0', '#CD7F32'];

    return (
      <div style={s.container}>
        <Confetti active={true} duration={5000} />
        {confirm && <ConfirmDialog {...confirm} onCancel={() => setConfirm(null)} />}
        {showAnalysis && sessionSnapshot && (
          <React.Suspense fallback={null}>
            <QuizAnalysis
              quiz={quiz}
              sessionSnapshot={sessionSnapshot}
              leaderboard={leaderboard}
              dayColor={color}
              onClose={() => setShowAnalysis(false)}
            />
          </React.Suspense>
        )}
        <div style={s.finalContainer}>
          <h1 style={{ ...s.finalTitle, color }}>{'\u{1F389}'} Endergebnis</h1>
          <h2 style={s.finalQuizTitle}>{quiz.title}</h2>

          {/* Podium - top 3 */}
          {leaderboard.length > 0 && (
            <div style={s.finalPodium}>
              {leaderboard.slice(0, 3).map((entry, i) => (
                <div key={entry.name} style={{
                  ...s.finalPodiumEntry,
                  background: `${podiumColors[i]}20`,
                  border: `3px solid ${podiumColors[i]}`,
                  transform: i === 0 ? 'scale(1.08)' : 'scale(1)',
                }}>
                  <span style={s.finalMedal}>{medals[i]}</span>
                  <span style={s.finalName}>{entry.name}</span>
                  <span style={s.finalScore}>{entry.score} Punkte</span>
                </div>
              ))}
            </div>
          )}

          {/* Full ranking */}
          {leaderboard.length > 3 && (
            <div style={s.fullRanking}>
              {leaderboard.slice(3).map((entry, i) => (
                <div key={entry.name} style={s.rankingRow}>
                  <span style={s.rankNum}>{i + 4}.</span>
                  <span style={s.rankName}>{entry.name}</span>
                  <span style={s.rankScore}>{entry.score}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 320, marginTop: 20 }}>
            {sessionSnapshot && (
              <button
                onClick={() => setShowAnalysis(true)}
                style={{ ...s.nextBtn, background: '#9B59B6' }}
              >
                {'\u{1F4CA}'} Ergebnisse & Analyse
              </button>
            )}
            <button onClick={() => { onEnd(); }} style={{ ...s.nextBtn, background: color }}>
              Quiz beenden
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

const s = {
  container: {
    width: '100%',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    boxSizing: 'border-box',
    overflowY: 'auto',
  },
  // Lobby
  lobbyContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 24,
    maxWidth: 600,
    width: '100%',
  },
  lobbyTitle: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 32,
    margin: 0,
    textAlign: 'center',
  },
  qrSection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    background: 'white',
    borderRadius: 20,
    padding: '24px 32px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
  },
  codeDisplay: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 8,
  },
  codeLabel: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 16,
    fontWeight: 600,
    color: '#999',
  },
  codeValue: {
    fontFamily: "'Baloo 2', cursive",
    fontSize: 36,
    fontWeight: 800,
    color: '#333',
    letterSpacing: 4,
  },
  qrUrl: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 13,
    color: '#999',
    wordBreak: 'break-all',
    textAlign: 'center',
  },
  playerSection: {
    width: '100%',
    textAlign: 'center',
  },
  playerTitle: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 20,
    color: '#555',
    margin: '0 0 10px',
  },
  playerChips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  playerChip: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 16,
    fontWeight: 600,
    padding: '6px 16px',
    background: 'white',
    borderWidth: 2,
    borderStyle: 'solid',
    borderRadius: 20,
    animation: 'fadeIn 0.3s ease-out',
  },
  waitingText: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 16,
    fontWeight: 600,
    color: '#AAA',
    fontStyle: 'italic',
    animation: 'pulse 1.5s ease-in-out infinite',
  },
  lobbyActions: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    width: '100%',
    maxWidth: 320,
  },
  startBtn: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 24,
    padding: '16px 32px',
    color: 'white',
    border: 'none',
    borderRadius: 16,
    cursor: 'pointer',
    textAlign: 'center',
    boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
  },
  endBtn: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 15,
    fontWeight: 600,
    padding: '10px 20px',
    background: 'rgba(0,0,0,0.06)',
    color: '#666',
    border: 'none',
    borderRadius: 12,
    cursor: 'pointer',
    textAlign: 'center',
  },
  // Question
  questionContainer: {
    width: '100%',
    maxWidth: 900,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 20,
  },
  qHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  qNumber: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 18,
    fontWeight: 700,
    color: '#777',
  },
  timerCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    background: 'white',
    boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerText: {
    fontFamily: "'Baloo 2', cursive",
    fontSize: 36,
    fontWeight: 800,
    color: '#333',
  },
  answerCounter: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 18,
    fontWeight: 700,
    color: '#777',
  },
  qTextBox: {
    background: 'white',
    borderRadius: 16,
    padding: '24px 32px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
    width: '100%',
    textAlign: 'center',
    boxSizing: 'border-box',
  },
  qText: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 28,
    color: '#333',
    margin: 0,
    lineHeight: 1.4,
  },
  optionGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12,
    width: '100%',
  },
  tfGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 16,
    width: '100%',
    maxWidth: 600,
  },
  optionBlock: {
    borderRadius: 14,
    padding: '20px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    minHeight: 70,
  },
  optionBlockShape: {
    fontSize: 28,
    color: 'rgba(255,255,255,0.8)',
    flexShrink: 0,
  },
  optionBlockText: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 20,
    fontWeight: 700,
    color: 'white',
  },
  skipTimerBtn: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 14,
    fontWeight: 600,
    padding: '8px 20px',
    background: 'rgba(0,0,0,0.06)',
    color: '#999',
    border: 'none',
    borderRadius: 10,
    cursor: 'pointer',
    marginTop: 8,
  },
  // Word cloud
  wordCloudBox: {
    background: 'white',
    borderRadius: 16,
    padding: '24px 20px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
    width: '100%',
    minHeight: 120,
    boxSizing: 'border-box',
  },
  wordCloud: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    padding: '8px 0',
  },
  // Sorting question display
  sortingDisplay: {
    background: 'white',
    borderRadius: 16,
    padding: '20px 24px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
    width: '100%',
    boxSizing: 'border-box',
  },
  sortingHint: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 16,
    fontWeight: 600,
    color: '#D35400',
    textAlign: 'center',
    marginBottom: 12,
  },
  sortingItems: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  sortingItem: {
    background: '#FFF3E0',
    border: '2px solid #FFB74D',
    borderRadius: 12,
    padding: '12px 18px',
    textAlign: 'center',
  },
  sortingItemText: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 20,
    fontWeight: 700,
    color: '#333',
  },
  // Slider question display
  sliderDisplay: {
    background: 'white',
    borderRadius: 16,
    padding: '24px 32px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
    width: '100%',
    boxSizing: 'border-box',
  },
  sliderRange: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  },
  sliderRangeLabel: {
    fontFamily: "'Baloo 2', cursive",
    fontSize: 22,
    fontWeight: 700,
    color: '#555',
    flexShrink: 0,
  },
  sliderTrack: {
    flex: 1,
    height: 16,
    background: '#E0E0E0',
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  sliderTrackFill: {
    position: 'absolute',
    inset: 0,
    borderRadius: 8,
    background: 'linear-gradient(90deg, #2C3E50 0%, #3498DB 100%)',
    opacity: 0.15,
  },
  // Results
  resultsContainer: {
    maxWidth: 700,
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
  },
  resultsTitle: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 28,
    color: '#333',
    margin: 0,
  },
  resultsQuestion: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 18,
    fontWeight: 600,
    color: '#555',
    margin: 0,
    textAlign: 'center',
  },
  barChart: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    background: 'white',
    borderRadius: 16,
    padding: '20px 24px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
    boxSizing: 'border-box',
  },
  barRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  barLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  barShape: {
    fontSize: 18,
    flexShrink: 0,
  },
  barLabelText: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 16,
    fontWeight: 600,
    color: '#333',
    flex: 1,
  },
  correctMark: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 16,
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
  barFill: {
    height: 24,
    borderRadius: 12,
    transition: 'width 0.5s ease-out',
    minWidth: 4,
  },
  barCount: {
    fontFamily: "'Baloo 2', cursive",
    fontSize: 18,
    fontWeight: 700,
    color: '#333',
    minWidth: 24,
  },
  resultsSummary: {
    display: 'flex',
    gap: 12,
  },
  summaryChip: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 16,
    fontWeight: 700,
    padding: '8px 16px',
    borderRadius: 12,
  },
  nextBtn: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 20,
    padding: '14px 32px',
    color: 'white',
    border: 'none',
    borderRadius: 14,
    cursor: 'pointer',
    textAlign: 'center',
    boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
  },
  // Leaderboard
  leaderboardContainer: {
    maxWidth: 500,
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
  },
  leaderboardTitle: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 30,
    margin: 0,
  },
  leaderboardSub: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 16,
    fontWeight: 600,
    color: '#999',
    margin: 0,
  },
  podium: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  podiumEntry: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '14px 20px',
    borderRadius: 14,
  },
  podiumRank: {
    fontSize: 28,
    width: 40,
    textAlign: 'center',
    flexShrink: 0,
    fontFamily: "'Baloo 2', cursive",
    fontWeight: 700,
  },
  podiumName: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 20,
    fontWeight: 700,
    color: '#333',
    flex: 1,
  },
  podiumScore: {
    fontFamily: "'Baloo 2', cursive",
    fontSize: 24,
    fontWeight: 800,
    color: '#333',
  },
  // Final
  finalContainer: {
    maxWidth: 600,
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
  },
  finalTitle: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 36,
    margin: 0,
  },
  finalQuizTitle: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 20,
    fontWeight: 600,
    color: '#777',
    margin: 0,
  },
  finalPodium: {
    display: 'flex',
    gap: 16,
    justifyContent: 'center',
    flexWrap: 'wrap',
    margin: '8px 0',
  },
  finalPodiumEntry: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    padding: '20px 28px',
    borderRadius: 18,
    minWidth: 120,
  },
  finalMedal: {
    fontSize: 40,
  },
  finalName: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 22,
    color: '#333',
  },
  finalScore: {
    fontFamily: "'Baloo 2', cursive",
    fontSize: 20,
    fontWeight: 700,
    color: '#555',
  },
  fullRanking: {
    width: '100%',
    background: 'white',
    borderRadius: 14,
    padding: '12px 16px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  rankingRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '6px 8px',
  },
  rankNum: {
    fontFamily: "'Baloo 2', cursive",
    fontSize: 16,
    fontWeight: 700,
    color: '#999',
    width: 28,
    textAlign: 'center',
  },
  rankName: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 16,
    fontWeight: 600,
    color: '#333',
    flex: 1,
  },
  rankScore: {
    fontFamily: "'Baloo 2', cursive",
    fontSize: 18,
    fontWeight: 700,
    color: '#555',
  },
  // Confirm dialog
  confirmOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 10000,
    background: 'rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  confirmCard: {
    background: 'white',
    borderRadius: 20,
    padding: '32px 28px',
    maxWidth: 400,
    width: '100%',
    boxShadow: '0 8px 40px rgba(0,0,0,0.15)',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  confirmText: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 18,
    color: '#333',
    fontWeight: 600,
    textAlign: 'center',
    margin: 0,
    lineHeight: 1.5,
  },
  confirmBtn: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 16,
    padding: '10px 20px',
    color: 'white',
    border: 'none',
    borderRadius: 14,
    cursor: 'pointer',
  },
  confirmCancelBtn: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 16,
    fontWeight: 600,
    padding: '10px 20px',
    background: 'rgba(0,0,0,0.06)',
    color: '#666',
    border: 'none',
    borderRadius: 14,
    cursor: 'pointer',
  },
};

import React, { useState, useEffect, useRef } from 'react';
import { ref, set, push, onValue } from 'firebase/database';
import { db } from '../firebase';

const MC_COLORS = ['#E74C3C', '#2980B9', '#F1C40F', '#27AE60'];
const MC_SHAPES = ['\u25B2', '\u25CF', '\u25A0', '\u25C6'];

export default function QuizPage({ code }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [playerName, setPlayerName] = useState(() => localStorage.getItem('quiz-player-name') || '');
  const [nameSet, setNameSet] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [answerSubmitted, setAnswerSubmitted] = useState(false);
  const [openAnswer, setOpenAnswer] = useState('');
  const [wordCloudInput, setWordCloudInput] = useState('');
  const [wordCloudSent, setWordCloudSent] = useState([]);
  const [sortingOrder, setSortingOrder] = useState([]);
  const [sliderValue, setSliderValue] = useState(null);

  const prevQuestionRef = useRef(null);

  // Override global overflow:hidden
  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'quiz-scroll-fix';
    style.textContent = `
      html, body, #root {
        overflow: auto !important;
        height: auto !important;
        min-height: 100vh !important;
        position: static !important;
        -webkit-overflow-scrolling: touch !important;
        overscroll-behavior: auto !important;
      }
      input[type="range"].quiz-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: #2C3E50;
        cursor: pointer;
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      }
      input[type="range"].quiz-slider::-moz-range-thumb {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: #2C3E50;
        cursor: pointer;
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      }
    `;
    document.head.appendChild(style);
    return () => { style.remove(); };
  }, []);

  // Subscribe to session
  useEffect(() => {
    const sessionRef = ref(db, 'sessions/' + code);
    const unsub = onValue(sessionRef, (snap) => {
      const data = snap.val();
      setSession(data);
      setLoading(false);
    });
    return () => unsub();
  }, [code]);

  // Reset answer state when question changes
  useEffect(() => {
    if (!session) return;
    const cq = session.currentQuestion;
    if (cq !== prevQuestionRef.current) {
      prevQuestionRef.current = cq;
      setSelectedAnswer(null);
      setAnswerSubmitted(false);
      setOpenAnswer('');
      setWordCloudInput('');
      setWordCloudSent([]);
      setSortingOrder([]);
      setSliderValue(null);
    }
  }, [session?.currentQuestion]);

  // Check if name already registered
  useEffect(() => {
    if (!session || !playerName) return;
    if (session.players && session.players[playerName]) {
      setNameSet(true);
    }
  }, [session, playerName]);

  const handleSetName = (e) => {
    e.preventDefault();
    const name = nameInput.trim();
    if (!name || !session) return;
    localStorage.setItem('quiz-player-name', name);
    setPlayerName(name);

    set(ref(db, 'sessions/' + code + '/players/' + name), {
      joinedAt: Date.now(),
      score: 0,
      streak: 0,
    }).then(() => {
      setNameSet(true);
    }).catch(console.error);
  };

  const handleAnswer = (answerIndex) => {
    if (answerSubmitted || !session || !playerName) return;
    setSelectedAnswer(answerIndex);
    setAnswerSubmitted(true);

    const qIdx = session.currentQuestion;
    set(ref(db, 'sessions/' + code + '/answers/' + qIdx + '/' + playerName), {
      answer: answerIndex,
      answeredAt: Date.now(),
    }).catch(console.error);
  };

  const handleOpenAnswer = () => {
    if (answerSubmitted || !session || !playerName || !openAnswer.trim()) return;
    setAnswerSubmitted(true);

    const qIdx = session.currentQuestion;
    set(ref(db, 'sessions/' + code + '/answers/' + qIdx + '/' + playerName), {
      answer: openAnswer.trim(),
      answeredAt: Date.now(),
    }).catch(console.error);
  };

  const handleWordCloudSubmit = () => {
    if (!session || !playerName || !wordCloudInput.trim()) return;
    const questions = session.questions || [];
    const q = questions[session.currentQuestion];
    const maxSubs = q?.maxSubmissions || 3;
    if (wordCloudSent.length >= maxSubs) return;

    const word = wordCloudInput.trim();
    const qIdx = session.currentQuestion;
    push(ref(db, 'sessions/' + code + '/wordCloud/' + qIdx), {
      word,
      author: playerName,
      timestamp: Date.now(),
    }).catch(console.error);

    setWordCloudSent(prev => [...prev, word]);
    setWordCloudInput('');
  };

  const handleSortingTap = (origIdx) => {
    if (answerSubmitted) return;
    if (sortingOrder.includes(origIdx)) {
      // Remove it (undo)
      setSortingOrder(prev => prev.filter(i => i !== origIdx));
    } else {
      setSortingOrder(prev => [...prev, origIdx]);
    }
  };

  const handleSortingSubmit = () => {
    if (answerSubmitted || !session || !playerName) return;
    const q = (session.questions || [])[session.currentQuestion];
    if (!q || sortingOrder.length !== (q.items || []).length) return;
    setAnswerSubmitted(true);

    const qIdx = session.currentQuestion;
    set(ref(db, 'sessions/' + code + '/answers/' + qIdx + '/' + playerName), {
      answer: sortingOrder,
      answeredAt: Date.now(),
    }).catch(console.error);
  };

  const handleSliderSubmit = () => {
    if (answerSubmitted || !session || !playerName || sliderValue === null) return;
    setAnswerSubmitted(true);

    const qIdx = session.currentQuestion;
    set(ref(db, 'sessions/' + code + '/answers/' + qIdx + '/' + playerName), {
      answer: sliderValue,
      answeredAt: Date.now(),
    }).catch(console.error);
  };

  // Loading
  if (loading) {
    return (
      <div style={s.page}>
        <div style={s.loadingText}>Lade Quiz...</div>
      </div>
    );
  }

  // Session not found
  if (!session) {
    return (
      <div style={s.page}>
        <div style={s.messageCard}>
          <div style={{ fontSize: 48 }}>{'\u{1F50D}'}</div>
          <div style={s.loadingText}>Quiz nicht gefunden.</div>
          <p style={s.messageDesc}>Bitte pr\u00FCfe den Code und versuche es erneut.</p>
        </div>
      </div>
    );
  }

  // Name entry
  if (!nameSet) {
    return (
      <div style={s.page}>
        <div style={s.nameCard}>
          <h1 style={s.nameTitle}>{'\u{1F3AE}'} Quiz beitreten</h1>
          <p style={s.nameDesc}>{session.quizTitle}</p>
          <p style={s.namePrompt}>Wie hei\u00DFt du?</p>
          <form onSubmit={handleSetName} style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Dein Name..."
              autoFocus
              style={s.nameInput}
            />
            <button type="submit" style={s.nameBtn}>Mitmachen!</button>
          </form>
        </div>
      </div>
    );
  }

  const status = session.status;
  const questions = session.questions || [];
  const currentQ = session.currentQuestion;
  const playerData = session.players?.[playerName];
  const myScore = playerData?.score || 0;

  // --- LOBBY ---
  if (status === 'lobby') {
    const playerCount = session.players ? Object.keys(session.players).length : 0;
    return (
      <div style={s.page}>
        <div style={s.statusCard}>
          <h2 style={s.statusTitle}>{session.quizTitle}</h2>
          <div style={s.waitingPulse}>Warte auf den Start...</div>
          <div style={s.playerCountBig}>{'\u{1F465}'} {playerCount} Spieler</div>
          <p style={s.statusName}>Du bist: <strong>{playerName}</strong></p>
        </div>
      </div>
    );
  }

  // --- QUESTION ---
  if (status === 'question' && currentQ >= 0 && currentQ < questions.length) {
    const q = questions[currentQ];
    const isWordCloud = q.type === 'wordcloud';
    const isOpen = q.type === 'open';
    const isMc = q.type === 'mc';
    const options = q.options || [];

    // Question image component
    const qImage = q.imageUrl ? (
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <img src={q.imageUrl} alt="" style={{ maxWidth: '100%', maxHeight: 160, borderRadius: 12, objectFit: 'contain' }} />
      </div>
    ) : null;

    // --- WORD CLOUD QUESTION ---
    if (isWordCloud) {
      const maxSubs = q.maxSubmissions || 3;
      const allSent = wordCloudSent.length >= maxSubs;

      return (
        <div style={s.page}>
          <div style={s.questionCard}>
            <div style={s.qHeaderMobile}>
              <span style={s.qNumMobile}>Frage {currentQ + 1}/{questions.length}</span>
            </div>

            <div style={s.qTextMobile}>
              {qImage}
              {q.text}
            </div>

            {!allSent ? (
              <div style={s.wcInputArea}>
                <div style={s.wcCounter}>
                  {wordCloudSent.length}/{maxSubs} gesendet
                </div>
                <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                  <input
                    type="text"
                    value={wordCloudInput}
                    onChange={(e) => setWordCloudInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleWordCloudSubmit(); } }}
                    placeholder="Dein Wort..."
                    style={s.wcInput}
                    autoFocus
                  />
                  <button
                    onClick={handleWordCloudSubmit}
                    disabled={!wordCloudInput.trim()}
                    style={{
                      ...s.wcSendBtn,
                      opacity: wordCloudInput.trim() ? 1 : 0.5,
                    }}
                  >
                    Senden
                  </button>
                </div>
              </div>
            ) : (
              <div style={s.wcDone}>
                <div style={s.sentIcon}>{'\u2713'}</div>
                <p style={s.wcDoneText}>Alle W\u00F6rter gesendet!</p>
              </div>
            )}

            {/* Sent words as chips */}
            {wordCloudSent.length > 0 && (
              <div style={s.wcChips}>
                {wordCloudSent.map((w, i) => (
                  <span key={i} style={s.wcChip}>{w}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    }

    // --- OPEN ANSWER QUESTION ---
    if (isOpen) {
      if (answerSubmitted) {
        return (
          <div style={s.page}>
            <div style={s.statusCard}>
              <div style={s.sentIcon}>{'\u2713'}</div>
              <h2 style={s.sentText}>Antwort gesendet!</h2>
              <p style={s.sentSub}>Warte auf die anderen...</p>
            </div>
          </div>
        );
      }

      return (
        <div style={s.page}>
          <div style={s.questionCard}>
            <div style={s.qHeaderMobile}>
              <span style={s.qNumMobile}>Frage {currentQ + 1}/{questions.length}</span>
            </div>

            <div style={s.qTextMobile}>
              {qImage}
              {q.text}
            </div>

            <div style={s.openInputArea}>
              <input
                type="text"
                value={openAnswer}
                onChange={(e) => setOpenAnswer(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleOpenAnswer(); } }}
                placeholder="Deine Antwort..."
                autoFocus
                style={s.openInput}
              />
              <button
                onClick={handleOpenAnswer}
                disabled={!openAnswer.trim()}
                style={{
                  ...s.openSubmitBtn,
                  opacity: openAnswer.trim() ? 1 : 0.5,
                }}
              >
                Absenden
              </button>
            </div>
          </div>
        </div>
      );
    }

    // --- SORTING QUESTION ---
    if (q.type === 'sorting') {
      const shuffled = session.shuffledOrder || [];
      const items = q.items || [];

      if (answerSubmitted) {
        return (
          <div style={s.page}>
            <div style={s.statusCard}>
              <div style={s.sentIcon}>{'\u2713'}</div>
              <h2 style={s.sentText}>Antwort gesendet!</h2>
              <p style={s.sentSub}>Warte auf die anderen...</p>
            </div>
          </div>
        );
      }

      return (
        <div style={s.page}>
          <div style={s.questionCard}>
            <div style={s.qHeaderMobile}>
              <span style={s.qNumMobile}>Frage {currentQ + 1}/{questions.length}</span>
            </div>

            <div style={s.qTextMobile}>
              {qImage}
              {q.text}
            </div>

            {/* Available items (shuffled) */}
            <div style={s.sortingArea}>
              <div style={s.sortingLabel}>Tippe in der richtigen Reihenfolge:</div>
              <div style={s.sortingPool}>
                {shuffled.map((origIdx) => {
                  const picked = sortingOrder.includes(origIdx);
                  const pickNum = sortingOrder.indexOf(origIdx) + 1;
                  return (
                    <button
                      key={origIdx}
                      onClick={() => handleSortingTap(origIdx)}
                      style={{
                        ...s.sortingPoolItem,
                        opacity: picked ? 0.4 : 1,
                        border: picked ? '2px solid #27AE60' : '2px solid #FFB74D',
                        background: picked ? '#E8F5E9' : '#FFF8E1',
                      }}
                    >
                      {picked && <span style={s.sortingPickNum}>{pickNum}</span>}
                      <span style={s.sortingPoolText}>{items[origIdx]}</span>
                    </button>
                  );
                })}
              </div>

              {/* Selected order display */}
              {sortingOrder.length > 0 && (
                <div style={s.sortingSelected}>
                  {sortingOrder.map((origIdx, pos) => (
                    <div key={origIdx} style={s.sortingSelectedItem}>
                      <span style={s.sortingSelectedNum}>{pos + 1}.</span>
                      <span style={s.sortingSelectedText}>{items[origIdx]}</span>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                {sortingOrder.length > 0 && (
                  <button onClick={() => setSortingOrder([])} style={s.sortingResetBtn}>
                    Zur\u00FCcksetzen
                  </button>
                )}
                {sortingOrder.length === items.length && (
                  <button onClick={handleSortingSubmit} style={s.sortingSubmitBtn}>
                    Fertig!
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    // --- SLIDER QUESTION ---
    if (q.type === 'slider') {
      if (answerSubmitted) {
        return (
          <div style={s.page}>
            <div style={s.statusCard}>
              <div style={s.sentIcon}>{'\u2713'}</div>
              <h2 style={s.sentText}>Antwort gesendet!</h2>
              <p style={s.sentSub}>{sliderValue}{q.unit ? ` ${q.unit}` : ''}</p>
            </div>
          </div>
        );
      }

      const min = q.min ?? 0;
      const max = q.max ?? 100;
      const currentVal = sliderValue !== null ? sliderValue : Math.round((min + max) / 2);

      return (
        <div style={s.page}>
          <div style={s.questionCard}>
            <div style={s.qHeaderMobile}>
              <span style={s.qNumMobile}>Frage {currentQ + 1}/{questions.length}</span>
            </div>

            <div style={s.qTextMobile}>
              {qImage}
              {q.text}
            </div>

            <div style={s.sliderArea}>
              <div style={s.sliderValueDisplay}>
                {currentVal}{q.unit ? ` ${q.unit}` : ''}
              </div>

              <input
                type="range"
                className="quiz-slider"
                min={min}
                max={max}
                step={1}
                value={currentVal}
                onChange={(e) => setSliderValue(Number(e.target.value))}
                style={s.sliderInput}
              />

              <div style={s.sliderMinMax}>
                <span>{min}{q.unit ? ` ${q.unit}` : ''}</span>
                <span>{max}{q.unit ? ` ${q.unit}` : ''}</span>
              </div>

              <button
                onClick={handleSliderSubmit}
                disabled={sliderValue === null}
                style={{
                  ...s.sliderSubmitBtn,
                  opacity: sliderValue !== null ? 1 : 0.5,
                }}
              >
                Antworten!
              </button>
            </div>
          </div>
        </div>
      );
    }

    // --- MC / TF QUESTION ---
    if (answerSubmitted) {
      return (
        <div style={s.page}>
          <div style={s.statusCard}>
            <div style={s.sentIcon}>{'\u2713'}</div>
            <h2 style={s.sentText}>Antwort gesendet!</h2>
            <p style={s.sentSub}>Warte auf die anderen...</p>
          </div>
        </div>
      );
    }

    return (
      <div style={s.page}>
        <div style={s.questionCard}>
          <div style={s.qHeaderMobile}>
            <span style={s.qNumMobile}>Frage {currentQ + 1}/{questions.length}</span>
          </div>

          <div style={s.qTextMobile}>
            {qImage}
            {q.text}
          </div>

          {/* Answer buttons */}
          <div style={isMc ? s.answerGridMc : s.answerGridTf}>
            {options.map((opt, oi) => {
              const isSelected = selectedAnswer === oi;
              const bgColor = isMc ? MC_COLORS[oi] : (oi === 0 ? '#27AE60' : '#E74C3C');
              const shape = isMc ? MC_SHAPES[oi] : (oi === 0 ? '\u2713' : '\u2717');

              return (
                <button
                  key={oi}
                  onClick={() => handleAnswer(oi)}
                  style={{
                    ...s.answerBtn,
                    background: bgColor,
                    opacity: isSelected ? 1 : (selectedAnswer !== null ? 0.4 : 1),
                    transform: isSelected ? 'scale(1.03)' : 'scale(1)',
                  }}
                >
                  <span style={s.answerShape}>{shape}</span>
                  <span style={s.answerText}>{opt}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // --- RESULTS ---
  if (status === 'results' && currentQ >= 0 && currentQ < questions.length) {
    const q = questions[currentQ];

    // Word cloud results - no scoring feedback
    if (q.type === 'wordcloud') {
      return (
        <div style={s.page}>
          <div style={s.statusCard}>
            <div style={{ fontSize: 48 }}>{'\u{2601}\uFE0F'}</div>
            <h2 style={{ ...s.resultHeading, color: '#2980B9' }}>Wortwolke abgeschlossen!</h2>
            <p style={s.sentSub}>Schaut auf die Leinwand...</p>
          </div>
        </div>
      );
    }

    // Open answer results
    if (q.type === 'open') {
      const myAnswer = session.answers?.[currentQ]?.[playerName];
      const accepted = q.acceptedAnswers || [];
      let isCorrect = false;
      if (myAnswer) {
        const studentAnswer = (myAnswer.answer || '').trim();
        if (q.ignoreCase !== false) {
          isCorrect = accepted.some(a => a.trim().toLowerCase() === studentAnswer.toLowerCase());
        } else {
          isCorrect = accepted.some(a => a.trim() === studentAnswer);
        }
      }

      let pointsThisRound = 0;
      if (isCorrect && session.questionStartedAt && myAnswer) {
        const elapsed = (myAnswer.answeredAt - session.questionStartedAt) / 1000;
        const timeFraction = Math.max(0, Math.min(1, 1 - elapsed / q.timeLimit));
        pointsThisRound = Math.round(500 + 500 * timeFraction);
      }

      return (
        <div style={s.page}>
          <div style={s.statusCard}>
            {isCorrect ? (
              <>
                <div style={{ ...s.resultEmoji, color: '#27AE60' }}>{'\u2713'}</div>
                <h2 style={{ ...s.resultHeading, color: '#27AE60' }}>Richtig!</h2>
                <div style={s.pointsDisplay}>+{pointsThisRound} Punkte</div>
              </>
            ) : myAnswer ? (
              <>
                <div style={{ ...s.resultEmoji, color: '#E74C3C' }}>{'\u2717'}</div>
                <h2 style={{ ...s.resultHeading, color: '#E74C3C' }}>Leider falsch!</h2>
                <p style={s.correctAnswer}>Deine Antwort: {myAnswer.answer}</p>
                <p style={s.correctAnswer}>Richtig: {accepted.join(', ')}</p>
              </>
            ) : (
              <>
                <div style={{ ...s.resultEmoji, color: '#999' }}>?</div>
                <h2 style={{ ...s.resultHeading, color: '#999' }}>Keine Antwort</h2>
                <p style={s.correctAnswer}>Richtig: {accepted.join(', ')}</p>
              </>
            )}
            <div style={s.totalScore}>Gesamt: {myScore} Punkte</div>
          </div>
        </div>
      );
    }

    // Sorting results
    if (q.type === 'sorting') {
      const myAnswer = session.answers?.[currentQ]?.[playerName];
      const items = q.items || [];
      let correctCount = 0;
      const studentOrder = myAnswer ? (Array.isArray(myAnswer.answer) ? myAnswer.answer : []) : [];
      for (let i = 0; i < items.length; i++) {
        if (studentOrder[i] === i) correctCount++;
      }
      const allCorrect = correctCount === items.length;
      const basePoints = correctCount * 200 + (allCorrect ? 200 : 0);
      let pointsThisRound = 0;
      if (myAnswer && session.questionStartedAt) {
        const elapsed = (myAnswer.answeredAt - session.questionStartedAt) / 1000;
        const timeFactor = Math.max(0.5, Math.min(1, 1 - elapsed / q.timeLimit));
        pointsThisRound = Math.round(basePoints * timeFactor);
      }

      return (
        <div style={s.page}>
          <div style={s.statusCard}>
            {allCorrect ? (
              <>
                <div style={{ ...s.resultEmoji, color: '#27AE60' }}>{'\u2713'}</div>
                <h2 style={{ ...s.resultHeading, color: '#27AE60' }}>Alles richtig!</h2>
                <div style={s.pointsDisplay}>+{pointsThisRound} Punkte</div>
              </>
            ) : myAnswer ? (
              <>
                <div style={{ ...s.resultEmoji, color: '#E67E22' }}>{'\u{1F522}'}</div>
                <h2 style={{ ...s.resultHeading, color: '#E67E22' }}>{correctCount}/{items.length} richtig</h2>
                <div style={s.pointsDisplay}>+{pointsThisRound} Punkte</div>
              </>
            ) : (
              <>
                <div style={{ ...s.resultEmoji, color: '#999' }}>?</div>
                <h2 style={{ ...s.resultHeading, color: '#999' }}>Keine Antwort</h2>
              </>
            )}
            <div style={s.totalScore}>Gesamt: {myScore} Punkte</div>
          </div>
        </div>
      );
    }

    // Slider results
    if (q.type === 'slider') {
      const myAnswer = session.answers?.[currentQ]?.[playerName];
      const studentValue = myAnswer ? (typeof myAnswer.answer === 'number' ? myAnswer.answer : 0) : null;
      const distance = studentValue !== null ? Math.abs(studentValue - q.correctValue) : null;
      const inTol = distance !== null && distance <= q.tolerance;
      let pointsThisRound = 0;
      if (myAnswer && distance !== null) {
        const tol = q.tolerance || 1;
        let basePoints = 0;
        if (distance <= tol) basePoints = 1000;
        else if (distance <= tol * 2) basePoints = 800;
        else if (distance <= tol * 4) basePoints = 500;
        else if (distance <= tol * 8) basePoints = 200;
        if (session.questionStartedAt) {
          const elapsed = (myAnswer.answeredAt - session.questionStartedAt) / 1000;
          const timeFactor = Math.max(0.5, Math.min(1, 1 - elapsed / q.timeLimit));
          pointsThisRound = Math.round(basePoints * timeFactor);
        }
      }

      return (
        <div style={s.page}>
          <div style={s.statusCard}>
            {inTol ? (
              <>
                <div style={{ ...s.resultEmoji, color: '#27AE60' }}>{'\u2713'}</div>
                <h2 style={{ ...s.resultHeading, color: '#27AE60' }}>Im Toleranzbereich!</h2>
              </>
            ) : studentValue !== null ? (
              <>
                <div style={{ ...s.resultEmoji, color: '#E67E22' }}>{'\u{1F4CA}'}</div>
                <h2 style={{ ...s.resultHeading, color: '#E67E22' }}>Knapp daneben!</h2>
              </>
            ) : (
              <>
                <div style={{ ...s.resultEmoji, color: '#999' }}>?</div>
                <h2 style={{ ...s.resultHeading, color: '#999' }}>Keine Antwort</h2>
              </>
            )}
            {studentValue !== null && (
              <p style={s.correctAnswer}>Deine Antwort: {studentValue}{q.unit ? ` ${q.unit}` : ''}</p>
            )}
            <p style={s.correctAnswer}>Richtig: {q.correctValue}{q.unit ? ` ${q.unit}` : ''} (\u00B1{q.tolerance})</p>
            {pointsThisRound > 0 && <div style={s.pointsDisplay}>+{pointsThisRound} Punkte</div>}
            <div style={s.totalScore}>Gesamt: {myScore} Punkte</div>
          </div>
        </div>
      );
    }

    // MC / TF results
    const myAnswer = session.answers?.[currentQ]?.[playerName];
    const isCorrect = myAnswer && myAnswer.answer === q.correctIndex;
    const correctText = q.options?.[q.correctIndex] || '';

    let pointsThisRound = 0;
    if (isCorrect && session.questionStartedAt) {
      const elapsed = (myAnswer.answeredAt - session.questionStartedAt) / 1000;
      const timeFraction = Math.max(0, Math.min(1, 1 - elapsed / q.timeLimit));
      pointsThisRound = Math.round(500 + 500 * timeFraction);
    }

    return (
      <div style={s.page}>
        <div style={s.statusCard}>
          {isCorrect ? (
            <>
              <div style={{ ...s.resultEmoji, color: '#27AE60' }}>{'\u2713'}</div>
              <h2 style={{ ...s.resultHeading, color: '#27AE60' }}>Richtig!</h2>
              <div style={s.pointsDisplay}>+{pointsThisRound} Punkte</div>
            </>
          ) : myAnswer ? (
            <>
              <div style={{ ...s.resultEmoji, color: '#E74C3C' }}>{'\u2717'}</div>
              <h2 style={{ ...s.resultHeading, color: '#E74C3C' }}>Leider falsch!</h2>
              <p style={s.correctAnswer}>Richtig: {correctText}</p>
            </>
          ) : (
            <>
              <div style={{ ...s.resultEmoji, color: '#999' }}>?</div>
              <h2 style={{ ...s.resultHeading, color: '#999' }}>Keine Antwort</h2>
              <p style={s.correctAnswer}>Richtig: {correctText}</p>
            </>
          )}
          <div style={s.totalScore}>Gesamt: {myScore} Punkte</div>
        </div>
      </div>
    );
  }

  // --- LEADERBOARD ---
  if (status === 'leaderboard') {
    const allPlayers = session.players || {};
    const sorted = Object.entries(allPlayers)
      .map(([name, data]) => ({ name, score: data.score || 0 }))
      .sort((a, b) => b.score - a.score);
    const myRank = sorted.findIndex(p => p.name === playerName) + 1;
    const top5 = sorted.slice(0, 5);
    const medals = ['\u{1F947}', '\u{1F948}', '\u{1F949}'];

    return (
      <div style={s.page}>
        <div style={s.leaderCard}>
          <h2 style={s.leaderTitle}>{'\u{1F3C6}'} Rangliste</h2>
          <div style={s.myRankBig}>
            Du bist auf Platz <strong>{myRank}</strong>
          </div>
          {top5.map((entry, i) => (
            <div key={entry.name} style={{
              ...s.leaderRow,
              background: entry.name === playerName ? '#FFF3E0' : 'transparent',
              fontWeight: entry.name === playerName ? 800 : 600,
            }}>
              <span style={s.leaderRank}>{i < 3 ? medals[i] : `${i + 1}.`}</span>
              <span style={s.leaderName}>{entry.name}</span>
              <span style={s.leaderScore}>{entry.score}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // --- FINAL ---
  if (status === 'final') {
    const allPlayers = session.players || {};
    const sorted = Object.entries(allPlayers)
      .map(([name, data]) => ({ name, score: data.score || 0 }))
      .sort((a, b) => b.score - a.score);
    const myRank = sorted.findIndex(p => p.name === playerName) + 1;
    const medals = ['\u{1F947}', '\u{1F948}', '\u{1F949}'];

    return (
      <div style={s.page}>
        <div style={s.finalCard}>
          <h1 style={s.finalTitle}>{'\u{1F389}'} Endergebnis</h1>
          <div style={s.finalRankBig}>
            {myRank <= 3 ? medals[myRank - 1] : ''} Platz {myRank}
          </div>
          <div style={s.finalScoreBig}>{myScore} Punkte</div>
          <p style={s.finalThanks}>Danke f\u00FCrs Mitmachen!</p>
        </div>
      </div>
    );
  }

  // Fallback: waiting
  return (
    <div style={s.page}>
      <div style={s.statusCard}>
        <div style={s.waitingPulse}>Bitte warten...</div>
      </div>
    </div>
  );
}

const s = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(160deg, #FFF5EE 0%, #FFE8D6 50%, #F0E6D6 100%)',
    padding: '20px 16px 40px',
    fontFamily: "'Fredoka', sans-serif",
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    overflowY: 'auto',
    overflowX: 'hidden',
    WebkitOverflowScrolling: 'touch',
    boxSizing: 'border-box',
    width: '100%',
  },
  loadingText: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 24,
    color: '#8B5A2B',
    textAlign: 'center',
  },
  messageCard: {
    background: 'white',
    borderRadius: 20,
    padding: '32px 20px',
    maxWidth: 'min(420px, 90vw)',
    width: '100%',
    boxSizing: 'border-box',
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    textAlign: 'center',
  },
  messageDesc: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 17,
    color: '#777',
    fontWeight: 600,
    margin: 0,
  },
  // Name entry
  nameCard: {
    background: 'white',
    borderRadius: 20,
    padding: '32px 20px',
    maxWidth: 'min(400px, 90vw)',
    width: '100%',
    boxSizing: 'border-box',
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
  },
  nameTitle: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 28,
    color: '#FF6B35',
    margin: 0,
  },
  nameDesc: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 18,
    fontWeight: 700,
    color: '#333',
    margin: 0,
  },
  namePrompt: {
    fontSize: 16,
    color: '#777',
    fontWeight: 600,
    margin: 0,
  },
  nameInput: {
    width: '100%',
    padding: '12px 16px',
    fontSize: 18,
    borderRadius: 14,
    border: '2px solid rgba(255,107,53,0.3)',
    fontFamily: "'Fredoka', sans-serif",
    fontWeight: 600,
    outline: 'none',
    boxSizing: 'border-box',
  },
  nameBtn: {
    width: '100%',
    padding: '14px 24px',
    fontSize: 18,
    fontFamily: "'Lilita One', cursive",
    background: '#FF6B35',
    color: 'white',
    border: 'none',
    borderRadius: 14,
    cursor: 'pointer',
    boxSizing: 'border-box',
  },
  // Status card (lobby, waiting, results)
  statusCard: {
    background: 'white',
    borderRadius: 24,
    padding: '36px 20px',
    maxWidth: 'min(420px, 90vw)',
    width: '100%',
    boxSizing: 'border-box',
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    textAlign: 'center',
  },
  statusTitle: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 24,
    color: '#333',
    margin: 0,
  },
  waitingPulse: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 20,
    fontWeight: 700,
    color: '#AAA',
    animation: 'pulse 1.5s ease-in-out infinite',
  },
  playerCountBig: {
    fontFamily: "'Baloo 2', cursive",
    fontSize: 24,
    fontWeight: 700,
    color: '#333',
  },
  statusName: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 16,
    color: '#777',
    fontWeight: 600,
    margin: 0,
  },
  // Sent confirmation
  sentIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    background: '#E8F5E9',
    color: '#27AE60',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 32,
    fontWeight: 700,
  },
  sentText: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 22,
    color: '#27AE60',
    margin: 0,
  },
  sentSub: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 16,
    color: '#999',
    fontWeight: 600,
    margin: 0,
  },
  // Question on mobile
  questionCard: {
    width: '100%',
    maxWidth: 'min(500px, 90vw)',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    boxSizing: 'border-box',
  },
  qHeaderMobile: {
    textAlign: 'center',
  },
  qNumMobile: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 16,
    fontWeight: 700,
    color: '#999',
  },
  qTextMobile: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 22,
    color: '#333',
    margin: 0,
    textAlign: 'center',
    background: 'white',
    borderRadius: 16,
    padding: '20px 16px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
    boxSizing: 'border-box',
    wordBreak: 'break-word',
  },
  answerGridMc: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 10,
  },
  answerGridTf: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  answerBtn: {
    border: 'none',
    borderRadius: 14,
    padding: '18px 14px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    minHeight: 70,
    transition: 'transform 0.15s ease, opacity 0.15s ease',
    WebkitTapHighlightColor: 'transparent',
    boxSizing: 'border-box',
    overflow: 'hidden',
  },
  answerShape: {
    fontSize: 24,
    color: 'rgba(255,255,255,0.8)',
    flexShrink: 0,
  },
  answerText: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 18,
    fontWeight: 700,
    color: 'white',
    textAlign: 'left',
    wordBreak: 'break-word',
    minWidth: 0,
  },
  // Open answer input
  openInputArea: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    width: '100%',
  },
  openInput: {
    width: '100%',
    padding: '14px 16px',
    fontSize: 18,
    borderRadius: 14,
    border: '2px solid rgba(41,128,185,0.3)',
    fontFamily: "'Fredoka', sans-serif",
    fontWeight: 600,
    outline: 'none',
    boxSizing: 'border-box',
  },
  openSubmitBtn: {
    width: '100%',
    padding: '14px 24px',
    fontSize: 18,
    fontFamily: "'Lilita One', cursive",
    background: '#2980B9',
    color: 'white',
    border: 'none',
    borderRadius: 14,
    cursor: 'pointer',
    boxSizing: 'border-box',
  },
  // Word cloud input
  wcInputArea: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    width: '100%',
    background: 'white',
    borderRadius: 16,
    padding: '16px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
    boxSizing: 'border-box',
  },
  wcCounter: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 14,
    fontWeight: 600,
    color: '#999',
    textAlign: 'center',
  },
  wcInput: {
    flex: 1,
    padding: '12px 14px',
    fontSize: 17,
    borderRadius: 12,
    border: '2px solid rgba(155,93,229,0.3)',
    fontFamily: "'Fredoka', sans-serif",
    fontWeight: 600,
    outline: 'none',
    boxSizing: 'border-box',
    minWidth: 0,
  },
  wcSendBtn: {
    padding: '12px 18px',
    fontSize: 16,
    fontFamily: "'Lilita One', cursive",
    background: '#9B59B6',
    color: 'white',
    border: 'none',
    borderRadius: 12,
    cursor: 'pointer',
    flexShrink: 0,
    whiteSpace: 'nowrap',
  },
  wcDone: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    background: 'white',
    borderRadius: 16,
    padding: '24px 16px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
  },
  wcDoneText: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 18,
    fontWeight: 700,
    color: '#27AE60',
    margin: 0,
  },
  wcChips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  wcChip: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 15,
    fontWeight: 600,
    padding: '6px 14px',
    background: '#F3E5F5',
    color: '#7B1FA2',
    borderRadius: 20,
  },
  // Sorting
  sortingArea: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    background: 'white',
    borderRadius: 16,
    padding: '16px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
    boxSizing: 'border-box',
  },
  sortingLabel: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 14,
    fontWeight: 600,
    color: '#D35400',
    textAlign: 'center',
  },
  sortingPool: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  sortingPoolItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '14px 16px',
    borderRadius: 12,
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
    transition: 'opacity 0.15s ease',
  },
  sortingPickNum: {
    fontFamily: "'Baloo 2', cursive",
    fontSize: 18,
    fontWeight: 800,
    color: '#27AE60',
    width: 28,
    height: 28,
    borderRadius: 14,
    background: '#C8E6C9',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sortingPoolText: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 17,
    fontWeight: 700,
    color: '#333',
  },
  sortingSelected: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: '8px 12px',
    background: '#F1F8E9',
    borderRadius: 12,
  },
  sortingSelectedItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  sortingSelectedNum: {
    fontFamily: "'Baloo 2', cursive",
    fontSize: 16,
    fontWeight: 700,
    color: '#D35400',
    width: 24,
  },
  sortingSelectedText: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 15,
    fontWeight: 600,
    color: '#333',
  },
  sortingResetBtn: {
    flex: 1,
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 15,
    fontWeight: 700,
    padding: '12px 16px',
    background: 'rgba(0,0,0,0.06)',
    color: '#999',
    border: 'none',
    borderRadius: 12,
    cursor: 'pointer',
  },
  sortingSubmitBtn: {
    flex: 1,
    fontFamily: "'Lilita One', cursive",
    fontSize: 18,
    padding: '12px 24px',
    background: '#27AE60',
    color: 'white',
    border: 'none',
    borderRadius: 12,
    cursor: 'pointer',
  },
  // Slider
  sliderArea: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    background: 'white',
    borderRadius: 16,
    padding: '20px 16px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
    boxSizing: 'border-box',
    alignItems: 'center',
  },
  sliderValueDisplay: {
    fontFamily: "'Baloo 2', cursive",
    fontSize: 40,
    fontWeight: 800,
    color: '#2C3E50',
    textAlign: 'center',
  },
  sliderInput: {
    width: '100%',
    height: 44,
    WebkitAppearance: 'none',
    appearance: 'none',
    background: 'linear-gradient(90deg, #BDC3C7, #2C3E50)',
    borderRadius: 22,
    outline: 'none',
    cursor: 'pointer',
  },
  sliderMinMax: {
    display: 'flex',
    justifyContent: 'space-between',
    width: '100%',
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 14,
    fontWeight: 600,
    color: '#999',
  },
  sliderSubmitBtn: {
    width: '100%',
    fontFamily: "'Lilita One', cursive",
    fontSize: 20,
    padding: '14px 24px',
    background: '#2C3E50',
    color: 'white',
    border: 'none',
    borderRadius: 14,
    cursor: 'pointer',
  },
  // Results
  resultEmoji: {
    fontSize: 48,
    fontWeight: 700,
    width: 72,
    height: 72,
    borderRadius: 36,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0,0,0,0.04)',
  },
  resultHeading: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 26,
    margin: 0,
  },
  pointsDisplay: {
    fontFamily: "'Baloo 2', cursive",
    fontSize: 28,
    fontWeight: 800,
    color: '#27AE60',
  },
  correctAnswer: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 16,
    color: '#777',
    fontWeight: 600,
    margin: 0,
  },
  totalScore: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 18,
    fontWeight: 700,
    color: '#555',
    marginTop: 8,
    padding: '8px 20px',
    background: '#F5F5F5',
    borderRadius: 12,
    boxSizing: 'border-box',
    maxWidth: '100%',
  },
  // Leaderboard
  leaderCard: {
    background: 'white',
    borderRadius: 24,
    padding: '28px 16px',
    maxWidth: 'min(420px, 90vw)',
    width: '100%',
    boxSizing: 'border-box',
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  leaderTitle: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 24,
    color: '#FF6B35',
    margin: 0,
    textAlign: 'center',
  },
  myRankBig: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 18,
    fontWeight: 600,
    color: '#555',
    textAlign: 'center',
    padding: '6px 0',
  },
  leaderRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    borderRadius: 12,
  },
  leaderRank: {
    fontSize: 22,
    width: 32,
    textAlign: 'center',
    fontFamily: "'Baloo 2', cursive",
    fontWeight: 700,
  },
  leaderName: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 17,
    color: '#333',
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  leaderScore: {
    fontFamily: "'Baloo 2', cursive",
    fontSize: 20,
    fontWeight: 700,
    color: '#333',
  },
  // Final
  finalCard: {
    background: 'white',
    borderRadius: 24,
    padding: '40px 20px',
    maxWidth: 'min(420px, 90vw)',
    width: '100%',
    boxSizing: 'border-box',
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    textAlign: 'center',
  },
  finalTitle: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 30,
    color: '#FF6B35',
    margin: 0,
  },
  finalRankBig: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 36,
    color: '#333',
  },
  finalScoreBig: {
    fontFamily: "'Baloo 2', cursive",
    fontSize: 32,
    fontWeight: 800,
    color: '#FF6B35',
  },
  finalThanks: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 18,
    color: '#999',
    fontWeight: 600,
    margin: 0,
    marginTop: 8,
  },
};

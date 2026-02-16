import React, { useState, useEffect, lazy, Suspense } from 'react';
import { ref, push, set, remove, onValue } from 'firebase/database';
import { db } from '../firebase';
import QuizCreator from './QuizCreator';

const QuizSession = lazy(() => import('./QuizSession'));

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function ConfirmDialog({ message, confirmLabel, onConfirm, onCancel, danger }) {
  return (
    <div style={s.confirmOverlay}>
      <div style={s.confirmCard}>
        <p style={s.confirmText}>{message}</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button
            onClick={onConfirm}
            style={{ ...s.confirmBtn, background: danger ? '#E74C3C' : '#FF6B35' }}
          >
            {confirmLabel}
          </button>
          <button onClick={onCancel} style={s.confirmCancelBtn}>Abbrechen</button>
        </div>
      </div>
    </div>
  );
}

export default function QuizDialog({ onClose, dayColor, className: klassenName }) {
  const [mode, setMode] = useState('menu'); // 'menu' | 'create' | 'edit' | 'session'
  const [savedQuizzes, setSavedQuizzes] = useState([]);
  const [editingQuiz, setEditingQuiz] = useState(null); // { _key, title, questions }
  const [activeSessionCode, setActiveSessionCode] = useState(null);
  const [activeSessionQuiz, setActiveSessionQuiz] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const color = dayColor || '#FF6B35';

  // Load saved quizzes
  useEffect(() => {
    const quizzesRef = ref(db, 'savedQuizzes');
    const unsub = onValue(quizzesRef, (snap) => {
      const data = snap.val();
      if (data) {
        const list = Object.entries(data).map(([key, val]) => ({ ...val, _key: key }));
        list.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
        setSavedQuizzes(list);
      } else {
        setSavedQuizzes([]);
      }
    });
    return () => unsub();
  }, []);

  const handleSaveNewQuiz = (quizData) => {
    push(ref(db, 'savedQuizzes'), {
      ...quizData,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }).catch(console.error);
    setMode('menu');
  };

  const handleSaveEditQuiz = (quizData) => {
    if (!editingQuiz?._key) return;
    set(ref(db, 'savedQuizzes/' + editingQuiz._key), {
      ...quizData,
      createdAt: editingQuiz.createdAt || Date.now(),
      updatedAt: Date.now(),
    }).catch(console.error);
    setEditingQuiz(null);
    setMode('menu');
  };

  const handleDeleteQuiz = (quizKey) => {
    setConfirm({
      message: 'Quiz endgültig löschen?',
      confirmLabel: 'Löschen',
      danger: true,
      onConfirm: () => {
        remove(ref(db, 'savedQuizzes/' + quizKey)).catch(console.error);
        setConfirm(null);
      },
    });
  };

  const handleStartSession = (quiz) => {
    const code = generateCode();
    const sessionRef = ref(db, 'sessions/' + code);
    set(sessionRef, {
      quizTitle: quiz.title,
      questions: quiz.questions,
      status: 'lobby',
      currentQuestion: -1,
      questionStartedAt: null,
      createdAt: Date.now(),
    }).then(() => {
      setActiveSessionCode(code);
      setActiveSessionQuiz(quiz);
      setMode('session');
    }).catch(console.error);
  };

  const handleEndSession = () => {
    if (activeSessionCode) {
      remove(ref(db, 'sessions/' + activeSessionCode)).catch(console.error);
    }
    setActiveSessionCode(null);
    setActiveSessionQuiz(null);
    setMode('menu');
  };

  // --- SESSION MODE ---
  if (mode === 'session' && activeSessionCode && activeSessionQuiz) {
    return (
      <div style={s.fullOverlay}>
        {confirm && (
          <ConfirmDialog
            message={confirm.message}
            confirmLabel={confirm.confirmLabel}
            danger={confirm.danger}
            onConfirm={confirm.onConfirm}
            onCancel={() => setConfirm(null)}
          />
        )}
        <Suspense fallback={null}>
          <QuizSession
            quiz={activeSessionQuiz}
            sessionCode={activeSessionCode}
            onEnd={handleEndSession}
            dayColor={color}
            className={klassenName}
          />
        </Suspense>
      </div>
    );
  }

  // --- CREATE MODE ---
  if (mode === 'create') {
    return (
      <div style={s.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div style={s.formCard}>
          <QuizCreator
            quiz={null}
            onSave={handleSaveNewQuiz}
            onCancel={() => setMode('menu')}
            dayColor={color}
          />
        </div>
      </div>
    );
  }

  // --- EDIT MODE ---
  if (mode === 'edit' && editingQuiz) {
    return (
      <div style={s.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div style={s.formCard}>
          <QuizCreator
            quiz={editingQuiz}
            onSave={handleSaveEditQuiz}
            onCancel={() => { setEditingQuiz(null); setMode('menu'); }}
            dayColor={color}
          />
        </div>
      </div>
    );
  }

  // --- MENU MODE ---
  return (
    <div style={s.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          confirmLabel={confirm.confirmLabel}
          danger={confirm.danger}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
      <div style={s.menuCard}>
        <h2 style={{ ...s.title, color }}>{'\u{1F3AE}'} Quiz</h2>

        <button
          onClick={() => setMode('create')}
          style={{ ...s.menuBtn, background: color }}
        >
          + Neues Quiz erstellen
        </button>

        {savedQuizzes.length > 0 && (
          <>
            <div style={s.menuDivider}>
              <span style={s.menuDividerText}>Gespeicherte Quizze</span>
            </div>
            <div style={s.savedList}>
              {savedQuizzes.map((sq) => {
                const qCount = sq.questions?.length || 0;
                const date = sq.updatedAt ? new Date(sq.updatedAt).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
                return (
                  <div key={sq._key} style={s.savedItem}>
                    <div style={s.savedInfo}>
                      <div style={s.savedTitle}>{sq.title}</div>
                      <div style={s.savedMeta}>{date} &middot; {qCount} Frage{qCount !== 1 ? 'n' : ''}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => handleStartSession(sq)}
                        style={s.savedBtnStart}
                      >
                        Starten
                      </button>
                      <button
                        onClick={() => { setEditingQuiz(sq); setMode('edit'); }}
                        style={s.savedBtnEdit}
                      >
                        Bearbeiten
                      </button>
                      <button
                        onClick={() => handleDeleteQuiz(sq._key)}
                        style={s.savedBtnDelete}
                      >
                        Löschen
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <button onClick={onClose} style={s.cancelBtn}>Schließen</button>
      </div>
    </div>
  );
}

const s = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 9500,
    background: 'rgba(255, 250, 245, 0.95)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    overflowY: 'auto',
  },
  fullOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 9500,
    background: 'rgba(255, 250, 245, 0.95)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  menuCard: {
    background: 'white',
    borderRadius: 20,
    padding: '28px 24px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
    maxWidth: 500,
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    maxHeight: '90vh',
    overflowY: 'auto',
  },
  formCard: {
    background: 'white',
    borderRadius: 20,
    padding: '28px 24px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
    maxWidth: 600,
    width: '100%',
    maxHeight: '95vh',
    overflowY: 'auto',
  },
  title: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 24,
    margin: 0,
  },
  menuBtn: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 18,
    padding: '14px 24px',
    color: 'white',
    border: 'none',
    borderRadius: 14,
    cursor: 'pointer',
    textAlign: 'center',
  },
  menuDivider: {
    textAlign: 'center',
    marginTop: 4,
  },
  menuDividerText: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 14,
    fontWeight: 600,
    color: '#999',
  },
  savedList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  savedItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 14px',
    background: '#F8F8F8',
    borderRadius: 12,
    gap: 8,
  },
  savedInfo: { flex: 1, minWidth: 0 },
  savedTitle: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 15,
    fontWeight: 600,
    color: '#333',
  },
  savedMeta: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 12,
    color: '#999',
    fontWeight: 500,
  },
  savedBtnStart: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 13,
    fontWeight: 600,
    padding: '6px 12px',
    background: '#E8F5E9',
    color: '#2E7D32',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  savedBtnEdit: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 13,
    fontWeight: 600,
    padding: '6px 12px',
    background: '#E3F2FD',
    color: '#1976D2',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  savedBtnDelete: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 13,
    fontWeight: 600,
    padding: '6px 12px',
    background: '#FFEBEE',
    color: '#C62828',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  cancelBtn: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 16,
    fontWeight: 600,
    padding: '12px 20px',
    background: 'rgba(0,0,0,0.06)',
    color: '#666',
    border: 'none',
    borderRadius: 14,
    cursor: 'pointer',
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

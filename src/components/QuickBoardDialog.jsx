import React, { useState, useEffect, useRef } from 'react';
import { ref, set, push, remove, onValue } from 'firebase/database';
import { db } from '../firebase';
import { QRCodeSVG } from 'qrcode.react';

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

const TIMEOUT_MS = 8000;

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

export default function QuickBoardDialog({ onClose, dayColor }) {
  const [mode, setMode] = useState('menu'); // 'menu' | 'create' | 'active' | 'saved-view'
  const [formTitle, setFormTitle] = useState('');
  const [colCount, setColCount] = useState(3);
  const [colNames, setColNames] = useState(['Spalte 1', 'Spalte 2', 'Spalte 3']);

  // Active board state
  const [code, setCode] = useState(null);
  const [posts, setPosts] = useState([]);
  const [boardTitle, setBoardTitle] = useState('');
  const [boardCols, setBoardCols] = useState([]);
  const [status, setStatus] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [teacherTexts, setTeacherTexts] = useState({});
  const createdRef = useRef(false);

  // Saved boards
  const [savedBoards, setSavedBoards] = useState([]);
  const [viewingSavedBoard, setViewingSavedBoard] = useState(null);

  const color = dayColor || '#FF6B35';

  // Load saved boards on mount
  useEffect(() => {
    try {
      const savedRef = ref(db, 'savedBoards');
      const unsub = onValue(savedRef, (snap) => {
        try {
          const data = snap.val();
          if (data) {
            const list = Object.entries(data).map(([key, val]) => ({ ...val, _key: key }));
            list.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
            setSavedBoards(list);
          } else {
            setSavedBoards([]);
          }
        } catch (err) {
          console.error('[QuickBoard] Error processing saved boards:', err);
        }
      }, (err) => {
        console.error('[QuickBoard] Error loading saved boards:', err);
      });
      return () => unsub();
    } catch (err) {
      console.error('[QuickBoard] Error setting up saved boards listener:', err);
    }
  }, []);

  // Update column names when count changes
  const handleColCountChange = (newCount) => {
    setColCount(newCount);
    setColNames(prev => {
      const arr = [...prev];
      while (arr.length < newCount) arr.push(`Spalte ${arr.length + 1}`);
      return arr.slice(0, newCount);
    });
  };

  // Create board
  const handleCreate = () => {
    if (createdRef.current) return;
    createdRef.current = true;

    const title = formTitle.trim() || 'Klassen-Board';
    const cols = colNames.map(c => c.trim() || 'Spalte');
    setBoardTitle(title);
    setBoardCols(cols);
    setStatus('creating');
    setMode('active');

    const newCode = generateCode();
    const boardRef = ref(db, 'boards/' + newCode);
    const timeout = setTimeout(() => {
      setStatus('error');
      setErrorMsg('Verbindung fehlgeschlagen. Bitte pr\u00fcfe die Internetverbindung.');
    }, TIMEOUT_MS);

    set(boardRef, {
      title,
      columns: cols,
      active: true,
      createdAt: Date.now(),
    })
      .then(() => {
        clearTimeout(timeout);
        setCode(newCode);
        setStatus('ready');
      })
      .catch((err) => {
        clearTimeout(timeout);
        setStatus('error');
        setErrorMsg(`Board konnte nicht erstellt werden: ${err.message || 'Unbekannter Fehler'}`);
      });
  };

  // Listen to posts
  useEffect(() => {
    if (!code) return;
    try {
      const postsRef = ref(db, 'boards/' + code + '/posts');
      const unsub = onValue(postsRef, (snap) => {
        try {
          const data = snap.val();
          if (data) {
            const p = Object.entries(data).map(([key, val]) => ({ ...val, _key: key }));
            p.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
            setPosts(p);
          } else {
            setPosts([]);
          }
        } catch (err) {
          console.error('[QuickBoard] Error processing posts:', err);
        }
      });
      return () => unsub();
    } catch (err) {
      console.error('[QuickBoard] Error setting up posts listener:', err);
    }
  }, [code]);

  const boardUrl = code ? `${window.location.origin}/board/${code}` : '';

  const handleClearPosts = () => {
    setConfirm({
      message: 'Alle Beitr\u00e4ge l\u00f6schen?',
      confirmLabel: 'Ja, l\u00f6schen',
      danger: true,
      action: () => {
        remove(ref(db, 'boards/' + code + '/posts')).catch(console.error);
        setConfirm(null);
      },
    });
  };

  const handleCloseBoard = () => {
    set(ref(db, 'boards/' + code + '/active'), false).catch(console.error);
    onClose();
  };

  const handleDeletePost = (postKey) => {
    remove(ref(db, `boards/${code}/posts/${postKey}`)).catch(console.error);
  };

  const handleTeacherPost = (colIndex) => {
    const text = (teacherTexts[colIndex] || '').trim();
    if (!text || !code) return;
    push(ref(db, 'boards/' + code + '/posts'), {
      text,
      author: '\u{1F31F} Lehrkraft',
      column: colIndex,
      color: '#B3E5FC',
      timestamp: Date.now(),
    }).catch(console.error);
    setTeacherTexts(prev => ({ ...prev, [colIndex]: '' }));
  };

  const handleSaveBoard = () => {
    if (!code) return;
    push(ref(db, 'savedBoards'), {
      title: boardTitle,
      columns: boardCols,
      posts: posts.reduce((acc, p) => {
        acc[p._key] = { text: p.text, author: p.author, column: p.column, color: p.color, timestamp: p.timestamp, likes: p.likes || null };
        return acc;
      }, {}),
      savedAt: Date.now(),
      boardCode: code,
    }).catch(console.error);
  };

  const handleDeleteSavedBoard = (boardKey) => {
    setConfirm({
      message: 'Gespeichertes Board endg\u00fcltig l\u00f6schen?',
      confirmLabel: 'L\u00f6schen',
      danger: true,
      action: () => {
        remove(ref(db, 'savedBoards/' + boardKey)).catch(console.error);
        setConfirm(null);
      },
    });
  };

  // --- MENU MODE: choose between create new or view saved ---
  if (mode === 'menu') {
    return (
      <div style={s.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        {confirm && (
          <ConfirmDialog
            message={confirm.message}
            confirmLabel={confirm.confirmLabel}
            danger={confirm.danger}
            onConfirm={confirm.action}
            onCancel={() => setConfirm(null)}
          />
        )}
        <div style={s.menuCard}>
          <h2 style={{ ...s.title, color }}>{'\u{1F4CB}'} Klassen-Board</h2>

          <button
            onClick={() => setMode('create')}
            style={{ ...s.menuBtn, background: color }}
          >
            {'\u2795'} Neues Board erstellen
          </button>

          {savedBoards.length > 0 && (
            <>
              <div style={s.menuDivider}>
                <span style={s.menuDividerText}>Gespeicherte Boards</span>
              </div>
              <div style={s.savedList}>
                {savedBoards.map((sb) => {
                  const postCount = sb.posts ? Object.keys(sb.posts).length : 0;
                  const date = sb.savedAt ? new Date(sb.savedAt).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
                  return (
                    <div key={sb._key} style={s.savedItem}>
                      <div style={s.savedInfo}>
                        <div style={s.savedTitle}>{sb.title}</div>
                        <div style={s.savedMeta}>{date} &middot; {postCount} Beitr{'\u00e4'}ge</div>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => { setViewingSavedBoard(sb); setMode('saved-view'); }} style={s.savedBtnView}>Anzeigen</button>
                        <button onClick={() => handleDeleteSavedBoard(sb._key)} style={s.savedBtnDelete}>L{'\u00f6'}schen</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          <button onClick={onClose} style={s.cancelBtn}>Schlie{'\u00df'}en</button>
        </div>
      </div>
    );
  }

  // --- SAVED-VIEW MODE: read-only overlay ---
  if (mode === 'saved-view' && viewingSavedBoard) {
    const sbCols = viewingSavedBoard.columns || [];
    return (
      <div style={s.overlay}>
        {confirm && (
          <ConfirmDialog
            message={confirm.message}
            confirmLabel={confirm.confirmLabel}
            danger={confirm.danger}
            onConfirm={confirm.action}
            onCancel={() => setConfirm(null)}
          />
        )}
        <div style={s.container}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <h2 style={{ ...s.title, color, margin: 0 }}>{'\u{1F4CB}'} {viewingSavedBoard.title}</h2>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setViewingSavedBoard(null); setMode('menu'); }} style={s.adminBtnGrey}>Zur{'\u00fc'}ck</button>
              <button onClick={onClose} style={s.adminBtnGrey}>Schlie{'\u00df'}en</button>
            </div>
          </div>

          <div style={s.boardArea}>
            <div style={s.colContainer}>
              {sbCols.map((colName, ci) => {
                const sbPosts = viewingSavedBoard.posts
                  ? Object.entries(viewingSavedBoard.posts)
                      .filter(([, p]) => p.column === ci)
                      .sort((a, b) => (a[1].timestamp || 0) - (b[1].timestamp || 0))
                  : [];
                return (
                  <div key={ci} style={s.column}>
                    <div style={{ ...s.colHeader, color }}>{colName}</div>
                    <div style={s.colPosts}>
                      {sbPosts.map(([key, p]) => (
                        <div key={key} style={{ ...s.stickyNote, background: p.color || '#FFE0B2' }}>
                          <div style={s.noteAuthor}>{p.author}</div>
                          <div style={s.noteText}>{p.text}</div>
                        </div>
                      ))}
                      {sbPosts.length === 0 && (
                        <div style={s.emptyCol}>Keine Beitr{'\u00e4'}ge</div>
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

  // --- CREATE MODE ---
  if (mode === 'create') {
    return (
      <div style={s.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div style={s.formCard}>
          <h2 style={{ ...s.title, color }}>{'\u{1F4CB}'} Neues Board erstellen</h2>

          <label style={s.label}>Titel</label>
          <input
            type="text"
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            placeholder="z.B. Brainstorming"
            style={s.input}
          />

          <label style={s.label}>Spaltenanzahl</label>
          <div style={s.colCountRow}>
            {[2, 3, 4, 5, 6].map(n => (
              <button
                key={n}
                onClick={() => handleColCountChange(n)}
                style={{
                  ...s.colCountBtn,
                  background: colCount === n ? color : '#F0F0F0',
                  color: colCount === n ? 'white' : '#555',
                }}
              >
                {n}
              </button>
            ))}
          </div>

          <label style={s.label}>Spaltennamen</label>
          {colNames.slice(0, colCount).map((name, i) => (
            <input
              key={i}
              type="text"
              value={name}
              onChange={(e) => {
                const arr = [...colNames];
                arr[i] = e.target.value;
                setColNames(arr);
              }}
              style={{ ...s.input, marginBottom: 6 }}
            />
          ))}

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button onClick={handleCreate} style={{ ...s.createBtn, background: color }}>
              Board erstellen
            </button>
            <button onClick={() => setMode('menu')} style={s.cancelBtn}>Zur{'\u00fc'}ck</button>
          </div>
        </div>
      </div>
    );
  }

  // --- LOADING / ERROR ---
  if (status !== 'ready') {
    return (
      <div style={s.overlay}>
        <div style={s.formCard}>
          {status === 'creating' && (
            <>
              <div style={s.loadingText}>Board wird erstellt...</div>
              <div style={s.loadingSub}>Verbindung zu Firebase wird hergestellt...</div>
            </>
          )}
          {status === 'error' && (
            <>
              <div style={{ ...s.loadingText, color: '#CC3333' }}>{'\u26A0\uFE0F'} Fehler</div>
              <div style={s.errorText}>{errorMsg}</div>
              <button onClick={onClose} style={s.cancelBtn}>Schlie{'\u00df'}en</button>
            </>
          )}
        </div>
      </div>
    );
  }

  // --- ACTIVE BOARD VIEW ---
  return (
    <div style={s.overlay}>
      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          confirmLabel={confirm.confirmLabel}
          danger={confirm.danger}
          onConfirm={confirm.action}
          onCancel={() => setConfirm(null)}
        />
      )}
      <div style={s.container}>
        <div style={s.header}>
          <h1 style={{ ...s.title, color }}>{'\u{1F4CB}'} {boardTitle}</h1>
          <div style={s.adminRow}>
            <button onClick={handleSaveBoard} style={s.adminBtnGreen}>{'\u{1F4BE}'} Speichern</button>
            <button onClick={handleClearPosts} style={s.adminBtnOrange}>Leeren</button>
            <button onClick={handleCloseBoard} style={s.adminBtnGrey}>Schlie{'\u00df'}en</button>
          </div>
        </div>

        <div style={s.qrRow}>
          <div style={s.qrCard}>
            <QRCodeSVG value={boardUrl} size={150} level="M" />
            <div style={s.codeLabel}>Code: <strong>{code}</strong></div>
            <div style={s.urlLabel}>{boardUrl}</div>
          </div>
          <div style={s.infoCard}>
            <p style={s.infoText}>{'\u{1F4F1}'} Scannt den QR-Code!</p>
            <p style={s.infoText}>{'\u{1F465}'} {posts.length} Beitr{'\u00e4'}ge</p>
          </div>
        </div>

        <div style={s.boardArea}>
          <div style={s.colContainer}>
            {boardCols.map((colName, ci) => {
              const colPosts = posts.filter(p => p.column === ci);
              return (
                <div key={ci} style={s.column}>
                  <div style={{ ...s.colHeader, color }}>{colName}</div>
                  <div style={s.colPosts}>
                    {colPosts.map((p) => (
                      <div key={p._key} style={{ ...s.stickyNote, background: p.color || '#FFE0B2' }}>
                        <div style={s.noteHeader}>
                          <div style={s.noteAuthor}>{p.author}</div>
                          <button onClick={() => handleDeletePost(p._key)} style={s.deletePostBtn} title="L\u00f6schen">{'\u2715'}</button>
                        </div>
                        <div style={s.noteText}>{p.text}</div>
                      </div>
                    ))}
                    {colPosts.length === 0 && (
                      <div style={s.emptyCol}>Noch keine Beitr{'\u00e4'}ge</div>
                    )}
                  </div>
                  <div style={s.teacherInput}>
                    <input
                      type="text"
                      value={teacherTexts[ci] || ''}
                      onChange={(e) => setTeacherTexts(prev => ({ ...prev, [ci]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleTeacherPost(ci); }}
                      placeholder="Nachricht..."
                      style={s.teacherInputField}
                    />
                    <button
                      onClick={() => handleTeacherPost(ci)}
                      style={{ ...s.teacherSendBtn, background: color }}
                      disabled={!(teacherTexts[ci] || '').trim()}
                    >
                      Senden
                    </button>
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
  container: {
    width: '100%',
    maxWidth: 1200,
    maxHeight: '95vh',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    overflow: 'auto',
  },
  // Menu card
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
  formCard: {
    background: 'white',
    borderRadius: 20,
    padding: '32px 28px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
    maxWidth: 480,
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    maxHeight: '90vh',
    overflowY: 'auto',
  },
  title: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 24,
    margin: 0,
  },
  label: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 14,
    fontWeight: 600,
    color: '#777',
    marginTop: 8,
  },
  input: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 16,
    fontWeight: 500,
    padding: '10px 14px',
    border: '2px solid rgba(0,0,0,0.1)',
    borderRadius: 12,
    outline: 'none',
    background: '#FAFAFA',
  },
  colCountRow: {
    display: 'flex',
    gap: 8,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  colCountBtn: {
    fontFamily: "'Baloo 2', cursive",
    fontSize: 18,
    fontWeight: 700,
    width: 44,
    height: 44,
    border: 'none',
    borderRadius: 12,
    cursor: 'pointer',
  },
  createBtn: {
    flex: 1,
    fontFamily: "'Lilita One', cursive",
    fontSize: 18,
    padding: '12px 24px',
    color: 'white',
    border: 'none',
    borderRadius: 14,
    cursor: 'pointer',
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
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  adminRow: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  adminBtnGreen: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 14,
    fontWeight: 600,
    padding: '8px 14px',
    background: '#4CAF50',
    color: 'white',
    border: 'none',
    borderRadius: 10,
    cursor: 'pointer',
  },
  adminBtnOrange: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 14,
    fontWeight: 600,
    padding: '8px 14px',
    background: '#FF6B35',
    color: 'white',
    border: 'none',
    borderRadius: 10,
    cursor: 'pointer',
  },
  adminBtnGrey: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 14,
    fontWeight: 600,
    padding: '8px 14px',
    background: 'rgba(0,0,0,0.08)',
    color: '#555',
    border: 'none',
    borderRadius: 10,
    cursor: 'pointer',
  },
  qrRow: {
    display: 'flex',
    gap: 20,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  qrCard: {
    background: 'white',
    borderRadius: 20,
    padding: '20px 24px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
  },
  codeLabel: {
    fontFamily: "'Baloo 2', cursive",
    fontSize: 20,
    color: '#333',
    letterSpacing: 3,
  },
  urlLabel: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 12,
    color: '#999',
    wordBreak: 'break-all',
    textAlign: 'center',
    maxWidth: 200,
  },
  infoCard: {
    background: 'white',
    borderRadius: 20,
    padding: '20px 24px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 8,
  },
  infoText: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 18,
    color: '#555',
    fontWeight: 600,
    margin: 0,
  },
  boardArea: {
    flex: 1,
    minHeight: 0,
    overflowX: 'auto',
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch',
  },
  colContainer: {
    display: 'flex',
    gap: 12,
    minHeight: 200,
    minWidth: 'min-content',
  },
  column: {
    flex: '1 1 0',
    minWidth: 160,
    maxWidth: 300,
    background: 'rgba(255,255,255,0.7)',
    borderRadius: 16,
    padding: 10,
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
  },
  colHeader: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 8,
    paddingBottom: 6,
    borderBottom: '2px solid rgba(0,0,0,0.08)',
  },
  colPosts: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  stickyNote: {
    borderRadius: 10,
    padding: '8px 10px',
    boxShadow: '0 2px 6px rgba(0,0,0,0.07)',
  },
  noteHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  noteAuthor: {
    fontSize: 11,
    fontWeight: 700,
    color: '#8B5A2B',
    marginBottom: 3,
    opacity: 0.7,
  },
  deletePostBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 14,
    color: '#999',
    padding: '2px 4px',
    borderRadius: 6,
    lineHeight: 1,
  },
  noteText: {
    fontSize: 14,
    color: '#333',
    fontWeight: 600,
    fontFamily: "'Fredoka', sans-serif",
    lineHeight: 1.4,
  },
  emptyCol: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 13,
    color: '#aaa',
    fontWeight: 600,
    textAlign: 'center',
    padding: '14px 6px',
    fontStyle: 'italic',
  },
  teacherInput: {
    display: 'flex',
    gap: 4,
    marginTop: 8,
    paddingTop: 8,
    borderTop: '1px solid rgba(0,0,0,0.06)',
  },
  teacherInputField: {
    flex: 1,
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 13,
    fontWeight: 500,
    padding: '6px 8px',
    border: '1px solid rgba(0,0,0,0.12)',
    borderRadius: 8,
    outline: 'none',
    background: '#FAFAFA',
    minWidth: 0,
  },
  teacherSendBtn: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 12,
    fontWeight: 600,
    padding: '6px 10px',
    color: 'white',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  // Saved boards list
  savedList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  savedItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    background: '#F8F8F8',
    borderRadius: 10,
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
  savedBtnView: {
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
  loadingText: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 22,
    color: '#8B5A2B',
    textAlign: 'center',
  },
  loadingSub: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 15,
    color: '#999',
    fontWeight: 600,
    textAlign: 'center',
    marginTop: 6,
  },
  errorText: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 15,
    color: '#666',
    fontWeight: 600,
    textAlign: 'center',
    marginTop: 10,
    whiteSpace: 'pre-line',
    lineHeight: 1.5,
  },
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

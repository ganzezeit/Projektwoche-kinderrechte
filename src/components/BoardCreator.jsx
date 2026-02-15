import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ref, set, push, remove, onValue, get } from 'firebase/database';
import { db } from '../firebase';
import { QRCodeSVG } from 'qrcode.react';

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

const DEFAULT_COLUMNS = ['Pause & Freizeit', 'Schule & Lernen', 'Mitbestimmung', 'Alltag'];
const TIMEOUT_MS = 8000;

// --- Photo Lightbox with navigation ---
function PhotoLightbox({ photos, initialIndex, onClose }) {
  const [index, setIndex] = useState(initialIndex);
  const touchStart = useRef(null);

  const goPrev = useCallback(() => setIndex(i => (i > 0 ? i - 1 : photos.length - 1)), [photos.length]);
  const goNext = useCallback(() => setIndex(i => (i < photos.length - 1 ? i + 1 : 0)), [photos.length]);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, goPrev, goNext]);

  const handleTouchStart = (e) => { touchStart.current = e.touches[0].clientX; };
  const handleTouchEnd = (e) => {
    if (touchStart.current === null) return;
    const diff = e.changedTouches[0].clientX - touchStart.current;
    if (Math.abs(diff) > 50) { diff > 0 ? goPrev() : goNext(); }
    touchStart.current = null;
  };

  const photo = photos[index];
  if (!photo) return null;

  return (
    <div
      style={lbStyles.overlay}
      onClick={onClose}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Left arrow */}
      {photos.length > 1 && (
        <button onClick={(e) => { e.stopPropagation(); goPrev(); }} style={lbStyles.arrowLeft}>
          {'\u2039'}
        </button>
      )}

      <img
        src={photo.url}
        alt="Foto"
        style={lbStyles.image}
        onClick={(e) => e.stopPropagation()}
      />

      {/* Right arrow */}
      {photos.length > 1 && (
        <button onClick={(e) => { e.stopPropagation(); goNext(); }} style={lbStyles.arrowRight}>
          {'\u203A'}
        </button>
      )}

      {/* Close button */}
      <button onClick={onClose} style={lbStyles.closeBtn}>{'\u2715'}</button>

      {/* Counter */}
      {photos.length > 1 && (
        <div style={lbStyles.counter}>{index + 1} / {photos.length}</div>
      )}
    </div>
  );
}

const lbStyles = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 5000,
    background: 'rgba(0,0,0,0.88)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer',
  },
  image: {
    maxWidth: '80vw', maxHeight: '85vh',
    objectFit: 'contain', borderRadius: 8, cursor: 'default',
    transition: 'opacity 0.2s ease',
  },
  arrowLeft: {
    position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
    background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white',
    fontSize: 48, width: 56, height: 72, borderRadius: 12, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    backdropFilter: 'blur(4px)',
  },
  arrowRight: {
    position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)',
    background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white',
    fontSize: 48, width: 56, height: 72, borderRadius: 12, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    backdropFilter: 'blur(4px)',
  },
  closeBtn: {
    position: 'absolute', top: 16, right: 20,
    background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white',
    fontSize: 24, width: 44, height: 44, borderRadius: 22, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    backdropFilter: 'blur(4px)',
  },
  counter: {
    position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
    fontFamily: "'Fredoka', sans-serif", fontSize: 16, fontWeight: 600,
    color: 'rgba(255,255,255,0.8)', background: 'rgba(0,0,0,0.4)',
    padding: '6px 16px', borderRadius: 20,
  },
};

// Confirmation dialog overlay
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

export default function BoardCreator({ title, columns, dayColor, onClose }) {
  const [code, setCode] = useState(null);
  const [posts, setPosts] = useState([]);
  const [status, setStatus] = useState('creating');
  const [errorMsg, setErrorMsg] = useState('');
  const [confirm, setConfirm] = useState(null);
  const createdRef = useRef(false);

  // F3: Teacher input state
  const [teacherTexts, setTeacherTexts] = useState({});

  // F1: Saved boards state
  const [savedBoards, setSavedBoards] = useState([]);
  const [showSavedBoards, setShowSavedBoards] = useState(false);
  const [viewingSavedBoard, setViewingSavedBoard] = useState(null);

  // Lightbox state: index into allPhotos array, or null
  const [lightboxIndex, setLightboxIndex] = useState(null);

  const cols = columns || DEFAULT_COLUMNS;

  // Collect all photos from all posts for lightbox navigation
  const allPhotos = useMemo(() => {
    return posts
      .filter(p => p.imageUrl)
      .map(p => ({ url: p.imageUrl, key: p._key }));
  }, [posts]);

  const openLightbox = useCallback((imageUrl) => {
    const idx = allPhotos.findIndex(p => p.url === imageUrl);
    setLightboxIndex(idx >= 0 ? idx : 0);
  }, [allPhotos]);

  // Create board on mount
  useEffect(() => {
    if (createdRef.current) return;
    createdRef.current = true;

    const newCode = generateCode();
    console.log('[BoardCreator] Creating board...', newCode);

    const boardRef = ref(db, 'boards/' + newCode);
    const timeout = setTimeout(() => {
      console.error('[BoardCreator] Timeout');
      setStatus('error');
      setErrorMsg(
        'Verbindung fehlgeschlagen. Bitte pr\u00fcfe die Internetverbindung.' +
        '\n\nFalls der Fehler bestehen bleibt: Bitte in der Firebase Console unter Realtime Database \u2192 Rules die Lese- und Schreibrechte aktivieren.'
      );
    }, TIMEOUT_MS);

    set(boardRef, {
      title: title || 'Fragen-Werkstatt',
      columns: cols,
      active: true,
      createdAt: Date.now(),
    })
      .then(() => {
        clearTimeout(timeout);
        console.log('[BoardCreator] Board created successfully:', newCode);
        setCode(newCode);
        setStatus('ready');
      })
      .catch((err) => {
        clearTimeout(timeout);
        console.error('[BoardCreator] Firebase write failed:', err.message || err);
        setStatus('error');
        setErrorMsg(
          `Board konnte nicht erstellt werden: ${err.message || 'Unbekannter Fehler'}` +
          '\n\nFalls der Fehler bestehen bleibt: Bitte in der Firebase Console unter Realtime Database \u2192 Rules die Lese- und Schreibrechte aktivieren.'
        );
      });

    return () => clearTimeout(timeout);
  }, []);

  const handleRetry = () => {
    createdRef.current = false;
    setStatus('creating');
    setErrorMsg('');

    const newCode = generateCode();
    console.log('[BoardCreator] Retrying...', newCode);

    const boardRef = ref(db, 'boards/' + newCode);
    const timeout = setTimeout(() => {
      setStatus('error');
      setErrorMsg('Verbindung fehlgeschlagen. Bitte pr\u00fcfe die Internetverbindung.');
    }, TIMEOUT_MS);

    set(boardRef, {
      title: title || 'Fragen-Werkstatt',
      columns: cols,
      active: true,
      createdAt: Date.now(),
    })
      .then(() => {
        clearTimeout(timeout);
        console.log('[BoardCreator] Retry successful:', newCode);
        setCode(newCode);
        setStatus('ready');
      })
      .catch((err) => {
        clearTimeout(timeout);
        console.error('[BoardCreator] Retry failed:', err.message || err);
        setStatus('error');
        setErrorMsg(`Board konnte nicht erstellt werden: ${err.message || 'Unbekannter Fehler'}`);
      });
  };

  // Listen to posts once board is created
  useEffect(() => {
    if (!code) return;
    console.log('[BoardCreator] Listening for posts on board:', code);
    const postsRef = ref(db, 'boards/' + code + '/posts');
    const unsub = onValue(postsRef, (snap) => {
      const data = snap.val();
      if (data) {
        const p = Object.entries(data).map(([key, val]) => ({ ...val, _key: key }));
        p.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        setPosts(p);
      } else {
        setPosts([]);
      }
    }, (err) => {
      console.error('[BoardCreator] Error listening to posts:', err.message || err);
    });
    return () => unsub();
  }, [code]);

  const boardUrl = code ? `${window.location.origin}/board/${code}` : '';

  // --- Admin actions ---
  const handleCloseBoard = () => {
    setConfirm({
      message: 'Board schlie\u00dfen? Sch\u00fcler k\u00f6nnen dann nicht mehr schreiben.',
      confirmLabel: 'Ja, schlie\u00dfen',
      danger: false,
      action: () => {
        set(ref(db, 'boards/' + code + '/active'), false).catch((err) => {
          console.error('[BoardCreator] Error closing board:', err);
        });
        onClose();
      },
    });
  };

  const handleClearPosts = () => {
    setConfirm({
      message: 'Alle Beitr\u00e4ge l\u00f6schen? Das kann nicht r\u00fcckg\u00e4ngig gemacht werden.',
      confirmLabel: 'Ja, l\u00f6schen',
      danger: true,
      action: () => {
        remove(ref(db, 'boards/' + code + '/posts')).catch((err) => {
          console.error('[BoardCreator] Error clearing posts:', err);
        });
        setConfirm(null);
      },
    });
  };

  const handleDeleteBoard = () => {
    setConfirm({
      message: 'Board und alle Beitr\u00e4ge endg\u00fcltig l\u00f6schen?',
      confirmLabel: 'Endg\u00fcltig l\u00f6schen',
      danger: true,
      action: () => {
        remove(ref(db, 'boards/' + code)).catch((err) => {
          console.error('[BoardCreator] Error deleting board:', err);
        });
        onClose();
      },
    });
  };

  const handleDeletePost = (postKey) => {
    remove(ref(db, `boards/${code}/posts/${postKey}`)).catch((err) => {
      console.error('[BoardCreator] Error deleting post:', err);
    });
  };

  const handleRefresh = () => {
    const currentCode = code;
    setCode(null);
    setTimeout(() => setCode(currentCode), 100);
  };

  // F3: Teacher post handler
  const handleTeacherPost = (colIndex) => {
    const text = (teacherTexts[colIndex] || '').trim();
    if (!text || !code) return;
    const postsRef = ref(db, 'boards/' + code + '/posts');
    push(postsRef, {
      text,
      author: '\u{1F31F} Lehrkraft',
      column: colIndex,
      color: '#B3E5FC',
      timestamp: Date.now(),
    }).catch((err) => {
      console.error('[BoardCreator] Error posting teacher message:', err);
    });
    setTeacherTexts(prev => ({ ...prev, [colIndex]: '' }));
  };

  // F1: Load saved boards
  useEffect(() => {
    const savedRef = ref(db, 'savedBoards');
    const unsub = onValue(savedRef, (snap) => {
      const data = snap.val();
      if (data) {
        const list = Object.entries(data).map(([key, val]) => ({ ...val, _key: key }));
        list.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
        setSavedBoards(list);
      } else {
        setSavedBoards([]);
      }
    }, (err) => {
      console.error('[BoardCreator] Error loading saved boards:', err);
    });
    return () => unsub();
  }, []);

  // F1: Save board snapshot
  const handleSaveBoard = () => {
    if (!code) return;
    const savedRef = ref(db, 'savedBoards');
    push(savedRef, {
      title: title || 'Fragen-Werkstatt',
      columns: cols,
      posts: posts.reduce((acc, p) => {
        acc[p._key] = { text: p.text, author: p.author, column: p.column, color: p.color, timestamp: p.timestamp, likes: p.likes || null, imageUrl: p.imageUrl || null };
        return acc;
      }, {}),
      savedAt: Date.now(),
      boardCode: code,
    }).then(() => {
      console.log('[BoardCreator] Board saved successfully');
    }).catch((err) => {
      console.error('[BoardCreator] Error saving board:', err);
    });
  };

  // F1: Delete saved board
  const handleDeleteSavedBoard = (boardKey) => {
    setConfirm({
      message: 'Gespeichertes Board endg\u00fcltig l\u00f6schen?',
      confirmLabel: 'L\u00f6schen',
      danger: true,
      action: () => {
        remove(ref(db, 'savedBoards/' + boardKey)).catch((err) => {
          console.error('[BoardCreator] Error deleting saved board:', err);
        });
        setConfirm(null);
      },
    });
  };

  // Loading / Error state
  if (status !== 'ready') {
    return (
      <div style={s.overlay}>
        <div style={s.card}>
          {status === 'creating' && (
            <>
              <div style={s.loadingText}>Board wird erstellt...</div>
              <div style={s.loadingSub}>Verbindung zu Firebase wird hergestellt...</div>
            </>
          )}
          {status === 'error' && (
            <>
              <div style={{ ...s.loadingText, color: '#CC3333' }}>
                {'\u26A0\uFE0F'} Verbindung fehlgeschlagen
              </div>
              <div style={s.errorText}>{errorMsg}</div>
              <div style={{ display: 'flex', gap: 12, marginTop: 16, justifyContent: 'center' }}>
                <button onClick={handleRetry} style={{ ...s.retryBtn, background: dayColor }}>
                  {'\u{1F504}'} Nochmal versuchen
                </button>
                <button onClick={onClose} style={s.adminBtnGrey}>Zur{'\u00fc'}ck</button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={s.overlay} className="board-overlay">
      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          confirmLabel={confirm.confirmLabel}
          danger={confirm.danger}
          onConfirm={confirm.action}
          onCancel={() => setConfirm(null)}
        />
      )}

      <div style={s.container} className="board-creator-container">
        {/* Row 1: Back + title + actions */}
        <div style={s.headerRow1} className="board-header-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={onClose} style={s.backBtn}>{'\u2190'}</button>
            <h1 style={{ ...s.title, color: dayColor }}>{'\u{1F4CB}'} Klassen-Board</h1>
            {savedBoards.length > 0 && (
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowSavedBoards(!showSavedBoards)}
                  style={s.savedToggleBtn}
                >
                  {'\u{1F4C1}'} ({savedBoards.length}) {showSavedBoards ? '\u25B2' : '\u25BC'}
                </button>
                {showSavedBoards && (
                  <div style={s.savedDropdown}>
                    {savedBoards.map((sb) => {
                      const postCount = sb.posts ? Object.keys(sb.posts).length : 0;
                      const date = sb.savedAt ? new Date(sb.savedAt).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
                      return (
                        <div key={sb._key} style={s.savedItem}>
                          <div style={s.savedInfo}>
                            <div style={s.savedTitle}>{sb.title}</div>
                            <div style={s.savedMeta}>{date} &middot; {postCount} Beitr{'\u00e4'}ge</div>
                          </div>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button onClick={() => { setViewingSavedBoard(sb); setShowSavedBoards(false); }} style={s.savedBtnView}>Anzeigen</button>
                            <button onClick={() => handleDeleteSavedBoard(sb._key)} style={s.savedBtnDelete}>L{'\u00f6'}schen</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
          <div style={s.adminRow}>
            <button onClick={handleRefresh} style={s.adminBtn} title="Aktualisieren">{'\u{1F504}'}</button>
            <button onClick={handleSaveBoard} style={s.adminBtnGreen}>{'\u{1F4BE}'} Speichern</button>
            <button onClick={() => window.print()} style={s.adminBtnPdf}>{'\u{1F4C4}'} Als PDF</button>
            <button onClick={handleClearPosts} style={s.adminBtnOrange}>Leeren</button>
            <button onClick={handleCloseBoard} style={s.adminBtnGrey}>Schlie{'\u00df'}en</button>
            <button onClick={handleDeleteBoard} style={s.adminBtnRed}>L{'\u00f6'}schen</button>
          </div>
        </div>

        {/* Print-only header */}
        <div className="board-print-header" style={{ display: 'none' }}>
          <h1 style={{ fontFamily: "'Lilita One', cursive", fontSize: 28, color: dayColor, margin: '0 0 4px' }}>
            {title || 'Fragen-Werkstatt'} — Klassen-Board Export
          </h1>
          <p style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 14, color: '#666', margin: 0 }}>
            {new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })} — {posts.length} Beitr{'\u00e4'}ge
          </p>
        </div>

        {/* Row 2: Centered QR code + code + URL */}
        <div style={s.qrBar} className="board-qr-bar">
          <div style={s.qrBarCenter}>
            <QRCodeSVG value={boardUrl} size={80} level="M" />
            <div style={s.qrBarInfo}>
              <span style={s.qrBarCode}>Code: <strong>{code}</strong></span>
              <span style={s.qrBarUrl}>{boardUrl}</span>
              <span style={s.qrBarMeta}>{'\u{1F465}'} {posts.length} Beitr{'\u00e4'}ge</span>
            </div>
          </div>
        </div>

        {/* Columns — fill remaining height */}
        <div style={s.boardArea} className="board-columns-area">
          <div style={s.colContainer}>
            {cols.map((colName, ci) => {
              const colPosts = posts.filter(p => p.column === ci);
              return (
                <div key={ci} style={s.column} className="board-column">
                  {/* Sticky header */}
                  <div style={{ ...s.colHeader, color: dayColor }} className="board-col-header">{colName}</div>
                  {/* Scrollable posts */}
                  <div style={s.colPosts} className="board-col-posts">
                    {colPosts.map((p) => {
                      const likeCount = p.likes ? Object.keys(p.likes).length : 0;
                      return (
                        <div key={p._key} className="board-post" style={{
                          ...s.stickyNote,
                          background: p.color || '#FFE0B2',
                          border: likeCount >= 3 ? '2px solid rgba(231,76,60,0.3)' : 'none',
                        }}>
                          <div style={s.noteHeader}>
                            <div style={s.noteAuthor}>{p.author}</div>
                            <button
                              onClick={() => handleDeletePost(p._key)}
                              style={s.deletePostBtn}
                              title="Beitrag l\u00f6schen"
                            >{'\u2715'}</button>
                          </div>
                          {p.imageUrl && (
                            <img
                              src={p.imageUrl} alt="Foto" loading="lazy" decoding="async"
                              style={s.noteImage}
                              onClick={() => openLightbox(p.imageUrl)}
                            />
                          )}
                          {p.text && <div style={s.noteText}>{p.text}</div>}
                          {likeCount > 0 && (
                            <div style={s.likeInfo}>{'\u2764\uFE0F'} {likeCount}</div>
                          )}
                        </div>
                      );
                    })}
                    {colPosts.length === 0 && (
                      <div style={s.emptyCol}>Noch keine Beitr{'\u00e4'}ge</div>
                    )}
                  </div>
                  {/* Sticky footer: teacher input */}
                  <div style={s.teacherInput} className="board-teacher-input">
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
                      style={{ ...s.teacherSendBtn, background: dayColor || '#FF6B35' }}
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

      {/* Photo lightbox with navigation */}
      {lightboxIndex !== null && allPhotos.length > 0 && (
        <PhotoLightbox
          photos={allPhotos}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}

      {/* F1: Read-only saved board overlay */}
      {viewingSavedBoard && (
        <div style={s.savedOverlay}>
          <div style={s.savedOverlayCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ ...s.title, color: dayColor, margin: 0 }}>{'\u{1F4CB}'} {viewingSavedBoard.title}</h2>
              <button onClick={() => setViewingSavedBoard(null)} style={s.adminBtnGrey}>Schlie{'\u00df'}en</button>
            </div>
            <div style={s.savedColContainer}>
              {(viewingSavedBoard.columns || []).map((colName, ci) => {
                const sbPosts = viewingSavedBoard.posts
                  ? Object.entries(viewingSavedBoard.posts)
                      .filter(([, p]) => p.column === ci)
                      .sort((a, b) => (a[1].timestamp || 0) - (b[1].timestamp || 0))
                  : [];
                return (
                  <div key={ci} style={s.savedColumn}>
                    <div style={{ ...s.colHeader, color: dayColor }}>{colName}</div>
                    <div style={s.colPosts}>
                      {sbPosts.map(([key, p]) => (
                        <div key={key} style={{ ...s.stickyNote, background: p.color || '#FFE0B2' }}>
                          <div style={s.noteAuthor}>{p.author}</div>
                          {p.imageUrl && (
                            <img
                              src={p.imageUrl} alt="Foto" loading="lazy" decoding="async"
                              style={s.noteImage}
                            />
                          )}
                          {p.text && <div style={s.noteText}>{p.text}</div>}
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
      )}
    </div>
  );
}

const s = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 2000,
    background: 'rgba(255, 250, 245, 0.95)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    display: 'flex',
    flexDirection: 'column',
    padding: '12px 16px',
    overflow: 'hidden',
  },
  container: {
    width: '100%',
    maxWidth: 1400,
    height: '100%',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    overflow: 'hidden',
  },
  // Row 1: Header
  headerRow1: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    flexShrink: 0,
  },
  backBtn: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 20,
    fontWeight: 700,
    padding: '4px 10px',
    background: 'rgba(0,0,0,0.06)',
    border: 'none',
    borderRadius: 10,
    cursor: 'pointer',
    color: '#555',
    lineHeight: 1,
  },
  title: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 22,
    margin: 0,
  },
  adminRow: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  adminBtn: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 16,
    padding: '6px 10px',
    background: 'rgba(0,0,0,0.05)',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
  },
  adminBtnGreen: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 13,
    fontWeight: 600,
    padding: '6px 12px',
    background: '#4CAF50',
    color: 'white',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
  },
  adminBtnOrange: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 13,
    fontWeight: 600,
    padding: '6px 12px',
    background: '#FF6B35',
    color: 'white',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
  },
  adminBtnGrey: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 13,
    fontWeight: 600,
    padding: '6px 12px',
    background: 'rgba(0,0,0,0.08)',
    color: '#555',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
  },
  adminBtnRed: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 13,
    fontWeight: 600,
    padding: '6px 12px',
    background: '#E74C3C',
    color: 'white',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
  },
  // Row 2: QR bar centered
  qrBar: {
    display: 'flex',
    justifyContent: 'center',
    flexShrink: 0,
    padding: '4px 0',
  },
  qrBarCenter: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    background: 'white',
    borderRadius: 14,
    padding: '6px 16px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
  },
  qrBarInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
  },
  qrBarCode: {
    fontFamily: "'Baloo 2', cursive",
    fontSize: 16,
    color: '#333',
    letterSpacing: 2,
  },
  qrBarUrl: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 11,
    color: '#999',
    wordBreak: 'break-all',
    lineHeight: 1.2,
  },
  qrBarMeta: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 13,
    color: '#555',
    fontWeight: 600,
  },
  adminBtnPdf: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 13,
    fontWeight: 600,
    padding: '6px 12px',
    background: '#1976D2',
    color: 'white',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
  },
  // Board area — fills remaining space
  boardArea: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  colContainer: {
    display: 'flex',
    gap: 10,
    height: '100%',
    minWidth: 'min-content',
    overflow: 'hidden',
  },
  column: {
    flex: '1 1 0',
    minWidth: 160,
    maxWidth: 320,
    background: 'rgba(255,255,255,0.7)',
    borderRadius: 14,
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  colHeader: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 15,
    textAlign: 'center',
    padding: '8px 10px 6px',
    borderBottom: '2px solid rgba(0,0,0,0.08)',
    flexShrink: 0,
  },
  colPosts: {
    flex: 1,
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch',
    padding: '6px 8px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  stickyNote: {
    borderRadius: 10,
    padding: '8px 12px',
    boxShadow: '0 2px 6px rgba(0,0,0,0.07)',
    position: 'relative',
    flexShrink: 0,
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
  noteImage: {
    width: '100%',
    borderRadius: 8,
    marginBottom: 4,
    cursor: 'pointer',
    objectFit: 'cover',
    maxHeight: 180,
  },
  noteText: {
    fontSize: 15,
    color: '#333',
    fontWeight: 600,
    fontFamily: "'Fredoka', sans-serif",
    lineHeight: 1.4,
  },
  likeInfo: {
    fontSize: 13,
    color: '#E74C3C',
    fontFamily: "'Fredoka', sans-serif",
    fontWeight: 600,
    marginTop: 4,
  },
  emptyCol: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 14,
    color: '#aaa',
    fontWeight: 600,
    textAlign: 'center',
    padding: '16px 8px',
    fontStyle: 'italic',
  },
  // Teacher input — sticky at bottom
  teacherInput: {
    display: 'flex',
    gap: 4,
    padding: '6px 8px',
    borderTop: '1px solid rgba(0,0,0,0.06)',
    flexShrink: 0,
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
  // Saved boards dropdown
  savedToggleBtn: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 13,
    fontWeight: 600,
    color: '#555',
    background: 'rgba(0,0,0,0.05)',
    border: 'none',
    borderRadius: 8,
    padding: '6px 10px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  savedDropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    marginTop: 4,
    background: 'white',
    borderRadius: 12,
    padding: 8,
    boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
    zIndex: 100,
    minWidth: 280,
    maxHeight: 300,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  savedItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 10px',
    background: '#F8F8F8',
    borderRadius: 8,
    gap: 6,
  },
  savedInfo: { flex: 1, minWidth: 0 },
  savedTitle: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 14,
    fontWeight: 600,
    color: '#333',
  },
  savedMeta: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 11,
    color: '#999',
    fontWeight: 500,
  },
  savedBtnView: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 12,
    fontWeight: 600,
    padding: '4px 10px',
    background: '#E3F2FD',
    color: '#1976D2',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  savedBtnDelete: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 12,
    fontWeight: 600,
    padding: '4px 10px',
    background: '#FFEBEE',
    color: '#C62828',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  // Saved board overlay
  savedOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 2500,
    background: 'rgba(255, 250, 245, 0.97)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    overflowY: 'auto',
  },
  savedOverlayCard: {
    width: '100%',
    maxWidth: 1200,
    maxHeight: '90vh',
    overflowX: 'auto',
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch',
  },
  savedColContainer: {
    display: 'flex',
    gap: 12,
    minHeight: 200,
    minWidth: 'min-content',
  },
  savedColumn: {
    flex: '1 1 0',
    minWidth: 160,
    maxWidth: 300,
    background: 'rgba(255,255,255,0.7)',
    borderRadius: 14,
    padding: 10,
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
  },
  // Loading / Error
  loadingText: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 24,
    color: '#8B5A2B',
    textAlign: 'center',
  },
  loadingSub: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 16,
    color: '#999',
    fontWeight: 600,
    textAlign: 'center',
    marginTop: 8,
  },
  errorText: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 16,
    color: '#666',
    fontWeight: 600,
    textAlign: 'center',
    marginTop: 12,
    whiteSpace: 'pre-line',
    lineHeight: 1.5,
    maxWidth: 500,
  },
  retryBtn: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 18,
    padding: '12px 28px',
    color: 'white',
    border: 'none',
    borderRadius: 20,
    cursor: 'pointer',
  },
  card: {
    background: 'white',
    borderRadius: 20,
    padding: '40px 32px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    maxWidth: 550,
    width: '100%',
    margin: 'auto',
  },
  // Confirm dialog
  confirmOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 3000,
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

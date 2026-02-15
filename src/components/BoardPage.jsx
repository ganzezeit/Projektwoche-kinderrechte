import React, { useState, useEffect, useCallback } from 'react';
import { ref, onValue, push, set, remove } from 'firebase/database';
import { db } from '../firebase';

const PASTEL_COLORS = ['#FFE0B2', '#FFF9C4', '#C8E6C9', '#F8BBD0', '#D1C4E9', '#B3E5FC', '#FFCCBC'];

function pickColor() {
  return PASTEL_COLORS[Math.floor(Math.random() * PASTEL_COLORS.length)];
}

function LikeButton({ postKey, likes, author, code }) {
  const likeCount = likes ? Object.keys(likes).length : 0;
  const hasLiked = likes && likes[author];

  const toggleLike = () => {
    const likeRef = ref(db, `boards/${code}/posts/${postKey}/likes/${author}`);
    if (hasLiked) {
      remove(likeRef).catch(() => {});
    } else {
      set(likeRef, true).catch(() => {});
    }
  };

  return (
    <button onClick={toggleLike} style={{
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      padding: '4px 0 0',
      fontSize: 14,
      color: hasLiked ? '#E74C3C' : '#999',
      fontFamily: "'Fredoka', sans-serif",
      fontWeight: 600,
    }}>
      <span style={{ fontSize: 16 }}>{hasLiked ? '\u2764\uFE0F' : '\u{1F90D}'}</span>
      {likeCount > 0 && <span>{likeCount}</span>}
    </button>
  );
}

export default function BoardPage({ code }) {
  const [board, setBoard] = useState(null);
  const [posts, setPosts] = useState([]);
  const [author, setAuthor] = useState(() => localStorage.getItem('board-author') || '');
  const [nameSet, setNameSet] = useState(() => !!localStorage.getItem('board-author'));
  const [nameInput, setNameInput] = useState('');
  const [addingCol, setAddingCol] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [loading, setLoading] = useState(true);

  // Override global overflow:hidden on html/body/#root so the board page scrolls on mobile
  useEffect(() => {
    // Inject a <style> tag that overrides global.css with !important
    const style = document.createElement('style');
    style.id = 'board-scroll-fix';
    style.textContent = `
      html, body, #root {
        overflow: auto !important;
        height: auto !important;
        min-height: 100vh !important;
        position: static !important;
        -webkit-overflow-scrolling: touch !important;
        overscroll-behavior: auto !important;
      }
    `;
    document.head.appendChild(style);
    return () => { style.remove(); };
  }, []);

  useEffect(() => {
    const boardRef = ref(db, 'boards/' + code);
    const unsub = onValue(boardRef, (snap) => {
      const data = snap.val();
      if (data) {
        setBoard(data);
        const p = data.posts
          ? Object.entries(data.posts).map(([key, val]) => ({ ...val, _key: key }))
          : [];
        p.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        setPosts(p);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [code]);

  const handleSetName = (e) => {
    e.preventDefault();
    const name = nameInput.trim();
    if (!name) return;
    localStorage.setItem('board-author', name);
    setAuthor(name);
    setNameSet(true);
  };

  const handleSubmit = useCallback((colIndex) => {
    const text = noteText.trim();
    if (!text || !author) return;
    const postsRef = ref(db, 'boards/' + code + '/posts');
    push(postsRef, {
      author,
      column: colIndex,
      text,
      color: pickColor(),
      timestamp: Date.now(),
    });
    setNoteText('');
    setAddingCol(null);
  }, [code, noteText, author]);

  if (loading) {
    return (
      <div style={s.page}>
        <div style={s.loadingText}>Lade Board...</div>
      </div>
    );
  }

  if (!board) {
    return (
      <div style={s.page}>
        <div style={s.messageCard}>
          <div style={{ fontSize: 48 }}>🔍</div>
          <div style={s.loadingText}>Board nicht gefunden.</div>
          <p style={s.messageDesc}>Bitte prüfe den Code und versuche es erneut.</p>
        </div>
      </div>
    );
  }

  if (!board.active) {
    return (
      <div style={s.page}>
        <div style={s.messageCard}>
          <div style={{ fontSize: 48 }}>🔒</div>
          <div style={s.loadingText}>Dieses Board wurde geschlossen.</div>
          <p style={s.messageDesc}>Fragt eure Lehrkraft, ob ein neues Board geöffnet wird.</p>
        </div>
      </div>
    );
  }

  if (!nameSet) {
    return (
      <div style={s.page}>
        <div style={s.nameCard}>
          <h1 style={s.nameTitle}>📝 Willkommen!</h1>
          <p style={s.nameDesc}>Wie heißt du oder deine Gruppe?</p>
          <form onSubmit={handleSetName} style={{ display: 'flex', gap: 10, width: '100%' }}>
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Euer Name..."
              autoFocus
              style={s.nameInput}
            />
            <button type="submit" style={s.nameBtn}>Los!</button>
          </form>
        </div>
      </div>
    );
  }

  const columns = board.columns || [];

  return (
    <div style={s.page}>
      <h1 style={s.boardTitle}>{board.title}</h1>
      <p style={s.boardAuthor}>Du bist: <strong>{author}</strong></p>

      <div style={s.colContainer}>
        {columns.map((colName, ci) => {
          const colPosts = posts.filter(p => p.column === ci);
          return (
            <div key={ci} style={s.column}>
              <div style={s.colHeader}>{colName}</div>
              <div style={s.colPosts}>
                {colPosts.map((p) => (
                  <div key={p._key} style={{ ...s.stickyNote, background: p.color || '#FFE0B2' }}>
                    <div style={s.noteAuthor}>{p.author}</div>
                    <div style={s.noteText}>{p.text}</div>
                    <LikeButton
                      postKey={p._key}
                      likes={p.likes}
                      author={author}
                      code={code}
                    />
                  </div>
                ))}
              </div>
              {addingCol === ci ? (
                <div style={s.addForm}>
                  <textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Eure Frage oder Idee..."
                    autoFocus
                    rows={3}
                    style={s.addInput}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => handleSubmit(ci)} style={s.sendBtn}>Senden</button>
                    <button onClick={() => { setAddingCol(null); setNoteText(''); }} style={s.cancelBtn}>Abbrechen</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setAddingCol(ci)} style={s.addBtn}>+ Hinzufügen</button>
              )}
            </div>
          );
        })}
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
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch',
    overscrollBehavior: 'auto',
    touchAction: 'pan-y',
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
    padding: '40px 32px',
    maxWidth: 420,
    width: '100%',
    marginTop: 80,
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
  nameCard: {
    background: 'white',
    borderRadius: 20,
    padding: '32px 28px',
    maxWidth: 400,
    width: '100%',
    marginTop: 80,
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
    fontSize: 18,
    color: '#555',
    fontWeight: 600,
    margin: 0,
  },
  nameInput: {
    flex: 1,
    padding: '12px 16px',
    fontSize: 18,
    borderRadius: 14,
    border: '2px solid rgba(255,107,53,0.3)',
    fontFamily: "'Fredoka', sans-serif",
    fontWeight: 600,
    outline: 'none',
  },
  nameBtn: {
    padding: '12px 24px',
    fontSize: 18,
    fontFamily: "'Lilita One', cursive",
    background: '#FF6B35',
    color: 'white',
    border: 'none',
    borderRadius: 14,
    cursor: 'pointer',
  },
  boardTitle: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 26,
    color: '#8B5A2B',
    textAlign: 'center',
    margin: '8px 0 4px',
  },
  boardAuthor: {
    fontSize: 15,
    color: '#8B7B6B',
    fontWeight: 600,
    marginBottom: 16,
  },
  colContainer: {
    display: 'flex',
    gap: 16,
    width: '100%',
    maxWidth: 1100,
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingBottom: 40,
  },
  column: {
    flex: '1 1 300px',
    maxWidth: 360,
    minWidth: 280,
    background: 'rgba(255,255,255,0.7)',
    borderRadius: 16,
    padding: 14,
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
  },
  colHeader: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 18,
    color: '#FF6B35',
    textAlign: 'center',
    marginBottom: 10,
    paddingBottom: 8,
    borderBottom: '2px solid rgba(255,107,53,0.2)',
  },
  colPosts: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    marginBottom: 10,
  },
  stickyNote: {
    borderRadius: 12,
    padding: '10px 14px',
    boxShadow: '0 2px 6px rgba(0,0,0,0.07)',
  },
  noteAuthor: {
    fontSize: 12,
    fontWeight: 700,
    color: '#8B5A2B',
    marginBottom: 4,
    opacity: 0.7,
  },
  noteText: {
    fontSize: 16,
    color: '#333',
    fontWeight: 600,
    lineHeight: 1.4,
  },
  addForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  addInput: {
    width: '100%',
    padding: '10px 14px',
    fontSize: 16,
    borderRadius: 12,
    border: '2px solid rgba(255,107,53,0.3)',
    fontFamily: "'Fredoka', sans-serif",
    fontWeight: 600,
    resize: 'none',
    outline: 'none',
    boxSizing: 'border-box',
  },
  sendBtn: {
    flex: 1,
    padding: '10px 16px',
    fontSize: 16,
    fontFamily: "'Lilita One', cursive",
    background: '#FF6B35',
    color: 'white',
    border: 'none',
    borderRadius: 12,
    cursor: 'pointer',
  },
  cancelBtn: {
    padding: '10px 16px',
    fontSize: 14,
    fontFamily: "'Fredoka', sans-serif",
    fontWeight: 600,
    background: 'rgba(0,0,0,0.06)',
    color: '#666',
    border: 'none',
    borderRadius: 12,
    cursor: 'pointer',
  },
  addBtn: {
    width: '100%',
    padding: '10px',
    fontSize: 16,
    fontFamily: "'Fredoka', sans-serif",
    fontWeight: 700,
    background: 'rgba(255,107,53,0.1)',
    color: '#FF6B35',
    border: '2px dashed rgba(255,107,53,0.3)',
    borderRadius: 12,
    cursor: 'pointer',
  },
};

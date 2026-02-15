import React, { useState, useEffect } from 'react';
import { listClasses, sanitizeClassName } from '../utils/firebasePersistence';

export default function ClassSetupScreen({ onClassSelected }) {
  const [name, setName] = useState('');
  const [existingClasses, setExistingClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listClasses().then((classes) => {
      setExistingClasses(classes);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  }, []);

  const handleSubmit = () => {
    const sanitized = sanitizeClassName(name);
    if (!sanitized) return;
    onClassSelected(sanitized);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSubmit();
  };

  return (
    <div style={s.wrapper}>
      <div style={s.card}>
        <div style={s.emoji}>{'\u{1F3EB}'}</div>
        <h1 style={s.title}>Klasse ausw{'\u00e4'}hlen</h1>
        <p style={s.subtitle}>
          Gib den Klassennamen ein, um den Spielstand zu laden oder eine neue Klasse zu starten.
        </p>

        <div style={s.inputRow}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="z.B. 4b"
            style={s.input}
            autoFocus
          />
        </div>
        <button
          onClick={handleSubmit}
          disabled={!sanitizeClassName(name)}
          style={{
            ...s.submitBtn,
            opacity: sanitizeClassName(name) ? 1 : 0.5,
          }}
        >
          Klasse starten
        </button>

        {!loading && existingClasses.length > 0 && (
          <>
            <div style={s.divider}>
              <span style={s.dividerText}>oder vorhandene Klasse w{'\u00e4'}hlen</span>
            </div>
            <div style={s.classList}>
              {existingClasses.map((cls) => (
                <button
                  key={cls}
                  onClick={() => onClassSelected(cls)}
                  style={s.classBtn}
                >
                  {'\u{1F4DA}'} {cls}
                </button>
              ))}
            </div>
          </>
        )}

        {loading && (
          <div style={s.loadingText}>Klassen werden geladen...</div>
        )}
      </div>
    </div>
  );
}

const s = {
  wrapper: {
    width: '100%',
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(160deg, #FFE5D9 0%, #D4E4F7 100%)',
    padding: 20,
    boxSizing: 'border-box',
    overflowY: 'auto',
  },
  card: {
    background: 'white',
    borderRadius: 24,
    padding: '32px 28px',
    maxWidth: 420,
    width: '100%',
    boxShadow: '0 8px 40px rgba(0,0,0,0.1)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    boxSizing: 'border-box',
    maxHeight: '90vh',
    overflowY: 'auto',
  },
  emoji: {
    fontSize: 48,
  },
  title: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 26,
    color: '#FF6B35',
    margin: 0,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 15,
    color: '#666',
    fontWeight: 500,
    textAlign: 'center',
    margin: 0,
    lineHeight: 1.5,
  },
  inputRow: {
    width: '100%',
    marginTop: 4,
  },
  input: {
    width: '100%',
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 20,
    fontWeight: 600,
    padding: '12px 16px',
    border: '2px solid rgba(0,0,0,0.1)',
    borderRadius: 14,
    outline: 'none',
    background: '#FAFAFA',
    textAlign: 'center',
    boxSizing: 'border-box',
  },
  submitBtn: {
    width: '100%',
    fontFamily: "'Lilita One', cursive",
    fontSize: 18,
    padding: '14px 24px',
    background: '#FF6B35',
    color: 'white',
    border: 'none',
    borderRadius: 14,
    cursor: 'pointer',
  },
  divider: {
    width: '100%',
    textAlign: 'center',
    marginTop: 8,
    position: 'relative',
  },
  dividerText: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 14,
    fontWeight: 600,
    color: '#aaa',
    background: 'white',
    padding: '0 12px',
    position: 'relative',
    zIndex: 1,
  },
  classList: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
    justifyContent: 'center',
    width: '100%',
  },
  classBtn: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 16,
    fontWeight: 600,
    padding: '10px 20px',
    background: '#F0F7FF',
    color: '#1976D2',
    border: '2px solid #BBDEFB',
    borderRadius: 14,
    cursor: 'pointer',
  },
  loadingText: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 14,
    color: '#aaa',
    fontWeight: 600,
    marginTop: 8,
  },
};

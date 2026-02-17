import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const ERROR_MAP = {
  'auth/invalid-credential': 'E-Mail oder Passwort ist falsch.',
  'auth/user-not-found': 'Kein Konto mit dieser E-Mail gefunden.',
  'auth/wrong-password': 'Falsches Passwort.',
  'auth/too-many-requests': 'Zu viele Versuche. Bitte warte einen Moment.',
  'auth/network-request-failed': 'Keine Internetverbindung.',
  'auth/invalid-email': 'Ungueltige E-Mail-Adresse.',
};

function getErrorMessage(error) {
  const code = error?.code || '';
  return ERROR_MAP[code] || 'Anmeldung fehlgeschlagen. Bitte versuche es erneut.';
}

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setError('');
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.logoArea}>
          <span style={styles.emoji}>{'\u{1F30D}'}</span>
          <h1 style={styles.title}>Weltverbinder</h1>
          <p style={styles.subtitle}>Projektwoche: Kinderrechte</p>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>E-Mail</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="lehrer@schule.de"
            style={styles.input}
            autoComplete="email"
            disabled={loading}
          />

          <label style={styles.label}>Passwort</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Passwort eingeben"
            style={styles.input}
            autoComplete="current-password"
            disabled={loading}
          />

          {error && <div style={styles.error}>{error}</div>}

          <button
            type="submit"
            style={{
              ...styles.button,
              opacity: loading ? 0.7 : 1,
              cursor: loading ? 'wait' : 'pointer',
            }}
            disabled={loading}
          >
            {loading ? 'Wird angemeldet...' : 'Anmelden'}
          </button>
        </form>

        <button
          style={styles.forgotLink}
          onClick={() => setShowForgot(true)}
        >
          Passwort vergessen?
        </button>

        {showForgot && (
          <div style={styles.forgotMsg}>
            Bitte wende dich an den Administrator.
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    width: '100%',
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(160deg, #FFE5D9 0%, #D4E4F7 100%)',
    padding: 20,
    boxSizing: 'border-box',
  },
  card: {
    background: '#fff',
    borderRadius: 24,
    padding: '40px 36px',
    maxWidth: 420,
    width: '100%',
    boxShadow: '0 12px 40px rgba(139, 90, 43, 0.12)',
    border: '1px solid rgba(255, 166, 107, 0.15)',
  },
  logoArea: {
    textAlign: 'center',
    marginBottom: 28,
  },
  emoji: {
    fontSize: 48,
    display: 'block',
    marginBottom: 8,
  },
  title: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 32,
    color: '#8B5A2B',
    margin: '0 0 4px 0',
  },
  subtitle: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 16,
    color: '#999',
    margin: 0,
    fontWeight: 500,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  label: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 14,
    fontWeight: 600,
    color: '#666',
    marginTop: 8,
  },
  input: {
    width: '100%',
    padding: '12px 16px',
    border: '2px solid #E0D6CC',
    borderRadius: 14,
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 16,
    color: '#333',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
  },
  error: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 14,
    color: '#D32F2F',
    background: '#FFEBEE',
    borderRadius: 10,
    padding: '10px 14px',
    marginTop: 8,
  },
  button: {
    width: '100%',
    padding: '14px 20px',
    border: 'none',
    borderRadius: 14,
    background: 'linear-gradient(135deg, #FF6B35 0%, #FF8F5E 100%)',
    color: '#fff',
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 18,
    fontWeight: 700,
    marginTop: 16,
    boxShadow: '0 4px 14px rgba(255, 107, 53, 0.3)',
    transition: 'opacity 0.2s, transform 0.1s',
  },
  forgotLink: {
    display: 'block',
    width: '100%',
    textAlign: 'center',
    marginTop: 16,
    background: 'none',
    border: 'none',
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 14,
    color: '#999',
    cursor: 'pointer',
    textDecoration: 'underline',
  },
  forgotMsg: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 13,
    color: '#8B5A2B',
    background: '#FFF8F0',
    borderRadius: 10,
    padding: '10px 14px',
    marginTop: 8,
    textAlign: 'center',
  },
};

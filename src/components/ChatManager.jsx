import React, { useState, useEffect, useCallback } from 'react';
import { ref, set, get, onValue } from 'firebase/database';
import { db } from '../firebase';
import { QRCodeSVG } from 'qrcode.react';
import { playClickSound } from '../utils/audio';
import VideoRoomManager from './VideoRoomManager';
import Flag from './Flag';

const LANG_OPTIONS = [
  { code: 'de', countryCode: 'de', label: 'Deutsch' },
  { code: 'en', countryCode: 'gb', label: 'English' },
  { code: 'sw', countryCode: 'tz', label: 'Kiswahili' },
  { code: 'fr', countryCode: 'fr', label: 'Français' },
  { code: 'tr', countryCode: 'tr', label: 'Türkçe' },
];

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export default function ChatManager({ onClose, dayColor }) {
  const color = dayColor || '#FF6B35';
  const [view, setView] = useState('list'); // 'list' | 'qr' | 'video'
  const [rooms, setRooms] = useState([]);
  const [roomName, setRoomName] = useState('');
  const [selectedLangs, setSelectedLangs] = useState(['de', 'en']);
  const [activeRoom, setActiveRoom] = useState(null); // room being viewed in QR mode
  const [participantCounts, setParticipantCounts] = useState({});
  const [creating, setCreating] = useState(false);

  // Load all chat rooms
  useEffect(() => {
    const roomsRef = ref(db, 'chatRooms');
    const unsub = onValue(roomsRef, (snap) => {
      const data = snap.val();
      if (data) {
        const list = Object.entries(data).map(([code, val]) => ({
          code,
          name: val.name,
          status: val.status,
          languages: val.languages || [],
          createdAt: val.createdAt,
          participantCount: val.participants ? Object.keys(val.participants).length : 0,
        }));
        list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setRooms(list);
        const counts = {};
        list.forEach(r => { counts[r.code] = r.participantCount; });
        setParticipantCounts(counts);
      } else {
        setRooms([]);
      }
    });
    return () => unsub();
  }, []);

  const toggleLang = (code) => {
    setSelectedLangs(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  const handleCreate = useCallback(async () => {
    if (!roomName.trim() || selectedLangs.length < 2) return;
    setCreating(true);
    playClickSound();

    // Generate unique code
    let code = generateCode();
    let attempts = 0;
    while (attempts < 10) {
      const snap = await get(ref(db, 'chatRooms/' + code));
      if (!snap.exists()) break;
      code = generateCode();
      attempts++;
    }

    const roomData = {
      name: roomName.trim(),
      status: 'active',
      languages: selectedLangs,
      createdAt: Date.now(),
    };

    try {
      await set(ref(db, 'chatRooms/' + code), roomData);
      setActiveRoom({ code, ...roomData, participantCount: 0 });
      setView('qr');
      setRoomName('');
    } catch (err) {
      console.error('[ChatManager] Error creating room:', err);
    }
    setCreating(false);
  }, [roomName, selectedLangs]);

  const handleCloseRoom = async (code) => {
    playClickSound();
    try {
      await set(ref(db, 'chatRooms/' + code + '/status'), 'closed');
    } catch (err) {
      console.error('[ChatManager] Error closing room:', err);
    }
  };

  const handleReopenRoom = (room) => {
    playClickSound();
    setActiveRoom(room);
    setView('qr');
  };

  const chatUrl = activeRoom ? `${window.location.origin}/chat/${activeRoom.code}` : '';

  return (
    <div style={s.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ ...s.card, ...(view === 'video' ? { maxWidth: 900, height: '85vh' } : {}) }}>
        {/* Header */}
        <div style={s.header}>
          {(view === 'qr' || view === 'video') && (
            <button onClick={() => setView(view === 'video' ? 'qr' : 'list')} style={s.backBtn}>{'\u2190'}</button>
          )}
          <h2 style={{ ...s.title, color }}>
            {view === 'video' ? '\u{1F3A5} Video-Räume' : '\u{1F4AC} Chat-Räume'}
          </h2>
          <button onClick={onClose} style={s.closeBtn}>{'\u2715'}</button>
        </div>

        {view === 'list' && (
          <div style={s.content}>
            {/* Create new room */}
            <div style={s.createSection}>
              <h3 style={s.sectionTitle}>Neuer Chat-Raum</h3>
              <input
                type="text"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="z.B. Austausch Berlin-Tansania"
                style={s.input}
                maxLength={60}
              />
              <div style={s.langRow}>
                {LANG_OPTIONS.map(lang => {
                  const checked = selectedLangs.includes(lang.code);
                  return (
                    <button
                      key={lang.code}
                      onClick={() => toggleLang(lang.code)}
                      style={{
                        ...s.langBtn,
                        background: checked ? `${color}20` : 'rgba(0,0,0,0.03)',
                        border: checked ? `2px solid ${color}` : '2px solid transparent',
                      }}
                    >
                      <Flag code={lang.countryCode} size={20} />
                      <span style={s.langLabel}>{lang.label}</span>
                    </button>
                  );
                })}
              </div>
              {selectedLangs.length < 2 && (
                <p style={s.langHint}>Mindestens 2 Sprachen auswählen</p>
              )}
              <button
                onClick={handleCreate}
                disabled={!roomName.trim() || selectedLangs.length < 2 || creating}
                style={{
                  ...s.createBtn,
                  background: color,
                  opacity: (!roomName.trim() || selectedLangs.length < 2 || creating) ? 0.4 : 1,
                }}
              >
                {creating ? 'Wird erstellt...' : 'Chat-Raum erstellen'}
              </button>
            </div>

            {/* Saved rooms */}
            {rooms.length > 0 && (
              <div style={s.savedSection}>
                <h3 style={s.sectionTitle}>Gespeicherte Chat-Räume</h3>
                <div style={s.roomList}>
                  {rooms.map(room => (
                    <div key={room.code} style={s.roomItem}>
                      <div style={s.roomInfo}>
                        <div style={s.roomName}>{room.name}</div>
                        <div style={s.roomMeta}>
                          {new Date(room.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          {' · '}{room.participantCount} Teilnehmer
                          {' · '}
                          <span style={{ color: room.status === 'active' ? '#27AE60' : '#999' }}>
                            {room.status === 'active' ? '\u{1F7E2} aktiv' : '\u{1F534} geschlossen'}
                          </span>
                        </div>
                      </div>
                      <div style={s.roomActions}>
                        <button onClick={() => handleReopenRoom(room)} style={s.roomBtn}>
                          QR
                        </button>
                        {room.status === 'active' && (
                          <button onClick={() => handleCloseRoom(room.code)} style={s.roomBtnRed}>
                            Schließen
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {view === 'qr' && activeRoom && (
          <div style={s.qrView}>
            <h3 style={{ ...s.qrTitle, color }}>{activeRoom.name}</h3>
            <div style={s.qrBox}>
              <QRCodeSVG value={chatUrl} size={200} level="M" />
            </div>
            <div style={s.codeDisplay}>
              Code: <strong>{activeRoom.code}</strong>
            </div>
            <a href={chatUrl} target="_blank" rel="noopener noreferrer" style={{ ...s.urlLink, color }}>
              {chatUrl}
            </a>
            <div style={s.participantBadge}>
              {'\u{1F465}'} {participantCounts[activeRoom.code] || 0} Teilnehmer
            </div>
            <div style={s.langTags}>
              {(activeRoom.languages || []).map(code => {
                const lang = LANG_OPTIONS.find(l => l.code === code);
                return lang ? (
                  <span key={code} style={s.langTag}><Flag code={lang.countryCode} size={16} /> {lang.label}</span>
                ) : null;
              })}
            </div>
            <button
              onClick={() => setView('video')}
              style={{
                fontFamily: "'Lilita One', cursive", fontSize: 16, padding: '10px 20px',
                background: 'white', color, border: `2px solid ${color}`,
                borderRadius: 12, cursor: 'pointer', marginTop: 4,
              }}
            >
              {'\u{1F3A5}'} Video-Räume verwalten
            </button>
          </div>
        )}

        {view === 'video' && activeRoom && (
          <VideoRoomManager roomCode={activeRoom.code} color={color} />
        )}
      </div>
    </div>
  );
}

const s = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 2000,
    background: 'rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    background: 'white',
    borderRadius: 20,
    width: '100%',
    maxWidth: 520,
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 8px 40px rgba(0,0,0,0.15)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '16px 20px',
    borderBottom: '1px solid rgba(0,0,0,0.06)',
    flexShrink: 0,
  },
  title: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 22,
    margin: 0,
    flex: 1,
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
  closeBtn: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 18,
    padding: '4px 10px',
    background: 'rgba(0,0,0,0.06)',
    border: 'none',
    borderRadius: 10,
    cursor: 'pointer',
    color: '#555',
    lineHeight: 1,
  },
  content: {
    overflowY: 'auto',
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  createSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  sectionTitle: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 18,
    color: '#333',
    margin: 0,
  },
  input: {
    width: '100%',
    padding: '12px 16px',
    fontSize: 16,
    fontFamily: "'Fredoka', sans-serif",
    fontWeight: 600,
    borderRadius: 12,
    border: '2px solid rgba(0,0,0,0.1)',
    outline: 'none',
    boxSizing: 'border-box',
  },
  langRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  langBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 12px',
    borderRadius: 10,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  langLabel: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 14,
    fontWeight: 600,
    color: '#333',
  },
  langHint: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 13,
    fontWeight: 600,
    color: '#E67E22',
    margin: 0,
  },
  createBtn: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 18,
    padding: '12px 24px',
    color: 'white',
    border: 'none',
    borderRadius: 14,
    cursor: 'pointer',
  },
  savedSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  roomList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  roomItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 12px',
    background: '#F8F8F8',
    borderRadius: 12,
    gap: 8,
  },
  roomInfo: {
    flex: 1,
    minWidth: 0,
  },
  roomName: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 15,
    fontWeight: 700,
    color: '#333',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  roomMeta: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 12,
    fontWeight: 500,
    color: '#999',
  },
  roomActions: {
    display: 'flex',
    gap: 6,
    flexShrink: 0,
  },
  roomBtn: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 13,
    fontWeight: 600,
    padding: '6px 12px',
    background: '#E3F2FD',
    color: '#1976D2',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
  },
  roomBtnRed: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 13,
    fontWeight: 600,
    padding: '6px 12px',
    background: '#FFEBEE',
    color: '#C62828',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
  },
  // QR view
  qrView: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 14,
    padding: '20px 20px 24px',
  },
  qrTitle: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 22,
    margin: 0,
    textAlign: 'center',
  },
  qrBox: {
    background: 'white',
    padding: 16,
    borderRadius: 16,
    boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
  },
  codeDisplay: {
    fontFamily: "'Baloo 2', cursive",
    fontSize: 28,
    color: '#333',
    letterSpacing: 4,
  },
  urlLink: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 14,
    fontWeight: 600,
    wordBreak: 'break-all',
    textAlign: 'center',
  },
  participantBadge: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 16,
    fontWeight: 700,
    color: '#555',
    background: '#F0F0F0',
    padding: '6px 16px',
    borderRadius: 20,
  },
  langTags: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  langTag: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 14,
    fontWeight: 600,
    color: '#555',
    background: '#F8F8F8',
    padding: '4px 10px',
    borderRadius: 8,
  },
};

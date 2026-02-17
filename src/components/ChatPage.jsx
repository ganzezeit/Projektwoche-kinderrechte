import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ref, onValue, push, get, set } from 'firebase/database';
import { db } from '../firebase';
import Flag from './Flag';

const LANG_MAP = {
  de: { countryCode: 'de', label: 'Deutsch' },
  en: { countryCode: 'gb', label: 'English' },
  sw: { countryCode: 'tz', label: 'Kiswahili' },
  fr: { countryCode: 'fr', label: 'Français' },
  tr: { countryCode: 'tr', label: 'Türkçe' },
};

const LANG_COLORS = {
  de: '#E3F2FD', en: '#E8F5E9', sw: '#FFF3E0', fr: '#F3E5F5', tr: '#FFEBEE',
};

const TRANSLATE_URL = 'https://harmonious-taffy-89ea6b.netlify.app/.netlify/functions/translate';
const STORAGE_PREFIX = 'chat-user-';

const JITSI_SERVERS = [
  'jitsi.modular.im',
  'meet.element.io',
  'jitsi.member.fsf.org',
  'meet.jit.si',
];

// Detect device language for UI labels
const DEVICE_LANG = (() => {
  const raw = (navigator.language || navigator.languages?.[0] || 'en').slice(0, 2).toLowerCase();
  return ['de', 'en', 'sw', 'fr', 'tr'].includes(raw) ? raw : 'en';
})();

const UI = {
  de: {
    namePlaceholder: 'Dein Name...',
    joinBtn: 'Beitreten',
    joinDesc: 'Wähle deinen Namen und deine Sprache',
    waitMsg: 'Bitte warte, bis du einer Gruppe zugewiesen wirst...',
    waitCount: 'Teilnehmer warten',
    msgPlaceholder: 'Nachricht eingeben...',
    errorMsg: 'Dieser Chat-Raum existiert nicht oder ist geschlossen.',
    loading: 'Lade Chat-Raum...',
    emptyChat: 'Noch keine Nachrichten. Schreibe die erste!',
    participants: 'Teilnehmer',
  },
  en: {
    namePlaceholder: 'Your Name...',
    joinBtn: 'Join',
    joinDesc: 'Choose your name and language',
    waitMsg: 'Please wait until you are assigned to a group...',
    waitCount: 'participants waiting',
    msgPlaceholder: 'Type a message...',
    errorMsg: 'This chat room does not exist or is closed.',
    loading: 'Loading chat room...',
    emptyChat: 'No messages yet. Write the first one!',
    participants: 'participants',
  },
  sw: {
    namePlaceholder: 'Jina lako...',
    joinBtn: 'Jiunge',
    joinDesc: 'Chagua jina lako na lugha yako',
    waitMsg: 'Tafadhali subiri hadi upangiwe kwenye kundi...',
    waitCount: 'washiriki wanasubiri',
    msgPlaceholder: 'Andika ujumbe...',
    errorMsg: 'Chumba hiki cha mazungumzo hakipo au kimefungwa.',
    loading: 'Inapakia chumba cha mazungumzo...',
    emptyChat: 'Hakuna ujumbe bado. Andika wa kwanza!',
    participants: 'washiriki',
  },
  fr: {
    namePlaceholder: 'Ton nom...',
    joinBtn: 'Rejoindre',
    joinDesc: 'Choisis ton nom et ta langue',
    waitMsg: 'Patiente, tu seras bientôt assigné à un groupe...',
    waitCount: 'participants en attente',
    msgPlaceholder: 'Écris un message...',
    errorMsg: "Ce salon n'existe pas ou est fermé.",
    loading: 'Chargement du salon...',
    emptyChat: 'Pas encore de messages. Écris le premier !',
    participants: 'participants',
  },
  tr: {
    namePlaceholder: 'Adın...',
    joinBtn: 'Katıl',
    joinDesc: 'Adını ve dilini seç',
    waitMsg: 'Lütfen bir gruba atanana kadar bekle...',
    waitCount: 'katılımcı bekliyor',
    msgPlaceholder: 'Mesaj yaz...',
    errorMsg: 'Bu sohbet odası mevcut değil veya kapatılmış.',
    loading: 'Sohbet odası yükleniyor...',
    emptyChat: 'Henüz mesaj yok. İlk mesajı sen yaz!',
    participants: 'katılımcı',
  },
};

export default function ChatPage({ roomCode }) {
  const t = UI[DEVICE_LANG];

  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Join state
  const [joined, setJoined] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [selectedLang, setSelectedLang] = useState(null);
  const [userName, setUserName] = useState('');
  const [userLang, setUserLang] = useState('');

  // Chat state
  const [messages, setMessages] = useState([]);
  const [msgText, setMsgText] = useState('');
  const [participantCount, setParticipantCount] = useState(0);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Translation state
  const [translations, setTranslations] = useState({});
  const [translating, setTranslating] = useState({});
  const [showOriginal, setShowOriginal] = useState({});
  const translatingRef = useRef({});

  // Video room / waiting room state
  const [videoRoom, setVideoRoom] = useState(null);
  const [assignedCount, setAssignedCount] = useState(0);

  // Jitsi video state
  const [jitsiServerIdx, setJitsiServerIdx] = useState(0);
  const [videoFailed, setVideoFailed] = useState(false);
  const iframeLoadedRef = useRef(false);

  // Override global overflow + inject animations
  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'chat-scroll-fix';
    style.textContent = `
      html, body, #root {
        overflow: auto !important;
        height: auto !important;
        min-height: 100vh !important;
        position: static !important;
        -webkit-overflow-scrolling: touch !important;
      }
      @keyframes chatPulse {
        0%, 100% { transform: scale(1); opacity: 0.7; }
        50% { transform: scale(1.2); opacity: 1; }
      }
      @keyframes chatFadeIn {
        from { opacity: 0; transform: translateY(12px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `;
    document.head.appendChild(style);
    return () => { style.remove(); };
  }, []);

  // Load room data
  useEffect(() => {
    const roomRef = ref(db, 'chatRooms/' + roomCode);
    const unsub = onValue(roomRef, (snap) => {
      const data = snap.val();
      if (!data) {
        setError(t.errorMsg);
        setLoading(false);
        return;
      }
      if (data.status === 'closed') {
        setError(t.errorMsg);
        setLoading(false);
        return;
      }
      setRoom(data);
      setLoading(false);
      const pCount = data.participants ? Object.keys(data.participants).length : 0;
      setParticipantCount(pCount);
    });
    return () => unsub();
  }, [roomCode, t.errorMsg]);

  // Check localStorage for existing session
  useEffect(() => {
    if (!room) return;
    try {
      const saved = localStorage.getItem(STORAGE_PREFIX + roomCode);
      if (saved) {
        const { name, lang } = JSON.parse(saved);
        if (name && lang) {
          setUserName(name);
          setUserLang(lang);
          setJoined(true);
        }
      }
    } catch { /* ignore */ }
  }, [room, roomCode]);

  // Listen to messages
  useEffect(() => {
    if (!joined) return;
    const msgsRef = ref(db, 'chatRooms/' + roomCode + '/messages');
    const unsub = onValue(msgsRef, (snap) => {
      const data = snap.val();
      if (data) {
        const list = Object.entries(data).map(([id, val]) => ({ id, ...val }));
        list.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        setMessages(list);
      } else {
        setMessages([]);
      }
    });
    return () => unsub();
  }, [joined, roomCode]);

  // Listen to videoRooms — detect assignment
  useEffect(() => {
    if (!joined || !userName) return;
    const vrRef = ref(db, `chatRooms/${roomCode}/videoRooms`);
    const unsub = onValue(vrRef, (snap) => {
      const data = snap.val();
      if (!data) {
        setVideoRoom(null);
        setAssignedCount(0);
        return;
      }
      let found = null;
      let totalAssigned = 0;
      for (const [id, rm] of Object.entries(data)) {
        const pList = rm.participants
          ? (Array.isArray(rm.participants) ? rm.participants : Object.values(rm.participants))
          : [];
        totalAssigned += pList.length;
        if (!found && pList.some(p => p.name === userName && p.lang === userLang)) {
          found = { id, name: rm.name, status: rm.status, participants: pList };
        }
      }
      setVideoRoom(found);
      setAssignedCount(totalAssigned);
    });
    return () => unsub();
  }, [joined, userName, userLang, roomCode]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Translate a single message
  const translateMsg = useCallback(async (msg) => {
    if (!userLang || msg.authorLang === userLang) return;
    if (translatingRef.current[msg.id]) return;

    translatingRef.current[msg.id] = true;
    setTranslating(prev => ({ ...prev, [msg.id]: true }));

    try {
      const cacheRef = ref(db, `chatRooms/${roomCode}/messages/${msg.id}/translations/${userLang}`);
      const snap = await get(cacheRef);
      if (snap.exists()) {
        setTranslations(prev => ({ ...prev, [msg.id]: { text: snap.val() } }));
        setTranslating(prev => ({ ...prev, [msg.id]: false }));
        translatingRef.current[msg.id] = false;
        return;
      }

      const res = await fetch(TRANSLATE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: msg.text, fromLang: msg.authorLang, toLang: userLang }),
      });
      if (!res.ok) throw new Error('Translation failed');
      const data = await res.json();
      await set(cacheRef, data.translated);
      setTranslations(prev => ({ ...prev, [msg.id]: { text: data.translated } }));
    } catch (err) {
      console.error('[ChatPage] Translation error:', err);
      setTranslations(prev => ({ ...prev, [msg.id]: { error: true } }));
    }

    setTranslating(prev => ({ ...prev, [msg.id]: false }));
    translatingRef.current[msg.id] = false;
  }, [userLang, roomCode]);

  // Filter messages to only show participants in the same video room
  const filteredMessages = useMemo(() => {
    if (!videoRoom) return messages;
    const keys = new Set(videoRoom.participants.map(p => p.name + '|' + p.lang));
    return messages.filter(m => keys.has(m.author + '|' + m.authorLang));
  }, [messages, videoRoom]);

  // Jitsi video URL — simple iframe, no external API
  const jitsiUrl = useMemo(() => {
    if (!videoRoom || videoRoom.status !== 'active') return null;
    if (videoFailed || jitsiServerIdx >= JITSI_SERVERS.length) return null;
    const server = JITSI_SERVERS[jitsiServerIdx];
    const roomName = `projektwoche-${roomCode}-${videoRoom.id}`;
    const hash = [
      'config.startWithAudioMuted=true',
      'config.startWithVideoMuted=false',
      'config.prejoinPageEnabled=false',
      'config.disableDeepLinking=true',
      'interfaceConfig.TOOLBAR_BUTTONS=["camera","microphone","hangup","tileview"]',
      'interfaceConfig.MOBILE_APP_PROMO=false',
      'interfaceConfig.DISABLE_JOIN_LEAVE_NOTIFICATIONS=true',
      'interfaceConfig.SHOW_JITSI_WATERMARK=false',
      'interfaceConfig.SHOW_BRAND_WATERMARK=false',
      `userInfo.displayName=${encodeURIComponent(userName)}`,
    ].join('&');
    return `https://${server}/${roomName}#${hash}`;
  }, [videoRoom, roomCode, userName, jitsiServerIdx, videoFailed]);

  // Fallback: try next server if iframe doesn't load within 10s
  useEffect(() => {
    if (!jitsiUrl) return;
    iframeLoadedRef.current = false;
    const timer = setTimeout(() => {
      if (!iframeLoadedRef.current) {
        setJitsiServerIdx(prev => {
          const next = prev + 1;
          if (next >= JITSI_SERVERS.length) { setVideoFailed(true); return prev; }
          return next;
        });
      }
    }, 10000);
    return () => clearTimeout(timer);
  }, [jitsiUrl]);

  // Reset when video room changes or stops
  useEffect(() => {
    setJitsiServerIdx(0);
    setVideoFailed(false);
    iframeLoadedRef.current = false;
  }, [videoRoom?.id, videoRoom?.status]);

  const handleIframeLoad = useCallback(() => { iframeLoadedRef.current = true; }, []);

  // Trigger translations for visible messages only
  useEffect(() => {
    if (!joined || !userLang || !videoRoom) return;
    filteredMessages.forEach(msg => {
      if (msg.authorLang !== userLang && !translations[msg.id] && !translatingRef.current[msg.id]) {
        translateMsg(msg);
      }
    });
  }, [filteredMessages, joined, userLang, translations, translateMsg, videoRoom]);

  // Handle join
  const handleJoin = useCallback(async () => {
    const name = nameInput.trim();
    if (!name || !selectedLang) return;

    const participantRef = ref(db, 'chatRooms/' + roomCode + '/participants');
    try {
      await push(participantRef, {
        name,
        lang: selectedLang,
        joinedAt: Date.now(),
      });
      localStorage.setItem(STORAGE_PREFIX + roomCode, JSON.stringify({ name, lang: selectedLang }));
      setUserName(name);
      setUserLang(selectedLang);
      setJoined(true);
    } catch (err) {
      console.error('[ChatPage] Join error:', err);
    }
  }, [nameInput, selectedLang, roomCode]);

  // Handle send message
  const handleSend = useCallback(async () => {
    const text = msgText.trim();
    if (!text || sending) return;
    setSending(true);

    const msgsRef = ref(db, 'chatRooms/' + roomCode + '/messages');
    try {
      await push(msgsRef, {
        text,
        author: userName,
        authorLang: userLang,
        timestamp: Date.now(),
      });
      setMsgText('');
      if (inputRef.current) inputRef.current.focus();
    } catch (err) {
      console.error('[ChatPage] Send error:', err);
    }
    setSending(false);
  }, [msgText, userName, userLang, roomCode, sending]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ===== RENDER =====

  if (loading) {
    return (
      <div style={s.page}>
        <div style={s.centerCard}>
          <div style={s.loadingText}>{t.loading}</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={s.page}>
        <div style={s.centerCard}>
          <div style={{ fontSize: 48 }}>{'\u{1F50D}'}</div>
          <div style={s.loadingText}>{error}</div>
        </div>
      </div>
    );
  }

  // Join screen
  if (!joined) {
    const langs = (room?.languages || []).filter(c => LANG_MAP[c]);
    return (
      <div style={s.page}>
        <div style={s.joinCard}>
          <h1 style={s.joinTitle}>{'\u{1F4AC}'} {room?.name}</h1>
          <p style={s.joinDesc}>{t.joinDesc}</p>

          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder={t.namePlaceholder}
            autoFocus
            maxLength={30}
            style={s.joinInput}
          />

          <div style={s.joinLangRow}>
            {langs.map(code => {
              const lang = LANG_MAP[code];
              const active = selectedLang === code;
              return (
                <button
                  key={code}
                  onClick={() => setSelectedLang(code)}
                  style={{
                    ...s.joinLangBtn,
                    background: active ? '#FF6B3520' : 'rgba(0,0,0,0.03)',
                    border: active ? '2px solid #FF6B35' : '2px solid transparent',
                  }}
                >
                  <Flag code={lang.countryCode} size={24} />
                  <span style={s.joinLangLabel}>{lang.label}</span>
                </button>
              );
            })}
          </div>

          <button
            onClick={handleJoin}
            disabled={!nameInput.trim() || !selectedLang}
            style={{
              ...s.joinBtn,
              opacity: (!nameInput.trim() || !selectedLang) ? 0.4 : 1,
            }}
          >
            {t.joinBtn} {'\u{1F4AC}'}
          </button>
        </div>
      </div>
    );
  }

  // Waiting room — shown after join until assigned to a video room
  if (!videoRoom) {
    const waitingOthers = Math.max(0, participantCount - assignedCount - 1);
    const flagCode = LANG_MAP[userLang]?.countryCode || 'de';
    return (
      <div style={s.page}>
        <div style={s.waitCard}>
          <h1 style={s.waitRoomName}>{room?.name}</h1>
          <div style={s.waitUserInfo}>
            <Flag code={flagCode} size={28} />
            <span style={s.waitUserName}>{userName}</span>
          </div>
          <div style={s.waitIcon}>{'\u{1F4AC}'}</div>
          <p style={s.waitMsg}>{t.waitMsg}</p>
          {waitingOthers > 0 && (
            <div style={s.waitBadge}>
              {waitingOthers} {t.waitCount}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Chat view — assigned to a video room, filtered messages
  return (
    <div style={{ ...s.chatContainer, animation: 'chatFadeIn 0.4s ease' }} key={videoRoom.id}>
      {/* Header — shows video room name */}
      <div style={s.chatHeader}>
        <div style={s.chatHeaderLeft}>
          <h1 style={s.chatTitle}>{videoRoom.name}</h1>
        </div>
        <div style={s.chatBadge}>
          {'\u{1F7E2}'} {videoRoom.participants.length} {t.participants}
        </div>
      </div>

      {/* Jitsi video — shown when room is active */}
      {videoRoom.status === 'active' && (
        <div style={s.videoSection}>
          {jitsiUrl ? (
            <iframe
              key={jitsiUrl}
              src={jitsiUrl}
              onLoad={handleIframeLoad}
              allow="camera;microphone;display-capture"
              allowFullScreen
              style={s.videoIframe}
            />
          ) : videoFailed ? (
            <div style={s.videoOverlay}>
              <div style={{ fontSize: 32 }}>{'\u26A0\uFE0F'}</div>
              <div style={s.videoLoadText}>Video nicht verf\u00FCgbar. Bitte nutze den Chat.</div>
            </div>
          ) : null}
        </div>
      )}

      {/* Messages */}
      <div style={s.messagesArea}>
        {filteredMessages.length === 0 && (
          <div style={s.emptyChat}>
            <div style={{ fontSize: 40 }}>{'\u{1F4AD}'}</div>
            <p style={s.emptyChatText}>{t.emptyChat}</p>
          </div>
        )}
        {filteredMessages.map((msg) => {
          const isMe = msg.author === userName;
          const lang = LANG_MAP[msg.authorLang];
          const time = msg.timestamp
            ? new Date(msg.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
            : '';
          const needsTranslation = !isMe && msg.authorLang !== userLang;
          const tr = translations[msg.id];
          const isTranslating = translating[msg.id];
          const showOrig = showOriginal[msg.id];
          const bubbleBg = isMe ? '#E0F7FA' : (LANG_COLORS[msg.authorLang] || '#F5F5F5');

          let displayText = msg.text;
          let translationNote = null;

          if (needsTranslation) {
            if (isTranslating && !tr) {
              translationNote = <div style={s.translatingNote}>{'Wird übersetzt...'}</div>;
            } else if (tr?.error) {
              translationNote = <div style={s.translationError}>{'\u26A0\uFE0F'} Übersetzung fehlgeschlagen</div>;
            } else if (tr?.text) {
              displayText = showOrig ? msg.text : tr.text;
              translationNote = (
                <button
                  onClick={() => setShowOriginal(prev => ({ ...prev, [msg.id]: !showOrig }))}
                  style={s.toggleBtn}
                >
                  {showOrig ? '\u{1F310} Übersetzung' : '\u{1F504} Original'}
                </button>
              );
            }
          }

          return (
            <div key={msg.id} style={{ ...s.msgRow, justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
              <div style={{
                ...s.msgBubble,
                background: bubbleBg,
                borderBottomRightRadius: isMe ? 4 : 16,
                borderBottomLeftRadius: isMe ? 16 : 4,
              }}>
                <div style={s.msgMeta}>
                  <span style={s.msgAuthor}>{msg.author}</span>
                  <span style={s.msgFlag}>{lang?.countryCode ? <Flag code={lang.countryCode} size={14} /> : ''}</span>
                  <span style={s.msgTime}>{time}</span>
                </div>
                <div style={s.msgText}>{displayText}</div>
                {translationNote}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div style={s.inputBar}>
        <input
          ref={inputRef}
          type="text"
          value={msgText}
          onChange={(e) => setMsgText(e.target.value.slice(0, 500))}
          onKeyDown={handleKeyDown}
          placeholder={t.msgPlaceholder}
          style={s.msgInput}
          maxLength={500}
        />
        <button
          onClick={handleSend}
          disabled={!msgText.trim() || sending}
          style={{
            ...s.sendBtn,
            opacity: (!msgText.trim() || sending) ? 0.4 : 1,
          }}
        >
          {'\u{1F4E4}'}
        </button>
      </div>
    </div>
  );
}

const s = {
  page: {
    minHeight: '100vh',
    background: '#FFF8F0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    fontFamily: "'Fredoka', sans-serif",
  },
  centerCard: {
    background: 'white',
    borderRadius: 20,
    padding: '40px 32px',
    maxWidth: 420,
    width: '100%',
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    textAlign: 'center',
  },
  loadingText: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 22,
    color: '#8B5A2B',
  },
  // Join screen
  joinCard: {
    background: 'white',
    borderRadius: 20,
    padding: '32px 28px',
    maxWidth: 420,
    width: '100%',
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
  },
  joinTitle: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 26,
    color: '#FF6B35',
    margin: 0,
    textAlign: 'center',
  },
  joinDesc: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 16,
    color: '#777',
    fontWeight: 600,
    margin: 0,
  },
  joinInput: {
    width: '100%',
    padding: '14px 18px',
    fontSize: 18,
    fontFamily: "'Fredoka', sans-serif",
    fontWeight: 600,
    borderRadius: 14,
    border: '2px solid rgba(255,107,53,0.3)',
    outline: 'none',
    boxSizing: 'border-box',
  },
  joinLangRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    width: '100%',
  },
  joinLangBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 16px',
    borderRadius: 12,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  joinLangLabel: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 16,
    fontWeight: 600,
    color: '#333',
  },
  joinBtn: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 20,
    padding: '14px 32px',
    background: '#FF6B35',
    color: 'white',
    border: 'none',
    borderRadius: 16,
    cursor: 'pointer',
    width: '100%',
  },
  // Waiting room
  waitCard: {
    background: 'white',
    borderRadius: 20,
    padding: '40px 32px',
    maxWidth: 420,
    width: '100%',
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
    textAlign: 'center',
  },
  waitRoomName: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 24,
    color: '#FF6B35',
    margin: 0,
  },
  waitUserInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    background: '#FFF8F0',
    padding: '10px 20px',
    borderRadius: 16,
  },
  waitUserName: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 20,
    fontWeight: 700,
    color: '#333',
  },
  waitIcon: {
    fontSize: 56,
    animation: 'chatPulse 2s ease-in-out infinite',
    margin: '8px 0',
  },
  waitMsg: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 18,
    fontWeight: 600,
    color: '#8B5A2B',
    margin: 0,
    lineHeight: 1.5,
  },
  waitBadge: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 14,
    fontWeight: 600,
    color: '#666',
    background: '#F0F0F0',
    padding: '6px 16px',
    borderRadius: 20,
  },
  // Chat view
  chatContainer: {
    display: 'flex',
    flexDirection: 'column',
    height: '100dvh',
    background: '#FFF8F0',
    fontFamily: "'Fredoka', sans-serif",
  },
  chatHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    background: 'rgba(255, 248, 240, 0.95)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    borderBottom: '1px solid rgba(255,107,53,0.15)',
    flexShrink: 0,
  },
  chatHeaderLeft: {
    flex: 1,
    minWidth: 0,
  },
  chatTitle: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 20,
    color: '#8B5A2B',
    margin: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  chatBadge: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 13,
    fontWeight: 700,
    color: '#555',
    background: 'rgba(0,0,0,0.04)',
    padding: '4px 12px',
    borderRadius: 16,
    flexShrink: 0,
    whiteSpace: 'nowrap',
  },
  // Jitsi video
  videoSection: {
    flexShrink: 0,
    height: '40vh',
    background: '#1a1a1a',
    overflow: 'hidden',
    borderRadius: '0 0 12px 12px',
    margin: '0 8px',
    position: 'relative',
  },
  videoIframe: {
    width: '100%',
    height: '100%',
    border: 'none',
    borderRadius: 12,
  },
  videoOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    background: '#1a1a1a',
  },
  videoLoadText: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 16,
    fontWeight: 600,
    color: '#999',
    textAlign: 'center',
    padding: '0 20px',
  },
  // Messages
  messagesArea: {
    flex: 1,
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch',
    padding: '12px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  emptyChat: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    gap: 8,
    opacity: 0.6,
  },
  emptyChatText: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 16,
    fontWeight: 600,
    color: '#999',
    margin: 0,
  },
  msgRow: {
    display: 'flex',
    width: '100%',
  },
  msgBubble: {
    maxWidth: '80%',
    padding: '8px 14px',
    borderRadius: 16,
    boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
  },
  msgMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  msgAuthor: {
    fontSize: 12,
    fontWeight: 700,
    color: '#8B5A2B',
  },
  msgFlag: {
    fontSize: 12,
  },
  msgTime: {
    fontSize: 11,
    fontWeight: 500,
    color: '#BBB',
    marginLeft: 'auto',
  },
  msgText: {
    fontSize: 16,
    fontWeight: 600,
    color: '#333',
    lineHeight: 1.4,
    overflowWrap: 'break-word',
    wordBreak: 'break-word',
  },
  translatingNote: {
    fontSize: 12,
    fontWeight: 500,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 4,
  },
  translationError: {
    fontSize: 12,
    fontWeight: 500,
    color: '#E57373',
    marginTop: 4,
  },
  toggleBtn: {
    fontSize: 12,
    fontWeight: 600,
    color: '#FF6B35',
    background: 'none',
    border: 'none',
    padding: '4px 0 0',
    cursor: 'pointer',
    fontFamily: "'Fredoka', sans-serif",
  },
  // Input bar
  inputBar: {
    display: 'flex',
    gap: 8,
    padding: '10px 12px',
    background: 'rgba(255, 248, 240, 0.95)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    borderTop: '1px solid rgba(255,107,53,0.15)',
    flexShrink: 0,
  },
  msgInput: {
    flex: 1,
    padding: '12px 16px',
    fontSize: 16,
    fontFamily: "'Fredoka', sans-serif",
    fontWeight: 600,
    borderRadius: 14,
    border: '2px solid rgba(255,107,53,0.2)',
    outline: 'none',
    background: 'white',
    boxSizing: 'border-box',
  },
  sendBtn: {
    width: 48,
    height: 48,
    fontSize: 22,
    background: '#FF6B35',
    color: 'white',
    border: 'none',
    borderRadius: 14,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
};

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { ref, set, onValue, remove, push } from 'firebase/database';
import { db } from '../firebase';

const API_URL = 'https://harmonious-taffy-89ea6b.netlify.app/.netlify/functions/generate-image';
const POLL_URL = 'https://harmonious-taffy-89ea6b.netlify.app/.netlify/functions/poll-image';

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

const DEVICE_LANG = (() => {
  const raw = (navigator.language || navigator.languages?.[0] || 'en').slice(0, 2).toLowerCase();
  return ['de', 'en', 'tr', 'sw', 'fr'].includes(raw) ? raw : 'en';
})();

const UI = {
  de: {
    title: 'KI-Kunststudio',
    placeholder: 'Was m\u00F6chtest du erstellen? Beschreibe dein Bild...',
    generate: 'Bild erstellen!',
    loading: 'KI erstellt dein Bild...',
    save: 'Speichern',
    retry: 'Nochmal',
    unsafe: 'Dieser Text ist nicht erlaubt. Bitte versuche etwas anderes! \u{1F648}',
    error: 'Etwas ist schiefgelaufen. Bitte versuche es nochmal.',
    gallery: 'Deine Bilder',
    close: 'Schlie\u00DFen',
    chars: 'Zeichen',
    createRoom: 'Raum erstellen',
    closeRoom: 'Raum schlie\u00DFen',
    studentGallery: 'Sch\u00FCler-Galerie',
    noImages: 'Noch keine Bilder',
    pause: 'Pausieren',
    resume: 'Fortsetzen',
    by: 'von',
  },
  en: {
    title: 'AI Art Studio',
    placeholder: 'What do you want to create? Describe your image...',
    generate: 'Create Image!',
    loading: 'AI is creating your image...',
    save: 'Save',
    retry: 'Try Again',
    unsafe: 'This text is not allowed. Please try something else! \u{1F648}',
    error: 'Something went wrong. Please try again.',
    gallery: 'Your Images',
    close: 'Close',
    chars: 'chars',
    createRoom: 'Create Room',
    closeRoom: 'Close Room',
    studentGallery: 'Student Gallery',
    noImages: 'No images yet',
    pause: 'Pause',
    resume: 'Resume',
    by: 'by',
  },
  tr: {
    title: 'Yapay Zeka Sanat St\u00FCdyosu',
    placeholder: 'Ne olu\u015Fturmak istiyorsun? Resmini a\u00E7\u0131kla...',
    generate: 'Resim Olu\u015Ftur!',
    loading: 'Yapay zeka resminizi olu\u015Fturuyor...',
    save: 'Kaydet',
    retry: 'Tekrar Dene',
    unsafe: 'Bu metin izin verilmiyor. L\u00FCtfen ba\u015Fka bir \u015Fey deneyin! \u{1F648}',
    error: 'Bir \u015Feyler ters gitti. L\u00FCtfen tekrar deneyin.',
    gallery: 'Resimlerin',
    close: 'Kapat',
    chars: 'karakter',
    createRoom: 'Oda Olu\u015Ftur',
    closeRoom: 'Oday\u0131 Kapat',
    studentGallery: '\u00D6\u011Frenci Galerisi',
    noImages: 'Hen\u00FCz resim yok',
    pause: 'Duraklat',
    resume: 'Devam Et',
    by: '\u2013',
  },
  sw: {
    title: 'Studio ya Sanaa ya AI',
    placeholder: 'Unataka kuunda nini? Eleza picha yako...',
    generate: 'Tengeneza Picha!',
    loading: 'AI inatengeneza picha yako...',
    save: 'Hifadhi',
    retry: 'Jaribu Tena',
    unsafe: 'Maandishi haya hayaruhusiwi. Tafadhali jaribu kitu kingine! \u{1F648}',
    error: 'Kitu kilienda vibaya. Tafadhali jaribu tena.',
    gallery: 'Picha Zako',
    close: 'Funga',
    chars: 'herufi',
    createRoom: 'Unda Chumba',
    closeRoom: 'Funga Chumba',
    studentGallery: 'Picha za Wanafunzi',
    noImages: 'Hakuna picha bado',
    pause: 'Simamisha',
    resume: 'Endelea',
    by: 'na',
  },
  fr: {
    title: 'Studio d\'Art IA',
    placeholder: 'Que voulez-vous cr\u00E9er ? D\u00E9crivez votre image...',
    generate: 'Cr\u00E9er l\'image !',
    loading: 'L\'IA cr\u00E9e votre image...',
    save: 'Enregistrer',
    retry: 'R\u00E9essayer',
    unsafe: 'Ce texte n\'est pas autoris\u00E9. Essayez autre chose ! \u{1F648}',
    error: 'Quelque chose s\'est mal pass\u00E9. Veuillez r\u00E9essayer.',
    gallery: 'Vos Images',
    close: 'Fermer',
    chars: 'caract\u00E8res',
    createRoom: 'Cr\u00E9er une Salle',
    closeRoom: 'Fermer la Salle',
    studentGallery: 'Galerie des \u00E9l\u00E8ves',
    noImages: 'Pas encore d\'images',
    pause: 'Pause',
    resume: 'Reprendre',
    by: 'par',
  },
};

const STYLES = [
  { id: 'illustration', label: 'Illustration', emoji: '\u{1F58C}\uFE0F', color: '#FFE0B2' },
  { id: 'photo', label: 'Foto', emoji: '\u{1F4F7}', color: '#B3E5FC' },
  { id: 'cartoon', label: 'Cartoon', emoji: '\u{1F3AD}', color: '#F8BBD0' },
  { id: 'watercolor', label: 'Aquarell', emoji: '\u{1F3A8}', color: '#C8E6C9' },
  { id: 'pixel', label: 'Pixel Art', emoji: '\u{1F47E}', color: '#D1C4E9' },
  { id: '3d', label: '3D', emoji: '\u{1F9CA}', color: '#B2EBF2' },
  { id: 'anime', label: 'Anime', emoji: '\u{1F338}', color: '#F3E5F5' },
  { id: 'oil', label: '\u00D6lgem\u00E4lde', emoji: '\u{1F5BC}\uFE0F', color: '#FFF9C4' },
  { id: 'comic', label: 'Comic', emoji: '\u{1F4A5}', color: '#FFCCBC' },
  { id: 'sketch', label: 'Skizze', emoji: '\u270F\uFE0F', color: '#E0E0E0' },
];

const RATIOS = ['1:1', '16:9', '9:16'];

export default function ArtStudio({ onClose, initialMode }) {
  const t = UI[DEVICE_LANG];
  const [prompt, setPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('illustration');
  const [selectedRatio, setSelectedRatio] = useState('1:1');
  const [selectedModel, setSelectedModel] = useState('quality');
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [gallery, setGallery] = useState([]);
  const [previewImg, setPreviewImg] = useState(null);
  const progressRef = useRef(null);

  // Room state
  const [roomCode, setRoomCode] = useState(() => localStorage.getItem('artroom-teacher-code') || '');
  const [room, setRoom] = useState(null);
  const [studentImages, setStudentImages] = useState([]);
  const [showRoom, setShowRoom] = useState(initialMode === 'room');

  // Multi-room state
  const [participants, setParticipants] = useState([]);
  const [studios, setStudios] = useState([]);
  const [dragOverTarget, setDragOverTarget] = useState(null);
  const [studioMenuOpen, setStudioMenuOpen] = useState(null);
  const dragItemRef = useRef(null);
  const touchCloneRef = useRef(null);
  const touchStartRef = useRef(null);

  // Inject animation styles
  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'art-studio-anims';
    style.textContent = `
      @keyframes artRainbow { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
      @keyframes artFadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
      @keyframes artPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.15); } }
    `;
    document.head.appendChild(style);
    return () => { style.remove(); };
  }, []);

  // Subscribe to room if code exists
  useEffect(() => {
    if (!roomCode) { setRoom(null); setStudentImages([]); return; }
    const roomRef = ref(db, 'artRooms/' + roomCode);
    const unsub = onValue(roomRef, (snap) => {
      const data = snap.val();
      setRoom(data);
      if (!data) {
        localStorage.removeItem('artroom-teacher-code');
        setRoomCode('');
      }
    });
    return () => unsub();
  }, [roomCode]);

  // Subscribe to student images
  useEffect(() => {
    if (!roomCode) return;
    const imgsRef = ref(db, 'artRooms/' + roomCode + '/images');
    const unsub = onValue(imgsRef, (snap) => {
      const data = snap.val();
      if (!data) { setStudentImages([]); return; }
      const list = Object.entries(data).map(([k, v]) => ({ id: k, ...v }));
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setStudentImages(list);
    });
    return () => unsub();
  }, [roomCode]);

  // Fake progress bar
  useEffect(() => {
    if (!generating) { setProgress(0); return; }
    setProgress(0);
    const start = Date.now();
    const dur = selectedModel === 'schnell' ? 15000 : 20000;
    progressRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      setProgress(Math.min(95, (elapsed / dur) * 100));
    }, 200);
    return () => { if (progressRef.current) clearInterval(progressRef.current); };
  }, [generating, selectedModel]);

  // Subscribe to participants pool
  useEffect(() => {
    if (!roomCode) { setParticipants([]); return; }
    const u = onValue(ref(db, 'artRooms/' + roomCode + '/participants'), snap => {
      const d = snap.val();
      setParticipants(d ? Object.entries(d).map(([id, v]) => ({ id, name: v.name })) : []);
    });
    return () => u();
  }, [roomCode]);

  // Subscribe to studios (sub-rooms)
  useEffect(() => {
    if (!roomCode) { setStudios([]); return; }
    const u = onValue(ref(db, 'artRooms/' + roomCode + '/studios'), snap => {
      const d = snap.val();
      setStudios(d ? Object.entries(d).map(([id, v]) => ({
        id, name: v.name,
        allowedModels: v.allowedModels || ['schnell', 'quality'],
        participants: v.participants
          ? (Array.isArray(v.participants) ? v.participants : Object.values(v.participants))
          : [],
      })) : []);
    });
    return () => u();
  }, [roomCode]);

  // Cleanup touch clone on unmount
  useEffect(() => () => {
    if (touchCloneRef.current) { touchCloneRef.current.remove(); touchCloneRef.current = null; }
  }, []);

  // Close studio menu on outside click
  useEffect(() => {
    if (!studioMenuOpen) return;
    const h = () => setStudioMenuOpen(null);
    setTimeout(() => document.addEventListener('click', h), 0);
    return () => document.removeEventListener('click', h);
  }, [studioMenuOpen]);

  // === Assignment logic ===
  const getAssignedStudioId = useCallback((name) => {
    for (const s of studios) if (s.participants.some(p => p.name === name)) return s.id;
    return null;
  }, [studios]);

  const assignParticipant = useCallback(async ({ name }, targetId) => {
    const curId = getAssignedStudioId(name);
    if (curId === targetId || (!curId && targetId === 'pool')) return;
    if (curId) {
      const studio = studios.find(s => s.id === curId);
      if (studio) {
        const nl = studio.participants.filter(p => p.name !== name);
        await set(ref(db, 'artRooms/' + roomCode + '/studios/' + curId + '/participants'), nl.length ? nl : []);
      }
    }
    if (targetId !== 'pool') {
      const tr = studios.find(s => s.id === targetId);
      if (tr) await set(ref(db, 'artRooms/' + roomCode + '/studios/' + targetId + '/participants'), [...tr.participants, { name }]);
    }
  }, [studios, roomCode, getAssignedStudioId]);

  // === Studio CRUD ===
  const handleCreateStudio = async () => {
    if (!roomCode) return;
    const nums = studios.map(s => { const m = s.name.match(/(\d+)/); return m ? +m[1] : 0; });
    await push(ref(db, 'artRooms/' + roomCode + '/studios'), {
      name: 'Raum ' + (Math.max(0, ...nums) + 1),
      allowedModels: ['schnell', 'quality'],
    });
  };

  const handleDeleteStudio = async (id) => {
    if (!roomCode) return;
    setStudioMenuOpen(null);
    await remove(ref(db, 'artRooms/' + roomCode + '/studios/' + id));
  };

  const handleToggleStudioModel = async (studioId, modelKey) => {
    if (!roomCode) return;
    const studio = studios.find(s => s.id === studioId);
    if (!studio) return;
    const current = studio.allowedModels;
    let updated;
    if (current.includes(modelKey)) {
      updated = current.filter(m => m !== modelKey);
      if (updated.length === 0) return;
    } else {
      updated = [...current, modelKey];
    }
    await set(ref(db, 'artRooms/' + roomCode + '/studios/' + studioId + '/allowedModels'), updated);
  };

  // === HTML5 Drag & Drop ===
  const onDragStart = (e, p) => { dragItemRef.current = p; e.dataTransfer.effectAllowed = 'move'; };
  const onDragEnd = () => { dragItemRef.current = null; setDragOverTarget(null); };
  const onDragOver = (e, id) => { e.preventDefault(); setDragOverTarget(id); };
  const onDragLeave = (_, id) => { if (dragOverTarget === id) setDragOverTarget(null); };
  const onDrop = (e, id) => {
    e.preventDefault(); setDragOverTarget(null);
    if (dragItemRef.current) { assignParticipant(dragItemRef.current, id); dragItemRef.current = null; }
  };

  // === Touch Drag & Drop ===
  const findDropTarget = (x, y) => {
    if (touchCloneRef.current) touchCloneRef.current.style.display = 'none';
    let el = document.elementFromPoint(x, y);
    if (touchCloneRef.current) touchCloneRef.current.style.display = '';
    while (el && el !== document.body) {
      if (el.dataset?.dropId) return el.dataset.dropId;
      el = el.parentElement;
    }
    return null;
  };

  const onTouchStart = (e, p) => {
    const t = e.touches[0];
    dragItemRef.current = p;
    touchStartRef.current = { x: t.clientX, y: t.clientY, el: e.currentTarget, moved: false };
  };

  const onTouchMove = useCallback((e) => {
    const ts = touchStartRef.current;
    if (!ts) return;
    const t = e.touches[0];
    if (!ts.moved) {
      if ((t.clientX - ts.x) ** 2 + (t.clientY - ts.y) ** 2 < 64) return;
      ts.moved = true;
      const rect = ts.el.getBoundingClientRect();
      const clone = ts.el.cloneNode(true);
      Object.assign(clone.style, {
        position: 'fixed', left: rect.left + 'px', top: rect.top + 'px', width: rect.width + 'px',
        zIndex: '9999', opacity: '0.85', pointerEvents: 'none',
        boxShadow: '0 4px 16px rgba(0,0,0,0.25)', transform: 'scale(1.08)', borderRadius: '20px',
      });
      document.body.appendChild(clone);
      touchCloneRef.current = clone;
    }
    if (touchCloneRef.current) {
      const w = parseFloat(touchCloneRef.current.style.width) || 60;
      touchCloneRef.current.style.left = (t.clientX - w / 2) + 'px';
      touchCloneRef.current.style.top = (t.clientY - 20) + 'px';
    }
    setDragOverTarget(findDropTarget(t.clientX, t.clientY));
  }, []);

  const onTouchEnd = useCallback((e) => {
    if (touchCloneRef.current) {
      const t = e.changedTouches[0];
      const tid = findDropTarget(t.clientX, t.clientY);
      touchCloneRef.current.remove(); touchCloneRef.current = null;
      if (dragItemRef.current && tid) assignParticipant(dragItemRef.current, tid);
    }
    dragItemRef.current = null; touchStartRef.current = null; setDragOverTarget(null);
  }, [assignParticipant]);

  const handleCreateRoom = async () => {
    const code = generateCode();
    await set(ref(db, 'artRooms/' + code), {
      createdAt: Date.now(),
      createdBy: 'teacher',
      active: true,
      settings: { imageEnabled: true, videoEnabled: false },
    });
    localStorage.setItem('artroom-teacher-code', code);
    setRoomCode(code);
    setShowRoom(true);
  };

  const handleCloseRoom = async () => {
    if (!roomCode) return;
    await set(ref(db, 'artRooms/' + roomCode + '/active'), false);
    localStorage.removeItem('artroom-teacher-code');
    setRoomCode('');
    setRoom(null);
    setShowRoom(false);
  };

  const handleTogglePause = async () => {
    if (!roomCode || !room) return;
    const current = room.settings?.imageEnabled !== false;
    await set(ref(db, 'artRooms/' + roomCode + '/settings/imageEnabled'), !current);
  };

  const handleDeleteImage = async (imgId) => {
    if (!roomCode) return;
    await remove(ref(db, 'artRooms/' + roomCode + '/images/' + imgId));
  };

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || generating) return;
    setGenerating(true);
    setResult(null);
    setError(null);

    const styleName = STYLES.find(s => s.id === selectedStyle)?.label || 'illustration';

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim(), style: styleName, aspectRatio: selectedRatio, model: selectedModel }),
      });

      let data;
      try { data = await res.json(); } catch {
        setError(`HTTP ${res.status} - Antwort konnte nicht gelesen werden`);
        setGenerating(false);
        return;
      }

      if (!res.ok) {
        if (data.error === 'unsafe') {
          setError('unsafe');
        } else {
          setError(data.details || data.error || `HTTP ${res.status}`);
        }
        setGenerating(false);
        return;
      }

      // If image ready immediately (fast models)
      if (data.imageUrl) {
        setResult(data);
        setProgress(100);
        setGallery(prev => [{ ...data, style: styleName, ratio: selectedRatio, timestamp: Date.now() }, ...prev]);
        setGenerating(false);
        return;
      }

      // Async polling for slower models (premium/ultra)
      if (data.status === 'processing' && data.pollUrl) {
        const pollInterval = 2000;
        const maxPolls = 90; // 3 minutes max
        let polls = 0;
        while (polls < maxPolls) {
          await new Promise(r => setTimeout(r, pollInterval));
          polls++;
          try {
            const pollRes = await fetch(POLL_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ pollUrl: data.pollUrl }),
            });
            const pollData = await pollRes.json();
            if (pollData.status === 'succeeded' && pollData.imageUrl) {
              const finalData = { imageUrl: pollData.imageUrl, enhancedPrompt: data.enhancedPrompt, originalPrompt: data.originalPrompt };
              setResult(finalData);
              setProgress(100);
              setGallery(prev => [{ ...finalData, style: styleName, ratio: selectedRatio, timestamp: Date.now() }, ...prev]);
              setGenerating(false);
              return;
            }
            if (pollData.status === 'failed') {
              setError(pollData.error || 'Bildgenerierung fehlgeschlagen');
              setGenerating(false);
              return;
            }
            // Still processing - update progress
            setProgress(Math.min(90, 30 + polls * 2));
          } catch {
            // Poll network error - keep trying
          }
        }
        setError('Zeitüberschreitung - bitte erneut versuchen');
        setGenerating(false);
        return;
      }

      // Unexpected response
      setError('Unerwartete Antwort vom Server');
    } catch (err) {
      setError(`Netzwerkfehler: ${err.message}`);
    }

    setGenerating(false);
  }, [prompt, selectedStyle, selectedRatio, selectedModel, generating]);

  const handleDownload = useCallback(async () => {
    if (!result?.imageUrl) return;
    try {
      const resp = await fetch(result.imageUrl);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ki-kunst-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      window.open(result.imageUrl, '_blank');
    }
  }, [result]);

  const handleRetry = () => {
    setResult(null);
    setError(null);
    handleGenerate();
  };

  const roomUrl = roomCode ? `${window.location.origin}/art/${roomCode}` : '';
  const isPaused = room && room.settings?.imageEnabled === false;

  return (
    <div style={st.overlay} onClick={onClose}>
      <div style={st.modal} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={st.header}>
          <h1 style={st.title}>{'\u{1F3A8}'} {t.title}</h1>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* Room toggle button */}
            {roomCode && room?.active && (
              <button onClick={() => setShowRoom(!showRoom)} style={{
                ...st.roomToggleBtn,
                background: showRoom ? 'rgba(167,139,250,0.3)' : 'rgba(255,255,255,0.1)',
              }}>
                {'\u{1F465}'} {studentImages.length}
              </button>
            )}
            {!roomCode && (
              <button onClick={handleCreateRoom} style={st.createRoomBtn}>{t.createRoom}</button>
            )}
            <button onClick={onClose} style={st.closeBtn}>{'\u2715'}</button>
          </div>
        </div>

        <div style={st.body}>
          {/* Room panel (teacher view) */}
          {showRoom && roomCode && room?.active && (
            <div style={st.roomPanel}>
              <div style={st.qrSection}>
                <div style={st.qrBox}>
                  <QRCodeSVG value={roomUrl} size={100} level="M" bgColor="transparent" fgColor="white" />
                </div>
                <div style={st.qrInfo}>
                  <div style={st.roomCodeDisplay}>Code: <strong>{roomCode}</strong></div>
                  <div style={st.roomUrlDisplay}>{roomUrl}</div>
                  <div style={st.roomControls}>
                    <button onClick={handleTogglePause} style={{
                      ...st.roomCtrlBtn,
                      background: isPaused ? 'rgba(78,205,196,0.2)' : 'rgba(255,230,109,0.2)',
                      color: isPaused ? '#4ECDC4' : '#FFE66D',
                    }}>
                      {isPaused ? '\u25B6\uFE0F ' + t.resume : '\u23F8\uFE0F ' + t.pause}
                    </button>
                    <button onClick={handleCloseRoom} style={st.closeRoomBtn}>
                      {'\u2715'} {t.closeRoom}
                    </button>
                  </div>
                </div>
              </div>

              {/* Room Manager: Participants + Studios */}
              <div style={st.roomManagerWrap}>
                {/* Left: Participant Pool */}
                <div style={st.rmLeftCol}>
                  <div style={st.rmColHead}>
                    <span style={st.rmColTitle}>Teilnehmer</span>
                    <span style={st.rmBadge}>{participants.length}</span>
                  </div>
                  <div
                    data-drop-id="pool"
                    onDragOver={e => onDragOver(e, 'pool')}
                    onDragLeave={e => onDragLeave(e, 'pool')}
                    onDrop={e => onDrop(e, 'pool')}
                    style={{
                      ...st.rmPool,
                      ...(dragOverTarget === 'pool' ? st.rmDropGlow : {}),
                    }}
                  >
                    {participants.length === 0 && <p style={st.rmEmpty}>Noch keine Teilnehmer</p>}
                    {(() => {
                      const assignedKeys = new Set();
                      studios.forEach(s => s.participants.forEach(p => assignedKeys.add(p.name)));
                      const unassigned = participants.filter(p => !assignedKeys.has(p.name));
                      const assigned = participants.filter(p => assignedKeys.has(p.name));
                      return (
                        <>
                          {unassigned.map(p => (
                            <div
                              key={'u-' + p.id}
                              draggable
                              onDragStart={e => onDragStart(e, p)}
                              onDragEnd={onDragEnd}
                              onTouchStart={e => onTouchStart(e, p)}
                              onTouchMove={onTouchMove}
                              onTouchEnd={onTouchEnd}
                              style={{ ...st.rmCard, cursor: 'grab', touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none' }}
                            >
                              {p.name}
                            </div>
                          ))}
                          {assigned.map(p => (
                            <div key={'g-' + p.id} style={{ ...st.rmCard, opacity: 0.35, cursor: 'default' }}>
                              {p.name}
                            </div>
                          ))}
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* Right: Studios */}
                <div style={st.rmRightCol}>
                  <div style={st.rmColHead}>
                    <span style={st.rmColTitle}>Kunst-R\u00E4ume</span>
                    <button onClick={handleCreateStudio} style={st.rmAddBtn}>+ Neuer Raum</button>
                  </div>
                  <div style={st.rmRoomsList}>
                    {studios.length === 0 && <p style={st.rmEmpty}>Noch keine R\u00E4ume erstellt</p>}
                    {studios.map(studio => (
                      <div
                        key={studio.id}
                        data-drop-id={studio.id}
                        onDragOver={e => onDragOver(e, studio.id)}
                        onDragLeave={e => onDragLeave(e, studio.id)}
                        onDrop={e => onDrop(e, studio.id)}
                        style={{
                          ...st.rmRoomBox,
                          ...(dragOverTarget === studio.id ? st.rmDropGlow : {}),
                        }}
                      >
                        <div style={st.rmRoomHead}>
                          <div style={st.rmRoomName}>{studio.name}</div>
                          <div style={{ position: 'relative' }}>
                            <button
                              onClick={e => { e.stopPropagation(); setStudioMenuOpen(studioMenuOpen === studio.id ? null : studio.id); }}
                              style={st.rmDots}
                            >{'\u22EE'}</button>
                            {studioMenuOpen === studio.id && (
                              <div style={st.rmMenu} onClick={e => e.stopPropagation()}>
                                <button onClick={() => handleDeleteStudio(studio.id)} style={{ ...st.rmMenuItem, color: '#FF6B6B' }}>
                                  {'\u{1F5D1}\uFE0F'} Raum l\u00F6schen
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                        {/* Model toggles for this studio */}
                        <div style={st.rmModelRow}>
                          {[
                            { key: 'schnell', label: '\u26A1', color: '#4ECDC4' },
                            { key: 'quality', label: '\u2728', color: '#A78BFA' },
                          ].map(m => {
                            const on = studio.allowedModels.includes(m.key);
                            return (
                              <button
                                key={m.key}
                                onClick={() => handleToggleStudioModel(studio.id, m.key)}
                                style={{
                                  ...st.rmModelToggle,
                                  background: on ? m.color + '30' : 'rgba(255,255,255,0.05)',
                                  border: on ? '1px solid ' + m.color : '1px solid rgba(255,255,255,0.1)',
                                  color: on ? m.color : 'rgba(255,255,255,0.2)',
                                }}
                                title={m.key}
                              >
                                {m.label}
                              </button>
                            );
                          })}
                        </div>
                        {/* Participant cards */}
                        <div style={st.rmRoomCards}>
                          {studio.participants.length === 0 && <span style={st.rmDropHint}>Teilnehmer hierher ziehen</span>}
                          {studio.participants.map((p, i) => (
                            <div
                              key={studio.id + '-' + i}
                              draggable
                              onDragStart={e => onDragStart(e, p)}
                              onDragEnd={onDragEnd}
                              onTouchStart={e => onTouchStart(e, p)}
                              onTouchMove={onTouchMove}
                              onTouchEnd={onTouchEnd}
                              style={{ ...st.rmCard, cursor: 'grab', touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none' }}
                            >
                              {p.name}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Student images */}
              <div style={st.studentGalTitle}>{t.studentGallery} ({studentImages.length})</div>
              {studentImages.length === 0 && (
                <div style={st.noImagesText}>{t.noImages}</div>
              )}
              <div style={st.studentGalGrid}>
                {studentImages.map(img => (
                  <div key={img.id} style={st.studentGalCard}>
                    <img src={img.imageUrl} alt={img.prompt} style={st.studentGalImg} onClick={() => setPreviewImg(img)} />
                    <div style={st.studentGalMeta}>
                      <span style={st.studentGalAuthor}>{img.author}</span>
                      <button onClick={() => handleDeleteImage(img.id)} style={st.deleteImgBtn} title="L\u00F6schen">{'\u{1F5D1}\uFE0F'}</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Teacher's own generation UI */}
          {!showRoom && (
            <>
              {/* Prompt input */}
              <div style={st.promptWrap}>
                <textarea
                  value={prompt}
                  onChange={e => setPrompt(e.target.value.slice(0, 500))}
                  placeholder={t.placeholder}
                  style={st.textarea}
                  maxLength={500}
                  rows={3}
                />
                <div style={st.charCount}>{prompt.length}/500 {t.chars}</div>
              </div>

              {/* Style chips */}
              <div style={st.chipsRow}>
                {STYLES.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedStyle(s.id)}
                    style={{
                      ...st.chip,
                      background: selectedStyle === s.id ? s.color : 'rgba(255,255,255,0.08)',
                      border: selectedStyle === s.id ? '2px solid rgba(255,255,255,0.6)' : '2px solid transparent',
                      color: selectedStyle === s.id ? '#1a0a2e' : 'rgba(255,255,255,0.7)',
                    }}
                  >
                    <span style={{ fontSize: 18 }}>{s.emoji}</span>
                    <span style={st.chipLabel}>{s.label}</span>
                  </button>
                ))}
              </div>

              {/* Aspect ratio pills */}
              <div style={st.ratioRow}>
                {RATIOS.map(r => (
                  <button
                    key={r}
                    onClick={() => setSelectedRatio(r)}
                    style={{
                      ...st.ratioPill,
                      background: selectedRatio === r ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.05)',
                      border: selectedRatio === r ? '2px solid rgba(255,255,255,0.5)' : '2px solid rgba(255,255,255,0.1)',
                    }}
                  >{r}</button>
                ))}
              </div>

              {/* Model selector */}
              <div style={st.modelRow}>
                <button
                  onClick={() => setSelectedModel('schnell')}
                  style={{
                    ...st.modelBtn,
                    background: selectedModel === 'schnell' ? 'rgba(78,205,196,0.2)' : 'rgba(255,255,255,0.05)',
                    border: selectedModel === 'schnell' ? '2px solid rgba(78,205,196,0.5)' : '2px solid rgba(255,255,255,0.1)',
                    color: selectedModel === 'schnell' ? '#4ECDC4' : 'rgba(255,255,255,0.5)',
                    boxShadow: selectedModel === 'schnell' ? '0 0 12px rgba(78,205,196,0.3)' : 'none',
                  }}
                >
                  <span>{'\u26A1'} Schnell</span>
                  <span style={st.modelHint}>~1 Sek.</span>
                </button>
                <button
                  onClick={() => setSelectedModel('quality')}
                  style={{
                    ...st.modelBtn,
                    background: selectedModel === 'quality' ? 'rgba(167,139,250,0.2)' : 'rgba(255,255,255,0.05)',
                    border: selectedModel === 'quality' ? '2px solid rgba(167,139,250,0.5)' : '2px solid rgba(255,255,255,0.1)',
                    color: selectedModel === 'quality' ? '#A78BFA' : 'rgba(255,255,255,0.5)',
                    boxShadow: selectedModel === 'quality' ? '0 0 12px rgba(167,139,250,0.3)' : 'none',
                  }}
                >
                  <span>{'\u2728 Qualit\u00E4t'}</span>
                  <span style={st.modelHint}>~5 Sek.</span>
                </button>
              </div>

              {/* Generate button */}
              <button
                onClick={handleGenerate}
                disabled={!prompt.trim() || generating}
                style={{
                  ...st.generateBtn,
                  opacity: (!prompt.trim() || generating) ? 0.5 : 1,
                  cursor: (!prompt.trim() || generating) ? 'default' : 'pointer',
                }}
              >
                {'\u2728'} {generating ? t.loading : t.generate}
              </button>

              {/* Loading */}
              {generating && (
                <div style={st.loadingWrap}>
                  <div style={st.loadingEmoji}>{'\u{1F58C}\uFE0F'}</div>
                  <div style={st.loadingText}>{t.loading}</div>
                  <div style={st.progressBar}>
                    <div style={{ ...st.progressFill, width: progress + '%' }} />
                  </div>
                </div>
              )}

              {/* Error */}
              {error && !generating && (
                <div style={st.errorBox}>
                  {error === 'unsafe' ? t.unsafe : error === 'general' ? t.error : error}
                </div>
              )}

              {/* Result */}
              {result && !generating && (
                <div style={st.resultWrap}>
                  <img src={result.imageUrl} alt={result.originalPrompt} style={st.resultImg} />
                  <div style={st.resultActions}>
                    <button onClick={handleDownload} style={st.actionBtn}>{'\u{1F4BE}'} {t.save}</button>
                    <button onClick={handleRetry} style={st.actionBtn}>{'\u{1F504}'} {t.retry}</button>
                  </div>
                </div>
              )}

              {/* Teacher gallery */}
              {gallery.length > 0 && (
                <div style={st.gallerySection}>
                  <h3 style={st.galTitle}>{t.gallery}</h3>
                  <div style={st.galGrid}>
                    {gallery.map((img, i) => (
                      <div key={i} style={st.galThumb} onClick={() => setPreviewImg(img)}>
                        <img src={img.imageUrl} alt={img.originalPrompt} style={st.galImg} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Full-size preview */}
        {previewImg && (
          <div style={st.previewOverlay} onClick={() => setPreviewImg(null)}>
            <img src={previewImg.imageUrl} alt={previewImg.prompt || previewImg.originalPrompt} style={st.previewImg} onClick={e => e.stopPropagation()} />
            {previewImg.author && (
              <div style={st.previewMeta} onClick={e => e.stopPropagation()}>
                <span>"{previewImg.prompt}"</span>
                <span style={{ color: '#A78BFA' }}>{t.by} {previewImg.author}</span>
              </div>
            )}
            <button style={st.previewClose} onClick={() => setPreviewImg(null)}>{'\u2715'}</button>
          </div>
        )}
      </div>
    </div>
  );
}

const st = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
    animation: 'artFadeIn 0.3s ease',
  },
  modal: {
    width: '100%',
    height: '100%',
    maxWidth: 700,
    maxHeight: '100dvh',
    background: 'linear-gradient(135deg, #1a0a2e, #0B0D1A)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    position: 'relative',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    flexShrink: 0,
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  title: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 24,
    color: 'white',
    margin: 0,
  },
  closeBtn: {
    background: 'rgba(255,255,255,0.1)',
    border: 'none',
    color: 'white',
    fontSize: 20,
    width: 36,
    height: 36,
    borderRadius: 12,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createRoomBtn: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 12,
    fontWeight: 700,
    padding: '6px 12px',
    borderRadius: 10,
    border: 'none',
    cursor: 'pointer',
    background: 'linear-gradient(135deg, #A78BFA, #4ECDC4)',
    color: 'white',
    whiteSpace: 'nowrap',
  },
  roomToggleBtn: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 13,
    fontWeight: 700,
    padding: '6px 12px',
    borderRadius: 10,
    border: 'none',
    cursor: 'pointer',
    color: 'white',
    whiteSpace: 'nowrap',
  },
  body: {
    flex: 1,
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch',
    padding: '16px 20px 32px',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  // Room panel
  roomPanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  qrSection: {
    display: 'flex',
    gap: 16,
    alignItems: 'flex-start',
    background: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 16,
    border: '1px solid rgba(255,255,255,0.08)',
  },
  qrBox: {
    flexShrink: 0,
    padding: 8,
    background: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
  },
  qrInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    minWidth: 0,
    flex: 1,
  },
  roomCodeDisplay: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 20,
    color: 'white',
  },
  roomUrlDisplay: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    wordBreak: 'break-all',
  },
  roomControls: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
    marginTop: 4,
  },
  roomCtrlBtn: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 12,
    fontWeight: 700,
    padding: '5px 10px',
    borderRadius: 8,
    border: 'none',
    cursor: 'pointer',
  },
  closeRoomBtn: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 12,
    fontWeight: 700,
    padding: '5px 10px',
    borderRadius: 8,
    border: 'none',
    cursor: 'pointer',
    background: 'rgba(255,107,107,0.2)',
    color: '#FF6B6B',
  },
  // Room Manager styles
  roomManagerWrap: {
    display: 'flex',
    gap: 12,
    minHeight: 180,
  },
  rmLeftCol: {
    flex: '1 1 140px',
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  rmRightCol: {
    flex: '1.5 1 200px',
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  rmColHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    flexShrink: 0,
  },
  rmColTitle: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
  },
  rmBadge: {
    fontFamily: "'Baloo 2', cursive",
    fontSize: 12,
    fontWeight: 700,
    background: 'rgba(255,255,255,0.1)',
    padding: '1px 8px',
    borderRadius: 10,
    color: 'rgba(255,255,255,0.5)',
  },
  rmPool: {
    flex: 1,
    overflowY: 'auto',
    background: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    border: '2px dashed rgba(255,255,255,0.12)',
    padding: 8,
    display: 'flex',
    flexWrap: 'wrap',
    gap: 5,
    alignContent: 'flex-start',
    minHeight: 60,
    transition: 'border-color 0.2s, background 0.2s, box-shadow 0.2s',
  },
  rmCard: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 10px',
    borderRadius: 14,
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 12,
    fontWeight: 700,
    background: 'rgba(167,139,250,0.15)',
    color: '#A78BFA',
    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
    transition: 'opacity 0.2s',
  },
  rmAddBtn: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 11,
    fontWeight: 700,
    color: 'white',
    border: 'none',
    borderRadius: 8,
    padding: '4px 10px',
    cursor: 'pointer',
    background: 'linear-gradient(135deg, #A78BFA, #4ECDC4)',
  },
  rmRoomsList: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    minHeight: 60,
  },
  rmRoomBox: {
    background: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    border: '2px dashed rgba(255,255,255,0.12)',
    padding: 10,
    transition: 'border-color 0.2s, background 0.2s, box-shadow 0.2s',
  },
  rmRoomHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  rmRoomName: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 14,
    color: 'white',
  },
  rmDots: {
    fontSize: 16,
    fontWeight: 700,
    background: 'rgba(255,255,255,0.06)',
    border: 'none',
    borderRadius: 6,
    padding: '1px 6px',
    cursor: 'pointer',
    color: 'rgba(255,255,255,0.4)',
    lineHeight: 1,
  },
  rmMenu: {
    position: 'absolute',
    right: 0,
    top: 24,
    background: '#1a0a2e',
    borderRadius: 10,
    boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
    overflow: 'hidden',
    zIndex: 100,
    minWidth: 140,
    border: '1px solid rgba(255,255,255,0.1)',
  },
  rmMenuItem: {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 13,
    fontWeight: 600,
    padding: '8px 14px',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    color: 'rgba(255,255,255,0.7)',
  },
  rmModelRow: {
    display: 'flex',
    gap: 4,
    marginBottom: 6,
  },
  rmModelToggle: {
    fontSize: 14,
    padding: '3px 8px',
    borderRadius: 8,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    background: 'none',
  },
  rmRoomCards: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 5,
    minHeight: 28,
    alignItems: 'center',
  },
  rmDropHint: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 11,
    fontWeight: 500,
    color: 'rgba(255,255,255,0.2)',
    fontStyle: 'italic',
  },
  rmDropGlow: {
    borderColor: 'rgba(78,205,196,0.6)',
    background: 'rgba(78,205,196,0.08)',
    boxShadow: '0 0 0 2px rgba(78,205,196,0.2)',
  },
  rmEmpty: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 12,
    fontWeight: 500,
    color: 'rgba(255,255,255,0.2)',
    textAlign: 'center',
    margin: '12px 0',
    width: '100%',
  },
  studentGalTitle: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 17,
    color: 'rgba(255,255,255,0.6)',
    margin: 0,
  },
  noImagesText: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 14,
    color: 'rgba(255,255,255,0.3)',
    textAlign: 'center',
    padding: '20px 0',
  },
  studentGalGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
    gap: 8,
  },
  studentGalCard: {
    borderRadius: 12,
    overflow: 'hidden',
    border: '2px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.03)',
  },
  studentGalImg: {
    width: '100%',
    aspectRatio: '1',
    objectFit: 'cover',
    display: 'block',
    cursor: 'pointer',
  },
  studentGalMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '4px 8px',
  },
  studentGalAuthor: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 11,
    fontWeight: 700,
    color: 'rgba(255,255,255,0.5)',
  },
  deleteImgBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 14,
    padding: 2,
    opacity: 0.5,
  },
  // Generation UI
  promptWrap: { position: 'relative' },
  textarea: {
    width: '100%',
    minHeight: 80,
    padding: '14px 16px',
    fontSize: 16,
    fontFamily: "'Fredoka', sans-serif",
    fontWeight: 600,
    color: 'white',
    background: 'rgba(255,255,255,0.08)',
    border: '2px solid rgba(255,255,255,0.12)',
    borderRadius: 16,
    outline: 'none',
    resize: 'none',
    boxSizing: 'border-box',
  },
  charCount: {
    position: 'absolute',
    bottom: 8,
    right: 12,
    fontSize: 12,
    fontFamily: "'Fredoka', sans-serif",
    fontWeight: 500,
    color: 'rgba(255,255,255,0.3)',
  },
  chipsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  chip: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 14px',
    borderRadius: 20,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  chipLabel: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 13,
    fontWeight: 700,
  },
  ratioRow: {
    display: 'flex',
    gap: 8,
    justifyContent: 'center',
  },
  ratioPill: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 14,
    fontWeight: 700,
    color: 'rgba(255,255,255,0.7)',
    padding: '6px 18px',
    borderRadius: 20,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  modelRow: {
    display: 'flex',
    gap: 8,
    justifyContent: 'center',
  },
  modelBtn: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 14,
    fontWeight: 700,
    padding: '8px 16px',
    borderRadius: 14,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
    flex: 1,
  },
  modelHint: {
    fontSize: 10,
    fontWeight: 500,
    opacity: 0.6,
  },
  generateBtn: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 20,
    padding: '14px 24px',
    border: 'none',
    borderRadius: 18,
    color: 'white',
    background: 'linear-gradient(90deg, #FF6B6B, #FFE66D, #4ECDC4, #A78BFA, #FF6B6B)',
    backgroundSize: '200% 100%',
    animation: 'artRainbow 4s ease infinite',
    width: '100%',
    textShadow: '0 1px 4px rgba(0,0,0,0.3)',
  },
  loadingWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    padding: '20px 0',
  },
  loadingEmoji: {
    fontSize: 48,
    animation: 'artPulse 1.5s ease-in-out infinite',
  },
  loadingText: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 16,
    fontWeight: 600,
    color: 'rgba(255,255,255,0.7)',
  },
  progressBar: {
    width: '80%',
    height: 6,
    background: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #4ECDC4, #A78BFA)',
    borderRadius: 3,
    transition: 'width 0.3s ease',
  },
  errorBox: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 15,
    fontWeight: 600,
    color: '#FF6B6B',
    background: 'rgba(255, 107, 107, 0.1)',
    border: '1px solid rgba(255, 107, 107, 0.3)',
    borderRadius: 14,
    padding: '12px 16px',
    textAlign: 'center',
  },
  resultWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 14,
    animation: 'artFadeIn 0.5s ease',
  },
  resultImg: {
    width: '100%',
    maxHeight: '50vh',
    objectFit: 'contain',
    borderRadius: 16,
    boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
  },
  resultActions: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  actionBtn: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 15,
    fontWeight: 700,
    padding: '10px 20px',
    borderRadius: 14,
    border: 'none',
    cursor: 'pointer',
    background: 'rgba(255,255,255,0.12)',
    color: 'white',
    transition: 'background 0.15s ease',
  },
  gallerySection: {
    marginTop: 8,
    borderTop: '1px solid rgba(255,255,255,0.08)',
    paddingTop: 16,
  },
  galTitle: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 18,
    color: 'rgba(255,255,255,0.6)',
    margin: '0 0 12px',
  },
  galGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))',
    gap: 8,
  },
  galThumb: {
    aspectRatio: '1',
    borderRadius: 12,
    overflow: 'hidden',
    cursor: 'pointer',
    border: '2px solid rgba(255,255,255,0.1)',
    transition: 'border-color 0.15s ease',
  },
  galImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  previewOverlay: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(0,0,0,0.9)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    gap: 10,
  },
  previewImg: {
    maxWidth: '90%',
    maxHeight: '75%',
    objectFit: 'contain',
    borderRadius: 16,
  },
  previewMeta: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 13,
    fontWeight: 600,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  previewClose: {
    position: 'absolute',
    top: 16,
    right: 16,
    background: 'rgba(255,255,255,0.15)',
    border: 'none',
    color: 'white',
    fontSize: 22,
    width: 40,
    height: 40,
    borderRadius: 12,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
};

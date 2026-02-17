import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ref, onValue, set, remove, push } from 'firebase/database';
import { db } from '../firebase';
import { playClickSound } from '../utils/audio';
import Flag from './Flag';

const LANG_COLORS = {
  de: '#E3F2FD', en: '#E8F5E9', sw: '#FFF3E0', fr: '#F3E5F5', tr: '#FFEBEE',
};
const LANG_COUNTRY_CODES = {
  de: 'de', en: 'gb', sw: 'tz', fr: 'fr', tr: 'tr',
};

export default function VideoRoomManager({ roomCode, color }) {
  const [participants, setParticipants] = useState([]);
  const [videoRooms, setVideoRooms] = useState([]);
  const [dragOverTarget, setDragOverTarget] = useState(null);
  const [menuOpen, setMenuOpen] = useState(null);
  const dragItemRef = useRef(null);
  const touchCloneRef = useRef(null);
  const touchStartRef = useRef(null);

  // Firebase listeners
  useEffect(() => {
    const u1 = onValue(ref(db, `chatRooms/${roomCode}/participants`), snap => {
      const d = snap.val();
      setParticipants(d ? Object.entries(d).map(([id, v]) => ({ id, name: v.name, lang: v.lang })) : []);
    });
    const u2 = onValue(ref(db, `chatRooms/${roomCode}/videoRooms`), snap => {
      const d = snap.val();
      setVideoRooms(d ? Object.entries(d).map(([id, v]) => ({
        id, name: v.name, status: v.status || 'stopped',
        participants: v.participants
          ? (Array.isArray(v.participants) ? v.participants : Object.values(v.participants))
          : [],
      })) : []);
    });
    return () => { u1(); u2(); };
  }, [roomCode]);

  // Cleanup clone on unmount
  useEffect(() => () => {
    if (touchCloneRef.current) { touchCloneRef.current.remove(); touchCloneRef.current = null; }
  }, []);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const h = () => setMenuOpen(null);
    setTimeout(() => document.addEventListener('click', h), 0);
    return () => document.removeEventListener('click', h);
  }, [menuOpen]);

  // === Assignment logic ===
  const getAssignedRoomId = useCallback((name, lang) => {
    for (const r of videoRooms) if (r.participants.some(p => p.name === name && p.lang === lang)) return r.id;
    return null;
  }, [videoRooms]);

  const assignParticipant = useCallback(async ({ name, lang }, targetId) => {
    const curId = getAssignedRoomId(name, lang);
    if (curId === targetId || (!curId && targetId === 'pool')) return;
    if (curId) {
      const room = videoRooms.find(r => r.id === curId);
      if (room) {
        const nl = room.participants.filter(p => !(p.name === name && p.lang === lang));
        await set(ref(db, `chatRooms/${roomCode}/videoRooms/${curId}/participants`), nl.length ? nl : []);
      }
    }
    if (targetId !== 'pool') {
      const tr = videoRooms.find(r => r.id === targetId);
      if (tr) await set(ref(db, `chatRooms/${roomCode}/videoRooms/${targetId}/participants`), [...tr.participants, { name, lang }]);
    }
  }, [videoRooms, roomCode, getAssignedRoomId]);

  // === Room CRUD ===
  const handleCreateRoom = async () => {
    playClickSound();
    const nums = videoRooms.map(r => { const m = r.name.match(/(\d+)/); return m ? +m[1] : 0; });
    await push(ref(db, `chatRooms/${roomCode}/videoRooms`), { name: `Raum ${Math.max(0, ...nums) + 1}`, status: 'stopped' });
  };

  const handleRoomAction = async (id, action) => {
    playClickSound(); setMenuOpen(null);
    const p = `chatRooms/${roomCode}/videoRooms/${id}`;
    if (action === 'start') await set(ref(db, p + '/status'), 'active');
    else if (action === 'stop') await set(ref(db, p + '/status'), 'stopped');
    else if (action === 'delete') await remove(ref(db, p));
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

  // === Render helpers ===
  const assignedKeys = new Set();
  videoRooms.forEach(r => r.participants.forEach(p => assignedKeys.add(p.name + '|' + p.lang)));

  const renderCard = (p, key, grayed) => (
    <div
      key={key}
      draggable={!grayed}
      onDragStart={grayed ? undefined : e => onDragStart(e, p)}
      onDragEnd={grayed ? undefined : onDragEnd}
      onTouchStart={grayed ? undefined : e => onTouchStart(e, p)}
      onTouchMove={grayed ? undefined : onTouchMove}
      onTouchEnd={grayed ? undefined : onTouchEnd}
      style={{
        ...vs.card,
        background: grayed ? '#EEE' : (LANG_COLORS[p.lang] || '#F5F5F5'),
        opacity: grayed ? 0.35 : 1,
        cursor: grayed ? 'default' : 'grab',
        touchAction: grayed ? 'auto' : 'none',
        userSelect: 'none', WebkitUserSelect: 'none',
      }}
    >
      {LANG_COUNTRY_CODES[p.lang] ? <Flag code={LANG_COUNTRY_CODES[p.lang]} size={16} /> : null}
      <span style={vs.cardName}>{p.name}</span>
    </div>
  );

  const dropStyle = (id) => dragOverTarget === id ? vs.dropGlow : {};

  return (
    <div style={vs.wrap}>
      {/* Left — Participant Pool */}
      <div style={vs.leftCol}>
        <div style={vs.colHead}>
          <span style={{ ...vs.colTitle, color }}>Teilnehmer</span>
          <span style={vs.badge}>{participants.length}</span>
        </div>
        <div
          data-drop-id="pool"
          onDragOver={e => onDragOver(e, 'pool')}
          onDragLeave={e => onDragLeave(e, 'pool')}
          onDrop={e => onDrop(e, 'pool')}
          style={{ ...vs.pool, ...dropStyle('pool') }}
        >
          {participants.length === 0 && <p style={vs.empty}>Noch keine Teilnehmer</p>}
          {participants.filter(p => !assignedKeys.has(p.name + '|' + p.lang)).map(p => renderCard(p, `u-${p.id}`, false))}
          {participants.filter(p => assignedKeys.has(p.name + '|' + p.lang)).map(p => renderCard(p, `g-${p.id}`, true))}
        </div>
      </div>

      {/* Right — Video Rooms */}
      <div style={vs.rightCol}>
        <div style={vs.colHead}>
          <span style={{ ...vs.colTitle, color }}>Video-Räume</span>
          <button onClick={handleCreateRoom} style={{ ...vs.addBtn, background: color }}>+ Neuer Raum</button>
        </div>
        <div style={vs.roomsList}>
          {videoRooms.length === 0 && <p style={vs.empty}>Noch keine Video-Räume</p>}
          {videoRooms.map(room => (
            <div
              key={room.id}
              data-drop-id={room.id}
              onDragOver={e => onDragOver(e, room.id)}
              onDragLeave={e => onDragLeave(e, room.id)}
              onDrop={e => onDrop(e, room.id)}
              style={{
                ...vs.roomBox,
                borderColor: room.status === 'active' ? '#4CAF50' : '#CCC',
                borderStyle: room.status === 'active' ? 'solid' : 'dashed',
                ...dropStyle(room.id),
              }}
            >
              <div style={vs.roomHead}>
                <div style={{ flex: 1 }}>
                  <div style={vs.roomName}>{room.name}</div>
                  <span style={{ fontSize: 12, fontFamily: "'Fredoka', sans-serif", fontWeight: 600, color: room.status === 'active' ? '#4CAF50' : '#999' }}>
                    {room.status === 'active' ? '\u{1F7E2} Aktiv' : '\u{1F534} Gestoppt'}
                  </span>
                </div>
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={e => { e.stopPropagation(); setMenuOpen(menuOpen === room.id ? null : room.id); }}
                    style={vs.dots}
                  >
                    {'\u22EE'}
                  </button>
                  {menuOpen === room.id && (
                    <div style={vs.menu} onClick={e => e.stopPropagation()}>
                      {room.status !== 'active' ? (
                        <button onClick={() => handleRoomAction(room.id, 'start')} style={vs.menuItem}>
                          {'\u{1F7E2}'} Starten
                        </button>
                      ) : (
                        <button onClick={() => handleRoomAction(room.id, 'stop')} style={vs.menuItem}>
                          {'\u{1F534}'} Stoppen
                        </button>
                      )}
                      <button
                        onClick={() => {
                          const rn = `projektwoche-${roomCode}-${room.id}`;
                          window.open(`https://jitsi.modular.im/${rn}#config.prejoinPageEnabled=false&config.disableDeepLinking=true&userInfo.displayName=Lehrer`, '_blank');
                          setMenuOpen(null);
                        }}
                        style={vs.menuItem}
                      >
                        {'\u{1F440}'} Vorschau
                      </button>
                      <button onClick={() => handleRoomAction(room.id, 'delete')} style={{ ...vs.menuItem, color: '#C62828' }}>
                        {'\u{1F5D1}\uFE0F'} Raum löschen
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div style={vs.roomCards}>
                {room.participants.length === 0 && <span style={vs.dropHint}>Teilnehmer hierher ziehen</span>}
                {room.participants.map((p, i) => renderCard(p, `${room.id}-${i}`, false))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const vs = {
  wrap: {
    flex: 1, display: 'flex', flexWrap: 'wrap', gap: 16,
    padding: '0 20px 20px', overflow: 'auto', minHeight: 0,
    WebkitOverflowScrolling: 'touch',
  },
  leftCol: {
    flex: '1 1 220px', display: 'flex', flexDirection: 'column',
    minHeight: 200, maxHeight: 'calc(85vh - 80px)',
  },
  rightCol: {
    flex: '1.5 1 300px', display: 'flex', flexDirection: 'column',
    minHeight: 200, maxHeight: 'calc(85vh - 80px)',
  },
  colHead: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 8, flexShrink: 0,
  },
  colTitle: { fontFamily: "'Lilita One', cursive", fontSize: 17 },
  badge: {
    fontFamily: "'Baloo 2', cursive", fontSize: 14, fontWeight: 700,
    background: '#F0F0F0', padding: '2px 10px', borderRadius: 12, color: '#666',
  },
  pool: {
    flex: 1, overflowY: 'auto', background: '#FAFAFA', borderRadius: 14,
    border: '2px dashed #DDD', padding: 10, display: 'flex', flexWrap: 'wrap',
    gap: 6, alignContent: 'flex-start', minHeight: 100,
    transition: 'border-color 0.2s, background 0.2s, box-shadow 0.2s',
  },
  card: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '6px 14px', borderRadius: 20,
    fontFamily: "'Fredoka', sans-serif", fontSize: 14, fontWeight: 600,
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)', transition: 'opacity 0.2s',
  },
  cardName: { color: '#333', whiteSpace: 'nowrap' },
  addBtn: {
    fontFamily: "'Fredoka', sans-serif", fontSize: 13, fontWeight: 700,
    color: 'white', border: 'none', borderRadius: 10, padding: '6px 14px', cursor: 'pointer',
  },
  roomsList: {
    flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column',
    gap: 10, minHeight: 100,
  },
  roomBox: {
    background: 'white', borderRadius: 14, border: '2px dashed #CCC', padding: 12,
    transition: 'border-color 0.2s, background 0.2s, box-shadow 0.2s',
  },
  roomHead: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8,
  },
  roomName: { fontFamily: "'Lilita One', cursive", fontSize: 16, color: '#333' },
  dots: {
    fontFamily: "'Fredoka', sans-serif", fontSize: 20, fontWeight: 700,
    background: 'rgba(0,0,0,0.04)', border: 'none', borderRadius: 8,
    padding: '2px 8px', cursor: 'pointer', color: '#666', lineHeight: 1,
  },
  menu: {
    position: 'absolute', right: 0, top: 32, background: 'white',
    borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
    overflow: 'hidden', zIndex: 100, minWidth: 160,
  },
  menuItem: {
    display: 'block', width: '100%', textAlign: 'left',
    fontFamily: "'Fredoka', sans-serif", fontSize: 14, fontWeight: 600,
    padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer', color: '#333',
  },
  roomCards: {
    display: 'flex', flexWrap: 'wrap', gap: 6, minHeight: 36, alignItems: 'center',
  },
  dropHint: {
    fontFamily: "'Fredoka', sans-serif", fontSize: 13, fontWeight: 500,
    color: '#BBB', fontStyle: 'italic',
  },
  dropGlow: {
    borderColor: '#4CAF50',
    background: 'rgba(200, 230, 201, 0.4)',
    boxShadow: '0 0 0 3px rgba(76,175,80,0.25)',
  },
  empty: {
    fontFamily: "'Fredoka', sans-serif", fontSize: 14, fontWeight: 500,
    color: '#BBB', textAlign: 'center', margin: '16px 0', width: '100%',
  },
};

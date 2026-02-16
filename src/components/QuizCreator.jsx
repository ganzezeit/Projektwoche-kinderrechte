import React, { useState, useRef, useEffect } from 'react';

const TIME_OPTIONS = [10, 15, 20, 30, 60];
const MC_COLORS = ['#E74C3C', '#2980B9', '#F1C40F', '#27AE60'];
const MC_SHAPES = ['\u25B2', '\u25CF', '\u25A0', '\u25C6'];
const MAX_SUBMISSIONS_OPTIONS = [1, 2, 3, 4, 5];

const TYPE_CONFIG = {
  mc:        { label: 'Multiple Choice', badge: 'MC',  badgeColor: '#2980B9', icon: '\u{1F534}\u{1F535}\u{1F7E2}\u{1F7E1}' },
  tf:        { label: 'Richtig/Falsch',  badge: 'W/F', badgeColor: '#8E44AD', icon: '\u2705\u274C' },
  open:      { label: 'Offene Antwort',  badge: 'OA',  badgeColor: '#E67E22', icon: '\u270F\uFE0F' },
  wordcloud: { label: 'Wortwolke',       badge: 'WW',  badgeColor: '#16A085', icon: '\u2601\uFE0F' },
  sorting:   { label: 'Sortieren',       badge: 'SO',  badgeColor: '#D35400', icon: '\u{1F522}' },
  slider:    { label: 'Sch\u00E4tzfrage', badge: 'SF', badgeColor: '#2C3E50', icon: '\u{1F4CA}' },
};

function emptyQuestion(type) {
  switch (type) {
    case 'tf': return { type: 'tf', text: '', options: ['Richtig', 'Falsch'], correctIndex: 0, timeLimit: 15, imageUrl: null };
    case 'open': return { type: 'open', text: '', acceptedAnswers: [], ignoreCase: true, timeLimit: 20, imageUrl: null };
    case 'wordcloud': return { type: 'wordcloud', text: '', maxSubmissions: 3, imageUrl: null };
    case 'sorting': return { type: 'sorting', text: '', items: ['', '', ''], timeLimit: 30, imageUrl: null };
    case 'slider': return { type: 'slider', text: '', min: 0, max: 100, correctValue: 50, unit: '', tolerance: 10, timeLimit: 20, imageUrl: null };
    default: return { type: 'mc', text: '', options: ['', '', '', ''], correctIndex: 0, timeLimit: 20, imageUrl: null };
  }
}

function cloneDraft(q) {
  const d = { ...q };
  if (d.options) d.options = [...d.options];
  if (d.acceptedAnswers) d.acceptedAnswers = [...d.acceptedAnswers];
  if (d.items) d.items = [...d.items];
  return d;
}

export default function QuizCreator({ quiz, onSave, onCancel, dayColor }) {
  const color = dayColor || '#FF6B35';
  const [title, setTitle] = useState(quiz?.title || '');
  const [questions, setQuestions] = useState(() => (quiz?.questions || []).map(q => ({ ...q })));
  const [editingIndex, setEditingIndex] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [error, setError] = useState('');
  const [showTypePicker, setShowTypePicker] = useState(false);

  // Photo upload state
  const [imageUploading, setImageUploading] = useState(false);
  const [imageProgress, setImageProgress] = useState(0);
  const fileInputRef = useRef(null);

  // Accepted answers text for open type
  const [acceptedText, setAcceptedText] = useState('');

  // Sync acceptedText when editing an open question
  useEffect(() => {
    if (editDraft?.type === 'open') {
      setAcceptedText((editDraft.acceptedAnswers || []).join(', '));
    }
  }, [editingIndex]);

  const startEdit = (idx) => {
    setEditDraft(cloneDraft(questions[idx]));
    setEditingIndex(idx);
    setError('');
    setShowTypePicker(false);
  };

  const startAdd = (type) => {
    const q = emptyQuestion(type);
    setQuestions(prev => [...prev, q]);
    setEditDraft(cloneDraft(q));
    setEditingIndex(questions.length);
    setError('');
    setShowTypePicker(false);
  };

  const saveQuestion = () => {
    if (!editDraft) return;
    if (!editDraft.text.trim()) {
      setError('Bitte Fragetext eingeben.');
      return;
    }
    if (editDraft.type === 'mc' && editDraft.options.some(o => !o.trim())) {
      setError('Bitte alle Antwortoptionen ausfüllen.');
      return;
    }
    if (editDraft.type === 'open') {
      // Parse accepted answers from text
      const parsed = acceptedText.split(',').map(s => s.trim()).filter(Boolean);
      if (parsed.length === 0) {
        setError('Mindestens eine erwartete Antwort eingeben.');
        return;
      }
      editDraft.acceptedAnswers = parsed;
    }
    if (editDraft.type === 'sorting') {
      const filled = editDraft.items.filter(i => i.trim());
      if (filled.length < 3) {
        setError('Mindestens 3 Elemente eingeben.');
        return;
      }
      editDraft.items = filled.map(i => i.trim());
    }
    if (editDraft.type === 'slider') {
      if (editDraft.min >= editDraft.max) { setError('Min muss kleiner als Max sein.'); return; }
      if (editDraft.correctValue < editDraft.min || editDraft.correctValue > editDraft.max) { setError('Richtige Antwort muss zwischen Min und Max liegen.'); return; }
      if (editDraft.tolerance <= 0) { setError('Toleranz muss gr\u00F6\u00DFer als 0 sein.'); return; }
    }
    const updated = [...questions];
    updated[editingIndex] = editDraft;
    setQuestions(updated);
    setEditingIndex(null);
    setEditDraft(null);
    setError('');
  };

  const cancelEdit = () => {
    if (editDraft && !editDraft.text.trim() && editingIndex === questions.length - 1) {
      const isNew = !quiz?.questions?.[editingIndex];
      if (isNew) setQuestions(prev => prev.slice(0, -1));
    }
    setEditingIndex(null);
    setEditDraft(null);
    setError('');
  };

  const deleteQuestion = (idx) => {
    setQuestions(prev => prev.filter((_, i) => i !== idx));
    if (editingIndex === idx) { setEditingIndex(null); setEditDraft(null); }
  };

  const moveQuestion = (idx, dir) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= questions.length) return;
    const updated = [...questions];
    [updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]];
    setQuestions(updated);
  };

  const handleSave = () => {
    if (!title.trim()) { setError('Bitte Quiz-Titel eingeben.'); return; }
    if (questions.length === 0) { setError('Mindestens eine Frage hinzufügen.'); return; }
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.text.trim()) { setError(`Frage ${i + 1} hat keinen Text.`); return; }
      if (q.type === 'mc' && q.options.some(o => !o.trim())) { setError(`Frage ${i + 1}: Alle Optionen ausfüllen.`); return; }
      if (q.type === 'open' && (!q.acceptedAnswers || q.acceptedAnswers.length === 0)) { setError(`Frage ${i + 1}: Erwartete Antworten fehlen.`); return; }
      if (q.type === 'sorting' && (!q.items || q.items.filter(i => i.trim()).length < 3)) { setError(`Frage ${i + 1}: Mindestens 3 Sortier-Elemente.`); return; }
      if (q.type === 'slider' && q.min >= q.max) { setError(`Frage ${i + 1}: Min/Max ungültig.`); return; }
    }
    onSave({ title: title.trim(), questions });
  };

  // Photo upload
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/') || !editDraft) return;
    setImageUploading(true);
    setImageProgress(0);
    try {
      const { compressImage, uploadQuizImage } = await import('../utils/imageUpload');
      const compressed = await compressImage(file);
      const { downloadURL } = await uploadQuizImage(compressed, (pct) => setImageProgress(pct));
      setEditDraft(prev => ({ ...prev, imageUrl: downloadURL }));
    } catch (err) {
      console.error('[QuizCreator] Image upload failed:', err);
      setError('Bild-Upload fehlgeschlagen.');
    } finally {
      setImageUploading(false);
      setImageProgress(0);
    }
  };

  const removeImage = () => {
    setEditDraft(prev => ({ ...prev, imageUrl: null }));
  };

  const tc = TYPE_CONFIG;

  return (
    <div style={s.container}>
      {/* Header */}
      <div style={s.header}>
        <button onClick={onCancel} style={s.backBtn}>{'\u2190'}</button>
        <h2 style={{ ...s.title, color }}>{quiz ? 'Quiz bearbeiten' : 'Neues Quiz'}</h2>
      </div>

      {/* Title */}
      <label style={s.label}>Quiz-Titel</label>
      <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z.B. Kinderrechte Quiz" style={s.input} />

      {/* Question list */}
      <div style={s.questionList}>
        {questions.map((q, i) => {
          const cfg = tc[q.type] || tc.mc;
          return (
            <div key={i} style={{ ...s.questionCard, border: editingIndex === i ? `2px solid ${color}` : '2px solid transparent' }}>
              <div style={s.questionCardHeader}>
                <span style={{ ...s.typeBadge, background: cfg.badgeColor }}>{cfg.badge}</span>
                <span style={s.questionText}>{q.text || '(Kein Text)'}</span>
                {q.imageUrl && <span style={s.imgIndicator}>{'\u{1F5BC}\uFE0F'}</span>}
                {q.timeLimit && <span style={s.timerBadge}>{q.timeLimit}s</span>}
              </div>
              <div style={s.questionActions}>
                <button onClick={() => moveQuestion(i, -1)} disabled={i === 0} style={s.smallBtn}>{'\u2191'}</button>
                <button onClick={() => moveQuestion(i, 1)} disabled={i === questions.length - 1} style={s.smallBtn}>{'\u2193'}</button>
                <button onClick={() => startEdit(i)} style={{ ...s.smallBtn, color: '#2980B9' }}>Bearbeiten</button>
                <button onClick={() => deleteQuestion(i)} style={{ ...s.smallBtn, color: '#E74C3C' }}>Löschen</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Question editor */}
      {editingIndex !== null && editDraft && (
        <div style={s.editorPanel}>
          <h3 style={s.editorTitle}>Frage {editingIndex + 1} — {tc[editDraft.type]?.label}</h3>

          {/* Question text */}
          <textarea
            value={editDraft.text}
            onChange={(e) => setEditDraft({ ...editDraft, text: e.target.value })}
            placeholder={editDraft.type === 'wordcloud' ? 'Frage / Impuls eingeben...' : 'Frage eingeben...'}
            rows={3}
            style={s.textarea}
          />

          {/* Photo upload */}
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} style={{ display: 'none' }} />
          {editDraft.imageUrl ? (
            <div style={s.imagePreviewBox}>
              <img src={editDraft.imageUrl} alt="Frage-Bild" style={s.imagePreview} />
              <button onClick={removeImage} style={s.imageRemoveBtn}>{'\u2715'}</button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={imageUploading}
              style={s.addImageBtn}
            >
              {imageUploading ? `Hochladen... ${imageProgress}%` : '\u{1F5BC}\uFE0F Bild hinzufügen'}
            </button>
          )}

          {/* MC options */}
          {editDraft.type === 'mc' && (
            <div style={s.optionsGrid}>
              {editDraft.options.map((opt, oi) => (
                <div key={oi} style={{
                  ...s.optionRow,
                  borderColor: editDraft.correctIndex === oi ? MC_COLORS[oi] : 'rgba(0,0,0,0.1)',
                  borderWidth: editDraft.correctIndex === oi ? 3 : 2,
                }}>
                  <span style={{ ...s.optionShape, color: MC_COLORS[oi] }}>{MC_SHAPES[oi]}</span>
                  <input
                    type="text" value={opt}
                    onChange={(e) => { const o = [...editDraft.options]; o[oi] = e.target.value; setEditDraft({ ...editDraft, options: o }); }}
                    placeholder={`Option ${oi + 1}`} style={s.optionInput}
                  />
                  <button onClick={() => setEditDraft({ ...editDraft, correctIndex: oi })} style={{
                    ...s.correctBtn,
                    background: editDraft.correctIndex === oi ? '#27AE60' : 'rgba(0,0,0,0.06)',
                    color: editDraft.correctIndex === oi ? 'white' : '#999',
                  }}>{editDraft.correctIndex === oi ? '\u2713' : '\u25CB'}</button>
                </div>
              ))}
            </div>
          )}

          {/* TF options */}
          {editDraft.type === 'tf' && (
            <div style={s.tfRow}>
              <button onClick={() => setEditDraft({ ...editDraft, correctIndex: 0 })} style={{
                ...s.tfBtn,
                background: editDraft.correctIndex === 0 ? '#27AE60' : 'rgba(39,174,96,0.1)',
                color: editDraft.correctIndex === 0 ? 'white' : '#27AE60',
                border: editDraft.correctIndex === 0 ? '3px solid #27AE60' : '2px solid rgba(39,174,96,0.3)',
              }}>Richtig {editDraft.correctIndex === 0 ? '\u2713' : ''}</button>
              <button onClick={() => setEditDraft({ ...editDraft, correctIndex: 1 })} style={{
                ...s.tfBtn,
                background: editDraft.correctIndex === 1 ? '#E74C3C' : 'rgba(231,76,60,0.1)',
                color: editDraft.correctIndex === 1 ? 'white' : '#E74C3C',
                border: editDraft.correctIndex === 1 ? '3px solid #E74C3C' : '2px solid rgba(231,76,60,0.3)',
              }}>Falsch {editDraft.correctIndex === 1 ? '\u2713' : ''}</button>
            </div>
          )}

          {/* Open answer options */}
          {editDraft.type === 'open' && (
            <>
              <label style={s.label}>Erwartete Antworten (kommagetrennt)</label>
              <input
                type="text" value={acceptedText}
                onChange={(e) => setAcceptedText(e.target.value)}
                placeholder="z.B. Bildung, Recht auf Bildung, Education"
                style={s.input}
              />
              <label style={{ ...s.label, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: 2 }}>
                <input
                  type="checkbox" checked={editDraft.ignoreCase !== false}
                  onChange={(e) => setEditDraft({ ...editDraft, ignoreCase: e.target.checked })}
                />
                <span>Groß-/Kleinschreibung ignorieren</span>
              </label>
            </>
          )}

          {/* Word cloud options */}
          {editDraft.type === 'wordcloud' && (
            <>
              <label style={s.label}>Max. Wörter pro Spieler</label>
              <div style={s.timerRow}>
                {MAX_SUBMISSIONS_OPTIONS.map(n => (
                  <button key={n} onClick={() => setEditDraft({ ...editDraft, maxSubmissions: n })} style={{
                    ...s.timerBtn,
                    background: editDraft.maxSubmissions === n ? '#16A085' : '#F0F0F0',
                    color: editDraft.maxSubmissions === n ? 'white' : '#555',
                  }}>{n}</button>
                ))}
              </div>
            </>
          )}

          {/* Sorting options */}
          {editDraft.type === 'sorting' && (
            <>
              <label style={s.label}>Elemente in der richtigen Reihenfolge eingeben:</label>
              <div style={s.sortingList}>
                {editDraft.items.map((item, idx) => (
                  <div key={idx} style={s.sortingRow}>
                    <span style={s.sortingNum}>{idx + 1}.</span>
                    <input
                      type="text" value={item}
                      onChange={(e) => { const items = [...editDraft.items]; items[idx] = e.target.value; setEditDraft({ ...editDraft, items }); }}
                      placeholder={`Element ${idx + 1}`}
                      style={s.sortingInput}
                    />
                    {editDraft.items.length > 3 && (
                      <button onClick={() => { const items = editDraft.items.filter((_, i) => i !== idx); setEditDraft({ ...editDraft, items }); }} style={s.sortingRemoveBtn}>{'\u2715'}</button>
                    )}
                  </div>
                ))}
              </div>
              {editDraft.items.length < 6 && (
                <button onClick={() => setEditDraft({ ...editDraft, items: [...editDraft.items, ''] })} style={s.sortingAddBtn}>+ Element hinzufügen</button>
              )}
              <div style={s.sortingHint}>Die Schüler sehen die Elemente in zufälliger Reihenfolge.</div>
            </>
          )}

          {/* Slider options */}
          {editDraft.type === 'slider' && (
            <>
              <div style={s.sliderGrid}>
                <div style={s.sliderField}>
                  <label style={s.label}>Min</label>
                  <input type="number" value={editDraft.min} onChange={(e) => setEditDraft({ ...editDraft, min: Number(e.target.value) })} style={s.sliderNumInput} />
                </div>
                <div style={s.sliderField}>
                  <label style={s.label}>Max</label>
                  <input type="number" value={editDraft.max} onChange={(e) => setEditDraft({ ...editDraft, max: Number(e.target.value) })} style={s.sliderNumInput} />
                </div>
                <div style={s.sliderField}>
                  <label style={s.label}>Richtige Antwort</label>
                  <input type="number" value={editDraft.correctValue} onChange={(e) => setEditDraft({ ...editDraft, correctValue: Number(e.target.value) })} style={s.sliderNumInput} />
                </div>
                <div style={s.sliderField}>
                  <label style={s.label}>Toleranz (±)</label>
                  <input type="number" value={editDraft.tolerance} onChange={(e) => setEditDraft({ ...editDraft, tolerance: Math.max(0, Number(e.target.value)) })} style={s.sliderNumInput} />
                </div>
              </div>
              <div style={s.sliderField}>
                <label style={s.label}>Einheit (optional)</label>
                <input type="text" value={editDraft.unit || ''} onChange={(e) => setEditDraft({ ...editDraft, unit: e.target.value })} placeholder="z.B. km, kg, Jahre, %" style={s.input} />
              </div>
              <div style={s.sortingHint}>Richtig: {editDraft.correctValue} ± {editDraft.tolerance}{editDraft.unit ? ` ${editDraft.unit}` : ''} (Bereich: {editDraft.min}–{editDraft.max})</div>
            </>
          )}

          {/* Timer (not for wordcloud) */}
          {editDraft.type !== 'wordcloud' && (
            <>
              <label style={s.label}>Zeitlimit</label>
              <div style={s.timerRow}>
                {TIME_OPTIONS.map(t => (
                  <button key={t} onClick={() => setEditDraft({ ...editDraft, timeLimit: t })} style={{
                    ...s.timerBtn,
                    background: editDraft.timeLimit === t ? color : '#F0F0F0',
                    color: editDraft.timeLimit === t ? 'white' : '#555',
                  }}>{t}s</button>
                ))}
              </div>
            </>
          )}

          {/* Save / Cancel */}
          <div style={s.editorActions}>
            <button onClick={saveQuestion} disabled={imageUploading} style={{ ...s.saveQuestionBtn, background: color }}>Frage speichern</button>
            <button onClick={cancelEdit} style={s.cancelQuestionBtn}>Abbrechen</button>
          </div>
        </div>
      )}

      {/* Add question — type picker */}
      {editingIndex === null && !showTypePicker && (
        <button onClick={() => setShowTypePicker(true)} style={{ ...s.addBtnMain, borderColor: color, color }}>
          + Frage hinzufügen
        </button>
      )}

      {editingIndex === null && showTypePicker && (
        <div style={s.typePicker}>
          {Object.entries(tc).map(([type, cfg]) => (
            <button key={type} onClick={() => startAdd(type)} style={{ ...s.typePickerBtn, borderColor: cfg.badgeColor }}>
              <span style={s.typePickerIcon}>{cfg.icon}</span>
              <span style={{ ...s.typePickerLabel, color: cfg.badgeColor }}>{cfg.label}</span>
            </button>
          ))}
          <button onClick={() => setShowTypePicker(false)} style={s.typePickerCancel}>Abbrechen</button>
        </div>
      )}

      {/* Error */}
      {error && <div style={s.error}>{error}</div>}

      {/* Footer */}
      <div style={s.footer}>
        <span style={s.questionCount}>{questions.length} Frage{questions.length !== 1 ? 'n' : ''}</span>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={handleSave} style={{ ...s.saveBtn, background: color }}>Quiz speichern</button>
          <button onClick={onCancel} style={s.cancelBtn}>Abbrechen</button>
        </div>
      </div>
    </div>
  );
}

const s = {
  container: { display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '85vh', overflowY: 'auto', padding: '4px 0' },
  header: { display: 'flex', alignItems: 'center', gap: 10 },
  backBtn: { fontFamily: "'Fredoka', sans-serif", fontSize: 20, fontWeight: 700, padding: '4px 10px', background: 'rgba(0,0,0,0.06)', border: 'none', borderRadius: 10, cursor: 'pointer', color: '#555', lineHeight: 1 },
  title: { fontFamily: "'Lilita One', cursive", fontSize: 22, margin: 0 },
  label: { fontFamily: "'Fredoka', sans-serif", fontSize: 14, fontWeight: 600, color: '#777', marginTop: 4 },
  input: { fontFamily: "'Fredoka', sans-serif", fontSize: 16, fontWeight: 500, padding: '10px 14px', border: '2px solid rgba(0,0,0,0.1)', borderRadius: 12, outline: 'none', background: '#FAFAFA' },
  questionList: { display: 'flex', flexDirection: 'column', gap: 8 },
  questionCard: { background: '#F8F8F8', borderRadius: 12, padding: '10px 14px', borderStyle: 'solid' },
  questionCardHeader: { display: 'flex', alignItems: 'center', gap: 8 },
  typeBadge: { fontFamily: "'Fredoka', sans-serif", fontSize: 11, fontWeight: 700, color: 'white', padding: '2px 8px', borderRadius: 6, flexShrink: 0 },
  questionText: { fontFamily: "'Fredoka', sans-serif", fontSize: 14, fontWeight: 600, color: '#333', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  imgIndicator: { fontSize: 14, flexShrink: 0 },
  timerBadge: { fontFamily: "'Baloo 2', cursive", fontSize: 13, fontWeight: 700, color: '#999', flexShrink: 0 },
  questionActions: { display: 'flex', gap: 6, marginTop: 6 },
  smallBtn: { fontFamily: "'Fredoka', sans-serif", fontSize: 12, fontWeight: 600, padding: '4px 8px', background: 'rgba(0,0,0,0.04)', border: 'none', borderRadius: 6, cursor: 'pointer', color: '#555' },
  editorPanel: { background: 'white', border: '2px solid rgba(0,0,0,0.08)', borderRadius: 14, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 },
  editorTitle: { fontFamily: "'Lilita One', cursive", fontSize: 18, color: '#333', margin: 0 },
  textarea: { fontFamily: "'Fredoka', sans-serif", fontSize: 16, fontWeight: 500, padding: '10px 14px', border: '2px solid rgba(0,0,0,0.1)', borderRadius: 12, outline: 'none', background: '#FAFAFA', resize: 'vertical', minHeight: 60 },
  // Photo upload
  addImageBtn: { fontFamily: "'Fredoka', sans-serif", fontSize: 14, fontWeight: 600, padding: '10px 16px', background: 'rgba(0,0,0,0.04)', color: '#777', border: '2px dashed rgba(0,0,0,0.12)', borderRadius: 10, cursor: 'pointer', textAlign: 'center' },
  imagePreviewBox: { position: 'relative', borderRadius: 10, overflow: 'hidden', border: '2px solid rgba(0,0,0,0.08)' },
  imagePreview: { width: '100%', maxHeight: 200, objectFit: 'cover', display: 'block', borderRadius: 8 },
  imageRemoveBtn: { position: 'absolute', top: 6, right: 6, width: 28, height: 28, background: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', borderRadius: '50%', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  // MC
  optionsGrid: { display: 'flex', flexDirection: 'column', gap: 8 },
  optionRow: { display: 'flex', alignItems: 'center', gap: 8, borderStyle: 'solid', borderRadius: 10, padding: '6px 10px', background: '#FAFAFA' },
  optionShape: { fontSize: 20, flexShrink: 0, width: 24, textAlign: 'center' },
  optionInput: { flex: 1, fontFamily: "'Fredoka', sans-serif", fontSize: 15, fontWeight: 500, padding: '6px 10px', border: 'none', outline: 'none', background: 'transparent' },
  correctBtn: { width: 32, height: 32, borderRadius: 16, border: 'none', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 700 },
  // TF
  tfRow: { display: 'flex', gap: 12 },
  tfBtn: { flex: 1, fontFamily: "'Lilita One', cursive", fontSize: 18, padding: '14px 16px', borderRadius: 12, cursor: 'pointer', textAlign: 'center' },
  // Timer
  timerRow: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  timerBtn: { fontFamily: "'Baloo 2', cursive", fontSize: 16, fontWeight: 700, width: 48, height: 40, border: 'none', borderRadius: 10, cursor: 'pointer' },
  // Editor actions
  editorActions: { display: 'flex', gap: 10, marginTop: 4 },
  saveQuestionBtn: { flex: 1, fontFamily: "'Lilita One', cursive", fontSize: 16, padding: '10px 20px', color: 'white', border: 'none', borderRadius: 12, cursor: 'pointer' },
  cancelQuestionBtn: { fontFamily: "'Fredoka', sans-serif", fontSize: 14, fontWeight: 600, padding: '10px 16px', background: 'rgba(0,0,0,0.06)', color: '#666', border: 'none', borderRadius: 12, cursor: 'pointer' },
  // Add question
  addBtnMain: { fontFamily: "'Fredoka', sans-serif", fontSize: 16, fontWeight: 700, padding: '14px 16px', background: 'transparent', borderWidth: 2, borderStyle: 'dashed', borderRadius: 12, cursor: 'pointer', textAlign: 'center' },
  // Type picker
  typePicker: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  typePickerBtn: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '14px 10px', background: 'white', borderWidth: 2, borderStyle: 'solid', borderRadius: 12, cursor: 'pointer' },
  typePickerIcon: { fontSize: 20 },
  typePickerLabel: { fontFamily: "'Fredoka', sans-serif", fontSize: 13, fontWeight: 700 },
  typePickerCancel: { gridColumn: '1 / -1', fontFamily: "'Fredoka', sans-serif", fontSize: 14, fontWeight: 600, padding: '8px 16px', background: 'rgba(0,0,0,0.04)', color: '#999', border: 'none', borderRadius: 10, cursor: 'pointer' },
  // Sorting
  sortingList: { display: 'flex', flexDirection: 'column', gap: 6 },
  sortingRow: { display: 'flex', alignItems: 'center', gap: 8 },
  sortingNum: { fontFamily: "'Baloo 2', cursive", fontSize: 18, fontWeight: 700, color: '#D35400', width: 24, textAlign: 'center', flexShrink: 0 },
  sortingInput: { flex: 1, fontFamily: "'Fredoka', sans-serif", fontSize: 15, fontWeight: 500, padding: '8px 12px', border: '2px solid rgba(0,0,0,0.1)', borderRadius: 10, outline: 'none', background: '#FAFAFA' },
  sortingRemoveBtn: { width: 28, height: 28, background: 'rgba(231,76,60,0.1)', color: '#E74C3C', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700, flexShrink: 0 },
  sortingAddBtn: { fontFamily: "'Fredoka', sans-serif", fontSize: 14, fontWeight: 600, padding: '8px 14px', background: 'rgba(211,84,0,0.08)', color: '#D35400', border: '2px dashed rgba(211,84,0,0.3)', borderRadius: 10, cursor: 'pointer', textAlign: 'center' },
  sortingHint: { fontFamily: "'Fredoka', sans-serif", fontSize: 12, fontWeight: 500, color: '#999', fontStyle: 'italic', textAlign: 'center' },
  // Slider
  sliderGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  sliderField: { display: 'flex', flexDirection: 'column', gap: 4 },
  sliderNumInput: { fontFamily: "'Baloo 2', cursive", fontSize: 18, fontWeight: 700, padding: '8px 12px', border: '2px solid rgba(0,0,0,0.1)', borderRadius: 10, outline: 'none', background: '#FAFAFA', textAlign: 'center' },
  // Error / Footer
  error: { fontFamily: "'Fredoka', sans-serif", fontSize: 14, fontWeight: 600, color: '#E74C3C', textAlign: 'center', padding: '8px 12px', background: '#FFF3F0', borderRadius: 10 },
  footer: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, paddingTop: 12, borderTop: '1px solid rgba(0,0,0,0.08)' },
  questionCount: { fontFamily: "'Fredoka', sans-serif", fontSize: 14, fontWeight: 600, color: '#999' },
  saveBtn: { fontFamily: "'Lilita One', cursive", fontSize: 17, padding: '10px 24px', color: 'white', border: 'none', borderRadius: 14, cursor: 'pointer' },
  cancelBtn: { fontFamily: "'Fredoka', sans-serif", fontSize: 15, fontWeight: 600, padding: '10px 18px', background: 'rgba(0,0,0,0.06)', color: '#666', border: 'none', borderRadius: 14, cursor: 'pointer' },
};

import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useProject } from '../contexts/ProjectContext';

function CreateProjectModal({ onClose, onCreate }) {
  const [name, setName] = useState('');
  const [className, setClassName] = useState('');
  const [studentCount, setStudentCount] = useState('');
  const [startDate, setStartDate] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !className.trim()) return;
    setSaving(true);
    try {
      await onCreate({
        name: name.trim(),
        className: className.trim(),
        studentCount: parseInt(studentCount) || 0,
        startDate,
      });
      onClose();
    } catch {
      setSaving(false);
    }
  };

  return (
    <div style={styles.modalOverlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={styles.modal}>
        <h3 style={styles.modalTitle}>Neues Projekt erstellen</h3>
        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>Projektname *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="z.B. Kinderrechte Woche"
            style={styles.input}
            autoFocus
          />
          <label style={styles.label}>Klasse *</label>
          <input
            value={className}
            onChange={(e) => setClassName(e.target.value)}
            placeholder="z.B. 6a"
            style={styles.input}
          />
          <label style={styles.label}>Anzahl Kinder</label>
          <input
            type="number"
            value={studentCount}
            onChange={(e) => setStudentCount(e.target.value)}
            placeholder="z.B. 25"
            style={styles.input}
            min="0"
          />
          <label style={styles.label}>Startdatum</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={styles.input}
          />
          <div style={styles.modalActions}>
            <button type="button" onClick={onClose} style={styles.cancelButton}>
              Abbrechen
            </button>
            <button
              type="submit"
              style={{ ...styles.submitButton, opacity: saving ? 0.7 : 1 }}
              disabled={saving || !name.trim() || !className.trim()}
            >
              {saving ? 'Wird erstellt...' : 'Erstellen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteConfirmModal({ project, onClose, onConfirm }) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    await onConfirm(project.id);
    onClose();
  };

  return (
    <div style={styles.modalOverlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={styles.modal}>
        <h3 style={{ ...styles.modalTitle, color: '#D32F2F' }}>Projekt loeschen?</h3>
        <p style={styles.deleteText}>
          Moechtest du <strong>{project.name}</strong> (Klasse {project.className}) wirklich loeschen?
          Diese Aktion kann nicht rueckgaengig gemacht werden.
        </p>
        <div style={styles.modalActions}>
          <button onClick={onClose} style={styles.cancelButton}>Abbrechen</button>
          <button
            onClick={handleDelete}
            style={{ ...styles.submitButton, background: 'linear-gradient(135deg, #D32F2F 0%, #E57373 100%)' }}
            disabled={deleting}
          >
            {deleting ? 'Wird geloescht...' : 'Ja, loeschen'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const { projects, selectProject, createProject, deleteProject, loading } = useProject();
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const displayName = user?.displayName || user?.email?.split('@')[0] || 'Lehrer';

  const handleLogout = async () => {
    try { await logout(); } catch {}
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch { return dateStr; }
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 20, color: '#8B5A2B' }}>
          Laden...
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <h1 style={styles.greeting}>Willkommen, {displayName}!</h1>
            <p style={styles.subGreeting}>Projektwoche: Kinderrechte</p>
          </div>
          <button onClick={handleLogout} style={styles.logoutButton}>
            Abmelden
          </button>
        </div>

        {/* Projects */}
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>Meine Projekte</h2>
            <button onClick={() => setShowCreate(true)} style={styles.newButton}>
              + Neues Projekt
            </button>
          </div>

          {projects.length === 0 ? (
            <div style={styles.empty}>
              <span style={{ fontSize: 48 }}>{'\u{1F4DA}'}</span>
              <p style={styles.emptyText}>Noch keine Projekte vorhanden.</p>
              <p style={styles.emptyHint}>Erstelle dein erstes Projekt, um loszulegen!</p>
            </div>
          ) : (
            <div style={styles.grid}>
              {projects.map((proj) => (
                <div key={proj.id} style={styles.projectCard}>
                  <div style={styles.cardTop}>
                    <div style={styles.cardInfo}>
                      <h3 style={styles.cardName}>{proj.name}</h3>
                      <span style={styles.classBadge}>Klasse {proj.className}</span>
                    </div>
                    <div style={{
                      ...styles.statusBadge,
                      background: proj.status === 'active' ? '#E8F5E9' : '#F5F5F5',
                      color: proj.status === 'active' ? '#2E7D32' : '#999',
                    }}>
                      {proj.status === 'active' ? 'Aktiv' : 'Inaktiv'}
                    </div>
                  </div>

                  <div style={styles.cardMeta}>
                    {proj.studentCount > 0 && (
                      <span style={styles.metaItem}>{proj.studentCount} Kinder</span>
                    )}
                    {proj.startDate && (
                      <span style={styles.metaItem}>Start: {formatDate(proj.startDate)}</span>
                    )}
                  </div>

                  <div style={styles.cardActions}>
                    <button
                      onClick={() => selectProject(proj.id)}
                      style={styles.startButton}
                    >
                      Projekt starten
                    </button>
                    <button
                      onClick={() => setDeleteTarget(proj)}
                      style={styles.deleteButton}
                      title="Projekt loeschen"
                    >
                      {'\u{1F5D1}\uFE0F'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showCreate && (
        <CreateProjectModal
          onClose={() => setShowCreate(false)}
          onCreate={createProject}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmModal
          project={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={deleteProject}
        />
      )}
    </div>
  );
}

const styles = {
  container: {
    width: '100%',
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    background: 'linear-gradient(160deg, #FFE5D9 0%, #D4E4F7 100%)',
    padding: '40px 20px',
    boxSizing: 'border-box',
  },
  content: {
    maxWidth: 800,
    width: '100%',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 32,
  },
  greeting: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 32,
    color: '#8B5A2B',
    margin: 0,
  },
  subGreeting: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 16,
    color: '#999',
    margin: '4px 0 0',
    fontWeight: 500,
  },
  logoutButton: {
    padding: '10px 20px',
    border: '2px solid #E0D6CC',
    borderRadius: 14,
    background: '#fff',
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 14,
    fontWeight: 600,
    color: '#8B5A2B',
    cursor: 'pointer',
  },
  section: {},
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 20,
    fontWeight: 700,
    color: '#555',
    margin: 0,
  },
  newButton: {
    padding: '10px 20px',
    border: 'none',
    borderRadius: 14,
    background: 'linear-gradient(135deg, #FF6B35 0%, #FF8F5E 100%)',
    color: '#fff',
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(255, 107, 53, 0.3)',
  },
  empty: {
    textAlign: 'center',
    padding: '48px 20px',
    background: '#fff',
    borderRadius: 20,
    boxShadow: '0 4px 16px rgba(139, 90, 43, 0.06)',
  },
  emptyText: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 18,
    color: '#555',
    margin: '12px 0 4px',
    fontWeight: 600,
  },
  emptyHint: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 14,
    color: '#999',
    margin: 0,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(340, 1fr))',
    gap: 16,
  },
  projectCard: {
    background: '#fff',
    borderRadius: 20,
    padding: '20px 24px',
    boxShadow: '0 4px 16px rgba(139, 90, 43, 0.08)',
    border: '1px solid rgba(255, 166, 107, 0.12)',
  },
  cardTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cardInfo: {
    flex: 1,
  },
  cardName: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 18,
    fontWeight: 700,
    color: '#333',
    margin: '0 0 6px',
  },
  classBadge: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 13,
    fontWeight: 700,
    color: '#FF6B35',
    background: 'rgba(255, 107, 53, 0.1)',
    padding: '3px 10px',
    borderRadius: 10,
    border: '1.5px solid rgba(255, 107, 53, 0.25)',
  },
  statusBadge: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 12,
    fontWeight: 700,
    padding: '4px 10px',
    borderRadius: 8,
  },
  cardMeta: {
    display: 'flex',
    gap: 16,
    marginBottom: 16,
  },
  metaItem: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 13,
    color: '#999',
    fontWeight: 500,
  },
  cardActions: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  startButton: {
    flex: 1,
    padding: '12px 20px',
    border: 'none',
    borderRadius: 14,
    background: 'linear-gradient(135deg, #00B4D8 0%, #48CAE4 100%)',
    color: '#fff',
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(0, 180, 216, 0.25)',
  },
  deleteButton: {
    width: 44,
    height: 44,
    border: '2px solid #EEE',
    borderRadius: 12,
    background: '#fff',
    fontSize: 18,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Modals
  modalOverlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9000,
  },
  modal: {
    background: '#fff',
    borderRadius: 24,
    padding: '32px',
    maxWidth: 440,
    width: '90%',
    boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
  },
  modalTitle: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 24,
    color: '#8B5A2B',
    margin: '0 0 20px',
    textAlign: 'center',
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
  },
  modalActions: {
    display: 'flex',
    gap: 12,
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    padding: '12px',
    border: '2px solid #E0D6CC',
    borderRadius: 14,
    background: '#fff',
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 15,
    fontWeight: 600,
    color: '#666',
    cursor: 'pointer',
  },
  submitButton: {
    flex: 1,
    padding: '12px',
    border: 'none',
    borderRadius: 14,
    background: 'linear-gradient(135deg, #FF6B35 0%, #FF8F5E 100%)',
    color: '#fff',
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(255, 107, 53, 0.3)',
  },
  deleteText: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 15,
    color: '#555',
    lineHeight: 1.5,
    marginBottom: 0,
  },
};

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ref, onValue, push, set, remove, serverTimestamp } from 'firebase/database';
import { db } from '../firebase';
import { useAuth } from './AuthContext';

const PROJECT_STORAGE_KEY = 'weltverbinder-project';

const ProjectContext = createContext(null);

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProject must be used within ProjectProvider');
  return ctx;
}

export function ProjectProvider({ children }) {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState(() => {
    try { return localStorage.getItem(PROJECT_STORAGE_KEY) || null; } catch { return null; }
  });
  const [loading, setLoading] = useState(true);

  // Subscribe to user's projects
  useEffect(() => {
    if (!user) {
      setProjects([]);
      setProjectId(null);
      setLoading(false);
      return;
    }

    const projectsRef = ref(db, `users/${user.uid}/projects`);
    const unsub = onValue(projectsRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setProjects([]);
      } else {
        const list = Object.entries(data).map(([id, val]) => ({ id, ...val }));
        list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setProjects(list);
      }
      setLoading(false);
    });

    return () => unsub();
  }, [user]);

  // Derive current project from projectId
  const project = projects.find(p => p.id === projectId) || null;

  // If stored projectId doesn't match any project, clear it
  useEffect(() => {
    if (!loading && projectId && projects.length > 0 && !project) {
      setProjectId(null);
      try { localStorage.removeItem(PROJECT_STORAGE_KEY); } catch {}
    }
  }, [loading, projectId, projects, project]);

  const selectProject = useCallback((id) => {
    setProjectId(id);
    try { localStorage.setItem(PROJECT_STORAGE_KEY, id); } catch {}
  }, []);

  const clearProject = useCallback(() => {
    setProjectId(null);
    try { localStorage.removeItem(PROJECT_STORAGE_KEY); } catch {}
  }, []);

  const createProject = useCallback(async ({ name, className, studentCount, startDate }) => {
    if (!user) return null;
    const projectsRef = ref(db, `users/${user.uid}/projects`);
    const newRef = push(projectsRef);
    const data = {
      name: name || 'Neues Projekt',
      className: className || '',
      studentCount: studentCount || 0,
      startDate: startDate || '',
      status: 'active',
      createdAt: Date.now(),
    };
    await set(newRef, data);
    return newRef.key;
  }, [user]);

  const deleteProject = useCallback(async (id) => {
    if (!user) return;
    await remove(ref(db, `users/${user.uid}/projects/${id}`));
    if (projectId === id) {
      clearProject();
    }
  }, [user, projectId, clearProject]);

  const updateProject = useCallback(async (id, updates) => {
    if (!user) return;
    const projectRef = ref(db, `users/${user.uid}/projects/${id}`);
    // Merge: read current then set updated fields
    const snapshot = await import('firebase/database').then(m => m.get(projectRef));
    const current = snapshot.val() || {};
    await set(projectRef, { ...current, ...updates });
  }, [user]);

  return (
    <ProjectContext.Provider value={{
      project,
      projects,
      projectId,
      loading,
      selectProject,
      clearProject,
      createProject,
      deleteProject,
      updateProject,
    }}>
      {children}
    </ProjectContext.Provider>
  );
}

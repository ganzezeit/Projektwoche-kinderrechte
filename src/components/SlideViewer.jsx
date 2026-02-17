import React, { useState, useEffect, useRef, useCallback } from 'react';
import { playClickSound, playSuccessSound } from '../utils/audio';
import * as pdfjsLib from 'pdfjs-dist';

// Configure worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

export default function SlideViewer({ step, dayColor, onComplete }) {
  const { content } = step;
  const slideCount = content.slideCount || 10;
  const [currentPage, setCurrentPage] = useState(1);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef(null);
  const renderTaskRef = useRef(null);
  const containerRef = useRef(null);

  // Load PDF document once
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    pdfjsLib.getDocument(`/slides/${content.slides}`).promise.then(doc => {
      if (!cancelled) {
        setPdfDoc(doc);
        setLoading(false);
      }
    }).catch(err => {
      console.error('PDF load error:', err);
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [content.slides]);

  // Render current page to canvas
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;
    let cancelled = false;

    // Cancel any in-progress render
    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
      renderTaskRef.current = null;
    }

    pdfDoc.getPage(currentPage).then(page => {
      if (cancelled) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');

      // Fit to container
      const container = containerRef.current;
      const maxW = container ? container.clientWidth : window.innerWidth * 0.85;
      const maxH = container ? container.clientHeight : window.innerHeight * 0.8;

      const viewport = page.getViewport({ scale: 1 });
      const scaleW = maxW / viewport.width;
      const scaleH = maxH / viewport.height;
      const scale = Math.min(scaleW, scaleH) * (window.devicePixelRatio || 1);

      const scaledViewport = page.getViewport({ scale });
      canvas.width = scaledViewport.width;
      canvas.height = scaledViewport.height;
      // Set display size (CSS pixels)
      canvas.style.width = (scaledViewport.width / (window.devicePixelRatio || 1)) + 'px';
      canvas.style.height = (scaledViewport.height / (window.devicePixelRatio || 1)) + 'px';

      const task = page.render({ canvasContext: ctx, viewport: scaledViewport });
      renderTaskRef.current = task;
      task.promise.catch(() => {});
    }).catch(err => {
      if (!cancelled) console.error('Page render error:', err);
    });

    return () => { cancelled = true; };
  }, [pdfDoc, currentPage]);

  const handleDone = useCallback(() => { playSuccessSound(); onComplete(); }, [onComplete]);

  const nextPage = useCallback(() => {
    playClickSound();
    if (currentPage < slideCount) setCurrentPage(p => p + 1);
  }, [currentPage, slideCount]);

  const prevPage = useCallback(() => {
    playClickSound();
    if (currentPage > 1) setCurrentPage(p => p - 1);
  }, [currentPage]);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        if (currentPage < slideCount) setCurrentPage(p => p + 1);
        else handleDone();
      }
      if (e.key === 'ArrowLeft' && currentPage > 1) setCurrentPage(p => p - 1);
      if (e.key === 'Escape') handleDone();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [currentPage, slideCount, handleDone]);

  return (
    <div style={styles.container}>
      {/* Canvas area */}
      <div ref={containerRef} style={styles.canvasContainer}>
        {loading && (
          <div style={styles.loadingOverlay}>
            <div style={{ fontSize: 32, animation: 'pulse 1.5s ease-in-out infinite' }}>{'\u{1F4C4}'}</div>
            <span style={styles.loadingText}>Laden...</span>
          </div>
        )}
        <canvas ref={canvasRef} style={styles.canvas} />
      </div>

      {/* Bottom navigation bar */}
      <div style={styles.navBar}>
        <button
          onClick={prevPage}
          disabled={currentPage === 1}
          style={{
            ...styles.navBtn,
            background: currentPage === 1 ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.25)',
            cursor: currentPage === 1 ? 'default' : 'pointer',
          }}
        >
          {'\u2190'} Zurück
        </button>

        <span style={styles.counter}>{currentPage} / {slideCount}</span>

        {currentPage < slideCount ? (
          <button onClick={nextPage} style={{ ...styles.navBtn, background: dayColor || '#FF6B35' }}>
            Weiter {'\u2192'}
          </button>
        ) : (
          <button onClick={handleDone} style={{ ...styles.navBtn, background: '#27AE60' }}>
            Fertig {'\u2714'}
          </button>
        )}
      </div>

      {/* Left/Right click areas on screen sides */}
      <div onClick={prevPage} style={{
        ...styles.clickArea,
        left: 0,
        cursor: currentPage > 1 ? 'pointer' : 'default',
      }} />
      <div onClick={currentPage < slideCount ? nextPage : handleDone} style={{
        ...styles.clickArea,
        right: 0,
        cursor: 'pointer',
      }} />

      {/* Close button */}
      <button onClick={handleDone} style={styles.closeBtn}>{'\u2715'}</button>
    </div>
  );
}

const styles = {
  container: {
    position: 'fixed',
    top: 0, left: 0,
    width: '100vw',
    height: '100vh',
    background: '#1a1a1a',
    zIndex: 2000,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  canvasContainer: {
    width: '85vw',
    height: '80vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  canvas: {
    borderRadius: 12,
    background: 'white',
    maxWidth: '100%',
    maxHeight: '100%',
  },
  loadingOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    background: 'rgba(26, 26, 26, 0.8)',
    borderRadius: 12,
    zIndex: 2,
  },
  loadingText: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 16,
    fontWeight: 600,
    color: 'rgba(255,255,255,0.7)',
  },
  navBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 20,
    marginTop: 16,
  },
  navBtn: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 16,
    fontWeight: 600,
    padding: '10px 24px',
    border: 'none',
    borderRadius: 30,
    color: 'white',
    cursor: 'pointer',
  },
  counter: {
    fontFamily: "'Baloo 2', cursive",
    fontSize: 16,
    color: 'white',
    fontWeight: 700,
  },
  clickArea: {
    position: 'absolute',
    top: 0,
    width: '12%',
    height: '100%',
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    background: 'rgba(255,255,255,0.2)',
    border: 'none',
    borderRadius: '50%',
    width: 44,
    height: 44,
    fontSize: 20,
    color: 'white',
    cursor: 'pointer',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
    zIndex: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
};

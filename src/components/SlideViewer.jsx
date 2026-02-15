import React, { useState, useEffect, useRef, useCallback } from 'react';
import { playClickSound, playSuccessSound } from '../utils/audio';

export default function SlideViewer({ step, dayColor, onComplete }) {
  const { content } = step;
  const slideCount = content.slideCount || 10;
  const [currentPage, setCurrentPage] = useState(1);
  const iframeRef = useRef(null);

  // Update iframe page without full remount
  useEffect(() => {
    if (iframeRef.current) {
      try {
        iframeRef.current.contentWindow.location.replace(
          `/slides/${content.slides}#page=${currentPage}&toolbar=0&navpanes=0`
        );
      } catch {
        // Cross-origin fallback: set src directly
        iframeRef.current.src = `/slides/${content.slides}#page=${currentPage}&toolbar=0&navpanes=0`;
      }
    }
  }, [currentPage, content.slides]);

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
      {/* PDF page display */}
      <iframe
        ref={iframeRef}
        src={`/slides/${content.slides}#page=${currentPage}&toolbar=0&navpanes=0`}
        style={styles.iframe}
        title={`Slide ${currentPage}`}
      />

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
          {'\u2190'} Zur{'\u00fc'}ck
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
  iframe: {
    width: '85vw',
    height: '80vh',
    border: 'none',
    borderRadius: 12,
    background: 'white',
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

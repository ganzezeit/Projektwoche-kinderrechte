import React, { useState, useEffect, useRef, useCallback } from 'react';
import { LANDESKUNDE_SLIDES } from '../data/landeskunde';
import { playClickSound, playSuccessSound } from '../utils/audio';

export default function LandeskundeViewer({ mode, dayColor, onComplete }) {
  const [idx, setIdx] = useState(0);
  const slide = LANDESKUNDE_SLIDES[idx];
  const total = LANDESKUNDE_SLIDES.length;
  const isLast = idx === total - 1;

  // Track rendered image rect for accurate flag positioning
  const areaRef = useRef(null);
  const imgRef = useRef(null);
  const [imgRect, setImgRect] = useState(null);

  const computeImageRect = useCallback(() => {
    const area = areaRef.current;
    const img = imgRef.current;
    if (!area || !img || !img.naturalWidth) return;

    const containerW = area.clientWidth;
    const containerH = area.clientHeight;
    const imgRatio = img.naturalWidth / img.naturalHeight;
    const containerRatio = containerW / containerH;

    let renderW, renderH, offsetX, offsetY;
    if (imgRatio > containerRatio) {
      renderW = containerW;
      renderH = containerW / imgRatio;
      offsetX = 0;
      offsetY = (containerH - renderH) / 2;
    } else {
      renderH = containerH;
      renderW = containerH * imgRatio;
      offsetX = (containerW - renderW) / 2;
      offsetY = 0;
    }

    setImgRect({ offsetX, offsetY, renderW, renderH });
  }, []);

  // Recompute on resize
  useEffect(() => {
    window.addEventListener('resize', computeImageRect);
    return () => window.removeEventListener('resize', computeImageRect);
  }, [computeImageRect]);

  // Recompute when slide changes
  useEffect(() => { setImgRect(null); }, [idx]);

  const nextSlide = () => { playClickSound(); if (!isLast) setIdx(p => p + 1); };
  const prevSlide = () => { playClickSound(); if (idx > 0) setIdx(p => p - 1); };
  const handleDone = () => { playSuccessSound(); onComplete(); };

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); if (!isLast) setIdx(p => p + 1); else handleDone(); }
      if (e.key === 'ArrowLeft') { if (idx > 0) setIdx(p => p - 1); }
      if (e.key === 'Escape') handleDone();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [idx, isLast]);

  const isAnimatedMap = slide.type === 'animated-map';

  // Helper: position in pixels relative to the rendered image
  const flagStyle = (pctLeft, pctTop, delay) => {
    if (!imgRect) return { display: 'none' };
    return {
      ...styles.flag,
      left: imgRect.offsetX + (pctLeft / 100) * imgRect.renderW,
      top: imgRect.offsetY + (pctTop / 100) * imgRect.renderH,
      animationDelay: delay,
    };
  };

  const lineCoords = imgRect ? {
    x1: imgRect.offsetX + 0.43 * imgRect.renderW,
    y1: imgRect.offsetY + 0.18 * imgRect.renderH,
    x2: imgRect.offsetX + 0.51 * imgRect.renderW,
    y2: imgRect.offsetY + 0.57 * imgRect.renderH,
  } : null;

  const distPos = imgRect ? {
    left: imgRect.offsetX + 0.45 * imgRect.renderW,
    top: imgRect.offsetY + 0.36 * imgRect.renderH,
  } : null;

  return (
    <div style={styles.container}>
      {/* Image area */}
      {slide.image && (
        <div ref={areaRef} style={styles.imageArea} key={idx}>
          <img
            ref={imgRef}
            src={`/images/landeskunde/${slide.image}`}
            alt={slide.title}
            loading="lazy"
            style={styles.image}
            onLoad={computeImageRect}
            onError={(e) => { e.target.style.display = 'none'; }}
          />

          {/* Animated-map phase 2+: Flag overlays (positioned relative to image) */}
          {isAnimatedMap && slide.phase >= 2 && imgRect && (
            <>
              <div style={flagStyle(43, 18, '0s')}>
                {'\u{1F1E9}\u{1F1EA}'}
              </div>
              <div style={flagStyle(51, 57, '0.3s')}>
                {'\u{1F1F9}\u{1F1FF}'}
              </div>
            </>
          )}

          {/* Animated-map phase 3: Dashed line + distance */}
          {isAnimatedMap && slide.phase === 3 && lineCoords && (
            <>
              <svg style={styles.lineSvg}>
                <line
                  x1={lineCoords.x1} y1={lineCoords.y1}
                  x2={lineCoords.x2} y2={lineCoords.y2}
                  stroke="#FF6B35"
                  strokeWidth="3"
                  strokeDasharray="8 6"
                  style={{ animation: 'drawLine 1s ease forwards' }}
                />
              </svg>
              {distPos && (
                <div style={{
                  ...styles.distanceLabel,
                  left: distPos.left,
                  top: distPos.top,
                }}>
                  6.000 km {'\u2708\uFE0F'}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Text-only slides (no image) */}
      {!slide.image && (
        <div style={{ ...styles.textSlide, background: slide.background || 'linear-gradient(135deg, #5A2E0E 0%, #8B4513 40%, #A0522D 100%)' }} key={idx}>
          <h2 style={styles.textTitle}>{slide.title}</h2>
          <p style={styles.textBody}>
            {slide.highlights
              ? renderHighlights(slide.text, slide.highlights, dayColor)
              : slide.text}
          </p>
          {slide.question && (
            <p style={styles.textQuestion}>
              {'\u{1F4AC}'} {slide.question}
            </p>
          )}
        </div>
      )}

      {/* Bottom bar with title/text for image slides */}
      {slide.image && (
        <div style={styles.bottomBar}>
          <div style={{ flex: 1 }}>
            <h3 style={styles.barTitle}>{slide.title}</h3>
            <p style={styles.barText}>{slide.text}</p>
            {slide.question && (
              <p style={styles.barQuestion}>{'\u{1F4AC}'} {slide.question}</p>
            )}
          </div>
          <span style={styles.barCounter}>{idx + 1} / {total}</span>
        </div>
      )}

      {/* Navigation arrows on sides */}
      {idx > 0 && (
        <button onClick={prevSlide} style={{ ...styles.navArrow, left: 16 }}>
          {'\u2190'}
        </button>
      )}
      {!isLast ? (
        <button onClick={nextSlide} style={{ ...styles.navArrow, right: 16 }}>
          {'\u2192'}
        </button>
      ) : (
        <button onClick={handleDone} style={{ ...styles.navArrow, right: 16, background: 'rgba(0,196,140,0.6)' }}>
          {'\u2714'}
        </button>
      )}

      {/* Close button */}
      <button onClick={handleDone} style={styles.closeBtn}>{'\u2715'}</button>
    </div>
  );
}

function renderHighlights(text, highlights, dayColor) {
  if (!highlights || highlights.length === 0) return text;
  const parts = [];
  let remaining = text;
  while (remaining.length > 0) {
    let earliest = -1, matchedHL = null, matchIdx = -1;
    for (const hl of highlights) {
      const i = remaining.indexOf(hl);
      if (i !== -1 && (earliest === -1 || i < earliest)) {
        earliest = i; matchedHL = hl; matchIdx = i;
      }
    }
    if (matchIdx === -1) { parts.push(remaining); break; }
    if (matchIdx > 0) parts.push(remaining.substring(0, matchIdx));
    parts.push(<span key={parts.length} style={{ fontWeight: 700, color: '#FFD93D', textShadow: '0 1px 4px rgba(0,0,0,0.3)' }}>{matchedHL}</span>);
    remaining = remaining.substring(matchIdx + matchedHL.length);
  }
  return parts;
}

const styles = {
  container: {
    position: 'fixed',
    top: 0, left: 0,
    width: '100vw',
    height: '100vh',
    background: '#000',
    zIndex: 2000,
    display: 'flex',
    flexDirection: 'column',
  },
  imageArea: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    objectPosition: 'center',
  },
  flag: {
    position: 'absolute',
    fontSize: 36,
    animation: 'popIn 0.5s ease both',
    filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
    transform: 'translate(-50%, -50%)',
    zIndex: 2,
  },
  lineSvg: {
    position: 'absolute',
    top: 0, left: 0,
    width: '100%', height: '100%',
    pointerEvents: 'none',
    zIndex: 1,
  },
  distanceLabel: {
    position: 'absolute',
    transform: 'translate(-50%, -50%)',
    background: 'rgba(255,107,53,0.9)',
    color: 'white',
    padding: '8px 20px',
    borderRadius: 30,
    fontSize: 22,
    fontWeight: 700,
    fontFamily: "'Lilita One', cursive",
    animation: 'tooltipFadeIn 0.5s ease 0.8s both',
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
    zIndex: 3,
  },
  textSlide: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    color: 'white',
  },
  textTitle: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 36,
    marginBottom: 20,
    textAlign: 'center',
    color: '#FFD93D',
    textShadow: '0 2px 8px rgba(0,0,0,0.3)',
  },
  textBody: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 24,
    textAlign: 'center',
    maxWidth: 700,
    lineHeight: 1.6,
    fontWeight: 500,
  },
  textQuestion: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 20,
    marginTop: 20,
    color: '#FFD93D',
    fontStyle: 'italic',
    fontWeight: 500,
  },
  bottomBar: {
    background: 'rgba(0,0,0,0.75)',
    color: 'white',
    padding: '16px 24px',
    display: 'flex',
    alignItems: 'center',
    gap: 20,
  },
  barTitle: {
    fontFamily: "'Lilita One', cursive",
    fontSize: 22,
    margin: 0,
    color: '#FFD93D',
  },
  barText: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 16,
    margin: '4px 0 0',
    opacity: 0.9,
    fontWeight: 500,
  },
  barQuestion: {
    fontFamily: "'Fredoka', sans-serif",
    fontSize: 16,
    color: '#FF9A56',
    marginTop: 4,
    fontWeight: 600,
  },
  barCounter: {
    fontFamily: "'Baloo 2', cursive",
    fontSize: 16,
    opacity: 0.8,
    fontWeight: 700,
    whiteSpace: 'nowrap',
  },
  navArrow: {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'rgba(255,255,255,0.2)',
    border: 'none',
    borderRadius: '50%',
    width: 56,
    height: 56,
    fontSize: 24,
    color: 'white',
    cursor: 'pointer',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
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

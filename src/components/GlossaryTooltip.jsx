import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { GLOSSARY } from '../data/glossary';

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const glossaryMap = {};
GLOSSARY.forEach((entry) => {
  glossaryMap[entry.term.toLowerCase()] = entry;
});

// Split terms: short terms (≤2 chars) are case-sensitive, longer terms case-insensitive
// Both use \b word boundaries to prevent matching inside other words
const shortTerms = GLOSSARY.filter(g => g.term.length <= 2).map(g => escapeRegex(g.term));
const longTerms = GLOSSARY.filter(g => g.term.length > 2).map(g => escapeRegex(g.term));

// Sort longest first so "Gleichberechtigung" matches before "Gleich"
longTerms.sort((a, b) => b.length - a.length);
shortTerms.sort((a, b) => b.length - a.length);

const shortRegex = shortTerms.length > 0 ? new RegExp(`\\b(${shortTerms.join('|')})\\b`, 'g') : null;
const longRegex = longTerms.length > 0 ? new RegExp(`\\b(${longTerms.join('|')})\\b`, 'gi') : null;

export default function GlossaryTooltip({ text }) {
  const [tooltip, setTooltip] = useState(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const tooltipRef = useRef(null);
  const targetRef = useRef(null);

  // Position tooltip after it renders, using the actual tooltip height
  useLayoutEffect(() => {
    if (!tooltip || !targetRef.current) return;

    const rect = targetRef.current.getBoundingClientRect();
    const tooltipEl = tooltipRef.current;
    const tooltipHeight = tooltipEl ? tooltipEl.offsetHeight : 120;
    const tooltipWidth = 300;

    // Center horizontally on the word
    let left = rect.left + (rect.width / 2) - (tooltipWidth / 2);
    left = Math.max(12, Math.min(left, window.innerWidth - tooltipWidth - 12));

    // Prefer above the word, fall back to below
    let top;
    if (rect.top > tooltipHeight + 12) {
      top = rect.top - tooltipHeight - 8;
    } else {
      top = rect.bottom + 8;
    }
    // Clamp vertically
    top = Math.max(8, Math.min(top, window.innerHeight - tooltipHeight - 8));

    setPos({ top, left });
  }, [tooltip]);

  // Close tooltip on any outside click (use capture to beat stopPropagation)
  useEffect(() => {
    if (!tooltip) return;
    const handleClick = (e) => {
      // Don't close if clicking inside the tooltip itself
      if (tooltipRef.current && tooltipRef.current.contains(e.target)) return;
      setTooltip(null);
      targetRef.current = null;
    };
    // Use setTimeout so the current click event finishes before we listen
    const timer = setTimeout(() => {
      document.addEventListener('click', handleClick, true);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClick, true);
    };
  }, [tooltip]);

  if (!text) return null;

  // Split text using both regexes, collecting matches with positions
  const matches = [];
  if (longRegex) {
    longRegex.lastIndex = 0;
    let m;
    while ((m = longRegex.exec(text)) !== null) {
      matches.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
    }
  }
  if (shortRegex) {
    shortRegex.lastIndex = 0;
    let m;
    while ((m = shortRegex.exec(text)) !== null) {
      const overlaps = matches.some(x => m.index < x.end && m.index + m[0].length > x.start);
      if (!overlaps) {
        matches.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
      }
    }
  }
  matches.sort((a, b) => a.start - b.start);

  const parts = [];
  let cursor = 0;
  for (const match of matches) {
    if (match.start > cursor) parts.push(text.slice(cursor, match.start));
    parts.push(match.text);
    cursor = match.end;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));

  const handleTermClick = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const el = e.currentTarget;
    const term = el.dataset.term;
    const definition = el.dataset.definition;
    if (!term || !definition) return;

    // Store ref to the clicked element so useLayoutEffect can measure it
    targetRef.current = el;
    setTooltip({ term, definition });
  };

  return (
    <>
      <span>
        {parts.map((part, i) => {
          const entry = glossaryMap[part.toLowerCase()];
          if (entry) {
            return (
              <span
                key={i}
                style={styles.term}
                data-term={entry.term}
                data-definition={entry.definition}
                onClick={handleTermClick}
              >
                {part}
              </span>
            );
          }
          return <span key={i}>{part}</span>;
        })}
      </span>

      {tooltip && createPortal(
        <div
          ref={tooltipRef}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            width: 300,
            maxWidth: '90vw',
            background: 'white',
            borderRadius: 14,
            boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
            padding: '14px 18px',
            zIndex: 99999,
            animation: 'tooltipFadeIn 0.2s ease',
            pointerEvents: 'auto',
          }}
        >
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 6,
          }}>
            <span style={{
              fontWeight: 700,
              fontSize: 16,
              color: '#FF6B35',
            }}>{tooltip.term}</span>
            <button
              onClick={() => { setTooltip(null); targetRef.current = null; }}
              style={{
                background: 'none', border: 'none',
                fontSize: 18, cursor: 'pointer', color: '#777',
                padding: '0 0 0 8px',
              }}
            >{'\u2715'}</button>
          </div>
          <div style={{
            fontSize: 16,
            color: '#444',
            lineHeight: 1.5,
            fontFamily: "'Fredoka', sans-serif",
          }}>{tooltip.definition}</div>
        </div>,
        document.body
      )}
    </>
  );
}

const styles = {
  term: {
    textDecoration: 'underline dotted',
    textDecorationColor: '#FF6B35',
    cursor: 'help',
    fontWeight: '600',
    color: 'inherit',
  },
};

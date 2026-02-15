import { useState, useEffect, useRef } from 'react';

export default function AnimatedBackground({ basePath, fallbackGradient }) {
  const [src, setSrc] = useState(null);
  const [type, setType] = useState(null);
  const videoRef = useRef(null);

  useEffect(() => {
    if (!basePath) { setType('gradient'); return; }

    let cancelled = false;

    // Try video first (HEAD request), then jpg, then png, then gradient
    fetch(`${basePath}.mp4`, { method: 'HEAD' })
      .then(res => {
        if (!cancelled && res.ok) {
          setType('video');
          setSrc(`${basePath}.mp4`);
        } else {
          throw new Error('not found');
        }
      })
      .catch(() => {
        if (cancelled) return;
        const img = new Image();
        img.onload = () => { if (!cancelled) { setType('image'); setSrc(img.src); } };
        img.onerror = () => {
          if (cancelled) return;
          const img2 = new Image();
          img2.onload = () => { if (!cancelled) { setType('image'); setSrc(img2.src); } };
          img2.onerror = () => { if (!cancelled) setType('gradient'); };
          img2.src = `${basePath}.png`;
        };
        img.src = `${basePath}.jpg`;
      });

    return () => { cancelled = true; };
  }, [basePath]);

  const baseStyle = {
    position: 'absolute', top: 0, left: 0,
    width: '100%', height: '100%',
    objectFit: 'cover', zIndex: 0, pointerEvents: 'none',
  };

  if (type === 'video') return (
    <video ref={videoRef} autoPlay loop muted playsInline style={baseStyle} key={src}>
      <source src={src} type="video/mp4" />
    </video>
  );

  if (type === 'image') return <img src={src} alt="" style={baseStyle} />;

  return <div style={{ ...baseStyle, background: fallbackGradient || 'linear-gradient(135deg, #FFE5D9, #D4E4F7)' }} />;
}

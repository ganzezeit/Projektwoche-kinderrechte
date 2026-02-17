import React from 'react';

export default function Flag({ code, size = 24 }) {
  const h = Math.round(size * 0.75);
  return (
    <img
      src={`https://flagcdn.com/${size}x${h}/${code}.png`}
      srcSet={`https://flagcdn.com/${size * 2}x${h * 2}/${code}.png 2x`}
      alt={code.toUpperCase()}
      style={{ display: 'inline-block', verticalAlign: 'middle', margin: '0 3px', width: size, height: h }}
      loading="lazy"
    />
  );
}

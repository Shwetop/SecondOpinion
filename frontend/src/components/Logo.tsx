import React from 'react';

export function LogoIcon({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none" role="img" aria-label="Second Opinion logo">
      <rect width="96" height="96" rx="24" fill="#12C56E" />
      <g transform="translate(48 48) scale(1.05) translate(-32 -32)">
        <g transform="translate(-7 2)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="5.5">
          <path d="M17 21C17 14.5 22.5 10 30 10C37.5 10 43 14.5 43 21C43 27 38.5 31 33 36L17 50H31" stroke="#0B1220" />
          <path d="M40 41L47 48L62 22" stroke="#FFFFFF" />
        </g>
      </g>
    </svg>
  );
}

'use client';

import React from 'react';

interface SentinelLogoProps {
  className?: string;
}

export function SentinelLogo({ className = 'w-7 h-7' }: SentinelLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="hdrBgGrad" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#111827" />
          <stop offset="100%" stopColor="#070a10" />
        </linearGradient>
        <linearGradient id="hdrShieldGrad" x1="112" y1="76" x2="400" y2="436" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#818cf8" />
          <stop offset="55%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#38bdf8" />
        </linearGradient>
        <linearGradient id="hdrLinkGrad" x1="176" y1="196" x2="336" y2="256" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#34d399" />
        </linearGradient>
      </defs>
      <rect x="16" y="16" width="480" height="480" rx="112" fill="url(#hdrBgGrad)" stroke="#1e293b" strokeWidth="14" />
      <path
        d="M256 76 L396 128 V244 C396 334 334 404 256 436 C178 404 116 334 116 244 V128 L256 76 Z"
        fill="#0f172a"
        fillOpacity="0.9"
        stroke="url(#hdrShieldGrad)"
        strokeWidth="24"
        strokeLinejoin="round"
      />
      <path d="M192 198 C236 198 256 248 320 248" stroke="url(#hdrLinkGrad)" strokeWidth="18" strokeLinecap="round" />
      <path d="M192 302 C236 302 256 248 320 248" stroke="url(#hdrLinkGrad)" strokeWidth="18" strokeLinecap="round" />
      <circle cx="192" cy="198" r="24" fill="#0b0f17" stroke="#818cf8" strokeWidth="14" />
      <circle cx="192" cy="302" r="24" fill="#0b0f17" stroke="#38bdf8" strokeWidth="14" />
      <circle cx="320" cy="248" r="28" fill="#34d399" stroke="#064e3b" strokeWidth="8" />
      <circle cx="320" cy="248" r="10" fill="#ecfdf5" />
    </svg>
  );
}


/** Decorative illustration of crop rows and a market scale. Purely visual; conveys no data. */
export function FieldIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 480 380" className={className} role="img" aria-label="Illustration of crop fields under the sun">
      <defs>
        <linearGradient id="sky" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#f6efe0" />
          <stop offset="1" stopColor="#eef3e8" />
        </linearGradient>
      </defs>
      <rect width="480" height="380" rx="16" fill="url(#sky)" />
      <circle cx="380" cy="86" r="38" fill="#e8b45c" opacity="0.85" />
      <path d="M0 210 C 120 170, 260 200, 480 160 L480 380 L0 380 Z" fill="#9dbb7d" />
      <path d="M0 250 C 140 220, 300 250, 480 215 L480 380 L0 380 Z" fill="#6f9a55" />
      <path d="M0 300 C 160 270, 320 300, 480 265 L480 380 L0 380 Z" fill="#2f6a3a" />
      {Array.from({ length: 9 }).map((_, i) => (
        <path key={i} d={`M${20 + i * 55} 380 Q ${120 + i * 40} 300, ${200 + i * 32} 262`} stroke="#c9dbb6" strokeWidth="2" fill="none" opacity="0.5" />
      ))}
      {Array.from({ length: 7 }).map((_, i) => (
        <g key={`s${i}`} transform={`translate(${60 + i * 58} ${196 - (i % 3) * 6})`}>
          <line x1="0" y1="0" x2="0" y2="34" stroke="#56743f" strokeWidth="2" />
          <ellipse cx="-5" cy="8" rx="5" ry="9" fill="#d7a845" transform="rotate(-20)" />
          <ellipse cx="5" cy="4" rx="5" ry="9" fill="#d7a845" transform="rotate(20)" />
          <ellipse cx="0" cy="-4" rx="4" ry="8" fill="#e1b553" />
        </g>
      ))}
    </svg>
  );
}

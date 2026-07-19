// components/truvern-logo.tsx
export default function TruvernLogo({
  size = 28,
}: {
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="tv_a" x1="10" y1="8" x2="40" y2="42" gradientUnits="userSpaceOnUse">
          <stop stopColor="#34d399" stopOpacity="0.9" />
          <stop offset="0.55" stopColor="#22d3ee" stopOpacity="0.85" />
          <stop offset="1" stopColor="#60a5fa" stopOpacity="0.9" />
        </linearGradient>
      </defs>

      <rect x="6" y="6" width="36" height="36" rx="12" fill="url(#tv_a)" fillOpacity="0.22" />
      <rect x="6.5" y="6.5" width="35" height="35" rx="11.5" stroke="rgba(255,255,255,0.18)" />

      <path
        d="M24 13.5c4.6 0 8.6 2.7 10.5 6.7-.9.2-1.9.3-2.9.3-3.9 0-6.8-1.4-9-4.1-2.2 2.7-5.1 4.1-9 4.1-1 0-2-.1-2.9-.3C15.4 16.2 19.4 13.5 24 13.5Z"
        fill="rgba(255,255,255,0.72)"
      />
      <path
        d="M14.2 24.3c2.8 1.2 5.7 1.4 8.6.6-.2 1.8-.9 3.5-2 4.9-1.1 1.4-2.7 2.5-4.6 3.2-2-2.2-3.1-5.1-3.1-8.4 0-.1 0-.2 0-.3Z"
        fill="rgba(255,255,255,0.58)"
      />
      <path
        d="M33.8 24.3c0 .1 0 .2 0 .3 0 3.3-1.1 6.2-3.1 8.4-1.9-.7-3.5-1.8-4.6-3.2-1.1-1.4-1.8-3.1-2-4.9 2.9.8 5.8.6 8.6-.6Z"
        fill="rgba(255,255,255,0.58)"
      />

      <path
        d="M24 35.2c-3.2 0-6-1.5-7.8-3.8 2.8-1.1 4.8-3.1 5.9-5.8h3.8c1.1 2.7 3.1 4.7 5.9 5.8-1.8 2.3-4.6 3.8-7.8 3.8Z"
        fill="rgba(255,255,255,0.72)"
      />
    </svg>
  );
}


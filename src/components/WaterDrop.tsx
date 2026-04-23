export function WaterDrop({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M32 4C32 4 8 36 8 52C8 65.255 18.745 76 32 76C45.255 76 56 65.255 56 52C56 36 32 4 32 4Z"
        fill="url(#waterGrad)"
        stroke="oklch(0.55 0.18 240 / 0.3)"
        strokeWidth="2"
      />
      <ellipse cx="24" cy="44" rx="6" ry="8" fill="oklch(1 0 0 / 0.2)" />
      <defs>
        <linearGradient id="waterGrad" x1="32" y1="4" x2="32" y2="76" gradientUnits="userSpaceOnUse">
          <stop stopColor="oklch(0.75 0.12 230)" />
          <stop offset="1" stopColor="oklch(0.45 0.18 240)" />
        </linearGradient>
      </defs>
    </svg>
  );
}

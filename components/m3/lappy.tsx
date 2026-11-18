// Lappy, the laptop mascot, as drawn in the prototype. Only where the canvas puts it.
export function Lappy({ size = 40, label = "Lappy" }: { size?: number; label?: string }) {
  return (
    <svg role="img" aria-label={label} width={size} height={size} viewBox="0 0 64 64">
      <rect x="10" y="6" width="44" height="34" rx="7" fill="#A5A7C3" /><rect x="14" y="10" width="36" height="26" rx="4" fill="#4B4E6C" />
      <circle cx="26" cy="22" r="5" fill="#FFFFFF" /><circle cx="38" cy="22" r="5" fill="#FFFFFF" /><circle cx="27" cy="23" r="2.4" fill="#4B4E6C" /><circle cx="39" cy="23" r="2.4" fill="#4B4E6C" />
      <path d="M28 30q4 3 8 0" stroke="#FFFFFF" strokeWidth="2" fill="none" strokeLinecap="round" /><path d="M6 40h52l-4 9H10z" fill="#B6B8CF" />
    </svg>
  );
}

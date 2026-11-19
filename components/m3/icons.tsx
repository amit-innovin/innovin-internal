// Icons the prototype draws itself (lucide has no match).

// Speak up: a speech bubble holding a shield, meaning a private message. A megaphone would clash
// with announcements, which already use one.
export function SpeakUpIcon({ size = 24 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H10l-5 4v-4H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" />
      <path d="M12 7l3 1.2v2.2c0 1.9-1.3 3.2-3 3.9-1.7-.7-3-2-3-3.9V8.2z" />
    </svg>
  );
}

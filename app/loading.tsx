// Shown while server-rendered pages fetch their data: quiet Material 3 placeholders.
export default function Loading() {
  return (
    <div className="m3 m3-page m3-stack" aria-busy="true" aria-label="Loading" style={{ padding: 18 }}>
      {[120, 180, 140].map((h) => <div key={h} className="m3-skeleton" style={{ height: h, borderRadius: 24 }} />)}
    </div>
  );
}

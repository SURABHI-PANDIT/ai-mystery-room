export default function LoadingScreen({ label = 'Loading' }) {
  return (
    <main className="state-screen" role="status" aria-live="polite">
      <span className="loading-mark" aria-hidden="true">?</span>
      <p>{label}…</p>
    </main>
  );
}

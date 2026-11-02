import { Link } from 'react-router-dom';

export default function AuthLayout({ children, footer }) {
  return (
    <main className="auth-page">
      <section className="auth-aside" aria-label="AI Mystery Room">
        <Link className="brand" to="/login" aria-label="AI Mystery Room home">
          <span className="brand__mark" aria-hidden="true">?</span>
          <span>AI Mystery Room</span>
        </Link>
        <div className="auth-aside__story">
          <p className="eyebrow">Every clue has a story</p>
          <h1>Look closer.<br />Find the truth.</h1>
          <p>Step into a case, follow the evidence, and see where the story leads.</p>
        </div>
        <p className="auth-aside__note">A fictional investigation experience</p>
      </section>
      <section className="auth-panel">
        <div className="auth-panel__mobile-brand">
          <span className="brand__mark" aria-hidden="true">?</span>
          <span>AI Mystery Room</span>
        </div>
        <div className="auth-card">
          {children}
          {footer}
        </div>
      </section>
    </main>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { apiRequest } from '../services/api.js';
import LoadingScreen from '../components/LoadingScreen.jsx';

const statusLabels = {
  Generating: 'Generating',
  Ready: 'Ready to investigate',
  'In Progress': 'In progress',
  Completed: 'Completed',
  Failed: 'Generation failed',
};

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [investigations, setInvestigations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [signingOut, setSigningOut] = useState(false);

  const loadInvestigations = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await apiRequest('/investigations');
      setInvestigations(result.data.investigations);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadInvestigations(); }, [loadInvestigations]);

  async function handleLogout() {
    setSigningOut(true);
    try {
      await logout();
    } catch (requestError) {
      setError(requestError.message);
      setSigningOut(false);
    }
  }

  if (loading) return <LoadingScreen label="Opening your case files" />;

  return (
    <main className="dashboard-page">
      <header className="topbar">
        <Link className="brand" to="/dashboard">
          <span className="brand__mark" aria-hidden="true">?</span>
          <span>AI Mystery Room</span>
        </Link>
        <div className="account-actions">
          <span className="account-name">{user.name}</span>
          <button className="button button--quiet" onClick={handleLogout} disabled={signingOut}>
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </header>

      <section className="dashboard-content">
        <div className="dashboard-hero">
          <div>
            <p className="eyebrow">Investigator’s desk</p>
            <h1>Welcome back, {user.name.split(' ')[0]}.</h1>
            <p className="dashboard-lede">Your case notes and investigations will be kept here.</p>
          </div>
          <Link className="button button--primary create-button" to="/mysteries/new">
            <span aria-hidden="true">＋</span> Create new mystery
          </Link>
        </div>

        <section className="case-section" aria-labelledby="cases-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Your files</p>
              <h2 id="cases-heading">Investigation history</h2>
            </div>
            <span className="case-count">{investigations.length} {investigations.length === 1 ? 'case' : 'cases'}</span>
          </div>

          {error && (
            <div className="notice notice--error" role="alert">
              <span>{error}</span>
              <button className="text-button" onClick={loadInvestigations}>Try again</button>
            </div>
          )}

          {investigations.length > 0 ? (
            <div className="case-list">
              {investigations.map((investigation) => (
                <Link className="case-card" key={investigation.id} to={`/investigations/${investigation.id}`}>
                  <div className="case-card__icon" aria-hidden="true">⌕</div>
                  <div className="case-card__body">
                    <h3>{investigation.title}</h3>
                    <p>{investigation.description || 'No case summary yet.'}</p>
                    <time dateTime={investigation.createdAt}>{new Date(investigation.createdAt).toLocaleDateString()}</time>
                  </div>
                  <span className={`status-pill status-pill--${investigation.status.toLowerCase().replaceAll(' ', '-')}`}>
                    {statusLabels[investigation.status] || investigation.status}
                  </span>
                </Link>
              ))}
            </div>
          ) : !error ? (
            <div className="empty-state">
              <span className="empty-state__icon" aria-hidden="true">⌕</span>
              <h3>No investigations yet</h3>
              <p>Start with a scenario. Your generated case and evidence will appear here.</p>
              <Link className="empty-state__action" to="/mysteries/new">Create your first mystery</Link>
            </div>
          ) : null}
        </section>
      </section>
      <footer className="dashboard-footer">AI Mystery Room <span>·</span> Fictional investigations for curious minds</footer>
    </main>
  );
}

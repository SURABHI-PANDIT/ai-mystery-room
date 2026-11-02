import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiRequest } from '../services/api.js';

const maximumScenarioLength = Math.min(4000, Number(import.meta.env.VITE_SCENARIO_MAX_LENGTH) || 2000);
const minimumScenarioLength = 20;

export default function CreateMystery() {
  const [scenario, setScenario] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    const trimmed = scenario.trim();
    if (trimmed.length < minimumScenarioLength) {
      setError(`Add a little more detail (at least ${minimumScenarioLength} characters).`);
      return;
    }
    if (trimmed.length > maximumScenarioLength) {
      setError(`Keep the scenario under ${maximumScenarioLength.toLocaleString()} characters.`);
      return;
    }

    setSubmitting(true);
    try {
      const result = await apiRequest('/investigations', {
        method: 'POST',
        body: JSON.stringify({ scenario: trimmed }),
      });
      navigate(`/investigations/${result.data.investigation.id}`);
    } catch (requestError) {
      setError(requestError.message);
      setSubmitting(false);
    }
  }

  return (
    <main className="dashboard-page">
      <header className="topbar">
        <Link className="brand" to="/dashboard"><span className="brand__mark" aria-hidden="true">?</span><span>AI Mystery Room</span></Link>
        <Link className="button button--quiet" to="/dashboard">Back to desk</Link>
      </header>
      <section className="create-content">
        <p className="eyebrow">Open a new file</p>
        <h1>What happened?</h1>
        <p className="create-intro">Describe the incident you want to investigate. Gemini will build a fictional case, its suspects, and the evidence around your premise.</p>
        <form className="scenario-form" onSubmit={handleSubmit}>
          <label htmlFor="scenario">Your scenario</label>
          <textarea
            id="scenario"
            value={scenario}
            onChange={(event) => setScenario(event.target.value)}
            placeholder="A curator found a locked gallery empty just before a rare painting was due to be unveiled…"
            maxLength={maximumScenarioLength}
            minLength={minimumScenarioLength}
            rows={8}
            required
            disabled={submitting}
          />
          <div className="scenario-meta">
            <span>Keep the details fictional. A few concrete facts give the investigation somewhere to begin.</span>
            <span>{scenario.length.toLocaleString()} / {maximumScenarioLength.toLocaleString()}</span>
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="scenario-actions">
            <Link className="button button--quiet" to="/dashboard">Cancel</Link>
            <button className="button button--primary" type="submit" disabled={submitting}>
              {submitting ? 'Opening case…' : 'Generate investigation'}
            </button>
          </div>
        </form>
        <p className="fiction-note">All people, messages, images and recordings in generated cases are fictional.</p>
      </section>
    </main>
  );
}

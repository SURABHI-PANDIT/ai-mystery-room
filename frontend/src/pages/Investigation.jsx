import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import EvidenceViewer from '../components/EvidenceViewer.jsx';
import LoadingScreen from '../components/LoadingScreen.jsx';
import { apiRequest } from '../services/api.js';

const filters = [
  ['all', 'All evidence'],
  ['chat', 'Conversations'],
  ['image', 'Images'],
  ['cctv', 'CCTV'],
];

export default function Investigation() {
  const { id } = useParams();
  const [run, setRun] = useState(0);
  const [progress, setProgress] = useState(null);
  const [investigation, setInvestigation] = useState(null);
  const [evidence, setEvidence] = useState([]);
  const [result, setResult] = useState(null);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState('');
  const [selectedSuspectId, setSelectedSuspectId] = useState('');
  const [confirmAccusation, setConfirmAccusation] = useState(false);
  const [reviewedEvidenceIds, setReviewedEvidenceIds] = useState([]);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');
  const [retrying, setRetrying] = useState(false);
  const [submittingAccusation, setSubmittingAccusation] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!progress?.retryAvailableAt) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, [progress?.retryAvailableAt]);

  const loadReadyCase = useCallback(async () => {
    const [caseResult, evidenceResult] = await Promise.all([
      apiRequest(`/investigations/${id}`),
      apiRequest(`/investigations/${id}/evidence`),
    ]);
    setInvestigation(caseResult.data.investigation);
    setEvidence(evidenceResult.data.evidence);
    setSelectedEvidenceId(evidenceResult.data.evidence[0]?.id || '');
    return caseResult.data.investigation;
  }, [id]);

  useEffect(() => {
    let active = true;
    let timer;
    setError('');
    setInvestigation(null);
    setEvidence([]);
    setResult(null);
    setReviewedEvidenceIds([]);

    async function poll() {
      try {
        const result = await apiRequest(`/investigations/${id}/status`);
        if (!active) return;
        setProgress(result.data);
        if (result.data.status === 'Ready' || result.data.status === 'In Progress' || result.data.status === 'Completed') {
          await loadReadyCase();
          if (result.data.status === 'Completed') {
            const resultResponse = await apiRequest(`/investigations/${id}/result`);
            if (active) setResult(resultResponse.data.result);
          }
          return;
        }
        if (result.data.status === 'Generating') {
          timer = setTimeout(poll, 1800);
        }
      } catch (requestError) {
        if (active) setError(requestError.message);
      }
    }

    poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [id, run, loadReadyCase]);

  const filteredEvidence = useMemo(() => (
    filter === 'all' ? evidence : evidence.filter((item) => item.type === filter)
  ), [evidence, filter]);
  const selectedEvidence = filteredEvidence.find((item) => item.id === selectedEvidenceId) || filteredEvidence[0];
  const suspectNames = useMemo(() => new Map((investigation?.suspects || []).map((suspect) => [suspect.suspectId, suspect.name])), [investigation]);

  useEffect(() => {
    if (!investigation || !selectedEvidence || progress?.status === 'Completed') return undefined;
    let active = true;
    apiRequest(`/investigations/${id}/evidence/${encodeURIComponent(selectedEvidence.evidenceId)}/viewed`, { method: 'POST' })
      .then((response) => {
        if (!active) return;
        setReviewedEvidenceIds(response.data.reviewedEvidenceIds || []);
        setProgress((current) => current ? { ...current, status: 'In Progress' } : current);
        setInvestigation((current) => current ? { ...current, status: 'In Progress' } : current);
      })
      .catch((requestError) => { if (active) setError(requestError.message); });
    return () => { active = false; };
  }, [id, investigation?.id, selectedEvidence?.id, result]);

  async function submitAccusation() {
    if (!selectedSuspectId || !confirmAccusation) return;
    setSubmittingAccusation(true);
    setError('');
    try {
      const response = await apiRequest(`/investigations/${id}/accuse`, {
        method: 'POST',
        body: JSON.stringify({ selectedSuspectId }),
      });
      setResult(response.data.result);
      setProgress((current) => current ? { ...current, status: 'Completed' } : current);
      setInvestigation((current) => current ? { ...current, status: 'Completed' } : current);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmittingAccusation(false);
    }
  }

  async function retryGeneration() {
    setRetrying(true);
    setError('');
    try {
      await apiRequest(`/investigations/${id}/retry`, { method: 'POST' });
      setProgress(null);
      setRun((value) => value + 1);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setRetrying(false);
    }
  }

  if (error && !progress) {
    return (
      <main className="state-screen">
        <p className="eyebrow">Case file</p>
        <h1>We couldn’t open this investigation.</h1>
        <p role="alert">{error}</p>
        <Link className="button button--quiet" to="/dashboard">Back to desk</Link>
      </main>
    );
  }

  if (progress?.status === 'Failed') {
    const retryAvailableAt = progress.retryAvailableAt ? new Date(progress.retryAvailableAt) : null;
    const retryBlocked = retryAvailableAt && Number.isFinite(retryAvailableAt.getTime()) && retryAvailableAt.getTime() > now;
    return (
      <main className="generation-screen">
        <Link className="brand" to="/dashboard"><span className="brand__mark" aria-hidden="true">?</span><span>AI Mystery Room</span></Link>
        <div className="generation-card generation-card--failed">
          <span className="generation-symbol" aria-hidden="true">!</span>
          <p className="eyebrow">Investigation interrupted</p>
          <h1>This case needs another pass.</h1>
          <p>{progress.error || progress.progress?.message || 'The case could not be generated.'}</p>
          {retryAvailableAt && Number.isFinite(retryAvailableAt.getTime()) && (
            <p role="status">
              {retryBlocked
                ? `Retry available ${retryAvailableAt.toLocaleString()}.`
                : 'Retry is available now.'}
            </p>
          )}
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="generation-actions">
            <button className="button button--primary" onClick={retryGeneration} disabled={retrying || retryBlocked}>
              {retrying ? 'Retrying…' : 'Retry generation'}
            </button>
            <Link className="button button--quiet" to="/dashboard">Return to desk</Link>
          </div>
        </div>
      </main>
    );
  }

  if (!investigation) {
    return (
      <main className="generation-screen">
        <Link className="brand" to="/dashboard"><span className="brand__mark" aria-hidden="true">?</span><span>AI Mystery Room</span></Link>
        <div className="generation-card">
          <span className="generation-symbol generation-symbol--loading" aria-hidden="true">⌕</span>
          <p className="eyebrow">Building your case</p>
          <h1>{progress?.progress?.stage === 'generating-media' ? 'Preparing the evidence.' : 'Following the first clues.'}</h1>
          <p>{progress?.progress?.message || 'The case file is opening. This can take a few minutes while its evidence is prepared.'}</p>
          <div className="progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={progress?.progress?.percent || 0}>
            <span style={{ width: `${progress?.progress?.percent || 5}%` }} />
          </div>
          <small>{progress?.progress?.percent || 5}% · You can leave this page and return from your desk.</small>
          {error && <p className="form-error" role="alert">{error}</p>}
          <Link className="generation-back" to="/dashboard">Back to desk</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="investigation-page">
      <header className="topbar">
        <Link className="brand" to="/dashboard"><span className="brand__mark" aria-hidden="true">?</span><span>AI Mystery Room</span></Link>
        <div className="account-actions">
          <span className={`case-status ${result ? 'case-status--complete' : 'case-status--ready'}`}>{result ? 'Case completed' : 'Case in progress'}</span>
          <Link className="button button--quiet" to="/dashboard">My desk</Link>
        </div>
      </header>

      <div className="investigation-content">
        <section className="case-overview">
          <p className="eyebrow">Case overview</p>
          <h1>{investigation.title}</h1>
          <p className="case-overview__summary">{investigation.incidentSummary}</p>
          <div className="case-facts">
            <div><span>Location</span><strong>{investigation.caseInfo.location}</strong></div>
            <div><span>Incident time</span><strong>{investigation.caseInfo.incidentDateTime ? new Date(investigation.caseInfo.incidentDateTime).toLocaleString() : 'Unknown'}</strong></div>
            <div><span>People of interest</span><strong>{investigation.suspects.length}</strong></div>
            <div><span>Evidence files</span><strong>{evidence.length}</strong></div>
          </div>
          <p className="case-overview__description">{investigation.description}</p>
        </section>

        <section className="investigation-section" aria-labelledby="suspects-heading">
          <div className="investigation-section__heading">
            <div><p className="eyebrow">People connected to the case</p><h2 id="suspects-heading">Suspects</h2></div>
          </div>
          <div className="suspect-grid">
            {investigation.suspects.map((suspect, index) => (
              <article className="suspect-card" key={suspect.suspectId}>
                <div className="suspect-card__number">0{index + 1}</div>
                <div className="suspect-card__identity"><h3>{suspect.name}</h3><span>{suspect.age} · {suspect.occupation}</span></div>
                <p>{suspect.biography}</p>
                <dl>
                  <div><dt>Connection</dt><dd>{suspect.relationshipToIncident}</dd></div>
                  <div><dt>Possible motive</dt><dd>{suspect.motive}</dd></div>
                  <div><dt>Where were they?</dt><dd>{suspect.alibi}<small className="suspect-whereabouts-hint">The suspect's account of where they were at the time of the incident.</small></dd></div>
                </dl>
              </article>
            ))}
          </div>
        </section>

        <section className="investigation-section timeline-section" aria-labelledby="timeline-heading">
          <div className="investigation-section__heading">
            <div><p className="eyebrow">Sequence of events</p><h2 id="timeline-heading">Timeline</h2></div>
          </div>
          <ol className="case-timeline">
            {investigation.timeline.map((event) => (
              <li key={event.eventId}>
                <time dateTime={event.occurredAt}>{new Date(event.occurredAt).toLocaleString()}</time>
                <p>{event.description}</p>
                {event.suspectIds.length > 0 && <span>{event.suspectIds.map((suspectId) => suspectNames.get(suspectId) || suspectId).join(', ')}</span>}
              </li>
            ))}
          </ol>
        </section>

        <section className="investigation-section evidence-section" aria-labelledby="evidence-heading">
          <div className="investigation-section__heading">
            <div><p className="eyebrow">Clues, records and media</p><h2 id="evidence-heading">Evidence room</h2></div>
            <span className="case-count">{evidence.length} items</span>
          </div>
          <div className="evidence-filters" role="group" aria-label="Filter evidence by type">
            {filters.map(([key, label]) => (
              <button key={key} className={filter === key ? 'filter-chip filter-chip--active' : 'filter-chip'} onClick={() => { setFilter(key); setSelectedEvidenceId(''); }} aria-pressed={filter === key}>
                {label}{key !== 'all' && <small>{evidence.filter((item) => item.type === key).length}</small>}
              </button>
            ))}
          </div>
          <div className="evidence-room">
            <nav className="evidence-list" aria-label="Evidence files">
              {filteredEvidence.map((item) => (
                <button key={item.id} className={selectedEvidence?.id === item.id ? 'evidence-list-item evidence-list-item--active' : 'evidence-list-item'} onClick={() => setSelectedEvidenceId(item.id)}>
                  <span className={`evidence-list-item__icon evidence-list-item__icon--${item.type}`} aria-hidden="true">{item.type === 'chat' ? '↔' : item.type === 'image' ? '▧' : '◉'}</span>
                  <span className="evidence-list-item__copy"><strong>{item.title}</strong><small>{item.generationStatus === 'ready' ? item.type : item.generationStatus}</small></span>
                </button>
              ))}
              {filteredEvidence.length === 0 && <p className="evidence-list__empty">No evidence in this category.</p>}
            </nav>
            <EvidenceViewer evidence={selectedEvidence} />
          </div>
        </section>
        {result ? (
          <section className="investigation-section result-section" aria-labelledby="result-heading" data-testid="investigation-result">
            <div className="investigation-section__heading">
              <div><p className="eyebrow">Case closed</p><h2 id="result-heading">Investigation result</h2></div>
              <strong className="result-score">{result.score.total}<span> / {result.score.maximum}</span></strong>
            </div>
            <div className={result.isCorrect ? 'result-verdict result-verdict--correct' : 'result-verdict result-verdict--incorrect'} role="status">
              <h3>{result.isCorrect ? 'Your accusation was correct.' : 'Your accusation was incorrect.'}</h3>
              <p>You accused {result.selectedSuspectName}. The culprit was {result.actualCulpritName}.</p>
            </div>
            <div className="result-score-breakdown">
              <div><span>Correct accusation</span><strong>{result.score.accusationPoints} / 70</strong></div>
              <div><span>Evidence reviewed ({result.score.reviewedEvidenceCount} of {result.score.availableEvidenceCount})</span><strong>{result.score.evidencePoints} / 30</strong></div>
            </div>
            <h3>What happened</h3>
            <p>{result.crimeExplanation}</p>
            <p>{result.finalExplanation}</p>
            <h3>How the evidence establishes the solution</h3>
            {result.supportingClues?.length > 0 && (
              <ul className="result-evidence-list">
                {result.supportingClues.map((clue) => (
                  <li key={clue.clueId}><strong>{clue.description}</strong><p>{clue.explanation}</p></li>
                ))}
              </ul>
            )}
            {result.supportingEvidence.length ? (
              <ul className="result-evidence-list">
                {result.supportingEvidence.map((item) => (
                  <li key={item.evidenceId}><strong>{item.title}</strong><p>{item.description}</p><p>{item.explanation}</p></li>
                ))}
              </ul>
            ) : <p>The case explanation and timeline above provide the available reasoning for the solution.</p>}
            {result.misleadingEvidenceExplanations.length > 0 && (
              <>
                <h3>Misleading evidence explained</h3>
                <ul className="result-evidence-list">
                  {result.misleadingEvidenceExplanations.map((item) => (
                    <li key={item.evidenceId}><strong>{item.title}</strong><p>{item.description}</p><p>{item.explanation}</p></li>
                  ))}
                </ul>
              </>
            )}
            <h3>Actual sequence of events</h3>
            <ol className="result-sequence">
              {result.actualSequenceOfEvents.map((event, index) => <li key={`${index}-${event}`}>{event}</li>)}
            </ol>
            <Link className="button button--quiet" to="/dashboard">Return to investigation history</Link>
          </section>
        ) : (
          <section className="investigation-section accusation-section" aria-labelledby="accusation-heading">
            <div className="investigation-section__heading">
              <div><p className="eyebrow">Make your final decision</p><h2 id="accusation-heading">Who is responsible?</h2></div>
              <span className="case-count">{reviewedEvidenceIds.length} evidence items reviewed</span>
            </div>
            <p>Choose one suspect. This final accusation cannot be changed after submission.</p>
            <fieldset className="accusation-options">
              <legend>Select your suspect</legend>
              {investigation.suspects.map((suspect) => (
                <label className={selectedSuspectId === suspect.suspectId ? 'accusation-option accusation-option--selected' : 'accusation-option'} key={suspect.suspectId}>
                  <input type="radio" name="accusedSuspect" value={suspect.suspectId} checked={selectedSuspectId === suspect.suspectId} onChange={() => setSelectedSuspectId(suspect.suspectId)} />
                  <span><strong>{suspect.name}</strong><small>{suspect.occupation}</small></span>
                </label>
              ))}
            </fieldset>
            <label className="accusation-confirm"><input type="checkbox" checked={confirmAccusation} onChange={(event) => setConfirmAccusation(event.target.checked)} /> I understand this is my one final accusation.</label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="button button--primary" onClick={submitAccusation} disabled={!selectedSuspectId || !confirmAccusation || submittingAccusation}>
              {submittingAccusation ? 'Submitting accusation…' : 'Submit final accusation'}
            </button>
          </section>
        )}
        <p className="fiction-note">This is a fictional case. Messages, images and any available CCTV-style video are AI-generated evidence.</p>
      </div>
    </main>
  );
}

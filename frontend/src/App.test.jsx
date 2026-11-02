import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App.jsx';

const user = { id: 'user-1', name: 'Riley Morgan', email: 'riley@example.test' };

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('authentication routes', () => {
  it('redirects protected pages, restores a cookie session, and logs out', async () => {
    const userEventSession = userEvent.setup();
    let serverSession = false;
    const fetchMock = vi.fn(async (url, options = {}) => {
      if (url === '/api/auth/me') {
        return serverSession
          ? jsonResponse({ success: true, data: { user } })
          : jsonResponse({ success: false, message: 'Please sign in.', error: { code: 'UNAUTHORIZED' } }, 401);
      }
      if (url === '/api/auth/login') {
        const body = JSON.parse(options.body);
        if (body.password !== 'correct-password') {
          return jsonResponse({ success: false, message: 'Email or password is incorrect.' }, 401);
        }
        serverSession = true;
        return jsonResponse({ success: true, data: { user } });
      }
      if (url === '/api/investigations') {
        return jsonResponse({ success: true, data: { investigations: [] } });
      }
      if (url === '/api/auth/logout') {
        serverSession = false;
        return jsonResponse({ success: true, data: {} });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    window.history.replaceState({}, '', '/dashboard');
    const firstMount = render(<App />);
    await screen.findByRole('heading', { name: 'Sign in to continue' });
    expect(window.location.pathname).toBe('/login');

    await userEventSession.type(screen.getByLabelText('Email address'), user.email);
    await userEventSession.type(screen.getByLabelText('Password'), 'wrong-password');
    await userEventSession.click(screen.getByRole('button', { name: 'Sign in' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Email or password is incorrect.');

    await userEventSession.clear(screen.getByLabelText('Password'));
    await userEventSession.type(screen.getByLabelText('Password'), 'correct-password');
    await userEventSession.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('heading', { name: 'Welcome back, Riley.' })).toBeTruthy();
    expect(fetchMock.mock.calls.some(([, options]) => options?.credentials === 'include')).toBe(true);

    firstMount.unmount();
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Welcome back, Riley.' })).toBeTruthy();

    await userEventSession.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(await screen.findByRole('heading', { name: 'Sign in to continue' })).toBeTruthy();
  });

  it('checks password confirmation before registering', async () => {
    const userEventSession = userEvent.setup();
    let serverSession = false;
    const fetchMock = vi.fn(async (url) => {
      if (url === '/api/auth/me') {
        return serverSession
          ? jsonResponse({ success: true, data: { user } })
          : jsonResponse({ success: false, message: 'Please sign in.' }, 401);
      }
      if (url === '/api/auth/register') {
        serverSession = true;
        return jsonResponse({ success: true, data: { user } }, 201);
      }
      if (url === '/api/investigations') return jsonResponse({ success: true, data: { investigations: [] } });
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);
    await screen.findByRole('heading', { name: 'Sign in to continue' });
    await userEventSession.click(screen.getByRole('link', { name: 'Create an account' }));
    await screen.findByRole('heading', { name: 'Create your account' });

    await userEventSession.type(screen.getByLabelText('Your name'), 'Riley Morgan');
    await userEventSession.type(screen.getByLabelText('Email address'), user.email);
    await userEventSession.type(screen.getByLabelText('Password'), 'correct-password');
    await userEventSession.type(screen.getByLabelText('Confirm password'), 'different-password');
    await userEventSession.click(screen.getByRole('button', { name: 'Create account' }));

    expect((await screen.findByRole('alert')).textContent).toContain('The passwords do not match.');
    expect(fetchMock.mock.calls.some(([url]) => url === '/api/auth/register')).toBe(false);

    await userEventSession.clear(screen.getByLabelText('Confirm password'));
    await userEventSession.type(screen.getByLabelText('Confirm password'), 'correct-password');
    await userEventSession.click(screen.getByRole('button', { name: 'Create account' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Welcome back, Riley.' })).toBeTruthy());
  });

  it('submits a scenario, follows generation status, and renders the private-safe case and evidence', async () => {
    const userEventSession = userEvent.setup();
    let serverSession = false;
    let completed = false;
    const investigation = {
      id: 'case-1', title: 'The Vanishing Ledger', description: 'A ledger disappeared.',
      incidentSummary: 'A ledger vanished from a locked archive.',
      caseInfo: { location: 'North Archive', incidentDateTime: '2026-10-31T20:00:00.000Z' },
      suspects: [{ suspectId: 'S1', name: 'Ada Vale', age: 35, occupation: 'Archivist', biography: 'A long-serving archivist.', relationshipToIncident: 'Had access.', motive: 'A disputed collection.', alibi: 'At the reading room.' }],
      timeline: [{ eventId: 'T1', occurredAt: '2026-10-31T18:00:00.000Z', description: 'The archive closed.', suspectIds: ['S1'] }],
      solution: { culpritSuspectId: 'S1', finalExplanation: 'private solution should never render' },
    };
    const evidence = [{
      id: 'evidence-1', evidenceId: 'E1', type: 'chat', title: 'A late message',
      description: 'A conversation from the evening.', timestamp: '2026-10-31T19:00:00.000Z',
      content: { conversationId: 'CHAT-1', messages: [{ sender: 'Ada', receiver: 'Bram', text: 'The key is back.', timestamp: '2026-10-31T19:00:00.000Z' }] },
      generationStatus: 'ready', media: [],
    }];
    const fetchMock = vi.fn(async (url, options = {}) => {
      if (url === '/api/auth/me') return serverSession
        ? jsonResponse({ success: true, data: { user } })
        : jsonResponse({ success: false, message: 'Please sign in.' }, 401);
      if (url === '/api/auth/login') { serverSession = true; return jsonResponse({ success: true, data: { user } }); }
      if (url === '/api/investigations' && !options.method) return jsonResponse({ success: true, data: { investigations: completed ? [{ id: 'case-1', title: 'The Vanishing Ledger', description: 'A ledger disappeared.', status: 'Completed', createdAt: '2026-10-31T20:00:00.000Z' }] : [] } });
      if (url === '/api/investigations' && options.method === 'POST') {
        expect(JSON.parse(options.body).scenario).toContain('locked archive');
        return jsonResponse({ success: true, data: { investigation: { id: 'case-1', status: 'Generating' } } }, 202);
      }
      if (url === '/api/investigations/case-1/status') return jsonResponse({ success: true, data: { status: completed ? 'Completed' : 'Ready', progress: { stage: 'complete', percent: 100 } } });
      if (url === '/api/investigations/case-1') return jsonResponse({ success: true, data: { investigation } });
      if (url === '/api/investigations/case-1/evidence') return jsonResponse({ success: true, data: { evidence } });
      if (url === '/api/investigations/case-1/evidence/E1/viewed') return jsonResponse({ success: true, data: { reviewedEvidenceIds: ['E1'] } });
      if (url === '/api/investigations/case-1/accuse') {
        expect(JSON.parse(options.body)).toEqual({ selectedSuspectId: 'S1' });
        completed = true;
        return jsonResponse({ success: true, data: { result: {
          selectedSuspectId: 'S1', selectedSuspectName: 'Ada Vale', actualCulpritSuspectId: 'S1', actualCulpritName: 'Ada Vale', isCorrect: true,
          score: { total: 100, maximum: 100, accusationPoints: 70, evidencePoints: 30, reviewedEvidenceCount: 1, availableEvidenceCount: 1 },
          crimeExplanation: 'Ada took the ledger.', finalExplanation: 'The key message establishes the solution.', actualSequenceOfEvents: ['Ada entered the archive.'],
          supportingClues: [], supportingEvidence: [{ evidenceId: 'E1', title: 'A late message', description: 'A conversation from the evening.', explanation: 'The message places Ada near the archive.' }],
          misleadingEvidenceExplanations: [], timeline: investigation.timeline, completedAt: '2026-11-01T10:00:00.000Z',
        } } }, 201);
      }
      if (url === '/api/investigations/case-1/result') return jsonResponse({ success: true, data: { result: {
        selectedSuspectId: 'S1', selectedSuspectName: 'Ada Vale', actualCulpritSuspectId: 'S1', actualCulpritName: 'Ada Vale', isCorrect: true,
        score: { total: 100, maximum: 100, accusationPoints: 70, evidencePoints: 30, reviewedEvidenceCount: 1, availableEvidenceCount: 1 },
        crimeExplanation: 'Ada took the ledger.', finalExplanation: 'The key message establishes the solution.', actualSequenceOfEvents: ['Ada entered the archive.'],
        supportingClues: [], supportingEvidence: [{ evidenceId: 'E1', title: 'A late message', description: 'A conversation from the evening.', explanation: 'The message places Ada near the archive.' }],
        misleadingEvidenceExplanations: [], timeline: investigation.timeline, completedAt: '2026-11-01T10:00:00.000Z',
      } } });
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    window.history.replaceState({}, '', '/login');
    render(<App />);
    await userEventSession.type(await screen.findByLabelText('Email address'), user.email);
    await userEventSession.type(screen.getByLabelText('Password'), 'correct-password');
    await userEventSession.click(screen.getByRole('button', { name: 'Sign in' }));
    await userEventSession.click(await screen.findByRole('link', { name: /Create new mystery/ }));
    await userEventSession.type(await screen.findByLabelText('Your scenario'), 'A ledger disappeared from a locked archive during a private reception.');
    await userEventSession.click(screen.getByRole('button', { name: 'Generate investigation' }));

    expect(await screen.findByRole('heading', { name: 'The Vanishing Ledger' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Suspects' })).toBeTruthy();
    expect(screen.getByText('Where were they?')).toBeTruthy();
    expect(screen.getByText("The suspect's account of where they were at the time of the incident.")).toBeTruthy();
    expect(screen.queryByText('Alibi')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Evidence room' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'A late message' })).toBeTruthy();
    expect(screen.getByText('The key is back.')).toBeTruthy();
    expect(document.body.textContent).not.toContain('private solution should never render');
    expect(fetchMock.mock.calls.some(([url]) => url === '/api/investigations/case-1/status')).toBe(true);
    await userEventSession.click(screen.getByRole('radio', { name: /Ada Vale/ }));
    await userEventSession.click(screen.getByRole('checkbox', { name: /one final accusation/ }));
    await userEventSession.click(screen.getByRole('button', { name: 'Submit final accusation' }));
    expect(await screen.findByRole('heading', { name: 'Investigation result' })).toBeTruthy();
    expect(screen.getByText('Your accusation was correct.')).toBeTruthy();
    await userEventSession.click(screen.getByRole('link', { name: 'Return to investigation history' }));
    expect(await screen.findByText('Completed')).toBeTruthy();
    await userEventSession.click(screen.getByRole('link', { name: /The Vanishing Ledger/ }));
    expect(await screen.findByRole('heading', { name: 'Investigation result' })).toBeTruthy();
  });

  it('shows the quota retry time and disables retry until that time', async () => {
    const retryAvailableAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    const fetchMock = vi.fn(async (url) => {
      if (url === '/api/auth/me') return jsonResponse({ success: true, data: { user } });
      if (url === '/api/investigations/case-1/status') return jsonResponse({
        success: true,
        data: {
          status: 'Failed',
          progress: { stage: 'failed', percent: 100, message: 'Daily quota reached.' },
          error: 'Gemini’s daily request quota is exhausted.',
          retryAvailableAt,
        },
      });
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    window.history.replaceState({}, '', '/investigations/case-1');

    render(<App />);

    expect(await screen.findByText(/Retry available/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Retry generation' }).disabled).toBe(true);
  });

  it('submits a confirmed suspect choice and renders the server result and score', async () => {
    const userEventSession = userEvent.setup();
    const investigation = {
      id: 'case-1', title: 'The Vanishing Ledger', description: 'A ledger disappeared.',
      incidentSummary: 'A ledger vanished from a locked archive.',
      caseInfo: { location: 'North Archive', incidentDateTime: '2026-10-31T20:00:00.000Z' },
      suspects: [
        { suspectId: 'S1', name: 'Ada Vale', age: 35, occupation: 'Archivist', biography: 'An archivist.', relationshipToIncident: 'Had access.', motive: 'A debt.', alibi: 'At home.' },
        { suspectId: 'S2', name: 'Bram Cole', age: 42, occupation: 'Guard', biography: 'A guard.', relationshipToIncident: 'Worked nearby.', motive: 'A dispute.', alibi: 'At the gate.' },
      ],
      timeline: [{ eventId: 'T1', occurredAt: '2026-10-31T18:00:00.000Z', description: 'The archive closed.', suspectIds: ['S1'] }],
    };
    const evidence = [{
      id: 'evidence-1', evidenceId: 'E1', type: 'chat', title: 'A late message',
      description: 'A message from the evening.', timestamp: '2026-10-31T19:00:00.000Z',
      content: { conversationId: 'CHAT-1', messages: [{ sender: 'Ada', receiver: 'Bram', text: 'The key is back.', timestamp: '2026-10-31T19:00:00.000Z' }] },
      generationStatus: 'ready', media: [],
    }];
    const result = {
      selectedSuspectId: 'S1', selectedSuspectName: 'Ada Vale',
      actualCulpritSuspectId: 'S1', actualCulpritName: 'Ada Vale', isCorrect: true,
      score: { total: 100, maximum: 100, accusationPoints: 70, evidencePoints: 30, reviewedEvidenceCount: 1, availableEvidenceCount: 1 },
      crimeExplanation: 'Ada used the archive key.', finalExplanation: 'The access record and timeline establish Ada was responsible.',
      actualSequenceOfEvents: ['Ada copied the key.', 'Ada entered the archive.'],
      supportingClues: [{ clueId: 'C1', description: 'The access log changed.', explanation: "It contradicts the suspect's account." }],
      supportingEvidence: [{ evidenceId: 'E1', title: 'A late message', description: 'A message from the evening.', explanation: 'It places Ada near the archive.' }],
      misleadingEvidenceExplanations: [], timeline: investigation.timeline,
      completedAt: '2026-11-01T10:00:00.000Z',
    };
    const fetchMock = vi.fn(async (url, options = {}) => {
      if (url === '/api/auth/me') return jsonResponse({ success: true, data: { user } });
      if (url === '/api/investigations/case-1/status') return jsonResponse({ success: true, data: { status: 'In Progress', progress: { stage: 'complete', percent: 100 } } });
      if (url === '/api/investigations/case-1') return jsonResponse({ success: true, data: { investigation } });
      if (url === '/api/investigations/case-1/evidence') return jsonResponse({ success: true, data: { evidence } });
      if (url === '/api/investigations/case-1/evidence/E1/viewed') return jsonResponse({ success: true, data: { reviewedEvidenceIds: ['E1'] } });
      if (url === '/api/investigations/case-1/accuse') {
        expect(options.method).toBe('POST');
        expect(JSON.parse(options.body)).toEqual({ selectedSuspectId: 'S1' });
        return jsonResponse({ success: true, data: { result } }, 201);
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    window.history.replaceState({}, '', '/investigations/case-1');

    render(<App />);

    await userEventSession.click(await screen.findByRole('radio', { name: /Ada Vale/ }));
    await userEventSession.click(screen.getByRole('checkbox', { name: /one final accusation/ }));
    await userEventSession.click(screen.getByRole('button', { name: 'Submit final accusation' }));

    expect(await screen.findByRole('heading', { name: 'Investigation result' })).toBeTruthy();
    expect(screen.getByText('Your accusation was correct.')).toBeTruthy();
    expect(screen.getByText('100')).toBeTruthy();
    expect(screen.getByText("It contradicts the suspect's account.")).toBeTruthy();
  });
});

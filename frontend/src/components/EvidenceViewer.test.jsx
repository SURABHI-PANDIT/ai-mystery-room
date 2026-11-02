import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import EvidenceViewer from './EvidenceViewer.jsx';

afterEach(cleanup);

describe('EvidenceViewer', () => {
  it('shows a text-only forensic card without calling the evidence unavailable', () => {
    render(<EvidenceViewer evidence={{
      id: 'e1', evidenceId: 'E1', type: 'image', title: 'Desk photograph', description: 'A brass key rests beside a damp notebook.',
      timestamp: '2026-10-31T20:00:00.000Z', generationStatus: 'not_requested',
      content: { caption: 'A key and notebook are described in the evidence record.' }, associatedSuspectIds: ['S1'], media: [],
    }} suspectNames={new Map([['S1', 'Ada Vale']])} />);

    expect(screen.getByRole('heading', { name: 'Desk photograph' })).toBeTruthy();
    expect(screen.getByLabelText('Forensic evidence record')).toBeTruthy();
    expect(screen.getByText('TEXT RECORD')).toBeTruthy();
    expect(screen.getByText('A brass key rests beside a damp notebook.')).toBeTruthy();
    expect(screen.getByText('A key and notebook are described in the evidence record.')).toBeTruthy();
    expect(screen.getByText('Ada Vale')).toBeTruthy();
    expect(screen.queryByText(/unavailable/i)).toBeNull();
    expect(document.querySelector('img')).toBeNull();
    expect(document.querySelector('video')).toBeNull();
  });

  it('shows a CCTV recording log using only the available evidence fields', () => {
    render(<EvidenceViewer evidence={{
      id: 'e2', type: 'cctv', title: 'North entrance camera', description: 'The summary notes movement near the entrance.',
      timestamp: '2026-10-31T20:00:00.000Z', generationStatus: 'not_requested',
      content: { cameraLocation: 'North entrance', recordedAt: '2026-10-31T20:00:00.000Z', durationSeconds: 8, visualSummary: 'The summary notes movement near the entrance.' }, media: [],
    }} />);

    expect(screen.getByRole('heading', { name: 'North entrance camera' })).toBeTruthy();
    expect(screen.getByLabelText('Surveillance recording log')).toBeTruthy();
    expect(screen.getByText('TEXT RECORD')).toBeTruthy();
    expect(screen.getByText('North entrance')).toBeTruthy();
    expect(screen.getByText('8 seconds')).toBeTruthy();
    expect(screen.getByText('The summary notes movement near the entrance.')).toBeTruthy();
    expect(screen.queryByText(/unavailable/i)).toBeNull();
    expect(document.querySelector('video')).toBeNull();
    expect(document.querySelector('img')).toBeNull();
  });

  it('distinguishes an attempted media failure and keeps the written details', () => {
    render(<EvidenceViewer evidence={{
      id: 'e3', type: 'image', title: 'Desk photograph', description: 'A brass key rests beside a damp notebook.',
      timestamp: '2026-10-31T20:00:00.000Z', generationStatus: 'unavailable',
      generationMessage: 'Provider quota details stay private.', content: {}, media: [],
    }} />);

    expect(screen.getByText('MEDIA NOT AVAILABLE')).toBeTruthy();
    expect(screen.getByText('Media generation did not complete. The written evidence details remain available.')).toBeTruthy();
    expect(screen.getByText('A brass key rests beside a damp notebook.')).toBeTruthy();
    expect(screen.queryByText(/Provider quota|Gemini|API/i)).toBeNull();
    expect(document.querySelector('img')).toBeNull();
  });

  it('keeps actual generated images and replaces a broken image with its evidence record', () => {
    const { rerender } = render(<EvidenceViewer evidence={{
      id: 'e4', type: 'image', title: 'Desk photograph', description: 'A brass key rests beside a damp notebook.',
      timestamp: '2026-10-31T20:00:00.000Z', generationStatus: 'ready', content: {},
      media: [{ mediaId: 'm1', generationStatus: 'ready', url: '/api/media/m1' }],
    }} />);
    expect(document.querySelector('img')?.getAttribute('src')).toContain('/api/media/m1');
    fireEvent.error(document.querySelector('img'));
    expect(screen.getByText('Generated media could not be loaded. The saved evidence details remain available.')).toBeTruthy();
    expect(screen.getByText('A brass key rests beside a damp notebook.')).toBeTruthy();
    expect(document.querySelector('img')).toBeNull();

    rerender(<EvidenceViewer evidence={{
      id: 'e5', type: 'image', title: 'Other image', description: 'A receipt has been found.',
      timestamp: '2026-10-31T20:00:00.000Z', generationStatus: 'ready', content: {},
      media: [{ mediaId: 'm2', generationStatus: 'ready', url: '/api/media/m2' }],
    }} />);
    expect(document.querySelector('img')?.getAttribute('src')).toContain('/api/media/m2');
  });
});

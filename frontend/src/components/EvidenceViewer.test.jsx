import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import EvidenceViewer from './EvidenceViewer.jsx';

afterEach(cleanup);

describe('EvidenceViewer', () => {
  it('identifies unavailable CCTV and does not present a still image or simulated video', () => {
    render(<EvidenceViewer evidence={{
      id: 'e1', type: 'cctv', title: 'North entrance camera', description: 'The camera file could not be generated.',
      timestamp: '2026-10-31T20:00:00.000Z', generationStatus: 'unavailable',
      generationMessage: 'Gemini API daily quota limit exhausted; video unavailable.',
      content: { cameraLocation: 'North entrance', recordedAt: '2026-10-31T20:00:00.000Z', durationSeconds: 8 }, media: [],
    }} />);

    expect(screen.getByText('CCTV video unavailable')).toBeTruthy();
    expect(screen.getByText('This recording could not be created. Its location, time, and description are below.')).toBeTruthy();
    expect(screen.queryByText(/Gemini|quota|API/)).toBeNull();
    expect(screen.getByText('The camera file could not be generated.')).toBeTruthy();
    expect(screen.getByText('North entrance')).toBeTruthy();
    expect(screen.getAllByText(new Date('2026-10-31T20:00:00.000Z').toLocaleString()).length).toBeGreaterThan(1);
    expect(document.querySelector('video')).toBeNull();
    expect(document.querySelector('img')).toBeNull();
  });

  it('shows unavailable image evidence as readable text without an image placeholder', () => {
    render(<EvidenceViewer evidence={{
      id: 'e2', type: 'image', title: 'Desk photograph', description: 'A brass key rests beside a damp notebook.',
      timestamp: '2026-10-31T20:00:00.000Z', generationStatus: 'unavailable',
      generationMessage: 'Gemini API quota exhausted; image generation is unavailable.', content: {}, media: [],
    }} />);

    expect(screen.getByText('Image unavailable')).toBeTruthy();
    expect(screen.getByText('This image could not be created. The evidence description is below.')).toBeTruthy();
    expect(screen.queryByText(/Gemini|quota|API/)).toBeNull();
    expect(screen.getByRole('heading', { name: 'Evidence description' })).toBeTruthy();
    expect(screen.getByText('A brass key rests beside a damp notebook.')).toBeTruthy();
    expect(document.querySelector('img')).toBeNull();
    expect(document.querySelector('.evidence-image-button')).toBeNull();
  });

  it('keeps generated images and replaces a broken image with its text evidence panel', () => {
    const { rerender } = render(<EvidenceViewer evidence={{
      id: 'e3', type: 'image', title: 'Desk photograph', description: 'A brass key rests beside a damp notebook.',
      timestamp: '2026-10-31T20:00:00.000Z', generationStatus: 'ready', content: {},
      media: [{ mediaId: 'm1', generationStatus: 'ready', url: '/api/media/m1' }],
    }} />);
    expect(document.querySelector('img')?.getAttribute('src')).toContain('/api/media/m1');
    fireEvent.error(document.querySelector('img'));
    expect(screen.getByText('This image could not be loaded. The evidence description is below.')).toBeTruthy();
    expect(screen.getByText('A brass key rests beside a damp notebook.')).toBeTruthy();
    expect(document.querySelector('img')).toBeNull();

    rerender(<EvidenceViewer evidence={{
      id: 'e4', type: 'image', title: 'Other image', description: 'A receipt has been found.',
      timestamp: '2026-10-31T20:00:00.000Z', generationStatus: 'ready', content: {},
      media: [{ mediaId: 'm2', generationStatus: 'ready', url: '/api/media/m2' }],
    }} />);
    expect(document.querySelector('img')?.getAttribute('src')).toContain('/api/media/m2');
  });
});

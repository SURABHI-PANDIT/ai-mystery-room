import { useState } from 'react';
import { resolveApiUrl } from '../services/api.js';

function displayTimestamp(value) {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? date.toLocaleString() : 'Time not provided';
}

function MediaUnavailable({ evidence, message }) {
  const unavailableMessage = message || (evidence.type === 'cctv'
    ? 'This recording could not be created. Its location, time, and description are below.'
    : 'This image could not be created. The evidence description is below.');
  const recordedAt = evidence.content.recordedAt || evidence.timestamp;
  return (
    <section className="media-unavailable" role="status" aria-label="Evidence details">
      <strong>{evidence.type === 'cctv' ? 'CCTV video unavailable' : 'Image unavailable'}</strong>
      <p className="media-unavailable__message">{unavailableMessage}</p>
      {evidence.type === 'cctv' && (
        <dl className="media-unavailable__facts">
          <div><dt>Recording location</dt><dd>{evidence.content.cameraLocation || 'Location not provided'}</dd></div>
          <div><dt>Recording timestamp</dt><dd>{displayTimestamp(recordedAt)}</dd></div>
        </dl>
      )}
      <div className="media-unavailable__description">
        <h4>Evidence description</h4>
        <p>{evidence.description}</p>
      </div>
    </section>
  );
}

export default function EvidenceViewer({ evidence }) {
  const [enlarged, setEnlarged] = useState(false);
  const [failedMediaId, setFailedMediaId] = useState('');
  if (!evidence) {
    return <div className="evidence-empty"><p>Select a piece of evidence to examine it.</p></div>;
  }

  const readyMedia = evidence.media?.find((item) => item.generationStatus === 'ready' && item.url);
  const mediaKey = readyMedia?.mediaId || readyMedia?.url || '';
  const media = readyMedia && mediaKey !== failedMediaId ? readyMedia : null;
  const recordedAt = evidence.content.recordedAt || evidence.timestamp;

  return (
    <article className="evidence-detail">
      <div className="evidence-detail__heading">
        <span className={`evidence-kind evidence-kind--${evidence.type}`}>{evidence.type === 'cctv' ? 'CCTV recording' : evidence.type}</span>
        <time dateTime={evidence.timestamp}>{displayTimestamp(evidence.timestamp)}</time>
      </div>
      <h3>{evidence.title}</h3>
      {(evidence.type === 'chat' || media) && <p className="evidence-detail__description">{evidence.description}</p>}

      {evidence.type === 'chat' && (
        <div className="chat-transcript" aria-label="Fictional conversation">
          <p className="chat-transcript__label">Fictional conversation · {evidence.content.conversationId}</p>
          {evidence.content.messages.map((message, index) => (
            <div className={`chat-message ${index % 2 ? 'chat-message--right' : ''}`} key={`${message.timestamp}-${index}`}>
              <span>{message.sender} <small>to {message.receiver}</small></span>
              <p>{message.text}</p>
              <time dateTime={message.timestamp}>{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
            </div>
          ))}
        </div>
      )}

      {evidence.type === 'image' && (media ? (
        <button className="evidence-image-button" onClick={() => setEnlarged(true)} aria-label={`Enlarge ${evidence.title}`}>
          <img src={resolveApiUrl(media.url)} alt={evidence.content.caption || evidence.description} loading="lazy" onError={() => setFailedMediaId(media.mediaId || media.url)} />
          <span>Open image</span>
        </button>
      ) : <MediaUnavailable evidence={evidence} message={readyMedia && failedMediaId ? 'This image could not be loaded. The evidence description is below.' : undefined} />)}

      {evidence.type === 'cctv' && (media ? (
        <div className="video-evidence">
          <video src={resolveApiUrl(media.url)} controls preload="metadata" playsInline aria-label={evidence.title} onError={() => setFailedMediaId(media.mediaId || media.url)} />
          <div className="video-evidence__label">AI-generated fictional CCTV-style video</div>
          <dl>
            <div><dt>Camera</dt><dd>{evidence.content.cameraLocation}</dd></div>
            <div><dt>Recorded</dt><dd>{displayTimestamp(recordedAt)}</dd></div>
            <div><dt>Duration</dt><dd>{evidence.content.durationSeconds} seconds</dd></div>
          </dl>
        </div>
      ) : <MediaUnavailable evidence={evidence} message={readyMedia && failedMediaId ? 'This recording could not be loaded. Its location, time, and description are below.' : undefined} />)}

      {enlarged && media && (
        <div className="image-lightbox" role="dialog" aria-modal="true" aria-label={evidence.title} onClick={() => setEnlarged(false)}>
          <button className="image-lightbox__close" onClick={() => setEnlarged(false)} aria-label="Close enlarged image">×</button>
          <img src={resolveApiUrl(media.url)} alt={evidence.content.caption || evidence.description} onClick={(event) => event.stopPropagation()} />
        </div>
      )}
    </article>
  );
}

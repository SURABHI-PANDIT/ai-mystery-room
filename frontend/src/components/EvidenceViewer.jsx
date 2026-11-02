import { useState } from 'react';
import { resolveApiUrl } from '../services/api.js';

function displayTimestamp(value) {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? date.toLocaleString() : 'Time not provided';
}

function EvidenceFallback({ evidence, mediaLoadFailed, suspectNames }) {
  const content = evidence.content || {};
  const textOnly = evidence.generationStatus === 'not_requested';
  const recordType = evidence.type === 'cctv' ? 'Surveillance recording log' : 'Forensic evidence record';
  const description = content.visualSummary || evidence.description;
  const recordedAt = content.recordedAt || evidence.timestamp;
  const failureMessage = mediaLoadFailed
    ? 'Generated media could not be loaded. The saved evidence details remain available.'
    : 'Media generation did not complete. The written evidence details remain available.';
  const relatedSuspects = (evidence.associatedSuspectIds || []).map((id) => suspectNames.get(id) || id);

  return (
    <section className={`evidence-record ${evidence.type === 'cctv' ? 'evidence-record--cctv' : 'evidence-record--forensic'}`} aria-label={recordType}>
      <div className="evidence-record__masthead">
        <span>{evidence.type === 'cctv' ? 'SURVEILLANCE LOG' : 'CASE EVIDENCE'}</span>
        <span>{textOnly ? 'TEXT RECORD' : 'MEDIA NOT AVAILABLE'}</span>
      </div>
      <h4>{evidence.title}</h4>
      {evidence.type !== 'cctv' && (
        <time className="evidence-record__timestamp" dateTime={evidence.timestamp}>{displayTimestamp(evidence.timestamp)}</time>
      )}
      {!textOnly && <p className="evidence-record__notice" role="status">{failureMessage}</p>}
      {evidence.type === 'cctv' ? (
        <>
          <dl className="evidence-record__facts">
            <div><dt>Camera location</dt><dd>{content.cameraLocation || 'Not provided'}</dd></div>
            <div><dt>Recording time</dt><dd>{displayTimestamp(recordedAt)}</dd></div>
            {Number.isFinite(content.durationSeconds) && content.durationSeconds > 0 && (
              <div><dt>Duration</dt><dd>{content.durationSeconds} seconds</dd></div>
            )}
          </dl>
          <div className="evidence-record__summary"><span>Available visual summary</span><p>{description}</p></div>
        </>
      ) : (
        <>
          {content.caption && <p className="evidence-record__caption">{content.caption}</p>}
          <div className="evidence-record__summary"><span>Evidence description</span><p>{evidence.description}</p></div>
          {relatedSuspects.length > 0 && (
            <div className="evidence-record__related"><span>Associated people</span><p>{relatedSuspects.join(' · ')}</p></div>
          )}
        </>
      )}
    </section>
  );
}

export default function EvidenceViewer({ evidence, suspectNames = new Map() }) {
  const [enlarged, setEnlarged] = useState(false);
  const [failedMediaId, setFailedMediaId] = useState('');
  if (!evidence) {
    return <div className="evidence-empty"><p>Select a piece of evidence to examine it.</p></div>;
  }

  const content = evidence.content || {};
  const readyMedia = evidence.media?.find((item) => item.generationStatus === 'ready' && item.url);
  const mediaKey = readyMedia?.mediaId || readyMedia?.url || '';
  const media = readyMedia && mediaKey !== failedMediaId ? readyMedia : null;
  const showTextFallback = (evidence.type === 'image' || evidence.type === 'cctv') && !media;
  const recordedAt = content.recordedAt || evidence.timestamp;

  return (
    <article className="evidence-detail">
      <div className="evidence-detail__heading">
        <span className={`evidence-kind evidence-kind--${evidence.type}`}>{evidence.type === 'cctv' ? 'CCTV recording' : evidence.type}</span>
        {!showTextFallback && <time dateTime={evidence.timestamp}>{displayTimestamp(evidence.timestamp)}</time>}
      </div>
      {!showTextFallback && <h3>{evidence.title}</h3>}

      {evidence.type === 'chat' && <p className="evidence-detail__description">{evidence.description}</p>}
      {evidence.type === 'chat' && (
        <div className="chat-transcript" aria-label="Fictional conversation">
          <p className="chat-transcript__label">Fictional conversation · {content.conversationId}</p>
          {(content.messages || []).map((message, index) => (
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
          <img src={resolveApiUrl(media.url)} alt={content.caption || evidence.description} loading="lazy" onError={() => setFailedMediaId(mediaKey)} />
          <span>Open image</span>
        </button>
      ) : <EvidenceFallback evidence={evidence} suspectNames={suspectNames} mediaLoadFailed={Boolean(readyMedia && failedMediaId)} />)}

      {evidence.type === 'cctv' && (media ? (
        <div className="video-evidence">
          <video src={resolveApiUrl(media.url)} controls preload="metadata" playsInline aria-label={evidence.title} onError={() => setFailedMediaId(mediaKey)} />
          <div className="video-evidence__label">AI-generated fictional CCTV-style video</div>
          <dl>
            {content.cameraLocation && <div><dt>Camera</dt><dd>{content.cameraLocation}</dd></div>}
            {recordedAt && <div><dt>Recorded</dt><dd>{displayTimestamp(recordedAt)}</dd></div>}
            {Number.isFinite(content.durationSeconds) && <div><dt>Duration</dt><dd>{content.durationSeconds} seconds</dd></div>}
          </dl>
          {content.visualSummary && <p className="video-evidence__summary">{content.visualSummary}</p>}
        </div>
      ) : <EvidenceFallback evidence={evidence} suspectNames={suspectNames} mediaLoadFailed={Boolean(readyMedia && failedMediaId)} />)}

      {enlarged && media && (
        <div className="image-lightbox" role="dialog" aria-modal="true" aria-label={evidence.title} onClick={() => setEnlarged(false)}>
          <button className="image-lightbox__close" onClick={() => setEnlarged(false)} aria-label="Close enlarged image">×</button>
          <img src={resolveApiUrl(media.url)} alt={content.caption || evidence.description} onClick={(event) => event.stopPropagation()} />
        </div>
      )}
    </article>
  );
}

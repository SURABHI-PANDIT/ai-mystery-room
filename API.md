# API

All successful responses use `{ "success": true, "message": "...", "data": {} }`. Errors use `{ "success": false, "message": "...", "error": { "code": "..." } }`.

## Health

`GET /api/health` returns API status and MongoDB connection state.

## Authentication

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Validate credentials, create account, set HTTP-only session cookie |
| POST | `/api/auth/login` | Public | Verify credentials and issue session cookie |
| POST | `/api/auth/logout` | Public | Clear session cookie |
| GET | `/api/auth/me` | Authenticated | Return the current public user |

Registration returns `409 EMAIL_ALREADY_REGISTERED` for duplicate email and `400 VALIDATION_ERROR` for invalid fields. Invalid credentials and missing/expired sessions return `401`. Passwords and session tokens are never returned as JSON.

## Investigations and evidence

All these routes require the session cookie and scope records to the authenticated owner. Scenario input must contain at least 20 characters and no more than `SCENARIO_MAX_LENGTH` (default 2000, maximum 4000). Creation is limited to five requests per hour per client.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/investigations` | List the current user's public investigation history |
| POST | `/api/investigations` | Submit `{ "scenario": "..." }`; returns `202` with investigation ID and queued status |
| GET | `/api/investigations/:id/status` | Read generation status, safe progress, and user-facing failure message |
| GET | `/api/investigations/:id` | Read a ready public case overview and suspects |
| GET | `/api/investigations/:id/evidence` | List evidence metadata and content |
| POST | `/api/investigations/:id/retry` | Restart a failed generation |
| POST | `/api/investigations/:id/evidence/:evidenceId/viewed` | Record that an owned evidence item was opened |
| POST | `/api/investigations/:id/accuse` | Submit `{ "selectedSuspectId": "S1" }` as the one final accusation |
| GET | `/api/investigations/:id/result` | Retrieve the saved result after accusation |
| GET | `/api/evidence/:id` | Read one owned evidence record |
| GET | `/api/media/:mediaId` | Stream generated media after authentication and owner verification |

Generation status includes `Generating`, `Ready`, `In Progress`, `Completed`, or `Failed`; progress gives a safe stage, percentage, and display message. A ready case exposes its suspects, timeline, and evidence, but never its culprit, complete solution, internal clue plan, generation diagnostics, provider prompts, or media storage reference. Viewed evidence is stored by the backend. Accusations reject invalid suspects, non-ready cases, and repeated submissions. `409 ACCUSATION_ALREADY_SUBMITTED` identifies a completed accusation; the client can retrieve its unchanged result with GET `/api/investigations/:id/result`.

The accusation response and result endpoint reveal the selected suspect, correctness, actual culprit, explanation, supporting clues/evidence, misleading evidence explanation, and timeline only after a successful submission. The server computes and persists the score: 70 points for correctness plus up to 30 points proportional to distinct evidence IDs reviewed before submission. Client-supplied scores or reviewed IDs are ignored. Both endpoints verify ownership.

Evidence types are `chat`, `image`, and `cctv`. Image/video media status is `pending`, `ready`, `failed`, or `unavailable`. Failed/unavailable media has no media URL; the frontend should not substitute a static image for CCTV footage. The video provider uses the configured Gemini video generation model and stores actual returned video bytes.

## Gemini configuration

The backend reads `GEMINI_API_KEY`, `GEMINI_TEXT_MODEL`, `GEMINI_IMAGE_MODEL`, and `GEMINI_VIDEO_MODEL`. Defaults are defined in `backend/.env.example`. Requests use backend-only credentials, structured output for case/evidence plans, bounded retry on invalid output and transient failures, and `store: false` for Gemini Interactions API requests.

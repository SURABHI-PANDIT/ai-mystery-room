# Database

MongoDB is accessed through Mongoose. Set `MONGODB_URI` in `backend/.env`; the example configuration uses a local `ai-mystery-room` database.

## Users

The `users` collection stores `name`, normalized unique `email`, and `passwordHash`, with timestamps. Password hashes are excluded from normal queries and selected only for credential verification. Public user responses contain only ID, name, email, and creation time.

## Investigations

The `investigations` collection stores its owner ID, private source scenario, public case title/description/summary, case location and incident details, suspect profiles, timeline, generation status/progress, and private generation diagnostics. `cluePlan`, `solution`, `accusation`, and the completed `result` are backend-only fields and excluded from default queries. It also stores unique reviewed evidence IDs. Status values are `Generating`, `Ready`, `In Progress`, `Completed`, and `Failed`. The accusation records the selected suspect, submission time, and correctness; the saved result includes the backend-computed score and solution explanation.

## Evidence

The `evidence` collection associates each record with an investigation and stable evidence ID. It stores chat messages or image/CCTV descriptions, suspect associations, timestamp/order, and media generation status. Internal clue links, reliability/purpose, and media storage references are excluded from default queries. Public endpoints use explicit projections and verify investigation ownership.

Media bytes are stored under `backend/storage/media/` by default, with generated UUID filenames and private references in MongoDB. The directory is ignored by Git. Local storage is suitable for development; deployment needs persistent, private storage.

Credentials, connection strings, private solution fields, and media storage references must never be returned to the frontend or committed.

The score is saved with the result: 70 points for a correct accusation and up to 30 points according to the proportion of evidence items reviewed before submission. One accusation is allowed per investigation; completion and result persistence use a conditional update so a repeated request cannot replace the first result.

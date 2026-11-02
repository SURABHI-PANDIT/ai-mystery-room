# AI Mystery Room

AI Mystery Room is a fictional investigation experience built with React, Express, MongoDB, and Google Gemini. It supports account authentication, asynchronous case and evidence generation, evidence review, a one-time suspect accusation, and a saved result with the solution and score.

## Requirements

- Node.js 20 or newer
- npm 10 or newer (`npm.cmd` can be used in PowerShell if script execution blocks `npm`)
- MongoDB running locally or a MongoDB connection URI
- A Gemini API key for case and media generation

## Setup

1. Copy `backend/.env.example` to `backend/.env` and set `MONGODB_URI`, `JWT_SECRET`, and `GEMINI_API_KEY`.
2. Copy `frontend/.env.example` to `frontend/.env.local` if the API is not at `http://localhost:5000/api`.
3. Install dependencies from the project root with `npm install`.
4. Start the API with `npm run dev:backend`.
5. Start the React app in another terminal with `npm run dev:frontend`.
6. Open the Vite URL shown in the frontend terminal. Check API health at `http://localhost:5000/api/health`.

Register or sign in to open the dashboard. Create a mystery with a scenario, then follow its asynchronous generation status. Ready investigations include a case overview, suspect profiles, timeline, fictional chat records, images, and CCTV-style video where generation is available. Review evidence, select one suspect, confirm your final accusation, and see the saved result and explanation. The culprit and complete solution stay on the backend until that accusation is accepted. Failed media is marked unavailable; no still image or simulated clip is substituted for video.

The backend calculates a 100-point score: 70 points for a correct accusation and up to 30 points based on the share of evidence items opened before submission. The accusation is final and cannot be changed.

Generated image/video files are stored locally in `backend/storage/media/` by default. This directory is ignored by Git. For production, configure a durable private media provider or persistent volume before deployment.

## Verification and limitations

Run `npm test --workspace backend`, `npm test --workspace frontend`, and `npm run build` from the project root. Backend integration tests use the configured MongoDB connection. Tests mock Gemini and do not require live AI calls. Image and video generation availability depends on the configured provider/model and account quota; failures are shown as unavailable rather than replaced by fabricated footage. Local media storage needs a private persistent volume in deployment.

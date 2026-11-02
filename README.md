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

## Production deployment (Render + Vercel + MongoDB Atlas)

The Express API runs on Render, while Vercel serves the Vite frontend. Vercel proxies `/api/*` to Render so browser requests remain same-origin and the HTTP-only authentication cookie works without cross-site cookie settings. Configure the Render origin in `frontend/vercel.json` before deploying Vercel.

1. Push the reviewed project to GitHub after checking the staged-file list. Keep `.env` files and credentials out of the repository.
2. Create a MongoDB Atlas cluster and database user. In Atlas Network Access, allow the Render service's outbound IP addresses where available, rather than opening access to every IP. Copy the Atlas connection string.
3. Create a Render **Web Service** from the repository using the repository root. Set build command `npm ci`, start command `npm start`, and health check path `/api/health`.
4. In Render, set `NODE_ENV=production`, `MONGODB_URI` (the Atlas connection string), `JWT_SECRET` (a newly generated long random value), `GEMINI_API_KEY`, and `GEMINI_TEXT_MODEL` (for example, `gemini-2.5-flash`). Set `CLIENT_URL` to your Vercel production origin. Keep secret values in Render's environment settings, never in Git.
5. Add persistent storage for generated media. Mount a disk at `/opt/render/project/src/backend/storage/media` and set `MEDIA_STORAGE_DIR` to that path. Render's local filesystem is otherwise ephemeral. Persistent disks require a paid Render service and restrict it to one instance; use durable object storage if you need horizontal scaling.
6. Create a Vercel project with the repository's `frontend` directory as its Root Directory. Use `npm install` as the install command, `npm run build` as the build command, and `dist` as the output directory. Add `VITE_API_URL=/api` in the Vercel Production environment; it is embedded at build time.
7. After Render creates the API service, replace `YOUR-RENDER-SERVICE` in `frontend/vercel.json` with its service hostname (omit `https://` and `.onrender.com`), then push the change so Vercel redeploys. The rewrite forwards `/api/*` to the Render API while retaining the Vercel URL in the browser.
8. Deploy both services. Check `https://<your-render-service>.onrender.com/api/health` and confirm `database` is `connected`. Then use the Vercel production URL to test registration, login persistence, case generation, evidence loading, accusation, and logout.

Vercel's external rewrites act as a reverse proxy; the included rewrite also provides SPA fallback for frontend routes. See [Vercel rewrites](https://vercel.com/docs/routing/rewrites). AI generation still depends on Gemini model access and quota. The generation queue runs inside the Render web process and is not a durable job queue; keep one API instance unless job processing is moved to a separately coordinated worker.

## Verification and limitations

Run `npm test --workspace backend`, `npm test --workspace frontend`, and `npm run build` from the project root. Backend integration tests use the configured MongoDB connection. Tests mock Gemini and do not require live AI calls. Image and video generation availability depends on the configured provider/model and account quota; failures are shown as unavailable rather than replaced by fabricated footage. Local media storage needs a private persistent volume in deployment.

# Trophenix React Frontend (minimal)

This is a tiny Vite + React app to record voice and send it to a backend that exposes these endpoints:

- `POST /transcribe_audio` — accepts `audio` file in multipart form and returns `{ "transcript": "..." }`.
- `POST /generate_cv_from_text` — accepts `name`, `email`, `message` as form fields and returns `{ "cv_json": {...}, "cv_path": "path/to/docx" }`.

Assuming the backend runs on `http://127.0.0.1:8000` by default.

Quick start

1. Install dependencies

```bash
cd frontend/react-app
npm install
```

2. Run dev server

```bash
npm run dev
```

3. Open the printed `Local` URL (usually `http://localhost:5173`) and record a message. The app will upload the audio, request transcription, then generate and show the CV JSON.

Configuration

- To change the backend URL, set `VITE_BACKEND_URL` environment variable before running Vite, e.g.:

```bash
export VITE_BACKEND_URL="http://127.0.0.1:8000"
npm run dev
```

Notes

- This is a minimal, chatgpt-style clean UI to quickly test the flow. You can extend the layout, add authentication, validation, or a manual correction step if desired.
- The app relies on browser `MediaRecorder` API (modern browsers only).

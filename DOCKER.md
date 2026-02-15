# Docker Setup

This project is split into:
- `backend` (Node + Express + FFmpeg)
- `frontend` (React build served by Nginx)

## 1. Prepare environment

1. Ensure Docker Desktop is running.
2. Create `.env` from `.env.example` and fill all required values.

## 2. Build and start

```bash
docker compose build
docker compose up -d
```

Frontend: `http://localhost:3000`
Backend health: `http://localhost:4000/api/health`

## 3. Logs

```bash
docker compose logs -f backend
docker compose logs -f frontend
```

## 4. Stop

```bash
docker compose down
```

## Notes

- Backend image includes `ffmpeg` and `ffprobe`.
- Frontend calls backend through Nginx proxy at `/api`.
- Runtime processing folders are mounted from host:
  - `DownloadedVideos`
  - `GeneratedTranscripts`
  - `Q&A`
  - `AudioChunks`

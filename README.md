# RavenHUD

Interactive community world map and tracker for RavenQuest.

> Originally created by **therealpixelated**.  
> This continuation is maintained under the **MIT License**.

---

## Features

- Interactive world map
- Community marker submissions
- Suggested edits and deletions
- Discord login for verified submissions
- Collected marker sync
- Trophy tracking

---

## Project Structure

- `docs/` — static frontend site and map data
- `backend/worker/` — Cloudflare Worker backend for submissions and sync
- `.github/workflows/` — automation for approved marker ingestion

---

## Submission Flow

1. User logs in with Discord
2. User submits a marker or suggests an edit from the map
3. The backend creates a GitHub issue for review
4. An approved issue is ingested into the map data by GitHub Actions
5. The site updates with the approved change

---

## Development

### Frontend
The site lives in `docs/` and can be served locally with any static server.

### Backend
The submission API lives in `backend/worker/`.

See `backend/worker/README.md` for Worker setup and deployment details.

---

## License

This project is licensed under the **MIT License**.

Copyright (c) 2025-2026 **therealpixelated**

---

## Credits

- Original project by **therealpixelated**
- Continued maintenance by current contributors

# Data Portrait

![E2E Tests](https://github.com/remotebrowser/data-portrait/actions/workflows/e2e-daily.yml/badge.svg)

Data Portrait makes a picture from your shopping and reading history. Connect your accounts, and the app reads your recent orders and books. Then it draws a portrait that shows your style and interests.

**Live Demo:** https://dataportrait.app/

## Features

- **Connect accounts:** Amazon, Wayfair, Goodreads, GoFood, and Shopee.
- **Import your history:** The app fetches your recent orders and books.
- **Make a portrait:** The app uses Gemini or FLUX to draw an image from your data.
- **Use your own photo:** Upload one, or take a selfie with your camera.
- **Choose the look:** Pick a style, gender, and traits like hair and age.
- **Check your data:** See the products and brands behind your portrait.
- **Your data stays yours:** We use it only to make your portrait. We never sell or share it.

## How It Works

1. Connect your accounts in the sidebar.
2. The app fetches your orders and reading history through the RemoteBrowser API.
3. Pick your style, gender, and traits.
4. The app makes your portrait.
5. Download and share it.

## Supported Brands

- Amazon
- Wayfair
- Goodreads
- GoFood
- Shopee
- DoorDash (turn on with the `doordash` feature flag)

Office Depot is off right now. It will come back after we update its sign-in flow.

## Technical Overview

- **Frontend:** React, TypeScript, Tailwind CSS.
- **Backend:** Express.js. It talks to brand websites through the RemoteBrowser API. It uses MaxMind to look up locations.
- **Image models:** Gemini (through Portkey or direct) or FLUX. A Gemini model writes the image prompt. DeepInfra handles the background blur trait.
- **Storage:** Save images on the local disk, or in Google Cloud Storage.

## Configuration

Create a `.env` file in the project root. See `.env.template` for an empty starting point. All variables are optional unless noted.

```env
# RemoteBrowser API. The env vars keep the old GETGATHER_ name.
GETGATHER_URL=https://api.getgather.com
GETGATHER_APP_KEY=            # optional. Sent as a Bearer token.

# MaxMind GeoIP (optional)
MAXMIND_ACCOUNT_ID=
MAXMIND_LICENSE_KEY=

# Image generation (required)
# The app picks a provider in this order: Portkey, Google GenAI, FLUX.
# Set at least one key.
PORTKEY_API_KEY=
GEMINI_API_KEY=
FLUX_API_KEY=

# DeepInfra (optional). Used for the "Background Blur" trait.
DEEPINFRA_API_KEY=

# Storage
# local: save images in the public/ folder (default)
# gcs: save images in Google Cloud Storage
STORAGE_MODE=local
GCS_BUCKET_NAME=              # required when STORAGE_MODE=gcs
GCS_PROJECT_ID=               # required when STORAGE_MODE=gcs

# Google Cloud login. Pick one:
# - A file path to a service account JSON file
# - A base64-encoded service account JSON string
GOOGLE_APPLICATION_CREDENTIALS=
GOOGLE_APPLICATION_CREDENTIALS_JSON=

# Feature flags. A comma-separated list.
# doordash: show the DoorDash connector
# photo_upload: allow face upload and selfies
# camera: not used yet
ENABLE_FEATURES=

# Old way to allow face upload. Still works.
# Set to true, or use the photo_upload flag above.
ALLOW_FACE_UPLOAD=false

# Optional extras
SENTRY_DSN=                   # error reports (server)
VITE_SENTRY_DSN=              # error reports (browser)
SEGMENT_WRITE_KEY=            # usage tracking
SESSION_SECRET=               # set your own in production
```

## Development

### Run with Docker

```bash
docker run -p 3000:3000 \
  -e GETGATHER_URL=your_local_remotebrowser_url \
  -e PORTKEY_API_KEY=your_portkey_key \
  ghcr.io/remotebrowser/data-portrait:latest
```

Then open [localhost:3000](http://localhost:3000).

### Run on your machine

```bash
npm install
npm run dev
```

This starts two things: the Vite dev server and the backend on port `3000`. Open the Vite URL (default: `localhost:5173`). The dev server sends API calls to the backend.

### Build for production

```bash
npm run build
npm start
```

### Tests

```bash
npm run test:e2e
```

Other test modes: `test:e2e:ui`, `test:e2e:headed`, and `test:e2e:debug`.

# Afterglow

A simple Y2K-inspired music player for MP3 files you already have.

## Features

- Choose multiple MP3 files or drag them into the player
- Play full tracks, seek, pause, and skip through the queue
- Remove files from the current queue
- Responsive layout for desktop and mobile
- Files are read and played locally in your browser; nothing is uploaded

## Run locally

Requires Node.js 20.19+.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite, then choose MP3 files from your device.

## Your files

Afterglow does not copy your music to a server. The browser keeps the selected files available only while the page is open; after a refresh, select them again to rebuild your queue.

## Tech

React, TypeScript, Vite, Tailwind CSS, and Lucide icons.
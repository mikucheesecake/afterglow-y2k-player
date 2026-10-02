# Afterglow

A minimalist Y2K-inspired personal music player. Search for songs and artists, play short previews, save favorites, and make playlists that stay in your browser.

## Features

- Live song and artist search
- 30-second audio previews when Apple provides one
- Favorites and custom playlists saved in local storage
- Responsive layout for desktop and mobile
- Playback controls, track seeking, and clear empty/error states

## Run locally

Requires Node.js 20.19+.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

## Catalog and previews

Search results and preview links come from Apple's public iTunes Search API. This is a search-preview experience, not a complete streaming catalog: available previews are up to 30 seconds, and some tracks do not have a preview. Track details and cover artwork are supplied by Apple. Favorites and playlists are stored locally in the browser and do not sync between devices.

## Tech

React, TypeScript, Vite, Tailwind CSS, and Lucide icons.
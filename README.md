# ESOK + Scramjet

Everything is in this folder: the ESOK site (`public/`), ESOK AI (`/api/chat`),
and the Scramjet proxy + Wisp socket. Searching in ESOK opens the result through Scramjet.

## Run on your computer
Install Node.js (https://nodejs.org), then double-click `start.bat` (Windows) or run `./start.sh` (Mac/Linux).
The first start downloads the Scramjet runtime, so it needs internet and takes a few seconds.
It opens http://localhost:3030.

## Put it online (Render, Railway, Fly.io)
Upload this folder to GitHub and deploy it as a Node web service (`render.yaml` included).
It must be a host that supports WebSockets. Netlify cannot run the proxy.

## ESOK AI (optional)
Set the `OPENAI_API_KEY` environment variable (optional: `OPENAI_BASE_URL`, `AI_MODEL`). Search works without it.


## Lumin game launches

Lumin game links and `window.open()` launches from the Games page are routed to `/scramjet-client/index.html?goto=...`, so games use this same Render-hosted Scramjet proxy and Wisp WebSocket service. Keep the frontend and Scramjet runtime on the same origin for this configuration.


## Wallpaper Studio
Settings -> Wallpaper Studio has 100 photo wallpapers and 100 live wallpapers.
The live wallpapers are real animated scenes drawn in the browser (canvas, no video files):
Mountains (clouds, birds, sun), Ocean, Rainy City (rain, ripples, lightning), Snowfall, Fireflies, Galaxy,
Aurora, Desert, Underwater (fish, kelp, bubbles), Lava Lamp, Falling Petals and Synthwave, each in several color/time-of-day variants.
Hover a card to preview it. They pause when the tab is hidden and show a still frame if reduced motion is enabled.


## Wallpaper browser
Set `PEXELS_API_KEY` (free at https://www.pexels.com/api/) to browse and stream free 4K images and live videos from Settings > Wallpaper Studio. Nothing is downloaded.

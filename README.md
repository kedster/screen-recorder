# Screen & Audio Recorder

Modern web app to record screen video and audio with a sleek UI and real-time feedback:

- 🎥 Screen recording with audio → MP4
- 🎙️ Audio capture (tab or mic) → MP3
- 🌓 Dark/light theme
- 📊 Audio visualization
- ⏱️ Recording timer
- 🎬 Live video preview
- 🔔 Toast notifications
- ☁️ **Cloudflare deployment ready**

## Deployment Options

### Local Development (Node.js)
Traditional Node.js/Express setup for local development and testing.

### Cloudflare (Production)
Serverless deployment using Cloudflare Workers and Pages for scalable production hosting.

📖 **[See Cloudflare Deployment Guide](CLOUDFLARE_DEPLOYMENT.md)** for detailed setup instructions.

## Features

- Records screen with audio, converts to MP4 with intelligent fallback system
- Records tab/mic audio, converts to MP3 in-browser
- Modern UI with dark mode support
- Real-time audio visualization
- Recording timer and status indicators
- Live video preview for screen recording
- Toast notifications for better feedback

## Setup

### Local Development (Node.js)

1. Install dependencies:
```powershell
# PowerShell (temporary execution policy for npm)
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass;
npm install
```

2. Optional: Install ffmpeg for MP4 conversion
- Download ffmpeg from ffmpeg.org
- Add to PATH or copy ffmpeg.exe to a directory in PATH
- Check installation: `ffmpeg -version`

3. Start the server:
```powershell
npm start
```

4. Open http://localhost:3000

### Cloudflare Development

1. Install dependencies and Wrangler:
```bash
npm install
npm install -g wrangler
```

2. Authenticate with Cloudflare:
```bash
wrangler login
```

3. Start Worker development server:
```bash
npm run dev:worker
```

4. Build frontend for Pages:
```bash
npm run build:pages
```

See [Cloudflare Deployment Guide](CLOUDFLARE_DEPLOYMENT.md) for production deployment.

## Notes

- Screen/tab capture requires Chrome with "Share audio" enabled
- If lamejs fails to load, audio uploads as WebM
- Without ffmpeg, screen recordings stay in WebM format
- For better quality, ffmpeg converts WebM → MP4 server-side

Server-side MP4 conversion:
- The server will attempt to convert uploaded WebM video to MP4 using `ffmpeg` if it's installed and on PATH
- If ffmpeg is not available, the original WebM will be kept
- The conversion uses H.264 video and AAC audio codecs for maximum compatibility
- Client-side conversion is attempted first, falling back to server-side if unavailable
- Users receive clear feedback about conversion status through toast notifications

Windows notes:
- On Windows PowerShell you may see an execution policy error when running npm scripts. Run these commands in PowerShell to use npm:

```powershell
# temporarily allow node's npm wrapper to run this session
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass;
npm install
npm start
```

Alternatively run node directly:

```powershell
node server.js
```

# Screen & Audio Recorder

Modern web app to record screen video and audio with a sleek UI and real-time feedback:

- 🎥 Screen recording with audio → MP4
- 🎙️ Audio capture (tab or mic) → MP3
- 🌓 Dark/light theme
- 📊 Audio visualization
- ⏱️ Recording timer
- 🎬 Live video preview
- 🔔 Toast notifications

## Features

- Records screen with audio, converts to MP4 (requires ffmpeg on server)
- Records tab/mic audio, converts to MP3 in-browser
- Modern UI with dark mode support
- Real-time audio visualization
- Recording timer and status indicators
- Live video preview for screen recording
- Toast notifications for better feedback

## Setup

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

## Notes

- Screen/tab capture requires Chrome with "Share audio" enabled
- If lamejs fails to load, audio uploads as WebM
- Without ffmpeg, screen recordings stay in WebM format
- For better quality, ffmpeg converts WebM → MP4 server-side

Server-side MP4 conversion:
- The server will attempt to convert uploaded WebM video to MP4 using `ffmpeg` if it's installed and on PATH. If ffmpeg is not available, the original WebM will be kept.

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

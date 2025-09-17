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

- **🎥 Screen Recording**: Capture screen with audio → MP4 via reliable backend processing
- **🎙️ Audio Recording**: Record tab/mic audio → MP3 with in-browser conversion
- **⚡ Backend Processing**: Cloudflare Worker handles video encoding and storage reliably
- **📦 Chunked Uploads**: Large file support with resumable uploads and automatic retry
- **🎨 Overlay Effects**: Add frames, labels, and icon overlays to recordings
- **🌓 Dark/Light Theme**: Modern UI with theme switching
- **📊 Real-time Visualization**: Audio waveform visualization during recording
- **⏱️ Recording Timer**: Live timer and status indicators
- **🎬 Live Preview**: Video preview for screen recording
- **🔔 Smart Notifications**: Toast notifications with detailed feedback
- **💾 Hybrid Storage**: Local IndexedDB + Cloud R2 storage with seamless downloads
- **🔒 Privacy First**: No external services, runs on your Cloudflare infrastructure

## Backend Processing System

### Overview
The app now features a robust **Cloudflare Worker backend** that handles video processing reliably, eliminating frontend crashes and failures that were common with large recordings.

### Key Improvements
- **Chunked Uploads**: Large videos are split into manageable chunks (1MB each) and uploaded progressively
- **Resumable Uploads**: Network interruptions don't lose progress - uploads can resume from where they left off  
- **Reliable Processing**: Heavy video encoding moved from browser to Worker backend
- **Smart Upload**: Automatically chooses optimal upload method based on file size
- **Progress Tracking**: Real-time upload progress with detailed chunk-level status
- **Automatic Fallback**: If backend is unavailable, gracefully falls back to local processing

### Technical Benefits
- **Eliminates Memory Issues**: No more browser crashes from large video processing
- **Network Resilience**: Chunked uploads handle poor network conditions  
- **Scalable**: Worker auto-scaling handles multiple concurrent uploads
- **Consistent**: Server-side processing guarantees reliable results
- **Future-Ready**: Foundation for advanced features like real-time transcoding

### User Experience
- **Faster Uploads**: Chunked uploads with progress tracking
- **Fewer Failures**: Backend processing eliminates most crash scenarios
- **Better Feedback**: Detailed status updates and error messages
- **Seamless Downloads**: Files available from both local storage and cloud

For technical implementation details, see [BACKEND_IMPLEMENTATION.md](./BACKEND_IMPLEMENTATION.md).

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

## Cloudflare Deployment

This app can be deployed to Cloudflare using both Cloudflare Pages (frontend) and Cloudflare Workers (backend API) with R2 storage for file uploads.

### Prerequisites

1. **Cloudflare account** with Pages and Workers enabled
2. **Wrangler CLI** installed globally:
   ```bash
   npm install -g wrangler
   ```
3. **Authenticate with Cloudflare**:
   ```bash
   wrangler login
   ```

### Setup Instructions

#### 1. Install Dependencies
```bash
npm install
```

#### 2. Configure Environment Variables

Copy the example environment file:
```bash
cp .env.example .env
```

Edit `.env` and update the `WORKER_URL` with your actual Cloudflare Worker subdomain:
```
WORKER_URL=https://screen-recorder-worker.youraccount.workers.dev
```

#### 3. Deploy the Worker (Backend API)

Create an R2 bucket for file storage:
```bash
wrangler r2 bucket create screen-recorder-files
```

Deploy the worker:
```bash
npm run cf:deploy:worker
```

This creates a Cloudflare Worker that handles:
- File uploads (`/upload`, `/upload-video`)
- File downloads (`/recordings/*`)
- Stores files in R2 bucket

#### 4. Deploy to Cloudflare Pages (Frontend)

**Option A: Git Integration (Recommended)**
1. Push your code to GitHub/GitLab
2. Connect your repository in the Cloudflare Pages dashboard
3. Set build settings:
   - Build command: (leave empty)
   - Build output directory: `public`
4. Add environment variable in Pages dashboard:
   - `WORKER_URL`: `https://screen-recorder-worker.youraccount.workers.dev`

**Option B: Direct Upload**
```bash
npm run cf:deploy:pages
```

#### 5. Configure Custom Domain (Optional)

1. **Add custom domain in Pages dashboard** (e.g., `screen-recorder.yourdomain.com`)
2. **Add custom domain for Worker** in Workers dashboard (e.g., `api.yourdomain.com`)
3. **Update environment variables** with your custom domains

#### 6. Update Worker URL in _redirects

Edit `public/_redirects` and replace `youraccount` with your actual Cloudflare account:
```
/upload https://screen-recorder-worker.youraccount.workers.dev/upload 200
/upload-video https://screen-recorder-worker.youraccount.workers.dev/upload-video 200
/recordings/* https://screen-recorder-worker.youraccount.workers.dev/recordings/:splat 200
```

### Configuration Files Explained

- **`wrangler.toml`** - Worker configuration and R2 bucket binding
- **`worker.js`** - Serverless backend API handling uploads and downloads
- **`public/_headers`** - Custom HTTP headers for Pages
- **`public/_redirects`** - API route proxying to Worker
- **`functions/api/[[path]].js`** - Pages function for API proxying (alternative to _redirects)

### Binding Pages and Worker

The frontend (Pages) and backend (Worker) are connected through:

1. **Environment Variables**: `WORKER_URL` points Pages to the Worker
2. **HTTP Redirects**: `_redirects` file proxies API calls to Worker
3. **R2 Storage Binding**: Worker uses R2 bucket for persistent file storage

### Local Development with Cloudflare

Start Worker locally:
```bash
npm run cf:dev:worker
```

Start Pages locally:
```bash
npm run cf:dev:pages
```

### Important Notes

- **R2 Storage**: Files are stored in Cloudflare R2, not local filesystem
- **No ffmpeg**: Server-side video conversion isn't available in Workers (use client-side conversion)
- **CORS**: Configured for cross-origin requests between Pages and Worker
- **File Limits**: Cloudflare has request size limits (100MB for Workers, 500MB for Pages)

### Troubleshooting

1. **Worker not accessible**: Check domain in `_redirects` matches your deployed Worker URL
2. **Upload failures**: Verify R2 bucket exists and Worker has proper bindings
3. **CORS errors**: Ensure Worker URL is correctly set in environment variables

For more details, see [Cloudflare Pages docs](https://developers.cloudflare.com/pages/) and [Workers docs](https://developers.cloudflare.com/workers/).

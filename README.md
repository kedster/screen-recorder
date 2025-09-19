# Screen & Audio Recorder

Modern web app to record screen video and audio with advanced MP4 conversion capabilities:

- 🎥 Screen recording with audio → MP4 (client-side and server-side conversion)
- 🎙️ Audio capture (tab or mic) → MP3  
- 🌓 Dark/light theme
- 📊 Audio visualization  
- ⏱️ Recording timer
- 🎬 Live video preview
- 🔔 Smart toast notifications
- ☁️ Cloudflare deployment ready

## Features

- **Advanced MP4 Conversion**: Intelligent conversion system with client-side FFmpeg.wasm and server-side fallback
- **Multiple Deployment Options**: Works with local Node.js server or Cloudflare Workers + Pages
- **Real-time Audio Processing**: Tab/mic audio recording with in-browser MP3 conversion
- **Modern Responsive UI**: Dark mode support, live previews, and intuitive controls
- **Smart Error Handling**: Graceful fallbacks when conversion services are unavailable
- **Progress Feedback**: Real-time conversion progress and detailed status messages

## Quick Start (Local)

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

3. Open http://localhost:3000

## Cloudflare Deployment

For production deployment with serverless backend:

### Prerequisites
```bash
# Install Wrangler CLI
npm install -g wrangler

# Authenticate with Cloudflare  
wrangler login
```

### Deploy Worker (Backend)
```bash
# Create R2 storage bucket
wrangler r2 bucket create screen-recorder-files

# Deploy the worker
npm run cf:deploy:worker
```

### Deploy Pages (Frontend) 
```bash
# Option 1: Direct deployment
npm run cf:deploy:pages

# Option 2: Connect Git repository (recommended)
# Go to Cloudflare Dashboard → Pages → Connect Git
```

### Configuration
1. Update `public/_redirects` with your worker URL
2. Set environment variables in Pages dashboard:
   - `WORKER_URL`: Your worker URL 
   - `CLOUDCONVERT_API_KEY`: (Optional) For enhanced server-side conversion

### Verification
```bash
./scripts/verify-cloudflare-setup.sh
```

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

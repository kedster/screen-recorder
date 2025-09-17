# Cloudflare Deployment Guide

This guide walks you through deploying the Screen Recorder app to Cloudflare Pages and Workers.

## Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Cloudflare     │    │  Cloudflare      │    │  Cloudflare R2  │
│  Pages          │───▶│  Worker          │───▶│  Storage        │
│  (Frontend)     │    │  (Backend API)   │    │  (Files)        │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

- **Cloudflare Pages**: Hosts the static frontend (HTML, CSS, JS)
- **Cloudflare Worker**: Handles API endpoints and file processing
- **Cloudflare R2**: Stores uploaded audio/video files
- **Bindings**: Connect Pages to Worker via environment variables and redirects

## Quick Start

### 1. Prerequisites
```bash
# Install Wrangler CLI globally
npm install -g wrangler

# Authenticate with Cloudflare
wrangler login
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment
```bash
# Copy environment template
cp .env.example .env

# Edit .env with your Cloudflare subdomain
# WORKER_URL=https://screen-recorder-worker.youraccount.workers.dev
```

### 4. Deploy Worker (Backend)
```bash
# Create R2 bucket
wrangler r2 bucket create screen-recorder-files

# Deploy the worker
npm run cf:deploy:worker
```

### 5. Deploy Pages (Frontend)
```bash
# Deploy directly
npm run cf:deploy:pages

# OR connect via Git in Cloudflare Dashboard (recommended)
```

### 6. Update Configuration
Update `public/_redirects` with your actual worker URL:
```
/upload https://screen-recorder-worker.YOURACCOUNT.workers.dev/upload 200
/upload-video https://screen-recorder-worker.YOURACCOUNT.workers.dev/upload-video 200
/recordings/* https://screen-recorder-worker.YOURACCOUNT.workers.dev/recordings/:splat 200
```

## File Structure

```
screen-recorder/
├── worker.js                    # Cloudflare Worker backend
├── wrangler.toml               # Worker configuration
├── public/                     # Frontend files for Pages
│   ├── _headers               # Custom HTTP headers
│   ├── _redirects             # API proxy rules
│   ├── index.html             # Main app
│   ├── app.js                 # Frontend logic
│   └── js/                    # Additional scripts
├── functions/                  # Pages Functions (alternative to _redirects)
│   └── api/[[path]].js        # API proxy function
├── .env.example               # Environment template
└── scripts/
    └── verify-cloudflare-setup.sh  # Setup verification
```

## Configuration Details

### Worker Configuration (`wrangler.toml`)
- Sets up R2 bucket binding named `RECORDINGS_BUCKET`
- Configures compatibility settings
- Defines environment-specific variables

### Pages Configuration
- `_headers`: Sets proper MIME types and security headers
- `_redirects`: Proxies API calls to the Worker
- `functions/`: Alternative API proxy using Pages Functions

### Environment Variables
- `WORKER_URL`: URL of your deployed Cloudflare Worker
- Used by Pages to know where to proxy API requests

## API Endpoints

The Worker provides these endpoints:

- `POST /upload` - Upload audio files
- `POST /upload-video` - Upload video files  
- `GET /recordings/:filename` - Download files

All files are stored in the R2 bucket and served with proper CORS headers.

## Binding Configuration

The connection between Pages and Worker is established through:

1. **Environment Variable**: `WORKER_URL` points to the Worker domain
2. **Redirects**: `_redirects` file proxies specific paths to the Worker
3. **R2 Binding**: Worker accesses R2 bucket via `env.RECORDINGS_BUCKET`

## Custom Domains (Optional)

1. Add custom domain in Pages dashboard
2. Add custom domain for Worker
3. Update `WORKER_URL` environment variable
4. Update `_redirects` file with new domains

## Troubleshooting

### Common Issues

**"Worker not found" errors:**
- Verify Worker is deployed: `wrangler list`
- Check URL in `_redirects` matches deployed Worker URL

**Upload failures:**
- Ensure R2 bucket exists: `wrangler r2 bucket list`
- Check Worker logs: `wrangler tail`

**CORS errors:**
- Verify `WORKER_URL` environment variable is set correctly
- Check Worker CORS headers are properly configured

### Verification Script
Run the setup verification script:
```bash
./scripts/verify-cloudflare-setup.sh
```

## Local Development

Start Worker locally:
```bash
npm run cf:dev:worker
```

Start Pages locally:
```bash
npm run cf:dev:pages
```

For local development, ensure your `.env` file points to the local Worker instance.

## Production Checklist

- [ ] R2 bucket created
- [ ] Worker deployed and accessible
- [ ] Pages deployed
- [ ] Environment variables configured
- [ ] `_redirects` file updated with correct Worker URL
- [ ] Custom domains configured (if using)
- [ ] Test file upload and download functionality
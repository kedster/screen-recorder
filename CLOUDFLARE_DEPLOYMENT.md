# Cloudflare Deployment Guide

This guide explains how to deploy the Screen Recorder application to Cloudflare Workers and Pages.

## Architecture

The application is split into two parts for Cloudflare deployment:

- **Frontend**: Static files deployed to Cloudflare Pages
- **Backend**: API deployed as a Cloudflare Worker with R2 storage

## Prerequisites

1. A Cloudflare account
2. GitHub repository with the application code
3. Node.js 18+ installed locally (for development)

## Setup Instructions

### 1. Cloudflare Configuration

1. **Create an R2 bucket** for file storage:
   - Go to Cloudflare Dashboard → R2 Object Storage
   - Create a new bucket named `screen-recorder-files`
   - Note your Account ID

2. **Get API credentials**:
   - Go to Cloudflare Dashboard → My Profile → API Tokens
   - Create a token with these permissions:
     - `Cloudflare Pages:Edit`
     - `Cloudflare Workers:Edit`
     - `Account:Read`
     - `Zone:Zone:Read` (if using custom domains)

### 2. GitHub Repository Setup

1. **Add GitHub Secrets** in your repository settings:
   ```
   CLOUDFLARE_API_TOKEN=your-api-token-here
   CLOUDFLARE_ACCOUNT_ID=your-account-id-here
   ```

2. **Update Worker URL** in the deployment workflow:
   - Edit `.github/workflows/deploy.yml`
   - Replace `your-account` with your actual Cloudflare account identifier

### 3. Local Development

1. **Install Wrangler CLI**:
   ```bash
   npm install -g wrangler
   ```

2. **Authenticate with Cloudflare**:
   ```bash
   wrangler login
   ```

3. **Update wrangler.toml**:
   - Replace `your-kv-namespace-id` with actual IDs if using KV
   - Update the R2 bucket name if different

4. **Test Worker locally**:
   ```bash
   npm run dev:worker
   ```

5. **Test Pages build**:
   ```bash
   npm run build:pages
   ```

### 4. Deployment

#### Automatic Deployment (Recommended)

Push to the `main` branch, and GitHub Actions will automatically:
1. Build and deploy the frontend to Cloudflare Pages
2. Deploy the backend Worker
3. Configure the frontend to use the Worker API

#### Manual Deployment

1. **Deploy Worker**:
   ```bash
   npm run deploy:worker
   ```

2. **Deploy Pages**:
   ```bash
   npm run deploy:pages
   # Then manually upload the dist/ folder to Cloudflare Pages
   ```

## Configuration Options

### Environment Variables

- `WORKER_URL`: The URL of your deployed Cloudflare Worker
- `ENVIRONMENT`: Deployment environment (staging/production)

### Worker Configuration

Edit `wrangler.toml` to customize:
- Worker name and routes
- R2 bucket bindings
- KV namespace bindings (for metadata storage)
- Environment-specific variables

### Pages Configuration

Edit `_redirects` to customize:
- API proxy rules
- Static file headers
- Security policies

## File Storage

Files are stored in Cloudflare R2 with the following structure:
```
recordings/
├── audio-file-1.mp3
├── video-file-1.webm
└── video-file-2.mp4
```

Metadata is stored as R2 object metadata including:
- Original filename
- Upload timestamp
- File size
- Content type

## Limitations

- **No server-side video conversion**: FFmpeg is not available in Workers
- **File size limits**: Workers have request/response size limits
- **Processing time**: Workers have execution time limits

## Troubleshooting

### Common Issues

1. **CORS errors**: Check Worker CORS configuration
2. **File upload failures**: Verify R2 bucket permissions
3. **API not found**: Check Worker deployment and URL configuration

### Debugging

1. **Check Worker logs**:
   ```bash
   wrangler tail
   ```

2. **Test API endpoints**:
   ```bash
   curl -X POST https://your-worker.workers.dev/upload
   ```

3. **Verify Pages deployment**:
   - Check Cloudflare Pages dashboard
   - Verify build logs

## Security

- CORS is configured for cross-origin requests
- Security headers are set for static files
- R2 bucket should be configured with appropriate access policies

## Cost Optimization

- Use Cloudflare's free tier for small workloads
- Monitor R2 storage usage
- Consider file cleanup policies for old recordings
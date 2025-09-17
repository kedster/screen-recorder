# Cloudflare Deployment Quick Start

## 🚀 Ready to Deploy!

This repository is now configured for Cloudflare Workers and Pages deployment.

### What's Been Set Up

✅ **Cloudflare Worker** - Backend API with R2 storage  
✅ **Cloudflare Pages** - Static frontend hosting  
✅ **GitHub Actions** - Automated deployment workflows  
✅ **Build Scripts** - API endpoint configuration  
✅ **Documentation** - Complete deployment guide  

### Quick Deployment Steps

1. **Create R2 Bucket**
   ```
   Cloudflare Dashboard → R2 → Create bucket: "screen-recorder-files"
   ```

2. **Set GitHub Secrets**
   ```
   Repository → Settings → Secrets:
   - CLOUDFLARE_API_TOKEN
   - CLOUDFLARE_ACCOUNT_ID
   ```

3. **Update Configuration**
   ```bash
   # Edit wrangler.toml - replace "your-account" with actual account
   # Edit .github/workflows/deploy.yml - update Worker URL
   ```

4. **Deploy**
   ```bash
   git push origin main  # Triggers automatic deployment
   ```

### Local Development

```bash
# Install Wrangler
npm install -g wrangler

# Authenticate
wrangler login

# Start Worker dev server
npm run dev:worker

# Build frontend
npm run build:pages

# Validate configuration
npm run validate-config
```

### File Structure

```
├── src/worker.js              # Cloudflare Worker code
├── wrangler.toml             # Worker configuration
├── .github/workflows/        # Deployment automation
├── scripts/                  # Build utilities
├── public/                   # Frontend source
└── CLOUDFLARE_DEPLOYMENT.md  # Detailed guide
```

📚 **Read the [full deployment guide](CLOUDFLARE_DEPLOYMENT.md) for detailed instructions.**
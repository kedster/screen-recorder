# Node.js Version Issue Resolution

## Problem
The error "Wrangler requires at least Node.js v20.0.0. You are using v18.20.8" occurs when trying to use Cloudflare Wrangler with an outdated Node.js version.

## Solution Applied
This repository has been updated to enforce Node.js v20+ and include all necessary Cloudflare deployment configuration:

### 1. Node.js Version Requirements
- Added `"engines": {"node": ">=20.0.0"}` to `package.json`
- Created `.nvmrc` file with `20.0.0` to standardize version across environments
- Added `npm run check-node` script to verify Node.js version compatibility

### 2. Cloudflare Configuration
- Added complete `wrangler.toml` configuration for Workers
- Added `worker.js` with full API handling (upload, download, CORS)
- Added `public/_redirects` for API routing
- Added `public/_headers` for security and CORS
- Added `.env.example` for environment configuration
- Updated to Wrangler v4.37.1 (latest version)

### 3. Usage Instructions

#### Check Node.js Version
```bash
npm run check-node
```

#### Upgrade Node.js (if needed)
Using nvm (recommended):
```bash
nvm install 20
nvm use 20
```

Using n:
```bash
n 20
```

#### Install Dependencies
```bash
npm install
```

#### Cloudflare Setup
```bash
# 1. Login to Cloudflare
wrangler login

# 2. Create R2 bucket
npm run cf:setup:bucket

# 3. Deploy worker
npm run cf:deploy:worker

# 4. Deploy pages
npm run cf:deploy:pages
```

### 4. Development
```bash
# Local development
npm run cf:dev:worker    # Start worker locally
npm run cf:dev:pages     # Start pages locally

# Traditional Node.js server
npm start
```

## Verification
After these changes, Wrangler should work without version errors. The `npm run check-node` command will verify compatibility and provide next steps.
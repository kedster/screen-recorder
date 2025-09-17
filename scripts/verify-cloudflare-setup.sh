#!/bin/bash
# Cloudflare Setup Verification Script

echo "🔍 Verifying Cloudflare configuration..."

# Check Node.js version (required for Wrangler)
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js v20+ from https://nodejs.org"
    exit 1
fi

NODE_VERSION=$(node --version | sed 's/v//')
MAJOR_VERSION=$(echo $NODE_VERSION | cut -d. -f1)

if [ "$MAJOR_VERSION" -lt 20 ]; then
    echo "❌ Node.js v$NODE_VERSION found, but Wrangler requires v20+. Please update:"
    echo "   Using nvm: nvm install 20 && nvm use 20"
    echo "   Or download from: https://nodejs.org"
    exit 1
fi

echo "✅ Node.js v$NODE_VERSION (meets Wrangler v20+ requirement)"

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI not found. Install with: npm install -g wrangler"
    exit 1
fi

echo "✅ Wrangler CLI found"

# Check if user is logged in
if ! wrangler whoami &> /dev/null; then
    echo "❌ Not logged in to Cloudflare. Run: wrangler login"
    exit 1
fi

echo "✅ Cloudflare authentication verified"

# Check if wrangler.toml exists
if [ ! -f "wrangler.toml" ]; then
    echo "❌ wrangler.toml not found"
    exit 1
fi

echo "✅ wrangler.toml configuration found"

# Check if worker.js exists
if [ ! -f "worker.js" ]; then
    echo "❌ worker.js not found"
    exit 1
fi

echo "✅ Worker script found"

# Check if public directory exists
if [ ! -d "public" ]; then
    echo "❌ public directory not found"
    exit 1
fi

echo "✅ Public directory found"

# Check for required public files
required_files=("public/_headers" "public/_redirects" "public/index.html")
for file in "${required_files[@]}"; do
    if [ ! -f "$file" ]; then
        echo "❌ Required file missing: $file"
        exit 1
    fi
done

echo "✅ All required public files found"

# Check if .env.example exists
if [ ! -f ".env.example" ]; then
    echo "❌ .env.example not found"
    exit 1
fi

echo "✅ Environment example file found"

echo ""
echo "🎉 Cloudflare configuration verification complete!"
echo ""
echo "Next steps:"
echo "1. Create R2 bucket: wrangler r2 bucket create screen-recorder-files"
echo "2. Deploy worker: npm run cf:deploy:worker"
echo "3. Deploy pages: npm run cf:deploy:pages"
echo "4. Update WORKER_URL in .env and _redirects with your actual subdomain"
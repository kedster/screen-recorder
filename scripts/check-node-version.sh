#!/bin/bash

# Node.js Version Check Script
# Ensures the correct Node.js version is being used for Wrangler compatibility

echo "🔍 Checking Node.js version requirements..."

# Check current Node.js version
NODE_VERSION=$(node --version | sed 's/v//')
REQUIRED_VERSION="20.0.0"

echo "Current Node.js version: v$NODE_VERSION"
echo "Required Node.js version: v$REQUIRED_VERSION or higher"

# Compare versions using Node.js itself
version_check=$(node -e "
const current = '$NODE_VERSION'.split('.').map(Number);
const required = '$REQUIRED_VERSION'.split('.').map(Number);
const isValid = current[0] > required[0] || 
  (current[0] === required[0] && current[1] > required[1]) ||
  (current[0] === required[0] && current[1] === required[1] && current[2] >= required[2]);
console.log(isValid);
")

if [ "$version_check" = "true" ]; then
    echo "✅ Node.js version is compatible with Wrangler"
    
    # Check if wrangler is available
    if command -v npx >/dev/null 2>&1; then
        echo "✅ npx is available"
        
        # Check wrangler version
        echo ""
        echo "📦 Checking Wrangler version..."
        npx wrangler --version
        
        echo ""
        echo "🎉 Setup verification complete!"
        echo ""
        echo "Next steps:"
        echo "1. Run 'wrangler login' to authenticate with Cloudflare"
        echo "2. Create R2 bucket: 'npm run cf:setup:bucket'"
        echo "3. Deploy worker: 'npm run cf:deploy:worker'"
        echo "4. Deploy pages: 'npm run cf:deploy:pages'"
        
    else
        echo "❌ npx not found. Please ensure npm is properly installed."
        exit 1
    fi
else
    echo "❌ Node.js version $NODE_VERSION is too old!"
    echo "🔧 Please upgrade to Node.js v$REQUIRED_VERSION or higher"
    echo ""
    echo "Upgrade options:"
    echo "- Using nvm: 'nvm install 20 && nvm use 20'"
    echo "- Using n: 'n 20'"
    echo "- Download from: https://nodejs.org/"
    exit 1
fi
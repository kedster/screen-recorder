#!/bin/bash
# Node.js compatibility check script

echo "🔍 Checking Node.js compatibility for Wrangler..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found!"
    echo "Please install Node.js v20+ from https://nodejs.org"
    exit 1
fi

# Get Node.js version
NODE_VERSION=$(node --version | sed 's/v//')
MAJOR_VERSION=$(echo $NODE_VERSION | cut -d. -f1)

echo "Current Node.js version: v$NODE_VERSION"

# Check if version meets requirements
if [ "$MAJOR_VERSION" -lt 20 ]; then
    echo "❌ Incompatible Node.js version!"
    echo ""
    echo "Wrangler requires Node.js v20.0.0 or higher"
    echo "You are currently using v$NODE_VERSION"
    echo ""
    echo "To update Node.js:"
    echo "  • Using nvm: nvm install 20 && nvm use 20"
    echo "  • Or download from: https://nodejs.org"
    exit 1
else
    echo "✅ Compatible Node.js version (v20+ requirement met)"
    
    # Test Wrangler if available
    if command -v wrangler &> /dev/null || command -v npx &> /dev/null; then
        echo ""
        echo "Testing Wrangler compatibility..."
        if command -v wrangler &> /dev/null; then
            wrangler --version 2>/dev/null && echo "✅ Wrangler is working correctly"
        elif command -v npx &> /dev/null; then
            npx wrangler --version 2>/dev/null && echo "✅ Wrangler is working correctly via npx"
        fi
    fi
    
    echo ""
    echo "🎉 Your system is ready for Cloudflare Wrangler!"
fi
#!/bin/bash
# Quick Cloudflare Deployment Script for Screen Recorder

set -e

echo "🚀 Starting Cloudflare deployment for Screen Recorder..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check prerequisites
if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}❌ Wrangler CLI not found. Installing...${NC}"
    npm install -g wrangler@latest
fi

if ! wrangler whoami &> /dev/null; then
    echo -e "${YELLOW}⚠️  Not authenticated with Cloudflare. Please run: wrangler login${NC}"
    echo "After authentication, run this script again."
    exit 1
fi

echo -e "${GREEN}✅ Prerequisites check passed${NC}"

# Create R2 bucket if it doesn't exist
echo -e "${YELLOW}📦 Setting up R2 storage bucket...${NC}"
if ! wrangler r2 bucket list | grep -q "screen-recorder-files"; then
    echo "Creating R2 bucket..."
    wrangler r2 bucket create screen-recorder-files
    echo -e "${GREEN}✅ R2 bucket created${NC}"
else
    echo -e "${GREEN}✅ R2 bucket already exists${NC}"
fi

# Deploy the Worker
echo -e "${YELLOW}⚡ Deploying Cloudflare Worker...${NC}"
wrangler deploy
echo -e "${GREEN}✅ Worker deployed successfully${NC}"

# Get the deployed Worker URL
echo -e "${YELLOW}🔍 Getting Worker URL...${NC}"
WORKER_URL=$(wrangler list --format json 2>/dev/null | jq -r '.[] | select(.name=="screen-recorder-worker") | "https://\(.name).\(.subdomain).workers.dev"' 2>/dev/null || echo "")

if [ -z "$WORKER_URL" ]; then
    echo -e "${YELLOW}⚠️  Could not auto-detect Worker URL. Please check manually with 'wrangler list'${NC}"
    WORKER_URL="https://screen-recorder-worker.YOUR_SUBDOMAIN.workers.dev"
else
    echo -e "${GREEN}✅ Worker URL: $WORKER_URL${NC}"
    
    # Update _redirects file
    echo -e "${YELLOW}🔧 Updating _redirects file...${NC}"
    sed -i.bak "s|https://screen-recorder-worker.youraccount.workers.dev|$WORKER_URL|g" public/_redirects
    echo -e "${GREEN}✅ _redirects file updated${NC}"
fi

# Test the Worker
echo -e "${YELLOW}🧪 Testing Worker deployment...${NC}"
if curl -s --max-time 10 "$WORKER_URL" | jq -e '.status == "healthy"' > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Worker is healthy and responding${NC}"
else
    echo -e "${YELLOW}⚠️  Worker might still be deploying. Test manually: $WORKER_URL${NC}"
fi

# Instructions for Pages deployment
echo ""
echo -e "${GREEN}🎉 Worker deployment complete!${NC}"
echo ""
echo -e "${YELLOW}Next steps for Pages deployment:${NC}"
echo "1. Deploy Pages:"
echo "   wrangler pages deploy public --project-name screen-recorder"
echo ""
echo "2. Or connect Git repository:"
echo "   • Go to Cloudflare Dashboard → Pages"
echo "   • Click 'Connect to Git' and select your repository"
echo "   • Set build output directory to 'public'"
echo ""
echo "3. Set environment variable in Pages dashboard:"
echo "   WORKER_URL=$WORKER_URL"
echo ""
echo "4. Optional: Add CloudConvert API key for enhanced MP4 conversion:"
echo "   CLOUDCONVERT_API_KEY=your-api-key-here"
echo ""
echo -e "${GREEN}✅ Deployment ready! Your app will be available at: https://screen-recorder.pages.dev${NC}"
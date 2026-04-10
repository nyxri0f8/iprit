# Manual Netlify Deployment Script
# This script deploys pre-built files without running build commands

Write-Host "🚀 Starting manual deployment to Netlify..." -ForegroundColor Cyan

# Build locally first
Write-Host "📦 Building frontend locally..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Build successful!" -ForegroundColor Green

# Deploy using netlify deploy with --build flag to skip build
Write-Host "🌐 Deploying to Netlify..." -ForegroundColor Yellow

# Use the manual deploy API
netlify deploy --prod --dir=dist --message="Manual deployment $(Get-Date -Format 'yyyy-MM-dd HH:mm')"

Write-Host "✅ Deployment complete!" -ForegroundColor Green
Write-Host "🌍 Your site is live at: https://ritipr.netlify.app" -ForegroundColor Cyan

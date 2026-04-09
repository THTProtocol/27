#!/bin/bash

# HTP Firebase Deployment Script
# This script deploys the HTP platform with Resolver fixes to Firebase

set -e

PROJECT_ID="hightable420"
SITE="hightable420"
DEPLOY_DIR="/workspaces/27/27"

echo "============================================"
echo "🚀 HTP Platform Firebase Deployment"
echo "============================================"
echo ""
echo "Project: $PROJECT_ID"
echo "Site: $SITE"
echo "Deploy from: $DEPLOY_DIR"
echo ""

# Check if firebase-tools is installed
if ! command -v firebase &> /dev/null; then
    echo "Installing Firebase CLI..."
    npm install -g firebase-tools
fi

cd "$DEPLOY_DIR"

# Push to GitHub first
echo "📤 Pushing to GitHub..."
cd /workspaces/27
git add -A
git commit -m "chore: Prepare deployment with Resolver fixes" 2>/dev/null || echo "No changes to commit"
git push origin main

echo ""
echo "============================================"
echo "📡 Connecting to Firebase..."
echo "============================================"
echo ""

# Try using FIREBASE_TOKEN if set
if [ -z "$FIREBASE_TOKEN" ]; then
    echo "⚠️  FIREBASE_TOKEN not set. Attempting interactive login..."
    echo ""
    echo "Opening browser for Firebase authentication..."
    echo "Please complete the login in your browser, then come back here."
    echo ""
    
    cd "$DEPLOY_DIR"
    firebase login
else
    echo "✅ Using FIREBASE_TOKEN from environment"
fi

echo ""
echo "============================================"
echo "🔄 Deploying to Firebase Hosting..."
echo "============================================"
echo ""

# Deploy
cd "$DEPLOY_DIR"
firebase deploy --project $PROJECT_ID --only hosting

echo ""
echo "============================================"
echo "✅ Deployment Complete!"
echo "============================================"
echo ""
echo "🌐 Your site is now live at:"
echo "   https://$SITE.web.app"
echo ""
echo "📋 Deployed with:"
echo "   ✓ Kaspa Resolver for TN12 (no WASM issues)"
echo "   ✓ Parimutuel covenant logic"
echo "   ✓ Tournament engine"
echo "   ✓ Permissionless claim tool"
echo ""
echo "🧪 Test it:"
echo "   1. Open https://$SITE.web.app in your browser"
echo "   2. Open DevTools (F12)"
echo "   3. Check console for:"
echo "      - window.HTP_NETWORK should be 'tn12'"
echo "      - window.HTP_RESOLVER_ALIAS should be 'tn12'"
echo "   4. Resolver should connect instantly (no WASM timeout)"
echo ""

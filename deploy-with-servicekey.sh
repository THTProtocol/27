#!/bin/bash

# Deploy HTP using Service Account Key
# Usage: ./deploy-with-servicekey.sh /path/to/serviceAccountKey.json

if [ -z "$1" ]; then
    echo "Usage: $0 /path/to/serviceAccountKey.json"
    echo ""
    echo "OR download the key from:"
    echo "https://console.firebase.google.com/project/hightable420/settings/serviceaccounts/adminsdk"
    echo ""
    echo "Instructions:"
    echo "1. Go to: https://console.firebase.google.com/project/hightable420/settings/serviceaccounts/adminsdk"
    echo "2. Click 'Generate New Private Key'"
    echo "3. Save the JSON file to: /tmp/firebase-key.json"  
    echo "4. Run: $0 /tmp/firebase-key.json"
    exit 1
fi

KEY_FILE="$1"

if [ ! -f "$KEY_FILE" ]; then
    echo "Error: File not found: $KEY_FILE"
    exit 1
fi

echo "✅ Using service account key: $KEY_FILE"
echo ""

export GOOGLE_APPLICATION_CREDENTIALS="$KEY_FILE"
export PROJECT_ID="hightable420"

cd /workspaces/27/27 || exit 1

echo "🚀 Deploying with service account..."
firebase deploy --project "$PROJECT_ID" --only hosting

echo ""
echo "✅ Deployment complete!"
echo "🌐 Live at: https://hightable420.web.app"

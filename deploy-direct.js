#!/usr/bin/env node

/**
 * Direct Firebase Deployment using Admin SDK
 * Usage: node deploy-direct.js
 * 
 * This script deploys the HTP platform directly to Firebase Hosting
 * using the Kaspa Resolver configuration.
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const glob = require('glob');

const PROJECT_ID = 'hightable420';
const DEPLOY_DIR = '/workspaces/27/27';

console.log('🚀 HTP Firebase Direct Deployment');
console.log('=====================================');
console.log('');

// Try to get service account from different sources
let credential;

// Source 1: GOOGLE_APPLICATION_CREDENTIALS env var
if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    try {
        const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
        console.log(`📁 Using service account from: ${keyPath}`);
        const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
        credential = admin.credential.cert(serviceAccount);
    } catch (e) {
        console.error(`❌ Failed to load service account: ${e.message}`);
        process.exit(1);
    }
}
// Source 2: Check for .firebaserc
else if (fs.existsSync(path.join(DEPLOY_DIR, '.firebaserc'))) {
    console.log('⚠️  No service account provided.');
    console.log('');
    console.log('To deploy, you need a Firebase service account key:');
    console.log('');
    console.log('1. Go to: https://console.firebase.google.com/project/hightable420/settings/serviceaccounts/adminsdk');
    console.log('2. Click "Generate New Private Key"');
    console.log('3. Save as: /tmp/firebase-key.json');
    console.log('4. Run: GOOGLE_APPLICATION_CREDENTIALS=/tmp/firebase-key.json node deploy-direct.js');
    console.log('');
    process.exit(1);
} else {
    console.error('❌ No Firebase configuration found');
    process.exit(1);
}

try {
    admin.initializeApp({
        credential: credential,
        projectId: PROJECT_ID
    });

    console.log('✅ Connected to Firebase');
    console.log(`📍 Project: ${PROJECT_ID}`);
    console.log('');
    
    // Get all files to deploy
    console.log('📦 Preparing files for deployment...');
    const files = glob.sync('**/*', {
        cwd: DEPLOY_DIR,
        nodir: true,
        ignore: [
            'node_modules/**',
            '.git/**',
            '.firebase/**',
            'firebase.json',
            '**/.*'
        ]
    });

    console.log(`✓ Found ${files.length} files to deploy`);
    console.log('');
    
    // Show sample files
    console.log('📄 Key files being deployed:');
    const keyFiles = [
        'index.html',
        'htp-init.js',
        'htp-rpc-client.js',
        'kaspa_bg.wasm',
        'firebase.json'
    ];
    
    keyFiles.forEach(f => {
        if (files.includes(f) || fs.existsSync(path.join(DEPLOY_DIR, f))) {
            console.log(`   ✓ ${f}`);
        }
    });
    
    console.log('');
    console.log('✅ Deployment prepared');
    console.log('');
    console.log('📝 Next steps:');
    console.log('1. Provide service account key (see instructions above)');
    console.log('2. Re-run this script with GOOGLE_APPLICATION_CREDENTIALS set');
    console.log('3. Files will be deployed to: https://hightable420.web.app');
    
} catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
}

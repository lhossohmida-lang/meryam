// =============================================================================
//  WALIDA — PWABuilder APK Generator
// =============================================================================
//  Uses pwabuilder.com API to build an Android APK from the deployed PWA URL.
//  Run this after deploying to Firebase Hosting.
//
//  Usage:
//    node generate-apk.mjs <your-firebase-url>
//  Example:
//    node generate-apk.mjs https://walida.web.app
//
//  Output:
//    ./apk/baraa-kids.apk
//    ./public/apk/baraa-kids.apk
// =============================================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SITE_URL = process.argv[2] || 'https://walida.web.app';

console.log(`\n🚀 Building APK for: ${SITE_URL}\n`);

// PWABuilder API endpoint
const PWABUILDER_API = 'https://pwabuilder-api.azurewebsites.net/api/package';

const payload = JSON.stringify({
  siteUrl: SITE_URL,
  packageId: 'com.baraa.kids',
  name: 'Baraa Kids',
  launcherName: 'براءة',
  themeColor: '#FFB4A2',
  backgroundColor: '#FFF6F0',
  display: 'standalone',
  orientation: 'portrait',
  startUrl: '/',
  iconUrl: `${SITE_URL}/icons/icon-512.png`,
  maskableIconUrl: `${SITE_URL}/icons/icon-512.png`,
  versionCode: 1,
  versionName: '1.0.0',
  signingMode: 'none', // debug signing
  platform: 'androidapk'
});

const options = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
};

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        return downloadFile(res.headers.location, dest).then(resolve).catch(reject);
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function buildAPK() {
  try {
    // Ensure output directories exist
    const apkDir     = path.join(__dirname, 'apk');
    const publicApk  = path.join(__dirname, 'public', 'apk');
    const distApk    = path.join(__dirname, 'dist', 'apk');
    fs.mkdirSync(apkDir,    { recursive: true });
    fs.mkdirSync(publicApk, { recursive: true });
    fs.mkdirSync(distApk,   { recursive: true });

    console.log('📡 Sending request to PWABuilder API...');

    const response = await fetch(PWABUILDER_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`API error ${response.status}: ${text}`);
    }

    const data = await response.json();
    const downloadUrl = data.uri || data.url || data.downloadUrl;

    if (!downloadUrl) {
      console.log('API Response:', JSON.stringify(data, null, 2));
      throw new Error('No download URL in response');
    }

    console.log(`✅ APK ready! Downloading from: ${downloadUrl}`);

    const apkPath       = path.join(apkDir,    'baraa-kids.apk');
    const publicApkPath = path.join(publicApk, 'baraa-kids.apk');
    const distApkPath   = path.join(distApk,   'baraa-kids.apk');

    await downloadFile(downloadUrl, apkPath);
    fs.copyFileSync(apkPath, publicApkPath);
    fs.copyFileSync(apkPath, distApkPath);

    const size = (fs.statSync(apkPath).size / (1024 * 1024)).toFixed(2);
    console.log(`\n✅ APK saved! (${size} MB)`);
    console.log(`   → ${apkPath}`);
    console.log(`   → ${publicApkPath}`);
    console.log(`   → ${distApkPath}`);
    console.log('\n🎉 Done! Users can now download the APK from the app.\n');

  } catch (err) {
    console.error('\n❌ Error:', err.message);
    console.log('\n💡 Alternative: Visit https://www.pwabuilder.com and enter your site URL');
    console.log('   to manually build and download the APK, then place it in ./apk/\n');
    process.exit(1);
  }
}

buildAPK();

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Parse package.json for version
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf-8'));
const version = pkg.version;
const token = process.env.GH_TOKEN;
const repo = "nkorolev12/data-processor-app";

const expectedFiles = [
  `DataProcessor-Setup-${version}.exe`,
  `DataProcessor-Setup-${version}.exe.blockmap`,
  `latest.yml`
];

async function main() {
  console.log(`\n========================================================`);
  console.log(` 🔍 VERIFYING GITHUB RELEASE v${version}`);
  console.log(`========================================================\n`);

  try {
    // 1. Fetch release info
    const res = await fetch(`https://api.github.com/repos/${repo}/releases/tags/v${version}`, {
      headers: {
        'User-Agent': 'NodeJS',
        'Authorization': `token ${token}`
      }
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch release: ${res.statusText}`);
    }

    const release = await res.json();
    const assets = release.assets || [];
    const uploadedAssetNames = assets.map(a => a.name);

    console.log(`Assets found on GitHub: ${uploadedAssetNames.length > 0 ? uploadedAssetNames.join(', ') : 'None'}`);

    // 2. Check for missing files
    const missingFiles = expectedFiles.filter(f => !uploadedAssetNames.includes(f));

    if (missingFiles.length === 0) {
      console.log(`\n✅ SUCCESS: All ${expectedFiles.length} files are successfully uploaded!`);
      return;
    }

    console.log(`\n⚠️  WARNING: Found ${missingFiles.length} missing files on GitHub!`);
    
    // 3. Upload missing files
    const uploadUrlBase = release.upload_url.split('{')[0];
    
    for (const file of missingFiles) {
      // GitHub replaces spaces with dashes, so local files have spaces
      const localFileName = file.replace('DataProcessor-Setup-', 'DataProcessor Setup ');
      const localPath = path.join(__dirname, '../dist', localFileName);
      console.log(`\n-> Fixing missing file: ${file} (Local: ${localFileName})`);
      
      if (!fs.existsSync(localPath)) {
        console.log(`   [ERROR] Local file not found: ${localPath}`);
        continue;
      }

      console.log(`   Uploading ${file} (${Math.round(fs.statSync(localPath).size / 1024 / 1024)} MB)...`);
      
      const fileData = fs.readFileSync(localPath);
      const uploadUrl = `${uploadUrlBase}?name=${encodeURIComponent(file)}`;
      
      const contentType = file.endsWith('.yml') ? 'application/yaml' : 'application/octet-stream';
      
      const upRes = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `token ${token}`,
          'Content-Type': contentType,
          'Content-Length': fileData.length
        },
        body: fileData
      });

      if (!upRes.ok) {
        const errText = await upRes.text();
        console.log(`   [FAILED] Upload error: ${errText}`);
      } else {
        console.log(`   [SUCCESS] ${file} uploaded.`);
      }
    }

    console.log(`\n✅ VERIFICATION COMPLETE. All files should now be present.\n`);

  } catch (error) {
    console.error(`\n❌ VERIFICATION ERROR:`, error.message);
  }
}

main();

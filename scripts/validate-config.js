/**
 * Validation script to check Cloudflare deployment configuration
 */

const fs = require('fs');
const path = require('path');

const requiredFiles = [
  'wrangler.toml',
  'src/worker.js',
  '.github/workflows/deploy.yml',
  'scripts/update-api-endpoints.js',
  '_redirects',
  'CLOUDFLARE_DEPLOYMENT.md'
];

const requiredDirs = [
  'src',
  '.github/workflows',
  'scripts'
];

function validateConfiguration() {
  console.log('🔍 Validating Cloudflare deployment configuration...\n');

  let isValid = true;

  // Check required directories
  console.log('📁 Checking directories:');
  requiredDirs.forEach(dir => {
    if (fs.existsSync(dir)) {
      console.log(`  ✅ ${dir}`);
    } else {
      console.log(`  ❌ ${dir} - Missing`);
      isValid = false;
    }
  });

  // Check required files
  console.log('\n📄 Checking files:');
  requiredFiles.forEach(file => {
    if (fs.existsSync(file)) {
      console.log(`  ✅ ${file}`);
    } else {
      console.log(`  ❌ ${file} - Missing`);
      isValid = false;
    }
  });

  // Check package.json scripts
  console.log('\n📦 Checking package.json scripts:');
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const requiredScripts = ['build:pages', 'dev:worker', 'deploy:worker'];
  
  requiredScripts.forEach(script => {
    if (packageJson.scripts && packageJson.scripts[script]) {
      console.log(`  ✅ ${script}`);
    } else {
      console.log(`  ❌ ${script} - Missing`);
      isValid = false;
    }
  });

  // Check wrangler.toml configuration
  console.log('\n⚙️ Checking wrangler.toml:');
  try {
    const wranglerConfig = fs.readFileSync('wrangler.toml', 'utf8');
    
    if (wranglerConfig.includes('name = "screen-recorder-api"')) {
      console.log('  ✅ Worker name configured');
    } else {
      console.log('  ⚠️ Worker name not found');
    }

    if (wranglerConfig.includes('RECORDINGS_BUCKET')) {
      console.log('  ✅ R2 bucket binding configured');
    } else {
      console.log('  ⚠️ R2 bucket binding not found');
    }
  } catch (error) {
    console.log('  ❌ Error reading wrangler.toml');
    isValid = false;
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  if (isValid) {
    console.log('🎉 Configuration validation passed!');
    console.log('\nNext steps:');
    console.log('1. Update wrangler.toml with your account details');
    console.log('2. Set up GitHub secrets for deployment');
    console.log('3. Create R2 bucket in Cloudflare dashboard');
    console.log('4. Test local development with `npm run dev:worker`');
  } else {
    console.log('❌ Configuration validation failed!');
    console.log('Please check the missing files and directories above.');
  }

  return isValid;
}

if (require.main === module) {
  validateConfiguration();
}

module.exports = { validateConfiguration };
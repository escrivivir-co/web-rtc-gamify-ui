#!/usr/bin/env node

/**
 * PostInstall Script for webrtc-gamification-ui
 * Automatically copies built assets to public_templates/webrtc-ui/
 * Following the pattern established by threejs-gamify-ui
 */

const fs = require('fs');
const path = require('path');

function copyDirectory(src, dest) {
  if (!fs.existsSync(src)) {
    console.log(`⚠️  Source directory not found: ${src}`);
    return false;
  }

  // Create destination directory
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  // Copy files recursively
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
  
  return true;
}

function main() {
  console.log('📦 Installing WebRTC Gamification UI assets...');
  
  // We're being installed as a dependency
  const packageRoot = __dirname;
  
  // Source: compiled library distribution
  const sourceDir = path.join(packageRoot, '..', 'dist', 'webrtc-ui-lib');
  
  // Find the project root (where this package is installed)
  let projectRoot = packageRoot;
  let depth = 0;
  
  while (depth < 10) {
    const parentDir = path.dirname(projectRoot);
    if (parentDir === projectRoot) break; // reached filesystem root
    
    projectRoot = parentDir;
    depth++;
    
    // Check if we're in node_modules and find the actual project root
    if (projectRoot.includes('node_modules')) {
      const parts = projectRoot.split(path.sep);
      const nodeModulesIndex = parts.lastIndexOf('node_modules');
      if (nodeModulesIndex > 0) {
        projectRoot = parts.slice(0, nodeModulesIndex).join(path.sep);
        break;
      }
    }
    
    // Check if we found a project root
    if (fs.existsSync(path.join(projectRoot, 'package.json')) && 
        !projectRoot.includes('node_modules')) {
      break;
    }
  }
  
  // Target: public_templates directory in the consuming project
  const targetDir = path.join(projectRoot, 'public_templates', 'webrtc-ui');
  
  console.log(`📍 Project root: ${projectRoot}`);
  console.log(`📂 Source: ${sourceDir}`);
  console.log(`📁 Target: ${targetDir}`);
  
  // Check if source exists
  if (!fs.existsSync(sourceDir)) {
    console.log('⚠️  WebRTC UI library dist not found. Build the library first:');
    console.log('   npm run build');
    return;
  }
  
  // Create public_templates directory if it doesn't exist
  const publicTemplatesDir = path.join(projectRoot, 'public_templates');
  if (!fs.existsSync(publicTemplatesDir)) {
    fs.mkdirSync(publicTemplatesDir, { recursive: true });
    console.log(`✅ Created public_templates directory`);
  }
  
  // Copy assets
  console.log('🔄 Copying WebRTC UI assets...');
  
  if (copyDirectory(sourceDir, targetDir)) {
    console.log('✅ WebRTC UI assets installed successfully!');
    console.log(`📍 Assets available at: ${targetDir}`);
    console.log('🎮 You can now use provideTemplate: true in your WebRTC configuration');
  } else {
    console.log('❌ Failed to copy WebRTC UI assets');
    console.log('   Make sure the library is built: npm run build');
  }
}

// Only run if this script is executed directly during npm install
if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error('❌ PostInstall script failed:', error.message);
    // Don't fail the installation, just warn
    process.exit(0);
  }
}

module.exports = { main };

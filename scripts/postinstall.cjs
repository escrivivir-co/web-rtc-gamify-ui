#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function main() {
  console.log('🔧 Setting up WebRTC Gamification UI...');
  
  // Detect if we're being installed in state-machine-mcp-driver
  const currentDir = process.cwd();
  const projectRoot = findProjectRoot(currentDir);
  
  if (!projectRoot) {
    console.log('📦 WebRTC Gamification UI installed successfully!');
    console.log('ℹ️  Not in a target project - skipping asset copy.');
    return;
  }
  
  // Check if this is state-machine-mcp-driver or similar project that needs our assets
  const packageJsonPath = path.join(projectRoot, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    console.log('📦 WebRTC Gamification UI installed successfully!');
    return;
  }

  let packageJson;
  try {
    packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  } catch (error) {
    console.log('📦 WebRTC Gamification UI installed successfully!');
    return;
  }

  // Check if this is a project that uses our UI (state-machine-mcp-driver or similar)
  const isTargetProject = packageJson.name === 'state-machine-mcp-driver' || 
                         packageJson.dependencies?.['webrtc-gamification-ui'] ||
                         packageJson.devDependencies?.['webrtc-gamification-ui'] ||
                         fs.existsSync(path.join(projectRoot, 'src', 'ui', 'MultiUIGameManager.ts'));
  
  if (!isTargetProject) {
    console.log('📦 WebRTC Gamification UI installed successfully!');
    console.log('ℹ️  Not a target project - skipping asset copy.');
    return;
  }

  // Find our package in node_modules
  const packagePath = findOurPackage(projectRoot);
  if (!packagePath) {
    console.log('⚠️  Could not locate webrtc-gamification-ui package path');
    return;
  }
  
  // Check if our dist exists (Angular 20 generates in browser subdirectory)
  const distPath = path.join(packagePath, 'dist', 'web-rtc-gamify-ui', 'browser');
  if (!fs.existsSync(distPath)) {
    console.log('⚠️  Angular dist not found. Package may not be built properly.');
    console.log(`   Expected: ${distPath}`);
    return;
  }
  
  // Create public_templates directory if it doesn't exist
  const publicTemplatesDir = path.join(projectRoot, 'public_templates');
  if (!fs.existsSync(publicTemplatesDir)) {
    fs.mkdirSync(publicTemplatesDir, { recursive: true });
  }
  
  // Target directory for our assets
  const targetPath = path.join(publicTemplatesDir, 'web-rtc-gamify-ui');
  
  console.log(`📦 Copying WebRTC UI assets from package to ${targetPath}`);
  
  try {
    // Remove existing assets
    if (fs.existsSync(targetPath)) {
      fs.rmSync(targetPath, { recursive: true, force: true });
    }
    
    // Copy dist to public_templates/web-rtc-gamify-ui
    copyDirectory(distPath, targetPath);
    
    console.log('✅ WebRTC Gamification UI setup completed successfully!');
    console.log(`📍 Assets copied to: ${targetPath}`);
    console.log('🌐 You can now use provideTemplate: true in your UI configuration');
    console.log('🎮 The UI will be available at http://localhost:8081 (or configured port)');
    
  } catch (error) {
    console.error('❌ Error during WebRTC UI setup:', error.message);
    console.error('   The UI will fall back to dynamic HTML mode');
  }
}

/**
 * Find the root of the project where this package is being installed
 */
function findProjectRoot(startDir) {
  let currentDir = startDir;
  
  // Go up directories looking for a package.json that's not ours
  while (currentDir !== path.dirname(currentDir)) { // not root
    const packageJsonPath = path.join(currentDir, 'package.json');
    
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        // If this is not our package, we found the project root
        if (packageJson.name !== 'webrtc-gamification-ui') {
          return currentDir;
        }
      } catch (error) {
        // Continue searching
      }
    }
    
    currentDir = path.dirname(currentDir);
  }
  
  return null;
}

/**
 * Find our package in node_modules
 */
function findOurPackage(projectRoot) {
  // Try different possible locations
  const possiblePaths = [
    path.join(projectRoot, 'node_modules', 'webrtc-gamification-ui'),
    path.join(projectRoot, 'node_modules', '@escrivivir', 'webrtc-gamification-ui'),
  ];
  
  for (const possiblePath of possiblePaths) {
    if (fs.existsSync(possiblePath)) {
      // Check if this directory has our dist or is our package
      const distPath = path.join(possiblePath, 'dist');
      const packageJsonPath = path.join(possiblePath, 'package.json');
      
      if (fs.existsSync(distPath)) {
        return possiblePath;
      }
      
      // If it's a monorepo package, look for packages/node-red-gamify-ui
      const packagePath = path.join(possiblePath, 'packages', 'node-red-gamify-ui');
      if (fs.existsSync(packagePath) && fs.existsSync(path.join(packagePath, 'dist'))) {
        return packagePath;
      }
    }
  }
  
  return null;
}

/**
 * Recursively copy directory
 */
function copyDirectory(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

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
}

if (require.main === module) {
  main();
}

module.exports = { main };

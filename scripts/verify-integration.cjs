#!/usr/bin/env node

/**
 * Verification script for WebRTC UI Library integration
 * Checks that the library is properly installed and configured
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verificando integración de webrtc-ui-lib...\n');

// Check if we're in the right directory
const currentDir = process.cwd();
const packageJsonPath = path.join(currentDir, 'package.json');

try {
  if (!fs.existsSync(packageJsonPath)) {
    console.error('❌ No se encontró package.json en el directorio actual');
    process.exit(1);
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  
  // Check if this is the webrtc-ui-lib project
  if (packageJson.name === 'webrtc-gamification-ui') {
    console.log('✅ Proyecto webrtc-ui-lib detectado');
    
    // Check library structure
    const libPath = path.join(currentDir, 'projects', 'webrtc-ui-lib');
    if (fs.existsSync(libPath)) {
      console.log('✅ Estructura de librería encontrada');
      
      // Check core directories
      const corePath = path.join(libPath, 'src', 'lib', 'core');
      const featuresPath = path.join(libPath, 'src', 'lib', 'features');
      const sharedPath = path.join(libPath, 'src', 'lib', 'shared');
      
      if (fs.existsSync(corePath)) {
        console.log('✅ Directorio core encontrado');
      } else {
        console.log('⚠️  Directorio core no encontrado');
      }
      
      if (fs.existsSync(featuresPath)) {
        console.log('✅ Directorio features encontrado');
      } else {
        console.log('⚠️  Directorio features no encontrado');
      }
      
      if (fs.existsSync(sharedPath)) {
        console.log('✅ Directorio shared encontrado');
      } else {
        console.log('⚠️  Directorio shared no encontrado');
      }
    } else {
      console.log('❌ Estructura de librería no encontrada');
    }
    
    // Check demo app
    const demoPath = path.join(currentDir, 'projects', 'demo-app');
    if (fs.existsSync(demoPath)) {
      console.log('✅ Demo app encontrada');
    } else {
      console.log('⚠️  Demo app no encontrada');
    }
    
    // Check build configuration
    const angularJsonPath = path.join(currentDir, 'angular.json');
    if (fs.existsSync(angularJsonPath)) {
      console.log('✅ Configuración Angular encontrada');
    } else {
      console.log('❌ angular.json no encontrado');
    }
    
  } else {
    // Check if webrtc-ui-lib is installed as dependency
    const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
    
    if (dependencies['webrtc-gamification-ui']) {
      console.log('✅ webrtc-ui-lib encontrada en dependencias');
      
      // Check if public_templates directory exists
      const publicTemplatesPath = path.join(currentDir, 'public_templates');
      if (fs.existsSync(publicTemplatesPath)) {
        console.log('✅ Directorio public_templates encontrado');
        
        // Check if webrtc assets were copied
        const webrtcAssetsPath = path.join(publicTemplatesPath, 'webrtc-ui');
        if (fs.existsSync(webrtcAssetsPath)) {
          console.log('✅ Assets de WebRTC copiados a public_templates');
        } else {
          console.log('⚠️  Assets de WebRTC no encontrados en public_templates');
        }
      } else {
        console.log('⚠️  Directorio public_templates no encontrado');
      }
    } else {
      console.log('❌ webrtc-ui-lib no encontrada en dependencias');
    }
  }
  
  console.log('\n🎉 Verificación completada');
  
} catch (error) {
  console.error('❌ Error durante la verificación:', error.message);
  process.exit(1);
}

# WebRTC Gamify UI - Scripts Reference

## 🚀 Development Scripts

### Core Development
- `npm run dev` - Build library in watch mode (main development command)
- `npm start` - Alias for `npm run dev`  
- `npm run debug` - Watch mode with source maps for debugging

### Building
- `npm run build` - Build library (development)
- `npm run build:prod` - Build library (production optimized)
- `npm run build:watch` - Build with watch mode
- `npm run build:package` - Build + create distributable .tgz package

### Testing & Quality
- `npm test` - Run unit tests
- `npm run test:watch` - Run tests in watch mode
- `npm run lint` - Lint TypeScript code

### Utilities
- `npm run clean` - Remove dist/ directory
- `npm run verify` - Build + list generated files
- `npm run check` - Build + show size + main exports
- `npm pack` - Create .tgz package (without rebuilding)

### Library Management
- `npm run addlibrary` - Generate new Angular library
- `npm run addApp` - Generate new Angular application

## 🎯 Common Workflows

### Start Development
```bash
npm run dev
# Library builds in watch mode - edit files in projects/webrtc-ui-lib/
```

### Debug Issues
```bash
npm run debug  
# Enables source maps for better debugging experience
```

### Prepare for Distribution
```bash
npm run build:package
# Creates optimized build + webrtc-gamification-ui-1.0.0-alpha.tgz
```

### Verify Build Quality
```bash
npm run check
# Shows build size (1.8M) and main exports
```

## 📦 Output Structure

After `npm run build`, the library is available in:
```
dist/webrtc-ui-lib/
├── fesm2022/
│   ├── webrtc-ui-lib.mjs     # ES2022 flat module  
│   └── webrtc-ui-lib.mjs.map # Source map
├── index.d.ts                # TypeScript definitions  
├── package.json              # Generated package.json
└── .npmignore               # npm ignore rules
```

## 🔧 Integration

The built library can be:
1. **Published to npm**: `npm publish dist/webrtc-ui-lib/`
2. **Installed locally**: `npm install ./webrtc-gamification-ui-1.0.0-alpha.tgz`
3. **Auto-distributed**: PostInstall script copies to consumer projects

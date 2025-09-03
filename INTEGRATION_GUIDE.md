# WebRTC Gamification UI - Guía de Integración

**Documento de referencia para integrar web-rtc-gamify-ui con el sistema state-machine-mcp-driver**

---

## 🎯 Objetivo

Esta guía explica cómo integrar la librería `web-rtc-gamify-ui` con el sistema de orquestación existente, siguiendo los patrones establecidos y manteniendo compatibilidad completa.

---

## 📋 Prerrequisitos

### Sistema Existente
- ✅ **state-machine-mcp-driver**: Sistema de orquestación funcionando
- ✅ **WebRTCChannelAgent**: Ya implementado en el orchestrator
- ✅ **AlephScriptClient**: Sistema de comunicaciones funcionando
- ✅ **MultiUIGameManager**: Sistema multi-UI operativo
- ✅ **threejs-gamify-ui**: Patrón de referencia instalado

### Navegador y Runtime
- 🌐 **Navegadores modernos**: Chrome 80+, Firefox 75+, Safari 13+
- 📡 **WebRTC support**: APIs nativas disponibles
- 🔒 **HTTPS/localhost**: Requerido para getUserMedia
- 🎥 **Media permissions**: Cámara y micrófono accesibles

---

## 🚀 Instalación Rápida

### 1. Instalar el Paquete

```bash
cd /e/LAB_AGOSTO/state-machine-mcp-driver
npm install webrtc-gamification-ui
```

**Resultado esperado**:
- Package instalado en `node_modules/webrtc-gamification-ui/`
- Script `postinstall.cjs` ejecutado automáticamente
- Assets copiados a `public_templates/webrtc-ui/`

### 2. Verificar Instalación

```bash
# Verificar que los assets están disponibles
ls -la public_templates/webrtc-ui/
# Debería mostrar: index.html, assets/, *.js, *.css

# Script de verificación
node public_templates/webrtc-ui/vendor/verify-installation.cjs
```

### 3. Crear Ejemplo Básico

```typescript
// examples/webrtc-basic-example.ts
import { MultiUIGameManager } from "../src/ui/MultiUIGameManager";
import { MultiUIGameConfig } from "../src/ui/MultiUIGameConfig";
import { Runtime } from "../src/runtime/Runtime";
import { MCPDriverAdapter } from "../src/drivers/MCPDriverAdapter";

const basicWebRTCConfig: MultiUIGameConfig = {
  game: {
    id: "webrtc-basic-demo",
    name: "WebRTC Basic Demo",
    version: "1.0.0"
  },
  ui: [
    {
      id: "webrtc-ui",
      name: "WebRTC Interface",
      type: "webrtc",
      enabled: true,
      config: {
        gameTitle: "WebRTC Communication",
        port: 9092,
        provideTemplate: true,
        enableVideo: true,
        enableAudio: true,
        enableDataChannel: true,
        roomConfig: {
          autoJoin: true,
          roomName: "demo-room",
          maxPeers: 4
        }
      }
    }
  ]
};

async function runBasicDemo() {
  const runtime = new Runtime();
  const mcpDriver = new MCPDriverAdapter();
  
  await runtime.initialize();
  await mcpDriver.initialize();
  
  const manager = new MultiUIGameManager(runtime, mcpDriver, null, basicWebRTCConfig);
  await manager.start();
  
  console.log("🎮 WebRTC Demo running at http://localhost:9092");
}

runBasicDemo().catch(console.error);
```

### 4. Ejecutar Demo

```bash
# Ejecutar el ejemplo
npx ts-node examples/webrtc-basic-example.ts

# O agregar script a package.json
npm run webrtc:demo
```

---

## 🔧 Configuración Detallada

### WebRTCGameUIConfig Interface

```typescript
export interface WebRTCGameUIConfig extends BaseGamificationUIConfig {
  // === Configuración base heredada ===
  gameTitle: string;
  maxMessagesPerThread?: number;
  enablePostulations?: boolean;
  autoSelectSingleAgent?: boolean;
  debugMode?: boolean;
  
  // === Configuración específica WebRTC ===
  port: number;                    // Puerto para Express server
  provideTemplate: boolean;        // Servir Angular app desde public_templates
  
  // Capacidades WebRTC
  enableVideo: boolean;           // Habilitar video streams
  enableAudio: boolean;           // Habilitar audio streams  
  enableDataChannel: boolean;     // Habilitar data channels P2P
  enableScreenShare?: boolean;    // Compartir pantalla (opcional)
  
  // Configuración de red
  iceServers: RTCIceServer[];     // STUN/TURN servers
  
  // Configuración AlephScript
  roomConfig: {
    autoJoin: boolean;            // Auto-join al room al conectar
    roomName: string;             // Nombre del room AlephScript
    maxPeers: number;             // Máximo número de peers
  };
  
  // Configuración avanzada (opcional)
  corsOrigin?: string;            // CORS para web server
  staticDir?: string;             // Directorio assets custom
  angularProjectPath?: string;    // Path para desarrollo
}
```

### Ejemplo de Configuración Completa

```typescript
const advancedWebRTCConfig: WebRTCGameUIConfig = {
  // Configuración base
  gameTitle: "WebRTC Communication Hub",
  maxMessagesPerThread: 100,
  enablePostulations: false,
  autoSelectSingleAgent: false,
  debugMode: process.env.NODE_ENV === 'development',
  
  // WebRTC específico
  port: 9092,
  provideTemplate: true,
  
  // Capacidades habilitadas
  enableVideo: true,
  enableAudio: true,
  enableDataChannel: true,
  enableScreenShare: true,
  
  // ICE servers (STUN/TURN)
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    // TURN server (opcional para NAT traversal)
    {
      urls: "turn:turn.example.com:3478",
      username: "webrtc_user",
      credential: "webrtc_pass"
    }
  ],
  
  // AlephScript room
  roomConfig: {
    autoJoin: true,
    roomName: "webrtc-main-room",
    maxPeers: 8
  },
  
  // Configuración avanzada
  corsOrigin: "*",
  staticDir: "public_templates/webrtc-ui"
};
```

---

## 🔌 Integración con MultiUIGameManager

### Agregar Soporte WebRTC

El sistema ya tiene soporte para WebRTC a través del `WebRTCChannelAgent`. Solo necesitamos agregar la integración en el `MultiUIGameManager`:

```typescript
// En MultiUIGameManager.ts (Ya existe el patrón)
import { WebRTCGamificationUI, WebRTCGameUIConfig } from "../ui/WebRTCGamificationUI";

class UIFactory {
  static createUI(
    config: UIInstanceConfig,
    runtime: Runtime,
    mcpAdapter: MCPDriverAdapter,
    orchestrator?: Orchestrator
  ): GamificationUI {
    
    switch (config.type) {
      case "console":
        return new ConsoleGamificationUIWrapper(runtime, mcpAdapter, config.config);
      case "html5":
        return new HTML5GamificationUI(runtime, mcpAdapter, config.config);
      case "threejs":
        return new ThreeJSGamificationUI(runtime, mcpAdapter, config.config);
      case "unity":
        return new UnityGamificationUI(runtime, mcpAdapter, config.config);
      case "webrtc":  // ← Nueva integración
        return new WebRTCGamificationUI(
          runtime, 
          mcpAdapter, 
          config.config as WebRTCGameUIConfig,
          orchestrator  // Importante: pasar orchestrator para WebRTCChannelAgent
        );
      default:
        throw new Error(`Unknown UI type: ${config.type}`);
    }
  }
}
```

### Multi-UI Scenarios

```typescript
// Ejecutar WebRTC junto con otras UIs
const multiUIConfig: MultiUIGameConfig = {
  game: {
    id: "multi-interface-demo",
    name: "Multi-Interface Communication Demo",
    version: "1.0.0"
  },
  ui: [
    // UI principal WebRTC
    {
      id: "webrtc-main",
      name: "WebRTC Communication",
      type: "webrtc",
      enabled: true,
      config: {
        gameTitle: "WebRTC Hub",
        port: 9092,
        provideTemplate: true,
        enableVideo: true,
        enableAudio: true,
        enableDataChannel: true,
        roomConfig: {
          autoJoin: true,
          roomName: "main-room",
          maxPeers: 6
        }
      }
    },
    
    // Panel de control HTML5
    {
      id: "control-panel",
      name: "Control Panel",
      type: "html5",
      enabled: true,
      config: {
        gameTitle: "Control Panel",
        port: 8080,
        enablePostulations: true
      }
    },
    
    // Visualización 3D opcional
    {
      id: "threejs-visual",
      name: "3D Visualization",
      type: "threejs",
      enabled: false,  // Deshabilitar por defecto
      config: {
        gameTitle: "3D World",
        port: 9091,
        provideTemplate: true
      }
    }
  ]
};
```

---

## 🌐 Integración con AlephScript

### WebRTCAlephClient

```typescript
// En src/clients/WebRTCAlephClient.ts
import { AlephScriptClient } from "./alephscript-client";
import { WebRTCChannelAgent } from "../orchestration/channel/webrtc-channel-agent";

export class WebRTCAlephClient extends AlephScriptClient {
  private webrtcAgent: WebRTCChannelAgent;
  private roomName: string;
  
  constructor(name: string, webrtcAgent: WebRTCChannelAgent, roomName: string) {
    super(name);
    this.webrtcAgent = webrtcAgent;
    this.roomName = roomName;
  }
  
  // Setup triggers para WebRTC
  initTriggersDefinition = [
    () => {
      const ROOM_NAME = this.roomName || (this.name + "_WEBRTC_ROOM");
      
      // Registro estándar AlephScript
      this.io.emit("CLIENT_REGISTER", {
        usuario: this.name,
        sesion: getHash("WebRTCClient"),
        features: ["WebRTC_P2P", "Video_Streaming", "Data_Channels"]
      });
      
      // Suscripción a room
      this.io.emit("CLIENT_SUSCRIBE", { room: ROOM_NAME });
      
      // Configurar como room master para signaling
      this.room("MAKE_MASTER", {
        features: ["WebRTC_Signaling", "Peer_Discovery"],
        roomCapacity: 10
      }, ROOM_NAME);
      
      console.log(`🔌 WebRTC AlephClient connected to room: ${ROOM_NAME}`);
      
      // Setup event handlers
      this.setupWebRTCEventHandlers(ROOM_NAME);
    }
  ];
  
  private setupWebRTCEventHandlers(roomName: string): void {
    // Signaling messages
    this.io.on("webrtc_signaling", (data) => {
      console.log("📡 Received WebRTC signaling:", data);
      this.webrtcAgent.handleSignalingMessage(data);
    });
    
    // Peer discovery
    this.io.on("room_peer_joined", (data) => {
      console.log("👋 Peer joined room:", data.peerId);
      if (data.peerId !== this.name) {
        this.webrtcAgent.connectToPeer(data.peerId, true); // Initiate connection
      }
    });
    
    this.io.on("room_peer_left", (data) => {
      console.log("👋 Peer left room:", data.peerId);
      this.webrtcAgent.disconnectPeer(data.peerId);
    });
    
    // Forward WebRTC events to AlephScript
    this.webrtcAgent.connectionEvents.subscribe(event => {
      this.io.emit("webrtc_event", {
        roomName,
        event: event.type,
        peerId: event.peerId,
        data: event.data
      });
    });
  }
  
  // Enviar signaling message via Socket.IO
  sendSignalingMessage(peerId: string, message: any): void {
    this.io.emit("webrtc_signaling", {
      fromPeer: this.name,
      toPeer: peerId,
      message,
      timestamp: Date.now()
    });
  }
}
```

### Room Management

```typescript
// Métodos adicionales para manejo de rooms
export class WebRTCAlephClient extends AlephScriptClient {
  
  // Crear nuevo room WebRTC
  async createRoom(roomName: string, options: any = {}): Promise<void> {
    this.io.emit("CREATE_ROOM", {
      roomName,
      roomType: "webrtc",
      maxParticipants: options.maxPeers || 8,
      features: ["video", "audio", "data"],
      ...options
    });
  }
  
  // Join específico a room
  async joinRoom(roomName: string): Promise<void> {
    this.io.emit("JOIN_ROOM", {
      roomName,
      userCapabilities: {
        video: this.webrtcAgent.config.enableVideo,
        audio: this.webrtcAgent.config.enableAudio,
        dataChannel: this.webrtcAgent.config.enableDataChannel
      }
    });
  }
  
  // Leave room
  async leaveRoom(): Promise<void> {
    this.io.emit("LEAVE_ROOM", {
      roomName: this.roomName
    });
    
    // Desconectar todos los peers WebRTC
    for (const peer of this.webrtcAgent.getConnectedPeers()) {
      await this.webrtcAgent.disconnectPeer(peer.id);
    }
  }
}
```

---

## 🔧 Scripts y Comandos

### Scripts package.json

```json
{
  "scripts": {
    "webrtc:demo": "npx ts-node examples/webrtc-basic-example.ts",
    "webrtc:demo-advanced": "npx ts-node examples/webrtc-advanced-example.ts", 
    "webrtc:multi-ui": "npx ts-node examples/webrtc-multi-ui-example.ts",
    "webrtc:setup": "node scripts/setup-webrtc-ui.js",
    "webrtc:verify": "node public_templates/webrtc-ui/vendor/verify-installation.cjs"
  }
}
```

### Script de Setup

```javascript
// scripts/setup-webrtc-ui.js
const fs = require('fs');
const path = require('path');

function setupWebRTCUI() {
  const projectRoot = __dirname;
  const sourceDir = path.join(projectRoot, 'node_modules', 'webrtc-gamification-ui', 'dist');
  const targetDir = path.join(projectRoot, 'public_templates', 'webrtc-ui');
  
  console.log('🔧 Setting up WebRTC UI assets...');
  
  if (!fs.existsSync(sourceDir)) {
    console.error('❌ WebRTC package not found. Run: npm install webrtc-gamification-ui');
    return;
  }
  
  // Crear directorio si no existe
  if (!fs.existsSync(path.dirname(targetDir))) {
    fs.mkdirSync(path.dirname(targetDir), { recursive: true });
  }
  
  // Copiar assets
  copyDirectory(sourceDir, targetDir);
  
  console.log('✅ WebRTC UI assets installed successfully!');
  console.log(`📍 Assets available at: ${targetDir}`);
}

function copyDirectory(src, dest) {
  if (fs.existsSync(dest)) {
    fs.rmSync(dest, { recursive: true, force: true });
  }
  
  fs.mkdirSync(dest, { recursive: true });
  
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
  setupWebRTCUI();
}
```

---

## 🎮 Ejemplos de Uso

### Ejemplo 1: WebRTC Básico

```typescript
// examples/webrtc-basic-example.ts
import { ApplicationLauncher } from "../src/scripts/launcher";

async function basicWebRTCDemo() {
  const launcher = new ApplicationLauncher();
  
  // Configuración mínima
  const config = {
    game: {
      id: "webrtc-basic",
      name: "WebRTC Basic Demo"
    },
    ui: [{
      id: "webrtc",
      type: "webrtc",
      enabled: true,
      config: {
        gameTitle: "WebRTC Demo",
        port: 9092,
        provideTemplate: true,
        enableVideo: true,
        enableAudio: true,
        enableDataChannel: true,
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
        roomConfig: {
          autoJoin: true,
          roomName: "demo-room",
          maxPeers: 4
        }
      }
    }]
  };
  
  await launcher.initialize(config);
  await launcher.launchGamificationUIs();
  
  console.log("🎮 WebRTC Demo: http://localhost:9092");
}

basicWebRTCDemo().catch(console.error);
```

### Ejemplo 2: Multi-UI Coordinado

```typescript
// examples/webrtc-multi-ui-example.ts
async function multiUIDemo() {
  const config = {
    game: {
      id: "webrtc-multi-ui",
      name: "WebRTC Multi-UI Demo"
    },
    ui: [
      // WebRTC principal
      {
        id: "webrtc-main",
        type: "webrtc",
        enabled: true,
        config: {
          gameTitle: "WebRTC Communication",
          port: 9092,
          provideTemplate: true,
          enableVideo: true,
          enableAudio: true,
          enableDataChannel: true,
          roomConfig: {
            autoJoin: true,
            roomName: "multi-ui-room",
            maxPeers: 6
          }
        }
      },
      
      // Panel de control HTML5
      {
        id: "control-panel",
        type: "html5", 
        enabled: true,
        config: {
          gameTitle: "Control Panel",
          port: 8080
        }
      },
      
      // Visualización ThreeJS
      {
        id: "threejs-viz",
        type: "threejs",
        enabled: true,
        config: {
          gameTitle: "3D Visualization",
          port: 9091,
          provideTemplate: true
        }
      }
    ]
  };
  
  const launcher = new ApplicationLauncher();
  await launcher.initialize(config);
  await launcher.launchGamificationUIs();
  
  console.log("🎮 Multi-UI Demo running:");
  console.log("   WebRTC: http://localhost:9092");
  console.log("   Control: http://localhost:8080");
  console.log("   3D Viz: http://localhost:9091");
}

multiUIDemo().catch(console.error);
```

### Ejemplo 3: Integración Avanzada con AlephScript

```typescript
// examples/webrtc-alephscript-advanced.ts
async function advancedAlephScriptDemo() {
  const launcher = new ApplicationLauncher();
  
  // Configuración con múltiples rooms y bots
  const config = {
    game: {
      id: "webrtc-alephscript-advanced",
      name: "Advanced WebRTC + AlephScript Integration"
    },
    ui: [{
      id: "webrtc-advanced",
      type: "webrtc",
      enabled: true,
      config: {
        gameTitle: "Advanced WebRTC Hub",
        port: 9092,
        provideTemplate: true,
        enableVideo: true,
        enableAudio: true,
        enableDataChannel: true,
        enableScreenShare: true,
        
        // ICE servers con TURN
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          {
            urls: "turn:openrelay.metered.ca:80",
            username: "openrelayproject",
            credential: "openrelayproject"
          }
        ],
        
        // Room management avanzado
        roomConfig: {
          autoJoin: true,
          roomName: "advanced-webrtc-room",
          maxPeers: 10
        },
        
        // Debugging
        debugMode: true
      }
    }]
  };
  
  await launcher.initialize(config);
  await launcher.launchGamificationUIs();
  
  console.log("🚀 Advanced WebRTC + AlephScript Demo");
  console.log("   Main Interface: http://localhost:9092");
  console.log("   Features: Video, Audio, Screen Share, Data Channels");
  console.log("   AlephScript Room: advanced-webrtc-room");
}

advancedAlephScriptDemo().catch(console.error);
```

---

## 🔍 Troubleshooting

### Problemas Comunes

#### 1. Assets no encontrados
```bash
# Error: Cannot GET /
# Solución: Verificar que postinstall ejecutó correctamente
npm run webrtc:setup
ls -la public_templates/webrtc-ui/
```

#### 2. WebRTC no conecta
```bash
# Error: ICE connection failed
# Solución: Verificar STUN/TURN servers y red
# Verificar que está en HTTPS o localhost
```

#### 3. AlephScript no conecta
```bash
# Error: AlephScript connection failed
# Solución: Verificar que socket-gym está corriendo
cd ../socket-gym
npm run start
```

#### 4. Permisos de medios
```bash
# Error: getUserMedia failed
# Solución: Navegador en HTTPS o localhost
# Verificar permisos de cámara/micrófono
```

### Debug Mode

```typescript
// Habilitar debug en configuración
const debugConfig = {
  config: {
    // ... otras opciones ...
    debugMode: true,
    
    // Logs detallados
    logLevel: "debug",
    
    // ICE gathering verbose
    iceCandidatePoolSize: 10
  }
};
```

### Logs y Monitoreo

```typescript
// En WebRTCGamificationUI
if (this.config.debugMode) {
  // Log WebRTC events
  this.webrtcChannelAgent.connectionEvents.subscribe(event => {
    console.log(`[WebRTC] ${event.type}:`, event);
  });
  
  // Log AlephScript events
  this.webrtcAlephClient.io.onAny((eventName, ...args) => {
    console.log(`[AlephScript] ${eventName}:`, args);
  });
  
  // Log UI events
  this.uiEvents$.subscribe(event => {
    console.log(`[UI] ${event.type}:`, event);
  });
}
```

---

## 📚 Referencias

### Documentación Relacionada
- [WebRTCChannelAgent](../state-machine-mcp-driver/src/orchestration/channel/webrtc-channel-agent.ts) - Implementación del agente
- [AlephScriptClient](../state-machine-mcp-driver/src/clients/alephscript-client.ts) - Cliente base
- [MultiUIGameManager](../state-machine-mcp-driver/src/ui/MultiUIGameManager.ts) - Sistema multi-UI
- [threejs-gamify-ui](../threejs-gamify-ui) - Patrón de referencia

### APIs Utilizadas
- **WebRTC**: [MDN WebRTC API](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
- **Socket.IO**: [Socket.IO Client](https://socket.io/docs/v4/client-api/)
- **Angular**: [Angular Framework](https://angular.io/docs)
- **RxJS**: [Reactive Extensions](https://rxjs.dev/guide/overview)

---

**Estado**: 📖 Guía de Integración
**Responsable**: GitHub Copilot + Equipo desarrollo
**Última actualización**: 2025-09-03
**Revisión**: v1.0

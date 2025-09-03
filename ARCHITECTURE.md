# WebRTC Gamification UI - Arquitectura Técnica

**Documento de diseño arquitectónico para la integración WebRTC con el sistema de orquestación**

---

## 🏗️ Visión Arquitectónica

La arquitectura de `web-rtc-gamify-ui` sigue el patrón establecido por el sistema existente, integrándose perfectamente con:
- **Sistema de Orquestación**: WebRTCChannelAgent + Orchestrator  
- **Comunicaciones**: AlephScriptClient + Socket.IO
- **Interfaces**: GamificationUI + MultiUIGameManager
- **Streams Reactivos**: RxJS para coordinación

---

## 📊 Diagrama de Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                    MULTI-UI GAME MANAGER                        │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐     │
│ │ HTML5           │ │ ThreeJS         │ │ WebRTC          │     │
│ │ GamificationUI  │ │ GamificationUI  │ │ GamificationUI  │     │
│ └─────────────────┘ └─────────────────┘ └─────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                        ORCHESTRATOR                             │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ │
│ │ AppChannel  │ │ SysChannel  │ │ UIChannel   │ │ WebRTC      │ │
│ │ Agent       │ │ Agent       │ │ Agent       │ │ ChannelAgent│ │
│ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    ALEPHSCRIPT LAYER                                │
├─────────────────────────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐  │
│ │ProserpinaBot│ │ OrfeoBot     │ │ EuridiceBot  │ │ WebRTC       │  │
│ │ (DevOps)    │ │ (Chat)       │ │ (Wikipedia)  │ │ AlephClient  │  │
│ └─────────────┘ └──────────────┘ └──────────────┘ └──────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     SOCKET.IO SERVER                            │
│                  (AlephScript Core)                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔧 Componentes Principales

### 1. WebRTCGamificationUI

**Archivo**: `src/ui/WebRTCGamificationUI.ts`

```typescript
export interface WebRTCGameUIConfig extends BaseGamificationUIConfig {
  port: number;
  enableVideo: boolean;
  enableAudio: boolean;
  enableDataChannel: boolean;
  enableScreenShare: boolean;
  iceServers: RTCIceServer[];
  roomConfig: {
    autoJoin: boolean;
    roomName: string;
    maxPeers: number;
  };
  provideTemplate: boolean;
  angularProjectPath?: string;
}

export class WebRTCGamificationUI extends GamificationUI {
  private app: express.Application;
  private server: http.Server;
  private webrtcChannelAgent: WebRTCChannelAgent;
  private webrtcAlephClient: WebRTCAlephClient;
  
  // Express server para servir Angular app
  // Integración con WebRTCChannelAgent
  // Manejo de eventos WebRTC
}
```

### 2. WebRTCChannelAgent (Ya implementado)

**Archivo**: `src/orchestration/channel/webrtc-channel-agent.ts`

```typescript
export class WebRTCChannelAgent implements ChannelAgent {
  readonly name = "webrtc";
  private peers = new Map<string, WebRTCPeer>();
  private localStream?: MediaStream;
  
  // ✅ Ya implementado:
  // - Conexiones peer-to-peer
  // - Manejo de streams de medios
  // - ICE candidate management
  // - Integration con orchestration
}
```

### 3. WebRTCAlephClient

**Archivo**: `src/clients/WebRTCAlephClient.ts`

```typescript
export class WebRTCAlephClient extends AlephScriptClient {
  private webrtcAgent: WebRTCChannelAgent;
  private roomName: string;
  
  constructor(name: string, webrtcAgent: WebRTCChannelAgent) {
    super(name);
    this.webrtcAgent = webrtcAgent;
    this.setupWebRTCSignaling();
  }
  
  // Manejo de señalización WebRTC a través de Socket.IO
  // Room management integrado con AlephScript
  // Fallback coordination
}
```

### 4. Angular UI Library

**Estructura**: `web-rtc-gamify-ui/projects/webrtc-ui-lib/`

```typescript
// Core Services
export class WebRTCService {
  // Manejo principal de WebRTC
  connectToPeer(peerId: string): Observable<RTCPeerConnection>
  disconnectPeer(peerId: string): Observable<void>
  getLocalStream(): Observable<MediaStream>
}

export class AlephScriptWebRTCService {
  // Integración con AlephScript
  joinRoom(roomName: string): Observable<void>
  leaveRoom(): Observable<void>
  sendSignalingMessage(message: any): Observable<void>
}

// UI Components
export class PeerListComponent {
  // Lista de peers conectados
}

export class VideoControlsComponent {
  // Controles de video
}

export class RoomManagementComponent {
  // Gestión de rooms AlephScript
}
```

---

## 🔄 Flujo de Datos

### 1. Inicialización del Sistema

```
1. MultiUIGameManager.start()
2. WebRTCGamificationUI.start()
   ├── Express server iniciado (puerto configurado)
   ├── WebRTCChannelAgent inicializado
   ├── WebRTCAlephClient conectado
   └── Angular app servida desde public_templates/
3. Browser conecta a UI
4. Angular app inicializa servicios WebRTC
5. AlephScript room auto-join (si configurado)
```

### 2. Conexión Peer-to-Peer

```
Peer A                    AlephScript                 Peer B
  │                          │                         │
  │ ── join room ────────────▶│                         │
  │                          │◄──── join room ─────── │
  │                          │                         │
  │◄─── peer discovered ─────┤                         │
  │                          │─── peer discovered ────▶│
  │                          │                         │
  │ ── offer (via Socket.IO) ▶│                         │
  │                          │── offer (via Socket.IO) ▶│
  │                          │                         │
  │                          │◄─ answer (via Socket.IO)│
  │◄─ answer (via Socket.IO) ┤                         │
  │                          │                         │
  │◄────── ICE candidates ───┼─────── ICE candidates ──▶│
  │                          │                         │
  │◄══════ WebRTC P2P Connection Established ══════════▶│
```

### 3. Comunicación de Datos

```
UI Component              Service Layer           Channel Agent
     │                        │                       │
     │ ── user action ───────▶│                       │
     │                        │ ── processUIMessage ─▶│
     │                        │                       │
     │                        │◄─ event stream ──────┤
     │◄─ UI update ───────────┤                       │
     │                        │                       │
     │                        │                WebRTC Peer
     │                        │                       │
     │                        │◄──── P2P data ───────┤
     │◄─ peer data ───────────┤                       │
```

---

## 🎨 Integración con Angular Library

### Estructura del Paquete

```
web-rtc-gamify-ui/
├── package.json                 # Metadata y scripts
├── angular.json                 # Configuración workspace
├── projects/
│   └── webrtc-ui-lib/
│       ├── src/
│       │   ├── lib/
│       │   │   ├── webrtc-ui.module.ts    # Módulo principal
│       │   │   ├── core/                  # Servicios core
│       │   │   ├── features/              # Componentes funcionales
│       │   │   └── shared/                # Compartidos
│       │   └── public-api.ts              # Exportaciones públicas
│       └── ng-package.json               # Configuración librería
├── scripts/
│   └── postinstall.cjs               # Auto-instalación
└── dist/                             # Artefactos compilados
```

### Integración con public_templates

```javascript
// scripts/postinstall.cjs
function main() {
  // Copiar desde dist/webrtc-ui-lib/
  const sourceDir = path.join(__dirname, '..', 'dist', 'webrtc-ui-lib');
  
  // Hacia public_templates/webrtc-ui/
  const targetDir = path.join(projectRoot, 'public_templates', 'webrtc-ui');
  
  // Assets Angular disponibles para WebRTCGamificationUI
  copyDirectory(sourceDir, targetDir);
}
```

### Servido desde Express

```typescript
// En WebRTCGamificationUI
private setupExpressRoutes(): void {
  // Servir assets Angular desde public_templates
  const webrtcAssetsPath = path.join(__dirname, "../../public_templates/webrtc-ui");
  
  this.app.use(express.static(webrtcAssetsPath, {
    index: false,  // No servir index.html directamente
    setHeaders: (res, filePath) => {
      // Configurar MIME types correctos
    }
  }));
  
  // Route principal para Angular app
  this.app.get('/', (req, res) => {
    const indexPath = path.join(webrtcAssetsPath, 'index.html');
    res.sendFile(indexPath);
  });
}
```

---

## 📡 Sistema de Comunicaciones

### AlephScript Integration

```typescript
export class WebRTCAlephClient extends AlephScriptClient {
  initTriggersDefinition = [
    () => {
      const ROOM_NAME = this.name + "_WEBRTC_ROOM";
      
      // Registro en AlephScript
      this.io.emit("CLIENT_REGISTER", {
        usuario: this.name,
        sesion: getHash("WebRTCClient"),
        features: ["WebRTC_P2P", "Video_Audio", "DataChannels"]
      });
      
      // Suscripción a room
      this.io.emit("CLIENT_SUSCRIBE", { room: ROOM_NAME });
      
      // Setup signaling handlers
      this.setupSignalingHandlers(ROOM_NAME);
    }
  ];
  
  private setupSignalingHandlers(roomName: string): void {
    // WebRTC offer/answer/ice-candidate routing
    this.io.on("webrtc_signaling", (data) => {
      this.webrtcAgent.handleSignalingMessage(data);
    });
    
    // Room events
    this.io.on("room_peer_joined", (data) => {
      this.webrtcAgent.connectToPeer(data.peerId, false);
    });
    
    this.io.on("room_peer_left", (data) => {
      this.webrtcAgent.disconnectPeer(data.peerId);
    });
  }
}
```

### Event Bridge con Orchestrator

```typescript
export class WebRTCGamificationUI extends GamificationUI {
  private setupEventBridge(): void {
    // WebRTCChannelAgent -> UI events
    this.webrtcChannelAgent.connectionEvents.pipe(
      takeUntil(this.destroy$)
    ).subscribe(event => {
      this.broadcastToClients('webrtc_event', event);
    });
    
    // UI -> WebRTCChannelAgent commands
    this.uiEvents$.pipe(
      filter(event => event.type === 'webrtc_command'),
      takeUntil(this.destroy$)
    ).subscribe(event => {
      this.webrtcChannelAgent.processUIMessage({
        type: 'ui_event',
        payload: event.data
      });
    });
  }
}
```

---

## 🔧 Configuración y Deployment

### MultiUIGameManager Integration

```typescript
// En MultiUIGameManager.ts
class UIFactory {
  static createUI(config: UIInstanceConfig, runtime: Runtime, mcp: MCPDriverAdapter): GamificationUI {
    switch (config.type) {
      case "html5":
        return new HTML5GamificationUI(runtime, mcp, config.config);
      case "threejs":
        return new ThreeJSGamificationUI(runtime, mcp, config.config);
      case "webrtc":  // ← Nueva integración
        return new WebRTCGamificationUI(runtime, mcp, config.config);
      default:
        throw new Error(`Unknown UI type: ${config.type}`);
    }
  }
}
```

### Ejemplo de Configuración

```typescript
// examples/webrtc-integration-example.ts
const webrtcUIConfig: MultiUIGameConfig = {
  game: {
    id: "webrtc-communication-demo",
    name: "WebRTC Communication Demo",
    version: "1.0.0"
  },
  ui: [
    {
      id: "webrtc-main",
      name: "WebRTC Main Interface",
      type: "webrtc",
      enabled: true,
      config: {
        gameTitle: "WebRTC Communication Hub",
        port: 9092,
        provideTemplate: true,
        
        // WebRTC específico
        enableVideo: true,
        enableAudio: true,
        enableDataChannel: true,
        enableScreenShare: true,
        
        // ICE servers
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" }
        ],
        
        // AlephScript room config
        roomConfig: {
          autoJoin: true,
          roomName: "webrtc-main-room",
          maxPeers: 8
        },
        
        // UI config estándar
        enablePostulations: false,
        autoSelectSingleAgent: false,
        debugMode: true
      }
    },
    
    // Otras UIs pueden ejecutarse simultáneamente
    {
      id: "html5-control",
      name: "HTML5 Control Interface", 
      type: "html5",
      enabled: true,
      config: {
        port: 8080,
        gameTitle: "Control Panel"
      }
    }
  ]
};
```

---

## 🔒 Seguridad y Consideraciones

### WebRTC Security
- **ICE candidate filtering**: Solo STUN servers confiables
- **Data channel encryption**: Automática con DTLS
- **Media permissions**: Gestión de permisos del navegador
- **Room access control**: Integrado con AlephScript auth

### Network Considerations
- **NAT traversal**: STUN/TURN servers configurables
- **Bandwidth management**: Quality adaptation automática
- **Connection fallback**: Socket.IO cuando WebRTC falla
- **Firewall friendly**: ICE negotiation automática

### Privacy
- **Local media control**: Usuario controla cámara/micrófono
- **Data retention**: Ningún dato almacenado por defecto
- **Peer discovery**: Solo dentro de rooms AlephScript
- **Encryption**: End-to-end entre peers

---

## 🚀 Performance y Optimización

### Bundle Size
- **Tree shaking**: Solo componentes utilizados
- **Lazy loading**: Componentes WebRTC bajo demanda
- **CDN assets**: Three.js y otras librerías externas
- **Compression**: Gzip/Brotli para assets

### Runtime Performance
- **Stream management**: Cleanup automático de MediaStreams
- **Connection pooling**: Reutilización de PeerConnections
- **Memory management**: RxJS takeUntil patterns
- **Error recovery**: Reconnection automática

### Browser Compatibility
- **Modern browsers**: Chrome 80+, Firefox 75+, Safari 13+
- **WebRTC support**: Feature detection y fallbacks
- **Mobile optimization**: Touch controls y responsive design
- **Progressive enhancement**: Funciona sin WebRTC

---

**Estado**: 🚧 Diseño Arquitectónico
**Responsable**: GitHub Copilot + Equipo desarrollo  
**Última actualización**: 2025-09-03
**Revisión**: v1.0

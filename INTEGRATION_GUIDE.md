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
      # WebRTC Gamification UI - Guía de Integración (Actualizada)

      Documento preciso para integrar la librería Angular `webrtc-ui-lib` dentro del ecosistema state-machine-mcp-driver usando el patrón MultiUIGameManager + AlephScript.

      ---

      ## Qué incluye esta librería (según código actual)

      - Servicios de integración exportados por `projects/webrtc-ui-lib/src/public-api.ts`:
        - WebRTCAlephClient (signaling AlephScript + rooms)
        - WebRTCEngine (RTCPeerConnection, media/data channels)
        - WebRTCOrchestrator (coordinación de alto nivel)
      - Componentes standalone exportados:
        - Data channels: `webrtc-chat`, `webrtc-file-transfer`
        - Salas: `webrtc-room-list`, `webrtc-room-controls`, `webrtc-room-creation`
        - Media: `wrtc-video-controls`, `webrtc-audio-controls`, `webrtc-screen-share` (ver selectors abajo)
      - Módulo Angular: `WebRTCUILibModule` (provee los servicios y re-exporta componentes standalone)
      - Script `scripts/postinstall.cjs` que copia `dist/webrtc-ui-lib` a `public_templates/webrtc-ui` en el proyecto consumidor.

      Notas de selectores observadas en el código:
      - Video: selector `wrtc-video-controls` (archivo `features/media-controls/video-controls.component.ts`)
      - Audio: selector `webrtc-audio-controls`
      - Screen share: selector `webrtc-screen-share`
      - Chat: selector `webrtc-chat`
      - File transfer: selector `webrtc-file-transfer`
      - Salas: `webrtc-room-list`, `webrtc-room-controls`, `webrtc-room-creation`
      - Shared peer UI (internos por ahora): `wrtc-peer-list`, `wrtc-peer-card`, `wrtc-connection-controls` (no exportados públicamente todavía)

      ---

      ## Requisitos

      - Angular 20.x (workspace/librería ya configurados en este repo)
      - Navegadores modernos con WebRTC; HTTPS o localhost para getUserMedia
      - Sistema AlephScript activo (socket-gym/orchestrator)

      ---

      ## Instalación y assets

      1) Construir la librería para generar `dist/webrtc-ui-lib` y permitir el copiado de assets por postinstall.
      2) En el proyecto orquestador (consumidor), instalar el paquete y dejar que `postinstall.cjs` copie a `public_templates/webrtc-ui`.

      Script relevante en este repo: `scripts/postinstall.cjs` (verifica/copia dist → public_templates/webrtc-ui del consumidor).

      Verificación opcional en este repo: `npm run verify` ejecuta `scripts/verify-integration.cjs`.

      ---

      ## Uso en Angular (consumidor)

      - Importar servicios/componentes desde el paquete (superficie pública definida en `public-api.ts`).
      - Ejemplo de importación de un componente standalone en una app Angular del consumidor:

      ```ts
      import { bootstrapApplication } from '@angular/platform-browser';
      import { enableProdMode } from '@angular/core';
      import { RoomListComponent } from 'webrtc-gamification-ui';

      bootstrapApplication(RoomListComponent);
      ```

      O mediante el módulo de la librería:

      ```ts
      import { WebRTCUILibModule } from 'webrtc-gamification-ui';

      @NgModule({
        imports: [BrowserModule, WebRTCUILibModule.forRoot({ webrtc: { debug: false } })]
      })
      export class AppModule {}
      ```

      ---

      ## Integración con Orchestrator (Node)

      En este repo existe `projects/webrtc-ui-lib/src/lib/integration/WebRTCGamificationUI.ts` con una implementación completa de UI server (Express) y puente AlephScript. Este archivo es parte del stack del orquestador (no del bundle Angular). Pasos típicos:

      1) Instanciar `WebRTCGamificationUI` con Runtime y MCPDriverAdapter, y un config compatible con la interfaz `WebRTCGameUIConfig` definida en el propio archivo.
      2) Llamar `start()` para iniciar Express, registrar canales y exponer la UI WebRTC (sirviendo `public_templates/webrtc-ui` cuando `provideTemplate=true`).

      Esquema mínimo del config (ver archivo para opciones avanzadas):

      ```ts
      const cfg = {
        port: 9092,
        staticDir: 'public_templates/webrtc-ui',
        provideTemplate: true,
        enableSignaling: true,
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
        roomSettings: { defaultRoomType: 'public', maxRoomsPerUser: 5 }
      };
      ```

      ---

      ## Componentes y selectores

      - Data channels:
        - Chat: `<webrtc-chat></webrtc-chat>`
        - Transferencia de archivos: `<webrtc-file-transfer></webrtc-file-transfer>`
      - Salas:
        - Lista: `<webrtc-room-list></webrtc-room-list>`
        - Controles: `<webrtc-room-controls></webrtc-room-controls>`
        - Creación: `<webrtc-room-creation></webrtc-room-creation>`
      - Media:
        - Video: `<wrtc-video-controls></wrtc-video-controls>`
        - Audio: `<webrtc-audio-controls></webrtc-audio-controls>`
        - Pantalla: `<webrtc-screen-share></webrtc-screen-share>`

      ---

      ## Troubleshooting (rápido)

      - No hay assets Angular servidos: asegúrate de ejecutar build y que postinstall haya copiado a `public_templates/webrtc-ui` en el consumidor.
      - WebRTC falla en ICE: revisa `iceServers` y entorno (HTTPS/localhost); considera TURN.
      - Señalización no conecta: confirma AlephScript/socket-gym activos y URLs correctas.

      ---

      Estado: Guía sincronizada con el código a 2025-09-03
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

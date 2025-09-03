
# Web-RTC-Gamify-UI

**Librería Angular para WebRTC integrada con AlephScript y Sistema de Orquestación**

[![Version](https://img.shields.io/npm/v/webrtc-gamification-ui.svg)](https://www.npmjs.com/package/webrtc-gamification-ui)
[![License: AIPL](https://img.shields.io/badge/License-AIPL-blue.svg)](LICENSE)

---

## 🎯 Descripción

`web-rtc-gamify-ui` es una librería Angular que proporciona una interfaz de usuario profesional y elegante para aplicaciones WebRTC, específicamente diseñada para integrarse con el sistema de comunicaciones AlephScript y el orquestador de canales.

### Características principales:

- 🎥 **Comunicaciones WebRTC P2P**: Video, audio y canales de datos
- 🎮 **Integración con GamificationUI**: Compatible con el patrón de UI existente  
- 🔌 **AlephScriptClient especializado**: Manejo de señalización a través de Socket.IO
- 🎨 **UI Profesional**: Interfaz moderna y responsive para controles WebRTC
- 📡 **WebRTCChannelAgent**: Integración con sistema de orquestación existente
- 🔄 **RxJS Reactive**: Streams reactivos para estado en tiempo real
- 🌐 **Cross-browser**: Compatible con navegadores modernos
- 📱 **Mobile-friendly**: Optimizado para dispositivos móviles

---

## 🏗️ Arquitectura

```
web-rtc-gamify-ui/
├── projects/
│   └── webrtc-ui-lib/               # Librería Angular principal
│       ├── src/
│       │   ├── lib/
│       │   │   ├── core/            # Servicios core y configuración
│       │   │   │   ├── services/
│       │   │   │   │   ├── webrtc.service.ts
│       │   │   │   │   ├── alephscript-webrtc.service.ts
│       │   │   │   │   └── signaling.service.ts
│       │   │   │   └── models/
│       │   │   │       ├── webrtc-config.model.ts
│       │   │   │       ├── peer.model.ts
│       │   │   │       └── signaling.model.ts
│       │   │   ├── features/        # Componentes de funcionalidad
│       │   │   │   ├── peer-management/
│       │   │   │   │   ├── peer-list.component.ts
│       │   │   │   │   └── peer-controls.component.ts
│       │   │   │   ├── media-controls/
│       │   │   │   │   ├── video-controls.component.ts
│       │   │   │   │   ├── audio-controls.component.ts
│       │   │   │   │   └── screen-share.component.ts
│       │   │   │   ├── data-channels/
│       │   │   │   │   ├── chat.component.ts
│       │   │   │   │   └── file-transfer.component.ts
│       │   │   │   └── room-management/
│       │   │   │       ├── room-list.component.ts
│       │   │   │       ├── room-controls.component.ts
│       │   │   │       └── room-creation.component.ts
│       │   │   ├── shared/           # Componentes compartidos
│       │   │   │   ├── components/
│       │   │   │   ├── directives/
│       │   │   │   └── pipes/
│       │   │   └── utils/            # Utilidades
│       │   └── public-api.ts
│       └── dist/                    # Artefactos compilados
├── demo-app/                        # Aplicación de demostración
├── scripts/
│   ├── postinstall.cjs             # Script de instalación
│   └── build.sh                    # Script de construcción
└── dist/                           # Distribución final
```

---

## 🚀 Integración con Sistema Existente

### Con WebRTCChannelAgent
```typescript
// El WebRTCChannelAgent ya implementado maneja:
- Conexiones peer-to-peer
- Señalización WebRTC
- Integración con orchestration channels
- Streams de medios
```

### Con AlephScriptClient
```typescript
// WebRTCAlephClient extiende AlephScriptClient para:
- Manejo de señalización a través de Socket.IO
- Gestión de rooms WebRTC
- Coordinación con ProserpinaBot, OrfeoBot, EuridiceBot
- Fallback a Socket.IO cuando WebRTC no esté disponible
```

### Con GamificationUI
```typescript
// WebRTCGamificationUI extiende GamificationUI para:
- Interfaz unificada con otras UIs del sistema
- Integración con MultiUIGameManager
- Eventos reactivos RxJS
- Coordinación con orchestrator
```

---

## 📦 Instalación y Uso

### En state-machine-mcp-driver

```bash
# 1. Instalar el paquete
npm install webrtc-gamification-ui

# 2. El postinstall automáticamente copia assets a public_templates/
# Los assets quedan disponibles en: public_templates/webrtc-ui/

# 3. Configurar en MultiUIGameManager
```

### Configuración Ejemplo

```typescript
// En examples/webrtc-integration-example.ts
import { MultiUIGameConfig } from "../src/ui/MultiUIGameConfig";

const webrtcConfig: MultiUIGameConfig = {
  game: {
    id: "webrtc-demo",
    name: "WebRTC Communication Demo",
    version: "1.0.0"
  },
  ui: [
    {
      id: "webrtc-ui",
      name: "WebRTC Communication UI",
      type: "webrtc",
      enabled: true,
      config: {
        port: 9092,
        provideTemplate: true,
        enableVideo: true,
        enableAudio: true,
        enableDataChannel: true,
        enableScreenShare: true,
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" }
        ],
        // AlephScript room configuration
        roomConfig: {
          autoJoin: true,
          roomName: "webrtc-main-room",
          maxPeers: 8
        }
      }
    }
  ]
};
```

---

## 🎮 Funcionalidades WebRTC

### 📹 Video y Audio
- **Cámaras múltiples**: Selección de dispositivos
- **Configuración de calidad**: Resolución y bitrate adaptativos
- **Mute/Unmute**: Controles de audio y video
- **Picture-in-Picture**: Soporte para ventana flotante

### 🖥️ Screen Sharing
- **Pantalla completa**: Compartir toda la pantalla
- **Ventana específica**: Compartir aplicación individual
- **Control remoto**: Manejo de permisos

### 💬 Data Channels
- **Chat en tiempo real**: Mensajes de texto P2P
- **Transferencia de archivos**: Drag & drop
- **Datos de juego**: Estado sincronizado entre peers
- **Comandos de control**: Integración con AlephScript

### 🏠 Room Management
- **Creación de rooms**: A través de AlephScript
- **Join automático**: Basado en configuración
- **Moderación**: Controles de admin
- **Persistencia**: Rooms guardadas en AlephScript

---

## 🔧 Desarrollo y Contribución

### Setup del entorno
```bash
git clone https://github.com/escrivivir-co/web-rtc-gamify-ui
cd web-rtc-gamify-ui
npm install
```

### Scripts disponibles
```bash
npm run build          # Construir librería
npm run build:package  # Construir y empaquetar
npm run test           # Ejecutar tests
npm run lint           # Linter
npm run demo           # Aplicación de demo
```

### Testing con state-machine-mcp-driver
```bash
# 1. Desde web-rtc-gamify-ui
npm run build

# 2. Desde state-machine-mcp-driver  
npm install ../web-rtc-gamify-ui
npm run webrtc:demo
```

---

## 🔗 Enlaces Relacionados

- [state-machine-mcp-driver](../state-machine-mcp-driver) - Sistema de orquestación principal
- [threejs-gamify-ui](../threejs-gamify-ui) - Librería de referencia  
- [AlephScript Documentation](../socket-gym/alephscript) - Sistema de comunicaciones
- [WebRTC ChannelAgent](../state-machine-mcp-driver/src/orchestration/channel/webrtc-channel-agent.ts) - Agente de canal implementado

---

## 📝 Licencia

AIPL - Aleph Intelligence Proprietary License

---

## 🤝 Contribuir

1. Fork el proyecto
2. Crear feature branch (`git checkout -b feature/nueva-funcionalidad`)
3. Commit cambios (`git commit -am 'Añadir nueva funcionalidad'`)
4. Push al branch (`git push origin feature/nueva-funcionalidad`)
5. Crear Pull Request

---

## 🐛 Issues y Soporte

Para reportar bugs o solicitar features, crear un issue en el repositorio correspondiente.

**Mantenido por**: escrivivir-co
**Estado**: 🚧 En desarrollo
**Versión actual**: 1.0.0-alpha


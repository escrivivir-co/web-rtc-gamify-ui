/**
 * WebRTC Gamification UI
 * Real-time communication interface using WebRTC with Angular UI components
 */

import express from "express";
import path from "path";
import fs from "fs";
import { createServer } from "http";
import { Subject, BehaviorSubject } from "rxjs";
import { spawn, ChildProcess } from "child_process";
import { fileURLToPath } from "url";

import { 
  GamificationUI, 
  BaseGamificationUIConfig, 
  GameMessage, 
  UIPhase, 
  GamificationUIEvent 
} from "./GamificationUI";
import { MCPDriverAdapter } from "@/drivers/MCPDriverAdapter";
import { Runtime } from "@/runtime/Runtime";
import { Agent, AgentRole } from "@/models/Agent";
import { AgentPostulation } from "@/models/AgentPostulation";
import { Logger } from "@/utils/logger";
import { IOrchestratorChannels } from "@/orchestration/types";
import { AlephScriptClient } from "@/clients/alephscript-client";

/**
 * WebRTC-specific configuration extending base config
 */
export interface WebRTCGameUIConfig extends BaseGamificationUIConfig {
  /** Express server port */
  port: number;
  /** Static files directory for Angular build */
  staticDir: string;
  /** CORS origin settings */
  corsOrigin?: string;
  /** Use pre-compiled Angular template */
  provideTemplate?: boolean;
  /** Auto-open browser on start */
  autoOpenBrowser?: boolean;
  /** Path to webrtc-gamify-ui Angular project */
  angularProjectPath?: string;
  /** Maximum concurrent WebRTC connections */
  maxConnections?: number;
  /** Enable signaling server */
  enableSignaling?: boolean;
  /** STUN/TURN server configuration */
  iceServers?: RTCIceServer[];
  /** Room management settings */
  roomSettings?: {
    maxRoomsPerUser?: number;
    defaultRoomType?: 'public' | 'private' | 'protected';
    autoCleanupInterval?: number;
  };
}

/**
 * WebRTC Peer Connection Info
 */
export interface WebRTCPeer {
  id: string;
  name: string;
  connectionState: RTCPeerConnectionState;
  iceConnectionState: RTCIceConnectionState;
  signalingState: RTCSignalingState;
  localDescription: RTCSessionDescription | null;
  remoteDescription: RTCSessionDescription | null;
  connectedAt: number;
  lastActivity: number;
  room?: string;
  metadata?: Record<string, any>;
}

/**
 * WebRTC Room Information
 */
export interface WebRTCRoom {
  id: string;
  name: string;
  type: 'public' | 'private' | 'protected';
  password?: string;
  maxParticipants: number;
  currentParticipants: string[];
  owner: string;
  createdAt: number;
  settings: {
    enableChat: boolean;
    enableFileSharing: boolean;
    enableRecording: boolean;
    muteNewcomers: boolean;
    requireApproval: boolean;
  };
}

/**
 * WebRTC signaling message types
 */
export interface WebRTCSignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'join-room' | 'leave-room' | 'room-created' | 'room-destroyed';
  from: string;
  to?: string;
  room?: string;
  data: any;
  timestamp: number;
}

/**
 * WebRTC Gamification UI
 * Provides real-time communication interface using WebRTC technology
 */
export class WebRTCGamificationUI extends GamificationUI {
  private cfg: WebRTCGameUIConfig;
  private app!: express.Application;
  private server!: ReturnType<typeof createServer>;
  private isServerRunning = false;
  private clientLogs: Array<{ 
    level: string; 
    source?: string; 
    message: string; 
    stack?: string; 
    href?: string; 
    ts: number 
  }> = [];

  // WebRTC-specific state
  private connectedPeers: Map<string, WebRTCPeer> = new Map();
  private activeRooms: Map<string, WebRTCRoom> = new Map();
  private signalingMessages$ = new Subject<WebRTCSignalingMessage>();
  private peerConnections: Map<string, RTCPeerConnection> = new Map();

  // AlephScript integration (replaces direct Socket.IO)
  private orchestratorChannels?: IOrchestratorChannels;
  private proserpinaBot!: AlephScriptClient;
  private connectedClients: Set<string> = new Set();
  
  // Browser management
  private browserProcess?: ChildProcess;

  constructor(runtime: Runtime, mcp: MCPDriverAdapter, config: WebRTCGameUIConfig) {
    super(runtime, mcp, config);
    this.cfg = {
      provideTemplate: false, // Default: use dynamic HTML generation
      autoOpenBrowser: true,
      angularProjectPath: path.resolve(process.cwd(), "../web-rtc-gamify-ui/web-rtc-gamify-ui"),
      maxConnections: 50,
      enableSignaling: true,
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ],
      roomSettings: {
        maxRoomsPerUser: 5,
        defaultRoomType: 'public',
        autoCleanupInterval: 300000 // 5 minutes
      },
      ...config
    };

    this.setupWebRTCEventHandlers();
    this.setupRoomManagement();
  }

  // ===== Orchestrator Integration =====

  /**
   * Connect to orchestrator channels for multi-UI coordination
   */
  public connectOrchestrator(channels: IOrchestratorChannels): void {
    this.orchestratorChannels = channels;
    Logger.info(`🔗 WebRTC UI connected to orchestrator channels`);
  }

  // ===== Core UI Methods =====

  /**
   * Start the WebRTC UI server and initialize connections
   */
  async start(): Promise<void> {
    if (this.isServerRunning) {
      Logger.warn("⚠️ WebRTC UI server is already running");
      return;
    }

    try {
      await this.setupExpressServer();
      await this.startServer();
      await this.initializeAlephScriptIntegration();
      
      if (this.cfg.autoOpenBrowser) {
        await this.openBrowser();
      }

      this.isActive = true;
      this.currentPhase = "menu";
      await this.updatePhaseDisplay(this.currentPhase);

      Logger.info(`🚀 WebRTC Gamification UI started successfully on port ${this.cfg.port}`);
      this.emit(GamificationUIEvent.GAME_STARTED, { port: this.cfg.port });

    } catch (error) {
      Logger.error("❌ Failed to start WebRTC UI server:", error);
      this.emit(GamificationUIEvent.ERROR_OCCURRED, error);
      throw error;
    }
  }

  /**
   * Stop the WebRTC UI server and cleanup resources
   */
  async stop(): Promise<void> {
    if (!this.isServerRunning) {
      Logger.warn("⚠️ WebRTC UI server is not running");
      return;
    }

    try {
      // Close all peer connections
      this.peerConnections.forEach((pc, peerId) => {
        pc.close();
        Logger.debug(`🔌 Closed peer connection: ${peerId}`);
      });
      this.peerConnections.clear();

      // Clear rooms and peers
      this.activeRooms.clear();
      this.connectedPeers.clear();

      // Close browser if opened
      if (this.browserProcess) {
        this.browserProcess.kill();
        this.browserProcess = undefined;
      }

      // Stop express server
      if (this.server) {
        await new Promise<void>((resolve) => {
          this.server.close(() => resolve());
        });
      }

      // Cleanup AlephScript
      if (this.proserpinaBot) {
        this.proserpinaBot.disconnect();
      }

      this.isServerRunning = false;
      this.isActive = false;

      // Complete observables
      this.destroy$.next();
      this.destroy$.complete();

      Logger.info("🛑 WebRTC Gamification UI stopped successfully");
      this.emit(GamificationUIEvent.GAME_STOPPED);

    } catch (error) {
      Logger.error("❌ Error stopping WebRTC UI:", error);
      this.emit(GamificationUIEvent.ERROR_OCCURRED, error);
      throw error;
    }
  }

  /**
   * Display message in the WebRTC UI
   */
  async displayMessage(message: GameMessage): Promise<void> {
    if (!this.isActive) {
      Logger.warn("⚠️ Cannot display message: WebRTC UI not active");
      return;
    }

    try {
      // Broadcast message to all connected clients via AlephScript
      this.broadcastToClients("game-message", {
        message,
        timestamp: Date.now()
      });

      // Store in current thread if exists
      if (this.currentThread) {
        this.currentThread.messages.push(message);
        this.currentThread.messageCount++;
      }

      Logger.debug(`💬 Message displayed in WebRTC UI: ${message.type} - ${message.content.substring(0, 50)}...`);

    } catch (error) {
      Logger.error("❌ Error displaying message in WebRTC UI:", error);
      this.emit(GamificationUIEvent.ERROR_OCCURRED, error);
    }
  }

  /**
   * Display agent postulations for user selection
   */
  async displayAgentPostulations(postulations: AgentPostulation[]): Promise<void> {
    if (!this.isActive) {
      Logger.warn("⚠️ Cannot display postulations: WebRTC UI not active");
      return;
    }

    try {
      this.pendingPostulations = postulations;
      this.awaitingAgentSelection = true;
      this.currentPhase = "postulation";

      await this.updatePhaseDisplay(this.currentPhase);

      // Send postulations to clients via AlephScript
      this.broadcastToClients("agent-postulations", {
        postulations: postulations.map(p => ({
          id: p.id,
          agent: p.agent,
          reasoning: p.reasoning,
          confidence: p.confidence,
          greediness: p.greediness,
          context: p.context
        })),
        timestamp: Date.now()
      });

      Logger.info(`🤖 Displayed ${postulations.length} agent postulations in WebRTC UI`);
      this.emit(GamificationUIEvent.POSTULATIONS_GENERATED, { postulations });

    } catch (error) {
      Logger.error("❌ Error displaying postulations in WebRTC UI:", error);
      this.emit(GamificationUIEvent.ERROR_OCCURRED, error);
    }
  }

  /**
   * Display system notification
   */
  async displayNotification(
    title: string, 
    message: string, 
    type: "info" | "success" | "warning" | "error" = "info"
  ): Promise<void> {
    if (!this.isActive) {
      Logger.warn("⚠️ Cannot display notification: WebRTC UI not active");
      return;
    }

    try {
      // Send notification to all clients
      this.broadcastToClients("notification", {
        title,
        message,
        type,
        timestamp: Date.now()
      });

      Logger.info(`🔔 Notification sent: [${type.toUpperCase()}] ${title} - ${message}`);

    } catch (error) {
      Logger.error("❌ Error displaying notification in WebRTC UI:", error);
      this.emit(GamificationUIEvent.ERROR_OCCURRED, error);
    }
  }

  /**
   * Update UI phase display
   */
  async updatePhaseDisplay(phase: UIPhase): Promise<void> {
    try {
      this.currentPhase = phase;
      
      // Broadcast phase change to all clients
      this.broadcastToClients("phase-change", {
        phase,
        timestamp: Date.now()
      });

      this.emit(GamificationUIEvent.PHASE_CHANGED, { phase });
      Logger.debug(`🎭 WebRTC UI phase changed to: ${phase}`);

    } catch (error) {
      Logger.error("❌ Error updating phase display:", error);
      this.emit(GamificationUIEvent.ERROR_OCCURRED, error);
    }
  }

  // ===== WebRTC-Specific Methods =====

  /**
   * Create a new WebRTC room
   */
  async createRoom(roomConfig: Partial<WebRTCRoom>): Promise<WebRTCRoom> {
    const roomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const room: WebRTCRoom = {
      id: roomId,
      name: roomConfig.name || `Room ${roomId}`,
      type: roomConfig.type || this.cfg.roomSettings?.defaultRoomType || 'public',
      password: roomConfig.password,
      maxParticipants: roomConfig.maxParticipants || 10,
      currentParticipants: [],
      owner: roomConfig.owner || 'system',
      createdAt: Date.now(),
      settings: {
        enableChat: true,
        enableFileSharing: true,
        enableRecording: false,
        muteNewcomers: false,
        requireApproval: false,
        ...roomConfig.settings
      }
    };

    this.activeRooms.set(roomId, room);
    
    // Broadcast room creation
    this.broadcastToClients("room-created", { room });
    
    Logger.info(`🏠 WebRTC room created: ${room.name} (${roomId})`);
    return room;
  }

  /**
   * Join a WebRTC room
   */
  async joinRoom(peerId: string, roomId: string, password?: string): Promise<boolean> {
    const room = this.activeRooms.get(roomId);
    if (!room) {
      Logger.warn(`⚠️ Room not found: ${roomId}`);
      return false;
    }

    // Check password for protected rooms
    if (room.type === 'protected' && room.password !== password) {
      Logger.warn(`⚠️ Invalid password for room: ${roomId}`);
      return false;
    }

    // Check room capacity
    if (room.currentParticipants.length >= room.maxParticipants) {
      Logger.warn(`⚠️ Room full: ${roomId}`);
      return false;
    }

    // Add participant to room
    if (!room.currentParticipants.includes(peerId)) {
      room.currentParticipants.push(peerId);
      
      // Update peer info
      const peer = this.connectedPeers.get(peerId);
      if (peer) {
        peer.room = roomId;
        peer.lastActivity = Date.now();
      }

      // Broadcast room update
      this.broadcastToClients("room-updated", { room });
      
      Logger.info(`🚪 Peer ${peerId} joined room ${roomId}`);
      return true;
    }

    return false;
  }

  /**
   * Leave a WebRTC room
   */
  async leaveRoom(peerId: string, roomId: string): Promise<void> {
    const room = this.activeRooms.get(roomId);
    if (!room) return;

    // Remove participant from room
    room.currentParticipants = room.currentParticipants.filter(id => id !== peerId);
    
    // Update peer info
    const peer = this.connectedPeers.get(peerId);
    if (peer) {
      peer.room = undefined;
    }

    // Clean up empty rooms (except if owner is still present)
    if (room.currentParticipants.length === 0 && room.owner === peerId) {
      this.activeRooms.delete(roomId);
      this.broadcastToClients("room-destroyed", { roomId });
      Logger.info(`🗑️ Room ${roomId} destroyed (empty)`);
    } else {
      this.broadcastToClients("room-updated", { room });
    }

    Logger.info(`🚪 Peer ${peerId} left room ${roomId}`);
  }

  /**
   * Get all active rooms
   */
  getActiveRooms(): WebRTCRoom[] {
    return Array.from(this.activeRooms.values());
  }

  /**
   * Get all connected peers
   */
  getConnectedPeers(): WebRTCPeer[] {
    return Array.from(this.connectedPeers.values());
  }

  /**
   * Handle WebRTC signaling
   */
  async handleSignalingMessage(message: WebRTCSignalingMessage): Promise<void> {
    try {
      this.signalingMessages$.next(message);
      
      // Route signaling message to appropriate peer
      if (message.to) {
        this.sendToPeer(message.to, "webrtc-signaling", message);
      } else if (message.room) {
        this.broadcastToRoom(message.room, "webrtc-signaling", message);
      }

      Logger.debug(`📡 WebRTC signaling: ${message.type} from ${message.from}`);

    } catch (error) {
      Logger.error("❌ Error handling signaling message:", error);
    }
  }

  // ===== Private Methods =====

  /**
   * Setup Express server with WebRTC UI
   */
  private async setupExpressServer(): Promise<void> {
    this.app = express();
    this.app.use(express.json());
    this.app.use(express.static(this.cfg.staticDir));

    // CORS setup
    if (this.cfg.corsOrigin) {
      this.app.use((req, res, next) => {
        res.header("Access-Control-Allow-Origin", this.cfg.corsOrigin);
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
        next();
      });
    }

    // Serve Angular app or dynamic HTML
    this.app.get("/", (req, res) => {
      if (this.cfg.provideTemplate) {
        this.serveAngularTemplate(res);
      } else {
        res.send(this.generateHTML());
      }
    });

    // WebRTC signaling endpoints
    this.app.post("/api/signaling", (req, res) => {
      this.handleSignalingMessage(req.body);
      res.json({ success: true });
    });

    // Room management endpoints
    this.app.get("/api/rooms", (req, res) => {
      res.json(this.getActiveRooms());
    });

    this.app.post("/api/rooms", async (req, res) => {
      try {
        const room = await this.createRoom(req.body);
        res.json(room);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Peer management endpoints
    this.app.get("/api/peers", (req, res) => {
      res.json(this.getConnectedPeers());
    });

    Logger.debug("🛠️ Express server configured for WebRTC UI");
  }

  /**
   * Start the Express server
   */
  private async startServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = createServer(this.app);
        
        this.server.listen(this.cfg.port, () => {
          this.isServerRunning = true;
          Logger.info(`🌐 WebRTC UI server running on http://localhost:${this.cfg.port}`);
          resolve();
        });

        this.server.on("error", (error) => {
          Logger.error("❌ Server error:", error);
          reject(error);
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Initialize AlephScript integration for WebRTC communication
   */
  private async initializeAlephScriptIntegration(): Promise<void> {
    // Setup AlephScript bot for WebRTC coordination
    this.proserpinaBot = new AlephScriptClient(`WebRTC_UI_${this.cfg.port}`);
    
    // Setup WebRTC-specific event handlers
    this.setupAlephScriptHandlers();
    
    Logger.info("🤖 AlephScript integration initialized for WebRTC UI");
  }

  /**
   * Setup WebRTC event handlers
   */
  private setupWebRTCEventHandlers(): void {
    // Handle signaling messages
    this.signalingMessages$.subscribe(message => {
      Logger.debug(`📡 Processing signaling message: ${message.type}`);
    });

    Logger.debug("🔧 WebRTC event handlers configured");
  }

  /**
   * Setup room management and cleanup
   */
  private setupRoomManagement(): void {
    // Auto-cleanup empty rooms
    if (this.cfg.roomSettings?.autoCleanupInterval) {
      setInterval(() => {
        this.cleanupEmptyRooms();
      }, this.cfg.roomSettings.autoCleanupInterval);
    }

    Logger.debug("🏠 Room management configured");
  }

  /**
   * Clean up empty rooms
   */
  private cleanupEmptyRooms(): void {
    const now = Date.now();
    const threshold = 10 * 60 * 1000; // 10 minutes

    for (const [roomId, room] of this.activeRooms) {
      if (room.currentParticipants.length === 0 && 
          (now - room.createdAt) > threshold) {
        this.activeRooms.delete(roomId);
        this.broadcastToClients("room-destroyed", { roomId });
        Logger.info(`🗑️ Auto-cleaned empty room: ${roomId}`);
      }
    }
  }

  /**
   * Setup AlephScript event handlers for WebRTC operations
   */
  private setupAlephScriptHandlers(): void {
    if (!this.proserpinaBot) return;

    // WebRTC-specific AlephScript triggers
    this.proserpinaBot.initTriggersDefinition.push(() => {
      const ROOM_NAME = this.proserpinaBot.name + "_WEBRTC_ROOM";
      const REGISTER_PAYLOAD = { 
        usuario: this.proserpinaBot.name, 
        sesion: `WebRTC_${Date.now()}`
      };
      
      this.proserpinaBot.io.emit("CLIENT_REGISTER", REGISTER_PAYLOAD);
      this.proserpinaBot.io.emit("CLIENT_SUSCRIBE", { room: ROOM_NAME });
      this.proserpinaBot.room("MAKE_MASTER", { 
        features: ["WebRTC_Signaling", "Room_Management", "Peer_Coordination"] 
      }, ROOM_NAME);

      // WebRTC-specific event handlers
      this.proserpinaBot.io.on('webrtc-offer', (data: any) => {
        this.handleSignalingMessage({ type: 'offer', ...data, timestamp: Date.now() });
      });

      this.proserpinaBot.io.on('webrtc-answer', (data: any) => {
        this.handleSignalingMessage({ type: 'answer', ...data, timestamp: Date.now() });
      });

      this.proserpinaBot.io.on('webrtc-ice-candidate', (data: any) => {
        this.handleSignalingMessage({ type: 'ice-candidate', ...data, timestamp: Date.now() });
      });

      this.proserpinaBot.io.on('join-room', async (data: any) => {
        if (data.peerId && data.roomId) {
          await this.joinRoom(data.peerId, data.roomId, data.password);
        }
      });

      this.proserpinaBot.io.on('leave-room', async (data: any) => {
        if (data.peerId && data.roomId) {
          await this.leaveRoom(data.peerId, data.roomId);
        }
      });

      this.proserpinaBot.io.on('create-room', async (data: any) => {
        try {
          const room = await this.createRoom(data.roomConfig || {});
          this.proserpinaBot.io.emit('room-created', { room });
        } catch (error) {
          Logger.error("❌ Error creating room via AlephScript:", error);
        }
      });

      Logger.info("🤖 WebRTC AlephScript handlers configured");
    });
  }

  /**
   * Broadcast message to all connected clients via AlephScript
   */
  private broadcastToClients(event: string, data: any): void {
    if (this.proserpinaBot && this.proserpinaBot.io) {
      this.proserpinaBot.io.emit("broadcast", { event, data });
      Logger.debug(`📡 Broadcast: ${event}`);
    }
  }

  /**
   * Send message to specific peer
   */
  private sendToPeer(peerId: string, event: string, data: any): void {
    if (this.proserpinaBot && this.proserpinaBot.io) {
      this.proserpinaBot.io.emit("send-to-peer", { peerId, event, data });
      Logger.debug(`📤 Sent to peer ${peerId}: ${event}`);
    }
  }

  /**
   * Broadcast message to all peers in a specific room
   */
  private broadcastToRoom(roomId: string, event: string, data: any): void {
    const room = this.activeRooms.get(roomId);
    if (room) {
      room.currentParticipants.forEach(peerId => {
        this.sendToPeer(peerId, event, data);
      });
      Logger.debug(`📡 Broadcast to room ${roomId}: ${event}`);
    }
  }

  /**
   * Serve pre-compiled Angular template
   */
  private serveAngularTemplate(res: express.Response): void {
    const templatePath = path.join(this.cfg.angularProjectPath!, "dist", "index.html");
    
    if (fs.existsSync(templatePath)) {
      res.sendFile(templatePath);
      Logger.debug("📄 Served pre-compiled Angular template");
    } else {
      Logger.warn("⚠️ Angular template not found, falling back to dynamic HTML");
      res.send(this.generateHTML());
    }
  }

  /**
   * Generate dynamic HTML for WebRTC UI
   */
  private generateHTML(): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.cfg.gameTitle} - WebRTC UI</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      min-height: 100vh;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      text-align: center;
    }
    .status {
      background: rgba(255,255,255,0.1);
      border-radius: 12px;
      padding: 30px;
      margin-bottom: 20px;
      backdrop-filter: blur(10px);
    }
    .btn {
      padding: 12px 24px;
      background: #3498db;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      margin: 8px;
      font-size: 16px;
      transition: background 0.3s ease;
    }
    .btn:hover {
      background: #2980b9;
    }
    .webrtc-controls {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 20px;
      margin-top: 30px;
    }
    .control-panel {
      background: rgba(255,255,255,0.1);
      border-radius: 12px;
      padding: 20px;
      backdrop-filter: blur(10px);
    }
    .peer-list, .room-list {
      text-align: left;
      margin-top: 15px;
    }
    .peer-item, .room-item {
      background: rgba(255,255,255,0.1);
      border-radius: 6px;
      padding: 10px;
      margin: 8px 0;
      font-size: 14px;
    }
    .status-indicator {
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      margin-right: 8px;
    }
    .status-connected { background: #2ecc71; }
    .status-connecting { background: #f39c12; }
    .status-disconnected { background: #e74c3c; }
  </style>
</head>
<body>
  <div class="container">
    <div class="status">
      <h1>🌐 ${this.cfg.gameTitle}</h1>
      <p>WebRTC Gamification UI (AlephScript Integrated)</p>
      <p id="connection-status">Initializing WebRTC interface...</p>
      <button class="btn" onclick="testConnection()">Test Connection</button>
      <button class="btn" onclick="createRoom()">Create Room</button>
      <button class="btn" onclick="refreshRooms()">Refresh Rooms</button>
    </div>
    
    <div class="webrtc-controls">
      <div class="control-panel">
        <h3>📡 Connected Peers</h3>
        <div id="peer-list" class="peer-list">
          <div class="peer-item">No peers connected</div>
        </div>
      </div>
      
      <div class="control-panel">
        <h3>🏠 Active Rooms</h3>
        <div id="room-list" class="room-list">
          <div class="room-item">No rooms available</div>
        </div>
      </div>
      
      <div class="control-panel">
        <h3>⚙️ WebRTC Status</h3>
        <div id="webrtc-status">
          <div class="status-item">
            <span class="status-indicator status-connecting"></span>
            Initializing WebRTC...
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Socket.IO for AlephScript integration -->
  <script src="https://cdn.socket.io/4.7.5/socket.io.min.js"></script>
  <script src="/assets/alephscript-client.js"></script>
  
  <script>
    let alephClient = null;
    let webrtcPeers = new Map();
    let activeRooms = new Map();
    
    // Initialize AlephScript connection
    function initializeAlephScript() {
      console.log('🔌 Initializing AlephScript WebRTC client...');
      
      if (typeof createAlephScriptClient !== 'undefined') {
        alephClient = createAlephScriptClient('WebRTC_Browser_Client');
        
        // Setup WebRTC event handlers
        alephClient.io.on('game-message', (data) => {
          console.log('📨 Game message received:', data);
          displayGameMessage(data.message);
        });
        
        alephClient.io.on('notification', (data) => {
          console.log('🔔 Notification received:', data);
          showNotification(data.title, data.message, data.type);
        });
        
        alephClient.io.on('phase-change', (data) => {
          console.log('🎭 Phase change:', data.phase);
          updatePhaseDisplay(data.phase);
        });
        
        alephClient.io.on('webrtc-signaling', (data) => {
          console.log('📡 WebRTC signaling:', data);
          handleSignalingMessage(data);
        });
        
        alephClient.io.on('room-created', (data) => {
          console.log('🏠 Room created:', data.room);
          updateRoomList();
        });
        
        alephClient.io.on('room-updated', (data) => {
          console.log('🏠 Room updated:', data.room);
          updateRoomList();
        });
        
        alephClient.io.on('room-destroyed', (data) => {
          console.log('🗑️ Room destroyed:', data.roomId);
          updateRoomList();
        });
        
        updateConnectionStatus('Connected to AlephScript', 'connected');
        console.log('✅ AlephScript WebRTC client initialized');
        
        // Initialize WebRTC components
        initializeWebRTC();
        
      } else {
        console.error('❌ AlephScript client not available');
        updateConnectionStatus('AlephScript client not available', 'disconnected');
      }
    }
    
    // Initialize WebRTC functionality
    function initializeWebRTC() {
      console.log('🌐 Initializing WebRTC functionality...');
      
      // Check WebRTC support
      if (!window.RTCPeerConnection) {
        console.error('❌ WebRTC not supported in this browser');
        updateConnectionStatus('WebRTC not supported', 'disconnected');
        return;
      }
      
      console.log('✅ WebRTC supported, version:', navigator.userAgent);
      updateWebRTCStatus('WebRTC ready', 'connected');
      
      // Load initial data
      refreshRooms();
      refreshPeers();
      
      // Setup periodic updates
      setInterval(refreshPeers, 5000);
      setInterval(refreshRooms, 10000);
    }
    
    // Test connection functionality
    function testConnection() {
      if (alephClient && alephClient.io.connected) {
        alephClient.io.emit('webrtc-test', { 
          message: 'WebRTC UI test message',
          timestamp: Date.now() 
        });
        showNotification('Connection Test', 'Test message sent via AlephScript', 'info');
      } else {
        showNotification('Connection Error', 'Not connected to AlephScript', 'error');
      }
    }
    
    // Create a new room
    function createRoom() {
      const roomName = prompt('Enter room name:');
      if (roomName && alephClient) {
        alephClient.io.emit('create-room', {
          roomConfig: {
            name: roomName,
            type: 'public',
            maxParticipants: 10,
            owner: 'browser_client'
          }
        });
      }
    }
    
    // Refresh rooms list
    async function refreshRooms() {
      try {
        const response = await fetch('/api/rooms');
        const rooms = await response.json();
        updateRoomListDisplay(rooms);
      } catch (error) {
        console.error('❌ Error refreshing rooms:', error);
      }
    }
    
    // Refresh peers list
    async function refreshPeers() {
      try {
        const response = await fetch('/api/peers');
        const peers = await response.json();
        updatePeerListDisplay(peers);
      } catch (error) {
        console.error('❌ Error refreshing peers:', error);
      }
    }
    
    // Update UI displays
    function updateConnectionStatus(message, status) {
      const statusEl = document.getElementById('connection-status');
      if (statusEl) {
        statusEl.textContent = message;
        statusEl.className = 'status-' + status;
      }
    }
    
    function updateWebRTCStatus(message, status) {
      const statusEl = document.getElementById('webrtc-status');
      if (statusEl) {
        statusEl.innerHTML = \`
          <div class="status-item">
            <span class="status-indicator status-\${status}"></span>
            \${message}
          </div>
        \`;
      }
    }
    
    function updateRoomListDisplay(rooms) {
      const roomList = document.getElementById('room-list');
      if (roomList) {
        if (rooms.length === 0) {
          roomList.innerHTML = '<div class="room-item">No rooms available</div>';
        } else {
          roomList.innerHTML = rooms.map(room => \`
            <div class="room-item">
              <strong>\${room.name}</strong> (\${room.type})
              <br>Participants: \${room.currentParticipants.length}/\${room.maxParticipants}
              <button class="btn" onclick="joinRoom('\${room.id}')" style="font-size: 12px; padding: 4px 8px; margin: 4px 0;">Join</button>
            </div>
          \`).join('');
        }
      }
    }
    
    function updatePeerListDisplay(peers) {
      const peerList = document.getElementById('peer-list');
      if (peerList) {
        if (peers.length === 0) {
          peerList.innerHTML = '<div class="peer-item">No peers connected</div>';
        } else {
          peerList.innerHTML = peers.map(peer => \`
            <div class="peer-item">
              <span class="status-indicator status-\${peer.connectionState === 'connected' ? 'connected' : 'disconnected'}"></span>
              <strong>\${peer.name}</strong>
              <br>State: \${peer.connectionState}
              \${peer.room ? '<br>Room: ' + peer.room : ''}
            </div>
          \`).join('');
        }
      }
    }
    
    function joinRoom(roomId) {
      if (alephClient) {
        alephClient.io.emit('join-room', {
          peerId: 'browser_client_' + Date.now(),
          roomId: roomId
        });
        showNotification('Room', 'Joining room...', 'info');
      }
    }
    
    function showNotification(title, message, type) {
      // Simple notification display
      const notification = document.createElement('div');
      notification.style.cssText = \`
        position: fixed;
        top: 20px;
        right: 20px;
        background: \${type === 'error' ? '#e74c3c' : type === 'success' ? '#2ecc71' : '#3498db'};
        color: white;
        padding: 15px 20px;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 1000;
        max-width: 300px;
      \`;
      notification.innerHTML = \`<strong>\${title}</strong><br>\${message}\`;
      document.body.appendChild(notification);
      
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 5000);
    }
    
    function displayGameMessage(message) {
      console.log('🎮 Game message:', message);
      showNotification('Game Message', message.content, 'info');
    }
    
    function updatePhaseDisplay(phase) {
      console.log('🎭 Phase update:', phase);
      updateConnectionStatus(\`Phase: \${phase}\`, 'connected');
    }
    
    function handleSignalingMessage(data) {
      console.log('📡 Handling signaling:', data);
      // WebRTC signaling logic would go here
    }
    
    // Initialize on page load
    document.addEventListener('DOMContentLoaded', function() {
      console.log('🌐 WebRTC Gamification UI loaded');
      initializeAlephScript();
    });
  </script>
</body>
</html>
    `;
  }

  /**
   * Open browser to WebRTC UI
   */
  private async openBrowser(): Promise<void> {
    if (this.browserProcess) {
      Logger.warn("⚠️ Browser already opened");
      return;
    }

    try {
      const url = `http://localhost:${this.cfg.port}`;
      let command: string;
      let args: string[];

      // Determine platform and browser command
      if (process.platform === "win32") {
        command = "cmd";
        args = ["/c", "start", "", url];
      } else if (process.platform === "darwin") {
        command = "open";
        args = [url];
      } else {
        command = "xdg-open";
        args = [url];
      }

      this.browserProcess = spawn(command, args, {
        detached: true,
        stdio: "ignore"
      });

      this.browserProcess.unref();
      Logger.info(`🌐 Browser opened to WebRTC UI: ${url}`);

    } catch (error) {
      Logger.error("❌ Failed to open browser:", error);
    }
  }
}

export default WebRTCGamificationUI;

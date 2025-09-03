/**
 * WebRTC Orchestrator
 * High-level orchestration service for complete WebRTC system management
 */

import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject, Observable, combineLatest } from 'rxjs';
import { map, filter, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { WebRTCEngine, WebRTCPeer, WebRTCRoom, WebRTCEngineEvent } from './webrtc-engine.service';
import { WebRTCAlephClient, WebRTCAlephMessage } from './webrtc-aleph-client.service';

/**
 * Orchestrator State
 */
export interface OrchestratorState {
  isInitialized: boolean;
  isConnected: boolean;
  currentMode: 'standalone' | 'room-based' | 'mesh-network';
  activePeers: number;
  totalRooms: number;
  currentRoom?: string;
  lastActivity: Date;
}

/**
 * Orchestrator Configuration
 */
export interface OrchestratorConfig {
  /** Enable auto-initialization */
  autoInit?: boolean;
  /** Default connection mode */
  defaultMode?: 'standalone' | 'room-based' | 'mesh-network';
  /** Enable gamification features */
  enableGamification?: boolean;
  /** Maximum concurrent connections */
  maxConnections?: number;
  /** Enable debug logging */
  debug?: boolean;
  /** Auto-create room on startup */
  autoCreateRoom?: boolean;
  /** Default room name */
  defaultRoomName?: string;
  /** Enable media by default */
  enableMediaByDefault?: boolean;
  /** AlephScript integration */
  alephIntegration?: {
    autoConnect?: boolean;
    clientId?: string;
    serverUrl?: string;
  };
}

/**
 * Orchestrator Events
 */
export interface OrchestratorEvent {
  type: 'system-ready' | 'mode-changed' | 'peer-management' | 
        'room-management' | 'error' | 'gamification-event';
  data?: any;
  timestamp: Date;
  metadata?: Record<string, any>;
}

/**
 * Peer Management Options
 */
export interface PeerManagementOptions {
  autoAccept?: boolean;
  enableData?: boolean;
  enableVideo?: boolean;
  enableAudio?: boolean;
  gamificationLevel?: number;
  metadata?: Record<string, any>;
}

/**
 * Room Management Options
 */
export interface RoomManagementOptions {
  roomType?: 'public' | 'private' | 'protected';
  maxParticipants?: number;
  features?: string[];
  gamificationEnabled?: boolean;
  autoJoin?: boolean;
  password?: string;
}

/**
 * WebRTC Orchestrator
 * Central coordination service for the entire WebRTC system
 */
@Injectable({
  providedIn: 'root'
})
export class WebRTCOrchestrator {
  private config: Required<OrchestratorConfig>;
  private destroy$ = new Subject<void>();
  
  // State management
  private state$ = new BehaviorSubject<OrchestratorState>({
    isInitialized: false,
    isConnected: false,
    currentMode: 'standalone',
    activePeers: 0,
    totalRooms: 0,
    lastActivity: new Date()
  });
  
  private events$ = new Subject<OrchestratorEvent>();
  private isReady$ = new BehaviorSubject<boolean>(false);
  
  // System health monitoring
  private healthCheck$ = new BehaviorSubject<boolean>(true);
  private performanceMetrics$ = new BehaviorSubject<any>({
    connectionLatency: 0,
    dataTransferRate: 0,
    errorRate: 0,
    uptime: 0
  });
  
  // Activity tracking
  private activityTracking = {
    connectionsInitiated: 0,
    connectionsCompleted: 0,
    messagesExchanged: 0,
    roomsCreated: 0,
    roomsJoined: 0,
    errorsEncountered: 0,
    startTime: new Date()
  };

  constructor(
    private webrtcEngine: WebRTCEngine,
    private alephClient: WebRTCAlephClient
  ) {
    this.config = {
      autoInit: true,
      defaultMode: 'room-based',
      enableGamification: true,
      maxConnections: 10,
      debug: false,
      autoCreateRoom: false,
      defaultRoomName: 'Main Room',
      enableMediaByDefault: false,
      alephIntegration: {
        autoConnect: true,
        clientId: `WebRTC_Orchestrator_${Date.now()}`,
        serverUrl: 'http://localhost:3000'
      }
    };

    this.setupEventListeners();
    this.startHealthMonitoring();
  }

  /**
   * Initialize the orchestrator
   */
  async initialize(config?: Partial<OrchestratorConfig>): Promise<void> {
    if (config) {
      this.config = { ...this.config, ...config };
    }

    if (this.config.debug) {
      console.log('🎯 Initializing WebRTC Orchestrator:', this.config);
    }

    try {
      // Initialize AlephScript client
      if (this.config.alephIntegration.autoConnect) {
        await this.alephClient.initialize({
          clientId: this.config.alephIntegration.clientId,
          serverUrl: this.config.alephIntegration.serverUrl,
          debug: this.config.debug
        });
      }

      // Initialize WebRTC engine
      await this.webrtcEngine.initialize({
        debug: this.config.debug,
        maxConnections: this.config.maxConnections,
        autoAcceptConnections: true
      });

      // Update state
      const currentState = this.state$.value;
      this.state$.next({
        ...currentState,
        isInitialized: true,
        isConnected: this.alephClient.isConnected(),
        currentMode: this.config.defaultMode,
        lastActivity: new Date()
      });

      // Auto-create room if configured
      if (this.config.autoCreateRoom) {
        await this.createRoom(this.config.defaultRoomName, {
          roomType: 'public',
          maxParticipants: this.config.maxConnections,
          gamificationEnabled: this.config.enableGamification
        });
      }

      this.isReady$.next(true);
      
      this.emitEvent({
        type: 'system-ready',
        data: { config: this.config, state: this.state$.value },
        timestamp: new Date()
      });

      if (this.config.debug) {
        console.log('✅ WebRTC Orchestrator initialized successfully');
      }

    } catch (error) {
      console.error('❌ Failed to initialize WebRTC Orchestrator:', error);
      this.emitEvent({
        type: 'error',
        data: { error, phase: 'initialization' },
        timestamp: new Date()
      });
      throw error;
    }
  }

  /**
   * Setup event listeners for system components
   */
  private setupEventListeners(): void {
    // WebRTC Engine events
    this.webrtcEngine.getEvents()
      .pipe(takeUntil(this.destroy$))
      .subscribe(event => this.handleEngineEvent(event));

    // AlephScript connection status
    this.alephClient.getConnectionStatus()
      .pipe(takeUntil(this.destroy$))
      .subscribe(connected => {
        const currentState = this.state$.value;
        this.state$.next({
          ...currentState,
          isConnected: connected,
          lastActivity: new Date()
        });
      });

    // Peers and rooms updates
    combineLatest([
      this.webrtcEngine.getPeers(),
      this.webrtcEngine.getRooms()
    ]).pipe(
      takeUntil(this.destroy$),
      map(([peers, rooms]) => ({
        activePeers: peers.size,
        totalRooms: rooms.size
      })),
      distinctUntilChanged((a, b) => 
        a.activePeers === b.activePeers && a.totalRooms === b.totalRooms
      )
    ).subscribe(({ activePeers, totalRooms }) => {
      const currentState = this.state$.value;
      this.state$.next({
        ...currentState,
        activePeers,
        totalRooms,
        lastActivity: new Date()
      });
    });

    // Current room updates
    this.webrtcEngine.getCurrentRoom()
      .pipe(takeUntil(this.destroy$))
      .subscribe(room => {
        const currentState = this.state$.value;
        this.state$.next({
          ...currentState,
          currentRoom: room?.id,
          lastActivity: new Date()
        });
      });
  }

  /**
   * Handle WebRTC Engine events
   */
  private handleEngineEvent(event: WebRTCEngineEvent): void {
    // Update activity tracking
    switch (event.type) {
      case 'peer-connected':
        this.activityTracking.connectionsCompleted++;
        break;
      case 'data-received':
        this.activityTracking.messagesExchanged++;
        break;
      case 'room-joined':
        this.activityTracking.roomsJoined++;
        break;
      case 'connection-failed':
        this.activityTracking.errorsEncountered++;
        break;
    }

    // Emit orchestrator event
    this.emitEvent({
      type: 'peer-management',
      data: event,
      timestamp: new Date(),
      metadata: { source: 'webrtc-engine' }
    });

    if (this.config.debug) {
      console.log('🎭 Handling engine event:', event);
    }
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    setInterval(() => {
      const isHealthy = this.checkSystemHealth();
      this.healthCheck$.next(isHealthy);
      this.updatePerformanceMetrics();
    }, 5000); // Check every 5 seconds
  }

  /**
   * Check system health
   */
  private checkSystemHealth(): boolean {
    const state = this.state$.value;
    const hasActiveConnections = state.activePeers > 0;
    const isConnectedToAleph = state.isConnected;
    const timeSinceLastActivity = Date.now() - state.lastActivity.getTime();
    const isActive = timeSinceLastActivity < 30000; // 30 seconds

    return state.isInitialized && (isConnectedToAleph || hasActiveConnections) && isActive;
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(): void {
    const uptime = Date.now() - this.activityTracking.startTime.getTime();
    const errorRate = this.activityTracking.errorsEncountered / 
                     Math.max(1, this.activityTracking.connectionsInitiated);

    this.performanceMetrics$.next({
      connectionLatency: this.calculateAverageLatency(),
      dataTransferRate: this.calculateDataTransferRate(),
      errorRate: errorRate * 100,
      uptime: uptime,
      totalConnections: this.activityTracking.connectionsCompleted,
      totalMessages: this.activityTracking.messagesExchanged,
      totalRooms: this.activityTracking.roomsCreated + this.activityTracking.roomsJoined
    });
  }

  /**
   * Calculate average connection latency
   */
  private calculateAverageLatency(): number {
    // Simplified latency calculation
    // In real implementation, you'd track actual connection times
    const peers = this.webrtcEngine.getConnectedPeers();
    if (peers.length === 0) return 0;

    return peers.reduce((sum, peer) => {
      const timeSinceConnect = Date.now() - peer.lastActivity.getTime();
      return sum + Math.min(timeSinceConnect, 1000); // Cap at 1 second
    }, 0) / peers.length;
  }

  /**
   * Calculate data transfer rate
   */
  private calculateDataTransferRate(): number {
    // Simplified calculation
    const uptime = Date.now() - this.activityTracking.startTime.getTime();
    const ratePerSecond = (this.activityTracking.messagesExchanged * 1000) / Math.max(1, uptime);
    return Math.round(ratePerSecond * 100) / 100;
  }

  // ===== Public API Methods =====

  /**
   * Create a new room with orchestrated management
   */
  async createRoom(roomName: string, options?: RoomManagementOptions): Promise<WebRTCRoom> {
    const roomOptions = {
      roomType: 'public' as const,
      maxParticipants: this.config.maxConnections,
      features: this.config.enableGamification ? ['gamification'] : [],
      gamificationEnabled: this.config.enableGamification,
      autoJoin: true,
      ...options
    };

    try {
      const room = await this.webrtcEngine.createRoom(
        roomName,
        roomOptions.roomType,
        roomOptions.maxParticipants,
        roomOptions.features
      );

      this.activityTracking.roomsCreated++;

      this.emitEvent({
        type: 'room-management',
        data: { action: 'created', room },
        timestamp: new Date(),
        metadata: { gamificationEnabled: roomOptions.gamificationEnabled }
      });

      if (this.config.debug) {
        console.log('🏠 Room created via orchestrator:', room);
      }

      return room;
    } catch (error) {
      this.activityTracking.errorsEncountered++;
      console.error('❌ Failed to create room:', error);
      throw error;
    }
  }

  /**
   * Join a room with orchestrated management
   */
  async joinRoom(roomId: string, options?: RoomManagementOptions): Promise<void> {
    try {
      await this.webrtcEngine.joinRoom(roomId, options?.password);
      this.activityTracking.roomsJoined++;

      this.emitEvent({
        type: 'room-management',
        data: { action: 'joined', roomId },
        timestamp: new Date()
      });

      if (this.config.debug) {
        console.log('🚪 Joined room via orchestrator:', roomId);
      }
    } catch (error) {
      this.activityTracking.errorsEncountered++;
      console.error('❌ Failed to join room:', error);
      throw error;
    }
  }

  /**
   * Connect to peer with orchestrated management
   */
  async connectToPeer(peerId: string, options?: PeerManagementOptions): Promise<WebRTCPeer> {
    const connectionOptions = {
      autoAccept: true,
      enableData: true,
      enableVideo: this.config.enableMediaByDefault,
      enableAudio: this.config.enableMediaByDefault,
      gamificationLevel: this.config.enableGamification ? 1 : 0,
      ...options
    };

    try {
      this.activityTracking.connectionsInitiated++;

      const peer = await this.webrtcEngine.connectToPeer(peerId, {
        useDataChannel: connectionOptions.enableData,
        useVideo: connectionOptions.enableVideo,
        useAudio: connectionOptions.enableAudio
      });

      this.emitEvent({
        type: 'peer-management',
        data: { action: 'connecting', peerId, options: connectionOptions },
        timestamp: new Date(),
        metadata: { gamificationLevel: connectionOptions.gamificationLevel }
      });

      if (this.config.debug) {
        console.log('🤝 Connecting to peer via orchestrator:', peerId);
      }

      return peer;
    } catch (error) {
      this.activityTracking.errorsEncountered++;
      console.error('❌ Failed to connect to peer:', error);
      throw error;
    }
  }

  /**
   * Send data with orchestrated delivery
   */
  sendData(data: any, targetPeer?: string): void {
    try {
      if (targetPeer) {
        this.webrtcEngine.sendDataToPeer(targetPeer, {
          ...data,
          orchestratorMetadata: {
            timestamp: Date.now(),
            sequenceId: this.activityTracking.messagesExchanged + 1
          }
        });
      } else {
        this.webrtcEngine.broadcastData({
          ...data,
          orchestratorMetadata: {
            timestamp: Date.now(),
            sequenceId: this.activityTracking.messagesExchanged + 1,
            broadcast: true
          }
        });
      }

      this.activityTracking.messagesExchanged++;

      if (this.config.debug) {
        console.log('📤 Data sent via orchestrator:', { targetPeer, data });
      }
    } catch (error) {
      this.activityTracking.errorsEncountered++;
      console.error('❌ Failed to send data:', error);
    }
  }

  /**
   * Switch operation mode
   */
  async switchMode(newMode: 'standalone' | 'room-based' | 'mesh-network'): Promise<void> {
    const currentState = this.state$.value;
    
    if (currentState.currentMode === newMode) {
      return; // Already in the desired mode
    }

    try {
      // Handle mode transition logic
      switch (newMode) {
        case 'standalone':
          await this.transitionToStandalone();
          break;
        case 'room-based':
          await this.transitionToRoomBased();
          break;
        case 'mesh-network':
          await this.transitionToMeshNetwork();
          break;
      }

      this.state$.next({
        ...currentState,
        currentMode: newMode,
        lastActivity: new Date()
      });

      this.emitEvent({
        type: 'mode-changed',
        data: { from: currentState.currentMode, to: newMode },
        timestamp: new Date()
      });

      if (this.config.debug) {
        console.log(`🔄 Switched to ${newMode} mode`);
      }
    } catch (error) {
      console.error('❌ Failed to switch mode:', error);
      throw error;
    }
  }

  /**
   * Get system state
   */
  getState(): Observable<OrchestratorState> {
    return this.state$.asObservable();
  }

  /**
   * Get orchestrator events
   */
  getEvents(): Observable<OrchestratorEvent> {
    return this.events$.asObservable();
  }

  /**
   * Get system ready status
   */
  isReady(): Observable<boolean> {
    return this.isReady$.asObservable();
  }

  /**
   * Get health status
   */
  getHealthStatus(): Observable<boolean> {
    return this.healthCheck$.asObservable();
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): Observable<any> {
    return this.performanceMetrics$.asObservable();
  }

  /**
   * Get activity summary
   */
  getActivitySummary(): any {
    return {
      ...this.activityTracking,
      uptime: Date.now() - this.activityTracking.startTime.getTime(),
      averageConnectionRate: this.activityTracking.connectionsCompleted / 
                            Math.max(1, this.activityTracking.connectionsInitiated),
      errorRate: this.activityTracking.errorsEncountered / 
                Math.max(1, this.activityTracking.connectionsInitiated)
    };
  }

  /**
   * Emergency shutdown
   */
  emergencyShutdown(): void {
    if (this.config.debug) {
      console.log('🚨 Emergency shutdown initiated');
    }

    // Disconnect all peers
    this.webrtcEngine.getConnectedPeers().forEach(peer => {
      this.webrtcEngine.disconnectPeer(peer.id);
    });

    // Leave current room
    const currentRoom = this.state$.value.currentRoom;
    if (currentRoom) {
      this.webrtcEngine.leaveRoom();
    }

    // Disconnect from AlephScript
    this.alephClient.disconnect();

    this.emitEvent({
      type: 'system-ready',
      data: { shutdown: true, reason: 'emergency' },
      timestamp: new Date()
    });
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    if (this.config.debug) {
      console.log('🔄 Graceful shutdown initiated');
    }

    // Notify peers of shutdown
    this.sendData({ type: 'system-shutdown', timestamp: Date.now() });

    // Wait a moment for message delivery
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Cleanup
    this.webrtcEngine.destroy();
    this.alephClient.destroy();

    // Complete observables
    this.destroy$.next();
    this.destroy$.complete();
    this.events$.complete();
    this.state$.complete();
    this.isReady$.complete();
    this.healthCheck$.complete();
    this.performanceMetrics$.complete();

    if (this.config.debug) {
      console.log('✅ WebRTC Orchestrator shutdown complete');
    }
  }

  // ===== Private Mode Transition Methods =====

  private async transitionToStandalone(): Promise<void> {
    // Leave any rooms but keep peer connections
    const currentRoom = this.state$.value.currentRoom;
    if (currentRoom) {
      this.webrtcEngine.leaveRoom();
    }
  }

  private async transitionToRoomBased(): Promise<void> {
    // Create or join a room if not already in one
    const currentRoom = this.state$.value.currentRoom;
    if (!currentRoom) {
      await this.createRoom(this.config.defaultRoomName);
    }
  }

  private async transitionToMeshNetwork(): Promise<void> {
    // Ensure all peers are interconnected
    const peers = this.webrtcEngine.getConnectedPeers();
    // Mesh network logic would go here
    if (this.config.debug) {
      console.log('🕸️ Mesh network mode activated with peers:', peers.length);
    }
  }

  /**
   * Emit orchestrator event
   */
  private emitEvent(event: OrchestratorEvent): void {
    this.events$.next(event);
    
    if (this.config.debug) {
      console.log('🎯 Orchestrator event:', event);
    }
  }
}

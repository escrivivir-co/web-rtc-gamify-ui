import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, Subject, fromEvent, merge } from 'rxjs';
import { map, filter, takeUntil, tap, switchMap } from 'rxjs/operators';

import { WebRTCService } from './webrtc.service';
import { SignalingService } from './signaling.service';
import { 
  WebRTCConfig, 
  RoomConfig, 
  RoomState, 
  RoomParticipant,
  Peer,
  SignalingMessage,
  SignalingMessageType
} from '../models';

/**
 * AlephScript client interface for Socket.IO communication
 * This would typically be imported from the orchestration system
 */
interface AlephScriptClient {
  connect(config: any): Promise<void>;
  disconnect(): Promise<void>;
  joinRoom(roomId: string, userInfo: any): Promise<any>;
  leaveRoom(roomId: string): Promise<void>;
  sendMessage(channel: string, data: any): Promise<void>;
  on(event: string, callback: Function): void;
  off(event: string, callback?: Function): void;
  emit(event: string, data: any): void;
  isConnected(): boolean;
}

/**
 * Extended WebRTC service that integrates with AlephScript orchestration system
 * Provides seamless communication between WebRTC UI and the backend orchestration
 */
@Injectable({
  providedIn: 'root'
})
export class AlephScriptWebRTCService {
  private webrtcService = inject(WebRTCService);
  private signalingService = inject(SignalingService);
  
  private alephScriptClient: AlephScriptClient | null = null;
  private destroyed$ = new Subject<void>();
  
  // Room state management
  private currentRoomSubject = new BehaviorSubject<RoomState | null>(null);
  private participantsSubject = new BehaviorSubject<RoomParticipant[]>([]);
  private roomEventsSubject = new Subject<any>();
  
  // Game integration
  private gameSessionSubject = new BehaviorSubject<string | null>(null);
  private gameStateSubject = new BehaviorSubject<any>(null);
  
  // Public observables
  currentRoom$ = this.currentRoomSubject.asObservable();
  participants$ = this.participantsSubject.asObservable();
  roomEvents$ = this.roomEventsSubject.asObservable();
  gameSession$ = this.gameSessionSubject.asObservable();
  gameState$ = this.gameStateSubject.asObservable();
  
  // Expose WebRTC service observables
  peers$ = this.webrtcService.peers$;
  localStream$ = this.webrtcService.localStream$;
  connectionState$ = this.webrtcService.connectionState$;
  error$ = merge(
    this.webrtcService.error$,
    this.signalingService.error$
  );

  /**
   * Initialize the service with AlephScript client
   */
  async initialize(config: {
    webrtc: Partial<WebRTCConfig>;
    alephScript: {
      client: AlephScriptClient;
      serverUrl?: string;
      gameSessionId?: string;
    };
    signaling?: {
      url: string;
      protocols?: string[];
    };
  }): Promise<void> {
    try {
      // Initialize WebRTC service
      this.webrtcService.initialize(config.webrtc);
      
      // Set AlephScript client
      this.alephScriptClient = config.alephScript.client;
      
      // Set up AlephScript event listeners
      this.setupAlephScriptListeners();
      
      // Connect to AlephScript if not already connected
      if (!this.alephScriptClient.isConnected()) {
        await this.alephScriptClient.connect({
          serverUrl: config.alephScript.serverUrl,
          gameSessionId: config.alephScript.gameSessionId
        });
      }
      
      // Initialize signaling if provided
      if (config.signaling) {
        const userId = await this.generateUserId();
        await this.signalingService.connect(userId, config.signaling);
        this.setupSignalingBridge();
      }
      
      console.log('[AlephScriptWebRTC] Service initialized successfully');
    } catch (error) {
      console.error('[AlephScriptWebRTC] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Join a room with AlephScript coordination
   */
  async joinRoom(config: {
    roomId: string;
    displayName: string;
    role?: 'host' | 'participant' | 'observer';
    gameSessionId?: string;
    metadata?: Record<string, any>;
  }): Promise<RoomState> {
    try {
      if (!this.alephScriptClient) {
        throw new Error('AlephScript client not initialized');
      }

      console.log('[AlephScriptWebRTC] Joining room:', config.roomId);

      // Join room via AlephScript
      const roomInfo = await this.alephScriptClient.joinRoom(config.roomId, {
        displayName: config.displayName,
        role: config.role || 'participant',
        webrtcEnabled: true,
        metadata: config.metadata
      });

      // Join room via signaling service
      if (this.signalingService.isConnected()) {
        await this.signalingService.joinRoom(config.roomId, config.displayName);
      }

      // Set game session if provided
      if (config.gameSessionId) {
        this.gameSessionSubject.next(config.gameSessionId);
      }

      // Create room state
      const roomState: RoomState = {
        config: roomInfo.config || this.createDefaultRoomConfig(config.roomId, config.displayName),
        participants: roomInfo.participants || [],
        stats: roomInfo.stats || this.createDefaultStats(),
        events: [],
        status: 'active'
      };

      this.currentRoomSubject.next(roomState);
      this.participantsSubject.next(roomState.participants);

      console.log('[AlephScriptWebRTC] Successfully joined room');
      return roomState;

    } catch (error) {
      console.error('[AlephScriptWebRTC] Failed to join room:', error);
      throw error;
    }
  }

  /**
   * Leave current room
   */
  async leaveRoom(): Promise<void> {
    try {
      const currentRoom = this.currentRoomSubject.value;
      if (!currentRoom) {
        console.warn('[AlephScriptWebRTC] No room to leave');
        return;
      }

      console.log('[AlephScriptWebRTC] Leaving room:', currentRoom.config.id);

      // Leave via AlephScript
      if (this.alephScriptClient) {
        await this.alephScriptClient.leaveRoom(currentRoom.config.id);
      }

      // Leave via signaling service
      if (this.signalingService.isConnected()) {
        await this.signalingService.leaveRoom();
      }

      // Close all WebRTC connections
      this.webrtcService.closeAllConnections();

      // Clear state
      this.currentRoomSubject.next(null);
      this.participantsSubject.next([]);
      this.gameSessionSubject.next(null);

      console.log('[AlephScriptWebRTC] Successfully left room');

    } catch (error) {
      console.error('[AlephScriptWebRTC] Failed to leave room:', error);
      throw error;
    }
  }

  /**
   * Send game event via AlephScript
   */
  async sendGameEvent(eventType: string, eventData: any): Promise<void> {
    if (!this.alephScriptClient) {
      throw new Error('AlephScript client not initialized');
    }

    try {
      await this.alephScriptClient.sendMessage('game-events', {
        type: eventType,
        data: eventData,
        timestamp: Date.now(),
        gameSessionId: this.gameSessionSubject.value
      });
    } catch (error) {
      console.error('[AlephScriptWebRTC] Failed to send game event:', error);
      throw error;
    }
  }

  /**
   * Send data via WebRTC data channel with AlephScript fallback
   */
  async sendDataWithFallback(peerId: string, data: any, reliable: boolean = true): Promise<void> {
    try {
      // Try WebRTC data channel first
      const peerConnection = this.webrtcService.getPeerConnection(peerId);
      if (peerConnection) {
        // Create or get data channel
        const dataChannel = this.getOrCreateDataChannel(peerConnection, 'alephscript-data');
        if (dataChannel && dataChannel.readyState === 'open') {
          dataChannel.send(JSON.stringify(data));
          return;
        }
      }

      // Fallback to AlephScript signaling
      if (this.alephScriptClient && reliable) {
        await this.alephScriptClient.sendMessage('peer-data', {
          targetPeerId: peerId,
          data: data,
          timestamp: Date.now()
        });
      }

    } catch (error) {
      console.error('[AlephScriptWebRTC] Failed to send data:', error);
      throw error;
    }
  }

  /**
   * Get or create media stream with game-specific constraints
   */
  async getGameMediaStream(constraints?: {
    audio?: boolean;
    video?: boolean;
    screenShare?: boolean;
    gameAudio?: boolean;
  }): Promise<MediaStream> {
    try {
      const mediaConstraints = {
        audio: constraints?.audio !== false,
        video: constraints?.video !== false
      };

      const stream = await this.webrtcService.getUserMedia(mediaConstraints);

      // If game audio is requested, mix with system audio
      if (constraints?.gameAudio && this.alephScriptClient) {
        // This would integrate with game audio system
        await this.integateGameAudio(stream);
      }

      return stream;
    } catch (error) {
      console.error('[AlephScriptWebRTC] Failed to get game media:', error);
      throw error;
    }
  }

  /**
   * Destroy service and cleanup
   */
  destroy(): void {
    console.log('[AlephScriptWebRTC] Destroying service');
    
    this.destroyed$.next();
    this.destroyed$.complete();
    
    this.leaveRoom().catch(console.error);
    this.webrtcService.destroy();
    
    if (this.alephScriptClient) {
      this.alephScriptClient.disconnect().catch(console.error);
    }
  }

  /**
   * Set up AlephScript event listeners
   */
  private setupAlephScriptListeners(): void {
    if (!this.alephScriptClient) return;

    // Room events
    this.alephScriptClient.on('room-participant-joined', (data: any) => {
      this.handleParticipantJoined(data);
    });

    this.alephScriptClient.on('room-participant-left', (data: any) => {
      this.handleParticipantLeft(data);
    });

    // Game events
    this.alephScriptClient.on('game-state-update', (data: any) => {
      this.gameStateSubject.next(data);
    });

    // WebRTC coordination events
    this.alephScriptClient.on('webrtc-signaling', (data: any) => {
      this.handleAlephScriptSignaling(data);
    });

    // Peer data fallback
    this.alephScriptClient.on('peer-data', (data: any) => {
      this.handlePeerDataFallback(data);
    });
  }

  /**
   * Set up signaling bridge between WebRTC and AlephScript
   */
  private setupSignalingBridge(): void {
    // Forward WebRTC signaling to AlephScript
    this.signalingService.messages$
      .pipe(takeUntil(this.destroyed$))
      .subscribe(message => {
        if (this.alephScriptClient) {
          this.alephScriptClient.sendMessage('webrtc-signaling', message);
        }
      });
  }

  /**
   * Handle participant joined event
   */
  private handleParticipantJoined(data: any): void {
    const participants = this.participantsSubject.value;
    const newParticipant: RoomParticipant = {
      userId: data.userId,
      displayName: data.displayName,
      role: data.role || 'participant',
      joinedAt: new Date(data.joinedAt),
      status: 'connected',
      permissions: data.permissions || this.getDefaultPermissions(),
      mediaState: data.mediaState || this.getDefaultMediaState(),
      quality: data.quality || { signal: 'good', latency: 0, packetLoss: 0 },
      metadata: data.metadata
    };

    this.participantsSubject.next([...participants, newParticipant]);
    this.roomEventsSubject.next({ type: 'participant-joined', data: newParticipant });
  }

  /**
   * Handle participant left event
   */
  private handleParticipantLeft(data: any): void {
    const participants = this.participantsSubject.value;
    const filteredParticipants = participants.filter(p => p.userId !== data.userId);
    
    this.participantsSubject.next(filteredParticipants);
    this.roomEventsSubject.next({ type: 'participant-left', data });
    
    // Close WebRTC connection if exists
    this.webrtcService.closePeerConnection(data.userId);
  }

  /**
   * Handle AlephScript signaling messages
   */
  private handleAlephScriptSignaling(data: any): void {
    // Forward to signaling service or handle directly
    console.log('[AlephScriptWebRTC] Received signaling from AlephScript:', data);
  }

  /**
   * Handle peer data fallback
   */
  private handlePeerDataFallback(data: any): void {
    console.log('[AlephScriptWebRTC] Received peer data fallback:', data);
    // Handle data that couldn't be sent via WebRTC data channel
  }

  /**
   * Get or create data channel
   */
  private getOrCreateDataChannel(peerConnection: RTCPeerConnection, label: string): RTCDataChannel | null {
    // Implementation would check existing channels and create if needed
    try {
      return peerConnection.createDataChannel(label, {
        ordered: true,
        maxRetransmits: 3
      });
    } catch (error) {
      console.error('[AlephScriptWebRTC] Failed to create data channel:', error);
      return null;
    }
  }

  /**
   * Integrate game audio with media stream
   */
  private async integateGameAudio(stream: MediaStream): Promise<void> {
    // This would be implemented based on the specific game audio system
    console.log('[AlephScriptWebRTC] Game audio integration requested');
  }

  /**
   * Generate unique user ID
   */
  private async generateUserId(): Promise<string> {
    return `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create default room configuration
   */
  private createDefaultRoomConfig(roomId: string, hostName: string): RoomConfig {
    return {
      id: roomId,
      name: `Room ${roomId}`,
      type: 'public',
      maxParticipants: 10,
      hostId: hostName,
      createdAt: new Date(),
      settings: {
        allowAudio: true,
        allowVideo: true,
        allowScreenShare: true,
        allowDataChannels: true,
        requireApproval: false,
        recordingEnabled: false,
        muteOnJoin: false,
        disableVideoOnJoin: false,
        waitingRoom: false,
        locked: false
      }
    };
  }

  /**
   * Create default room statistics
   */
  private createDefaultStats() {
    return {
      totalParticipants: 0,
      currentParticipants: 0,
      activeSpeakers: 0,
      averageQuality: 100,
      uptime: 0
    };
  }

  /**
   * Get default participant permissions
   */
  private getDefaultPermissions() {
    return {
      canSpeak: true,
      canVideo: true,
      canScreenShare: true,
      canModerate: false,
      canInvite: false
    };
  }

  /**
   * Get default media state
   */
  private getDefaultMediaState() {
    return {
      audioEnabled: false,
      videoEnabled: false,
      screenSharing: false,
      audioMuted: false,
      videoMuted: false
    };
  }
}

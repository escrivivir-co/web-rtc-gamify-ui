/**
 * WebRTC AlephScript Client
 * Specialized AlephScript client for WebRTC operations and room management
 */

import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject, Observable } from 'rxjs';
import { filter, map, tap } from 'rxjs/operators';

/**
 * WebRTC-specific AlephScript message types
 */
export interface WebRTCAlephMessage {
  type: 'webrtc-offer' | 'webrtc-answer' | 'webrtc-ice-candidate' | 
        'join-room' | 'leave-room' | 'create-room' | 'room-created' | 
        'room-updated' | 'room-destroyed' | 'peer-connected' | 
        'peer-disconnected' | 'signaling-relay';
  from: string;
  to?: string;
  room?: string;
  data: any;
  timestamp: number;
}

/**
 * Room registration data for AlephScript
 */
export interface AlephRoomRegistration {
  roomId: string;
  roomName: string;
  roomType: 'public' | 'private' | 'protected';
  maxParticipants: number;
  owner: string;
  features: string[];
}

/**
 * Peer registration data for AlephScript
 */
export interface AlephPeerRegistration {
  peerId: string;
  peerName: string;
  room?: string;
  connectionState: RTCPeerConnectionState;
  capabilities: string[];
}

/**
 * WebRTC AlephScript Client Configuration
 */
export interface WebRTCAlephClientConfig {
  /** Client identifier */
  clientId: string;
  /** AlephScript server URL */
  serverUrl?: string;
  /** Auto-reconnect on disconnect */
  autoReconnect?: boolean;
  /** Reconnection interval in ms */
  reconnectInterval?: number;
  /** Debug mode */
  debug?: boolean;
}

/**
 * WebRTC AlephScript Client
 * Manages WebRTC communication through AlephScript protocol
 */
@Injectable({
  providedIn: 'root'
})
export class WebRTCAlephClient {
  private config: Required<WebRTCAlephClientConfig>;
  private socket: any; // Socket.IO client
  private isConnected$ = new BehaviorSubject<boolean>(false);
  private messages$ = new Subject<WebRTCAlephMessage>();
  private roomRegistrations$ = new Subject<AlephRoomRegistration>();
  private peerRegistrations$ = new Subject<AlephPeerRegistration>();
  
  // Connection state
  private connectionAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimer?: number;
  
  // Room and peer management
  private registeredRooms = new Map<string, AlephRoomRegistration>();
  private registeredPeers = new Map<string, AlephPeerRegistration>();
  private currentRoom?: string;

  constructor() {
    this.config = {
      clientId: `WebRTC_Client_${Date.now()}`,
      serverUrl: 'http://localhost:3000',
      autoReconnect: true,
      reconnectInterval: 5000,
      debug: false
    };
  }

  /**
   * Initialize the WebRTC AlephScript client
   */
  async initialize(config?: Partial<WebRTCAlephClientConfig>): Promise<void> {
    if (config) {
      this.config = { ...this.config, ...config };
    }

    if (this.config.debug) {
      console.log('🔌 Initializing WebRTC AlephScript Client:', this.config);
    }

    await this.connect();
  }

  /**
   * Connect to AlephScript server
   */
  private async connect(): Promise<void> {
    try {
      // Check if Socket.IO is available globally
      if (typeof window !== 'undefined' && (window as any).io) {
        this.socket = (window as any).io(this.config.serverUrl);
        this.setupSocketEventHandlers();
        
        if (this.config.debug) {
          console.log('✅ Connected to AlephScript server via Socket.IO');
        }
      } else {
        throw new Error('Socket.IO not available globally');
      }
    } catch (error) {
      console.error('❌ Failed to connect to AlephScript server:', error);
      
      if (this.config.autoReconnect && this.connectionAttempts < this.maxReconnectAttempts) {
        this.scheduleReconnect();
      }
    }
  }

  /**
   * Setup Socket.IO event handlers for WebRTC operations
   */
  private setupSocketEventHandlers(): void {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      this.isConnected$.next(true);
      this.connectionAttempts = 0;
      this.registerClient();
      
      if (this.config.debug) {
        console.log('🟢 WebRTC AlephScript Client connected');
      }
    });

    this.socket.on('disconnect', () => {
      this.isConnected$.next(false);
      
      if (this.config.debug) {
        console.log('🔴 WebRTC AlephScript Client disconnected');
      }
      
      if (this.config.autoReconnect) {
        this.scheduleReconnect();
      }
    });

    // WebRTC-specific events
    this.socket.on('webrtc-offer', (data: any) => {
      this.handleWebRTCMessage({ type: 'webrtc-offer', ...data });
    });

    this.socket.on('webrtc-answer', (data: any) => {
      this.handleWebRTCMessage({ type: 'webrtc-answer', ...data });
    });

    this.socket.on('webrtc-ice-candidate', (data: any) => {
      this.handleWebRTCMessage({ type: 'webrtc-ice-candidate', ...data });
    });

    // Room management events
    this.socket.on('room-created', (data: any) => {
      this.handleRoomEvent('room-created', data);
    });

    this.socket.on('room-updated', (data: any) => {
      this.handleRoomEvent('room-updated', data);
    });

    this.socket.on('room-destroyed', (data: any) => {
      this.handleRoomEvent('room-destroyed', data);
    });

    // Peer management events
    this.socket.on('peer-connected', (data: any) => {
      this.handlePeerEvent('peer-connected', data);
    });

    this.socket.on('peer-disconnected', (data: any) => {
      this.handlePeerEvent('peer-disconnected', data);
    });

    // Signaling relay
    this.socket.on('signaling-relay', (data: any) => {
      this.handleWebRTCMessage({ type: 'signaling-relay', ...data });
    });

    // Error handling
    this.socket.on('error', (error: any) => {
      console.error('❌ Socket.IO error:', error);
    });
  }

  /**
   * Register client with AlephScript server
   */
  private registerClient(): void {
    if (!this.socket) return;

    const registrationPayload = {
      usuario: this.config.clientId,
      sesion: `WebRTC_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'webrtc-client',
      capabilities: ['webrtc-signaling', 'room-management', 'peer-coordination']
    };

    this.socket.emit('CLIENT_REGISTER', registrationPayload);
    
    // Subscribe to WebRTC room
    const webrtcRoom = `${this.config.clientId}_WEBRTC_ROOM`;
    this.socket.emit('CLIENT_SUSCRIBE', { room: webrtcRoom });
    
    // Make master for WebRTC features
    this.socket.emit('MAKE_MASTER', {
      features: ['WebRTC_Signaling', 'Room_Management', 'Peer_Coordination'],
      room: webrtcRoom
    });

    if (this.config.debug) {
      console.log('📝 WebRTC client registered with AlephScript');
    }
  }

  /**
   * Handle WebRTC messages
   */
  private handleWebRTCMessage(message: Partial<WebRTCAlephMessage>): void {
    const webrtcMessage: WebRTCAlephMessage = {
      timestamp: Date.now(),
      ...message
    } as WebRTCAlephMessage;

    this.messages$.next(webrtcMessage);

    if (this.config.debug) {
      console.log('📡 WebRTC message received:', webrtcMessage);
    }
  }

  /**
   * Handle room events
   */
  private handleRoomEvent(eventType: string, data: any): void {
    if (data.room) {
      const registration: AlephRoomRegistration = data.room;
      
      if (eventType === 'room-created' || eventType === 'room-updated') {
        this.registeredRooms.set(registration.roomId, registration);
      } else if (eventType === 'room-destroyed') {
        this.registeredRooms.delete(registration.roomId);
      }
      
      this.roomRegistrations$.next(registration);
    }

    if (this.config.debug) {
      console.log(`🏠 Room event: ${eventType}`, data);
    }
  }

  /**
   * Handle peer events
   */
  private handlePeerEvent(eventType: string, data: any): void {
    if (data.peer) {
      const registration: AlephPeerRegistration = data.peer;
      
      if (eventType === 'peer-connected') {
        this.registeredPeers.set(registration.peerId, registration);
      } else if (eventType === 'peer-disconnected') {
        this.registeredPeers.delete(registration.peerId);
      }
      
      this.peerRegistrations$.next(registration);
    }

    if (this.config.debug) {
      console.log(`👤 Peer event: ${eventType}`, data);
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.connectionAttempts++;
    const delay = this.config.reconnectInterval * Math.pow(2, this.connectionAttempts - 1);

    this.reconnectTimer = window.setTimeout(() => {
      if (this.config.debug) {
        console.log(`🔄 Attempting reconnection (${this.connectionAttempts}/${this.maxReconnectAttempts})`);
      }
      this.connect();
    }, delay);
  }

  // ===== Public API Methods =====

  /**
   * Get connection status observable
   */
  getConnectionStatus(): Observable<boolean> {
    return this.isConnected$.asObservable();
  }

  /**
   * Get WebRTC messages observable
   */
  getMessages(): Observable<WebRTCAlephMessage> {
    return this.messages$.asObservable();
  }

  /**
   * Get room registrations observable
   */
  getRoomRegistrations(): Observable<AlephRoomRegistration> {
    return this.roomRegistrations$.asObservable();
  }

  /**
   * Get peer registrations observable
   */
  getPeerRegistrations(): Observable<AlephPeerRegistration> {
    return this.peerRegistrations$.asObservable();
  }

  /**
   * Send WebRTC offer through AlephScript
   */
  sendOffer(offer: RTCSessionDescriptionInit, targetPeer: string, room?: string): void {
    this.sendWebRTCMessage({
      type: 'webrtc-offer',
      from: this.config.clientId,
      to: targetPeer,
      room,
      data: offer,
      timestamp: Date.now()
    });
  }

  /**
   * Send WebRTC answer through AlephScript
   */
  sendAnswer(answer: RTCSessionDescriptionInit, targetPeer: string, room?: string): void {
    this.sendWebRTCMessage({
      type: 'webrtc-answer',
      from: this.config.clientId,
      to: targetPeer,
      room,
      data: answer,
      timestamp: Date.now()
    });
  }

  /**
   * Send ICE candidate through AlephScript
   */
  sendIceCandidate(candidate: RTCIceCandidateInit, targetPeer: string, room?: string): void {
    this.sendWebRTCMessage({
      type: 'webrtc-ice-candidate',
      from: this.config.clientId,
      to: targetPeer,
      room,
      data: candidate,
      timestamp: Date.now()
    });
  }

  /**
   * Register a room with AlephScript
   */
  registerRoom(roomData: AlephRoomRegistration): void {
    if (!this.socket || !this.isConnected$.value) {
      console.warn('⚠️ Cannot register room: not connected to AlephScript');
      return;
    }

    this.socket.emit('register-room', roomData);
    this.registeredRooms.set(roomData.roomId, roomData);

    if (this.config.debug) {
      console.log('🏠 Room registered with AlephScript:', roomData);
    }
  }

  /**
   * Auto-join a room
   */
  autoJoinRoom(roomId: string, password?: string): void {
    if (!this.socket || !this.isConnected$.value) {
      console.warn('⚠️ Cannot join room: not connected to AlephScript');
      return;
    }

    this.socket.emit('join-room', {
      peerId: this.config.clientId,
      roomId,
      password,
      autoJoin: true
    });

    this.currentRoom = roomId;

    if (this.config.debug) {
      console.log(`🚪 Auto-joining room: ${roomId}`);
    }
  }

  /**
   * Leave current room
   */
  leaveRoom(): void {
    if (!this.currentRoom) return;

    if (this.socket && this.isConnected$.value) {
      this.socket.emit('leave-room', {
        peerId: this.config.clientId,
        roomId: this.currentRoom
      });
    }

    this.currentRoom = undefined;

    if (this.config.debug) {
      console.log('🚪 Left room');
    }
  }

  /**
   * Register peer with AlephScript
   */
  registerPeer(peerData: AlephPeerRegistration): void {
    if (!this.socket || !this.isConnected$.value) {
      console.warn('⚠️ Cannot register peer: not connected to AlephScript');
      return;
    }

    this.socket.emit('register-peer', peerData);
    this.registeredPeers.set(peerData.peerId, peerData);

    if (this.config.debug) {
      console.log('👤 Peer registered with AlephScript:', peerData);
    }
  }

  /**
   * Get registered rooms
   */
  getRegisteredRooms(): AlephRoomRegistration[] {
    return Array.from(this.registeredRooms.values());
  }

  /**
   * Get registered peers
   */
  getRegisteredPeers(): AlephPeerRegistration[] {
    return Array.from(this.registeredPeers.values());
  }

  /**
   * Get current room
   */
  getCurrentRoom(): string | undefined {
    return this.currentRoom;
  }

  /**
   * Check if connected to AlephScript
   */
  isConnected(): boolean {
    return this.isConnected$.value;
  }

  /**
   * Relay signaling message through AlephScript
   */
  relaySignaling(message: any, targetPeer?: string, room?: string): void {
    this.sendWebRTCMessage({
      type: 'signaling-relay',
      from: this.config.clientId,
      to: targetPeer,
      room,
      data: message,
      timestamp: Date.now()
    });
  }

  /**
   * Handle WebRTC connection failures with Socket.IO fallback
   */
  handleWebRTCFailure(targetPeer: string, error: any): void {
    if (this.config.debug) {
      console.warn('⚠️ WebRTC connection failed, falling back to Socket.IO:', error);
    }

    // Emit fallback event through AlephScript
    if (this.socket && this.isConnected$.value) {
      this.socket.emit('webrtc-fallback', {
        from: this.config.clientId,
        to: targetPeer,
        error: error.message || 'Unknown WebRTC error',
        fallbackMode: 'socket-io',
        timestamp: Date.now()
      });
    }
  }

  /**
   * Disconnect from AlephScript server
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.isConnected$.next(false);
    this.registeredRooms.clear();
    this.registeredPeers.clear();
    this.currentRoom = undefined;

    if (this.config.debug) {
      console.log('🔌 WebRTC AlephScript Client disconnected');
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.disconnect();
    this.messages$.complete();
    this.roomRegistrations$.complete();
    this.peerRegistrations$.complete();
    this.isConnected$.complete();
  }

  // ===== Private Helper Methods =====

  /**
   * Send WebRTC message through AlephScript
   */
  private sendWebRTCMessage(message: WebRTCAlephMessage): void {
    if (!this.socket || !this.isConnected$.value) {
      console.warn('⚠️ Cannot send WebRTC message: not connected to AlephScript');
      return;
    }

    // Emit message based on type
    const eventName = message.type.replace('webrtc-', '');
    this.socket.emit(eventName, message);

    if (this.config.debug) {
      console.log(`📤 Sent WebRTC message: ${message.type}`, message);
    }
  }
}

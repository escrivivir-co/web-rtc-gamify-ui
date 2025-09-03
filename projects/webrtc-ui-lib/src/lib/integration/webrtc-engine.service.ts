/**
 * WebRTC Engine
 * Core WebRTC management engine with AlephScript integration
 */

import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject, Observable, fromEvent } from 'rxjs';
import { filter, map, takeUntil } from 'rxjs/operators';
import { WebRTCAlephClient, WebRTCAlephMessage, AlephRoomRegistration, AlephPeerRegistration } from './webrtc-aleph-client.service';

/**
 * WebRTC Peer Connection State
 */
export interface WebRTCPeer {
  id: string;
  name?: string;
  connection: RTCPeerConnection;
  dataChannel?: RTCDataChannel;
  localStream?: MediaStream;
  remoteStream?: MediaStream;
  isInitiator: boolean;
  connectionState: RTCPeerConnectionState;
  iceConnectionState: RTCIceConnectionState;
  iceGatheringState: RTCIceGatheringState;
  signalingState: RTCSignalingState;
  lastActivity: Date;
  metadata?: Record<string, any>;
}

/**
 * WebRTC Room State
 */
export interface WebRTCRoom {
  id: string;
  name: string;
  type: 'public' | 'private' | 'protected';
  maxParticipants: number;
  currentParticipants: number;
  owner: string;
  peers: Map<string, WebRTCPeer>;
  isLocallyOwned: boolean;
  joinedAt?: Date;
  features: string[];
  metadata?: Record<string, any>;
}

/**
 * WebRTC Engine Configuration
 */
export interface WebRTCEngineConfig {
  /** ICE servers configuration */
  iceServers?: RTCIceServer[];
  /** Data channel options */
  dataChannelOptions?: RTCDataChannelInit;
  /** Peer connection constraints */
  peerConnectionConfig?: RTCConfiguration;
  /** Auto-accept incoming connections */
  autoAcceptConnections?: boolean;
  /** Enable debugging */
  debug?: boolean;
  /** Maximum number of simultaneous connections */
  maxConnections?: number;
  /** Connection timeout in ms */
  connectionTimeout?: number;
}

/**
 * WebRTC Engine Events
 */
export interface WebRTCEngineEvent {
  type: 'peer-connected' | 'peer-disconnected' | 'data-received' | 
        'stream-received' | 'room-joined' | 'room-left' | 
        'connection-failed' | 'signaling-error';
  peerId?: string;
  roomId?: string;
  data?: any;
  timestamp: Date;
}

/**
 * WebRTC Engine
 * Manages WebRTC peer connections with AlephScript signaling
 */
@Injectable({
  providedIn: 'root'
})
export class WebRTCEngine {
  private config: Required<WebRTCEngineConfig>;
  private destroy$ = new Subject<void>();
  
  // State management
  private peers$ = new BehaviorSubject<Map<string, WebRTCPeer>>(new Map());
  private rooms$ = new BehaviorSubject<Map<string, WebRTCRoom>>(new Map());
  private currentRoom$ = new BehaviorSubject<WebRTCRoom | null>(null);
  private events$ = new Subject<WebRTCEngineEvent>();
  
  // Internal state
  private localStreams = new Map<string, MediaStream>();
  private pendingOffers = new Map<string, RTCSessionDescriptionInit>();
  private connectionTimers = new Map<string, number>();

  constructor(private alephClient: WebRTCAlephClient) {
    this.config = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ],
      dataChannelOptions: {
        ordered: true,
        maxRetransmits: 3
      },
      peerConnectionConfig: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' }
        ]
      },
      autoAcceptConnections: true,
      debug: false,
      maxConnections: 10,
      connectionTimeout: 30000
    };

    this.setupAlephClientListeners();
  }

  /**
   * Initialize WebRTC Engine
   */
  async initialize(config?: Partial<WebRTCEngineConfig>): Promise<void> {
    if (config) {
      this.config = { ...this.config, ...config };
      
      // Update peer connection config with new ICE servers
      if (config.iceServers) {
        this.config.peerConnectionConfig.iceServers = config.iceServers;
      }
    }

    if (this.config.debug) {
      console.log('🚀 Initializing WebRTC Engine:', this.config);
    }

    // Initialize AlephScript client if not already connected
    if (!this.alephClient.isConnected()) {
      await this.alephClient.initialize({
        debug: this.config.debug
      });
    }
  }

  /**
   * Setup AlephScript client listeners
   */
  private setupAlephClientListeners(): void {
    // Listen for WebRTC messages from AlephScript
    this.alephClient.getMessages()
      .pipe(takeUntil(this.destroy$))
      .subscribe(message => this.handleAlephMessage(message));

    // Listen for room updates
    this.alephClient.getRoomRegistrations()
      .pipe(takeUntil(this.destroy$))
      .subscribe(room => this.handleRoomUpdate(room));

    // Listen for peer updates
    this.alephClient.getPeerRegistrations()
      .pipe(takeUntil(this.destroy$))
      .subscribe(peer => this.handlePeerUpdate(peer));
  }

  /**
   * Handle AlephScript messages
   */
  private async handleAlephMessage(message: WebRTCAlephMessage): Promise<void> {
    if (this.config.debug) {
      console.log('📨 Handling AlephScript message:', message);
    }

    try {
      switch (message.type) {
        case 'webrtc-offer':
          await this.handleRemoteOffer(message.from, message.data, message.room);
          break;
        
        case 'webrtc-answer':
          await this.handleRemoteAnswer(message.from, message.data);
          break;
        
        case 'webrtc-ice-candidate':
          await this.handleRemoteIceCandidate(message.from, message.data);
          break;
        
        case 'signaling-relay':
          this.handleSignalingRelay(message);
          break;
        
        default:
          if (this.config.debug) {
            console.log('🤷‍♂️ Unknown message type:', message.type);
          }
      }
    } catch (error) {
      console.error('❌ Error handling AlephScript message:', error);
      this.emitEvent({
        type: 'signaling-error',
        peerId: message.from,
        data: error,
        timestamp: new Date()
      });
    }
  }

  /**
   * Handle room updates from AlephScript
   */
  private handleRoomUpdate(roomData: AlephRoomRegistration): void {
    const rooms = this.rooms$.value;
    const existingRoom = rooms.get(roomData.roomId);

    if (existingRoom) {
      // Update existing room
      existingRoom.name = roomData.roomName;
      existingRoom.type = roomData.roomType;
      existingRoom.maxParticipants = roomData.maxParticipants;
      existingRoom.features = roomData.features;
    } else {
      // Create new room entry
      const newRoom: WebRTCRoom = {
        id: roomData.roomId,
        name: roomData.roomName,
        type: roomData.roomType,
        maxParticipants: roomData.maxParticipants,
        currentParticipants: 0,
        owner: roomData.owner,
        peers: new Map(),
        isLocallyOwned: false,
        features: roomData.features
      };
      
      rooms.set(roomData.roomId, newRoom);
    }

    this.rooms$.next(new Map(rooms));
  }

  /**
   * Handle peer updates from AlephScript
   */
  private handlePeerUpdate(peerData: AlephPeerRegistration): void {
    if (peerData.room) {
      const rooms = this.rooms$.value;
      const room = rooms.get(peerData.room);
      
      if (room) {
        const peers = this.peers$.value;
        const existingPeer = peers.get(peerData.peerId);
        
        if (existingPeer) {
          existingPeer.connectionState = peerData.connectionState;
          existingPeer.lastActivity = new Date();
        }
        
        // Update room participant count
        room.currentParticipants = room.peers.size;
        this.rooms$.next(new Map(rooms));
      }
    }
  }

  /**
   * Create a new WebRTC room
   */
  async createRoom(roomName: string, roomType: 'public' | 'private' | 'protected' = 'public', 
                   maxParticipants: number = 10, features: string[] = []): Promise<WebRTCRoom> {
    const roomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const room: WebRTCRoom = {
      id: roomId,
      name: roomName,
      type: roomType,
      maxParticipants,
      currentParticipants: 0,
      owner: this.alephClient['config'].clientId,
      peers: new Map(),
      isLocallyOwned: true,
      joinedAt: new Date(),
      features
    };

    // Register room with AlephScript
    this.alephClient.registerRoom({
      roomId,
      roomName,
      roomType,
      maxParticipants,
      owner: room.owner,
      features
    });

    // Add to local rooms
    const rooms = this.rooms$.value;
    rooms.set(roomId, room);
    this.rooms$.next(new Map(rooms));
    this.currentRoom$.next(room);

    this.emitEvent({
      type: 'room-joined',
      roomId,
      timestamp: new Date()
    });

    if (this.config.debug) {
      console.log('🏠 Created and joined room:', room);
    }

    return room;
  }

  /**
   * Join an existing room
   */
  async joinRoom(roomId: string, password?: string): Promise<void> {
    const rooms = this.rooms$.value;
    let room = rooms.get(roomId);

    if (!room) {
      // Create placeholder room entry
      room = {
        id: roomId,
        name: `Room ${roomId}`,
        type: 'public',
        maxParticipants: 10,
        currentParticipants: 0,
        owner: 'unknown',
        peers: new Map(),
        isLocallyOwned: false,
        joinedAt: new Date(),
        features: []
      };
      
      rooms.set(roomId, room);
      this.rooms$.next(new Map(rooms));
    }

    // Auto-join room through AlephScript
    this.alephClient.autoJoinRoom(roomId, password);
    this.currentRoom$.next(room);

    this.emitEvent({
      type: 'room-joined',
      roomId,
      timestamp: new Date()
    });

    if (this.config.debug) {
      console.log('🚪 Joined room:', roomId);
    }
  }

  /**
   * Leave current room
   */
  leaveRoom(): void {
    const currentRoom = this.currentRoom$.value;
    if (!currentRoom) return;

    // Disconnect all peers in the room
    currentRoom.peers.forEach((peer, peerId) => {
      this.disconnectPeer(peerId);
    });

    // Leave room through AlephScript
    this.alephClient.leaveRoom();
    this.currentRoom$.next(null);

    this.emitEvent({
      type: 'room-left',
      roomId: currentRoom.id,
      timestamp: new Date()
    });

    if (this.config.debug) {
      console.log('🚪 Left room:', currentRoom.id);
    }
  }

  /**
   * Connect to a peer
   */
  async connectToPeer(peerId: string, options?: { 
    useDataChannel?: boolean; 
    useVideo?: boolean; 
    useAudio?: boolean;
  }): Promise<WebRTCPeer> {
    const peers = this.peers$.value;
    
    if (peers.has(peerId)) {
      throw new Error(`Already connected to peer: ${peerId}`);
    }

    if (peers.size >= this.config.maxConnections) {
      throw new Error(`Maximum connections reached: ${this.config.maxConnections}`);
    }

    const peerConnection = new RTCPeerConnection(this.config.peerConnectionConfig);
    
    const peer: WebRTCPeer = {
      id: peerId,
      connection: peerConnection,
      isInitiator: true,
      connectionState: 'new',
      iceConnectionState: 'new',
      iceGatheringState: 'new',
      signalingState: 'stable',
      lastActivity: new Date()
    };

    // Setup peer connection event handlers
    this.setupPeerConnection(peer);

    // Add local streams if available
    if (options?.useVideo || options?.useAudio) {
      const stream = await this.getUserMedia({
        video: options.useVideo,
        audio: options.useAudio
      });
      
      stream.getTracks().forEach(track => {
        peerConnection.addTrack(track, stream);
      });
      
      peer.localStream = stream;
    }

    // Create data channel if requested
    if (options?.useDataChannel !== false) {
      peer.dataChannel = peerConnection.createDataChannel('main', this.config.dataChannelOptions);
      this.setupDataChannel(peer.dataChannel, peerId);
    }

    // Create offer
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    // Send offer through AlephScript
    this.alephClient.sendOffer(offer, peerId, this.currentRoom$.value?.id);

    // Add peer to collection
    peers.set(peerId, peer);
    this.peers$.next(new Map(peers));

    // Set connection timeout
    this.setConnectionTimeout(peerId);

    // Register peer with AlephScript
    this.alephClient.registerPeer({
      peerId,
      peerName: `Peer_${peerId}`,
      room: this.currentRoom$.value?.id,
      connectionState: peer.connectionState,
      capabilities: ['webrtc-data', 'webrtc-media']
    });

    if (this.config.debug) {
      console.log('🤝 Initiating connection to peer:', peerId);
    }

    return peer;
  }

  /**
   * Disconnect from a peer
   */
  disconnectPeer(peerId: string): void {
    const peers = this.peers$.value;
    const peer = peers.get(peerId);
    
    if (!peer) return;

    // Close connections
    if (peer.dataChannel) {
      peer.dataChannel.close();
    }
    
    if (peer.localStream) {
      peer.localStream.getTracks().forEach(track => track.stop());
    }
    
    peer.connection.close();

    // Remove from collection
    peers.delete(peerId);
    this.peers$.next(new Map(peers));

    // Update room if applicable
    const currentRoom = this.currentRoom$.value;
    if (currentRoom) {
      currentRoom.peers.delete(peerId);
      currentRoom.currentParticipants = currentRoom.peers.size;
    }

    // Clear timeout
    this.clearConnectionTimeout(peerId);

    this.emitEvent({
      type: 'peer-disconnected',
      peerId,
      timestamp: new Date()
    });

    if (this.config.debug) {
      console.log('👋 Disconnected from peer:', peerId);
    }
  }

  /**
   * Send data to a peer
   */
  sendDataToPeer(peerId: string, data: any): void {
    const peer = this.peers$.value.get(peerId);
    
    if (!peer?.dataChannel || peer.dataChannel.readyState !== 'open') {
      console.warn(`⚠️ Cannot send data to peer ${peerId}: data channel not available`);
      return;
    }

    try {
      const message = JSON.stringify({
        type: 'user-data',
        data,
        timestamp: Date.now()
      });
      
      peer.dataChannel.send(message);
      
      if (this.config.debug) {
        console.log(`📤 Sent data to peer ${peerId}:`, data);
      }
    } catch (error) {
      console.error(`❌ Failed to send data to peer ${peerId}:`, error);
    }
  }

  /**
   * Broadcast data to all connected peers
   */
  broadcastData(data: any): void {
    this.peers$.value.forEach((peer, peerId) => {
      this.sendDataToPeer(peerId, data);
    });
  }

  /**
   * Get user media
   */
  async getUserMedia(constraints: MediaStreamConstraints): Promise<MediaStream> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const streamId = `stream_${Date.now()}`;
      this.localStreams.set(streamId, stream);
      
      if (this.config.debug) {
        console.log('🎥 Obtained user media:', constraints);
      }
      
      return stream;
    } catch (error) {
      console.error('❌ Failed to get user media:', error);
      throw error;
    }
  }

  // ===== Private Helper Methods =====

  /**
   * Handle remote offer
   */
  private async handleRemoteOffer(peerId: string, offer: RTCSessionDescriptionInit, roomId?: string): Promise<void> {
    const peers = this.peers$.value;
    
    if (peers.has(peerId)) {
      console.warn(`⚠️ Peer ${peerId} already exists, ignoring offer`);
      return;
    }

    if (!this.config.autoAcceptConnections) {
      // Store pending offer for manual acceptance
      this.pendingOffers.set(peerId, offer);
      return;
    }

    // Auto-accept connection
    const peerConnection = new RTCPeerConnection(this.config.peerConnectionConfig);
    
    const peer: WebRTCPeer = {
      id: peerId,
      connection: peerConnection,
      isInitiator: false,
      connectionState: 'new',
      iceConnectionState: 'new',
      iceGatheringState: 'new',
      signalingState: 'stable',
      lastActivity: new Date()
    };

    this.setupPeerConnection(peer);

    // Set remote description
    await peerConnection.setRemoteDescription(offer);

    // Create answer
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    // Send answer through AlephScript
    this.alephClient.sendAnswer(answer, peerId, roomId);

    // Add peer to collection
    peers.set(peerId, peer);
    this.peers$.next(new Map(peers));

    // Add to current room if applicable
    const currentRoom = this.currentRoom$.value;
    if (currentRoom) {
      currentRoom.peers.set(peerId, peer);
      currentRoom.currentParticipants = currentRoom.peers.size;
    }

    this.setConnectionTimeout(peerId);
  }

  /**
   * Handle remote answer
   */
  private async handleRemoteAnswer(peerId: string, answer: RTCSessionDescriptionInit): Promise<void> {
    const peer = this.peers$.value.get(peerId);
    
    if (!peer) {
      console.warn(`⚠️ Received answer from unknown peer: ${peerId}`);
      return;
    }

    await peer.connection.setRemoteDescription(answer);
    this.clearConnectionTimeout(peerId);
  }

  /**
   * Handle remote ICE candidate
   */
  private async handleRemoteIceCandidate(peerId: string, candidate: RTCIceCandidateInit): Promise<void> {
    const peer = this.peers$.value.get(peerId);
    
    if (!peer) {
      console.warn(`⚠️ Received ICE candidate from unknown peer: ${peerId}`);
      return;
    }

    await peer.connection.addIceCandidate(candidate);
  }

  /**
   * Handle signaling relay
   */
  private handleSignalingRelay(message: WebRTCAlephMessage): void {
    // Handle custom signaling messages through AlephScript
    if (this.config.debug) {
      console.log('🔄 Signaling relay:', message);
    }
  }

  /**
   * Setup peer connection event handlers
   */
  private setupPeerConnection(peer: WebRTCPeer): void {
    const pc = peer.connection;

    // ICE candidate handler
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.alephClient.sendIceCandidate(
          event.candidate.toJSON(), 
          peer.id, 
          this.currentRoom$.value?.id
        );
      }
    };

    // Connection state changes
    pc.onconnectionstatechange = () => {
      peer.connectionState = pc.connectionState;
      peer.lastActivity = new Date();
      
      if (pc.connectionState === 'connected') {
        this.clearConnectionTimeout(peer.id);
        this.emitEvent({
          type: 'peer-connected',
          peerId: peer.id,
          timestamp: new Date()
        });
      } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        this.emitEvent({
          type: 'connection-failed',
          peerId: peer.id,
          data: { state: pc.connectionState },
          timestamp: new Date()
        });
      }
    };

    // ICE connection state changes
    pc.oniceconnectionstatechange = () => {
      peer.iceConnectionState = pc.iceConnectionState;
      
      if (pc.iceConnectionState === 'failed') {
        this.alephClient.handleWebRTCFailure(peer.id, new Error('ICE connection failed'));
      }
    };

    // Signaling state changes
    pc.onsignalingstatechange = () => {
      peer.signalingState = pc.signalingState;
    };

    // ICE gathering state changes
    pc.onicegatheringstatechange = () => {
      peer.iceGatheringState = pc.iceGatheringState;
    };

    // Data channel handler
    pc.ondatachannel = (event) => {
      const dataChannel = event.channel;
      peer.dataChannel = dataChannel;
      this.setupDataChannel(dataChannel, peer.id);
    };

    // Remote stream handler
    pc.ontrack = (event) => {
      peer.remoteStream = event.streams[0];
      this.emitEvent({
        type: 'stream-received',
        peerId: peer.id,
        data: event.streams[0],
        timestamp: new Date()
      });
    };
  }

  /**
   * Setup data channel event handlers
   */
  private setupDataChannel(dataChannel: RTCDataChannel, peerId: string): void {
    dataChannel.onopen = () => {
      if (this.config.debug) {
        console.log(`📡 Data channel opened for peer: ${peerId}`);
      }
    };

    dataChannel.onclose = () => {
      if (this.config.debug) {
        console.log(`📡 Data channel closed for peer: ${peerId}`);
      }
    };

    dataChannel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.emitEvent({
          type: 'data-received',
          peerId,
          data: message.data,
          timestamp: new Date()
        });
      } catch (error) {
        console.error('❌ Failed to parse data channel message:', error);
      }
    };

    dataChannel.onerror = (error) => {
      console.error(`❌ Data channel error for peer ${peerId}:`, error);
    };
  }

  /**
   * Set connection timeout
   */
  private setConnectionTimeout(peerId: string): void {
    const timer = window.setTimeout(() => {
      console.warn(`⏰ Connection timeout for peer: ${peerId}`);
      this.disconnectPeer(peerId);
    }, this.config.connectionTimeout);

    this.connectionTimers.set(peerId, timer);
  }

  /**
   * Clear connection timeout
   */
  private clearConnectionTimeout(peerId: string): void {
    const timer = this.connectionTimers.get(peerId);
    if (timer) {
      clearTimeout(timer);
      this.connectionTimers.delete(peerId);
    }
  }

  /**
   * Emit engine event
   */
  private emitEvent(event: WebRTCEngineEvent): void {
    this.events$.next(event);
    
    if (this.config.debug) {
      console.log('📢 WebRTC Engine event:', event);
    }
  }

  // ===== Public API Methods =====

  /**
   * Get peers observable
   */
  getPeers(): Observable<Map<string, WebRTCPeer>> {
    return this.peers$.asObservable();
  }

  /**
   * Get rooms observable
   */
  getRooms(): Observable<Map<string, WebRTCRoom>> {
    return this.rooms$.asObservable();
  }

  /**
   * Get current room observable
   */
  getCurrentRoom(): Observable<WebRTCRoom | null> {
    return this.currentRoom$.asObservable();
  }

  /**
   * Get engine events observable
   */
  getEvents(): Observable<WebRTCEngineEvent> {
    return this.events$.asObservable();
  }

  /**
   * Get peer by ID
   */
  getPeer(peerId: string): WebRTCPeer | undefined {
    return this.peers$.value.get(peerId);
  }

  /**
   * Get all connected peers
   */
  getConnectedPeers(): WebRTCPeer[] {
    return Array.from(this.peers$.value.values());
  }

  /**
   * Check if connected to peer
   */
  isConnectedToPeer(peerId: string): boolean {
    const peer = this.peers$.value.get(peerId);
    return peer?.connectionState === 'connected';
  }

  /**
   * Get available rooms
   */
  getAvailableRooms(): WebRTCRoom[] {
    return Array.from(this.rooms$.value.values());
  }

  /**
   * Destroy engine and cleanup resources
   */
  destroy(): void {
    // Disconnect all peers
    this.peers$.value.forEach((peer, peerId) => {
      this.disconnectPeer(peerId);
    });

    // Leave current room
    this.leaveRoom();

    // Stop all local streams
    this.localStreams.forEach(stream => {
      stream.getTracks().forEach(track => track.stop());
    });

    // Clear timers
    this.connectionTimers.forEach(timer => clearTimeout(timer));

    // Complete observables
    this.destroy$.next();
    this.destroy$.complete();
    this.events$.complete();
    this.peers$.complete();
    this.rooms$.complete();
    this.currentRoom$.complete();

    if (this.config.debug) {
      console.log('🔥 WebRTC Engine destroyed');
    }
  }
}

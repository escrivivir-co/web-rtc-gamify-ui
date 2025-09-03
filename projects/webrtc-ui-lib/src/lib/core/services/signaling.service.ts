import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject, fromEvent } from 'rxjs';
import { filter, map, takeUntil } from 'rxjs/operators';

import { 
  SignalingMessage, 
  SignalingMessageType, 
  BaseSignalingMessage,
  createBaseMessage,
  OfferMessage,
  AnswerMessage,
  IceCandidateMessage,
  RoomJoinMessage,
  RoomLeaveMessage
} from '../models';

/**
 * WebRTC signaling service interface
 * Abstract base class for different signaling implementations
 */
export abstract class SignalingService {
  protected destroyed$ = new Subject<void>();
  protected connectedSubject = new BehaviorSubject<boolean>(false);
  protected messageSubject = new Subject<SignalingMessage>();
  protected errorSubject = new Subject<Error>();

  // Public observables
  connected$ = this.connectedSubject.asObservable();
  messages$ = this.messageSubject.asObservable();
  error$ = this.errorSubject.asObservable();

  protected userId: string = '';
  protected roomId: string = '';

  /**
   * Connect to signaling server
   */
  abstract connect(userId: string, config?: any): Promise<void>;

  /**
   * Disconnect from signaling server
   */
  abstract disconnect(): Promise<void>;

  /**
   * Join a room
   */
  abstract joinRoom(roomId: string, displayName?: string): Promise<void>;

  /**
   * Leave current room
   */
  abstract leaveRoom(): Promise<void>;

  /**
   * Send a signaling message
   */
  abstract sendMessage(message: SignalingMessage): Promise<void>;

  /**
   * Send offer to specific peer
   */
  async sendOffer(targetPeerId: string, offer: RTCSessionDescriptionInit): Promise<void> {
    const message: OfferMessage = {
      type: SignalingMessageType.OFFER,
      from: this.userId,
      to: targetPeerId,
      roomId: this.roomId,
      timestamp: Date.now(),
      messageId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      offer,
      mediaConstraints: { audio: true, video: true } // Could be configurable
    };

    await this.sendMessage(message);
  }

  /**
   * Send answer to specific peer
   */
  async sendAnswer(targetPeerId: string, answer: RTCSessionDescriptionInit): Promise<void> {
    const message: AnswerMessage = {
      type: SignalingMessageType.ANSWER,
      from: this.userId,
      to: targetPeerId,
      roomId: this.roomId,
      timestamp: Date.now(),
      messageId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      answer
    };

    await this.sendMessage(message);
  }

  /**
   * Send ICE candidate to specific peer
   */
  async sendIceCandidate(targetPeerId: string, candidate: RTCIceCandidateInit): Promise<void> {
    const message: IceCandidateMessage = {
      type: SignalingMessageType.ICE_CANDIDATE,
      from: this.userId,
      to: targetPeerId,
      roomId: this.roomId,
      timestamp: Date.now(),
      messageId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      candidate
    };

    await this.sendMessage(message);
  }

  /**
   * Get messages of specific type
   */
  getMessages<T extends SignalingMessage>(type: SignalingMessageType): Observable<T> {
    return this.messages$.pipe(
      filter(message => message.type === type),
      map(message => message as T)
    );
  }

  /**
   * Get messages from specific peer
   */
  getMessagesFromPeer(peerId: string): Observable<SignalingMessage> {
    return this.messages$.pipe(
      filter(message => message.from === peerId)
    );
  }

  /**
   * Get messages for specific peer (directed to us)
   */
  getMessagesForPeer(peerId: string): Observable<SignalingMessage> {
    return this.messages$.pipe(
      filter(message => message.to === peerId || !message.to) // broadcast or direct
    );
  }

  /**
   * Check if connected to signaling server
   */
  isConnected(): boolean {
    return this.connectedSubject.value;
  }

  /**
   * Get current user ID
   */
  getUserId(): string {
    return this.userId;
  }

  /**
   * Get current room ID
   */
  getRoomId(): string {
    return this.roomId;
  }

  /**
   * Destroy service and cleanup
   */
  destroy(): void {
    this.destroyed$.next();
    this.destroyed$.complete();
  }

  /**
   * Handle incoming message (to be called by implementations)
   */
  protected handleMessage(message: SignalingMessage): void {
    this.messageSubject.next(message);
  }

  /**
   * Handle connection state change (to be called by implementations)
   */
  protected handleConnectionChange(connected: boolean): void {
    this.connectedSubject.next(connected);
  }

  /**
   * Handle errors (to be called by implementations)
   */
  protected handleError(error: Error): void {
    this.errorSubject.next(error);
  }
}

/**
 * WebSocket-based signaling service implementation
 * Generic WebSocket signaling that can be extended for specific protocols
 */
@Injectable({
  providedIn: 'root'
})
export class WebSocketSignalingService extends SignalingService {
  private websocket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private pingInterval: any;
  private pongTimeout: any;

  /**
   * Connect to WebSocket signaling server
   */
  async connect(userId: string, config: { url: string; protocols?: string[] } = { url: 'ws://localhost:3000' }): Promise<void> {
    this.userId = userId;

    return new Promise((resolve, reject) => {
      try {
        this.websocket = new WebSocket(config.url, config.protocols);

        this.websocket.onopen = () => {
          console.log('[WebSocketSignaling] Connected to signaling server');
          this.reconnectAttempts = 0;
          this.handleConnectionChange(true);
          this.startHeartbeat();
          resolve();
        };

        this.websocket.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data) as SignalingMessage;
            this.handleMessage(message);
          } catch (error) {
            console.error('[WebSocketSignaling] Failed to parse message:', error);
          }
        };

        this.websocket.onclose = (event) => {
          console.log('[WebSocketSignaling] Connection closed', event.code, event.reason);
          this.handleConnectionChange(false);
          this.stopHeartbeat();
          
          if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.attemptReconnect();
          }
        };

        this.websocket.onerror = (error) => {
          console.error('[WebSocketSignaling] WebSocket error:', error);
          this.handleError(new Error('WebSocket connection error'));
          reject(error);
        };

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  async disconnect(): Promise<void> {
    if (this.websocket) {
      this.stopHeartbeat();
      this.websocket.close(1000, 'Client disconnect');
      this.websocket = null;
    }
  }

  /**
   * Join a room via WebSocket
   */
  async joinRoom(roomId: string, displayName: string = this.userId): Promise<void> {
    this.roomId = roomId;
    
    const message: RoomJoinMessage = {
      type: SignalingMessageType.ROOM_JOIN,
      from: this.userId,
      roomId: roomId,
      timestamp: Date.now(),
      messageId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      displayName,
      role: 'participant'
    };

    await this.sendMessage(message);
  }

  /**
   * Leave current room
   */
  async leaveRoom(): Promise<void> {
    if (this.roomId) {
      const message: RoomLeaveMessage = {
        type: SignalingMessageType.ROOM_LEAVE,
        from: this.userId,
        roomId: this.roomId,
        timestamp: Date.now(),
        messageId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        reason: 'User left'
      };

      await this.sendMessage(message);
      this.roomId = '';
    }
  }

  /**
   * Send message via WebSocket
   */
  async sendMessage(message: SignalingMessage): Promise<void> {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    try {
      const serialized = JSON.stringify(message);
      this.websocket.send(serialized);
    } catch (error) {
      this.handleError(new Error(`Failed to send message: ${error}`));
      throw error;
    }
  }

  /**
   * Attempt to reconnect to WebSocket server
   */
  private attemptReconnect(): void {
    this.reconnectAttempts++;
    
    setTimeout(() => {
      console.log(`[WebSocketSignaling] Reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
      this.connect(this.userId).catch(() => {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          this.handleError(new Error('Max reconnection attempts reached'));
        }
      });
    }, this.reconnectDelay * this.reconnectAttempts);
  }

  /**
   * Start heartbeat mechanism
   */
  private startHeartbeat(): void {
    this.pingInterval = setInterval(() => {
      if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
        const heartbeat = {
          ...createBaseMessage(SignalingMessageType.HEARTBEAT, this.userId),
        };
        this.websocket.send(JSON.stringify(heartbeat));
      }
    }, 30000); // Send heartbeat every 30 seconds
  }

  /**
   * Stop heartbeat mechanism
   */
  private stopHeartbeat(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.pongTimeout) {
      clearTimeout(this.pongTimeout);
      this.pongTimeout = null;
    }
  }
}

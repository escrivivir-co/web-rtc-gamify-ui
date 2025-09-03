import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, Subject, fromEvent, merge } from 'rxjs';
import { map, filter, takeUntil, tap } from 'rxjs/operators';

import { 
  WebRTCConfig, 
  DEFAULT_WEBRTC_CONFIG, 
  Peer, 
  PeerStatus, 
  createPeer,
  MediaConstraints,
  MediaPresets 
} from '../models';

/**
 * Main WebRTC service for managing peer connections
 * Handles connection lifecycle, media streams, and ICE negotiation
 */
@Injectable({
  providedIn: 'root'
})
export class WebRTCService {
  private config: WebRTCConfig = DEFAULT_WEBRTC_CONFIG;
  private peers = new Map<string, RTCPeerConnection>();
  private localStream: MediaStream | null = null;
  private destroyed$ = new Subject<void>();

  // Observables
  private peersSubject = new BehaviorSubject<Map<string, Peer>>(new Map());
  private localStreamSubject = new BehaviorSubject<MediaStream | null>(null);
  private connectionStateSubject = new BehaviorSubject<RTCPeerConnectionState>('new');
  private iceConnectionStateSubject = new BehaviorSubject<RTCIceConnectionState>('new');
  private errorSubject = new Subject<Error>();

  // Public observables
  peers$ = this.peersSubject.asObservable();
  localStream$ = this.localStreamSubject.asObservable();
  connectionState$ = this.connectionStateSubject.asObservable();
  iceConnectionState$ = this.iceConnectionStateSubject.asObservable();
  error$ = this.errorSubject.asObservable();

  /**
   * Initialize WebRTC service with configuration
   */
  initialize(config: Partial<WebRTCConfig> = {}): void {
    this.config = { ...DEFAULT_WEBRTC_CONFIG, ...config };
    this.log('WebRTC Service initialized', this.config);
  }

  /**
   * Get user media stream
   */
  async getUserMedia(constraints?: MediaConstraints): Promise<MediaStream> {
    try {
      const mediaConstraints = constraints || this.config.mediaConstraints || MediaPresets.STANDARD;
      
      this.log('Requesting user media', mediaConstraints);
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: mediaConstraints.audio,
        video: mediaConstraints.video
      });

      this.localStream = stream;
      this.localStreamSubject.next(stream);
      
      this.log('User media acquired', {
        audioTracks: stream.getAudioTracks().length,
        videoTracks: stream.getVideoTracks().length
      });

      return stream;
    } catch (error) {
      this.handleError(new Error(`Failed to get user media: ${error}`));
      throw error;
    }
  }

  /**
   * Get screen capture stream
   */
  async getDisplayMedia(constraints?: MediaConstraints): Promise<MediaStream> {
    try {
      const displayConstraints = constraints?.screen || { video: true, audio: true };
      
      this.log('Requesting display media', displayConstraints);
      
      const stream = await navigator.mediaDevices.getDisplayMedia(displayConstraints as MediaStreamConstraints);
      
      this.log('Display media acquired', {
        videoTracks: stream.getVideoTracks().length,
        audioTracks: stream.getAudioTracks().length
      });

      return stream;
    } catch (error) {
      this.handleError(new Error(`Failed to get display media: ${error}`));
      throw error;
    }
  }

  /**
   * Create a new peer connection
   */
  async createPeerConnection(peerId: string, isInitiator: boolean = false): Promise<RTCPeerConnection> {
    try {
      this.log(`Creating peer connection for ${peerId}`, { isInitiator });

      const peerConnection = new RTCPeerConnection(this.config.configuration);

      // Add local stream tracks to peer connection
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => {
          peerConnection.addTrack(track, this.localStream!);
        });
      }

      // Set up event listeners
      this.setupPeerConnectionEvents(peerConnection, peerId);

      // Store peer connection
      this.peers.set(peerId, peerConnection);

      // Update peers observable
      this.updatePeersObservable();

      if (isInitiator) {
        await this.createOffer(peerId);
      }

      return peerConnection;
    } catch (error) {
      this.handleError(new Error(`Failed to create peer connection for ${peerId}: ${error}`));
      throw error;
    }
  }

  /**
   * Create and send an offer
   */
  async createOffer(peerId: string): Promise<RTCSessionDescriptionInit> {
    const peerConnection = this.peers.get(peerId);
    if (!peerConnection) {
      throw new Error(`Peer connection not found for ${peerId}`);
    }

    try {
      this.log(`Creating offer for ${peerId}`);
      
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      
      this.log(`Offer created for ${peerId}`, offer);
      
      return offer;
    } catch (error) {
      this.handleError(new Error(`Failed to create offer for ${peerId}: ${error}`));
      throw error;
    }
  }

  /**
   * Create and send an answer
   */
  async createAnswer(peerId: string, offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    const peerConnection = this.peers.get(peerId);
    if (!peerConnection) {
      throw new Error(`Peer connection not found for ${peerId}`);
    }

    try {
      this.log(`Creating answer for ${peerId}`, offer);
      
      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      
      this.log(`Answer created for ${peerId}`, answer);
      
      return answer;
    } catch (error) {
      this.handleError(new Error(`Failed to create answer for ${peerId}: ${error}`));
      throw error;
    }
  }

  /**
   * Handle incoming answer
   */
  async handleAnswer(peerId: string, answer: RTCSessionDescriptionInit): Promise<void> {
    const peerConnection = this.peers.get(peerId);
    if (!peerConnection) {
      throw new Error(`Peer connection not found for ${peerId}`);
    }

    try {
      this.log(`Handling answer from ${peerId}`, answer);
      
      await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      
      this.log(`Answer handled for ${peerId}`);
    } catch (error) {
      this.handleError(new Error(`Failed to handle answer from ${peerId}: ${error}`));
      throw error;
    }
  }

  /**
   * Add ICE candidate
   */
  async addIceCandidate(peerId: string, candidate: RTCIceCandidateInit): Promise<void> {
    const peerConnection = this.peers.get(peerId);
    if (!peerConnection) {
      throw new Error(`Peer connection not found for ${peerId}`);
    }

    try {
      this.log(`Adding ICE candidate for ${peerId}`, candidate);
      
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      
      this.log(`ICE candidate added for ${peerId}`);
    } catch (error) {
      this.handleError(new Error(`Failed to add ICE candidate for ${peerId}: ${error}`));
      throw error;
    }
  }

  /**
   * Close peer connection
   */
  closePeerConnection(peerId: string): void {
    const peerConnection = this.peers.get(peerId);
    if (peerConnection) {
      this.log(`Closing peer connection for ${peerId}`);
      
      peerConnection.close();
      this.peers.delete(peerId);
      this.updatePeersObservable();
      
      this.log(`Peer connection closed for ${peerId}`);
    }
  }

  /**
   * Close all peer connections
   */
  closeAllConnections(): void {
    this.log('Closing all peer connections');
    
    this.peers.forEach((peerConnection, peerId) => {
      peerConnection.close();
    });
    
    this.peers.clear();
    this.updatePeersObservable();
  }

  /**
   * Stop local media stream
   */
  stopLocalStream(): void {
    if (this.localStream) {
      this.log('Stopping local stream');
      
      this.localStream.getTracks().forEach(track => {
        track.stop();
      });
      
      this.localStream = null;
      this.localStreamSubject.next(null);
    }
  }

  /**
   * Get peer connection by ID
   */
  getPeerConnection(peerId: string): RTCPeerConnection | undefined {
    return this.peers.get(peerId);
  }

  /**
   * Get all peer connections
   */
  getAllPeerConnections(): Map<string, RTCPeerConnection> {
    return new Map(this.peers);
  }

  /**
   * Destroy service and cleanup resources
   */
  destroy(): void {
    this.log('Destroying WebRTC service');
    
    this.destroyed$.next();
    this.destroyed$.complete();
    
    this.closeAllConnections();
    this.stopLocalStream();
  }

  /**
   * Set up event listeners for peer connection
   */
  private setupPeerConnectionEvents(peerConnection: RTCPeerConnection, peerId: string): void {
    // ICE candidate event
    peerConnection.addEventListener('icecandidate', (event) => {
      if (event.candidate) {
        this.log(`ICE candidate for ${peerId}`, event.candidate);
        // This would typically be sent via signaling service
      }
    });

    // Connection state change
    peerConnection.addEventListener('connectionstatechange', () => {
      this.log(`Connection state changed for ${peerId}:`, peerConnection.connectionState);
      this.connectionStateSubject.next(peerConnection.connectionState);
      this.updatePeersObservable();
    });

    // ICE connection state change
    peerConnection.addEventListener('iceconnectionstatechange', () => {
      this.log(`ICE connection state changed for ${peerId}:`, peerConnection.iceConnectionState);
      this.iceConnectionStateSubject.next(peerConnection.iceConnectionState);
      this.updatePeersObservable();
    });

    // Track event (remote stream)
    peerConnection.addEventListener('track', (event) => {
      this.log(`Track received from ${peerId}`, event.track);
      this.updatePeersObservable();
    });

    // Data channel event
    peerConnection.addEventListener('datachannel', (event) => {
      this.log(`Data channel received from ${peerId}`, event.channel);
      this.setupDataChannelEvents(event.channel, peerId);
    });
  }

  /**
   * Set up data channel event listeners
   */
  private setupDataChannelEvents(dataChannel: RTCDataChannel, peerId: string): void {
    dataChannel.addEventListener('open', () => {
      this.log(`Data channel opened with ${peerId}`);
    });

    dataChannel.addEventListener('message', (event) => {
      this.log(`Data channel message from ${peerId}`, event.data);
    });

    dataChannel.addEventListener('close', () => {
      this.log(`Data channel closed with ${peerId}`);
    });

    dataChannel.addEventListener('error', (error) => {
      this.handleError(new Error(`Data channel error with ${peerId}: ${error}`));
    });
  }

  /**
   * Update peers observable with current state
   */
  private updatePeersObservable(): void {
    const peersMap = new Map<string, Peer>();
    
    this.peers.forEach((peerConnection, peerId) => {
      const peer = this.createPeerFromConnection(peerId, peerConnection);
      peersMap.set(peerId, peer);
    });
    
    this.peersSubject.next(peersMap);
  }

  /**
   * Create Peer model from RTCPeerConnection
   */
  private createPeerFromConnection(peerId: string, peerConnection: RTCPeerConnection): Peer {
    const peer = createPeer(peerId, peerId); // displayName would come from signaling
    
    peer.connectionState = peerConnection.connectionState;
    peer.iceConnectionState = peerConnection.iceConnectionState;
    
    // Get remote stream from receivers
    const receivers = peerConnection.getReceivers();
    const remoteStreams = new Map<string, MediaStream>();
    
    receivers.forEach(receiver => {
      if (receiver.track) {
        const streamId = receiver.track.id; // or get from track settings
        if (!remoteStreams.has(streamId)) {
          remoteStreams.set(streamId, new MediaStream());
        }
        remoteStreams.get(streamId)!.addTrack(receiver.track);
      }
    });
    
    // Use the first remote stream if available
    const remoteStreamArray = Array.from(remoteStreams.values());
    if (remoteStreamArray.length > 0) {
      peer.mediaStream = remoteStreamArray[0];
      
      const audioTracks = peer.mediaStream.getAudioTracks();
      const videoTracks = peer.mediaStream.getVideoTracks();
      
      if (audioTracks.length > 0) {
        peer.tracks.audio = audioTracks[0];
        peer.mediaState.audioEnabled = audioTracks[0].enabled;
      }
      
      if (videoTracks.length > 0) {
        peer.tracks.video = videoTracks[0];
        peer.mediaState.videoEnabled = videoTracks[0].enabled;
      }
    }
    
    peer.timestamps.lastActivity = new Date();
    
    return peer;
  }

  /**
   * Handle errors
   */
  private handleError(error: Error): void {
    this.log('Error:', error.message);
    this.errorSubject.next(error);
  }

  /**
   * Debug logging
   */
  private log(message: string, data?: any): void {
    if (this.config.debug) {
      console.log(`[WebRTCService] ${message}`, data || '');
    }
  }
}

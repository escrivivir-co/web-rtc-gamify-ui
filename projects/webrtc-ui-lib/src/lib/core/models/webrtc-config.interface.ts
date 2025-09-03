/**
 * Configuration interface for WebRTC connections
 * Used to configure RTCPeerConnection and related services
 */
export interface WebRTCConfig {
  /** ICE servers configuration for NAT traversal */
  iceServers: RTCIceServer[];
  
  /** RTCConfiguration options */
  configuration?: RTCConfiguration;
  
  /** Media constraints for getUserMedia */
  mediaConstraints?: MediaStreamConstraints;
  
  /** Enable debug logging */
  debug?: boolean;
  
  /** Connection timeout in milliseconds */
  connectionTimeout?: number;
  
  /** Maximum number of reconnection attempts */
  maxReconnectAttempts?: number;
  
  /** Reconnection delay in milliseconds */
  reconnectDelay?: number;
  
  /** Enable automatic reconnection */
  autoReconnect?: boolean;
  
  /** Data channel configuration */
  dataChannelConfig?: RTCDataChannelInit;
  
  /** Room configuration for AlephScript integration */
  roomConfig?: {
    /** Room ID for joining */
    roomId?: string;
    /** User display name */
    displayName?: string;
    /** User role in room */
    role?: 'host' | 'participant' | 'observer';
    /** Maximum participants allowed */
    maxParticipants?: number;
  };
}

/**
 * Default WebRTC configuration
 */
export const DEFAULT_WEBRTC_CONFIG: WebRTCConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ],
  configuration: {
    iceTransportPolicy: 'all',
    bundlePolicy: 'balanced',
    rtcpMuxPolicy: 'require'
  },
  mediaConstraints: {
    audio: true,
    video: true
  },
  debug: false,
  connectionTimeout: 30000,
  maxReconnectAttempts: 3,
  reconnectDelay: 1000,
  autoReconnect: true,
  dataChannelConfig: {
    ordered: true,
    maxRetransmits: 3
  }
};

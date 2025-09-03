/**
 * Represents a remote peer in the WebRTC network
 */
export interface Peer {
  /** Unique identifier for the peer */
  id: string;
  
  /** Display name of the peer */
  displayName: string;
  
  /** Current connection state */
  connectionState: RTCPeerConnectionState;
  
  /** ICE connection state */
  iceConnectionState: RTCIceConnectionState;
  
  /** Media stream from the peer */
  mediaStream?: MediaStream;
  
  /** Available media tracks */
  tracks: {
    audio?: MediaStreamTrack;
    video?: MediaStreamTrack;
  };
  
  /** Media state information */
  mediaState: {
    audioEnabled: boolean;
    videoEnabled: boolean;
    audioMuted: boolean;
    videoMuted: boolean;
  };
  
  /** Data channels with this peer */
  dataChannels: Map<string, RTCDataChannel>;
  
  /** Peer role in the session */
  role?: 'host' | 'participant' | 'observer';
  
  /** Additional metadata */
  metadata?: Record<string, any>;
  
  /** Connection quality metrics */
  quality?: {
    /** Round trip time in milliseconds */
    rtt?: number;
    /** Packet loss percentage */
    packetLoss?: number;
    /** Bandwidth estimate */
    bandwidth?: number;
    /** Signal strength */
    signalStrength?: 'excellent' | 'good' | 'fair' | 'poor';
  };
  
  /** Timestamps */
  timestamps: {
    /** When peer was first discovered */
    discovered: Date;
    /** When connection was established */
    connected?: Date;
    /** Last activity timestamp */
    lastActivity: Date;
  };
}

/**
 * Peer status enumeration
 */
export enum PeerStatus {
  DISCOVERING = 'discovering',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  DISCONNECTED = 'disconnected',
  FAILED = 'failed'
}

/**
 * Helper to create a new peer instance
 */
export function createPeer(id: string, displayName: string): Peer {
  return {
    id,
    displayName,
    connectionState: 'new',
    iceConnectionState: 'new',
    tracks: {},
    mediaState: {
      audioEnabled: false,
      videoEnabled: false,
      audioMuted: false,
      videoMuted: false
    },
    dataChannels: new Map(),
    timestamps: {
      discovered: new Date(),
      lastActivity: new Date()
    }
  };
}

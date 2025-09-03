/**
 * Room configuration interface
 */
export interface RoomConfig {
  /** Unique room identifier */
  id: string;
  
  /** Human-readable room name */
  name: string;
  
  /** Room description */
  description?: string;
  
  /** Room type */
  type: 'public' | 'private' | 'protected';
  
  /** Password for protected rooms */
  password?: string;
  
  /** Maximum number of participants */
  maxParticipants: number;
  
  /** Room host user ID */
  hostId: string;
  
  /** Room creation timestamp */
  createdAt: Date;
  
  /** Room settings */
  settings: {
    /** Allow audio */
    allowAudio: boolean;
    
    /** Allow video */
    allowVideo: boolean;
    
    /** Allow screen sharing */
    allowScreenShare: boolean;
    
    /** Allow data channels */
    allowDataChannels: boolean;
    
    /** Require host approval for joining */
    requireApproval: boolean;
    
    /** Enable recording */
    recordingEnabled: boolean;
    
    /** Mute participants on join */
    muteOnJoin: boolean;
    
    /** Disable video on join */
    disableVideoOnJoin: boolean;
    
    /** Enable waiting room */
    waitingRoom: boolean;
    
    /** Lock room (prevent new joins) */
    locked: boolean;
  };
  
  /** Room metadata */
  metadata?: Record<string, any>;
  
  /** AlephScript specific configuration */
  alephScript?: {
    /** Game session ID if applicable */
    gameSessionId?: string;
    
    /** Special room features */
    features?: string[];
    
    /** Custom room rules */
    rules?: Record<string, any>;
  };
}

/**
 * Room state information
 */
export interface RoomState {
  /** Room configuration */
  config: RoomConfig;
  
  /** Current participants */
  participants: RoomParticipant[];
  
  /** Room statistics */
  stats: {
    /** Total participants ever joined */
    totalParticipants: number;
    
    /** Current participant count */
    currentParticipants: number;
    
    /** Active speakers count */
    activeSpeakers: number;
    
    /** Average connection quality */
    averageQuality: number;
    
    /** Room uptime */
    uptime: number;
  };
  
  /** Room events log */
  events: RoomEvent[];
  
  /** Current room status */
  status: 'waiting' | 'active' | 'paused' | 'ended';
}

/**
 * Room participant information
 */
export interface RoomParticipant {
  /** Participant user ID */
  userId: string;
  
  /** Participant display name */
  displayName: string;
  
  /** Participant role */
  role: 'host' | 'moderator' | 'participant' | 'observer';
  
  /** Join timestamp */
  joinedAt: Date;
  
  /** Current status */
  status: 'joining' | 'connected' | 'reconnecting' | 'disconnected';
  
  /** Participant permissions */
  permissions: {
    canSpeak: boolean;
    canVideo: boolean;
    canScreenShare: boolean;
    canModerate: boolean;
    canInvite: boolean;
  };
  
  /** Current media state */
  mediaState: {
    audioEnabled: boolean;
    videoEnabled: boolean;
    screenSharing: boolean;
    audioMuted: boolean;
    videoMuted: boolean;
  };
  
  /** Connection quality */
  quality: {
    signal: 'excellent' | 'good' | 'fair' | 'poor';
    latency: number;
    packetLoss: number;
  };
  
  /** Participant metadata */
  metadata?: Record<string, any>;
}

/**
 * Room event types
 */
export enum RoomEventType {
  ROOM_CREATED = 'room-created',
  ROOM_DESTROYED = 'room-destroyed',
  PARTICIPANT_JOINED = 'participant-joined',
  PARTICIPANT_LEFT = 'participant-left',
  PARTICIPANT_PROMOTED = 'participant-promoted',
  PARTICIPANT_DEMOTED = 'participant-demoted',
  PARTICIPANT_MUTED = 'participant-muted',
  PARTICIPANT_UNMUTED = 'participant-unmuted',
  SCREEN_SHARE_STARTED = 'screen-share-started',
  SCREEN_SHARE_STOPPED = 'screen-share-stopped',
  RECORDING_STARTED = 'recording-started',
  RECORDING_STOPPED = 'recording-stopped',
  ROOM_LOCKED = 'room-locked',
  ROOM_UNLOCKED = 'room-unlocked',
  MESSAGE_SENT = 'message-sent',
  ERROR_OCCURRED = 'error-occurred'
}

/**
 * Room event interface
 */
export interface RoomEvent {
  /** Event type */
  type: RoomEventType;
  
  /** Event timestamp */
  timestamp: Date;
  
  /** User who triggered the event */
  userId?: string;
  
  /** Event data */
  data?: any;
  
  /** Event description */
  description: string;
}

/**
 * Room invitation interface
 */
export interface RoomInvitation {
  /** Invitation ID */
  id: string;
  
  /** Room ID */
  roomId: string;
  
  /** Inviter user ID */
  inviterId: string;
  
  /** Invitee email or user ID */
  invitee: string;
  
  /** Invitation message */
  message?: string;
  
  /** Invitation status */
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  
  /** Creation timestamp */
  createdAt: Date;
  
  /** Expiration timestamp */
  expiresAt: Date;
  
  /** Response timestamp */
  respondedAt?: Date;
}

/**
 * Helper to create a default room configuration
 */
export function createDefaultRoomConfig(id: string, name: string, hostId: string): RoomConfig {
  return {
    id,
    name,
    type: 'public',
    maxParticipants: 10,
    hostId,
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

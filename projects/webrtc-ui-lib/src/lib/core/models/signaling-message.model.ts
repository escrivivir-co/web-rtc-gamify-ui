/**
 * WebRTC signaling message types
 */
export enum SignalingMessageType {
  OFFER = 'offer',
  ANSWER = 'answer',
  ICE_CANDIDATE = 'ice-candidate',
  ROOM_JOIN = 'room-join',
  ROOM_LEAVE = 'room-leave',
  PEER_CONNECTED = 'peer-connected',
  PEER_DISCONNECTED = 'peer-disconnected',
  MEDIA_STATE_CHANGE = 'media-state-change',
  DATA_CHANNEL_MESSAGE = 'data-channel-message',
  ERROR = 'error',
  HEARTBEAT = 'heartbeat'
}

/**
 * Base signaling message interface
 */
export interface BaseSignalingMessage {
  /** Message type */
  type: SignalingMessageType;
  
  /** Source peer ID */
  from: string;
  
  /** Target peer ID (optional for broadcast messages) */
  to?: string;
  
  /** Room ID if applicable */
  roomId?: string;
  
  /** Message timestamp */
  timestamp: number;
  
  /** Unique message ID */
  messageId: string;
}

/**
 * WebRTC offer message
 */
export interface OfferMessage extends BaseSignalingMessage {
  type: SignalingMessageType.OFFER;
  offer: RTCSessionDescriptionInit;
  mediaConstraints?: MediaStreamConstraints;
}

/**
 * WebRTC answer message
 */
export interface AnswerMessage extends BaseSignalingMessage {
  type: SignalingMessageType.ANSWER;
  answer: RTCSessionDescriptionInit;
}

/**
 * ICE candidate message
 */
export interface IceCandidateMessage extends BaseSignalingMessage {
  type: SignalingMessageType.ICE_CANDIDATE;
  candidate: RTCIceCandidateInit;
}

/**
 * Room join message
 */
export interface RoomJoinMessage extends BaseSignalingMessage {
  type: SignalingMessageType.ROOM_JOIN;
  displayName: string;
  role?: 'host' | 'participant' | 'observer';
  metadata?: Record<string, any>;
}

/**
 * Room leave message
 */
export interface RoomLeaveMessage extends BaseSignalingMessage {
  type: SignalingMessageType.ROOM_LEAVE;
  reason?: string;
}

/**
 * Peer connected message
 */
export interface PeerConnectedMessage extends BaseSignalingMessage {
  type: SignalingMessageType.PEER_CONNECTED;
  peerInfo: {
    id: string;
    displayName: string;
    role?: string;
    metadata?: Record<string, any>;
  };
}

/**
 * Peer disconnected message
 */
export interface PeerDisconnectedMessage extends BaseSignalingMessage {
  type: SignalingMessageType.PEER_DISCONNECTED;
  reason?: string;
}

/**
 * Media state change message
 */
export interface MediaStateChangeMessage extends BaseSignalingMessage {
  type: SignalingMessageType.MEDIA_STATE_CHANGE;
  mediaState: {
    audioEnabled: boolean;
    videoEnabled: boolean;
    audioMuted: boolean;
    videoMuted: boolean;
  };
}

/**
 * Data channel message
 */
export interface DataChannelMessage extends BaseSignalingMessage {
  type: SignalingMessageType.DATA_CHANNEL_MESSAGE;
  channelName: string;
  data: any;
}

/**
 * Error message
 */
export interface ErrorMessage extends BaseSignalingMessage {
  type: SignalingMessageType.ERROR;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

/**
 * Heartbeat message
 */
export interface HeartbeatMessage extends BaseSignalingMessage {
  type: SignalingMessageType.HEARTBEAT;
}

/**
 * Union type for all signaling messages
 */
export type SignalingMessage = 
  | OfferMessage
  | AnswerMessage
  | IceCandidateMessage
  | RoomJoinMessage
  | RoomLeaveMessage
  | PeerConnectedMessage
  | PeerDisconnectedMessage
  | MediaStateChangeMessage
  | DataChannelMessage
  | ErrorMessage
  | HeartbeatMessage;

/**
 * Helper to create a base signaling message
 */
export function createBaseMessage(
  type: SignalingMessageType,
  from: string,
  to?: string,
  roomId?: string
): BaseSignalingMessage {
  return {
    type,
    from,
    to,
    roomId,
    timestamp: Date.now(),
    messageId: generateMessageId()
  };
}

/**
 * Generate a unique message ID
 */
function generateMessageId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

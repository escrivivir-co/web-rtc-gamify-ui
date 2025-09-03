/**
 * Media constraints configuration for WebRTC
 */
export interface MediaConstraints {
  /** Audio constraints */
  audio: boolean | MediaTrackConstraints;
  
  /** Video constraints */
  video: boolean | MediaTrackConstraints;
  
  /** Screen share constraints */
  screen?: boolean | MediaTrackConstraints;
}

/**
 * Advanced audio constraints
 */
export interface AudioConstraints extends MediaTrackConstraints {
  /** Echo cancellation */
  echoCancellation?: boolean;
  
  /** Noise suppression */
  noiseSuppression?: boolean;
  
  /** Auto gain control */
  autoGainControl?: boolean;
  
  /** Sample rate */
  sampleRate?: number | ConstrainULong;
  
  /** Sample size */
  sampleSize?: number | ConstrainULong;
  
  /** Channel count */
  channelCount?: number | ConstrainULong;
  
  /** Audio device ID */
  deviceId?: string | string[] | ConstrainDOMString;
}

/**
 * Advanced video constraints
 */
export interface VideoConstraints extends MediaTrackConstraints {
  /** Video width */
  width?: number | ConstrainULong;
  
  /** Video height */
  height?: number | ConstrainULong;
  
  /** Frame rate */
  frameRate?: number | ConstrainDouble;
  
  /** Aspect ratio */
  aspectRatio?: number | ConstrainDouble;
  
  /** Facing mode (user/environment) */
  facingMode?: string | string[] | ConstrainDOMString;
  
  /** Video device ID */
  deviceId?: string | string[] | ConstrainDOMString;
  
  /** Resolution preset */
  preset?: 'qvga' | 'vga' | 'hd' | 'fullhd' | '4k';
}

/**
 * Screen sharing constraints
 */
export interface ScreenConstraints {
  /** Display surface type */
  displaySurface?: 'monitor' | 'window' | 'application' | 'browser';
  
  /** Logical surface */
  logicalSurface?: boolean;
  
  /** Cursor capture */
  cursor?: 'never' | 'always' | 'motion';
  
  /** System audio */
  systemAudio?: 'include' | 'exclude';
  
  /** Self browser surface */
  selfBrowserSurface?: 'include' | 'exclude';
  
  /** Suppress local audio feedback */
  suppressLocalAudioPlayback?: boolean;
}

/**
 * Predefined media constraint presets
 */
export const MediaPresets = {
  /** Audio only */
  AUDIO_ONLY: {
    audio: true,
    video: false
  } as MediaConstraints,
  
  /** Video only */
  VIDEO_ONLY: {
    audio: false,
    video: true
  } as MediaConstraints,
  
  /** Standard audio and video */
  STANDARD: {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    },
    video: {
      width: { ideal: 640 },
      height: { ideal: 480 },
      frameRate: { ideal: 30 }
    }
  } as MediaConstraints,
  
  /** High quality */
  HIGH_QUALITY: {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      sampleRate: 48000
    },
    video: {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30 }
    }
  } as MediaConstraints,
  
  /** Low bandwidth */
  LOW_BANDWIDTH: {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    },
    video: {
      width: { ideal: 320 },
      height: { ideal: 240 },
      frameRate: { ideal: 15 }
    }
  } as MediaConstraints,
  
  /** Screen sharing */
  SCREEN_SHARE: {
    audio: false,
    video: false,
    screen: {
      displaySurface: 'monitor',
      logicalSurface: true,
      cursor: 'always',
      systemAudio: 'include'
    } as ScreenConstraints
  } as MediaConstraints
};

/**
 * Device information
 */
export interface MediaDevice {
  /** Device ID */
  deviceId: string;
  
  /** Device label */
  label: string;
  
  /** Device kind */
  kind: MediaDeviceKind;
  
  /** Group ID */
  groupId: string;
  
  /** Whether device is default */
  isDefault?: boolean;
  
  /** Device capabilities */
  capabilities?: MediaTrackCapabilities;
}

/**
 * Media device manager state
 */
export interface MediaDeviceState {
  /** Available audio input devices */
  audioInputs: MediaDevice[];
  
  /** Available video input devices */
  videoInputs: MediaDevice[];
  
  /** Available audio output devices */
  audioOutputs: MediaDevice[];
  
  /** Currently selected devices */
  selected: {
    audioInput?: string;
    videoInput?: string;
    audioOutput?: string;
  };
  
  /** Permission status */
  permissions: {
    camera: PermissionState;
    microphone: PermissionState;
  };
}

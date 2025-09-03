/*
 * Public API Surface of webrtc-ui-lib
 */

// Integration Services (Phase 4.1-4.2)
export * from './lib/integration/webrtc-aleph-client.service';
export * from './lib/integration/webrtc-engine.service';
export * from './lib/integration/webrtc-orchestrator.service';

// Media Controls Components
export * from './lib/features/media-controls/video-controls.component';
export * from './lib/features/media-controls/audio-controls.component';
export * from './lib/features/media-controls/screen-share.component';

// Data Channels Components
export * from './lib/features/data-channels/chat.component';
export * from './lib/features/data-channels/file-transfer.component';

// Room Management Components
export * from './lib/features/room-management/room-list.component';
export * from './lib/features/room-management/room-controls.component';
export * from './lib/features/room-management/room-creation.component';

// Core Models and Interfaces (selective exports)
export * from './lib/core/models/webrtc-config.interface';
export * from './lib/core/models/peer.model';
export * from './lib/core/models/signaling-message.model';
export * from './lib/core/models/media-constraints.model';

// Main Module
export * from './lib/webrtc-ui-lib.module';

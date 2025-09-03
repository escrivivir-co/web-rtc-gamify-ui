import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';

// Integration services
import { WebRTCAlephClient } from './integration/webrtc-aleph-client.service';
import { WebRTCEngine } from './integration/webrtc-engine.service';
import { WebRTCOrchestrator } from './integration/webrtc-orchestrator.service';

// Feature components (existing)
import { ChatComponent } from './features/data-channels/chat.component';
import { FileTransferComponent } from './features/data-channels/file-transfer.component';
import { RoomListComponent } from './features/room-management/room-list.component';
import { RoomControlsComponent } from './features/room-management/room-controls.component';
import { RoomCreationComponent } from './features/room-management/room-creation.component';

/**
 * WebRTC UI Library Module
 * Complete WebRTC solution with Angular components and services
 */
@NgModule({
  imports: [
    CommonModule,
    ReactiveFormsModule,
    // Import standalone components instead of declaring them
    ChatComponent,
    FileTransferComponent,
    RoomListComponent,
    RoomControlsComponent,
    RoomCreationComponent
  ],
  providers: [
    // Integration services
    WebRTCAlephClient,
    WebRTCEngine,
    WebRTCOrchestrator
  ],
  exports: [
    // Export standalone components
    ChatComponent,
    FileTransferComponent,
    RoomListComponent,
    RoomControlsComponent,
    RoomCreationComponent
  ]
})
export class WebRTCUILibModule { 
  /**
   * Configure the WebRTC UI Library with default settings
   * @param config Optional configuration for the library
   * @returns ModuleWithProviders for root module configuration
   */
  static forRoot(config?: {
    alephIntegration?: {
      serverUrl?: string;
      autoConnect?: boolean;
    };
    webrtc?: {
      iceServers?: RTCIceServer[];
      debug?: boolean;
    };
    ui?: {
      theme?: 'light' | 'dark' | 'auto';
      gamification?: boolean;
    };
  }) {
    return {
      ngModule: WebRTCUILibModule,
      providers: [
        // Provide configuration tokens if needed
        { 
          provide: 'WEBRTC_CONFIG', 
          useValue: config || {} 
        }
      ]
    };
  }
}

/**
 * Standalone components for import without module
 */
export const WEBRTC_STANDALONE_COMPONENTS = [
  // Feature components
  ChatComponent,
  FileTransferComponent,
  RoomListComponent,
  RoomControlsComponent,
  RoomCreationComponent
] as const;

/**
 * Integration services for standalone usage
 */
export const WEBRTC_INTEGRATION_SERVICES = [
  WebRTCAlephClient,
  WebRTCEngine,
  WebRTCOrchestrator
] as const;

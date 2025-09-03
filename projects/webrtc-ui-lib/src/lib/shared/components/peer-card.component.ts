import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { Peer, PeerStatus } from '../../core/models';

/**
 * Base component for displaying peer information
 * Shows peer connection status, media state, and quality metrics
 */
@Component({
  selector: 'wrtc-peer-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="peer-card" [class]="getPeerStatusClass()">
      <div class="peer-header">
        <div class="peer-avatar">
          <img *ngIf="peer.metadata?.avatar" 
               [src]="peer.metadata.avatar" 
               [alt]="peer.displayName"
               class="avatar-image">
          <div *ngIf="!peer.metadata?.avatar" class="avatar-placeholder">
            {{ getInitials(peer.displayName) }}
          </div>
        </div>
        
        <div class="peer-info">
          <h3 class="peer-name">{{ peer.displayName }}</h3>
          <span class="peer-role" *ngIf="peer.role">{{ peer.role }}</span>
          <div class="peer-status">
            <span class="status-indicator" [class]="getConnectionStatusClass()"></span>
            <span class="status-text">{{ getConnectionStatusText() }}</span>
          </div>
        </div>

        <div class="peer-actions">
          <button *ngIf="showMediaControls" 
                  class="btn-icon" 
                  [class.active]="!peer.mediaState.audioMuted"
                  (click)="toggleAudio()"
                  [title]="peer.mediaState.audioMuted ? 'Unmute audio' : 'Mute audio'">
            <svg class="icon" viewBox="0 0 24 24">
              <path *ngIf="!peer.mediaState.audioMuted" d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
              <path *ngIf="peer.mediaState.audioMuted" d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99z"/>
            </svg>
          </button>

          <button *ngIf="showMediaControls" 
                  class="btn-icon" 
                  [class.active]="peer.mediaState.videoEnabled"
                  (click)="toggleVideo()"
                  [title]="peer.mediaState.videoEnabled ? 'Turn off video' : 'Turn on video'">
            <svg class="icon" viewBox="0 0 24 24">
              <path *ngIf="peer.mediaState.videoEnabled" d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
              <path *ngIf="!peer.mediaState.videoEnabled" d="M21 6.5l-4 4V7c0-.55-.45-1-1-1H9.82l-1-1H16c.55 0 1 .45 1 1v3.5l4-4v11zM3.27 2L2 3.27 4.73 6H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.21 0 .39-.08.55-.18L19.73 21 21 19.73 3.27 2z"/>
            </svg>
          </button>

          <button *ngIf="showConnectionControls"
                  class="btn-icon btn-danger"
                  (click)="disconnect()"
                  title="Disconnect peer">
            <svg class="icon" viewBox="0 0 24 24">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>
      </div>

      <div class="peer-media" *ngIf="showVideo && peer.mediaStream">
        <video #videoElement
               [srcObject]="peer.mediaStream"
               autoplay
               playsinline
               muted
               class="peer-video">
        </video>
      </div>

      <div class="peer-stats" *ngIf="showStats && peer.quality">
        <div class="stat-item">
          <span class="stat-label">Signal:</span>
          <span class="stat-value" [class]="'signal-' + peer.quality.signalStrength">
            {{ peer.quality.signalStrength }}
          </span>
        </div>
        <div class="stat-item" *ngIf="peer.quality.rtt">
          <span class="stat-label">Latency:</span>
          <span class="stat-value">{{ peer.quality.rtt }}ms</span>
        </div>
        <div class="stat-item" *ngIf="peer.quality.packetLoss">
          <span class="stat-label">Loss:</span>
          <span class="stat-value">{{ peer.quality.packetLoss }}%</span>
        </div>
      </div>

      <div class="peer-metadata" *ngIf="showMetadata && peer.metadata">
        <div class="metadata-item" *ngFor="let item of getMetadataItems()">
          <span class="metadata-label">{{ item.label }}:</span>
          <span class="metadata-value">{{ item.value }}</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .peer-card {
      background: #fff;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      padding: 16px;
      margin: 8px;
      transition: all 0.3s ease;
      border: 2px solid transparent;
    }

    .peer-card.connected {
      border-color: #4caf50;
    }

    .peer-card.connecting {
      border-color: #ff9800;
    }

    .peer-card.disconnected {
      border-color: #f44336;
      opacity: 0.7;
    }

    .peer-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }

    .peer-avatar {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      overflow: hidden;
      flex-shrink: 0;
    }

    .avatar-image {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .avatar-placeholder {
      width: 100%;
      height: 100%;
      background: #2196f3;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 18px;
    }

    .peer-info {
      flex: 1;
      min-width: 0;
    }

    .peer-name {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: #333;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .peer-role {
      display: inline-block;
      background: #e3f2fd;
      color: #1976d2;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
      margin-top: 4px;
    }

    .peer-status {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 4px;
    }

    .status-indicator {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }

    .status-indicator.connected { background: #4caf50; }
    .status-indicator.connecting { background: #ff9800; }
    .status-indicator.disconnected { background: #f44336; }

    .status-text {
      font-size: 12px;
      color: #666;
    }

    .peer-actions {
      display: flex;
      gap: 8px;
    }

    .btn-icon {
      width: 36px;
      height: 36px;
      border: none;
      border-radius: 6px;
      background: #f5f5f5;
      color: #666;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
    }

    .btn-icon:hover {
      background: #e0e0e0;
      color: #333;
    }

    .btn-icon.active {
      background: #2196f3;
      color: white;
    }

    .btn-icon.btn-danger {
      background: #ffebee;
      color: #f44336;
    }

    .btn-icon.btn-danger:hover {
      background: #f44336;
      color: white;
    }

    .icon {
      width: 20px;
      height: 20px;
      fill: currentColor;
    }

    .peer-video {
      width: 100%;
      height: 200px;
      object-fit: cover;
      border-radius: 6px;
      background: #000;
    }

    .peer-stats {
      display: flex;
      gap: 16px;
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid #eee;
    }

    .stat-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
    }

    .stat-label {
      font-size: 11px;
      color: #999;
      text-transform: uppercase;
    }

    .stat-value {
      font-size: 13px;
      font-weight: 600;
      color: #333;
    }

    .signal-excellent { color: #4caf50; }
    .signal-good { color: #8bc34a; }
    .signal-fair { color: #ff9800; }
    .signal-poor { color: #f44336; }

    .peer-metadata {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid #eee;
    }

    .metadata-item {
      display: flex;
      justify-content: space-between;
      margin-bottom: 4px;
      font-size: 12px;
    }

    .metadata-label {
      color: #666;
      font-weight: 500;
    }

    .metadata-value {
      color: #333;
    }

    @media (max-width: 768px) {
      .peer-card {
        margin: 4px;
        padding: 12px;
      }

      .peer-header {
        gap: 8px;
      }

      .peer-avatar {
        width: 40px;
        height: 40px;
      }

      .peer-name {
        font-size: 14px;
      }

      .peer-stats {
        gap: 12px;
      }
    }
  `]
})
export class PeerCardComponent implements OnInit, OnDestroy {
  @Input() peer!: Peer;
  @Input() showVideo: boolean = true;
  @Input() showStats: boolean = true;
  @Input() showMetadata: boolean = false;
  @Input() showMediaControls: boolean = true;
  @Input() showConnectionControls: boolean = false;

  @Output() audioToggle = new EventEmitter<{ peerId: string; muted: boolean }>();
  @Output() videoToggle = new EventEmitter<{ peerId: string; enabled: boolean }>();
  @Output() peerDisconnect = new EventEmitter<string>();

  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    // Any initialization logic
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Get peer status CSS class
   */
  getPeerStatusClass(): string {
    switch (this.peer.connectionState) {
      case 'connected':
        return 'connected';
      case 'connecting':
      case 'new':
        return 'connecting';
      case 'disconnected':
      case 'failed':
      case 'closed':
        return 'disconnected';
      default:
        return 'connecting';
    }
  }

  /**
   * Get connection status CSS class
   */
  getConnectionStatusClass(): string {
    switch (this.peer.connectionState) {
      case 'connected':
        return 'connected';
      case 'connecting':
      case 'new':
        return 'connecting';
      default:
        return 'disconnected';
    }
  }

  /**
   * Get human-readable connection status
   */
  getConnectionStatusText(): string {
    switch (this.peer.connectionState) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting...';
      case 'new':
        return 'Initializing...';
      case 'disconnected':
        return 'Disconnected';
      case 'failed':
        return 'Connection failed';
      case 'closed':
        return 'Connection closed';
      default:
        return 'Unknown';
    }
  }

  /**
   * Get initials from display name
   */
  getInitials(name: string): string {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .substring(0, 2);
  }

  /**
   * Toggle audio mute/unmute
   */
  toggleAudio(): void {
    this.audioToggle.emit({
      peerId: this.peer.id,
      muted: !this.peer.mediaState.audioMuted
    });
  }

  /**
   * Toggle video on/off
   */
  toggleVideo(): void {
    this.videoToggle.emit({
      peerId: this.peer.id,
      enabled: !this.peer.mediaState.videoEnabled
    });
  }

  /**
   * Disconnect from peer
   */
  disconnect(): void {
    this.peerDisconnect.emit(this.peer.id);
  }

  /**
   * Get metadata items for display
   */
  getMetadataItems(): Array<{ label: string; value: string }> {
    if (!this.peer.metadata) return [];

    return Object.entries(this.peer.metadata)
      .filter(([key, value]) => key !== 'avatar' && value != null)
      .map(([key, value]) => ({
        label: this.formatMetadataLabel(key),
        value: String(value)
      }));
  }

  /**
   * Format metadata label for display
   */
  private formatMetadataLabel(key: string): string {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }
}

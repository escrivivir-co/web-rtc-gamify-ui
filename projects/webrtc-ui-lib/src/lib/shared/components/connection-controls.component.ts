import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable, Subject, BehaviorSubject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

/**
 * Connection status enumeration
 */
export enum ConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  FAILED = 'failed'
}

/**
 * Connection button configuration
 */
export interface ConnectionButton {
  label: string;
  action: string;
  icon?: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  disabled?: boolean;
  loading?: boolean;
}

/**
 * Component for WebRTC connection controls
 * Provides connect/disconnect functionality with status indicators
 */
@Component({
  selector: 'wrtc-connection-controls',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="connection-controls">
      <!-- Connection Status -->
      <div class="connection-status" [class]="'status-' + status">
        <div class="status-indicator">
          <div class="status-icon" [class]="getStatusIconClass()">
            <svg *ngIf="status === 'connected'" class="icon" viewBox="0 0 24 24">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            </svg>
            <svg *ngIf="status === 'disconnected'" class="icon" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
            <svg *ngIf="status === 'connecting' || status === 'reconnecting'" class="icon spinner" viewBox="0 0 24 24">
              <path d="M12 2v4c5.5 0 10 4.5 10 10s-4.5 10-10 10S2 21.5 2 16c0-1.9.5-3.7 1.5-5.2L5 12.3C4.4 13.5 4 14.7 4 16c0 4.4 3.6 8 8 8s8-3.6 8-8-3.6-8-8-8z"/>
            </svg>
            <svg *ngIf="status === 'failed'" class="icon" viewBox="0 0 24 24">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </div>
        </div>
        
        <div class="status-text">
          <div class="status-label">{{ getStatusLabel() }}</div>
          <div class="status-detail" *ngIf="statusDetail">{{ statusDetail }}</div>
        </div>
      </div>

      <!-- Connection Statistics -->
      <div class="connection-stats" *ngIf="showStats && stats">
        <div class="stat-item">
          <span class="stat-label">Peers:</span>
          <span class="stat-value">{{ stats.connectedPeers }}/{{ stats.totalPeers }}</span>
        </div>
        <div class="stat-item" *ngIf="stats.uptime">
          <span class="stat-label">Uptime:</span>
          <span class="stat-value">{{ formatUptime(stats.uptime) }}</span>
        </div>
        <div class="stat-item" *ngIf="stats.quality">
          <span class="stat-label">Quality:</span>
          <span class="stat-value" [class]="'quality-' + stats.quality">{{ stats.quality }}</span>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="connection-actions">
        <!-- Primary action button -->
        <button class="btn-connection primary"
                [class]="getPrimaryButtonClass()"
                [disabled]="isPrimaryButtonDisabled()"
                (click)="onPrimaryAction()">
          
          <!-- Loading spinner -->
          <svg *ngIf="isLoading" class="icon spinner" viewBox="0 0 24 24">
            <path d="M12 2v4c5.5 0 10 4.5 10 10s-4.5 10-10 10S2 21.5 2 16c0-1.9.5-3.7 1.5-5.2L5 12.3C4.4 13.5 4 14.7 4 16c0 4.4 3.6 8 8 8s8-3.6 8-8-3.6-8-8-8z"/>
          </svg>
          
          <!-- Action icon -->
          <svg *ngIf="!isLoading && getPrimaryActionIcon()" class="icon" viewBox="0 0 24 24">
            <path [attr.d]="getPrimaryActionIcon()"/>
          </svg>
          
          <span class="btn-text">{{ getPrimaryButtonText() }}</span>
        </button>

        <!-- Secondary actions -->
        <div class="secondary-actions" *ngIf="secondaryButtons.length > 0">
          <button *ngFor="let button of secondaryButtons"
                  class="btn-secondary"
                  [class]="'btn-' + (button.variant || 'secondary')"
                  [disabled]="button.disabled"
                  (click)="onSecondaryAction(button.action)">
            
            <svg *ngIf="button.loading" class="icon spinner" viewBox="0 0 24 24">
              <path d="M12 2v4c5.5 0 10 4.5 10 10s-4.5 10-10 10S2 21.5 2 16c0-1.9.5-3.7 1.5-5.2L5 12.3C4.4 13.5 4 14.7 4 16c0 4.4 3.6 8 8 8s8-3.6 8-8-3.6-8-8-8z"/>
            </svg>
            
            <svg *ngIf="!button.loading && button.icon" class="icon" viewBox="0 0 24 24">
              <path [attr.d]="button.icon"/>
            </svg>
            
            <span>{{ button.label }}</span>
          </button>
        </div>
      </div>

      <!-- Advanced Options -->
      <div class="advanced-options" *ngIf="showAdvanced && isExpanded">
        <div class="option-group">
          <label class="option-label">Auto-reconnect</label>
          <input type="checkbox" 
                 [checked]="autoReconnect" 
                 (change)="onAutoReconnectChange($event)">
        </div>
        
        <div class="option-group">
          <label class="option-label">Connection timeout</label>
          <select [value]="connectionTimeout" (change)="onTimeoutChange($event)">
            <option value="10000">10 seconds</option>
            <option value="30000">30 seconds</option>
            <option value="60000">60 seconds</option>
          </select>
        </div>
        
        <div class="option-group">
          <label class="option-label">Retry attempts</label>
          <input type="number" 
                 min="1" 
                 max="10" 
                 [value]="maxRetries"
                 (change)="onRetriesChange($event)">
        </div>
      </div>

      <!-- Toggle Advanced -->
      <button *ngIf="showAdvanced" 
              class="btn-toggle-advanced"
              (click)="toggleAdvanced()">
        <span>{{ isExpanded ? 'Hide' : 'Show' }} Advanced Options</span>
        <svg class="icon" [class.rotated]="isExpanded" viewBox="0 0 24 24">
          <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>
        </svg>
      </button>
    </div>
  `,
  styles: [`
    .connection-controls {
      background: #fff;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      border: 1px solid #e0e0e0;
    }

    /* Connection Status */
    .connection-status {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
      padding: 12px;
      border-radius: 6px;
      transition: all 0.3s ease;
    }

    .status-disconnected { background: #ffebee; border-left: 4px solid #f44336; }
    .status-connecting { background: #fff3e0; border-left: 4px solid #ff9800; }
    .status-connected { background: #e8f5e8; border-left: 4px solid #4caf50; }
    .status-reconnecting { background: #e3f2fd; border-left: 4px solid #2196f3; }
    .status-failed { background: #ffebee; border-left: 4px solid #f44336; }

    .status-indicator {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .status-icon {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .status-disconnected .status-icon { background: #f44336; color: white; }
    .status-connecting .status-icon { background: #ff9800; color: white; }
    .status-connected .status-icon { background: #4caf50; color: white; }
    .status-reconnecting .status-icon { background: #2196f3; color: white; }
    .status-failed .status-icon { background: #f44336; color: white; }

    .status-text {
      flex: 1;
    }

    .status-label {
      font-size: 16px;
      font-weight: 600;
      color: #333;
      margin-bottom: 4px;
    }

    .status-detail {
      font-size: 14px;
      color: #666;
    }

    .icon {
      width: 20px;
      height: 20px;
      fill: currentColor;
    }

    .spinner {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    /* Connection Statistics */
    .connection-stats {
      display: flex;
      gap: 20px;
      margin-bottom: 20px;
      padding: 12px;
      background: #f5f5f5;
      border-radius: 6px;
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
      font-weight: 500;
    }

    .stat-value {
      font-size: 14px;
      font-weight: 600;
      color: #333;
    }

    .quality-excellent { color: #4caf50; }
    .quality-good { color: #8bc34a; }
    .quality-fair { color: #ff9800; }
    .quality-poor { color: #f44336; }

    /* Action Buttons */
    .connection-actions {
      margin-bottom: 16px;
    }

    .btn-connection {
      width: 100%;
      padding: 12px 20px;
      border: none;
      border-radius: 6px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: all 0.2s ease;
      margin-bottom: 12px;
    }

    .btn-connection.primary {
      background: #2196f3;
      color: white;
    }

    .btn-connection.primary:hover:not(:disabled) {
      background: #1976d2;
    }

    .btn-connection.danger {
      background: #f44336;
      color: white;
    }

    .btn-connection.danger:hover:not(:disabled) {
      background: #d32f2f;
    }

    .btn-connection:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .btn-text {
      font-weight: 600;
    }

    /* Secondary Actions */
    .secondary-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .btn-secondary {
      flex: 1;
      min-width: 120px;
      padding: 8px 16px;
      border: 1px solid #ddd;
      border-radius: 6px;
      background: white;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      font-size: 14px;
      transition: all 0.2s ease;
    }

    .btn-secondary:hover:not(:disabled) {
      background: #f5f5f5;
      border-color: #bbb;
    }

    .btn-secondary.btn-danger {
      border-color: #f44336;
      color: #f44336;
    }

    .btn-secondary.btn-danger:hover:not(:disabled) {
      background: #f44336;
      color: white;
    }

    .btn-secondary:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    /* Advanced Options */
    .advanced-options {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid #eee;
    }

    .option-group {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }

    .option-label {
      font-size: 14px;
      color: #333;
      font-weight: 500;
    }

    .option-group input,
    .option-group select {
      padding: 6px 8px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
    }

    .btn-toggle-advanced {
      width: 100%;
      padding: 8px;
      border: 1px solid #ddd;
      border-radius: 6px;
      background: white;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 14px;
      color: #666;
      transition: all 0.2s ease;
    }

    .btn-toggle-advanced:hover {
      background: #f5f5f5;
    }

    .btn-toggle-advanced .icon {
      transition: transform 0.2s ease;
    }

    .btn-toggle-advanced .icon.rotated {
      transform: rotate(180deg);
    }

    /* Responsive */
    @media (max-width: 768px) {
      .connection-stats {
        flex-direction: column;
        gap: 12px;
      }

      .stat-item {
        flex-direction: row;
        justify-content: space-between;
      }

      .secondary-actions {
        flex-direction: column;
      }

      .btn-secondary {
        min-width: unset;
      }
    }
  `]
})
export class ConnectionControlsComponent implements OnInit, OnDestroy {
  @Input() status: ConnectionStatus = ConnectionStatus.DISCONNECTED;
  @Input() statusDetail?: string;
  @Input() isLoading: boolean = false;
  @Input() showStats: boolean = true;
  @Input() showAdvanced: boolean = true;
  @Input() autoReconnect: boolean = true;
  @Input() connectionTimeout: number = 30000;
  @Input() maxRetries: number = 3;
  @Input() secondaryButtons: ConnectionButton[] = [];

  @Input() stats?: {
    connectedPeers: number;
    totalPeers: number;
    uptime?: number;
    quality?: 'excellent' | 'good' | 'fair' | 'poor';
  };

  @Output() connect = new EventEmitter<void>();
  @Output() disconnect = new EventEmitter<void>();
  @Output() reconnect = new EventEmitter<void>();
  @Output() secondaryAction = new EventEmitter<string>();
  @Output() settingsChange = new EventEmitter<{
    autoReconnect: boolean;
    connectionTimeout: number;
    maxRetries: number;
  }>();

  isExpanded: boolean = false;
  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    // Component initialization
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Get status icon CSS class
   */
  getStatusIconClass(): string {
    return `status-${this.status}`;
  }

  /**
   * Get status label text
   */
  getStatusLabel(): string {
    switch (this.status) {
      case ConnectionStatus.DISCONNECTED:
        return 'Disconnected';
      case ConnectionStatus.CONNECTING:
        return 'Connecting...';
      case ConnectionStatus.CONNECTED:
        return 'Connected';
      case ConnectionStatus.RECONNECTING:
        return 'Reconnecting...';
      case ConnectionStatus.FAILED:
        return 'Connection Failed';
      default:
        return 'Unknown';
    }
  }

  /**
   * Get primary button CSS class
   */
  getPrimaryButtonClass(): string {
    switch (this.status) {
      case ConnectionStatus.CONNECTED:
        return 'danger';
      case ConnectionStatus.FAILED:
        return 'primary';
      default:
        return 'primary';
    }
  }

  /**
   * Get primary button text
   */
  getPrimaryButtonText(): string {
    if (this.isLoading) {
      switch (this.status) {
        case ConnectionStatus.CONNECTING:
          return 'Connecting...';
        case ConnectionStatus.RECONNECTING:
          return 'Reconnecting...';
        default:
          return 'Please wait...';
      }
    }

    switch (this.status) {
      case ConnectionStatus.DISCONNECTED:
        return 'Connect';
      case ConnectionStatus.CONNECTED:
        return 'Disconnect';
      case ConnectionStatus.FAILED:
        return 'Retry Connection';
      default:
        return 'Connect';
    }
  }

  /**
   * Get primary action icon
   */
  getPrimaryActionIcon(): string | null {
    switch (this.status) {
      case ConnectionStatus.DISCONNECTED:
      case ConnectionStatus.FAILED:
        return 'M8 5v14l11-7z'; // Play icon
      case ConnectionStatus.CONNECTED:
        return 'M6 6h12v12H6z'; // Stop icon
      default:
        return null;
    }
  }

  /**
   * Check if primary button should be disabled
   */
  isPrimaryButtonDisabled(): boolean {
    return this.isLoading || 
           this.status === ConnectionStatus.CONNECTING || 
           this.status === ConnectionStatus.RECONNECTING;
  }

  /**
   * Handle primary action click
   */
  onPrimaryAction(): void {
    switch (this.status) {
      case ConnectionStatus.DISCONNECTED:
      case ConnectionStatus.FAILED:
        this.connect.emit();
        break;
      case ConnectionStatus.CONNECTED:
        this.disconnect.emit();
        break;
    }
  }

  /**
   * Handle secondary action click
   */
  onSecondaryAction(action: string): void {
    if (action === 'reconnect') {
      this.reconnect.emit();
    } else {
      this.secondaryAction.emit(action);
    }
  }

  /**
   * Toggle advanced options
   */
  toggleAdvanced(): void {
    this.isExpanded = !this.isExpanded;
  }

  /**
   * Handle auto-reconnect change
   */
  onAutoReconnectChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.autoReconnect = target.checked;
    this.emitSettingsChange();
  }

  /**
   * Handle timeout change
   */
  onTimeoutChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.connectionTimeout = parseInt(target.value);
    this.emitSettingsChange();
  }

  /**
   * Handle retries change
   */
  onRetriesChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.maxRetries = parseInt(target.value);
    this.emitSettingsChange();
  }

  /**
   * Emit settings change event
   */
  private emitSettingsChange(): void {
    this.settingsChange.emit({
      autoReconnect: this.autoReconnect,
      connectionTimeout: this.connectionTimeout,
      maxRetries: this.maxRetries
    });
  }

  /**
   * Format uptime for display
   */
  formatUptime(uptime: number): string {
    const seconds = Math.floor(uptime / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
}

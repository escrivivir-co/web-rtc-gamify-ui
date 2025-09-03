import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, Signal, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

export interface FileTransferInfo {
  id: string;
  name: string;
  size: number;
  type: string;
  senderId: string;
  senderName: string;
  receiverId?: string;
  receiverName?: string;
  status: 'waiting' | 'sending' | 'receiving' | 'paused' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  speed: number; // bytes per second
  eta: number; // seconds remaining
  chunks: FileChunk[];
  chunkSize: number;
  timestamp: Date;
  isIncoming: boolean;
}

export interface FileChunk {
  index: number;
  size: number;
  status: 'pending' | 'sending' | 'sent' | 'received' | 'failed';
  data?: ArrayBuffer;
  checksum?: string;
}

export interface TransferSettings {
  chunkSize: number;
  maxConcurrentTransfers: number;
  autoAcceptFromTrusted: boolean;
  saveLocation: 'downloads' | 'custom';
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
}

@Component({
  selector: 'webrtc-file-transfer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="file-transfer-container" [class.minimized]="isMinimized">
      
      <!-- Header -->
      <div class="transfer-header">
        <div class="header-title">
          <span class="icon">📁</span>
          <span class="title">File Transfers</span>
          <span class="transfer-count" *ngIf="activeTransfers().length > 0">
            ({{ activeTransfers().length }})
          </span>
        </div>
        
        <div class="header-controls">
          <button type="button" 
                  class="header-btn"
                  (click)="openFileSelector()"
                  [disabled]="disabled"
                  title="Send Files">
            <span class="icon">📤</span>
          </button>
          
          <button type="button" 
                  class="header-btn"
                  (click)="toggleSettings()"
                  [class.active]="showSettings"
                  title="Settings">
            <span class="icon">⚙️</span>
          </button>
          
          <button type="button" 
                  class="header-btn"
                  (click)="toggleMinimize()"
                  title="{{ isMinimized ? 'Expand' : 'Minimize' }}">
            <span class="icon">{{ isMinimized ? '⬆️' : '⬇️' }}</span>
          </button>
          
          <button type="button" 
                  class="header-btn"
                  (click)="clearCompleted()"
                  [disabled]="completedTransfers().length === 0"
                  title="Clear Completed">
            <span class="icon">🗑️</span>
          </button>
        </div>
      </div>

      <!-- Content -->
      <div class="transfer-content" *ngIf="!isMinimized">
        
        <!-- Settings Panel -->
        <div class="settings-panel" *ngIf="showSettings">
          <h4>Transfer Settings</h4>
          
          <div class="settings-group">
            <div class="setting-item">
              <label for="chunk-size">Chunk Size</label>
              <select id="chunk-size" 
                      [(ngModel)]="settings.chunkSize"
                      (change)="onSettingsChange()">
                <option [value]="16384">16 KB</option>
                <option [value]="32768">32 KB</option>
                <option [value]="65536">64 KB</option>
                <option [value]="131072">128 KB</option>
                <option [value]="262144">256 KB</option>
              </select>
            </div>
            
            <div class="setting-item">
              <label for="max-transfers">Max Concurrent Transfers</label>
              <select id="max-transfers" 
                      [(ngModel)]="settings.maxConcurrentTransfers"
                      (change)="onSettingsChange()">
                <option [value]="1">1</option>
                <option [value]="2">2</option>
                <option [value]="3">3</option>
                <option [value]="5">5</option>
              </select>
            </div>
          </div>

          <div class="settings-group">
            <div class="setting-item">
              <label class="checkbox-label">
                <input type="checkbox" 
                       [(ngModel)]="settings.autoAcceptFromTrusted"
                       (change)="onSettingsChange()">
                <span class="checkmark"></span>
                Auto-accept from trusted users
              </label>
            </div>
            
            <div class="setting-item">
              <label class="checkbox-label">
                <input type="checkbox" 
                       [(ngModel)]="settings.compressionEnabled"
                       (change)="onSettingsChange()">
                <span class="checkmark"></span>
                Enable compression
              </label>
            </div>
            
            <div class="setting-item">
              <label class="checkbox-label">
                <input type="checkbox" 
                       [(ngModel)]="settings.encryptionEnabled"
                       (change)="onSettingsChange()">
                <span class="checkmark"></span>
                Enable encryption
              </label>
            </div>
          </div>
        </div>

        <!-- Transfer Statistics -->
        <div class="transfer-stats" *ngIf="transfers().length > 0">
          <div class="stats-grid">
            <div class="stat-item">
              <span class="stat-label">Active:</span>
              <span class="stat-value">{{ activeTransfers().length }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Completed:</span>
              <span class="stat-value">{{ completedTransfers().length }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Total Speed:</span>
              <span class="stat-value">{{ formatSpeed(totalSpeed()) }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Queue:</span>
              <span class="stat-value">{{ queuedTransfers().length }}</span>
            </div>
          </div>
        </div>

        <!-- Transfer List -->
        <div class="transfer-list">
          <!-- No transfers placeholder -->
          <div class="no-transfers" *ngIf="transfers().length === 0">
            <span class="icon">📭</span>
            <p>No file transfers</p>
            <button type="button" 
                    class="start-transfer-btn"
                    (click)="openFileSelector()"
                    [disabled]="disabled">
              Send Files
            </button>
          </div>

          <!-- Transfer items -->
          <div *ngFor="let transfer of transfers(); trackBy: trackTransfer" 
               class="transfer-item"
               [class.incoming]="transfer.isIncoming"
               [class.outgoing]="!transfer.isIncoming"
               [class]="'status-' + transfer.status">
            
            <div class="transfer-icon">
              <span class="file-type-icon">{{ getFileIcon(transfer.type) }}</span>
              <span class="direction-icon" 
                    [class.incoming]="transfer.isIncoming"
                    [class.outgoing]="!transfer.isIncoming">
                {{ transfer.isIncoming ? '⬇️' : '⬆️' }}
              </span>
            </div>

            <div class="transfer-info">
              <div class="file-name">{{ transfer.name }}</div>
              <div class="file-details">
                <span class="file-size">{{ formatFileSize(transfer.size) }}</span>
                <span class="separator">•</span>
                <span class="transfer-user">
                  {{ transfer.isIncoming ? 'from ' + transfer.senderName : 'to ' + (transfer.receiverName || 'peer') }}
                </span>
              </div>
              <div class="transfer-status">
                <span class="status-text">{{ getStatusText(transfer) }}</span>
                <span class="transfer-time">{{ formatTime(transfer.timestamp) }}</span>
              </div>
            </div>

            <div class="transfer-progress" *ngIf="isActiveTransfer(transfer)">
              <div class="progress-info">
                <span class="progress-percent">{{ transfer.progress.toFixed(1) }}%</span>
                <span class="transfer-speed">{{ formatSpeed(transfer.speed) }}</span>
                <span class="eta" *ngIf="transfer.eta > 0">{{ formatETA(transfer.eta) }}</span>
              </div>
              
              <div class="progress-bar">
                <div class="progress-fill" 
                     [style.width.%]="transfer.progress">
                </div>
              </div>

              <!-- Chunk progress for debugging -->
              <div class="chunks-progress" *ngIf="showChunkProgress">
                <div *ngFor="let chunk of transfer.chunks" 
                     class="chunk-indicator"
                     [class]="'chunk-' + chunk.status"
                     [title]="'Chunk ' + chunk.index + ': ' + chunk.status">
                </div>
              </div>
            </div>

            <div class="transfer-actions">
              <!-- Incoming transfer actions -->
              <div *ngIf="transfer.isIncoming && transfer.status === 'waiting'" 
                   class="incoming-actions">
                <button type="button" 
                        class="action-btn accept-btn"
                        (click)="acceptTransfer(transfer)"
                        [disabled]="disabled">
                  ✓ Accept
                </button>
                <button type="button" 
                        class="action-btn reject-btn"
                        (click)="rejectTransfer(transfer)"
                        [disabled]="disabled">
                  ✗ Reject
                </button>
              </div>

              <!-- Active transfer actions -->
              <div *ngIf="isActiveTransfer(transfer)" class="active-actions">
                <button type="button" 
                        class="action-btn pause-btn"
                        (click)="pauseTransfer(transfer)"
                        [disabled]="disabled"
                        *ngIf="transfer.status !== 'paused'">
                  ⏸️ Pause
                </button>
                <button type="button" 
                        class="action-btn resume-btn"
                        (click)="resumeTransfer(transfer)"
                        [disabled]="disabled"
                        *ngIf="transfer.status === 'paused'">
                  ▶️ Resume
                </button>
                <button type="button" 
                        class="action-btn cancel-btn"
                        (click)="cancelTransfer(transfer)"
                        [disabled]="disabled">
                  ❌ Cancel
                </button>
              </div>

              <!-- Completed transfer actions -->
              <div *ngIf="transfer.status === 'completed'" class="completed-actions">
                <button type="button" 
                        class="action-btn open-btn"
                        (click)="openFile(transfer)"
                        *ngIf="transfer.isIncoming">
                  📂 Open
                </button>
                <button type="button" 
                        class="action-btn remove-btn"
                        (click)="removeTransfer(transfer)">
                  🗑️ Remove
                </button>
              </div>

              <!-- Failed transfer actions -->
              <div *ngIf="transfer.status === 'failed'" class="failed-actions">
                <button type="button" 
                        class="action-btn retry-btn"
                        (click)="retryTransfer(transfer)"
                        [disabled]="disabled">
                  🔄 Retry
                </button>
                <button type="button" 
                        class="action-btn remove-btn"
                        (click)="removeTransfer(transfer)">
                  🗑️ Remove
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Drop Zone -->
        <div class="drop-zone" 
             (dragover)="onDragOver($event)"
             (dragleave)="onDragLeave($event)"
             (drop)="onFileDrop($event)"
             [class.drag-active]="isDragActive"
             *ngIf="!disabled">
          <div class="drop-content" *ngIf="isDragActive">
            <span class="drop-icon">📁</span>
            <p>Drop files here to send</p>
          </div>
        </div>
      </div>

      <!-- File input -->
      <input type="file" 
             #fileInput
             multiple
             (change)="onFileSelect($event)"
             style="display: none;">
    </div>
  `,
  styles: [`
    .file-transfer-container {
      background: #ffffff;
      border: 1px solid #e0e0e0;
      border-radius: 12px;
      display: flex;
      flex-direction: column;
      height: 500px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      position: relative;
      overflow: hidden;
    }

    .file-transfer-container.minimized {
      height: 50px;
    }

    .transfer-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      background: #f8f9fa;
      border-bottom: 1px solid #e0e0e0;
      border-radius: 12px 12px 0 0;
    }

    .header-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
      color: #333;
    }

    .transfer-count {
      font-size: 12px;
      color: #666;
      font-weight: normal;
    }

    .header-controls {
      display: flex;
      gap: 4px;
    }

    .header-btn {
      width: 32px;
      height: 32px;
      border: none;
      border-radius: 6px;
      background: transparent;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      font-size: 14px;
    }

    .header-btn:hover:not(:disabled) {
      background: #e9ecef;
    }

    .header-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .header-btn.active {
      background: #007bff;
      color: white;
    }

    .transfer-content {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
    }

    .settings-panel {
      padding: 16px;
      background: #f8f9fa;
      border-bottom: 1px solid #e0e0e0;
    }

    .settings-panel h4 {
      margin: 0 0 16px 0;
      font-size: 14px;
      color: #333;
    }

    .settings-group {
      margin-bottom: 16px;
    }

    .setting-item {
      margin-bottom: 12px;
    }

    .setting-item label:not(.checkbox-label) {
      display: block;
      font-size: 12px;
      font-weight: 600;
      color: #333;
      margin-bottom: 4px;
    }

    .setting-item select {
      width: 100%;
      padding: 6px 8px;
      border: 1px solid #d0d0d0;
      border-radius: 4px;
      font-size: 12px;
    }

    .checkbox-label {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      font-size: 12px;
    }

    .transfer-stats {
      padding: 12px 16px;
      background: #f8f9fa;
      border-bottom: 1px solid #e0e0e0;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
    }

    .stat-item {
      text-align: center;
    }

    .stat-label {
      display: block;
      font-size: 11px;
      color: #666;
      margin-bottom: 2px;
    }

    .stat-value {
      display: block;
      font-size: 14px;
      font-weight: 600;
      color: #333;
    }

    .transfer-list {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
    }

    .no-transfers {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 200px;
      color: #666;
      text-align: center;
    }

    .no-transfers .icon {
      font-size: 48px;
      margin-bottom: 16px;
      opacity: 0.5;
    }

    .start-transfer-btn {
      padding: 10px 20px;
      border: 1px solid #007bff;
      border-radius: 6px;
      background: #007bff;
      color: white;
      cursor: pointer;
      transition: all 0.2s ease;
      margin-top: 12px;
    }

    .start-transfer-btn:hover:not(:disabled) {
      background: #0056b3;
    }

    .transfer-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      background: #ffffff;
      margin-bottom: 8px;
      transition: all 0.2s ease;
    }

    .transfer-item:hover {
      border-color: #007bff;
      box-shadow: 0 2px 4px rgba(0, 123, 255, 0.1);
    }

    .transfer-item.incoming {
      border-left: 4px solid #28a745;
    }

    .transfer-item.outgoing {
      border-left: 4px solid #007bff;
    }

    .transfer-item.status-completed {
      background: #f8f9fa;
      border-color: #28a745;
    }

    .transfer-item.status-failed {
      background: #fff5f5;
      border-color: #dc3545;
    }

    .transfer-item.status-cancelled {
      background: #f8f9fa;
      border-color: #6c757d;
    }

    .transfer-icon {
      position: relative;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .file-type-icon {
      font-size: 24px;
    }

    .direction-icon {
      position: absolute;
      bottom: -2px;
      right: -2px;
      font-size: 12px;
      background: white;
      border-radius: 50%;
      width: 16px;
      height: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid #e0e0e0;
    }

    .direction-icon.incoming {
      color: #28a745;
    }

    .direction-icon.outgoing {
      color: #007bff;
    }

    .transfer-info {
      flex: 1;
      min-width: 0;
    }

    .file-name {
      font-size: 14px;
      font-weight: 500;
      color: #333;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      margin-bottom: 2px;
    }

    .file-details {
      font-size: 12px;
      color: #666;
      margin-bottom: 2px;
    }

    .separator {
      margin: 0 4px;
    }

    .transfer-status {
      font-size: 11px;
      color: #999;
      display: flex;
      justify-content: space-between;
    }

    .transfer-progress {
      min-width: 120px;
    }

    .progress-info {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
      color: #666;
      margin-bottom: 4px;
    }

    .progress-bar {
      width: 100%;
      height: 6px;
      background: #e9ecef;
      border-radius: 3px;
      overflow: hidden;
      margin-bottom: 4px;
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #007bff, #28a745);
      transition: width 0.3s ease;
    }

    .chunks-progress {
      display: flex;
      gap: 1px;
      margin-top: 4px;
    }

    .chunk-indicator {
      width: 3px;
      height: 3px;
      border-radius: 1px;
      background: #e9ecef;
    }

    .chunk-pending { background: #e9ecef; }
    .chunk-sending { background: #ffc107; }
    .chunk-sent { background: #007bff; }
    .chunk-received { background: #28a745; }
    .chunk-failed { background: #dc3545; }

    .transfer-actions {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 80px;
    }

    .incoming-actions, .active-actions, .completed-actions, .failed-actions {
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
    }

    .action-btn {
      padding: 4px 8px;
      border: 1px solid #d0d0d0;
      border-radius: 4px;
      background: #ffffff;
      cursor: pointer;
      transition: all 0.2s ease;
      font-size: 10px;
      white-space: nowrap;
    }

    .action-btn:hover:not(:disabled) {
      background: #f8f9fa;
    }

    .action-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .accept-btn {
      background: #28a745;
      border-color: #28a745;
      color: white;
    }

    .accept-btn:hover:not(:disabled) {
      background: #1e7e34;
    }

    .reject-btn, .cancel-btn {
      background: #dc3545;
      border-color: #dc3545;
      color: white;
    }

    .reject-btn:hover:not(:disabled), .cancel-btn:hover:not(:disabled) {
      background: #c82333;
    }

    .retry-btn {
      background: #ffc107;
      border-color: #ffc107;
      color: #212529;
    }

    .retry-btn:hover:not(:disabled) {
      background: #e0a800;
    }

    .drop-zone {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 123, 255, 0.1);
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s ease;
    }

    .drop-zone.drag-active {
      opacity: 1;
      pointer-events: all;
    }

    .drop-content {
      text-align: center;
      color: #007bff;
    }

    .drop-icon {
      font-size: 48px;
      display: block;
      margin-bottom: 16px;
    }

    @media (max-width: 768px) {
      .file-transfer-container {
        height: 100vh;
        border-radius: 0;
      }

      .stats-grid {
        grid-template-columns: repeat(2, 1fr);
      }

      .transfer-item {
        flex-direction: column;
        align-items: stretch;
        gap: 8px;
      }

      .transfer-progress {
        min-width: auto;
      }

      .transfer-actions {
        flex-direction: row;
        justify-content: center;
      }
    }
  `]
})
export class FileTransferComponent implements OnInit, OnDestroy {
  @Input() disabled = false;
  @Input() maxFileSize = 100 * 1024 * 1024; // 100MB default
  @Input() allowedFileTypes: string[] = ['*'];

  @Input() settings: TransferSettings = {
    chunkSize: 65536, // 64KB
    maxConcurrentTransfers: 2,
    autoAcceptFromTrusted: false,
    saveLocation: 'downloads',
    compressionEnabled: false,
    encryptionEnabled: false
  };

  @Output() filesSend = new EventEmitter<File[]>();
  @Output() transferAccept = new EventEmitter<FileTransferInfo>();
  @Output() transferReject = new EventEmitter<FileTransferInfo>();
  @Output() transferCancel = new EventEmitter<FileTransferInfo>();
  @Output() transferPause = new EventEmitter<FileTransferInfo>();
  @Output() transferResume = new EventEmitter<FileTransferInfo>();
  @Output() settingsChange = new EventEmitter<TransferSettings>();

  // Signals for reactive state
  private _transfers = signal<FileTransferInfo[]>([]);

  // Component state
  isMinimized = false;
  showSettings = false;
  isDragActive = false;
  showChunkProgress = false;

  // Computed signals
  transfers = computed(() => this._transfers());
  activeTransfers = computed(() => 
    this.transfers().filter(t => ['sending', 'receiving'].includes(t.status))
  );
  completedTransfers = computed(() => 
    this.transfers().filter(t => t.status === 'completed')
  );
  queuedTransfers = computed(() => 
    this.transfers().filter(t => t.status === 'waiting')
  );
  totalSpeed = computed(() => 
    this.activeTransfers().reduce((sum, t) => sum + t.speed, 0)
  );

  private subscriptions = new Subscription();

  ngOnInit(): void {
    // Initialize component
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  /**
   * Add a new transfer
   */
  addTransfer(transfer: FileTransferInfo): void {
    const currentTransfers = this._transfers();
    this._transfers.set([...currentTransfers, transfer]);
  }

  /**
   * Update transfer progress
   */
  updateTransfer(transferId: string, updates: Partial<FileTransferInfo>): void {
    const transfers = this._transfers();
    const index = transfers.findIndex(t => t.id === transferId);
    if (index !== -1) {
      const updatedTransfer = { ...transfers[index], ...updates };
      const newTransfers = [...transfers];
      newTransfers[index] = updatedTransfer;
      this._transfers.set(newTransfers);
    }
  }

  /**
   * Remove transfer
   */
  removeTransfer(transfer: FileTransferInfo): void {
    const transfers = this._transfers().filter(t => t.id !== transfer.id);
    this._transfers.set(transfers);
  }

  /**
   * Open file selector
   */
  openFileSelector(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    if (this.allowedFileTypes.length > 0 && !this.allowedFileTypes.includes('*')) {
      input.accept = this.allowedFileTypes.join(',');
    }
    input.onchange = (event) => {
      const target = event.target as HTMLInputElement;
      if (target.files) {
        this.handleFiles(Array.from(target.files));
      }
    };
    input.click();
  }

  /**
   * Handle file selection
   */
  onFileSelect(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target.files) {
      this.handleFiles(Array.from(target.files));
    }
  }

  /**
   * Handle drag over
   */
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragActive = true;
  }

  /**
   * Handle drag leave
   */
  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragActive = false;
  }

  /**
   * Handle file drop
   */
  onFileDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragActive = false;
    
    if (event.dataTransfer?.files) {
      this.handleFiles(Array.from(event.dataTransfer.files));
    }
  }

  /**
   * Handle selected files
   */
  private handleFiles(files: File[]): void {
    const validFiles = files.filter(file => {
      if (file.size > this.maxFileSize) {
        console.warn(`File ${file.name} is too large`);
        return false;
      }
      return true;
    });

    if (validFiles.length > 0) {
      this.filesSend.emit(validFiles);
      
      // Create transfer entries
      validFiles.forEach(file => {
        const transfer = this.createTransferInfo(file, false);
        this.addTransfer(transfer);
      });
    }
  }

  /**
   * Accept incoming transfer
   */
  acceptTransfer(transfer: FileTransferInfo): void {
    this.updateTransfer(transfer.id, { status: 'receiving' });
    this.transferAccept.emit(transfer);
  }

  /**
   * Reject incoming transfer
   */
  rejectTransfer(transfer: FileTransferInfo): void {
    this.updateTransfer(transfer.id, { status: 'cancelled' });
    this.transferReject.emit(transfer);
  }

  /**
   * Pause transfer
   */
  pauseTransfer(transfer: FileTransferInfo): void {
    this.updateTransfer(transfer.id, { status: 'paused' });
    this.transferPause.emit(transfer);
  }

  /**
   * Resume transfer
   */
  resumeTransfer(transfer: FileTransferInfo): void {
    const newStatus = transfer.isIncoming ? 'receiving' : 'sending';
    this.updateTransfer(transfer.id, { status: newStatus });
    this.transferResume.emit(transfer);
  }

  /**
   * Cancel transfer
   */
  cancelTransfer(transfer: FileTransferInfo): void {
    this.updateTransfer(transfer.id, { status: 'cancelled' });
    this.transferCancel.emit(transfer);
  }

  /**
   * Retry failed transfer
   */
  retryTransfer(transfer: FileTransferInfo): void {
    const newStatus = transfer.isIncoming ? 'receiving' : 'sending';
    this.updateTransfer(transfer.id, { 
      status: newStatus, 
      progress: 0,
      speed: 0,
      eta: 0
    });
  }

  /**
   * Open completed file
   */
  openFile(transfer: FileTransferInfo): void {
    // This would open the file in the default application
    console.log(`Opening file: ${transfer.name}`);
  }

  /**
   * Clear completed transfers
   */
  clearCompleted(): void {
    const transfers = this._transfers().filter(t => t.status !== 'completed');
    this._transfers.set(transfers);
  }

  /**
   * Toggle minimization
   */
  toggleMinimize(): void {
    this.isMinimized = !this.isMinimized;
  }

  /**
   * Toggle settings panel
   */
  toggleSettings(): void {
    this.showSettings = !this.showSettings;
  }

  /**
   * Handle settings change
   */
  onSettingsChange(): void {
    this.settingsChange.emit({ ...this.settings });
  }

  /**
   * Check if transfer is active
   */
  isActiveTransfer(transfer: FileTransferInfo): boolean {
    return ['sending', 'receiving'].includes(transfer.status);
  }

  /**
   * Get status text
   */
  getStatusText(transfer: FileTransferInfo): string {
    switch (transfer.status) {
      case 'waiting': return transfer.isIncoming ? 'Waiting for acceptance' : 'Waiting to send';
      case 'sending': return 'Sending...';
      case 'receiving': return 'Receiving...';
      case 'paused': return 'Paused';
      case 'completed': return 'Completed';
      case 'failed': return 'Failed';
      case 'cancelled': return 'Cancelled';
      default: return 'Unknown';
    }
  }

  /**
   * Get file icon
   */
  getFileIcon(mimeType: string): string {
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType.startsWith('video/')) return '🎥';
    if (mimeType.startsWith('audio/')) return '🎵';
    if (mimeType.includes('pdf')) return '📄';
    if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return '📊';
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '📈';
    if (mimeType.includes('zip') || mimeType.includes('archive')) return '📦';
    return '📁';
  }

  /**
   * Format file size
   */
  formatFileSize(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Format transfer speed
   */
  formatSpeed(bytesPerSecond: number): string {
    if (bytesPerSecond === 0) return '0 B/s';
    const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    const i = Math.floor(Math.log(bytesPerSecond) / Math.log(1024));
    return Math.round(bytesPerSecond / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Format ETA
   */
  formatETA(seconds: number): string {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${Math.round(seconds / 3600)}h`;
  }

  /**
   * Format timestamp
   */
  formatTime(date: Date): string {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  /**
   * Track transfers for ngFor
   */
  trackTransfer(index: number, transfer: FileTransferInfo): string {
    return transfer.id;
  }

  /**
   * Create transfer info from file
   */
  private createTransferInfo(file: File, isIncoming: boolean): FileTransferInfo {
    const chunkCount = Math.ceil(file.size / this.settings.chunkSize);
    const chunks: FileChunk[] = Array.from({ length: chunkCount }, (_, index) => ({
      index,
      size: index === chunkCount - 1 ? 
        file.size - (index * this.settings.chunkSize) : 
        this.settings.chunkSize,
      status: 'pending'
    }));

    return {
      id: this.generateTransferId(),
      name: file.name,
      size: file.size,
      type: file.type,
      senderId: isIncoming ? 'peer' : 'self',
      senderName: isIncoming ? 'Peer' : 'You',
      status: 'waiting',
      progress: 0,
      speed: 0,
      eta: 0,
      chunks,
      chunkSize: this.settings.chunkSize,
      timestamp: new Date(),
      isIncoming
    };
  }

  /**
   * Generate unique transfer ID
   */
  private generateTransferId(): string {
    return `transfer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

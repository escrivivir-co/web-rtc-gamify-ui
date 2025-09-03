import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, Signal, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';

export interface ScreenShareSettings {
  enabled: boolean;
  source: 'screen' | 'window' | 'tab';
  includeAudio: boolean;
  cursor: 'always' | 'motion' | 'never';
  width: number;
  height: number;
  frameRate: number;
}

export interface ScreenSource {
  id: string;
  name: string;
  type: 'screen' | 'window' | 'tab';
  thumbnail?: string;
}

export interface ScreenShareQualityPreset {
  name: string;
  width: number;
  height: number;
  frameRate: number;
  description: string;
}

@Component({
  selector: 'webrtc-screen-share',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="screen-share-controls">
      <!-- Main Screen Share Control -->
      <div class="screen-share-header">
        <div class="share-status">
          <div class="share-indicator" 
               [class.active]="settings.enabled">
            <span class="icon">🖥️</span>
          </div>
          <div class="share-info" *ngIf="settings.enabled">
            <span class="source-type">{{ getSourceTypeLabel() }}</span>
            <span class="resolution">{{ settings.width }}x{{ settings.height }}</span>
            <span class="fps">{{ settings.frameRate }}fps</span>
          </div>
        </div>
        
        <div class="main-controls">
          <button type="button" 
                  class="control-btn start-share"
                  [class.active]="settings.enabled"
                  (click)="toggleScreenShare()"
                  [disabled]="disabled">
            <span class="icon">{{ settings.enabled ? '⏹️' : '🖥️' }}</span>
            <span class="label">{{ settings.enabled ? 'Stop Sharing' : 'Share Screen' }}</span>
          </button>
          
          <button type="button" 
                  class="control-btn select-source"
                  (click)="selectSource()"
                  [disabled]="disabled || settings.enabled">
            <span class="icon">🎯</span>
            <span class="label">Select Source</span>
          </button>
        </div>
      </div>

      <!-- Source Selection -->
      <div class="source-selection" *ngIf="showSourceSelection && !settings.enabled">
        <h4>Select Screen Source</h4>
        
        <div class="source-tabs">
          <button type="button" 
                  *ngFor="let type of sourceTypes" 
                  class="source-tab"
                  [class.active]="selectedSourceType === type"
                  (click)="selectSourceType(type)"
                  [disabled]="disabled">
            {{ getSourceTypeLabel(type) }}
          </button>
        </div>

        <div class="source-grid" *ngIf="availableSources().length > 0">
          <div *ngFor="let source of filteredSources()" 
               class="source-item"
               [class.selected]="selectedSource()?.id === source.id"
               (click)="selectSourceItem(source)">
            <div class="source-thumbnail">
              <img *ngIf="source.thumbnail" 
                   [src]="source.thumbnail" 
                   [alt]="source.name"
                   class="thumbnail-image">
              <div *ngIf="!source.thumbnail" class="thumbnail-placeholder">
                <span class="icon">{{ getSourceIcon(source.type) }}</span>
              </div>
            </div>
            <div class="source-name">{{ source.name }}</div>
            <div class="source-type">{{ getSourceTypeLabel(source.type) }}</div>
          </div>
        </div>

        <div class="source-actions">
          <button type="button" 
                  class="action-btn refresh-sources"
                  (click)="refreshSources()"
                  [disabled]="disabled">
            <span class="icon">🔄</span>
            Refresh Sources
          </button>
          
          <button type="button" 
                  class="action-btn confirm-source"
                  [disabled]="!selectedSource || disabled"
                  (click)="confirmSourceSelection()">
            <span class="icon">✓</span>
            Select Source
          </button>
        </div>
      </div>

      <!-- Quality Settings -->
      <div class="quality-settings" *ngIf="showAdvanced">
        <h4>Quality Settings</h4>
        
        <div class="preset-buttons">
          <button type="button" 
                  *ngFor="let preset of qualityPresets" 
                  class="preset-btn"
                  [class.active]="isPresetActive(preset)"
                  (click)="applyQualityPreset(preset)"
                  [disabled]="disabled">
            <div class="preset-name">{{ preset.name }}</div>
            <div class="preset-specs">{{ preset.width }}x{{ preset.height }} @ {{ preset.frameRate }}fps</div>
          </button>
        </div>

        <div class="custom-quality" *ngIf="showCustomQuality">
          <div class="quality-row">
            <div class="quality-item">
              <label for="width">Width</label>
              <input type="number" 
                     id="width"
                     class="quality-input"
                     [value]="settings.width"
                     min="320"
                     max="3840"
                     step="1"
                     (input)="onWidthChange($event)"
                     [disabled]="disabled">
            </div>
            
            <div class="quality-item">
              <label for="height">Height</label>
              <input type="number" 
                     id="height"
                     class="quality-input"
                     [value]="settings.height"
                     min="240"
                     max="2160"
                     step="1"
                     (input)="onHeightChange($event)"
                     [disabled]="disabled">
            </div>
            
            <div class="quality-item">
              <label for="frame-rate">Frame Rate</label>
              <select id="frame-rate" 
                      class="quality-select"
                      [value]="settings.frameRate"
                      (change)="onFrameRateChange($event)"
                      [disabled]="disabled">
                <option value="15">15 fps</option>
                <option value="24">24 fps</option>
                <option value="30">30 fps</option>
                <option value="60">60 fps</option>
              </select>
            </div>
          </div>
          
          <button type="button" 
                  class="toggle-custom-btn"
                  (click)="toggleCustomQuality()">
            {{ showCustomQuality ? 'Hide Custom' : 'Custom Quality' }}
          </button>
        </div>
      </div>

      <!-- Advanced Options -->
      <div class="advanced-options" *ngIf="showAdvanced">
        <h4>Advanced Options</h4>
        
        <div class="option-group">
          <div class="option-item">
            <label class="checkbox-label">
              <input type="checkbox" 
                     [checked]="settings.includeAudio"
                     (change)="onIncludeAudioChange($event)"
                     [disabled]="disabled">
              <span class="checkmark"></span>
              Include System Audio
            </label>
            <span class="option-description">Share computer audio along with screen</span>
          </div>
        </div>

        <div class="option-group">
          <div class="option-item">
            <label for="cursor-option">Cursor Display</label>
            <select id="cursor-option" 
                    class="option-select"
                    [value]="settings.cursor"
                    (change)="onCursorChange($event)"
                    [disabled]="disabled">
              <option value="always">Always Show</option>
              <option value="motion">Show on Motion</option>
              <option value="never">Never Show</option>
            </select>
            <span class="option-description">How to display the mouse cursor</span>
          </div>
        </div>
      </div>

      <!-- Preview -->
      <div class="screen-preview" *ngIf="settings.enabled && showPreview">
        <h4>Screen Share Preview</h4>
        <div class="preview-container">
          <video #previewVideo 
                 class="preview-video"
                 [muted]="true"
                 autoplay
                 playsinline>
          </video>
          <div class="preview-overlay">
            <div class="preview-info">
              <span class="preview-resolution">{{ settings.width }}x{{ settings.height }}</span>
              <span class="preview-fps">{{ settings.frameRate }}fps</span>
              <span class="preview-source">{{ selectedSource?.name }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Screen Share Statistics -->
      <div class="share-stats" *ngIf="showStats && settings.enabled">
        <h4>Share Statistics</h4>
        <div class="stats-grid">
          <div class="stat-item">
            <span class="stat-label">Resolution:</span>
            <span class="stat-value">{{ settings.width }}x{{ settings.height }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Frame Rate:</span>
            <span class="stat-value">{{ settings.frameRate }} fps</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Source:</span>
            <span class="stat-value">{{ getSourceTypeLabel() }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Audio:</span>
            <span class="stat-value">{{ settings.includeAudio ? 'Included' : 'None' }}</span>
          </div>
        </div>
      </div>

      <!-- Controls Footer -->
      <div class="controls-footer">
        <button type="button" 
                class="toggle-advanced-btn"
                (click)="toggleAdvanced()">
          <span class="icon">{{ showAdvanced ? '▼' : '▶' }}</span>
          {{ showAdvanced ? 'Hide Advanced' : 'Show Advanced' }}
        </button>
        
        <button type="button" 
                class="toggle-preview-btn"
                (click)="togglePreview()"
                *ngIf="settings.enabled">
          <span class="icon">👁️</span>
          {{ showPreview ? 'Hide Preview' : 'Show Preview' }}
        </button>
        
        <button type="button" 
                class="toggle-stats-btn"
                (click)="toggleStats()"
                *ngIf="showAdvanced">
          <span class="icon">📊</span>
          {{ showStats ? 'Hide Stats' : 'Show Stats' }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .screen-share-controls {
      background: #ffffff;
      border: 1px solid #e0e0e0;
      border-radius: 12px;
      padding: 20px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    .screen-share-header {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 16px;
      padding-bottom: 16px;
      border-bottom: 1px solid #f0f0f0;
    }

    .share-status {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .share-indicator {
      width: 48px;
      height: 48px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f5f5f5;
      border: 2px solid #e0e0e0;
      transition: all 0.3s ease;
    }

    .share-indicator.active {
      background: #e8f5e8;
      border-color: #4caf50;
      color: #4caf50;
      animation: pulse 2s ease-in-out infinite;
    }

    .share-indicator .icon {
      font-size: 20px;
    }

    .share-info {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 12px;
      color: #666;
    }

    .source-type {
      font-weight: 600;
      color: #333;
    }

    .main-controls {
      display: flex;
      gap: 12px;
    }

    .control-btn {
      padding: 12px 20px;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      background: #ffffff;
      cursor: pointer;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      font-weight: 500;
    }

    .control-btn:hover:not(:disabled) {
      background: #f5f5f5;
      border-color: #d0d0d0;
    }

    .control-btn.active {
      background: #e8f5e8;
      border-color: #4caf50;
      color: #4caf50;
    }

    .control-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .source-selection {
      margin-bottom: 16px;
      padding: 16px;
      background: #f9f9f9;
      border-radius: 8px;
    }

    .source-selection h4 {
      margin: 0 0 16px 0;
      color: #333;
      font-size: 16px;
    }

    .source-tabs {
      display: flex;
      gap: 8px;
      margin-bottom: 16px;
    }

    .source-tab {
      padding: 8px 16px;
      border: 1px solid #d0d0d0;
      border-radius: 6px;
      background: #ffffff;
      cursor: pointer;
      transition: all 0.3s ease;
      font-size: 14px;
    }

    .source-tab:hover:not(:disabled) {
      background: #f5f5f5;
    }

    .source-tab.active {
      background: #4caf50;
      border-color: #4caf50;
      color: white;
    }

    .source-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 12px;
      margin-bottom: 16px;
      max-height: 300px;
      overflow-y: auto;
    }

    .source-item {
      padding: 12px;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      background: #ffffff;
      cursor: pointer;
      transition: all 0.3s ease;
      text-align: center;
    }

    .source-item:hover {
      border-color: #4caf50;
      box-shadow: 0 2px 4px rgba(76, 175, 80, 0.2);
    }

    .source-item.selected {
      border-color: #4caf50;
      background: #e8f5e8;
    }

    .source-thumbnail {
      width: 100%;
      height: 80px;
      margin-bottom: 8px;
      border-radius: 4px;
      overflow: hidden;
      background: #f0f0f0;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .thumbnail-image {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .thumbnail-placeholder {
      color: #999;
      font-size: 24px;
    }

    .source-name {
      font-size: 14px;
      font-weight: 500;
      color: #333;
      margin-bottom: 4px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .source-type {
      font-size: 12px;
      color: #666;
    }

    .source-actions {
      display: flex;
      gap: 12px;
      justify-content: center;
    }

    .action-btn {
      padding: 10px 16px;
      border: 1px solid #d0d0d0;
      border-radius: 6px;
      background: #ffffff;
      cursor: pointer;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      font-weight: 500;
    }

    .action-btn:hover:not(:disabled) {
      background: #f5f5f5;
    }

    .action-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .confirm-source {
      background: #4caf50;
      border-color: #4caf50;
      color: white;
    }

    .quality-settings {
      margin-bottom: 16px;
      padding: 16px;
      background: #f9f9f9;
      border-radius: 8px;
    }

    .quality-settings h4 {
      margin: 0 0 16px 0;
      color: #333;
      font-size: 16px;
    }

    .preset-buttons {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 12px;
      margin-bottom: 16px;
    }

    .preset-btn {
      padding: 12px;
      border: 1px solid #d0d0d0;
      border-radius: 6px;
      background: #ffffff;
      cursor: pointer;
      transition: all 0.3s ease;
      text-align: center;
    }

    .preset-btn:hover:not(:disabled) {
      background: #f5f5f5;
    }

    .preset-btn.active {
      background: #4caf50;
      border-color: #4caf50;
      color: white;
    }

    .preset-name {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 4px;
    }

    .preset-specs {
      font-size: 12px;
      opacity: 0.8;
    }

    .custom-quality {
      border-top: 1px solid #e0e0e0;
      padding-top: 16px;
    }

    .quality-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 12px;
      margin-bottom: 12px;
    }

    .quality-item label {
      display: block;
      font-size: 12px;
      font-weight: 600;
      color: #333;
      margin-bottom: 4px;
    }

    .quality-input, .quality-select {
      width: 100%;
      padding: 8px;
      border: 1px solid #d0d0d0;
      border-radius: 4px;
      font-size: 14px;
    }

    .quality-input:focus, .quality-select:focus {
      outline: none;
      border-color: #4caf50;
      box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.2);
    }

    .toggle-custom-btn {
      padding: 8px 16px;
      border: 1px solid #d0d0d0;
      border-radius: 6px;
      background: #ffffff;
      cursor: pointer;
      transition: all 0.3s ease;
      font-size: 14px;
    }

    .toggle-custom-btn:hover {
      background: #f5f5f5;
    }

    .advanced-options {
      margin-bottom: 16px;
      padding: 16px;
      background: #f9f9f9;
      border-radius: 8px;
    }

    .advanced-options h4 {
      margin: 0 0 16px 0;
      color: #333;
      font-size: 16px;
    }

    .option-group {
      margin-bottom: 16px;
    }

    .option-item {
      margin-bottom: 12px;
    }

    .checkbox-label {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      font-weight: 500;
      margin-bottom: 4px;
    }

    .option-item label:not(.checkbox-label) {
      display: block;
      font-size: 14px;
      font-weight: 600;
      color: #333;
      margin-bottom: 4px;
    }

    .option-select {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid #d0d0d0;
      border-radius: 6px;
      background: #ffffff;
      font-size: 14px;
      margin-bottom: 4px;
    }

    .option-select:focus {
      outline: none;
      border-color: #4caf50;
      box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.2);
    }

    .option-description {
      font-size: 12px;
      color: #666;
    }

    .screen-preview {
      margin-bottom: 16px;
      padding: 16px;
      background: #f9f9f9;
      border-radius: 8px;
    }

    .screen-preview h4 {
      margin: 0 0 12px 0;
      color: #333;
      font-size: 16px;
    }

    .preview-container {
      position: relative;
      background: #000;
      border-radius: 8px;
      overflow: hidden;
    }

    .preview-video {
      width: 100%;
      height: auto;
      max-height: 300px;
      object-fit: contain;
    }

    .preview-overlay {
      position: absolute;
      top: 8px;
      right: 8px;
      background: rgba(0,0,0,0.7);
      color: white;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 12px;
    }

    .preview-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .share-stats {
      margin-bottom: 16px;
      padding: 16px;
      background: #f9f9f9;
      border-radius: 8px;
    }

    .share-stats h4 {
      margin: 0 0 12px 0;
      color: #333;
      font-size: 16px;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 12px;
    }

    .stat-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
      background: #ffffff;
      border-radius: 6px;
      border: 1px solid #e0e0e0;
    }

    .stat-label {
      font-size: 12px;
      color: #666;
      font-weight: 500;
    }

    .stat-value {
      font-size: 14px;
      color: #333;
      font-weight: 600;
    }

    .controls-footer {
      display: flex;
      gap: 12px;
      justify-content: center;
      padding-top: 16px;
      border-top: 1px solid #f0f0f0;
    }

    .toggle-advanced-btn, .toggle-preview-btn, .toggle-stats-btn {
      padding: 8px 16px;
      border: 1px solid #d0d0d0;
      border-radius: 6px;
      background: #ffffff;
      cursor: pointer;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
    }

    .toggle-advanced-btn:hover, .toggle-preview-btn:hover, .toggle-stats-btn:hover {
      background: #f5f5f5;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }

    @media (max-width: 768px) {
      .screen-share-controls {
        padding: 16px;
      }

      .screen-share-header {
        flex-direction: column;
        align-items: stretch;
        gap: 12px;
      }

      .main-controls {
        justify-content: center;
      }

      .source-grid {
        grid-template-columns: 1fr;
      }

      .preset-buttons {
        grid-template-columns: 1fr;
      }

      .quality-row {
        grid-template-columns: 1fr;
      }

      .stats-grid {
        grid-template-columns: 1fr;
      }

      .controls-footer {
        flex-direction: column;
      }
    }
  `]
})
export class ScreenShareComponent implements OnInit, OnDestroy {
  @Input() settings: ScreenShareSettings = {
    enabled: false,
    source: 'screen',
    includeAudio: false,
    cursor: 'motion',
    width: 1920,
    height: 1080,
    frameRate: 30
  };

  @Input() disabled = false;
  @Input() showAdvanced = false;
  @Input() showPreview = false;
  @Input() showStats = false;

  @Output() settingsChange = new EventEmitter<ScreenShareSettings>();
  @Output() sourceChange = new EventEmitter<ScreenSource>();
  @Output() qualityChange = new EventEmitter<ScreenShareQualityPreset>();
  @Output() screenShareToggle = new EventEmitter<boolean>();

  // Signals for reactive state
  private _availableSources = signal<ScreenSource[]>([]);
  private _selectedSource = signal<ScreenSource | null>(null);
  
  showSourceSelection = false;
  showCustomQuality = false;
  selectedSourceType: 'screen' | 'window' | 'tab' = 'screen';

  // Computed signals
  availableSources = computed(() => this._availableSources());
  selectedSource = computed(() => this._selectedSource());
  
  filteredSources = computed(() => 
    this.availableSources().filter(source => source.type === this.selectedSourceType)
  );

  sourceTypes: ('screen' | 'window' | 'tab')[] = ['screen', 'window', 'tab'];

  // Quality presets
  qualityPresets: ScreenShareQualityPreset[] = [
    {
      name: 'Low',
      width: 1280,
      height: 720,
      frameRate: 15,
      description: 'Good for documents and presentations'
    },
    {
      name: 'Medium',
      width: 1920,
      height: 1080,
      frameRate: 24,
      description: 'Balanced quality and performance'
    },
    {
      name: 'High',
      width: 1920,
      height: 1080,
      frameRate: 30,
      description: 'Good for detailed content'
    },
    {
      name: 'Ultra',
      width: 2560,
      height: 1440,
      frameRate: 60,
      description: 'Best quality for smooth motion'
    }
  ];

  private subscriptions = new Subscription();
  private mediaStream?: MediaStream;

  ngOnInit(): void {
    this.loadAvailableSources();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.stopScreenShare();
  }

  /**
   * Toggle screen sharing
   */
  async toggleScreenShare(): Promise<void> {
    if (this.settings.enabled) {
      this.stopScreenShare();
    } else {
      await this.startScreenShare();
    }
  }

  /**
   * Select source dialog
   */
  selectSource(): void {
    this.showSourceSelection = true;
    this.loadAvailableSources();
  }

  /**
   * Select source type tab
   */
  selectSourceType(type: 'screen' | 'window' | 'tab'): void {
    this.selectedSourceType = type;
  }

  /**
   * Select specific source item
   */
  selectSourceItem(source: ScreenSource): void {
    this._selectedSource.set(source);
  }

  /**
   * Confirm source selection
   */
  confirmSourceSelection(): void {
    const source = this.selectedSource();
    if (source) {
      this.settings.source = source.type;
      this.sourceChange.emit(source);
      this.showSourceSelection = false;
      this.emitSettingsChange();
    }
  }

  /**
   * Refresh available sources
   */
  async refreshSources(): Promise<void> {
    await this.loadAvailableSources();
  }

  /**
   * Apply quality preset
   */
  applyQualityPreset(preset: ScreenShareQualityPreset): void {
    this.settings = {
      ...this.settings,
      width: preset.width,
      height: preset.height,
      frameRate: preset.frameRate
    };
    this.qualityChange.emit(preset);
    this.emitSettingsChange();
  }

  /**
   * Check if preset is currently active
   */
  isPresetActive(preset: ScreenShareQualityPreset): boolean {
    return this.settings.width === preset.width &&
           this.settings.height === preset.height &&
           this.settings.frameRate === preset.frameRate;
  }

  /**
   * Handle width change
   */
  onWidthChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.settings.width = parseInt(target.value, 10);
    this.emitSettingsChange();
  }

  /**
   * Handle height change
   */
  onHeightChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.settings.height = parseInt(target.value, 10);
    this.emitSettingsChange();
  }

  /**
   * Handle frame rate change
   */
  onFrameRateChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.settings.frameRate = parseInt(target.value, 10);
    this.emitSettingsChange();
  }

  /**
   * Handle include audio change
   */
  onIncludeAudioChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.settings.includeAudio = target.checked;
    this.emitSettingsChange();
  }

  /**
   * Handle cursor option change
   */
  onCursorChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.settings.cursor = target.value as 'always' | 'motion' | 'never';
    this.emitSettingsChange();
  }

  /**
   * Toggle advanced settings
   */
  toggleAdvanced(): void {
    this.showAdvanced = !this.showAdvanced;
  }

  /**
   * Toggle custom quality settings
   */
  toggleCustomQuality(): void {
    this.showCustomQuality = !this.showCustomQuality;
  }

  /**
   * Toggle preview
   */
  togglePreview(): void {
    this.showPreview = !this.showPreview;
  }

  /**
   * Toggle statistics
   */
  toggleStats(): void {
    this.showStats = !this.showStats;
  }

  /**
   * Get source type label
   */
  getSourceTypeLabel(type?: 'screen' | 'window' | 'tab'): string {
    const sourceType = type || this.settings.source;
    switch (sourceType) {
      case 'screen': return 'Entire Screen';
      case 'window': return 'Application Window';
      case 'tab': return 'Browser Tab';
      default: return 'Unknown';
    }
  }

  /**
   * Get source icon
   */
  getSourceIcon(type: 'screen' | 'window' | 'tab'): string {
    switch (type) {
      case 'screen': return '🖥️';
      case 'window': return '🪟';
      case 'tab': return '🌐';
      default: return '❓';
    }
  }

  /**
   * Start screen sharing
   */
  private async startScreenShare(): Promise<void> {
    try {
      const constraints = {
        video: {
          width: { ideal: this.settings.width },
          height: { ideal: this.settings.height },
          frameRate: { ideal: this.settings.frameRate },
          cursor: this.settings.cursor
        },
        audio: this.settings.includeAudio
      };

      this.mediaStream = await navigator.mediaDevices.getDisplayMedia(constraints);
      
      this.settings.enabled = true;
      this.screenShareToggle.emit(true);
      this.emitSettingsChange();

      // Setup preview if enabled
      if (this.showPreview) {
        this.setupPreview();
      }

      // Listen for stream end
      this.mediaStream.getVideoTracks()[0].onended = () => {
        this.stopScreenShare();
      };

    } catch (error) {
      console.error('Error starting screen share:', error);
    }
  }

  /**
   * Stop screen sharing
   */
  private stopScreenShare(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = undefined;
    }

    this.settings.enabled = false;
    this.screenShareToggle.emit(false);
    this.emitSettingsChange();
  }

  /**
   * Setup preview video
   */
  private setupPreview(): void {
    // This would be implemented to show the preview video
    // using ViewChild to access the video element
  }

  /**
   * Load available screen sources
   */
  private async loadAvailableSources(): Promise<void> {
    try {
      // Note: getDisplayMedia doesn't provide source enumeration
      // This is a mock implementation for demonstration
      const mockSources: ScreenSource[] = [
        {
          id: 'screen:0',
          name: 'Entire Screen',
          type: 'screen'
        },
        {
          id: 'window:1',
          name: 'VS Code',
          type: 'window'
        },
        {
          id: 'window:2',
          name: 'Browser',
          type: 'window'
        },
        {
          id: 'tab:1',
          name: 'Current Tab',
          type: 'tab'
        }
      ];

      this._availableSources.set(mockSources);
    } catch (error) {
      console.error('Error loading screen sources:', error);
    }
  }

  /**
   * Emit settings change
   */
  private emitSettingsChange(): void {
    this.settingsChange.emit({ ...this.settings });
  }
}

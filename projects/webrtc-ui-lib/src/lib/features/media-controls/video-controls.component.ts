import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, Subject, BehaviorSubject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { MediaDevice, MediaConstraints, VideoConstraints } from '../../core/models';

/**
 * Video quality preset options
 */
export interface VideoQualityPreset {
  name: string;
  label: string;
  width: number;
  height: number;
  frameRate: number;
  description?: string;
}

/**
 * Video settings interface
 */
export interface VideoSettings {
  deviceId?: string;
  enabled: boolean;
  quality: string;
  constraints: VideoConstraints;
  effects: {
    blur: boolean;
    virtualBackground: boolean;
    facingMode: 'user' | 'environment';
  };
}

/**
 * Component for video controls and device management
 * Handles camera selection, quality settings, and video effects
 */
@Component({
  selector: 'wrtc-video-controls',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="video-controls">
      <!-- Video Preview -->
      <div class="video-preview" *ngIf="showPreview">
        <video #videoPreview
               [srcObject]="previewStream"
               autoplay
               playsinline
               muted
               class="preview-video"
               [class.mirrored]="settings.effects.facingMode === 'user'">
        </video>
        
        <div class="preview-overlay">
          <div class="preview-info">
            <span class="resolution-info">{{ getCurrentResolution() }}</span>
            <span class="fps-info">{{ settings.constraints.frameRate || 30 }}fps</span>
          </div>
          
          <div class="preview-controls">
            <button class="btn-preview-control"
                    [class.active]="settings.enabled"
                    (click)="toggleVideo()"
                    [title]="settings.enabled ? 'Turn off camera' : 'Turn on camera'">
              <svg class="icon" viewBox="0 0 24 24">
                <path *ngIf="settings.enabled" d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                <path *ngIf="!settings.enabled" d="M21 6.5l-4 4V7c0-.55-.45-1-1-1H9.82l-1-1H16c.55 0 1 .45 1 1v3.5l4-4v11zM3.27 2L2 3.27 4.73 6H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.21 0 .39-.08.55-.18L19.73 21 21 19.73 3.27 2z"/>
              </svg>
            </button>
            
            <button class="btn-preview-control"
                    (click)="switchCamera()"
                    [disabled]="videoDevices.length <= 1"
                    title="Switch camera">
              <svg class="icon" viewBox="0 0 24 24">
                <path d="M20 4h-3.17L15 2H9L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zM9 4h6l1.83 2H20v12H4V6h5.17L9 4zm3 14c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Device Selection -->
      <div class="control-section">
        <h4 class="section-title">Camera</h4>
        <div class="device-selector">
          <select class="device-select"
                  [value]="settings.deviceId || ''"
                  (change)="onDeviceChange($event)"
                  [disabled]="videoDevices.length === 0">
            <option value="" disabled>
              {{ videoDevices.length === 0 ? 'No cameras found' : 'Select camera' }}
            </option>
            <option *ngFor="let device of videoDevices" [value]="device.deviceId">
              {{ device.label || 'Camera ' + device.deviceId.substring(0, 8) }}
            </option>
          </select>
          
          <button class="btn-refresh"
                  (click)="refreshDevices()"
                  [disabled]="isRefreshing"
                  title="Refresh camera list">
            <svg class="icon" [class.spinning]="isRefreshing" viewBox="0 0 24 24">
              <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Quality Settings -->
      <div class="control-section">
        <h4 class="section-title">Quality</h4>
        <div class="quality-selector">
          <div class="quality-presets">
            <button *ngFor="let preset of qualityPresets"
                    class="btn-quality-preset"
                    [class.active]="settings.quality === preset.name"
                    (click)="setQualityPreset(preset)"
                    [title]="preset.description">
              <span class="preset-label">{{ preset.label }}</span>
              <span class="preset-resolution">{{ preset.width }}x{{ preset.height }}</span>
            </button>
          </div>
          
          <div class="custom-quality" *ngIf="showCustomQuality">
            <div class="quality-row">
              <label class="quality-label">Width:</label>
              <input type="number"
                     class="quality-input"
                     min="160"
                     max="1920"
                     [value]="settings.constraints.width || 640"
                     (change)="onWidthChange($event)">
            </div>
            
            <div class="quality-row">
              <label class="quality-label">Height:</label>
              <input type="number"
                     class="quality-input"
                     min="120"
                     max="1080"
                     [value]="settings.constraints.height || 480"
                     (change)="onHeightChange($event)">
            </div>
            
            <div class="quality-row">
              <label class="quality-label">FPS:</label>
              <select class="quality-select"
                      [value]="settings.constraints.frameRate || 30"
                      (change)="onFrameRateChange($event)">
                <option value="15">15 fps</option>
                <option value="24">24 fps</option>
                <option value="30">30 fps</option>
                <option value="60">60 fps</option>
              </select>
            </div>
          </div>
          
          <button class="btn-toggle-custom"
                  (click)="toggleCustomQuality()">
            {{ showCustomQuality ? 'Hide' : 'Show' }} Custom Settings
          </button>
        </div>
      </div>

      <!-- Video Effects -->
      <div class="control-section">
        <h4 class="section-title">Effects</h4>
        <div class="effects-controls">
          <div class="effect-toggle">
            <input type="checkbox"
                   id="blur-effect"
                   [checked]="settings.effects.blur"
                   (change)="onBlurToggle($event)">
            <label for="blur-effect">Background Blur</label>
          </div>
          
          <div class="effect-toggle">
            <input type="checkbox"
                   id="virtual-bg"
                   [checked]="settings.effects.virtualBackground"
                   (change)="onVirtualBackgroundToggle($event)">
            <label for="virtual-bg">Virtual Background</label>
          </div>
          
          <div class="effect-toggle">
            <label class="facing-mode-label">Camera Mode:</label>
            <select class="facing-mode-select"
                    [value]="settings.effects.facingMode"
                    (change)="onFacingModeChange($event)">
              <option value="user">Front Camera</option>
              <option value="environment">Back Camera</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Advanced Settings -->
      <div class="control-section" *ngIf="showAdvanced">
        <h4 class="section-title">Advanced</h4>
        <div class="advanced-controls">
          <div class="advanced-row">
            <label class="advanced-label">Aspect Ratio:</label>
            <select class="advanced-select"
                    [value]="settings.constraints.aspectRatio || 1.33"
                    (change)="onAspectRatioChange($event)">
              <option value="1.33">4:3</option>
              <option value="1.78">16:9</option>
              <option value="1">1:1</option>
            </select>
          </div>
          
          <div class="advanced-row">
            <label class="advanced-label">Facing Mode:</label>
            <select class="advanced-select"
                    [value]="settings.constraints.facingMode || 'user'"
                    (change)="onConstraintFacingModeChange($event)">
              <option value="user">User</option>
              <option value="environment">Environment</option>
              <option value="left">Left</option>
              <option value="right">Right</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="action-buttons">
        <button class="btn-action primary"
                (click)="applySettings()"
                [disabled]="isApplying">
          <svg *ngIf="isApplying" class="icon spinning" viewBox="0 0 24 24">
            <path d="M12 2v4c5.5 0 10 4.5 10 10s-4.5 10-10 10S2 21.5 2 16c0-1.9.5-3.7 1.5-5.2L5 12.3C4.4 13.5 4 14.7 4 16c0 4.4 3.6 8 8 8s8-3.6 8-8-3.6-8-8-8z"/>
          </svg>
          <span>{{ isApplying ? 'Applying...' : 'Apply Settings' }}</span>
        </button>
        
        <button class="btn-action secondary"
                (click)="resetSettings()">
          Reset to Default
        </button>
        
        <button class="btn-action secondary"
                (click)="toggleAdvanced()"
                *ngIf="allowAdvanced">
          {{ showAdvanced ? 'Hide' : 'Show' }} Advanced
        </button>
      </div>
    </div>
  `,
  styles: [`
    .video-controls {
      background: #fff;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    /* Video Preview */
    .video-preview {
      position: relative;
      background: #000;
      border-radius: 8px;
      overflow: hidden;
      margin-bottom: 20px;
      aspect-ratio: 16/9;
    }

    .preview-video {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .preview-video.mirrored {
      transform: scaleX(-1);
    }

    .preview-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.3) 100%);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 12px;
    }

    .preview-info {
      display: flex;
      gap: 12px;
      align-self: flex-start;
    }

    .resolution-info,
    .fps-info {
      background: rgba(0,0,0,0.7);
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
    }

    .preview-controls {
      display: flex;
      gap: 8px;
      align-self: flex-end;
    }

    .btn-preview-control {
      width: 44px;
      height: 44px;
      border: none;
      border-radius: 50%;
      background: rgba(0,0,0,0.7);
      color: white;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
    }

    .btn-preview-control:hover {
      background: rgba(0,0,0,0.9);
    }

    .btn-preview-control.active {
      background: #2196f3;
    }

    .btn-preview-control:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* Control Sections */
    .control-section {
      margin-bottom: 20px;
      padding-bottom: 16px;
      border-bottom: 1px solid #eee;
    }

    .control-section:last-of-type {
      border-bottom: none;
    }

    .section-title {
      margin: 0 0 12px 0;
      font-size: 16px;
      font-weight: 600;
      color: #333;
    }

    /* Device Selection */
    .device-selector {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .device-select {
      flex: 1;
      padding: 8px 12px;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 14px;
      background: white;
    }

    .btn-refresh {
      width: 36px;
      height: 36px;
      border: 1px solid #ddd;
      border-radius: 6px;
      background: white;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
    }

    .btn-refresh:hover:not(:disabled) {
      background: #f5f5f5;
      border-color: #bbb;
    }

    .btn-refresh:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    /* Quality Settings */
    .quality-presets {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
      gap: 8px;
      margin-bottom: 12px;
    }

    .btn-quality-preset {
      padding: 8px;
      border: 1px solid #ddd;
      border-radius: 6px;
      background: white;
      cursor: pointer;
      text-align: center;
      transition: all 0.2s ease;
    }

    .btn-quality-preset:hover {
      background: #f5f5f5;
      border-color: #bbb;
    }

    .btn-quality-preset.active {
      background: #2196f3;
      border-color: #2196f3;
      color: white;
    }

    .preset-label {
      display: block;
      font-weight: 600;
      font-size: 14px;
    }

    .preset-resolution {
      display: block;
      font-size: 12px;
      opacity: 0.8;
      margin-top: 2px;
    }

    .custom-quality {
      background: #f9f9f9;
      padding: 12px;
      border-radius: 6px;
      margin-bottom: 12px;
    }

    .quality-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;
    }

    .quality-row:last-child {
      margin-bottom: 0;
    }

    .quality-label {
      min-width: 60px;
      font-size: 14px;
      font-weight: 500;
      color: #666;
    }

    .quality-input,
    .quality-select {
      flex: 1;
      padding: 6px 8px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
    }

    .btn-toggle-custom {
      width: 100%;
      padding: 8px;
      border: 1px solid #ddd;
      border-radius: 6px;
      background: white;
      cursor: pointer;
      font-size: 14px;
      color: #666;
      transition: all 0.2s ease;
    }

    .btn-toggle-custom:hover {
      background: #f5f5f5;
    }

    /* Effects Controls */
    .effects-controls {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .effect-toggle {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .effect-toggle input[type="checkbox"] {
      width: 18px;
      height: 18px;
      accent-color: #2196f3;
    }

    .effect-toggle label {
      font-size: 14px;
      color: #333;
      cursor: pointer;
    }

    .facing-mode-label {
      min-width: 100px;
      font-size: 14px;
      font-weight: 500;
      color: #666;
    }

    .facing-mode-select {
      flex: 1;
      padding: 6px 8px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
    }

    /* Advanced Settings */
    .advanced-controls {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .advanced-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .advanced-label {
      min-width: 100px;
      font-size: 14px;
      font-weight: 500;
      color: #666;
    }

    .advanced-select {
      flex: 1;
      padding: 6px 8px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
    }

    /* Action Buttons */
    .action-buttons {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      margin-top: 20px;
      padding-top: 16px;
      border-top: 1px solid #eee;
    }

    .btn-action {
      padding: 10px 20px;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: all 0.2s ease;
    }

    .btn-action.primary {
      background: #2196f3;
      color: white;
      flex: 1;
      min-width: 150px;
    }

    .btn-action.primary:hover:not(:disabled) {
      background: #1976d2;
    }

    .btn-action.secondary {
      background: white;
      color: #666;
      border: 1px solid #ddd;
    }

    .btn-action.secondary:hover {
      background: #f5f5f5;
      border-color: #bbb;
    }

    .btn-action:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .icon {
      width: 20px;
      height: 20px;
      fill: currentColor;
    }

    .spinning {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    /* Responsive */
    @media (max-width: 768px) {
      .video-controls {
        padding: 16px;
      }

      .quality-presets {
        grid-template-columns: repeat(2, 1fr);
      }

      .action-buttons {
        flex-direction: column;
      }

      .btn-action.primary {
        min-width: unset;
      }
    }
  `]
})
export class VideoControlsComponent implements OnInit, OnDestroy {
  @ViewChild('videoPreview') videoPreview!: ElementRef<HTMLVideoElement>;

  @Input() showPreview: boolean = true;
  @Input() showAdvanced: boolean = false;
  @Input() allowAdvanced: boolean = true;
  @Input() previewStream: MediaStream | null = null;

  @Output() settingsChange = new EventEmitter<VideoSettings>();
  @Output() deviceChange = new EventEmitter<string>();
  @Output() qualityChange = new EventEmitter<VideoQualityPreset>();
  @Output() videoToggle = new EventEmitter<boolean>();

  settings: VideoSettings = {
    enabled: true,
    quality: 'hd',
    constraints: {
      width: 1280,
      height: 720,
      frameRate: 30,
      facingMode: 'user'
    },
    effects: {
      blur: false,
      virtualBackground: false,
      facingMode: 'user'
    }
  };

  videoDevices: MediaDevice[] = [];
  qualityPresets: VideoQualityPreset[] = [
    { name: 'low', label: 'Low', width: 320, height: 240, frameRate: 15, description: 'Low quality for poor connections' },
    { name: 'medium', label: 'Medium', width: 640, height: 480, frameRate: 30, description: 'Balanced quality and performance' },
    { name: 'hd', label: 'HD', width: 1280, height: 720, frameRate: 30, description: 'High definition video' },
    { name: 'fullhd', label: 'Full HD', width: 1920, height: 1080, frameRate: 30, description: 'Full high definition video' }
  ];

  showCustomQuality: boolean = false;
  isRefreshing: boolean = false;
  isApplying: boolean = false;
  
  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.refreshDevices();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Refresh available video devices
   */
  async refreshDevices(): Promise<void> {
    this.isRefreshing = true;
    
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.videoDevices = devices
        .filter(device => device.kind === 'videoinput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label,
          kind: device.kind as MediaDeviceKind,
          groupId: device.groupId
        }));
        
    } catch (error) {
      console.error('Failed to refresh video devices:', error);
    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * Handle device change
   */
  onDeviceChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.settings.deviceId = target.value;
    this.deviceChange.emit(target.value);
    this.emitSettingsChange();
  }

  /**
   * Set quality preset
   */
  setQualityPreset(preset: VideoQualityPreset): void {
    this.settings.quality = preset.name;
    this.settings.constraints.width = preset.width;
    this.settings.constraints.height = preset.height;
    this.settings.constraints.frameRate = preset.frameRate;
    
    this.qualityChange.emit(preset);
    this.emitSettingsChange();
  }

  /**
   * Switch between front/back camera
   */
  switchCamera(): void {
    const currentDeviceIndex = this.videoDevices.findIndex(d => d.deviceId === this.settings.deviceId);
    const nextIndex = (currentDeviceIndex + 1) % this.videoDevices.length;
    const nextDevice = this.videoDevices[nextIndex];
    
    if (nextDevice) {
      this.settings.deviceId = nextDevice.deviceId;
      this.deviceChange.emit(nextDevice.deviceId);
      this.emitSettingsChange();
    }
  }

  /**
   * Toggle video on/off
   */
  toggleVideo(): void {
    this.settings.enabled = !this.settings.enabled;
    this.videoToggle.emit(this.settings.enabled);
    this.emitSettingsChange();
  }

  /**
   * Toggle custom quality settings
   */
  toggleCustomQuality(): void {
    this.showCustomQuality = !this.showCustomQuality;
  }

  /**
   * Toggle advanced settings
   */
  toggleAdvanced(): void {
    this.showAdvanced = !this.showAdvanced;
  }

  /**
   * Handle width change
   */
  onWidthChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.settings.constraints.width = parseInt(target.value);
    this.settings.quality = 'custom';
    this.emitSettingsChange();
  }

  /**
   * Handle height change
   */
  onHeightChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.settings.constraints.height = parseInt(target.value);
    this.settings.quality = 'custom';
    this.emitSettingsChange();
  }

  /**
   * Handle frame rate change
   */
  onFrameRateChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.settings.constraints.frameRate = parseInt(target.value);
    this.emitSettingsChange();
  }

  /**
   * Handle blur effect toggle
   */
  onBlurToggle(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.settings.effects.blur = target.checked;
    this.emitSettingsChange();
  }

  /**
   * Handle virtual background toggle
   */
  onVirtualBackgroundToggle(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.settings.effects.virtualBackground = target.checked;
    this.emitSettingsChange();
  }

  /**
   * Handle facing mode change
   */
  onFacingModeChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.settings.effects.facingMode = target.value as 'user' | 'environment';
    this.emitSettingsChange();
  }

  /**
   * Handle aspect ratio change
   */
  onAspectRatioChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.settings.constraints.aspectRatio = parseFloat(target.value);
    this.emitSettingsChange();
  }

  /**
   * Handle constraint facing mode change
   */
  onConstraintFacingModeChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.settings.constraints.facingMode = target.value;
    this.emitSettingsChange();
  }

  /**
   * Apply current settings
   */
  async applySettings(): Promise<void> {
    this.isApplying = true;
    
    try {
      // Apply settings logic would go here
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      
    } catch (error) {
      console.error('Failed to apply video settings:', error);
    } finally {
      this.isApplying = false;
    }
  }

  /**
   * Reset settings to default
   */
  resetSettings(): void {
    this.settings = {
      enabled: true,
      quality: 'hd',
      constraints: {
        width: 1280,
        height: 720,
        frameRate: 30,
        facingMode: 'user'
      },
      effects: {
        blur: false,
        virtualBackground: false,
        facingMode: 'user'
      }
    };
    
    this.emitSettingsChange();
  }

  /**
   * Get current resolution as string
   */
  getCurrentResolution(): string {
    const width = this.settings.constraints.width || 640;
    const height = this.settings.constraints.height || 480;
    return `${width}x${height}`;
  }

  /**
   * Emit settings change event
   */
  private emitSettingsChange(): void {
    this.settingsChange.emit({ ...this.settings });
  }
}

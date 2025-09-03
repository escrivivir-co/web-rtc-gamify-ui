import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, Signal, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';

export interface AudioSettings {
  enabled: boolean;
  muted: boolean;
  volume: number;
  deviceId: string;
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
  sampleRate: number;
  channelCount: number;
}

export interface AudioDevice {
  deviceId: string;
  label: string;
  kind: 'audioinput' | 'audiooutput';
  groupId: string;
}

export interface AudioQualityPreset {
  name: string;
  sampleRate: number;
  channelCount: number;
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
}

@Component({
  selector: 'webrtc-audio-controls',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="audio-controls">
      <!-- Main Audio Control -->
      <div class="audio-control-header">
        <div class="audio-status">
          <div class="audio-indicator" 
               [class.active]="settings.enabled && !settings.muted"
               [class.muted]="settings.muted">
            <span class="icon">🎤</span>
          </div>
          <div class="audio-level-meter">
            <div class="level-bar" 
                 [style.width.%]="audioLevel() * 100"
                 [class.active]="settings.enabled && !settings.muted">
            </div>
          </div>
        </div>
        
        <div class="main-controls">
          <button type="button" 
                  class="control-btn toggle-audio"
                  [class.active]="settings.enabled"
                  (click)="toggleAudio()"
                  [disabled]="disabled">
            <span class="icon">{{ settings.enabled ? '🎤' : '🚫' }}</span>
            <span class="label">{{ settings.enabled ? 'Audio On' : 'Audio Off' }}</span>
          </button>
          
          <button type="button" 
                  class="control-btn toggle-mute"
                  [class.active]="!settings.muted"
                  [class.muted]="settings.muted"
                  (click)="toggleMute()"
                  [disabled]="disabled || !settings.enabled">
            <span class="icon">{{ settings.muted ? '🔇' : '🔊' }}</span>
            <span class="label">{{ settings.muted ? 'Unmute' : 'Mute' }}</span>
          </button>
        </div>
      </div>

      <!-- Volume Control -->
      <div class="volume-control" *ngIf="settings.enabled">
        <label for="volume-slider">Volume</label>
        <div class="volume-slider-container">
          <span class="volume-min">🔈</span>
          <input type="range" 
                 id="volume-slider"
                 class="volume-slider"
                 [value]="settings.volume"
                 min="0" 
                 max="1" 
                 step="0.01"
                 (input)="onVolumeChange($event)"
                 [disabled]="disabled">
          <span class="volume-max">🔊</span>
        </div>
        <span class="volume-value">{{ (settings.volume * 100) | number:'1.0-0' }}%</span>
      </div>

      <!-- Device Selection -->
      <div class="device-selection" *ngIf="showAdvanced">
        <div class="device-group">
          <label for="input-device">Input Device</label>
          <select id="input-device" 
                  class="device-select"
                  [value]="settings.deviceId"
                  (change)="onInputDeviceChange($event)"
                  [disabled]="disabled">
            <option value="">Default</option>
            <option *ngFor="let device of inputDevices()" 
                    [value]="device.deviceId">
              {{ device.label || 'Unknown Device' }}
            </option>
          </select>
        </div>

        <div class="device-group" *ngIf="outputDevices().length > 0">
          <label for="output-device">Output Device</label>
          <select id="output-device" 
                  class="device-select"
                  [value]="selectedOutputDevice"
                  (change)="onOutputDeviceChange($event)"
                  [disabled]="disabled">
            <option value="">Default</option>
            <option *ngFor="let device of outputDevices()" 
                    [value]="device.deviceId">
              {{ device.label || 'Unknown Device' }}
            </option>
          </select>
        </div>

        <button type="button" 
                class="refresh-devices-btn"
                (click)="refreshDevices()"
                [disabled]="disabled">
          <span class="icon">🔄</span>
          Refresh Devices
        </button>
      </div>

      <!-- Quality Presets -->
      <div class="quality-presets" *ngIf="showAdvanced">
        <label>Audio Quality</label>
        <div class="preset-buttons">
          <button type="button" 
                  *ngFor="let preset of qualityPresets" 
                  class="preset-btn"
                  [class.active]="isPresetActive(preset)"
                  (click)="applyQualityPreset(preset)"
                  [disabled]="disabled">
            {{ preset.name }}
          </button>
        </div>
      </div>

      <!-- Advanced Audio Settings -->
      <div class="advanced-settings" *ngIf="showAdvanced">
        <h4>Advanced Settings</h4>
        
        <div class="setting-group">
          <div class="setting-item">
            <label class="checkbox-label">
              <input type="checkbox" 
                     [checked]="settings.echoCancellation"
                     (change)="onEchoCancellationChange($event)"
                     [disabled]="disabled">
              <span class="checkmark"></span>
              Echo Cancellation
            </label>
            <span class="setting-description">Reduces echo feedback</span>
          </div>

          <div class="setting-item">
            <label class="checkbox-label">
              <input type="checkbox" 
                     [checked]="settings.noiseSuppression"
                     (change)="onNoiseSuppressionChange($event)"
                     [disabled]="disabled">
              <span class="checkmark"></span>
              Noise Suppression
            </label>
            <span class="setting-description">Reduces background noise</span>
          </div>

          <div class="setting-item">
            <label class="checkbox-label">
              <input type="checkbox" 
                     [checked]="settings.autoGainControl"
                     (change)="onAutoGainControlChange($event)"
                     [disabled]="disabled">
              <span class="checkmark"></span>
              Auto Gain Control
            </label>
            <span class="setting-description">Automatically adjusts microphone sensitivity</span>
          </div>
        </div>

        <div class="setting-group">
          <div class="setting-item">
            <label for="sample-rate">Sample Rate</label>
            <select id="sample-rate" 
                    class="setting-select"
                    [value]="settings.sampleRate"
                    (change)="onSampleRateChange($event)"
                    [disabled]="disabled">
              <option value="8000">8 kHz (Phone Quality)</option>
              <option value="16000">16 kHz (Wideband)</option>
              <option value="22050">22.05 kHz (FM Radio)</option>
              <option value="44100">44.1 kHz (CD Quality)</option>
              <option value="48000">48 kHz (Professional)</option>
            </select>
          </div>

          <div class="setting-item">
            <label for="channel-count">Channels</label>
            <select id="channel-count" 
                    class="setting-select"
                    [value]="settings.channelCount"
                    (change)="onChannelCountChange($event)"
                    [disabled]="disabled">
              <option value="1">Mono</option>
              <option value="2">Stereo</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Test Audio -->
      <div class="test-audio" *ngIf="showAdvanced">
        <button type="button" 
                class="test-btn"
                [class.active]="isTestingAudio"
                (click)="testAudio()"
                [disabled]="disabled || !settings.enabled">
          <span class="icon">{{ isTestingAudio() ? '⏹️' : '🎵' }}</span>
          {{ isTestingAudio() ? 'Stop Test' : 'Test Audio' }}
        </button>
        <span class="test-description">Play test sound to verify audio output</span>
      </div>

      <!-- Audio Statistics -->
      <div class="audio-stats" *ngIf="showStats && settings.enabled">
        <h4>Audio Statistics</h4>
        <div class="stats-grid">
          <div class="stat-item">
            <span class="stat-label">Level:</span>
            <span class="stat-value">{{ (audioLevel() * 100) | number:'1.0-0' }}%</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Quality:</span>
            <span class="stat-value">{{ getQualityDescription() }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Bitrate:</span>
            <span class="stat-value">{{ estimatedBitrate() }} kbps</span>
          </div>
        </div>
      </div>

      <!-- Advanced Toggle -->
      <div class="controls-footer">
        <button type="button" 
                class="toggle-advanced-btn"
                (click)="toggleAdvanced()">
          <span class="icon">{{ showAdvanced ? '▼' : '▶' }}</span>
          {{ showAdvanced ? 'Hide Advanced' : 'Show Advanced' }}
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
    .audio-controls {
      background: #ffffff;
      border: 1px solid #e0e0e0;
      border-radius: 12px;
      padding: 20px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    .audio-control-header {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 16px;
      padding-bottom: 16px;
      border-bottom: 1px solid #f0f0f0;
    }

    .audio-status {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .audio-indicator {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f5f5f5;
      border: 2px solid #e0e0e0;
      transition: all 0.3s ease;
    }

    .audio-indicator.active {
      background: #e8f5e8;
      border-color: #4caf50;
      color: #4caf50;
    }

    .audio-indicator.muted {
      background: #ffe8e8;
      border-color: #f44336;
      color: #f44336;
    }

    .audio-indicator .icon {
      font-size: 20px;
    }

    .audio-level-meter {
      width: 100px;
      height: 8px;
      background: #f0f0f0;
      border-radius: 4px;
      overflow: hidden;
      position: relative;
    }

    .level-bar {
      height: 100%;
      background: linear-gradient(90deg, #4caf50, #ff9800, #f44336);
      transition: width 0.1s ease;
      border-radius: 4px;
    }

    .level-bar.active {
      animation: pulse 0.5s ease-in-out infinite alternate;
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

    .control-btn.muted {
      background: #ffe8e8;
      border-color: #f44336;
      color: #f44336;
    }

    .control-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .volume-control {
      margin-bottom: 16px;
      padding: 16px;
      background: #f9f9f9;
      border-radius: 8px;
    }

    .volume-control label {
      display: block;
      font-weight: 600;
      margin-bottom: 8px;
      color: #333;
    }

    .volume-slider-container {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;
    }

    .volume-slider {
      flex: 1;
      height: 6px;
      background: #e0e0e0;
      border-radius: 3px;
      outline: none;
      cursor: pointer;
    }

    .volume-slider::-webkit-slider-thumb {
      appearance: none;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: #4caf50;
      cursor: pointer;
      border: 2px solid #ffffff;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    }

    .volume-value {
      font-size: 12px;
      color: #666;
      font-weight: 500;
    }

    .device-selection {
      margin-bottom: 16px;
      padding: 16px;
      background: #f9f9f9;
      border-radius: 8px;
    }

    .device-group {
      margin-bottom: 12px;
    }

    .device-group label {
      display: block;
      font-weight: 600;
      margin-bottom: 4px;
      color: #333;
    }

    .device-select, .setting-select {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid #d0d0d0;
      border-radius: 6px;
      background: #ffffff;
      font-size: 14px;
    }

    .device-select:focus, .setting-select:focus {
      outline: none;
      border-color: #4caf50;
      box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.2);
    }

    .refresh-devices-btn {
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
      margin-top: 8px;
    }

    .refresh-devices-btn:hover:not(:disabled) {
      background: #f5f5f5;
    }

    .quality-presets {
      margin-bottom: 16px;
      padding: 16px;
      background: #f9f9f9;
      border-radius: 8px;
    }

    .quality-presets label {
      display: block;
      font-weight: 600;
      margin-bottom: 12px;
      color: #333;
    }

    .preset-buttons {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .preset-btn {
      padding: 8px 16px;
      border: 1px solid #d0d0d0;
      border-radius: 6px;
      background: #ffffff;
      cursor: pointer;
      transition: all 0.3s ease;
      font-size: 14px;
    }

    .preset-btn:hover:not(:disabled) {
      background: #f5f5f5;
    }

    .preset-btn.active {
      background: #4caf50;
      border-color: #4caf50;
      color: white;
    }

    .advanced-settings {
      margin-bottom: 16px;
      padding: 16px;
      background: #f9f9f9;
      border-radius: 8px;
    }

    .advanced-settings h4 {
      margin: 0 0 16px 0;
      color: #333;
      font-size: 16px;
    }

    .setting-group {
      margin-bottom: 16px;
    }

    .setting-item {
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

    .checkbox-label input[type="checkbox"] {
      margin: 0;
    }

    .setting-description {
      font-size: 12px;
      color: #666;
      margin-left: 24px;
    }

    .test-audio {
      margin-bottom: 16px;
      padding: 16px;
      background: #f9f9f9;
      border-radius: 8px;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .test-btn {
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

    .test-btn:hover:not(:disabled) {
      background: #f5f5f5;
    }

    .test-btn.active {
      background: #ff9800;
      border-color: #ff9800;
      color: white;
    }

    .test-description {
      font-size: 12px;
      color: #666;
    }

    .audio-stats {
      margin-bottom: 16px;
      padding: 16px;
      background: #f9f9f9;
      border-radius: 8px;
    }

    .audio-stats h4 {
      margin: 0 0 12px 0;
      color: #333;
      font-size: 16px;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
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

    .toggle-advanced-btn, .toggle-stats-btn {
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

    .toggle-advanced-btn:hover, .toggle-stats-btn:hover {
      background: #f5f5f5;
    }

    @keyframes pulse {
      from { opacity: 1; }
      to { opacity: 0.7; }
    }

    @media (max-width: 768px) {
      .audio-controls {
        padding: 16px;
      }

      .audio-control-header {
        flex-direction: column;
        align-items: stretch;
        gap: 12px;
      }

      .main-controls {
        justify-content: center;
      }

      .preset-buttons {
        justify-content: center;
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
export class AudioControlsComponent implements OnInit, OnDestroy {
  @Input() settings: AudioSettings = {
    enabled: true,
    muted: false,
    volume: 0.8,
    deviceId: '',
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    sampleRate: 44100,
    channelCount: 1
  };

  @Input() disabled = false;
  @Input() showAdvanced = false;
  @Input() showStats = false;

  @Output() settingsChange = new EventEmitter<AudioSettings>();
  @Output() deviceChange = new EventEmitter<string>();
  @Output() qualityChange = new EventEmitter<AudioQualityPreset>();
  @Output() audioToggle = new EventEmitter<boolean>();

  // Signals for reactive state
  private _audioLevel = signal(0);
  private _availableDevices = signal<AudioDevice[]>([]);
  private _isTestingAudio = signal(false);

  selectedOutputDevice = '';

  // Computed signals
  audioLevel = computed(() => this._audioLevel());
  inputDevices = computed(() => 
    this._availableDevices().filter(device => device.kind === 'audioinput')
  );
  outputDevices = computed(() => 
    this._availableDevices().filter(device => device.kind === 'audiooutput')
  );
  isTestingAudio = computed(() => this._isTestingAudio());

  // Audio quality presets
  qualityPresets: AudioQualityPreset[] = [
    {
      name: 'Phone',
      sampleRate: 8000,
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    },
    {
      name: 'Voice',
      sampleRate: 16000,
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    },
    {
      name: 'Music',
      sampleRate: 44100,
      channelCount: 2,
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false
    },
    {
      name: 'Broadcast',
      sampleRate: 48000,
      channelCount: 2,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    }
  ];

  private subscriptions = new Subscription();
  private audioContext?: AudioContext;
  private analyser?: AnalyserNode;
  private mediaStream?: MediaStream;
  private testAudioElement?: HTMLAudioElement;

  ngOnInit(): void {
    this.loadAvailableDevices();
    this.setupAudioLevelMonitoring();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.stopAudioLevelMonitoring();
    this.stopTestAudio();
  }

  /**
   * Toggle audio on/off
   */
  toggleAudio(): void {
    this.settings.enabled = !this.settings.enabled;
    this.audioToggle.emit(this.settings.enabled);
    this.emitSettingsChange();
  }

  /**
   * Toggle mute/unmute
   */
  toggleMute(): void {
    this.settings.muted = !this.settings.muted;
    this.emitSettingsChange();
  }

  /**
   * Handle volume change
   */
  onVolumeChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.settings.volume = parseFloat(target.value);
    this.emitSettingsChange();
  }

  /**
   * Handle input device change
   */
  onInputDeviceChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.settings.deviceId = target.value;
    this.deviceChange.emit(target.value);
    this.emitSettingsChange();
  }

  /**
   * Handle output device change
   */
  onOutputDeviceChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.selectedOutputDevice = target.value;
    // Note: Output device change requires different handling
    // This would typically be handled by the parent component
  }

  /**
   * Handle echo cancellation change
   */
  onEchoCancellationChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.settings.echoCancellation = target.checked;
    this.emitSettingsChange();
  }

  /**
   * Handle noise suppression change
   */
  onNoiseSuppressionChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.settings.noiseSuppression = target.checked;
    this.emitSettingsChange();
  }

  /**
   * Handle auto gain control change
   */
  onAutoGainControlChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.settings.autoGainControl = target.checked;
    this.emitSettingsChange();
  }

  /**
   * Handle sample rate change
   */
  onSampleRateChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.settings.sampleRate = parseInt(target.value, 10);
    this.emitSettingsChange();
  }

  /**
   * Handle channel count change
   */
  onChannelCountChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.settings.channelCount = parseInt(target.value, 10);
    this.emitSettingsChange();
  }

  /**
   * Apply quality preset
   */
  applyQualityPreset(preset: AudioQualityPreset): void {
    this.settings = {
      ...this.settings,
      sampleRate: preset.sampleRate,
      channelCount: preset.channelCount,
      echoCancellation: preset.echoCancellation,
      noiseSuppression: preset.noiseSuppression,
      autoGainControl: preset.autoGainControl
    };
    this.qualityChange.emit(preset);
    this.emitSettingsChange();
  }

  /**
   * Check if preset is currently active
   */
  isPresetActive(preset: AudioQualityPreset): boolean {
    return this.settings.sampleRate === preset.sampleRate &&
           this.settings.channelCount === preset.channelCount &&
           this.settings.echoCancellation === preset.echoCancellation &&
           this.settings.noiseSuppression === preset.noiseSuppression &&
           this.settings.autoGainControl === preset.autoGainControl;
  }

  /**
   * Refresh available devices
   */
  async refreshDevices(): Promise<void> {
    await this.loadAvailableDevices();
  }

  /**
   * Test audio playback
   */
  testAudio(): void {
    if (this.isTestingAudio()) {
      this.stopTestAudio();
    } else {
      this.startTestAudio();
    }
  }

  /**
   * Toggle advanced settings
   */
  toggleAdvanced(): void {
    this.showAdvanced = !this.showAdvanced;
  }

  /**
   * Toggle statistics display
   */
  toggleStats(): void {
    this.showStats = !this.showStats;
  }

  /**
   * Get quality description
   */
  getQualityDescription(): string {
    const activePreset = this.qualityPresets.find(preset => this.isPresetActive(preset));
    if (activePreset) {
      return activePreset.name;
    }
    
    if (this.settings.sampleRate >= 44100) {
      return 'High';
    } else if (this.settings.sampleRate >= 22050) {
      return 'Medium';
    } else {
      return 'Low';
    }
  }

  /**
   * Estimate bitrate
   */
  estimatedBitrate(): number {
    // Rough estimation based on sample rate and channel count
    const baseRate = this.settings.sampleRate * this.settings.channelCount * 16; // 16-bit audio
    return Math.round(baseRate / 1000); // Convert to kbps
  }

  /**
   * Load available audio devices
   */
  private async loadAvailableDevices(): Promise<void> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioDevices: AudioDevice[] = devices
        .filter(device => device.kind === 'audioinput' || device.kind === 'audiooutput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label,
          kind: device.kind as 'audioinput' | 'audiooutput',
          groupId: device.groupId
        }));
      
      this._availableDevices.set(audioDevices);
    } catch (error) {
      console.error('Error loading audio devices:', error);
    }
  }

  /**
   * Setup audio level monitoring
   */
  private async setupAudioLevelMonitoring(): Promise<void> {
    try {
      this.audioContext = new AudioContext();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;

      // Get user media for monitoring
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: this.settings.deviceId || undefined
        }
      });

      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      source.connect(this.analyser);

      this.startAudioLevelAnalysis();
    } catch (error) {
      console.error('Error setting up audio monitoring:', error);
    }
  }

  /**
   * Start audio level analysis
   */
  private startAudioLevelAnalysis(): void {
    if (!this.analyser) return;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const analyze = () => {
      if (!this.analyser) return;

      this.analyser.getByteFrequencyData(dataArray);
      
      // Calculate average volume
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const average = sum / bufferLength;
      const normalizedLevel = average / 255;

      this._audioLevel.set(normalizedLevel);

      if (this.settings.enabled && !this.settings.muted) {
        requestAnimationFrame(analyze);
      }
    };

    analyze();
  }

  /**
   * Stop audio level monitoring
   */
  private stopAudioLevelMonitoring(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
    }
    if (this.audioContext) {
      this.audioContext.close();
    }
  }

  /**
   * Start test audio playback
   */
  private startTestAudio(): void {
    this.testAudioElement = new Audio();
    this.testAudioElement.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmRjJC8='; // Short beep
    this.testAudioElement.volume = this.settings.volume;
    this.testAudioElement.loop = true;
    
    this.testAudioElement.play();
    this._isTestingAudio.set(true);

    // Auto-stop after 3 seconds
    setTimeout(() => {
      this.stopTestAudio();
    }, 3000);
  }

  /**
   * Stop test audio playback
   */
  private stopTestAudio(): void {
    if (this.testAudioElement) {
      this.testAudioElement.pause();
      this.testAudioElement = undefined;
    }
    this._isTestingAudio.set(false);
  }

  /**
   * Emit settings change
   */
  private emitSettingsChange(): void {
    this.settingsChange.emit({ ...this.settings });
  }
}

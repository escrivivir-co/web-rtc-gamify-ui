import { Component, OnInit, OnDestroy, Output, EventEmitter, Signal, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

export interface RoomCreationOptions {
  name: string;
  description: string;
  type: 'public' | 'private' | 'protected';
  password?: string;
  maxParticipants: number;
  requireApproval: boolean;
  allowGuests: boolean;
  recordSession: boolean;
  enableChat: boolean;
  enableFileSharing: boolean;
  muteNewcomers: boolean;
  language: string;
  tags: string[];
  category: string;
  duration?: number; // minutes, 0 = unlimited
  autoDelete: boolean;
  waitingRoom: boolean;
  lobbyMusic: boolean;
}

export interface RoomTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  settings: Partial<RoomCreationOptions>;
  features: string[];
  popular: boolean;
}

export interface CategoryConfig {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  defaultSettings: Partial<RoomCreationOptions>;
}

@Component({
  selector: 'webrtc-room-creation',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="room-creation-container">
      
      <!-- Header -->
      <div class="creation-header">
        <div class="header-content">
          <h2>Create New Room</h2>
          <p>Set up your perfect collaboration space</p>
        </div>
        
        <div class="header-actions">
          <button type="button" 
                  class="action-btn secondary"
                  (click)="resetForm()"
                  [disabled]="isCreating">
            <span class="icon">🔄</span>
            Reset
          </button>
          
          <button type="button" 
                  class="action-btn secondary"
                  (click)="togglePreview()"
                  [class.active]="showPreview">
            <span class="icon">👁️</span>
            Preview
          </button>
        </div>
      </div>

      <div class="creation-content">
        
        <!-- Template Selection -->
        <div class="template-section" *ngIf="currentStep === 'template'">
          <div class="section-header">
            <h3>Choose a Template</h3>
            <p>Start with a pre-configured room or create from scratch</p>
          </div>
          
          <div class="template-categories">
            <button type="button" 
                    *ngFor="let category of categories"
                    class="category-btn"
                    [class.active]="selectedCategory === category.id"
                    (click)="selectCategory(category.id)"
                    [style.--category-color]="category.color">
              <span class="category-icon">{{ category.icon }}</span>
              <span class="category-name">{{ category.name }}</span>
            </button>
          </div>
          
          <div class="templates-grid">
            <div *ngFor="let template of filteredTemplates(); trackBy: trackTemplate" 
                 class="template-card"
                 [class.selected]="selectedTemplate?.id === template.id"
                 [class.popular]="template.popular"
                 (click)="selectTemplate(template)">
              
              <div class="template-header">
                <span class="template-icon">{{ template.icon }}</span>
                <div class="template-badge" *ngIf="template.popular">Popular</div>
              </div>
              
              <div class="template-content">
                <h4 class="template-name">{{ template.name }}</h4>
                <p class="template-description">{{ template.description }}</p>
                
                <div class="template-features">
                  <span *ngFor="let feature of template.features.slice(0, 3)" 
                        class="feature-tag">
                    {{ feature }}
                  </span>
                  <span *ngIf="template.features.length > 3" 
                        class="feature-more">
                    +{{ template.features.length - 3 }} more
                  </span>
                </div>
              </div>
            </div>
            
            <!-- Custom Template -->
            <div class="template-card custom-template"
                 [class.selected]="selectedTemplate === null"
                 (click)="selectCustomTemplate()">
              <div class="template-header">
                <span class="template-icon">⚡</span>
              </div>
              <div class="template-content">
                <h4 class="template-name">Custom Room</h4>
                <p class="template-description">Create a room with your own settings</p>
                <div class="template-features">
                  <span class="feature-tag">Fully Customizable</span>
                </div>
              </div>
            </div>
          </div>
          
          <div class="step-actions">
            <button type="button" 
                    class="action-btn primary"
                    (click)="nextStep()"
                    [disabled]="!selectedTemplate && selectedCategory !== 'custom'">
              Continue
              <span class="icon">→</span>
            </button>
          </div>
        </div>

        <!-- Room Configuration -->
        <div class="configuration-section" *ngIf="currentStep === 'config'">
          <div class="section-header">
            <h3>Room Configuration</h3>
            <p>Customize your room settings</p>
          </div>
          
          <div class="config-form">
            <!-- Basic Information -->
            <div class="form-section">
              <h4>Basic Information</h4>
              
              <div class="form-group">
                <label for="room-name" class="required">Room Name</label>
                <input type="text" 
                       id="room-name"
                       class="form-input"
                       [(ngModel)]="roomOptions.name"
                       [class.error]="validationErrors()['name']"
                       placeholder="Enter room name"
                       maxlength="50"
                       required>
                <div class="field-error" *ngIf="validationErrors()['name']">
                  {{ validationErrors()['name'] }}
                </div>
                <div class="field-hint">
                  {{ roomOptions.name.length }}/50 characters
                </div>
              </div>
              
              <div class="form-group">
                <label for="room-description">Description</label>
                <textarea id="room-description"
                          class="form-textarea"
                          [(ngModel)]="roomOptions.description"
                          placeholder="Describe your room (optional)"
                          maxlength="200"
                          rows="3">
                </textarea>
                <div class="field-hint">
                  {{ roomOptions.description.length }}/200 characters
                </div>
              </div>
              
              <div class="form-group">
                <label for="room-category">Category</label>
                <select id="room-category"
                        class="form-select"
                        [(ngModel)]="roomOptions.category">
                  <option *ngFor="let category of categories" [value]="category.id">
                    {{ category.name }}
                  </option>
                </select>
              </div>
              
              <div class="form-group">
                <label for="room-tags">Tags</label>
                <div class="tags-input">
                  <div class="tags-list">
                    <span *ngFor="let tag of roomOptions.tags; trackBy: trackTag" 
                          class="tag-item">
                      {{ tag }}
                      <button type="button" 
                              class="tag-remove"
                              (click)="removeTag(tag)">
                        ×
                      </button>
                    </span>
                  </div>
                  <input type="text" 
                         id="room-tags"
                         class="tag-input"
                         [(ngModel)]="newTag"
                         (keydown.enter)="addTag($any($event))"
                         (keydown.comma)="addTag($any($event))"
                         placeholder="Add tags...">
                </div>
                <div class="field-hint">
                  Press Enter or comma to add tags
                </div>
              </div>
            </div>

            <!-- Privacy & Access -->
            <div class="form-section">
              <h4>Privacy & Access</h4>
              
              <div class="form-group">
                <label>Room Type</label>
                <div class="radio-group">
                  <label class="radio-label">
                    <input type="radio" 
                           name="roomType" 
                           value="public"
                           [(ngModel)]="roomOptions.type">
                    <span class="radio-button"></span>
                    <div class="radio-content">
                      <span class="radio-title">🌍 Public</span>
                      <span class="radio-description">Anyone can find and join</span>
                    </div>
                  </label>
                  
                  <label class="radio-label">
                    <input type="radio" 
                           name="roomType" 
                           value="protected"
                           [(ngModel)]="roomOptions.type">
                    <span class="radio-button"></span>
                    <div class="radio-content">
                      <span class="radio-title">🔐 Protected</span>
                      <span class="radio-description">Public but requires password</span>
                    </div>
                  </label>
                  
                  <label class="radio-label">
                    <input type="radio" 
                           name="roomType" 
                           value="private"
                           [(ngModel)]="roomOptions.type">
                    <span class="radio-button"></span>
                    <div class="radio-content">
                      <span class="radio-title">🔒 Private</span>
                      <span class="radio-description">Invite only</span>
                    </div>
                  </label>
                </div>
              </div>
              
              <div class="form-group" *ngIf="roomOptions.type === 'protected'">
                <label for="room-password" class="required">Password</label>
                <div class="password-input">
                  <input [type]="showPassword ? 'text' : 'password'" 
                         id="room-password"
                         class="form-input"
                         [(ngModel)]="roomOptions.password"
                         [class.error]="validationErrors()['password']"
                         placeholder="Enter room password"
                         required>
                  <button type="button" 
                          class="password-toggle"
                          (click)="togglePasswordVisibility()">
                    {{ showPassword ? '🙈' : '👁️' }}
                  </button>
                </div>
                <div class="field-error" *ngIf="validationErrors()['password']">
                  {{ validationErrors()['password'] }}
                </div>
              </div>
              
              <div class="form-group">
                <label for="max-participants">Maximum Participants</label>
                <div class="number-input">
                  <button type="button" 
                          class="number-btn"
                          (click)="adjustParticipants(-1)"
                          [disabled]="roomOptions.maxParticipants <= 2">
                    -
                  </button>
                  <input type="number" 
                         id="max-participants"
                         class="form-input number"
                         [(ngModel)]="roomOptions.maxParticipants"
                         min="2"
                         max="50"
                         readonly>
                  <button type="button" 
                          class="number-btn"
                          (click)="adjustParticipants(1)"
                          [disabled]="roomOptions.maxParticipants >= 50">
                    +
                  </button>
                </div>
              </div>
            </div>

            <!-- Features & Permissions -->
            <div class="form-section">
              <h4>Features & Permissions</h4>
              
              <div class="checkbox-grid">
                <label class="checkbox-label">
                  <input type="checkbox" 
                         [(ngModel)]="roomOptions.requireApproval">
                  <span class="checkmark"></span>
                  <div class="checkbox-content">
                    <span class="checkbox-title">Require Approval</span>
                    <span class="checkbox-description">Review join requests</span>
                  </div>
                </label>
                
                <label class="checkbox-label">
                  <input type="checkbox" 
                         [(ngModel)]="roomOptions.allowGuests">
                  <span class="checkmark"></span>
                  <div class="checkbox-content">
                    <span class="checkbox-title">Allow Guests</span>
                    <span class="checkbox-description">Non-registered users can join</span>
                  </div>
                </label>
                
                <label class="checkbox-label">
                  <input type="checkbox" 
                         [(ngModel)]="roomOptions.waitingRoom">
                  <span class="checkmark"></span>
                  <div class="checkbox-content">
                    <span class="checkbox-title">Waiting Room</span>
                    <span class="checkbox-description">Hold participants before joining</span>
                  </div>
                </label>
                
                <label class="checkbox-label">
                  <input type="checkbox" 
                         [(ngModel)]="roomOptions.muteNewcomers">
                  <span class="checkmark"></span>
                  <div class="checkbox-content">
                    <span class="checkbox-title">Mute Newcomers</span>
                    <span class="checkbox-description">New participants join muted</span>
                  </div>
                </label>
                
                <label class="checkbox-label">
                  <input type="checkbox" 
                         [(ngModel)]="roomOptions.enableChat">
                  <span class="checkmark"></span>
                  <div class="checkbox-content">
                    <span class="checkbox-title">Enable Chat</span>
                    <span class="checkbox-description">Text messaging during session</span>
                  </div>
                </label>
                
                <label class="checkbox-label">
                  <input type="checkbox" 
                         [(ngModel)]="roomOptions.enableFileSharing">
                  <span class="checkmark"></span>
                  <div class="checkbox-content">
                    <span class="checkbox-title">File Sharing</span>
                    <span class="checkbox-description">Allow file exchange</span>
                  </div>
                </label>
                
                <label class="checkbox-label">
                  <input type="checkbox" 
                         [(ngModel)]="roomOptions.recordSession">
                  <span class="checkmark"></span>
                  <div class="checkbox-content">
                    <span class="checkbox-title">Record Sessions</span>
                    <span class="checkbox-description">Save session recordings</span>
                  </div>
                </label>
                
                <label class="checkbox-label">
                  <input type="checkbox" 
                         [(ngModel)]="roomOptions.autoDelete">
                  <span class="checkmark"></span>
                  <div class="checkbox-content">
                    <span class="checkbox-title">Auto Delete</span>
                    <span class="checkbox-description">Remove room after inactivity</span>
                  </div>
                </label>
              </div>
            </div>

            <!-- Advanced Settings -->
            <div class="form-section" *ngIf="showAdvanced">
              <h4>Advanced Settings</h4>
              
              <div class="form-group">
                <label for="room-language">Language</label>
                <select id="room-language"
                        class="form-select"
                        [(ngModel)]="roomOptions.language">
                  <option value="English">English</option>
                  <option value="Spanish">Español</option>
                  <option value="French">Français</option>
                  <option value="German">Deutsch</option>
                  <option value="Chinese">中文</option>
                  <option value="Japanese">日本語</option>
                </select>
              </div>
              
              <div class="form-group">
                <label for="session-duration">Session Duration (minutes)</label>
                <select id="session-duration"
                        class="form-select"
                        [(ngModel)]="roomOptions.duration">
                  <option [value]="0">Unlimited</option>
                  <option [value]="30">30 minutes</option>
                  <option [value]="60">1 hour</option>
                  <option [value]="120">2 hours</option>
                  <option [value]="240">4 hours</option>
                  <option [value]="480">8 hours</option>
                </select>
              </div>
              
              <div class="form-group">
                <label class="checkbox-label">
                  <input type="checkbox" 
                         [(ngModel)]="roomOptions.lobbyMusic">
                  <span class="checkmark"></span>
                  <div class="checkbox-content">
                    <span class="checkbox-title">Lobby Music</span>
                    <span class="checkbox-description">Play background music in waiting room</span>
                  </div>
                </label>
              </div>
            </div>
          </div>
          
          <div class="advanced-toggle">
            <button type="button" 
                    class="toggle-btn"
                    (click)="toggleAdvanced()">
              <span class="icon">{{ showAdvanced ? '⬆️' : '⬇️' }}</span>
              {{ showAdvanced ? 'Hide' : 'Show' }} Advanced Settings
            </button>
          </div>
          
          <div class="step-actions">
            <button type="button" 
                    class="action-btn secondary"
                    (click)="previousStep()">
              <span class="icon">←</span>
              Back
            </button>
            
            <button type="button" 
                    class="action-btn primary"
                    (click)="nextStep()"
                    [disabled]="!isConfigValid()">
              Continue
              <span class="icon">→</span>
            </button>
          </div>
        </div>

        <!-- Review & Create -->
        <div class="review-section" *ngIf="currentStep === 'review'">
          <div class="section-header">
            <h3>Review & Create</h3>
            <p>Confirm your room settings before creation</p>
          </div>
          
          <div class="review-content">
            <div class="review-card">
              <div class="review-header">
                <h4>{{ roomOptions.name }}</h4>
                <span class="room-type-badge" [class]="'type-' + roomOptions.type">
                  {{ roomOptions.type.toUpperCase() }}
                </span>
              </div>
              
              <div class="review-body">
                <p class="room-description" *ngIf="roomOptions.description">
                  {{ roomOptions.description }}
                </p>
                
                <div class="review-details">
                  <div class="detail-item">
                    <span class="detail-label">Category:</span>
                    <span class="detail-value">{{ getCategoryName(roomOptions.category) }}</span>
                  </div>
                  
                  <div class="detail-item">
                    <span class="detail-label">Max Participants:</span>
                    <span class="detail-value">{{ roomOptions.maxParticipants }}</span>
                  </div>
                  
                  <div class="detail-item">
                    <span class="detail-label">Language:</span>
                    <span class="detail-value">{{ roomOptions.language }}</span>
                  </div>
                  
                  <div class="detail-item" *ngIf="roomOptions.duration">
                    <span class="detail-label">Duration:</span>
                    <span class="detail-value">{{ formatDuration(roomOptions.duration) }}</span>
                  </div>
                </div>
                
                <div class="review-tags" *ngIf="roomOptions.tags.length > 0">
                  <span *ngFor="let tag of roomOptions.tags" class="review-tag">
                    {{ tag }}
                  </span>
                </div>
                
                <div class="review-features">
                  <h5>Enabled Features:</h5>
                  <div class="features-list">
                    <span *ngFor="let feature of getEnabledFeatures()" class="feature-item">
                      {{ feature }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div class="step-actions">
            <button type="button" 
                    class="action-btn secondary"
                    (click)="previousStep()">
              <span class="icon">←</span>
              Back
            </button>
            
            <button type="button" 
                    class="action-btn primary large"
                    (click)="createRoom()"
                    [disabled]="isCreating">
              <span class="icon" *ngIf="!isCreating">🚀</span>
              <span class="spinner" *ngIf="isCreating"></span>
              {{ isCreating ? 'Creating Room...' : 'Create Room' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Preview Panel -->
      <div class="preview-panel" *ngIf="showPreview">
        <div class="preview-header">
          <h4>Room Preview</h4>
          <button type="button" 
                  class="close-btn"
                  (click)="togglePreview()">
            ×
          </button>
        </div>
        
        <div class="preview-content">
          <div class="preview-room-card">
            <div class="room-header">
              <div class="room-title">
                <h5>{{ roomOptions.name || 'Room Name' }}</h5>
                <span class="type-indicator" [class]="'type-' + roomOptions.type">
                  {{ getTypeIcon(roomOptions.type) }}
                </span>
              </div>
              <div class="room-meta">
                <span class="participants">👥 0/{{ roomOptions.maxParticipants }}</span>
                <span class="category">{{ getCategoryName(roomOptions.category) }}</span>
              </div>
            </div>
            
            <div class="room-description" *ngIf="roomOptions.description">
              {{ roomOptions.description }}
            </div>
            
            <div class="room-tags" *ngIf="roomOptions.tags.length > 0">
              <span *ngFor="let tag of roomOptions.tags" class="preview-tag">
                {{ tag }}
              </span>
            </div>
            
            <div class="room-features">
              <span *ngFor="let feature of getFeatureIcons()" 
                    class="feature-icon"
                    [title]="feature.label">
                {{ feature.icon }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .room-creation-container {
      background: #ffffff;
      border: 1px solid #e0e0e0;
      border-radius: 12px;
      display: flex;
      flex-direction: column;
      height: 700px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      overflow: hidden;
      position: relative;
    }

    .creation-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 24px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .header-content h2 {
      margin: 0;
      font-size: 20px;
      font-weight: 600;
    }

    .header-content p {
      margin: 4px 0 0 0;
      font-size: 14px;
      opacity: 0.9;
    }

    .header-actions {
      display: flex;
      gap: 8px;
    }

    .action-btn {
      padding: 8px 16px;
      border: 1px solid transparent;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      font-weight: 500;
      min-height: 36px;
    }

    .action-btn.primary {
      background: #007bff;
      color: white;
    }

    .action-btn.primary:hover:not(:disabled) {
      background: #0056b3;
    }

    .action-btn.secondary {
      background: rgba(255,255,255,0.1);
      border-color: rgba(255,255,255,0.3);
      color: white;
    }

    .action-btn.secondary:hover:not(:disabled) {
      background: rgba(255,255,255,0.2);
    }

    .action-btn.large {
      padding: 12px 24px;
      font-size: 16px;
    }

    .action-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .action-btn.active {
      background: rgba(255,255,255,0.2);
    }

    .creation-content {
      flex: 1;
      overflow-y: auto;
      padding: 24px;
    }

    .section-header {
      margin-bottom: 24px;
    }

    .section-header h3 {
      margin: 0 0 8px 0;
      font-size: 18px;
      color: #333;
    }

    .section-header p {
      margin: 0;
      font-size: 14px;
      color: #666;
    }

    /* Template Selection */
    .template-categories {
      display: flex;
      gap: 8px;
      margin-bottom: 24px;
      flex-wrap: wrap;
    }

    .category-btn {
      padding: 12px 16px;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      background: #ffffff;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
    }

    .category-btn:hover {
      border-color: var(--category-color, #007bff);
      background: rgba(var(--category-color-rgb, 0, 123, 255), 0.05);
    }

    .category-btn.active {
      border-color: var(--category-color, #007bff);
      background: var(--category-color, #007bff);
      color: white;
    }

    .templates-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }

    .template-card {
      border: 2px solid #e0e0e0;
      border-radius: 12px;
      padding: 20px;
      cursor: pointer;
      transition: all 0.2s ease;
      background: #ffffff;
      position: relative;
    }

    .template-card:hover {
      border-color: #007bff;
      box-shadow: 0 4px 12px rgba(0, 123, 255, 0.15);
    }

    .template-card.selected {
      border-color: #007bff;
      background: rgba(0, 123, 255, 0.05);
    }

    .template-card.popular::before {
      content: "✨ Popular";
      position: absolute;
      top: -8px;
      right: 16px;
      background: #ffd700;
      color: #333;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 600;
    }

    .template-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }

    .template-icon {
      font-size: 32px;
    }

    .template-name {
      margin: 0 0 8px 0;
      font-size: 16px;
      font-weight: 600;
      color: #333;
    }

    .template-description {
      margin: 0 0 12px 0;
      font-size: 14px;
      color: #666;
      line-height: 1.4;
    }

    .template-features {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }

    .feature-tag {
      padding: 2px 6px;
      background: #e9ecef;
      border-radius: 4px;
      font-size: 11px;
      color: #495057;
    }

    .feature-more {
      padding: 2px 6px;
      background: #dee2e6;
      border-radius: 4px;
      font-size: 11px;
      color: #6c757d;
      font-style: italic;
    }

    /* Configuration Form */
    .config-form {
      display: flex;
      flex-direction: column;
      gap: 32px;
    }

    .form-section {
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 20px;
      background: #f8f9fa;
    }

    .form-section h4 {
      margin: 0 0 16px 0;
      font-size: 16px;
      color: #333;
      border-bottom: 1px solid #e0e0e0;
      padding-bottom: 8px;
    }

    .form-group {
      margin-bottom: 16px;
    }

    .form-group label {
      display: block;
      margin-bottom: 4px;
      font-size: 14px;
      font-weight: 600;
      color: #333;
    }

    .form-group label.required::after {
      content: " *";
      color: #dc3545;
    }

    .form-input, .form-textarea, .form-select {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid #d0d0d0;
      border-radius: 6px;
      font-size: 14px;
      outline: none;
      background: #ffffff;
      box-sizing: border-box;
    }

    .form-input:focus, .form-textarea:focus, .form-select:focus {
      border-color: #007bff;
      box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.2);
    }

    .form-input.error, .form-textarea.error {
      border-color: #dc3545;
      box-shadow: 0 0 0 2px rgba(220, 53, 69, 0.2);
    }

    .field-error {
      color: #dc3545;
      font-size: 12px;
      margin-top: 4px;
    }

    .field-hint {
      color: #666;
      font-size: 12px;
      margin-top: 4px;
    }

    /* Tags Input */
    .tags-input {
      border: 1px solid #d0d0d0;
      border-radius: 6px;
      padding: 8px;
      background: #ffffff;
      min-height: 40px;
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      align-items: center;
    }

    .tags-input:focus-within {
      border-color: #007bff;
      box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.2);
    }

    .tags-list {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }

    .tag-item {
      padding: 4px 8px;
      background: #007bff;
      color: white;
      border-radius: 4px;
      font-size: 12px;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .tag-remove {
      background: none;
      border: none;
      color: white;
      cursor: pointer;
      font-size: 14px;
      line-height: 1;
      padding: 0;
      width: 16px;
      height: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
    }

    .tag-remove:hover {
      background: rgba(255,255,255,0.2);
    }

    .tag-input {
      border: none;
      outline: none;
      flex: 1;
      min-width: 100px;
      padding: 4px;
      font-size: 14px;
    }

    /* Radio Groups */
    .radio-group {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .radio-label {
      display: flex;
      align-items: center;
      gap: 12px;
      cursor: pointer;
      padding: 12px;
      border: 1px solid #e0e0e0;
      border-radius: 6px;
      transition: all 0.2s ease;
    }

    .radio-label:hover {
      border-color: #007bff;
      background: rgba(0, 123, 255, 0.05);
    }

    .radio-label input[type="radio"] {
      display: none;
    }

    .radio-button {
      width: 20px;
      height: 20px;
      border: 2px solid #d0d0d0;
      border-radius: 50%;
      position: relative;
      flex-shrink: 0;
    }

    .radio-label input[type="radio"]:checked + .radio-button {
      border-color: #007bff;
    }

    .radio-label input[type="radio"]:checked + .radio-button::after {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 10px;
      height: 10px;
      background: #007bff;
      border-radius: 50%;
    }

    .radio-content {
      flex: 1;
    }

    .radio-title {
      font-weight: 600;
      color: #333;
      display: block;
      margin-bottom: 2px;
    }

    .radio-description {
      font-size: 12px;
      color: #666;
    }

    /* Number Input */
    .number-input {
      display: flex;
      align-items: center;
      width: fit-content;
    }

    .number-btn {
      width: 36px;
      height: 36px;
      border: 1px solid #d0d0d0;
      background: #ffffff;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      font-weight: 600;
    }

    .number-btn:first-child {
      border-top-left-radius: 6px;
      border-bottom-left-radius: 6px;
      border-right: none;
    }

    .number-btn:last-child {
      border-top-right-radius: 6px;
      border-bottom-right-radius: 6px;
      border-left: none;
    }

    .number-btn:hover:not(:disabled) {
      background: #f8f9fa;
    }

    .number-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .form-input.number {
      width: 80px;
      text-align: center;
      border-radius: 0;
      border-left: none;
      border-right: none;
    }

    /* Password Input */
    .password-input {
      position: relative;
      display: flex;
      align-items: center;
    }

    .password-toggle {
      position: absolute;
      right: 8px;
      background: none;
      border: none;
      cursor: pointer;
      font-size: 16px;
      padding: 4px;
    }

    /* Checkbox Grid */
    .checkbox-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 12px;
    }

    .checkbox-label {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      cursor: pointer;
      padding: 12px;
      border: 1px solid #e0e0e0;
      border-radius: 6px;
      transition: all 0.2s ease;
    }

    .checkbox-label:hover {
      border-color: #007bff;
      background: rgba(0, 123, 255, 0.05);
    }

    .checkbox-label input[type="checkbox"] {
      display: none;
    }

    .checkmark {
      width: 20px;
      height: 20px;
      border: 2px solid #d0d0d0;
      border-radius: 4px;
      position: relative;
      flex-shrink: 0;
      background: #ffffff;
    }

    .checkbox-label input[type="checkbox"]:checked + .checkmark {
      border-color: #007bff;
      background: #007bff;
    }

    .checkbox-label input[type="checkbox"]:checked + .checkmark::after {
      content: '✓';
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: white;
      font-size: 12px;
      font-weight: 600;
    }

    .checkbox-content {
      flex: 1;
    }

    .checkbox-title {
      font-weight: 600;
      color: #333;
      display: block;
      margin-bottom: 2px;
    }

    .checkbox-description {
      font-size: 12px;
      color: #666;
    }

    /* Advanced Toggle */
    .advanced-toggle {
      margin: 24px 0;
      display: flex;
      justify-content: center;
    }

    .toggle-btn {
      padding: 8px 16px;
      border: 1px solid #d0d0d0;
      border-radius: 6px;
      background: #ffffff;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
    }

    .toggle-btn:hover {
      border-color: #007bff;
      background: #f8f9fa;
    }

    /* Step Actions */
    .step-actions {
      display: flex;
      justify-content: space-between;
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid #e0e0e0;
    }

    /* Review Section */
    .review-card {
      border: 1px solid #e0e0e0;
      border-radius: 12px;
      padding: 24px;
      background: #ffffff;
    }

    .review-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      padding-bottom: 16px;
      border-bottom: 1px solid #e0e0e0;
    }

    .review-header h4 {
      margin: 0;
      font-size: 18px;
      color: #333;
    }

    .room-type-badge {
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
    }

    .room-type-badge.type-public {
      background: #e8f5e8;
      color: #28a745;
    }

    .room-type-badge.type-protected {
      background: #fff3cd;
      color: #856404;
    }

    .room-type-badge.type-private {
      background: #f8d7da;
      color: #721c24;
    }

    .room-description {
      margin: 0 0 16px 0;
      color: #666;
      font-style: italic;
    }

    .review-details {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 12px;
      margin-bottom: 16px;
    }

    .detail-item {
      display: flex;
      justify-content: space-between;
      padding: 8px 12px;
      background: #f8f9fa;
      border-radius: 6px;
    }

    .detail-label {
      font-weight: 600;
      color: #333;
    }

    .detail-value {
      color: #666;
    }

    .review-tags {
      margin-bottom: 16px;
    }

    .review-tag {
      display: inline-block;
      padding: 4px 8px;
      background: #007bff;
      color: white;
      border-radius: 4px;
      font-size: 12px;
      margin: 0 4px 4px 0;
    }

    .review-features h5 {
      margin: 0 0 8px 0;
      font-size: 14px;
      color: #333;
    }

    .features-list {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }

    .feature-item {
      padding: 4px 8px;
      background: #e8f5e8;
      color: #28a745;
      border-radius: 4px;
      font-size: 12px;
    }

    /* Preview Panel */
    .preview-panel {
      position: absolute;
      top: 0;
      right: 0;
      width: 320px;
      height: 100%;
      background: #ffffff;
      border-left: 1px solid #e0e0e0;
      box-shadow: -4px 0 12px rgba(0,0,0,0.1);
      z-index: 10;
    }

    .preview-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      background: #f8f9fa;
      border-bottom: 1px solid #e0e0e0;
    }

    .preview-header h4 {
      margin: 0;
      font-size: 16px;
      color: #333;
    }

    .close-btn {
      width: 24px;
      height: 24px;
      border: none;
      background: none;
      cursor: pointer;
      font-size: 18px;
      color: #666;
    }

    .preview-content {
      padding: 20px;
    }

    .preview-room-card {
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 16px;
      background: #ffffff;
    }

    .room-header {
      margin-bottom: 12px;
    }

    .room-title {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 4px;
    }

    .room-title h5 {
      margin: 0;
      font-size: 14px;
      color: #333;
    }

    .type-indicator {
      font-size: 12px;
    }

    .room-meta {
      display: flex;
      gap: 12px;
      font-size: 12px;
      color: #666;
    }

    .preview-tag {
      display: inline-block;
      padding: 2px 6px;
      background: #e9ecef;
      border-radius: 4px;
      font-size: 10px;
      margin: 0 2px 2px 0;
    }

    .room-features {
      display: flex;
      gap: 4px;
      margin-top: 8px;
    }

    .feature-icon {
      font-size: 16px;
    }

    /* Spinner */
    .spinner {
      width: 16px;
      height: 16px;
      border: 2px solid #ffffff;
      border-top: 2px solid transparent;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    /* Responsive */
    @media (max-width: 768px) {
      .room-creation-container {
        height: 100vh;
        border-radius: 0;
      }

      .creation-header {
        padding: 16px 20px;
      }

      .creation-content {
        padding: 20px;
      }

      .templates-grid {
        grid-template-columns: 1fr;
      }

      .checkbox-grid {
        grid-template-columns: 1fr;
      }

      .review-details {
        grid-template-columns: 1fr;
      }

      .step-actions {
        flex-direction: column;
        gap: 12px;
      }

      .preview-panel {
        position: fixed;
        width: 100%;
        z-index: 20;
      }
    }
  `]
})
export class RoomCreationComponent implements OnInit, OnDestroy {
  @Output() roomCreate = new EventEmitter<RoomCreationOptions>();
  @Output() cancel = new EventEmitter<void>();

  // Signals for reactive state
  private _templates = signal<RoomTemplate[]>([]);
  private _validationErrors = signal<Record<string, string>>({});

  // Component state
  currentStep: 'template' | 'config' | 'review' = 'template';
  selectedCategory = 'general';
  selectedTemplate: RoomTemplate | null = null;
  showPreview = false;
  showAdvanced = false;
  showPassword = false;
  isCreating = false;
  newTag = '';

  // Room options
  roomOptions: RoomCreationOptions = {
    name: '',
    description: '',
    type: 'public',
    maxParticipants: 10,
    requireApproval: false,
    allowGuests: true,
    recordSession: false,
    enableChat: true,
    enableFileSharing: true,
    muteNewcomers: false,
    language: 'English',
    tags: [],
    category: 'general',
    autoDelete: false,
    waitingRoom: false,
    lobbyMusic: false
  };

  // Categories configuration
  categories: CategoryConfig[] = [
    {
      id: 'general',
      name: 'General',
      icon: '💬',
      color: '#007bff',
      description: 'General purpose rooms',
      defaultSettings: {}
    },
    {
      id: 'gaming',
      name: 'Gaming',
      icon: '🎮',
      color: '#28a745',
      description: 'Gaming and entertainment',
      defaultSettings: { enableFileSharing: false, muteNewcomers: true }
    },
    {
      id: 'business',
      name: 'Business',
      icon: '💼',
      color: '#6f42c1',
      description: 'Professional meetings',
      defaultSettings: { recordSession: true, requireApproval: true }
    },
    {
      id: 'education',
      name: 'Education',
      icon: '📚',
      color: '#fd7e14',
      description: 'Learning and teaching',
      defaultSettings: { muteNewcomers: true, waitingRoom: true }
    },
    {
      id: 'social',
      name: 'Social',
      icon: '👥',
      color: '#e83e8c',
      description: 'Social gatherings',
      defaultSettings: { allowGuests: true, lobbyMusic: true }
    }
  ];

  // Computed signals
  filteredTemplates = computed(() => {
    return this._templates().filter(template => 
      this.selectedCategory === 'all' || template.category === this.selectedCategory
    );
  });

  validationErrors = computed(() => this._validationErrors());

  private subscriptions = new Subscription();

  ngOnInit(): void {
    this.loadTemplates();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  /**
   * Select category
   */
  selectCategory(categoryId: string): void {
    this.selectedCategory = categoryId;
    this.selectedTemplate = null;
  }

  /**
   * Select template
   */
  selectTemplate(template: RoomTemplate): void {
    this.selectedTemplate = template;
    this.applyTemplate(template);
  }

  /**
   * Select custom template
   */
  selectCustomTemplate(): void {
    this.selectedTemplate = null;
    this.selectedCategory = 'custom';
  }

  /**
   * Apply template settings
   */
  private applyTemplate(template: RoomTemplate): void {
    this.roomOptions = {
      ...this.roomOptions,
      ...template.settings,
      name: template.name,
      description: template.description,
      category: template.category,
      tags: [...(template.settings.tags || [])]
    };
  }

  /**
   * Navigate to next step
   */
  nextStep(): void {
    switch (this.currentStep) {
      case 'template':
        this.currentStep = 'config';
        break;
      case 'config':
        if (this.isConfigValid()) {
          this.currentStep = 'review';
        }
        break;
      case 'review':
        this.createRoom();
        break;
    }
  }

  /**
   * Navigate to previous step
   */
  previousStep(): void {
    switch (this.currentStep) {
      case 'config':
        this.currentStep = 'template';
        break;
      case 'review':
        this.currentStep = 'config';
        break;
    }
  }

  /**
   * Validate configuration
   */
  isConfigValid(): boolean {
    const errors: Record<string, string> = {};

    if (!this.roomOptions.name.trim()) {
      errors['name'] = 'Room name is required';
    } else if (this.roomOptions.name.length < 3) {
      errors['name'] = 'Room name must be at least 3 characters';
    }

    if (this.roomOptions.type === 'protected' && !this.roomOptions.password) {
      errors['password'] = 'Password is required for protected rooms';
    } else if (this.roomOptions.password && this.roomOptions.password.length < 4) {
      errors['password'] = 'Password must be at least 4 characters';
    }

    this._validationErrors.set(errors);
    return Object.keys(errors).length === 0;
  }

  /**
   * Reset form
   */
  resetForm(): void {
    this.currentStep = 'template';
    this.selectedTemplate = null;
    this.selectedCategory = 'general';
    this.roomOptions = {
      name: '',
      description: '',
      type: 'public',
      maxParticipants: 10,
      requireApproval: false,
      allowGuests: true,
      recordSession: false,
      enableChat: true,
      enableFileSharing: true,
      muteNewcomers: false,
      language: 'English',
      tags: [],
      category: 'general',
      autoDelete: false,
      waitingRoom: false,
      lobbyMusic: false
    };
    this._validationErrors.set({});
  }

  /**
   * Toggle preview panel
   */
  togglePreview(): void {
    this.showPreview = !this.showPreview;
  }

  /**
   * Toggle advanced settings
   */
  toggleAdvanced(): void {
    this.showAdvanced = !this.showAdvanced;
  }

  /**
   * Toggle password visibility
   */
  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  /**
   * Adjust participant count
   */
  adjustParticipants(delta: number): void {
    const newValue = this.roomOptions.maxParticipants + delta;
    if (newValue >= 2 && newValue <= 50) {
      this.roomOptions.maxParticipants = newValue;
    }
  }

  /**
   * Add tag
   */
  addTag(event: KeyboardEvent): void {
    if ((event.key === 'Enter' || event.key === ',') && this.newTag.trim()) {
      event.preventDefault();
      const tag = this.newTag.trim().toLowerCase();
      if (!this.roomOptions.tags.includes(tag) && this.roomOptions.tags.length < 10) {
        this.roomOptions.tags.push(tag);
        this.newTag = '';
      }
    }
  }

  /**
   * Remove tag
   */
  removeTag(tag: string): void {
    this.roomOptions.tags = this.roomOptions.tags.filter(t => t !== tag);
  }

  /**
   * Create room
   */
  createRoom(): void {
    if (!this.isConfigValid()) return;

    this.isCreating = true;
    
    // Simulate API call
    setTimeout(() => {
      this.roomCreate.emit({ ...this.roomOptions });
      this.isCreating = false;
    }, 2000);
  }

  /**
   * Get category name
   */
  getCategoryName(categoryId: string): string {
    const category = this.categories.find(c => c.id === categoryId);
    return category?.name || categoryId;
  }

  /**
   * Get enabled features list
   */
  getEnabledFeatures(): string[] {
    const features: string[] = [];
    
    if (this.roomOptions.enableChat) features.push('Chat');
    if (this.roomOptions.enableFileSharing) features.push('File Sharing');
    if (this.roomOptions.recordSession) features.push('Recording');
    if (this.roomOptions.waitingRoom) features.push('Waiting Room');
    if (this.roomOptions.requireApproval) features.push('Approval Required');
    if (this.roomOptions.allowGuests) features.push('Guest Access');
    if (this.roomOptions.muteNewcomers) features.push('Auto Mute');
    if (this.roomOptions.lobbyMusic) features.push('Lobby Music');
    
    return features;
  }

  /**
   * Get type icon
   */
  getTypeIcon(type: string): string {
    switch (type) {
      case 'public': return '🌍';
      case 'protected': return '🔐';
      case 'private': return '🔒';
      default: return '🌍';
    }
  }

  /**
   * Get feature icons for preview
   */
  getFeatureIcons(): Array<{ icon: string; label: string }> {
    const icons: Array<{ icon: string; label: string }> = [];
    
    if (this.roomOptions.enableChat) icons.push({ icon: '💬', label: 'Chat' });
    if (this.roomOptions.enableFileSharing) icons.push({ icon: '📎', label: 'File Sharing' });
    if (this.roomOptions.recordSession) icons.push({ icon: '🔴', label: 'Recording' });
    if (this.roomOptions.waitingRoom) icons.push({ icon: '⏳', label: 'Waiting Room' });
    
    return icons.slice(0, 6); // Limit to 6 icons
  }

  /**
   * Format duration
   */
  formatDuration(minutes: number): string {
    if (minutes === 0) return 'Unlimited';
    if (minutes < 60) return `${minutes} minutes`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (remainingMinutes === 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
    return `${hours}h ${remainingMinutes}m`;
  }

  /**
   * Track template for ngFor
   */
  trackTemplate(index: number, template: RoomTemplate): string {
    return template.id;
  }

  /**
   * Track tag for ngFor
   */
  trackTag(index: number, tag: string): string {
    return tag;
  }

  /**
   * Load templates (mock data)
   */
  private loadTemplates(): void {
    const mockTemplates: RoomTemplate[] = [
      {
        id: 'quick-meeting',
        name: 'Quick Meeting',
        description: 'Fast setup for impromptu meetings',
        icon: '⚡',
        category: 'business',
        popular: true,
        features: ['Auto Mute', 'Waiting Room', 'Recording'],
        settings: {
          muteNewcomers: true,
          waitingRoom: true,
          recordSession: true,
          maxParticipants: 15
        }
      },
      {
        id: 'gaming-party',
        name: 'Gaming Party',
        description: 'Perfect for gaming sessions with friends',
        icon: '🎮',
        category: 'gaming',
        popular: true,
        features: ['High Quality Audio', 'Screen Share', 'Guest Access'],
        settings: {
          enableFileSharing: false,
          muteNewcomers: false,
          allowGuests: true,
          maxParticipants: 8
        }
      },
      {
        id: 'study-group',
        name: 'Study Group',
        description: 'Collaborative learning environment',
        icon: '📚',
        category: 'education',
        popular: false,
        features: ['File Sharing', 'Chat', 'Long Duration'],
        settings: {
          enableFileSharing: true,
          enableChat: true,
          duration: 240,
          maxParticipants: 12
        }
      },
      {
        id: 'social-hangout',
        name: 'Social Hangout',
        description: 'Casual conversations with friends',
        icon: '☕',
        category: 'social',
        popular: false,
        features: ['Lobby Music', 'Guest Access', 'Casual Settings'],
        settings: {
          lobbyMusic: true,
          allowGuests: true,
          requireApproval: false,
          maxParticipants: 20
        }
      },
      {
        id: 'presentation',
        name: 'Presentation',
        description: 'One-to-many presentation setup',
        icon: '🎯',
        category: 'business',
        popular: false,
        features: ['Auto Mute', 'Recording', 'Large Capacity'],
        settings: {
          muteNewcomers: true,
          recordSession: true,
          maxParticipants: 50,
          requireApproval: true
        }
      },
      {
        id: 'workshop',
        name: 'Workshop',
        description: 'Interactive learning and collaboration',
        icon: '🛠️',
        category: 'education',
        popular: false,
        features: ['File Sharing', 'Breakout Rooms', 'Recording'],
        settings: {
          enableFileSharing: true,
          recordSession: true,
          waitingRoom: true,
          maxParticipants: 25
        }
      }
    ];

    this._templates.set(mockTemplates);
  }
}

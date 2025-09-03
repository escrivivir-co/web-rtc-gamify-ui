import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, Signal, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

export interface RoomParticipant {
  id: string;
  name: string;
  role: 'owner' | 'moderator' | 'member';
  isOnline: boolean;
  joinedAt: Date;
  lastSeen: Date;
  permissions: ParticipantPermissions;
  avatar?: string;
  status?: string;
}

export interface ParticipantPermissions {
  canSpeak: boolean;
  canVideo: boolean;
  canScreenShare: boolean;
  canChat: boolean;
  canInvite: boolean;
  canKick: boolean;
  canMute: boolean;
}

export interface RoomSettings {
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
}

export interface ModerationAction {
  type: 'mute' | 'unmute' | 'kick' | 'ban' | 'promote' | 'demote' | 'givePermission' | 'revokePermission';
  targetId: string;
  targetName: string;
  reason?: string;
  duration?: number; // for temporary actions
  permission?: keyof ParticipantPermissions;
}

@Component({
  selector: 'webrtc-room-controls',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="room-controls-container" [class.minimized]="isMinimized">
      
      <!-- Header -->
      <div class="controls-header">
        <div class="room-info">
          <h3 class="room-name">{{ currentRoom?.name || 'Room Controls' }}</h3>
          <span class="participant-count">
            {{ participants().length }} participant{{ participants().length !== 1 ? 's' : '' }}
          </span>
        </div>
        
        <div class="header-actions">
          <button type="button" 
                  class="header-btn"
                  (click)="toggleSettings()"
                  [class.active]="showSettings"
                  title="Room Settings">
            <span class="icon">⚙️</span>
          </button>
          
          <button type="button" 
                  class="header-btn"
                  (click)="toggleParticipants()"
                  [class.active]="showParticipants"
                  title="Manage Participants">
            <span class="icon">👥</span>
          </button>
          
          <button type="button" 
                  class="header-btn"
                  (click)="toggleMinimize()"
                  title="{{ isMinimized ? 'Expand' : 'Minimize' }}">
            <span class="icon">{{ isMinimized ? '⬆️' : '⬇️' }}</span>
          </button>
          
          <button type="button" 
                  class="header-btn leave-btn"
                  (click)="leaveRoom()"
                  title="Leave Room">
            <span class="icon">🚪</span>
          </button>
        </div>
      </div>

      <!-- Content -->
      <div class="controls-content" *ngIf="!isMinimized">
        
        <!-- Quick Actions -->
        <div class="quick-actions">
          <button type="button" 
                  class="quick-btn"
                  [class.active]="roomState.muteAll"
                  (click)="toggleMuteAll()"
                  [disabled]="!canModerate"
                  title="Mute All Participants">
            <span class="icon">{{ roomState.muteAll ? '🔇' : '🔊' }}</span>
            <span class="label">{{ roomState.muteAll ? 'Unmute All' : 'Mute All' }}</span>
          </button>
          
          <button type="button" 
                  class="quick-btn"
                  [class.active]="roomState.lockRoom"
                  (click)="toggleLockRoom()"
                  [disabled]="!canModerate"
                  title="Lock/Unlock Room">
            <span class="icon">{{ roomState.lockRoom ? '🔒' : '🔓' }}</span>
            <span class="label">{{ roomState.lockRoom ? 'Unlock' : 'Lock' }}</span>
          </button>
          
          <button type="button" 
                  class="quick-btn"
                  (click)="inviteParticipants()"
                  [disabled]="!canInvite"
                  title="Invite Participants">
            <span class="icon">📧</span>
            <span class="label">Invite</span>
          </button>
          
          <button type="button" 
                  class="quick-btn"
                  [class.active]="roomState.recording"
                  (click)="toggleRecording()"
                  [disabled]="!canRecord"
                  title="Start/Stop Recording">
            <span class="icon">{{ roomState.recording ? '⏹️' : '🔴' }}</span>
            <span class="label">{{ roomState.recording ? 'Stop Rec' : 'Record' }}</span>
          </button>
        </div>

        <!-- Room Settings Panel -->
        <div class="settings-panel" *ngIf="showSettings">
          <h4>Room Settings</h4>
          
          <div class="settings-form">
            <div class="form-group">
              <label for="room-name">Room Name</label>
              <input type="text" 
                     id="room-name"
                     class="form-input"
                     [(ngModel)]="settings.name"
                     [disabled]="!canModerate"
                     (blur)="updateSettings()"
                     maxlength="50">
            </div>
            
            <div class="form-group">
              <label for="room-description">Description</label>
              <textarea id="room-description"
                        class="form-textarea"
                        [(ngModel)]="settings.description"
                        [disabled]="!canModerate"
                        (blur)="updateSettings()"
                        maxlength="200"
                        rows="3">
              </textarea>
            </div>
            
            <div class="form-group">
              <label for="room-type">Room Type</label>
              <select id="room-type"
                      class="form-select"
                      [(ngModel)]="settings.type"
                      [disabled]="!canModerate"
                      (change)="updateSettings()">
                <option value="public">Public</option>
                <option value="protected">Protected (Password)</option>
                <option value="private">Private (Invite Only)</option>
              </select>
            </div>
            
            <div class="form-group" *ngIf="settings.type === 'protected'">
              <label for="room-password">Password</label>
              <input type="password" 
                     id="room-password"
                     class="form-input"
                     [(ngModel)]="settings.password"
                     [disabled]="!canModerate"
                     (blur)="updateSettings()"
                     placeholder="Enter room password">
            </div>
            
            <div class="form-group">
              <label for="max-participants">Max Participants</label>
              <select id="max-participants"
                      class="form-select"
                      [(ngModel)]="settings.maxParticipants"
                      [disabled]="!canModerate"
                      (change)="updateSettings()">
                <option [value]="2">2</option>
                <option [value]="4">4</option>
                <option [value]="6">6</option>
                <option [value]="8">8</option>
                <option [value]="10">10</option>
                <option [value]="15">15</option>
                <option [value]="20">20</option>
              </select>
            </div>
            
            <div class="form-group">
              <label for="room-language">Language</label>
              <select id="room-language"
                      class="form-select"
                      [(ngModel)]="settings.language"
                      [disabled]="!canModerate"
                      (change)="updateSettings()">
                <option value="English">English</option>
                <option value="Spanish">Spanish</option>
                <option value="French">French</option>
                <option value="German">German</option>
                <option value="Chinese">Chinese</option>
                <option value="Japanese">Japanese</option>
              </select>
            </div>
            
            <div class="checkbox-group">
              <label class="checkbox-label">
                <input type="checkbox" 
                       [(ngModel)]="settings.requireApproval"
                       [disabled]="!canModerate"
                       (change)="updateSettings()">
                <span class="checkmark"></span>
                Require approval to join
              </label>
              
              <label class="checkbox-label">
                <input type="checkbox" 
                       [(ngModel)]="settings.allowGuests"
                       [disabled]="!canModerate"
                       (change)="updateSettings()">
                <span class="checkmark"></span>
                Allow guest users
              </label>
              
              <label class="checkbox-label">
                <input type="checkbox" 
                       [(ngModel)]="settings.recordSession"
                       [disabled]="!canModerate"
                       (change)="updateSettings()">
                <span class="checkmark"></span>
                Record sessions
              </label>
              
              <label class="checkbox-label">
                <input type="checkbox" 
                       [(ngModel)]="settings.enableChat"
                       [disabled]="!canModerate"
                       (change)="updateSettings()">
                <span class="checkmark"></span>
                Enable chat
              </label>
              
              <label class="checkbox-label">
                <input type="checkbox" 
                       [(ngModel)]="settings.enableFileSharing"
                       [disabled]="!canModerate"
                       (change)="updateSettings()">
                <span class="checkmark"></span>
                Enable file sharing
              </label>
              
              <label class="checkbox-label">
                <input type="checkbox" 
                       [(ngModel)]="settings.muteNewcomers"
                       [disabled]="!canModerate"
                       (change)="updateSettings()">
                <span class="checkmark"></span>
                Mute newcomers by default
              </label>
            </div>
            
            <div class="form-group">
              <label for="room-tags">Tags (comma-separated)</label>
              <input type="text" 
                     id="room-tags"
                     class="form-input"
                     [value]="settings.tags.join(', ')"
                     [disabled]="!canModerate"
                     (blur)="updateTags($event)"
                     placeholder="gaming, casual, friendly">
            </div>
          </div>
        </div>

        <!-- Participants Management Panel -->
        <div class="participants-panel" *ngIf="showParticipants">
          <div class="participants-header">
            <h4>Participants ({{ participants().length }})</h4>
            
            <div class="participants-actions">
              <button type="button" 
                      class="action-btn"
                      (click)="inviteParticipants()"
                      [disabled]="!canInvite">
                <span class="icon">➕</span>
                Invite
              </button>
              
              <button type="button" 
                      class="action-btn"
                      (click)="exportParticipants()"
                      [disabled]="!canModerate">
                <span class="icon">📄</span>
                Export
              </button>
            </div>
          </div>
          
          <!-- Participant List -->
          <div class="participants-list">
            <div *ngFor="let participant of participants(); trackBy: trackParticipant" 
                 class="participant-item"
                 [class.offline]="!participant.isOnline"
                 [class.owner]="participant.role === 'owner'"
                 [class.moderator]="participant.role === 'moderator'">
              
              <div class="participant-avatar">
                <img *ngIf="participant.avatar" 
                     [src]="participant.avatar" 
                     [alt]="participant.name">
                <span *ngIf="!participant.avatar" class="avatar-placeholder">
                  {{ getInitials(participant.name) }}
                </span>
                <div class="status-indicator" 
                     [class.online]="participant.isOnline">
                </div>
              </div>
              
              <div class="participant-info">
                <div class="participant-name">
                  {{ participant.name }}
                  <span class="role-badge" [class]="'role-' + participant.role">
                    {{ participant.role.toUpperCase() }}
                  </span>
                </div>
                <div class="participant-status">
                  {{ participant.status || (participant.isOnline ? 'Online' : 'Offline') }}
                </div>
                <div class="participant-time">
                  Joined {{ formatRelativeTime(participant.joinedAt) }}
                </div>
              </div>
              
              <div class="participant-permissions" *ngIf="showPermissions">
                <div class="permission-item" 
                     *ngFor="let permission of getParticipantPermissions(participant)"
                     [class.granted]="permission.granted"
                     [title]="permission.label">
                  <span class="permission-icon">{{ permission.icon }}</span>
                </div>
              </div>
              
              <div class="participant-actions" *ngIf="canModerateParticipant(participant)">
                <button type="button" 
                        class="participant-btn"
                        (click)="toggleParticipantMute(participant)"
                        [class.active]="!participant.permissions.canSpeak"
                        title="{{ participant.permissions.canSpeak ? 'Mute' : 'Unmute' }}">
                  {{ participant.permissions.canSpeak ? '🔊' : '🔇' }}
                </button>
                
                <button type="button" 
                        class="participant-btn"
                        (click)="toggleParticipantVideo(participant)"
                        [class.active]="!participant.permissions.canVideo"
                        title="{{ participant.permissions.canVideo ? 'Disable Video' : 'Enable Video' }}">
                  {{ participant.permissions.canVideo ? '📹' : '📵' }}
                </button>
                
                <div class="more-actions">
                  <button type="button" 
                          class="participant-btn more-btn"
                          (click)="toggleParticipantMenu(participant)"
                          title="More Actions">
                    ⋯
                  </button>
                  
                  <div class="participant-menu" *ngIf="selectedParticipantId === participant.id">
                    <button type="button" 
                            class="menu-item"
                            (click)="promoteParticipant(participant)"
                            *ngIf="participant.role === 'member' && canPromote">
                      👑 Promote to Moderator
                    </button>
                    
                    <button type="button" 
                            class="menu-item"
                            (click)="demoteParticipant(participant)"
                            *ngIf="participant.role === 'moderator' && canPromote">
                      👤 Demote to Member
                    </button>
                    
                    <button type="button" 
                            class="menu-item"
                            (click)="transferOwnership(participant)"
                            *ngIf="participant.role !== 'owner' && isOwner">
                      🔄 Transfer Ownership
                    </button>
                    
                    <button type="button" 
                            class="menu-item"
                            (click)="managePermissions(participant)">
                      🛡️ Manage Permissions
                    </button>
                    
                    <button type="button" 
                            class="menu-item warning"
                            (click)="kickParticipant(participant)"
                            *ngIf="participant.role !== 'owner'">
                      🦵 Kick from Room
                    </button>
                    
                    <button type="button" 
                            class="menu-item danger"
                            (click)="banParticipant(participant)"
                            *ngIf="participant.role !== 'owner' && canBan">
                      🚫 Ban from Room
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div class="participants-footer">
            <label class="checkbox-label">
              <input type="checkbox" 
                     [(ngModel)]="showPermissions"
                     (change)="togglePermissionsView()">
              <span class="checkmark"></span>
              Show Permissions
            </label>
          </div>
        </div>

        <!-- Room Statistics -->
        <div class="room-stats" *ngIf="showStats">
          <h4>Room Statistics</h4>
          
          <div class="stats-grid">
            <div class="stat-item">
              <span class="stat-label">Duration:</span>
              <span class="stat-value">{{ formatDuration(roomDuration) }}</span>
            </div>
            
            <div class="stat-item">
              <span class="stat-label">Peak Users:</span>
              <span class="stat-value">{{ roomStats.peakParticipants }}</span>
            </div>
            
            <div class="stat-item">
              <span class="stat-label">Messages:</span>
              <span class="stat-value">{{ roomStats.messageCount }}</span>
            </div>
            
            <div class="stat-item">
              <span class="stat-label">Files Shared:</span>
              <span class="stat-value">{{ roomStats.filesShared }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .room-controls-container {
      background: #ffffff;
      border: 1px solid #e0e0e0;
      border-radius: 12px;
      display: flex;
      flex-direction: column;
      height: 600px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      overflow: hidden;
    }

    .room-controls-container.minimized {
      height: 60px;
    }

    .controls-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      background: #f8f9fa;
      border-bottom: 1px solid #e0e0e0;
    }

    .room-info {
      flex: 1;
    }

    .room-name {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: #333;
    }

    .participant-count {
      font-size: 12px;
      color: #666;
    }

    .header-actions {
      display: flex;
      gap: 8px;
    }

    .header-btn {
      width: 36px;
      height: 36px;
      border: 1px solid #d0d0d0;
      border-radius: 6px;
      background: #ffffff;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
    }

    .header-btn:hover {
      background: #f8f9fa;
      border-color: #007bff;
    }

    .header-btn.active {
      background: #007bff;
      border-color: #007bff;
      color: white;
    }

    .leave-btn:hover {
      background: #dc3545;
      border-color: #dc3545;
      color: white;
    }

    .controls-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .quick-actions {
      display: flex;
      gap: 8px;
      padding: 16px 20px;
      border-bottom: 1px solid #e0e0e0;
      background: #f8f9fa;
    }

    .quick-btn {
      flex: 1;
      padding: 10px 12px;
      border: 1px solid #d0d0d0;
      border-radius: 6px;
      background: #ffffff;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      font-size: 12px;
    }

    .quick-btn:hover:not(:disabled) {
      background: #f8f9fa;
      border-color: #007bff;
    }

    .quick-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .quick-btn.active {
      background: #007bff;
      border-color: #007bff;
      color: white;
    }

    .quick-btn .icon {
      font-size: 16px;
    }

    .quick-btn .label {
      font-size: 10px;
      font-weight: 500;
    }

    .settings-panel, .participants-panel {
      padding: 20px;
      border-bottom: 1px solid #e0e0e0;
      max-height: 400px;
      overflow-y: auto;
    }

    .settings-panel h4, .participants-panel h4 {
      margin: 0 0 16px 0;
      font-size: 16px;
      color: #333;
    }

    .settings-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .form-group label {
      font-size: 12px;
      font-weight: 600;
      color: #333;
    }

    .form-input, .form-textarea, .form-select {
      padding: 8px 12px;
      border: 1px solid #d0d0d0;
      border-radius: 6px;
      font-size: 14px;
      outline: none;
    }

    .form-input:focus, .form-textarea:focus, .form-select:focus {
      border-color: #007bff;
      box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.2);
    }

    .form-input:disabled, .form-textarea:disabled, .form-select:disabled {
      background: #f8f9fa;
      opacity: 0.6;
    }

    .checkbox-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .checkbox-label {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      font-size: 14px;
    }

    .participants-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }

    .participants-actions {
      display: flex;
      gap: 8px;
    }

    .action-btn {
      padding: 6px 12px;
      border: 1px solid #d0d0d0;
      border-radius: 4px;
      background: #ffffff;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
    }

    .action-btn:hover:not(:disabled) {
      background: #f8f9fa;
      border-color: #007bff;
    }

    .action-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .participants-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-height: 300px;
      overflow-y: auto;
    }

    .participant-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      background: #ffffff;
      transition: all 0.2s ease;
      position: relative;
    }

    .participant-item:hover {
      border-color: #007bff;
      box-shadow: 0 2px 4px rgba(0, 123, 255, 0.1);
    }

    .participant-item.offline {
      opacity: 0.6;
      background: #f8f9fa;
    }

    .participant-item.owner {
      border-left: 4px solid #ffd700;
    }

    .participant-item.moderator {
      border-left: 4px solid #007bff;
    }

    .participant-avatar {
      position: relative;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      overflow: hidden;
      background: #e9ecef;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .participant-avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .avatar-placeholder {
      font-size: 14px;
      font-weight: 600;
      color: #666;
    }

    .status-indicator {
      position: absolute;
      bottom: 0;
      right: 0;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #ccc;
      border: 2px solid white;
    }

    .status-indicator.online {
      background: #28a745;
    }

    .participant-info {
      flex: 1;
      min-width: 0;
    }

    .participant-name {
      font-size: 14px;
      font-weight: 500;
      color: #333;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .role-badge {
      padding: 2px 6px;
      border-radius: 10px;
      font-size: 10px;
      font-weight: 600;
    }

    .role-badge.role-owner {
      background: #ffd700;
      color: #333;
    }

    .role-badge.role-moderator {
      background: #007bff;
      color: white;
    }

    .role-badge.role-member {
      background: #e9ecef;
      color: #495057;
    }

    .participant-status {
      font-size: 12px;
      color: #666;
    }

    .participant-time {
      font-size: 11px;
      color: #999;
    }

    .participant-permissions {
      display: flex;
      gap: 4px;
    }

    .permission-item {
      width: 20px;
      height: 20px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      background: #f8f9fa;
      color: #999;
    }

    .permission-item.granted {
      background: #e8f5e8;
      color: #28a745;
    }

    .participant-actions {
      display: flex;
      gap: 4px;
      align-items: center;
    }

    .participant-btn {
      width: 28px;
      height: 28px;
      border: 1px solid #d0d0d0;
      border-radius: 4px;
      background: #ffffff;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
    }

    .participant-btn:hover {
      background: #f8f9fa;
      border-color: #007bff;
    }

    .participant-btn.active {
      background: #dc3545;
      border-color: #dc3545;
      color: white;
    }

    .more-actions {
      position: relative;
    }

    .participant-menu {
      position: absolute;
      top: 100%;
      right: 0;
      background: white;
      border: 1px solid #d0d0d0;
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10;
      min-width: 180px;
    }

    .menu-item {
      width: 100%;
      padding: 8px 12px;
      border: none;
      background: none;
      text-align: left;
      cursor: pointer;
      font-size: 12px;
      transition: background 0.2s ease;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .menu-item:hover {
      background: #f8f9fa;
    }

    .menu-item.warning:hover {
      background: #fff3cd;
      color: #856404;
    }

    .menu-item.danger:hover {
      background: #f8d7da;
      color: #721c24;
    }

    .participants-footer {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid #e0e0e0;
    }

    .room-stats {
      padding: 20px;
      background: #f8f9fa;
    }

    .room-stats h4 {
      margin: 0 0 16px 0;
      font-size: 16px;
      color: #333;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
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

    @media (max-width: 768px) {
      .room-controls-container {
        height: 100vh;
        border-radius: 0;
      }

      .quick-actions {
        flex-wrap: wrap;
      }

      .quick-btn {
        min-width: calc(50% - 4px);
      }

      .participants-header {
        flex-direction: column;
        gap: 12px;
        align-items: stretch;
      }

      .participant-item {
        flex-direction: column;
        align-items: stretch;
        gap: 8px;
      }

      .participant-actions {
        justify-content: center;
      }

      .stats-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class RoomControlsComponent implements OnInit, OnDestroy {
  @Input() currentRoom?: { id: string; name: string };
  @Input() currentUser?: { id: string; name: string; role: RoomParticipant['role'] };
  @Input() disabled = false;

  @Input() settings: RoomSettings = {
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
    tags: []
  };

  @Input() roomState = {
    muteAll: false,
    lockRoom: false,
    recording: false
  };

  @Input() roomStats = {
    peakParticipants: 0,
    messageCount: 0,
    filesShared: 0
  };

  @Output() settingsUpdate = new EventEmitter<RoomSettings>();
  @Output() moderationAction = new EventEmitter<ModerationAction>();
  @Output() roomLeave = new EventEmitter<void>();
  @Output() participantInvite = new EventEmitter<void>();

  // Signals for reactive state
  private _participants = signal<RoomParticipant[]>([]);

  // Component state
  isMinimized = false;
  showSettings = false;
  showParticipants = false;
  showStats = false;
  showPermissions = false;
  selectedParticipantId = '';
  roomDuration = 0;

  // Computed signals
  participants = computed(() => this._participants());

  // Permission checks
  get canModerate(): boolean {
    return this.currentUser?.role === 'owner' || this.currentUser?.role === 'moderator';
  }

  get canInvite(): boolean {
    return this.canModerate || this.settings.allowGuests;
  }

  get canRecord(): boolean {
    return this.canModerate && this.settings.recordSession;
  }

  get canPromote(): boolean {
    return this.currentUser?.role === 'owner';
  }

  get canBan(): boolean {
    return this.canModerate;
  }

  get isOwner(): boolean {
    return this.currentUser?.role === 'owner';
  }

  private subscriptions = new Subscription();
  private durationTimer?: number;

  ngOnInit(): void {
    this.loadParticipants();
    this.startDurationTimer();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    if (this.durationTimer) {
      clearInterval(this.durationTimer);
    }
  }

  /**
   * Toggle minimize state
   */
  toggleMinimize(): void {
    this.isMinimized = !this.isMinimized;
  }

  /**
   * Toggle settings panel
   */
  toggleSettings(): void {
    this.showSettings = !this.showSettings;
    this.showParticipants = false;
  }

  /**
   * Toggle participants panel
   */
  toggleParticipants(): void {
    this.showParticipants = !this.showParticipants;
    this.showSettings = false;
  }

  /**
   * Toggle permissions view
   */
  togglePermissionsView(): void {
    this.showPermissions = !this.showPermissions;
  }

  /**
   * Update room settings
   */
  updateSettings(): void {
    this.settingsUpdate.emit({ ...this.settings });
  }

  /**
   * Update tags from input
   */
  updateTags(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.settings.tags = target.value
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);
    this.updateSettings();
  }

  /**
   * Toggle mute all participants
   */
  toggleMuteAll(): void {
    this.roomState.muteAll = !this.roomState.muteAll;
    this.moderationAction.emit({
      type: this.roomState.muteAll ? 'mute' : 'unmute',
      targetId: 'all',
      targetName: 'All Participants',
      reason: 'Moderator action'
    });
  }

  /**
   * Toggle room lock
   */
  toggleLockRoom(): void {
    this.roomState.lockRoom = !this.roomState.lockRoom;
    // Would emit room lock event
  }

  /**
   * Toggle recording
   */
  toggleRecording(): void {
    this.roomState.recording = !this.roomState.recording;
    // Would emit recording event
  }

  /**
   * Invite participants
   */
  inviteParticipants(): void {
    this.participantInvite.emit();
  }

  /**
   * Export participants list
   */
  exportParticipants(): void {
    const csv = this.generateParticipantsCsv();
    this.downloadCsv(csv, 'participants.csv');
  }

  /**
   * Leave room
   */
  leaveRoom(): void {
    const confirmed = confirm('Are you sure you want to leave this room?');
    if (confirmed) {
      this.roomLeave.emit();
    }
  }

  /**
   * Toggle participant menu
   */
  toggleParticipantMenu(participant: RoomParticipant): void {
    this.selectedParticipantId = 
      this.selectedParticipantId === participant.id ? '' : participant.id;
  }

  /**
   * Toggle participant mute
   */
  toggleParticipantMute(participant: RoomParticipant): void {
    const action: ModerationAction = {
      type: participant.permissions.canSpeak ? 'mute' : 'unmute',
      targetId: participant.id,
      targetName: participant.name
    };
    this.moderationAction.emit(action);
  }

  /**
   * Toggle participant video
   */
  toggleParticipantVideo(participant: RoomParticipant): void {
    const action: ModerationAction = {
      type: 'revokePermission',
      targetId: participant.id,
      targetName: participant.name,
      permission: 'canVideo'
    };
    this.moderationAction.emit(action);
  }

  /**
   * Promote participant to moderator
   */
  promoteParticipant(participant: RoomParticipant): void {
    const action: ModerationAction = {
      type: 'promote',
      targetId: participant.id,
      targetName: participant.name
    };
    this.moderationAction.emit(action);
  }

  /**
   * Demote participant to member
   */
  demoteParticipant(participant: RoomParticipant): void {
    const action: ModerationAction = {
      type: 'demote',
      targetId: participant.id,
      targetName: participant.name
    };
    this.moderationAction.emit(action);
  }

  /**
   * Transfer room ownership
   */
  transferOwnership(participant: RoomParticipant): void {
    const confirmed = confirm(`Transfer room ownership to ${participant.name}?`);
    if (confirmed) {
      // Would emit ownership transfer event
    }
  }

  /**
   * Manage participant permissions
   */
  managePermissions(participant: RoomParticipant): void {
    // Would open permissions dialog
    console.log(`Managing permissions for ${participant.name}`);
  }

  /**
   * Kick participant from room
   */
  kickParticipant(participant: RoomParticipant): void {
    const reason = prompt(`Reason for kicking ${participant.name}:`);
    if (reason !== null) {
      const action: ModerationAction = {
        type: 'kick',
        targetId: participant.id,
        targetName: participant.name,
        reason: reason || 'No reason provided'
      };
      this.moderationAction.emit(action);
    }
  }

  /**
   * Ban participant from room
   */
  banParticipant(participant: RoomParticipant): void {
    const reason = prompt(`Reason for banning ${participant.name}:`);
    if (reason !== null) {
      const action: ModerationAction = {
        type: 'ban',
        targetId: participant.id,
        targetName: participant.name,
        reason: reason || 'No reason provided'
      };
      this.moderationAction.emit(action);
    }
  }

  /**
   * Check if can moderate specific participant
   */
  canModerateParticipant(participant: RoomParticipant): boolean {
    if (!this.canModerate) return false;
    if (participant.id === this.currentUser?.id) return false;
    if (participant.role === 'owner') return false;
    if (participant.role === 'moderator' && this.currentUser?.role !== 'owner') return false;
    return true;
  }

  /**
   * Get participant permissions for display
   */
  getParticipantPermissions(participant: RoomParticipant) {
    return [
      { 
        key: 'canSpeak', 
        icon: '🎤', 
        label: 'Speak', 
        granted: participant.permissions.canSpeak 
      },
      { 
        key: 'canVideo', 
        icon: '📹', 
        label: 'Video', 
        granted: participant.permissions.canVideo 
      },
      { 
        key: 'canScreenShare', 
        icon: '🖥️', 
        label: 'Screen Share', 
        granted: participant.permissions.canScreenShare 
      },
      { 
        key: 'canChat', 
        icon: '💬', 
        label: 'Chat', 
        granted: participant.permissions.canChat 
      },
      { 
        key: 'canInvite', 
        icon: '📧', 
        label: 'Invite', 
        granted: participant.permissions.canInvite 
      }
    ];
  }

  /**
   * Get initials from name
   */
  getInitials(name: string): string {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  /**
   * Format relative time
   */
  formatRelativeTime(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    return `${hours}h ago`;
  }

  /**
   * Format duration
   */
  formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Track participants for ngFor
   */
  trackParticipant(index: number, participant: RoomParticipant): string {
    return participant.id;
  }

  /**
   * Load participants (mock data)
   */
  private loadParticipants(): void {
    const mockParticipants: RoomParticipant[] = [
      {
        id: 'user-1',
        name: 'John Doe',
        role: 'owner',
        isOnline: true,
        joinedAt: new Date(Date.now() - 30 * 60 * 1000),
        lastSeen: new Date(),
        permissions: {
          canSpeak: true,
          canVideo: true,
          canScreenShare: true,
          canChat: true,
          canInvite: true,
          canKick: true,
          canMute: true
        }
      },
      {
        id: 'user-2',
        name: 'Jane Smith',
        role: 'moderator',
        isOnline: true,
        joinedAt: new Date(Date.now() - 20 * 60 * 1000),
        lastSeen: new Date(),
        permissions: {
          canSpeak: true,
          canVideo: true,
          canScreenShare: true,
          canChat: true,
          canInvite: true,
          canKick: true,
          canMute: true
        }
      },
      {
        id: 'user-3',
        name: 'Bob Wilson',
        role: 'member',
        isOnline: false,
        joinedAt: new Date(Date.now() - 10 * 60 * 1000),
        lastSeen: new Date(Date.now() - 5 * 60 * 1000),
        permissions: {
          canSpeak: false,
          canVideo: true,
          canScreenShare: false,
          canChat: true,
          canInvite: false,
          canKick: false,
          canMute: false
        },
        status: 'Away'
      }
    ];

    this._participants.set(mockParticipants);
  }

  /**
   * Start duration timer
   */
  private startDurationTimer(): void {
    this.durationTimer = window.setInterval(() => {
      this.roomDuration++;
    }, 1000);
  }

  /**
   * Generate participants CSV
   */
  private generateParticipantsCsv(): string {
    const headers = ['Name', 'Role', 'Status', 'Joined', 'Permissions'];
    const rows = this.participants().map(p => [
      p.name,
      p.role,
      p.isOnline ? 'Online' : 'Offline',
      p.joinedAt.toISOString(),
      Object.entries(p.permissions)
        .filter(([_, granted]) => granted)
        .map(([perm]) => perm)
        .join(';')
    ]);

    return [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
  }

  /**
   * Download CSV file
   */
  private downloadCsv(content: string, filename: string): void {
    const blob = new Blob([content], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    window.URL.revokeObjectURL(url);
  }
}

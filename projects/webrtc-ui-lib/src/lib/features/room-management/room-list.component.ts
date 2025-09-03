import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, Signal, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

export interface RoomInfo {
  id: string;
  name: string;
  description?: string;
  type: 'public' | 'private' | 'protected';
  participantCount: number;
  maxParticipants: number;
  createdBy: string;
  createdAt: Date;
  lastActivity: Date;
  isActive: boolean;
  hasPassword: boolean;
  tags: string[];
  gameMode?: string;
  language?: string;
  region?: string;
  thumbnail?: string;
}

export interface RoomFilters {
  searchTerm: string;
  roomType: 'all' | 'public' | 'private' | 'protected';
  participantRange: 'any' | 'few' | 'medium' | 'full';
  sortBy: 'name' | 'participants' | 'created' | 'activity';
  sortOrder: 'asc' | 'desc';
  gameMode?: string;
  language?: string;
  region?: string;
  showFull: boolean;
  showEmpty: boolean;
}

export interface RoomListSettings {
  autoRefresh: boolean;
  refreshInterval: number; // seconds
  showThumbnails: boolean;
  gridView: boolean;
  showDetails: boolean;
  enableNotifications: boolean;
}

@Component({
  selector: 'webrtc-room-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="room-list-container" [class.grid-view]="settings.gridView">
      
      <!-- Header with Search and Controls -->
      <div class="room-list-header">
        <div class="header-title">
          <span class="icon">🏠</span>
          <span class="title">Available Rooms</span>
          <span class="room-count" *ngIf="filteredRooms().length > 0">
            ({{ filteredRooms().length }})
          </span>
        </div>
        
        <div class="header-controls">
          <button type="button" 
                  class="control-btn create-room-btn"
                  (click)="createRoom()"
                  [disabled]="disabled"
                  title="Create New Room">
            <span class="icon">➕</span>
            <span class="label">Create Room</span>
          </button>
          
          <button type="button" 
                  class="control-btn refresh-btn"
                  (click)="refreshRooms()"
                  [disabled]="disabled || isRefreshing"
                  [class.refreshing]="isRefreshing"
                  title="Refresh Room List">
            <span class="icon">🔄</span>
          </button>
          
          <button type="button" 
                  class="control-btn view-toggle"
                  (click)="toggleView()"
                  title="Toggle View Mode">
            <span class="icon">{{ settings.gridView ? '📋' : '⊞' }}</span>
          </button>
          
          <button type="button" 
                  class="control-btn settings-btn"
                  (click)="toggleSettings()"
                  [class.active]="showSettings"
                  title="Settings">
            <span class="icon">⚙️</span>
          </button>
        </div>
      </div>

      <!-- Search and Filters -->
      <div class="search-filters">
        <div class="search-bar">
          <input type="text" 
                 class="search-input"
                 placeholder="Search rooms..."
                 [(ngModel)]="filters.searchTerm"
                 (input)="onFiltersChange()">
          <span class="search-icon">🔍</span>
        </div>
        
        <div class="filters-row" *ngIf="showFilters">
          <select class="filter-select"
                  [(ngModel)]="filters.roomType"
                  (change)="onFiltersChange()">
            <option value="all">All Types</option>
            <option value="public">Public</option>
            <option value="private">Private</option>
            <option value="protected">Protected</option>
          </select>
          
          <select class="filter-select"
                  [(ngModel)]="filters.participantRange"
                  (change)="onFiltersChange()">
            <option value="any">Any Size</option>
            <option value="few">Few (1-3)</option>
            <option value="medium">Medium (4-8)</option>
            <option value="full">Large (9+)</option>
          </select>
          
          <select class="filter-select"
                  [(ngModel)]="filters.sortBy"
                  (change)="onFiltersChange()">
            <option value="name">Name</option>
            <option value="participants">Participants</option>
            <option value="created">Created</option>
            <option value="activity">Activity</option>
          </select>
          
          <button type="button" 
                  class="sort-order-btn"
                  (click)="toggleSortOrder()"
                  title="Sort Order">
            {{ filters.sortOrder === 'asc' ? '↑' : '↓' }}
          </button>
          
          <div class="filter-checkboxes">
            <label class="checkbox-label">
              <input type="checkbox" 
                     [(ngModel)]="filters.showFull"
                     (change)="onFiltersChange()">
              <span class="checkmark"></span>
              Show Full
            </label>
            
            <label class="checkbox-label">
              <input type="checkbox" 
                     [(ngModel)]="filters.showEmpty"
                     (change)="onFiltersChange()">
              <span class="checkmark"></span>
              Show Empty
            </label>
          </div>
        </div>
        
        <button type="button" 
                class="toggle-filters-btn"
                (click)="toggleFilters()">
          <span class="icon">{{ showFilters ? '▼' : '▶' }}</span>
          {{ showFilters ? 'Hide Filters' : 'Show Filters' }}
        </button>
      </div>

      <!-- Settings Panel -->
      <div class="settings-panel" *ngIf="showSettings">
        <h4>Room List Settings</h4>
        
        <div class="settings-group">
          <div class="setting-item">
            <label class="checkbox-label">
              <input type="checkbox" 
                     [(ngModel)]="settings.autoRefresh"
                     (change)="onSettingsChange()">
              <span class="checkmark"></span>
              Auto Refresh
            </label>
          </div>
          
          <div class="setting-item" *ngIf="settings.autoRefresh">
            <label for="refresh-interval">Refresh Interval (seconds)</label>
            <select id="refresh-interval" 
                    [(ngModel)]="settings.refreshInterval"
                    (change)="onSettingsChange()">
              <option [value]="5">5 seconds</option>
              <option [value]="10">10 seconds</option>
              <option [value]="30">30 seconds</option>
              <option [value]="60">1 minute</option>
            </select>
          </div>
          
          <div class="setting-item">
            <label class="checkbox-label">
              <input type="checkbox" 
                     [(ngModel)]="settings.showThumbnails"
                     (change)="onSettingsChange()">
              <span class="checkmark"></span>
              Show Thumbnails
            </label>
          </div>
          
          <div class="setting-item">
            <label class="checkbox-label">
              <input type="checkbox" 
                     [(ngModel)]="settings.showDetails"
                     (change)="onSettingsChange()">
              <span class="checkmark"></span>
              Show Details
            </label>
          </div>
          
          <div class="setting-item">
            <label class="checkbox-label">
              <input type="checkbox" 
                     [(ngModel)]="settings.enableNotifications"
                     (change)="onSettingsChange()">
              <span class="checkmark"></span>
              Enable Notifications
            </label>
          </div>
        </div>
      </div>

      <!-- Room List Content -->
      <div class="room-list-content">
        
        <!-- Loading state -->
        <div class="loading-state" *ngIf="isLoading">
          <div class="loading-spinner"></div>
          <p>Loading rooms...</p>
        </div>

        <!-- Empty state -->
        <div class="empty-state" *ngIf="!isLoading && filteredRooms().length === 0">
          <span class="icon">🏠</span>
          <h3>No rooms found</h3>
          <p *ngIf="allRooms().length === 0">
            No rooms are currently available. Be the first to create one!
          </p>
          <p *ngIf="allRooms().length > 0">
            No rooms match your current filters. Try adjusting your search criteria.
          </p>
          <button type="button" 
                  class="create-first-room-btn"
                  (click)="createRoom()"
                  [disabled]="disabled">
            Create New Room
          </button>
        </div>

        <!-- Room Grid/List -->
        <div class="rooms-container" 
             [class.grid-layout]="settings.gridView"
             [class.list-layout]="!settings.gridView"
             *ngIf="!isLoading && filteredRooms().length > 0">
          
          <div *ngFor="let room of filteredRooms(); trackBy: trackRoom" 
               class="room-item"
               [class.private]="room.type === 'private'"
               [class.protected]="room.type === 'protected'"
               [class.full]="room.participantCount >= room.maxParticipants"
               [class.empty]="room.participantCount === 0"
               [class.inactive]="!room.isActive">
            
            <!-- Room Thumbnail -->
            <div class="room-thumbnail" *ngIf="settings.showThumbnails">
              <img *ngIf="room.thumbnail" 
                   [src]="room.thumbnail" 
                   [alt]="room.name"
                   class="thumbnail-image">
              <div *ngIf="!room.thumbnail" class="thumbnail-placeholder">
                <span class="room-type-icon">{{ getRoomTypeIcon(room.type) }}</span>
              </div>
              <div class="room-status-badge" 
                   [class.active]="room.isActive"
                   [class.inactive]="!room.isActive">
                {{ room.isActive ? 'LIVE' : 'INACTIVE' }}
              </div>
            </div>

            <!-- Room Info -->
            <div class="room-info">
              <div class="room-header">
                <h3 class="room-name">{{ room.name }}</h3>
                <div class="room-badges">
                  <span class="type-badge" [class]="'type-' + room.type">
                    {{ room.type.toUpperCase() }}
                  </span>
                  <span class="password-badge" *ngIf="room.hasPassword">
                    🔒
                  </span>
                </div>
              </div>
              
              <p class="room-description" *ngIf="room.description">
                {{ room.description }}
              </p>
              
              <div class="room-meta">
                <div class="participants-info">
                  <span class="icon">👥</span>
                  <span class="count">{{ room.participantCount }}/{{ room.maxParticipants }}</span>
                  <div class="participants-bar">
                    <div class="participants-fill" 
                         [style.width.%]="(room.participantCount / room.maxParticipants) * 100">
                    </div>
                  </div>
                </div>
                
                <div class="room-details" *ngIf="settings.showDetails">
                  <div class="detail-item" *ngIf="room.gameMode">
                    <span class="label">Game:</span>
                    <span class="value">{{ room.gameMode }}</span>
                  </div>
                  <div class="detail-item" *ngIf="room.language">
                    <span class="label">Language:</span>
                    <span class="value">{{ room.language }}</span>
                  </div>
                  <div class="detail-item" *ngIf="room.region">
                    <span class="label">Region:</span>
                    <span class="value">{{ room.region }}</span>
                  </div>
                  <div class="detail-item">
                    <span class="label">Created:</span>
                    <span class="value">{{ formatRelativeTime(room.createdAt) }}</span>
                  </div>
                  <div class="detail-item">
                    <span class="label">Activity:</span>
                    <span class="value">{{ formatRelativeTime(room.lastActivity) }}</span>
                  </div>
                </div>
                
                <div class="room-tags" *ngIf="room.tags.length > 0">
                  <span *ngFor="let tag of room.tags" class="tag">
                    {{ tag }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Room Actions -->
            <div class="room-actions">
              <button type="button" 
                      class="action-btn join-btn"
                      (click)="joinRoom(room)"
                      [disabled]="disabled || !room.isActive || (room.participantCount >= room.maxParticipants && room.type !== 'private')"
                      title="Join Room">
                <span class="icon">🚪</span>
                <span class="label">Join</span>
              </button>
              
              <button type="button" 
                      class="action-btn info-btn"
                      (click)="viewRoomInfo(room)"
                      title="Room Information">
                <span class="icon">ℹ️</span>
              </button>
              
              <button type="button" 
                      class="action-btn favorite-btn"
                      (click)="toggleFavorite(room)"
                      [class.favorited]="isFavorite(room)"
                      title="{{ isFavorite(room) ? 'Remove from Favorites' : 'Add to Favorites' }}">
                <span class="icon">{{ isFavorite(room) ? '⭐' : '☆' }}</span>
              </button>
              
              <div class="more-actions" *ngIf="showMoreActions">
                <button type="button" 
                        class="action-btn more-btn"
                        (click)="toggleMoreActions(room)"
                        title="More Actions">
                  <span class="icon">⋯</span>
                </button>
                
                <div class="more-menu" *ngIf="selectedRoomId === room.id">
                  <button type="button" 
                          class="menu-item"
                          (click)="copyRoomLink(room)">
                    📋 Copy Link
                  </button>
                  <button type="button" 
                          class="menu-item"
                          (click)="reportRoom(room)">
                    🚨 Report
                  </button>
                  <button type="button" 
                          class="menu-item"
                          (click)="blockRoom(room)">
                    🚫 Block
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Auto-refresh indicator -->
      <div class="auto-refresh-indicator" 
           *ngIf="settings.autoRefresh && !isLoading">
        <span class="indicator-dot"></span>
        <span class="indicator-text">Auto-refreshing every {{ settings.refreshInterval }}s</span>
        <span class="next-refresh">Next: {{ nextRefreshIn }}s</span>
      </div>
    </div>
  `,
  styles: [`
    .room-list-container {
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

    .room-list-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      background: #f8f9fa;
      border-bottom: 1px solid #e0e0e0;
    }

    .header-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
      color: #333;
      font-size: 16px;
    }

    .room-count {
      font-size: 14px;
      color: #666;
      font-weight: normal;
    }

    .header-controls {
      display: flex;
      gap: 8px;
    }

    .control-btn {
      padding: 8px 12px;
      border: 1px solid #d0d0d0;
      border-radius: 6px;
      background: #ffffff;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 14px;
      font-weight: 500;
    }

    .control-btn:hover:not(:disabled) {
      background: #f8f9fa;
      border-color: #007bff;
    }

    .control-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .control-btn.active {
      background: #007bff;
      border-color: #007bff;
      color: white;
    }

    .create-room-btn {
      background: #28a745;
      border-color: #28a745;
      color: white;
    }

    .create-room-btn:hover:not(:disabled) {
      background: #1e7e34;
    }

    .refresh-btn.refreshing {
      animation: spin 1s linear infinite;
    }

    .search-filters {
      padding: 16px 20px;
      background: #f8f9fa;
      border-bottom: 1px solid #e0e0e0;
    }

    .search-bar {
      position: relative;
      margin-bottom: 12px;
    }

    .search-input {
      width: 100%;
      padding: 10px 40px 10px 16px;
      border: 1px solid #d0d0d0;
      border-radius: 20px;
      font-size: 14px;
      outline: none;
    }

    .search-input:focus {
      border-color: #007bff;
      box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.2);
    }

    .search-icon {
      position: absolute;
      right: 12px;
      top: 50%;
      transform: translateY(-50%);
      color: #666;
      font-size: 16px;
    }

    .filters-row {
      display: flex;
      gap: 12px;
      align-items: center;
      flex-wrap: wrap;
      margin-bottom: 8px;
    }

    .filter-select {
      padding: 6px 8px;
      border: 1px solid #d0d0d0;
      border-radius: 4px;
      font-size: 13px;
      background: white;
    }

    .sort-order-btn {
      padding: 6px 8px;
      border: 1px solid #d0d0d0;
      border-radius: 4px;
      background: white;
      cursor: pointer;
      font-size: 16px;
      width: 32px;
      text-align: center;
    }

    .filter-checkboxes {
      display: flex;
      gap: 12px;
    }

    .checkbox-label {
      display: flex;
      align-items: center;
      gap: 4px;
      cursor: pointer;
      font-size: 12px;
    }

    .toggle-filters-btn {
      padding: 6px 12px;
      border: 1px solid #d0d0d0;
      border-radius: 4px;
      background: white;
      cursor: pointer;
      font-size: 12px;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .settings-panel {
      padding: 16px 20px;
      background: #f0f8ff;
      border-bottom: 1px solid #e0e0e0;
    }

    .settings-panel h4 {
      margin: 0 0 12px 0;
      font-size: 14px;
      color: #333;
    }

    .settings-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .setting-item {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .setting-item label:not(.checkbox-label) {
      font-size: 12px;
      color: #333;
      margin-right: 8px;
    }

    .setting-item select {
      padding: 4px 6px;
      font-size: 12px;
      border: 1px solid #d0d0d0;
      border-radius: 4px;
    }

    .room-list-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }

    .loading-state, .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      flex: 1;
      color: #666;
      text-align: center;
      padding: 40px 20px;
    }

    .loading-spinner {
      width: 40px;
      height: 40px;
      border: 4px solid #f3f3f3;
      border-top: 4px solid #007bff;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 16px;
    }

    .empty-state .icon {
      font-size: 64px;
      margin-bottom: 16px;
      opacity: 0.5;
    }

    .create-first-room-btn {
      padding: 12px 24px;
      border: 1px solid #28a745;
      border-radius: 6px;
      background: #28a745;
      color: white;
      cursor: pointer;
      transition: all 0.2s ease;
      margin-top: 16px;
    }

    .create-first-room-btn:hover:not(:disabled) {
      background: #1e7e34;
    }

    .rooms-container {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
    }

    .rooms-container.grid-layout {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 16px;
    }

    .rooms-container.list-layout {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .room-item {
      background: #ffffff;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 16px;
      transition: all 0.2s ease;
      cursor: pointer;
      position: relative;
    }

    .room-item:hover {
      border-color: #007bff;
      box-shadow: 0 2px 8px rgba(0, 123, 255, 0.15);
    }

    .room-item.private {
      border-left: 4px solid #dc3545;
    }

    .room-item.protected {
      border-left: 4px solid #ffc107;
    }

    .room-item.full {
      opacity: 0.7;
    }

    .room-item.inactive {
      opacity: 0.5;
      background: #f8f9fa;
    }

    .room-thumbnail {
      position: relative;
      width: 100%;
      height: 120px;
      border-radius: 6px;
      overflow: hidden;
      margin-bottom: 12px;
      background: #f0f0f0;
    }

    .thumbnail-image {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .thumbnail-placeholder {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 32px;
      color: #999;
    }

    .room-status-badge {
      position: absolute;
      top: 8px;
      right: 8px;
      padding: 4px 8px;
      border-radius: 12px;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
    }

    .room-status-badge.active {
      background: #28a745;
      color: white;
    }

    .room-status-badge.inactive {
      background: #6c757d;
      color: white;
    }

    .room-info {
      margin-bottom: 12px;
    }

    .room-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 8px;
    }

    .room-name {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: #333;
      flex: 1;
    }

    .room-badges {
      display: flex;
      gap: 4px;
      align-items: center;
    }

    .type-badge {
      padding: 2px 6px;
      border-radius: 10px;
      font-size: 10px;
      font-weight: 600;
    }

    .type-badge.type-public {
      background: #28a745;
      color: white;
    }

    .type-badge.type-private {
      background: #dc3545;
      color: white;
    }

    .type-badge.type-protected {
      background: #ffc107;
      color: #212529;
    }

    .password-badge {
      font-size: 12px;
    }

    .room-description {
      margin: 0 0 8px 0;
      font-size: 14px;
      color: #666;
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .room-meta {
      font-size: 12px;
      color: #666;
    }

    .participants-info {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }

    .participants-bar {
      flex: 1;
      height: 4px;
      background: #e9ecef;
      border-radius: 2px;
      overflow: hidden;
    }

    .participants-fill {
      height: 100%;
      background: linear-gradient(90deg, #28a745, #ffc107, #dc3545);
      transition: width 0.3s ease;
    }

    .room-details {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 4px;
      margin-bottom: 8px;
    }

    .detail-item {
      display: flex;
      justify-content: space-between;
    }

    .detail-item .label {
      font-weight: 500;
    }

    .room-tags {
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
    }

    .tag {
      padding: 2px 6px;
      background: #e9ecef;
      border-radius: 10px;
      font-size: 10px;
      color: #495057;
    }

    .room-actions {
      display: flex;
      gap: 8px;
      align-items: center;
      position: relative;
    }

    .action-btn {
      padding: 8px 12px;
      border: 1px solid #d0d0d0;
      border-radius: 6px;
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
    }

    .action-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .join-btn {
      background: #007bff;
      border-color: #007bff;
      color: white;
      flex: 1;
    }

    .join-btn:hover:not(:disabled) {
      background: #0056b3;
    }

    .favorite-btn.favorited {
      color: #ffc107;
    }

    .more-actions {
      position: relative;
    }

    .more-menu {
      position: absolute;
      top: 100%;
      right: 0;
      background: white;
      border: 1px solid #d0d0d0;
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10;
      min-width: 120px;
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
    }

    .menu-item:hover {
      background: #f8f9fa;
    }

    .auto-refresh-indicator {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 20px;
      background: #e7f3ff;
      border-top: 1px solid #b3d7ff;
      font-size: 12px;
      color: #0056b3;
    }

    .indicator-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #007bff;
      animation: pulse 2s ease-in-out infinite;
    }

    .next-refresh {
      margin-left: auto;
      font-weight: 500;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    @media (max-width: 768px) {
      .room-list-container {
        height: 100vh;
        border-radius: 0;
      }

      .room-list-header {
        flex-direction: column;
        gap: 12px;
        align-items: stretch;
      }

      .header-controls {
        justify-content: center;
      }

      .filters-row {
        flex-direction: column;
        gap: 8px;
      }

      .rooms-container.grid-layout {
        grid-template-columns: 1fr;
      }

      .room-item {
        padding: 12px;
      }

      .room-header {
        flex-direction: column;
        gap: 8px;
      }

      .room-actions {
        flex-wrap: wrap;
      }
    }
  `]
})
export class RoomListComponent implements OnInit, OnDestroy {
  @Input() disabled = false;

  @Input() filters: RoomFilters = {
    searchTerm: '',
    roomType: 'all',
    participantRange: 'any',
    sortBy: 'activity',
    sortOrder: 'desc',
    showFull: true,
    showEmpty: true
  };

  @Input() settings: RoomListSettings = {
    autoRefresh: true,
    refreshInterval: 30,
    showThumbnails: true,
    gridView: true,
    showDetails: false,
    enableNotifications: true
  };

  @Output() roomJoin = new EventEmitter<RoomInfo>();
  @Output() roomCreate = new EventEmitter<void>();
  @Output() roomInfo = new EventEmitter<RoomInfo>();
  @Output() roomFavorite = new EventEmitter<{ room: RoomInfo; favorite: boolean }>();
  @Output() filtersChange = new EventEmitter<RoomFilters>();
  @Output() settingsChange = new EventEmitter<RoomListSettings>();

  // Signals for reactive state
  private _allRooms = signal<RoomInfo[]>([]);
  private _favoriteRoomIds = signal<Set<string>>(new Set());

  // Component state
  isLoading = false;
  isRefreshing = false;
  showFilters = false;
  showSettings = false;
  showMoreActions = false;
  selectedRoomId = '';
  nextRefreshIn = 0;

  // Computed signals
  allRooms = computed(() => this._allRooms());
  filteredRooms = computed(() => this.applyFilters(this.allRooms(), this.filters));

  private subscriptions = new Subscription();
  private refreshTimer?: number;
  private countdownTimer?: number;

  ngOnInit(): void {
    this.loadRooms();
    this.setupAutoRefresh();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.clearTimers();
  }

  /**
   * Load rooms from server
   */
  async loadRooms(): Promise<void> {
    this.isLoading = true;
    
    try {
      // Simulate API call
      await this.delay(1000);
      
      // Mock room data
      const mockRooms: RoomInfo[] = [
        {
          id: 'room-1',
          name: 'Gaming Lounge',
          description: 'Casual gaming and chat room for all skill levels',
          type: 'public',
          participantCount: 5,
          maxParticipants: 10,
          createdBy: 'GameMaster',
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
          lastActivity: new Date(Date.now() - 5 * 60 * 1000),
          isActive: true,
          hasPassword: false,
          tags: ['gaming', 'casual', 'friendly'],
          gameMode: 'MultiPlayer',
          language: 'English',
          region: 'US-East'
        },
        {
          id: 'room-2',
          name: 'Strategy Masters',
          description: 'Advanced strategy gaming room',
          type: 'protected',
          participantCount: 8,
          maxParticipants: 8,
          createdBy: 'StrategistPro',
          createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
          lastActivity: new Date(Date.now() - 2 * 60 * 1000),
          isActive: true,
          hasPassword: true,
          tags: ['strategy', 'advanced', 'competitive'],
          gameMode: 'Strategy',
          language: 'English',
          region: 'EU-West'
        },
        {
          id: 'room-3',
          name: 'Private Study Group',
          description: 'Invite-only room for focused discussions',
          type: 'private',
          participantCount: 3,
          maxParticipants: 6,
          createdBy: 'StudyLeader',
          createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
          lastActivity: new Date(Date.now() - 10 * 60 * 1000),
          isActive: true,
          hasPassword: false,
          tags: ['study', 'education', 'private'],
          language: 'Spanish',
          region: 'US-West'
        }
      ];

      this._allRooms.set(mockRooms);
    } catch (error) {
      console.error('Error loading rooms:', error);
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Refresh room list
   */
  async refreshRooms(): Promise<void> {
    this.isRefreshing = true;
    await this.loadRooms();
    this.isRefreshing = false;
  }

  /**
   * Join a room
   */
  joinRoom(room: RoomInfo): void {
    if (room.hasPassword && room.type === 'protected') {
      // Would show password dialog
      const password = prompt('Enter room password:');
      if (!password) return;
    }
    
    this.roomJoin.emit(room);
  }

  /**
   * Create new room
   */
  createRoom(): void {
    this.roomCreate.emit();
  }

  /**
   * View room information
   */
  viewRoomInfo(room: RoomInfo): void {
    this.roomInfo.emit(room);
  }

  /**
   * Toggle room favorite status
   */
  toggleFavorite(room: RoomInfo): void {
    const favorites = new Set(this._favoriteRoomIds());
    const isFav = favorites.has(room.id);
    
    if (isFav) {
      favorites.delete(room.id);
    } else {
      favorites.add(room.id);
    }
    
    this._favoriteRoomIds.set(favorites);
    this.roomFavorite.emit({ room, favorite: !isFav });
  }

  /**
   * Check if room is favorite
   */
  isFavorite(room: RoomInfo): boolean {
    return this._favoriteRoomIds().has(room.id);
  }

  /**
   * Toggle view mode
   */
  toggleView(): void {
    this.settings.gridView = !this.settings.gridView;
    this.onSettingsChange();
  }

  /**
   * Toggle filters visibility
   */
  toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }

  /**
   * Toggle settings panel
   */
  toggleSettings(): void {
    this.showSettings = !this.showSettings;
  }

  /**
   * Toggle sort order
   */
  toggleSortOrder(): void {
    this.filters.sortOrder = this.filters.sortOrder === 'asc' ? 'desc' : 'asc';
    this.onFiltersChange();
  }

  /**
   * Toggle more actions menu
   */
  toggleMoreActions(room: RoomInfo): void {
    this.selectedRoomId = this.selectedRoomId === room.id ? '' : room.id;
  }

  /**
   * Copy room link
   */
  copyRoomLink(room: RoomInfo): void {
    const link = `${window.location.origin}/room/${room.id}`;
    navigator.clipboard.writeText(link);
    // Would show toast notification
    console.log(`Copied room link: ${link}`);
  }

  /**
   * Report room
   */
  reportRoom(room: RoomInfo): void {
    // Would show report dialog
    console.log(`Reporting room: ${room.name}`);
  }

  /**
   * Block room
   */
  blockRoom(room: RoomInfo): void {
    // Would add room to blocked list
    console.log(`Blocking room: ${room.name}`);
  }

  /**
   * Handle filters change
   */
  onFiltersChange(): void {
    this.filtersChange.emit({ ...this.filters });
  }

  /**
   * Handle settings change
   */
  onSettingsChange(): void {
    this.settingsChange.emit({ ...this.settings });
    this.setupAutoRefresh();
  }

  /**
   * Get room type icon
   */
  getRoomTypeIcon(type: RoomInfo['type']): string {
    switch (type) {
      case 'public': return '🌐';
      case 'private': return '🔒';
      case 'protected': return '🛡️';
      default: return '🏠';
    }
  }

  /**
   * Format relative time
   */
  formatRelativeTime(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  }

  /**
   * Track rooms for ngFor
   */
  trackRoom(index: number, room: RoomInfo): string {
    return room.id;
  }

  /**
   * Apply filters to room list
   */
  private applyFilters(rooms: RoomInfo[], filters: RoomFilters): RoomInfo[] {
    let filtered = [...rooms];

    // Search term
    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(room =>
        room.name.toLowerCase().includes(term) ||
        room.description?.toLowerCase().includes(term) ||
        room.tags.some(tag => tag.toLowerCase().includes(term))
      );
    }

    // Room type
    if (filters.roomType !== 'all') {
      filtered = filtered.filter(room => room.type === filters.roomType);
    }

    // Participant range
    if (filters.participantRange !== 'any') {
      filtered = filtered.filter(room => {
        switch (filters.participantRange) {
          case 'few': return room.participantCount <= 3;
          case 'medium': return room.participantCount >= 4 && room.participantCount <= 8;
          case 'full': return room.participantCount >= 9;
          default: return true;
        }
      });
    }

    // Show full/empty rooms
    if (!filters.showFull) {
      filtered = filtered.filter(room => room.participantCount < room.maxParticipants);
    }
    if (!filters.showEmpty) {
      filtered = filtered.filter(room => room.participantCount > 0);
    }

    // Game mode, language, region filters
    if (filters.gameMode) {
      filtered = filtered.filter(room => room.gameMode === filters.gameMode);
    }
    if (filters.language) {
      filtered = filtered.filter(room => room.language === filters.language);
    }
    if (filters.region) {
      filtered = filtered.filter(room => room.region === filters.region);
    }

    // Sort
    filtered.sort((a, b) => {
      let aVal: any, bVal: any;
      
      switch (filters.sortBy) {
        case 'name':
          aVal = a.name;
          bVal = b.name;
          break;
        case 'participants':
          aVal = a.participantCount;
          bVal = b.participantCount;
          break;
        case 'created':
          aVal = a.createdAt.getTime();
          bVal = b.createdAt.getTime();
          break;
        case 'activity':
          aVal = a.lastActivity.getTime();
          bVal = b.lastActivity.getTime();
          break;
        default:
          return 0;
      }

      if (typeof aVal === 'string') {
        return filters.sortOrder === 'asc' 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      return filters.sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });

    return filtered;
  }

  /**
   * Setup auto-refresh timer
   */
  private setupAutoRefresh(): void {
    this.clearTimers();
    
    if (this.settings.autoRefresh) {
      this.nextRefreshIn = this.settings.refreshInterval;
      
      this.refreshTimer = window.setInterval(() => {
        this.refreshRooms();
        this.nextRefreshIn = this.settings.refreshInterval;
      }, this.settings.refreshInterval * 1000);

      this.countdownTimer = window.setInterval(() => {
        this.nextRefreshIn = Math.max(0, this.nextRefreshIn - 1);
      }, 1000);
    }
  }

  /**
   * Clear all timers
   */
  private clearTimers(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = undefined;
    }
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = undefined;
    }
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

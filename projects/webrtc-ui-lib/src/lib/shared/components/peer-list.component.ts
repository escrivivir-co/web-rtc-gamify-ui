import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { Peer } from '../../core/models';
import { PeerCardComponent } from './peer-card.component';

/**
 * Layout options for peer list
 */
export type PeerListLayout = 'grid' | 'list' | 'carousel';

/**
 * Sorting options for peers
 */
export type PeerSortBy = 'name' | 'connection' | 'quality' | 'role' | 'joinTime';

/**
 * Component for displaying a list of peers in various layouts
 * Supports grid, list, and carousel views with sorting and filtering
 */
@Component({
  selector: 'wrtc-peer-list',
  standalone: true,
  imports: [CommonModule, FormsModule, PeerCardComponent],
  template: `
    <div class="peer-list-container">
      <!-- Header with controls -->
      <div class="peer-list-header" *ngIf="showHeader">
        <div class="header-info">
          <h3 class="peers-title">
            {{ title || 'Participants' }}
            <span class="peer-count">({{ filteredPeers.length }})</span>
          </h3>
          <div class="connection-summary" *ngIf="showSummary">
            <span class="summary-item connected">
              {{ getConnectedCount() }} connected
            </span>
            <span class="summary-item connecting" *ngIf="getConnectingCount() > 0">
              {{ getConnectingCount() }} connecting
            </span>
            <span class="summary-item disconnected" *ngIf="getDisconnectedCount() > 0">
              {{ getDisconnectedCount() }} disconnected
            </span>
          </div>
        </div>

        <div class="header-controls" *ngIf="showControls">
          <!-- Layout switcher -->
          <div class="control-group" *ngIf="allowLayoutChange">
            <button *ngFor="let layoutOption of layoutOptions"
                    class="btn-layout"
                    [class.active]="layout === layoutOption"
                    (click)="setLayout(layoutOption)"
                    [title]="'Switch to ' + layoutOption + ' view'">
              <svg class="icon" viewBox="0 0 24 24">
                <path *ngIf="layoutOption === 'grid'" d="M4 4h7v7H4V4zm0 9h7v7H4v-7zm9-9h7v7h-7V4zm0 9h7v7h-7v-7z"/>
                <path *ngIf="layoutOption === 'list'" d="M4 14h4v-4H4v4zm0 5h4v-4H4v4zM4 9h4V5H4v4zm5 5h12v-4H9v4zm0 5h12v-4H9v4zM9 5v4h12V5H9z"/>
                <path *ngIf="layoutOption === 'carousel'" d="M7 19h10V5H7v14zm-5-2h4V7H2v10zM18 7v10h4V7h-4z"/>
              </svg>
            </button>
          </div>

          <!-- Sort selector -->
          <div class="control-group" *ngIf="allowSorting">
            <select class="sort-select" 
                    [(ngModel)]="sortBy" 
                    (ngModelChange)="onSortChange()">
              <option value="name">Sort by Name</option>
              <option value="connection">Sort by Connection</option>
              <option value="quality">Sort by Quality</option>
              <option value="role">Sort by Role</option>
              <option value="joinTime">Sort by Join Time</option>
            </select>
          </div>

          <!-- Filter input -->
          <div class="control-group" *ngIf="allowFiltering">
            <input type="text"
                   class="filter-input"
                   placeholder="Filter participants..."
                   [(ngModel)]="filterText"
                   (ngModelChange)="onFilterChange()">
          </div>
        </div>
      </div>

      <!-- Peer list content -->
      <div class="peer-list-content" [class]="'layout-' + layout">
        <!-- Empty state -->
        <div *ngIf="filteredPeers.length === 0" class="empty-state">
          <svg class="empty-icon" viewBox="0 0 24 24">
            <path d="M16 4c0-1.11.89-2 2-2s2 .89 2 2-.89 2-2 2-2-.89-2-2zm4 18v-6h2.5l-2.54-7.63A1.5 1.5 0 0 0 18.54 8H17c-.8 0-1.54.37-2.01.99l-2.54 3.38c-.38.51-.38 1.17 0 1.68l2.54 3.38A2.5 2.5 0 0 0 17 18h1.54a1.5 1.5 0 0 0 1.42-.37L22.5 16H20v6h4z"/>
          </svg>
          <h4 class="empty-title">{{ getEmptyStateTitle() }}</h4>
          <p class="empty-message">{{ getEmptyStateMessage() }}</p>
        </div>

        <!-- Grid layout -->
        <div *ngIf="layout === 'grid' && filteredPeers.length > 0" 
             class="peer-grid"
             [style.--columns]="gridColumns">
          <wrtc-peer-card *ngFor="let peer of filteredPeers; trackBy: trackByPeerId"
                          [peer]="peer"
                          [showVideo]="showVideo"
                          [showStats]="showStats"
                          [showMetadata]="showMetadata"
                          [showMediaControls]="showMediaControls"
                          [showConnectionControls]="showConnectionControls"
                          (audioToggle)="onAudioToggle($event)"
                          (videoToggle)="onVideoToggle($event)"
                          (peerDisconnect)="onPeerDisconnect($event)">
          </wrtc-peer-card>
        </div>

        <!-- List layout -->
        <div *ngIf="layout === 'list' && filteredPeers.length > 0" class="peer-list">
          <wrtc-peer-card *ngFor="let peer of filteredPeers; trackBy: trackByPeerId"
                          [peer]="peer"
                          [showVideo]="false"
                          [showStats]="showStats"
                          [showMetadata]="showMetadata"
                          [showMediaControls]="showMediaControls"
                          [showConnectionControls]="showConnectionControls"
                          (audioToggle)="onAudioToggle($event)"
                          (videoToggle)="onVideoToggle($event)"
                          (peerDisconnect)="onPeerDisconnect($event)">
          </wrtc-peer-card>
        </div>

        <!-- Carousel layout -->
        <div *ngIf="layout === 'carousel' && filteredPeers.length > 0" class="peer-carousel">
          <button class="carousel-btn prev" 
                  (click)="previousPeer()"
                  [disabled]="currentPeerIndex === 0">
            <svg class="icon" viewBox="0 0 24 24">
              <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
            </svg>
          </button>

          <div class="carousel-content">
            <wrtc-peer-card [peer]="filteredPeers[currentPeerIndex]"
                            [showVideo]="showVideo"
                            [showStats]="showStats"
                            [showMetadata]="showMetadata"
                            [showMediaControls]="showMediaControls"
                            [showConnectionControls]="showConnectionControls"
                            (audioToggle)="onAudioToggle($event)"
                            (videoToggle)="onVideoToggle($event)"
                            (peerDisconnect)="onPeerDisconnect($event)">
            </wrtc-peer-card>
          </div>

          <button class="carousel-btn next" 
                  (click)="nextPeer()"
                  [disabled]="currentPeerIndex === filteredPeers.length - 1">
            <svg class="icon" viewBox="0 0 24 24">
              <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
            </svg>
          </button>

          <div class="carousel-indicators">
            <button *ngFor="let peer of filteredPeers; let i = index"
                    class="indicator"
                    [class.active]="i === currentPeerIndex"
                    (click)="goToPeer(i)">
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .peer-list-container {
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    .peer-list-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 16px;
      border-bottom: 1px solid #eee;
      background: #fafafa;
    }

    .header-info {
      flex: 1;
    }

    .peers-title {
      margin: 0 0 8px 0;
      font-size: 18px;
      font-weight: 600;
      color: #333;
    }

    .peer-count {
      font-weight: 400;
      color: #666;
    }

    .connection-summary {
      display: flex;
      gap: 16px;
    }

    .summary-item {
      font-size: 12px;
      padding: 4px 8px;
      border-radius: 12px;
      font-weight: 500;
    }

    .summary-item.connected {
      background: #e8f5e8;
      color: #2e7d32;
    }

    .summary-item.connecting {
      background: #fff3e0;
      color: #f57c00;
    }

    .summary-item.disconnected {
      background: #ffebee;
      color: #d32f2f;
    }

    .header-controls {
      display: flex;
      gap: 12px;
      align-items: center;
    }

    .control-group {
      display: flex;
      gap: 4px;
    }

    .btn-layout {
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

    .btn-layout:hover {
      background: #f5f5f5;
      border-color: #bbb;
    }

    .btn-layout.active {
      background: #2196f3;
      border-color: #2196f3;
      color: white;
    }

    .sort-select, .filter-input {
      padding: 8px 12px;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 14px;
      background: white;
    }

    .filter-input {
      min-width: 200px;
    }

    .icon {
      width: 20px;
      height: 20px;
      fill: currentColor;
    }

    .peer-list-content {
      flex: 1;
      overflow: auto;
      padding: 16px;
    }

    /* Grid Layout */
    .layout-grid .peer-grid {
      display: grid;
      grid-template-columns: repeat(var(--columns, auto-fit), minmax(280px, 1fr));
      gap: 16px;
    }

    /* List Layout */
    .layout-list .peer-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    /* Carousel Layout */
    .layout-carousel .peer-carousel {
      display: flex;
      align-items: center;
      gap: 16px;
      height: 100%;
    }

    .carousel-btn {
      width: 48px;
      height: 48px;
      border: 1px solid #ddd;
      border-radius: 50%;
      background: white;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      flex-shrink: 0;
    }

    .carousel-btn:hover:not(:disabled) {
      background: #f5f5f5;
      border-color: #bbb;
    }

    .carousel-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .carousel-content {
      flex: 1;
      display: flex;
      justify-content: center;
      max-width: 400px;
      margin: 0 auto;
    }

    .carousel-indicators {
      display: flex;
      gap: 8px;
      flex-direction: column;
    }

    .indicator {
      width: 12px;
      height: 12px;
      border: none;
      border-radius: 50%;
      background: #ddd;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .indicator.active {
      background: #2196f3;
    }

    /* Empty State */
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 200px;
      text-align: center;
      color: #666;
    }

    .empty-icon {
      width: 64px;
      height: 64px;
      fill: #ccc;
      margin-bottom: 16px;
    }

    .empty-title {
      margin: 0 0 8px 0;
      font-size: 18px;
      font-weight: 500;
    }

    .empty-message {
      margin: 0;
      font-size: 14px;
    }

    /* Responsive */
    @media (max-width: 768px) {
      .peer-list-header {
        flex-direction: column;
        gap: 12px;
        align-items: stretch;
      }

      .header-controls {
        justify-content: space-between;
      }

      .layout-grid .peer-grid {
        grid-template-columns: 1fr;
      }

      .carousel-content {
        max-width: none;
      }

      .carousel-indicators {
        flex-direction: row;
      }
    }
  `]
})
export class PeerListComponent implements OnInit, OnDestroy, OnChanges {
  @Input() peers: Peer[] = [];
  @Input() title?: string;
  @Input() layout: PeerListLayout = 'grid';
  @Input() gridColumns: number = 3;
  @Input() showHeader: boolean = true;
  @Input() showSummary: boolean = true;
  @Input() showControls: boolean = true;
  @Input() showVideo: boolean = true;
  @Input() showStats: boolean = true;
  @Input() showMetadata: boolean = false;
  @Input() showMediaControls: boolean = true;
  @Input() showConnectionControls: boolean = false;
  @Input() allowLayoutChange: boolean = true;
  @Input() allowSorting: boolean = true;
  @Input() allowFiltering: boolean = true;

  @Output() layoutChange = new EventEmitter<PeerListLayout>();
  @Output() sortChange = new EventEmitter<PeerSortBy>();
  @Output() filterChange = new EventEmitter<string>();
  @Output() audioToggle = new EventEmitter<{ peerId: string; muted: boolean }>();
  @Output() videoToggle = new EventEmitter<{ peerId: string; enabled: boolean }>();
  @Output() peerDisconnect = new EventEmitter<string>();

  layoutOptions: PeerListLayout[] = ['grid', 'list', 'carousel'];
  sortBy: PeerSortBy = 'name';
  filterText: string = '';
  filteredPeers: Peer[] = [];
  currentPeerIndex: number = 0;

  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.updateFilteredPeers();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngOnChanges(): void {
    this.updateFilteredPeers();
  }

  /**
   * Set layout mode
   */
  setLayout(layout: PeerListLayout): void {
    this.layout = layout;
    this.layoutChange.emit(layout);
  }

  /**
   * Handle sort change
   */
  onSortChange(): void {
    this.updateFilteredPeers();
    this.sortChange.emit(this.sortBy);
  }

  /**
   * Handle filter change
   */
  onFilterChange(): void {
    this.updateFilteredPeers();
    this.filterChange.emit(this.filterText);
  }

  /**
   * Handle audio toggle
   */
  onAudioToggle(event: { peerId: string; muted: boolean }): void {
    this.audioToggle.emit(event);
  }

  /**
   * Handle video toggle
   */
  onVideoToggle(event: { peerId: string; enabled: boolean }): void {
    this.videoToggle.emit(event);
  }

  /**
   * Handle peer disconnect
   */
  onPeerDisconnect(peerId: string): void {
    this.peerDisconnect.emit(peerId);
  }

  /**
   * Carousel navigation
   */
  previousPeer(): void {
    if (this.currentPeerIndex > 0) {
      this.currentPeerIndex--;
    }
  }

  nextPeer(): void {
    if (this.currentPeerIndex < this.filteredPeers.length - 1) {
      this.currentPeerIndex++;
    }
  }

  goToPeer(index: number): void {
    this.currentPeerIndex = index;
  }

  /**
   * Get connected peers count
   */
  getConnectedCount(): number {
    return this.peers.filter(p => p.connectionState === 'connected').length;
  }

  /**
   * Get connecting peers count
   */
  getConnectingCount(): number {
    return this.peers.filter(p => 
      p.connectionState === 'connecting' || p.connectionState === 'new'
    ).length;
  }

  /**
   * Get disconnected peers count
   */
  getDisconnectedCount(): number {
    return this.peers.filter(p => 
      p.connectionState === 'disconnected' || 
      p.connectionState === 'failed' || 
      p.connectionState === 'closed'
    ).length;
  }

  /**
   * Get empty state title
   */
  getEmptyStateTitle(): string {
    if (this.filterText) {
      return 'No matching participants';
    }
    return 'No participants yet';
  }

  /**
   * Get empty state message
   */
  getEmptyStateMessage(): string {
    if (this.filterText) {
      return `No participants match "${this.filterText}". Try adjusting your search.`;
    }
    return 'Participants will appear here when they join the session.';
  }

  /**
   * Track by function for ngFor
   */
  trackByPeerId(index: number, peer: Peer): string {
    return peer.id;
  }

  /**
   * Update filtered and sorted peers
   */
  private updateFilteredPeers(): void {
    let filtered = [...this.peers];

    // Apply filter
    if (this.filterText) {
      const filterLower = this.filterText.toLowerCase();
      filtered = filtered.filter(peer =>
        peer.displayName.toLowerCase().includes(filterLower) ||
        peer.role?.toLowerCase().includes(filterLower) ||
        peer.id.toLowerCase().includes(filterLower)
      );
    }

    // Apply sort
    filtered.sort((a, b) => {
      switch (this.sortBy) {
        case 'name':
          return a.displayName.localeCompare(b.displayName);
        case 'connection':
          return this.getConnectionPriority(a.connectionState) - this.getConnectionPriority(b.connectionState);
        case 'quality':
          return (b.quality?.signalStrength || 'poor').localeCompare(a.quality?.signalStrength || 'poor');
        case 'role':
          return (a.role || 'participant').localeCompare(b.role || 'participant');
        case 'joinTime':
          return a.timestamps.discovered.getTime() - b.timestamps.discovered.getTime();
        default:
          return 0;
      }
    });

    this.filteredPeers = filtered;

    // Reset carousel index if needed
    if (this.currentPeerIndex >= this.filteredPeers.length) {
      this.currentPeerIndex = Math.max(0, this.filteredPeers.length - 1);
    }
  }

  /**
   * Get connection state priority for sorting
   */
  private getConnectionPriority(state: RTCPeerConnectionState): number {
    const priorities = {
      'connected': 0,
      'connecting': 1,
      'new': 2,
      'disconnected': 3,
      'failed': 4,
      'closed': 5
    };
    return priorities[state] || 6;
  }
}

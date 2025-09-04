import { Component, signal } from '@angular/core';

@Component({
  selector: 'app-root',
  imports: [],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  readonly title = signal('WebRTC Gamification UI');
  
  // Connection state
  readonly connectionStatus = signal<'disconnected' | 'connecting' | 'connected'>('disconnected');
  readonly isConnecting = signal(false);
  
  // Game state
  readonly currentPhase = signal('Lobby');
  readonly connectedPeers = signal<Array<{id: string, status: string}>>([]);
  
  // Debug
  readonly angularVersion = signal('20');

  constructor() {
    // Initialize with demo data
    console.log('WebRTC UI initialized');
  }

  initializeConnection(): void {
    this.isConnecting.set(true);
    this.connectionStatus.set('connecting');
    
    // Simulate connection process
    setTimeout(() => {
      this.connectionStatus.set('connected');
      this.isConnecting.set(false);
      this.currentPhase.set('Connected');
      
      // Add some demo peers
      this.connectedPeers.set([
        { id: 'player-1', status: 'ready' },
        { id: 'player-2', status: 'waiting' }
      ]);
    }, 2000);
  }

  disconnect(): void {
    this.connectionStatus.set('disconnected');
    this.connectedPeers.set([]);
    this.currentPhase.set('Lobby');
  }
}

import { Component, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { io, Socket } from 'socket.io-client';

@Component({
  selector: 'wrtc-alephscript-webrtc-ui',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="webrtc-gamification-ui">
      <header class="ui-header">
        <h1>🎮 {{ title() }}</h1>
        <div class="status-indicator" [class]="connectionStatus()">
          @if (connectionStatus() === 'registered') {
            🟢 Connected & Registered
            @if (isMaster()) {
              👑 MASTER
            }
          } @else if (connectionStatus() === 'connected') {
            🟡 Connected
          } @else if (connectionStatus() === 'connecting') {
            🟡 Connecting...
          } @else {
            🔴 Disconnected
          }
        </div>
      </header>

      <main class="ui-main">
        <section class="connection-panel">
          <h2>🌐 AlephScript Connection</h2>
          <div class="connection-info">
            <p><strong>Room:</strong> {{ roomName() }}</p>
            <p><strong>Session:</strong> {{ sessionHash }}</p>
            @if (lastMessage()) {
              <p><strong>Last Event:</strong> {{ lastMessage() }}</p>
            }
          </div>
          <div class="connection-controls">
            @if (connectionStatus() === 'disconnected') {
              <button (click)="initializeConnection()" [disabled]="isConnecting()">
                {{ isConnecting() ? 'Connecting...' : 'Connect to AlephScript' }}
              </button>
            } @else {
              <button (click)="disconnect()">Disconnect</button>
              @if (connectionStatus() === 'registered') {
                <button (click)="sendTestMessage()">Send Test Message</button>
                <button (click)="sendHeartbeat()">Send Heartbeat</button>
                <button (click)="sendGameAction('webrtc_ready', {peers: 0})">Send Game Action</button>
              }
            }
          </div>
        </section>

        <section class="game-panel">
          <h2>🎯 Game Status</h2>
          <div class="game-info">
            <p><strong>Current Phase:</strong> {{ currentPhase() }}</p>
            <p><strong>Master Status:</strong> {{ isMaster() ? 'Master of Room' : 'Follower' }}</p>
            <p><strong>Connected Peers:</strong> {{ connectedPeers().length }}</p>
          </div>
        </section>
      </main>

      <footer class="ui-footer">
        <p>WebRTC Gamification UI - Real-time multiplayer gaming interface</p>
        <div class="version-info">
          v1.0.0-alpha | Angular {{ angularVersion() }} Zoneless | AlephScript Protocol
        </div>
      </footer>
    </div>
  `,
  styles: [`
    .webrtc-gamification-ui {
      background: #fff;
      border: 1px solid #e0e0e0;
      border-radius: 12px;
      display: flex;
      flex-direction: column;
      min-height: 600px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      overflow: hidden;
    }

    .ui-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      background: #f8f9fa;
      border-bottom: 1px solid #e0e0e0;
    }

    .ui-header h1 {
      font-weight: 600;
      color: #333;
      font-size: 18px;
      margin: 0;
    }

    .status-indicator {
      padding: 8px 12px;
      border-radius: 6px;
      font-weight: 500;
      font-size: 14px;
    }

    .status-indicator.disconnected {
      background: #fee;
      color: #c53030;
    }

    .status-indicator.connecting {
      background: #fef5e7;
      color: #d69e2e;
    }

    .status-indicator.connected {
      background: #f0fff4;
      color: #38a169;
    }

    .status-indicator.registered {
      background: #e6fffa;
      color: #319795;
    }

    .ui-main {
      flex: 1;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .connection-panel, .game-panel {
      background: #fafafa;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 16px;
    }

    .connection-panel h2, .game-panel h2 {
      margin: 0 0 12px 0;
      font-size: 16px;
      font-weight: 600;
      color: #333;
    }

    .connection-info {
      margin-bottom: 16px;
    }

    .connection-info p {
      margin: 4px 0;
      font-size: 14px;
      color: #666;
    }

    .connection-controls {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .connection-controls button {
      padding: 8px 16px;
      border: 1px solid #d0d0d0;
      border-radius: 6px;
      background: #fff;
      cursor: pointer;
      transition: all 0.2s ease;
      font-size: 14px;
    }

    .connection-controls button:hover:not(:disabled) {
      background: #f0f0f0;
      border-color: #b0b0b0;
    }

    .connection-controls button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .game-info p {
      margin: 4px 0;
      font-size: 14px;
      color: #666;
    }

    .ui-footer {
      padding: 16px 20px;
      background: #f8f9fa;
      border-top: 1px solid #e0e0e0;
      text-align: center;
    }

    .ui-footer p {
      margin: 0 0 4px 0;
      font-size: 14px;
      color: #666;
    }

    .version-info {
      font-size: 12px;
      color: #999;
    }
  `]
})
export class AlephScriptWebRTCUIComponent implements OnInit, OnDestroy {
  readonly title = signal('WebRTC Gamification UI');
  
  // AlephScript connection
  private socket?: Socket;
  readonly sessionHash = this.generateSessionHash();
  
  // Connection state
  readonly connectionStatus = signal<'disconnected' | 'connecting' | 'connected' | 'registered'>('disconnected');
  readonly isConnecting = signal(false);
  readonly isMaster = signal(false);
  
  // Game state
  readonly currentPhase = signal('Lobby');
  readonly connectedPeers = signal<Array<{id: string, status: string}>>([]);
  readonly roomName = signal('WebRTCUI_WebRTC Gamification UI_ROOM');
  
  // Debug
  readonly angularVersion = signal('20');
  readonly lastMessage = signal<string>('');

  constructor() {
    console.log('🎮 [AlephScript] WebRTC UI Component initialized');
    console.log('📋 [AlephScript] Session Hash:', this.sessionHash);
    console.log('🏠 [AlephScript] Target Room:', this.roomName());
    console.log('🔧 [AlephScript] Component ready for connection');
  }

  ngOnInit(): void {
    this.initializeConnection();
  }

  ngOnDestroy(): void {
    this.disconnect();
  }

  private generateSessionHash(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  initializeConnection(): void {
    console.log('🚀 [AlephScript] Starting AlephScript connection protocol...');
    this.isConnecting.set(true);
    this.connectionStatus.set('connecting');
    
    try {
      // Connect to AlephScript server
      console.log('🔌 [AlephScript] Attempting connection to AlephScript server at localhost:3000');
      this.socket = io('http://localhost:3000', {
        reconnection: true,
        reconnectionAttempts: 5,
        transports: ['websocket', 'polling']
      });
      
      this.socket.on('connect', () => {
        console.log('✅ [AlephScript] Connected to AlephScript server successfully');
        console.log('🆔 [AlephScript] Socket ID:', this.socket?.id);
        this.connectionStatus.set('connected');
        
        // STEP 1: CLIENT_REGISTER with correct AlephScript protocol
        const registerPayload = {
          usuario: 'WebRTCGamificationUI',
          sesion: this.sessionHash
        };
        
        console.log('📝 [AlephScript] STEP 1/3: Sending CLIENT_REGISTER with payload:', registerPayload);
        this.socket?.emit('CLIENT_REGISTER', registerPayload);
        
        this.lastMessage.set('CLIENT_REGISTER sent');
      });

      this.socket.on('CLIENT_REGISTERED', (data: any) => {
        console.log('✅ [AlephScript] STEP 1 COMPLETE: CLIENT_REGISTERED received with data:', data);
        this.lastMessage.set('Client registered successfully');
        
        // STEP 2: CLIENT_SUSCRIBE to room
        const subscribePayload = {
          room: this.roomName()
        };
        
        console.log('🏠 [AlephScript] STEP 2/3: Sending CLIENT_SUSCRIBE with payload:', subscribePayload);
        this.socket?.emit('CLIENT_SUSCRIBE', subscribePayload);
        this.lastMessage.set('CLIENT_SUSCRIBE sent');
      });

      this.socket.on('CLIENT_SUBSCRIBED', (data: any) => {
        console.log('✅ [AlephScript] STEP 2 COMPLETE: CLIENT_SUBSCRIBED received with data:', data);
        this.connectionStatus.set('registered');
        this.isConnecting.set(false);
        this.lastMessage.set(`Subscribed to room: ${data.room || this.roomName()}`);
        
        // Check if we became master (STEP 3 implicit)
        if (data.isMaster) {
          console.log('👑 [AlephScript] STEP 3: Became MASTER of the room!');
          this.isMaster.set(true);
          this.currentPhase.set('Master - Room Control');
        } else {
          console.log('👥 [AlephScript] STEP 3: Joined as FOLLOWER');
          this.currentPhase.set('Connected - Follower');
        }
        
        console.log('🎉 [AlephScript] Protocol complete! Ready for WebRTC signaling.');
        console.log('📊 [AlephScript] Final state - Room:', this.roomName(), 'Master:', this.isMaster());
      });

      this.socket.on('disconnect', () => {
        console.log('🔌 Disconnected from AlephScript server');
        console.log('📊 Final state before disconnect - Master:', this.isMaster(), 'Phase:', this.currentPhase());
        this.connectionStatus.set('disconnected');
        this.isMaster.set(false);
        this.currentPhase.set('Lobby');
        this.lastMessage.set('Disconnected');
      });

      this.socket.on('connect_error', (error: any) => {
        console.error('❌ Connection error:', error);
        console.error('🔍 Error details:', {
          message: error.message,
          type: error.type,
          description: error.description
        });
        this.connectionStatus.set('disconnected');
        this.isConnecting.set(false);
        this.lastMessage.set(`Connection error: ${error.message}`);
      });

      // Listen for all events for debugging
      this.socket.onAny((event: string, ...args: any[]) => {
        console.log(`🎧 Socket Event Received: ${event}`, args);
        
        // Log specific events we're interested in
        if (event.includes('CLIENT') || event.includes('ROOM') || event.includes('USER')) {
          console.log(`🔍 AlephScript Event Detail: ${event}`, JSON.stringify(args, null, 2));
        }
      });

    } catch (error) {
      console.error('❌ Failed to initialize connection:', error);
      this.connectionStatus.set('disconnected');
      this.isConnecting.set(false);
      this.lastMessage.set(`Init error: ${error}`);
    }
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = undefined;
    }
    this.connectionStatus.set('disconnected');
    this.connectedPeers.set([]);
    this.currentPhase.set('Lobby');
    this.isMaster.set(false);
    this.lastMessage.set('Manually disconnected');
  }

  sendTestMessage(): void {
    if (this.socket && this.socket.connected) {
      const payload = {
        input: 'Test message from WebRTC UI',
        metadata: { source: 'webrtc-ui', type: 'test' },
        timestamp: Date.now(),
        room: this.roomName()
      };
      
      console.log('💬 Sending test message via user_input channel:', payload);
      this.socket.emit('user_input', payload);
      this.lastMessage.set('Test message sent via user_input');
    } else {
      console.warn('⚠️ Cannot send test message - socket not connected');
    }
  }

  sendHeartbeat(): void {
    if (this.socket && this.socket.connected) {
      const payload = {
        timestamp: Date.now(),
        room: this.roomName(),
        uiType: 'WebRTCUI'
      };
      
      console.log('💓 Sending heartbeat via client_heartbeat channel:', payload);
      this.socket.emit('client_heartbeat', payload);
      this.lastMessage.set('Heartbeat sent');
    } else {
      console.warn('⚠️ Cannot send heartbeat - socket not connected');
    }
  }

  sendGameAction(action: string, payload: any = {}): void {
    if (this.socket && this.socket.connected) {
      const gamePayload = {
        action,
        payload,
        timestamp: Date.now(),
        room: this.roomName()
      };
      
      console.log('🎮 Sending game action via game_action channel:', gamePayload);
      this.socket.emit('game_action', gamePayload);
      this.lastMessage.set(`Game action sent: ${action}`);
    } else {
      console.warn('⚠️ Cannot send game action - socket not connected');
    }
  }
}

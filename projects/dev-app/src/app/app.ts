import { Component, signal, OnInit, OnDestroy } from '@angular/core';
import { WebRTCUILibModule } from 'webrtc-ui-lib';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { io, Socket } from 'socket.io-client';

interface AlephScriptMessage {
  type: 'app' | 'sys' | 'ui';
  event: string;
  data: any;
  timestamp: number;
  channel: string;
}

interface WebRTCPeer {
  id: string;
  socketId: string;
  status: 'connecting' | 'connected' | 'disconnected';
  isMaster: boolean;
  lastSeen: number;
}

interface GameSession {
  roomName: string;
  sessionId: string;
  phase: 'lobby' | 'connecting' | 'playing' | 'paused' | 'ended';
  players: WebRTCPeer[];
  masterPeer?: string;
}

@Component({
  selector: 'app-root',
  imports: [WebRTCUILibModule, CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit, OnDestroy {
  protected readonly title = signal('WebRTC Gamify UI Demo - Complete Integration');
  
  // AlephScript Protocol Implementation
  private socket?: Socket;
  readonly sessionHash = this.generateSessionHash();
  readonly clientName = 'WebRTCGamifyUI_Demo';
  
  // Connection state
  readonly connectionStatus = signal<'disconnected' | 'connecting' | 'connected' | 'registered' | 'subscribed' | 'master'>('disconnected');
  readonly currentStep = signal<string>('Ready to connect');
  readonly lastMessage = signal<string>('Demo app loaded');
  readonly messages = signal<AlephScriptMessage[]>([]);
  
  // Room management (3-channel system: app, sys, ui)
  readonly currentRoom = signal<string>('WebRTCDemo_DefaultRoom');
  readonly appChannel = signal<string>('');
  readonly sysChannel = signal<string>('');
  readonly uiChannel = signal<string>('');
  
  // AlephScript protocol state
  readonly isRegistered = signal(false);
  readonly isSubscribed = signal(false);
  readonly isMaster = signal(false);
  readonly protocolStep = signal<1 | 2 | 3 | 0>(0); // 0=disconnected, 1=register, 2=subscribe, 3=master
  
  // Game session state
  readonly gameSession = signal<GameSession>({
    roomName: '',
    sessionId: '',
    phase: 'lobby',
    players: [],
    masterPeer: undefined
  });
  
  // WebRTC state (prepared for future implementation)
  readonly webrtcEnabled = signal(false);
  readonly connectedPeers = signal<WebRTCPeer[]>([]);
  readonly localStream = signal<MediaStream | null>(null);
  
  // UI state
  readonly showAdvanced = signal(false);
  readonly autoConnect = signal(true);

  constructor() {
    console.log('🎮 [Demo] WebRTC Gamify UI Demo initialized');
    console.log('📋 [Demo] Session Hash:', this.sessionHash);
    console.log('🏠 [Demo] Default Room:', this.currentRoom());
  }

  ngOnInit(): void {
    this.setupChannelNames();
    this.addMessage('sys', 'DEMO_INIT', { status: 'ready' });
    
    if (this.autoConnect()) {
      setTimeout(() => this.initializeAlephScript(), 1000);
    }
  }

  ngOnDestroy(): void {
    this.disconnect();
  }

  private generateSessionHash(): string {
    return `${this.clientName}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  private setupChannelNames(): void {
    const room = this.currentRoom();
    this.appChannel.set(`${room}_APP`);
    this.sysChannel.set(`${room}_SYS`);
    this.uiChannel.set(`${room}_UI`);
    
    console.log('📡 [Demo] Channels configured:', {
      app: this.appChannel(),
      sys: this.sysChannel(),
      ui: this.uiChannel()
    });
  }

  private addMessage(type: 'app' | 'sys' | 'ui', event: string, data: any): void {
    const message: AlephScriptMessage = {
      type,
      event,
      data,
      timestamp: Date.now(),
      channel: type === 'app' ? this.appChannel() : type === 'sys' ? this.sysChannel() : this.uiChannel()
    };
    
    const current = this.messages();
    this.messages.set([...current, message].slice(-20)); // Keep last 20 messages
    
    console.log(`📨 [Demo] Message added:`, message);
  }

  // PUBLIC METHODS FOR TEMPLATE
  initializeAlephScript(): void {
    console.log('🚀 [Demo] Starting AlephScript connection protocol...');
    this.connectionStatus.set('connecting');
    this.currentStep.set('Initializing connection...');
    this.protocolStep.set(0);
    
    try {
      console.log('🔌 [Demo] Connecting to AlephScript server at localhost:3000');
      this.socket = io('http://localhost:3000', {
        reconnection: true,
        reconnectionAttempts: 5,
        transports: ['websocket', 'polling']
      });
      
      this.setupSocketListeners();
      this.addMessage('sys', 'CONNECTION_INIT', { server: 'localhost:3000' });
      
    } catch (error) {
      console.error('❌ [Demo] Failed to initialize connection:', error);
      this.connectionStatus.set('disconnected');
      this.currentStep.set('Connection failed');
      this.addMessage('sys', 'CONNECTION_ERROR', { error: error });
    }
  }

  private setupSocketListeners(): void {
    if (!this.socket) return;

    // Basic connection events
    this.socket.on('connect', () => {
      console.log('✅ [Demo] Connected to AlephScript server');
      console.log('🆔 [Demo] Socket ID:', this.socket?.id);
      this.connectionStatus.set('connected');
      this.currentStep.set('Connected - Starting registration...');
      this.addMessage('sys', 'CONNECTED', { socketId: this.socket?.id });
      
      // STEP 1: CLIENT_REGISTER
      this.executeStep1Register();
    });

    // STEP 1 Response: CLIENT_REGISTERED
    this.socket.on('CLIENT_REGISTERED', (data: any) => {
      console.log('✅ [Demo] STEP 1 COMPLETE: CLIENT_REGISTERED received:', data);
      this.connectionStatus.set('registered');
      this.isRegistered.set(true);
      this.protocolStep.set(1);
      this.currentStep.set('Registered - Starting subscription...');
      this.addMessage('app', 'CLIENT_REGISTERED', data);
      
      // STEP 2: CLIENT_SUSCRIBE
      this.executeStep2Subscribe();
    });

    // STEP 2 Response: CLIENT_SUBSCRIBED
    this.socket.on('CLIENT_SUBSCRIBED', (data: any) => {
      console.log('✅ [Demo] STEP 2 COMPLETE: CLIENT_SUBSCRIBED received:', data);
      this.connectionStatus.set('subscribed');
      this.isSubscribed.set(true);
      this.protocolStep.set(2);
      this.currentStep.set('Subscribed - Checking master status...');
      this.addMessage('app', 'CLIENT_SUBSCRIBED', data);
      
      // STEP 3: Check master status (implicit)
      this.executeStep3CheckMaster(data);
    });

    // Error handling
    this.socket.on('connect_error', (error: any) => {
      console.error('❌ [Demo] Connection error:', error);
      this.connectionStatus.set('disconnected');
      this.currentStep.set(`Error: ${error.message}`);
      this.addMessage('sys', 'CONNECTION_ERROR', error);
    });

    this.socket.on('disconnect', () => {
      console.log('🔌 [Demo] Disconnected from AlephScript server');
      this.resetState();
      this.addMessage('sys', 'DISCONNECTED', {});
    });

    // Listen for all events for debugging
    this.socket.onAny((event: string, ...args: any[]) => {
      console.log(`🎧 [Demo] Event: ${event}`, args);
      
      if (event.includes('ROOM') || event.includes('USER') || event.includes('GAME')) {
        this.addMessage('ui', event, args[0] || {});
      }
    });
  }

  private executeStep1Register(): void {
    const payload = {
      usuario: this.clientName,
      sesion: this.sessionHash
    };
    
    console.log('📝 [Demo] STEP 1/3: Sending CLIENT_REGISTER:', payload);
    this.socket?.emit('CLIENT_REGISTER', payload);
    this.addMessage('app', 'CLIENT_REGISTER_SENT', payload);
  }

  private executeStep2Subscribe(): void {
    const payload = {
      room: this.currentRoom()
    };
    
    console.log('🏠 [Demo] STEP 2/3: Sending CLIENT_SUSCRIBE:', payload);
    this.socket?.emit('CLIENT_SUSCRIBE', payload);
    this.addMessage('app', 'CLIENT_SUSCRIBE_SENT', payload);
  }

  private executeStep3CheckMaster(data: any): void {
    console.log('👑 [Demo] STEP 3/3: Checking master status in response:', data);
    
    if (data.isMaster || data.master === true) {
      console.log('🏆 [Demo] Became MASTER of the room!');
      this.isMaster.set(true);
      this.connectionStatus.set('master');
      this.protocolStep.set(3);
      this.currentStep.set('Connected as MASTER - Full control');
      
      // Initialize game session as master
      this.initializeGameSession(true);
      
    } else {
      console.log('👥 [Demo] Joined as FOLLOWER');
      this.protocolStep.set(3);
      this.currentStep.set('Connected as FOLLOWER - Awaiting commands');
      
      // Join existing game session
      this.initializeGameSession(false);
    }
    
    this.addMessage('ui', 'MASTER_STATUS_SET', { 
      isMaster: this.isMaster(), 
      status: this.connectionStatus() 
    });
  }

  private initializeGameSession(asMaster: boolean): void {
    const session: GameSession = {
      roomName: this.currentRoom(),
      sessionId: this.sessionHash,
      phase: 'lobby',
      players: [],
      masterPeer: asMaster ? this.socket?.id : undefined
    };
    
    this.gameSession.set(session);
    console.log('🎮 [Demo] Game session initialized:', session);
    this.addMessage('ui', 'GAME_SESSION_INIT', session);
  }

  private resetState(): void {
    this.connectionStatus.set('disconnected');
    this.currentStep.set('Disconnected');
    this.isRegistered.set(false);
    this.isSubscribed.set(false);
    this.isMaster.set(false);
    this.protocolStep.set(0);
    this.connectedPeers.set([]);
  }

  disconnect(): void {
    console.log('🔌 [Demo] Manual disconnect initiated');
    if (this.socket) {
      this.socket.disconnect();
      this.socket = undefined;
    }
    this.resetState();
    this.addMessage('sys', 'MANUAL_DISCONNECT', {});
  }

  // Communication methods for each channel
  sendAppMessage(input: string): void {
    if (!this.socket?.connected) return;
    
    const payload = {
      input,
      room: this.currentRoom(),
      channel: 'app',
      timestamp: Date.now()
    };
    
    console.log('💬 [Demo] Sending APP channel message:', payload);
    this.socket.emit('user_input', payload);
    this.addMessage('app', 'USER_INPUT_SENT', payload);
  }

  sendSysHeartbeat(): void {
    if (!this.socket?.connected) return;
    
    const payload = {
      timestamp: Date.now(),
      room: this.currentRoom(),
      clientType: 'WebRTCDemo',
      status: this.connectionStatus()
    };
    
    console.log('💓 [Demo] Sending SYS heartbeat:', payload);
    this.socket.emit('client_heartbeat', payload);
    this.addMessage('sys', 'HEARTBEAT_SENT', payload);
  }

  sendUIGameAction(action: string, data: any = {}): void {
    if (!this.socket?.connected) return;
    
    const payload = {
      action,
      data,
      room: this.currentRoom(),
      timestamp: Date.now(),
      master: this.isMaster()
    };
    
    console.log('🎮 [Demo] Sending UI game action:', payload);
    this.socket.emit('game_action', payload);
    this.addMessage('ui', 'GAME_ACTION_SENT', payload);
  }

  // UI Helper methods
  updateRoomName(event: any): void {
    const newRoom = event.target.value;
    this.currentRoom.set(newRoom);
    this.setupChannelNames();
    console.log('🏠 [Demo] Room name updated to:', newRoom);
  }

  toggleAdvanced(): void {
    this.showAdvanced.set(!this.showAdvanced());
  }

  clearMessages(): void {
    this.messages.set([]);
    console.log('🧹 [Demo] Message log cleared');
  }

  // Test methods for each channel
  testAppChannel(): void {
    this.sendAppMessage('Test message from APP channel via user_input');
  }

  testSysChannel(): void {
    this.sendSysHeartbeat();
  }

  testUIChannel(): void {
    this.sendUIGameAction('webrtc_ready', { 
      peers: this.connectedPeers().length,
      master: this.isMaster(),
      phase: this.gameSession().phase
    });
  }

  // WebRTC preparation methods (for future implementation)
  enableWebRTC(): void {
    console.log('🚀 [Demo] WebRTC will be enabled once AlephScript signaling is ready');
    this.webrtcEnabled.set(true);
    this.sendUIGameAction('webrtc_enable', { enabled: true });
  }

  disableWebRTC(): void {
    this.webrtcEnabled.set(false);
    this.sendUIGameAction('webrtc_disable', { enabled: false });
  }

  // Game control methods (for master)
  startGame(): void {
    if (!this.isMaster()) {
      console.warn('⚠️ [Demo] Only master can start game');
      return;
    }
    
    const session = { ...this.gameSession(), phase: 'playing' as const };
    this.gameSession.set(session);
    this.sendUIGameAction('game_start', session);
  }

  pauseGame(): void {
    if (!this.isMaster()) return;
    
    const session = { ...this.gameSession(), phase: 'paused' as const };
    this.gameSession.set(session);
    this.sendUIGameAction('game_pause', session);
  }

  endGame(): void {
    if (!this.isMaster()) return;
    
    const session = { ...this.gameSession(), phase: 'ended' as const };
    this.gameSession.set(session);
    this.sendUIGameAction('game_end', session);
  }
}

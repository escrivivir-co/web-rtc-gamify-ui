import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ViewChild, ElementRef, Signal, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: Date;
  type: 'text' | 'file' | 'system' | 'emoji';
  fileInfo?: FileInfo;
  isOwn: boolean;
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
}

export interface FileInfo {
  name: string;
  size: number;
  type: string;
  url?: string;
  progress?: number;
}

export interface ChatParticipant {
  id: string;
  name: string;
  isOnline: boolean;
  isTyping: boolean;
  avatar?: string;
}

export interface ChatSettings {
  allowFiles: boolean;
  allowEmojis: boolean;
  maxFileSize: number; // in bytes
  allowedFileTypes: string[];
  showTypingIndicators: boolean;
  showReadReceipts: boolean;
  autoScroll: boolean;
  soundEnabled: boolean;
}

@Component({
  selector: 'webrtc-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="chat-container" 
         [class.minimized]="isMinimized"
         [class.compact]="compactMode">
      
      <!-- Chat Header -->
      <div class="chat-header">
        <div class="chat-title">
          <span class="icon">💬</span>
          <span class="title">Chat</span>
          <span class="participant-count" *ngIf="participants.length > 0">
            ({{ participants.length }})
          </span>
        </div>
        
        <div class="header-controls">
          <button type="button" 
                  class="header-btn"
                  (click)="toggleParticipants()"
                  [class.active]="showParticipants"
                  title="Show Participants">
            <span class="icon">👥</span>
          </button>
          
          <button type="button" 
                  class="header-btn"
                  (click)="toggleSettings()"
                  [class.active]="showSettings"
                  title="Settings">
            <span class="icon">⚙️</span>
          </button>
          
          <button type="button" 
                  class="header-btn"
                  (click)="toggleMinimize()"
                  title="{{ isMinimized ? 'Expand' : 'Minimize' }}">
            <span class="icon">{{ isMinimized ? '⬆️' : '⬇️' }}</span>
          </button>
          
          <button type="button" 
                  class="header-btn close-btn"
                  (click)="closeChat()"
                  title="Close Chat">
            <span class="icon">❌</span>
          </button>
        </div>
      </div>

      <!-- Chat Content (hidden when minimized) -->
      <div class="chat-content" *ngIf="!isMinimized">
        
        <!-- Participants Panel -->
        <div class="participants-panel" *ngIf="showParticipants">
          <h4>Participants ({{ participants.length }})</h4>
          <div class="participants-list">
            <div *ngFor="let participant of participants" 
                 class="participant-item"
                 [class.online]="participant.isOnline"
                 [class.typing]="participant.isTyping">
              <div class="participant-avatar">
                <img *ngIf="participant.avatar" 
                     [src]="participant.avatar" 
                     [alt]="participant.name">
                <span *ngIf="!participant.avatar" class="avatar-placeholder">
                  {{ getInitials(participant.name) }}
                </span>
              </div>
              <div class="participant-info">
                <span class="participant-name">{{ participant.name }}</span>
                <span class="participant-status">
                  {{ participant.isTyping ? 'typing...' : (participant.isOnline ? 'online' : 'offline') }}
                </span>
              </div>
              <div class="status-indicator" 
                   [class.online]="participant.isOnline">
              </div>
            </div>
          </div>
        </div>

        <!-- Settings Panel -->
        <div class="settings-panel" *ngIf="showSettings">
          <h4>Chat Settings</h4>
          <div class="settings-list">
            <div class="setting-item">
              <label class="checkbox-label">
                <input type="checkbox" 
                       [(ngModel)]="settings.allowFiles"
                       (change)="onSettingsChange()">
                <span class="checkmark"></span>
                Allow File Sharing
              </label>
            </div>
            
            <div class="setting-item">
              <label class="checkbox-label">
                <input type="checkbox" 
                       [(ngModel)]="settings.allowEmojis"
                       (change)="onSettingsChange()">
                <span class="checkmark"></span>
                Enable Emojis
              </label>
            </div>
            
            <div class="setting-item">
              <label class="checkbox-label">
                <input type="checkbox" 
                       [(ngModel)]="settings.showTypingIndicators"
                       (change)="onSettingsChange()">
                <span class="checkmark"></span>
                Show Typing Indicators
              </label>
            </div>
            
            <div class="setting-item">
              <label class="checkbox-label">
                <input type="checkbox" 
                       [(ngModel)]="settings.autoScroll"
                       (change)="onSettingsChange()">
                <span class="checkmark"></span>
                Auto Scroll
              </label>
            </div>
            
            <div class="setting-item">
              <label class="checkbox-label">
                <input type="checkbox" 
                       [(ngModel)]="settings.soundEnabled"
                       (change)="onSettingsChange()">
                <span class="checkmark"></span>
                Sound Notifications
              </label>
            </div>
          </div>
        </div>

        <!-- Messages Area -->
        <div class="messages-area" 
             #messagesContainer
             (dragover)="onDragOver($event)"
             (dragleave)="onDragLeave($event)"
             (drop)="onFileDrop($event)"
             [class.drag-active]="isDragActive">
          
          <!-- No messages placeholder -->
          <div class="no-messages" *ngIf="messages().length === 0">
            <span class="icon">💭</span>
            <p>No messages yet. Start the conversation!</p>
          </div>

          <!-- Messages list -->
          <div class="messages-list" *ngIf="messages().length > 0">
            <div *ngFor="let message of messages(); trackBy: trackMessage" 
                 class="message-wrapper"
                 [class.own]="message.isOwn">
              
              <!-- System message -->
              <div *ngIf="message.type === 'system'" class="system-message">
                <span class="system-icon">ℹ️</span>
                <span class="system-text">{{ message.content }}</span>
                <span class="system-time">{{ formatTime(message.timestamp) }}</span>
              </div>

              <!-- Regular message -->
              <div *ngIf="message.type !== 'system'" class="message-item">
                <div class="message-avatar" *ngIf="!message.isOwn">
                  <span class="avatar-text">{{ getInitials(message.senderName) }}</span>
                </div>
                
                <div class="message-content">
                  <div class="message-header" *ngIf="!message.isOwn || showSenderNames">
                    <span class="sender-name">{{ message.senderName }}</span>
                    <span class="message-time">{{ formatTime(message.timestamp) }}</span>
                  </div>
                  
                  <div class="message-body">
                    <!-- Text message -->
                    <div *ngIf="message.type === 'text'" 
                         class="text-message"
                         [innerHTML]="formatMessage(message.content)">
                    </div>
                    
                    <!-- File message -->
                    <div *ngIf="message.type === 'file'" class="file-message">
                      <div class="file-info">
                        <span class="file-icon">{{ getFileIcon(message.fileInfo!.type) }}</span>
                        <div class="file-details">
                          <span class="file-name">{{ message.fileInfo!.name }}</span>
                          <span class="file-size">{{ formatFileSize(message.fileInfo!.size) }}</span>
                        </div>
                        <button type="button" 
                                class="download-btn"
                                (click)="downloadFile(message)"
                                *ngIf="message.fileInfo!.url">
                          📥
                        </button>
                      </div>
                      <div class="file-progress" *ngIf="message.fileInfo!.progress !== undefined">
                        <div class="progress-bar">
                          <div class="progress-fill" 
                               [style.width.%]="message.fileInfo!.progress">
                          </div>
                        </div>
                        <span class="progress-text">{{ message.fileInfo!.progress }}%</span>
                      </div>
                    </div>
                  </div>
                  
                  <div class="message-status" *ngIf="message.isOwn">
                    <span class="status-icon" [class]="'status-' + message.status">
                      {{ getStatusIcon(message.status) }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Typing indicators -->
          <div class="typing-indicators" *ngIf="typingUsers().length > 0">
            <div class="typing-item" *ngFor="let user of typingUsers()">
              <span class="typing-name">{{ user.name }}</span>
              <span class="typing-animation">
                <span class="dot"></span>
                <span class="dot"></span>
                <span class="dot"></span>
              </span>
            </div>
          </div>

          <!-- Drag overlay -->
          <div class="drag-overlay" *ngIf="isDragActive">
            <div class="drag-content">
              <span class="drag-icon">📁</span>
              <p>Drop files here to share</p>
            </div>
          </div>
        </div>

        <!-- Input Area -->
        <div class="input-area">
          <!-- File preview -->
          <div class="file-preview" *ngIf="selectedFiles.length > 0">
            <div *ngFor="let file of selectedFiles; let i = index" 
                 class="file-preview-item">
              <span class="file-icon">{{ getFileIcon(file.type) }}</span>
              <span class="file-name">{{ file.name }}</span>
              <span class="file-size">{{ formatFileSize(file.size) }}</span>
              <button type="button" 
                      class="remove-file"
                      (click)="removeFile(i)">
                ❌
              </button>
            </div>
          </div>

          <!-- Message input -->
          <div class="message-input-container">
            <input type="file" 
                   #fileInput
                   multiple
                   [accept]="settings.allowedFileTypes.join(',')"
                   (change)="onFileSelect($event)"
                   style="display: none;">
            
            <button type="button" 
                    class="input-btn file-btn"
                    (click)="fileInput.click()"
                    [disabled]="!settings.allowFiles || disabled"
                    title="Attach File">
              📎
            </button>
            
            <button type="button" 
                    class="input-btn emoji-btn"
                    (click)="toggleEmojiPicker()"
                    [disabled]="!settings.allowEmojis || disabled"
                    [class.active]="showEmojiPicker"
                    title="Add Emoji">
              😀
            </button>
            
            <input type="text" 
                   class="message-input"
                   [(ngModel)]="currentMessage"
                   (keydown)="onKeyDown($event)"
                   (input)="onTyping()"
                   [placeholder]="getInputPlaceholder()"
                   [disabled]="disabled"
                   maxlength="1000">
            
            <button type="button" 
                    class="input-btn send-btn"
                    (click)="sendMessage()"
                    [disabled]="!canSendMessage() || disabled"
                    title="Send Message">
              📤
            </button>
          </div>

          <!-- Emoji picker -->
          <div class="emoji-picker" *ngIf="showEmojiPicker">
            <div class="emoji-grid">
              <button type="button" 
                      *ngFor="let emoji of commonEmojis" 
                      class="emoji-btn"
                      (click)="insertEmoji(emoji)"
                      [title]="emoji">
                {{ emoji }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Unread badge (when minimized) -->
      <div class="unread-badge" 
           *ngIf="isMinimized && unreadCount() > 0">
        {{ unreadCount() > 99 ? '99+' : unreadCount() }}
      </div>
    </div>
  `,
  styles: [`
    .chat-container {
      background: #ffffff;
      border: 1px solid #e0e0e0;
      border-radius: 12px;
      display: flex;
      flex-direction: column;
      height: 600px;
      max-height: 80vh;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      position: relative;
      overflow: hidden;
    }

    .chat-container.minimized {
      height: 50px;
    }

    .chat-container.compact {
      height: 400px;
    }

    .chat-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      background: #f8f9fa;
      border-bottom: 1px solid #e0e0e0;
      border-radius: 12px 12px 0 0;
    }

    .chat-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
      color: #333;
    }

    .participant-count {
      font-size: 12px;
      color: #666;
      font-weight: normal;
    }

    .header-controls {
      display: flex;
      gap: 4px;
    }

    .header-btn {
      width: 32px;
      height: 32px;
      border: none;
      border-radius: 6px;
      background: transparent;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      font-size: 14px;
    }

    .header-btn:hover {
      background: #e9ecef;
    }

    .header-btn.active {
      background: #007bff;
      color: white;
    }

    .close-btn:hover {
      background: #dc3545;
      color: white;
    }

    .chat-content {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
    }

    .participants-panel, .settings-panel {
      padding: 16px;
      border-bottom: 1px solid #e0e0e0;
      background: #f8f9fa;
    }

    .participants-panel h4, .settings-panel h4 {
      margin: 0 0 12px 0;
      font-size: 14px;
      color: #333;
    }

    .participants-list {
      max-height: 120px;
      overflow-y: auto;
    }

    .participant-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 0;
    }

    .participant-avatar {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      overflow: hidden;
      background: #e9ecef;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      font-weight: 600;
    }

    .participant-avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .participant-info {
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    .participant-name {
      font-size: 12px;
      font-weight: 500;
      color: #333;
    }

    .participant-status {
      font-size: 10px;
      color: #666;
    }

    .participant-item.typing .participant-status {
      color: #007bff;
      font-style: italic;
    }

    .status-indicator {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #ccc;
    }

    .status-indicator.online {
      background: #28a745;
    }

    .settings-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .setting-item {
      display: flex;
      align-items: center;
    }

    .checkbox-label {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      font-size: 12px;
    }

    .messages-area {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 0;
      position: relative;
      overflow: hidden;
    }

    .messages-area.drag-active {
      border: 2px dashed #007bff;
      background: rgba(0, 123, 255, 0.05);
    }

    .no-messages {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      flex: 1;
      color: #666;
      text-align: center;
    }

    .no-messages .icon {
      font-size: 48px;
      margin-bottom: 16px;
      opacity: 0.5;
    }

    .messages-list {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      scroll-behavior: smooth;
    }

    .message-wrapper {
      margin-bottom: 16px;
    }

    .message-wrapper.own {
      display: flex;
      justify-content: flex-end;
    }

    .system-message {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 8px 16px;
      background: #e9ecef;
      border-radius: 16px;
      font-size: 12px;
      color: #666;
      margin: 8px 0;
    }

    .message-item {
      display: flex;
      gap: 8px;
      max-width: 70%;
    }

    .message-wrapper.own .message-item {
      flex-direction: row-reverse;
    }

    .message-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: #007bff;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 600;
      flex-shrink: 0;
    }

    .message-content {
      flex: 1;
      min-width: 0;
    }

    .message-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
    }

    .sender-name {
      font-size: 12px;
      font-weight: 600;
      color: #333;
    }

    .message-time {
      font-size: 10px;
      color: #666;
    }

    .message-body {
      background: #f8f9fa;
      border-radius: 12px;
      padding: 8px 12px;
      word-wrap: break-word;
    }

    .message-wrapper.own .message-body {
      background: #007bff;
      color: white;
    }

    .text-message {
      font-size: 14px;
      line-height: 1.4;
    }

    .file-message {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .file-info {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .file-icon {
      font-size: 20px;
    }

    .file-details {
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    .file-name {
      font-size: 12px;
      font-weight: 500;
    }

    .file-size {
      font-size: 10px;
      opacity: 0.8;
    }

    .download-btn {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 16px;
      padding: 4px;
      border-radius: 4px;
      transition: background 0.2s ease;
    }

    .download-btn:hover {
      background: rgba(255,255,255,0.2);
    }

    .file-progress {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .progress-bar {
      flex: 1;
      height: 4px;
      background: rgba(255,255,255,0.3);
      border-radius: 2px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      background: white;
      transition: width 0.3s ease;
    }

    .progress-text {
      font-size: 10px;
      opacity: 0.8;
    }

    .message-status {
      display: flex;
      justify-content: flex-end;
      margin-top: 4px;
    }

    .status-icon {
      font-size: 12px;
      opacity: 0.7;
    }

    .status-sending { color: #ffc107; }
    .status-sent { color: #28a745; }
    .status-delivered { color: #17a2b8; }
    .status-read { color: #007bff; }
    .status-failed { color: #dc3545; }

    .typing-indicators {
      padding: 8px 16px;
      border-top: 1px solid #e0e0e0;
      background: #f8f9fa;
    }

    .typing-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: #666;
    }

    .typing-animation {
      display: flex;
      gap: 2px;
    }

    .typing-animation .dot {
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: #666;
      animation: typing 1.4s ease-in-out infinite;
    }

    .typing-animation .dot:nth-child(2) {
      animation-delay: 0.2s;
    }

    .typing-animation .dot:nth-child(3) {
      animation-delay: 0.4s;
    }

    .drag-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 123, 255, 0.1);
      display: flex;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(2px);
    }

    .drag-content {
      text-align: center;
      color: #007bff;
    }

    .drag-icon {
      font-size: 48px;
      display: block;
      margin-bottom: 16px;
    }

    .input-area {
      border-top: 1px solid #e0e0e0;
      background: #ffffff;
    }

    .file-preview {
      padding: 8px 16px;
      background: #f8f9fa;
      border-bottom: 1px solid #e0e0e0;
      max-height: 100px;
      overflow-y: auto;
    }

    .file-preview-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 0;
      font-size: 12px;
    }

    .remove-file {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 12px;
      padding: 2px;
    }

    .message-input-container {
      display: flex;
      align-items: center;
      padding: 12px 16px;
      gap: 8px;
    }

    .input-btn {
      width: 36px;
      height: 36px;
      border: none;
      border-radius: 8px;
      background: #f8f9fa;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      font-size: 16px;
    }

    .input-btn:hover:not(:disabled) {
      background: #e9ecef;
    }

    .input-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .input-btn.active {
      background: #007bff;
      color: white;
    }

    .message-input {
      flex: 1;
      border: 1px solid #e0e0e0;
      border-radius: 20px;
      padding: 8px 16px;
      font-size: 14px;
      outline: none;
      resize: none;
    }

    .message-input:focus {
      border-color: #007bff;
      box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.2);
    }

    .send-btn {
      background: #007bff;
      color: white;
    }

    .send-btn:hover:not(:disabled) {
      background: #0056b3;
    }

    .emoji-picker {
      padding: 16px;
      border-top: 1px solid #e0e0e0;
      background: #f8f9fa;
      max-height: 200px;
      overflow-y: auto;
    }

    .emoji-grid {
      display: grid;
      grid-template-columns: repeat(8, 1fr);
      gap: 4px;
    }

    .emoji-btn {
      width: 32px;
      height: 32px;
      border: none;
      border-radius: 4px;
      background: transparent;
      cursor: pointer;
      font-size: 18px;
      transition: background 0.2s ease;
    }

    .emoji-btn:hover {
      background: #e9ecef;
    }

    .unread-badge {
      position: absolute;
      top: -8px;
      right: -8px;
      background: #dc3545;
      color: white;
      border-radius: 12px;
      padding: 4px 8px;
      font-size: 10px;
      font-weight: 600;
      min-width: 20px;
      text-align: center;
    }

    @keyframes typing {
      0%, 60%, 100% {
        transform: translateY(0);
      }
      30% {
        transform: translateY(-10px);
      }
    }

    @media (max-width: 768px) {
      .chat-container {
        height: 100vh;
        max-height: 100vh;
        border-radius: 0;
      }

      .message-item {
        max-width: 85%;
      }

      .participants-panel, .settings-panel {
        max-height: 150px;
        overflow-y: auto;
      }
    }
  `]
})
export class ChatComponent implements OnInit, OnDestroy {
  @ViewChild('messagesContainer') messagesContainer!: ElementRef;
  @ViewChild('fileInput') fileInput!: ElementRef;

  @Input() participants: ChatParticipant[] = [];
  @Input() disabled = false;
  @Input() compactMode = false;
  @Input() showSenderNames = true;
  @Input() currentUserId = '';
  @Input() currentUserName = '';

  @Input() settings: ChatSettings = {
    allowFiles: true,
    allowEmojis: true,
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedFileTypes: ['image/*', 'text/*', '.pdf', '.doc', '.docx'],
    showTypingIndicators: true,
    showReadReceipts: true,
    autoScroll: true,
    soundEnabled: true
  };

  @Output() messagesSend = new EventEmitter<ChatMessage>();
  @Output() fileShare = new EventEmitter<File[]>();
  @Output() settingsChange = new EventEmitter<ChatSettings>();
  @Output() chatClose = new EventEmitter<void>();
  @Output() userTyping = new EventEmitter<boolean>();

  // Signals for reactive state
  private _messages = signal<ChatMessage[]>([]);
  private _unreadCount = signal(0);

  // Component state
  isMinimized = false;
  showParticipants = false;
  showSettings = false;
  showEmojiPicker = false;
  currentMessage = '';
  selectedFiles: File[] = [];
  isDragActive = false;
  typingTimeout?: number;

  // Computed signals
  messages = computed(() => this._messages());
  unreadCount = computed(() => this._unreadCount());
  typingUsers = computed(() => 
    this.participants.filter(p => p.isTyping && p.id !== this.currentUserId)
  );

  // Common emojis
  commonEmojis = [
    '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂',
    '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩',
    '😘', '😗', '☺️', '😚', '😙', '🥲', '😋', '😛',
    '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔',
    '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄',
    '😬', '🤥', '😔', '😪', '🤤', '😴', '😷', '🤒'
  ];

  private subscriptions = new Subscription();

  ngOnInit(): void {
    // Auto-scroll to bottom on new messages
    this.subscriptions.add(
      // Would subscribe to message updates here
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }
  }

  /**
   * Add a new message to the chat
   */
  addMessage(message: ChatMessage): void {
    const currentMessages = this._messages();
    this._messages.set([...currentMessages, message]);
    
    if (!message.isOwn && this.isMinimized) {
      this._unreadCount.set(this._unreadCount() + 1);
    }

    if (this.settings.autoScroll) {
      setTimeout(() => this.scrollToBottom(), 100);
    }

    if (this.settings.soundEnabled && !message.isOwn) {
      this.playNotificationSound();
    }
  }

  /**
   * Toggle chat minimization
   */
  toggleMinimize(): void {
    this.isMinimized = !this.isMinimized;
    if (!this.isMinimized) {
      this._unreadCount.set(0);
      setTimeout(() => this.scrollToBottom(), 100);
    }
  }

  /**
   * Toggle participants panel
   */
  toggleParticipants(): void {
    this.showParticipants = !this.showParticipants;
    this.showSettings = false;
  }

  /**
   * Toggle settings panel
   */
  toggleSettings(): void {
    this.showSettings = !this.showSettings;
    this.showParticipants = false;
  }

  /**
   * Close chat
   */
  closeChat(): void {
    this.chatClose.emit();
  }

  /**
   * Send current message
   */
  sendMessage(): void {
    if (!this.canSendMessage()) return;

    const messageId = this.generateMessageId();
    const message: ChatMessage = {
      id: messageId,
      senderId: this.currentUserId,
      senderName: this.currentUserName,
      content: this.currentMessage.trim(),
      timestamp: new Date(),
      type: 'text',
      isOwn: true,
      status: 'sending'
    };

    this.addMessage(message);
    this.messagesSend.emit(message);
    this.currentMessage = '';

    // Send files if any
    if (this.selectedFiles.length > 0) {
      this.sendFiles();
    }
  }

  /**
   * Send selected files
   */
  sendFiles(): void {
    if (this.selectedFiles.length === 0) return;

    this.fileShare.emit([...this.selectedFiles]);
    
    // Create file messages
    this.selectedFiles.forEach(file => {
      const messageId = this.generateMessageId();
      const message: ChatMessage = {
        id: messageId,
        senderId: this.currentUserId,
        senderName: this.currentUserName,
        content: `Shared file: ${file.name}`,
        timestamp: new Date(),
        type: 'file',
        isOwn: true,
        status: 'sending',
        fileInfo: {
          name: file.name,
          size: file.size,
          type: file.type,
          progress: 0
        }
      };
      this.addMessage(message);
    });

    this.selectedFiles = [];
  }

  /**
   * Handle key down events
   */
  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  /**
   * Handle typing events
   */
  onTyping(): void {
    this.userTyping.emit(true);

    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }

    this.typingTimeout = setTimeout(() => {
      this.userTyping.emit(false);
    }, 3000);
  }

  /**
   * Handle file selection
   */
  onFileSelect(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target.files) {
      const files = Array.from(target.files);
      this.addFiles(files);
    }
  }

  /**
   * Handle drag over
   */
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragActive = true;
  }

  /**
   * Handle drag leave
   */
  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragActive = false;
  }

  /**
   * Handle file drop
   */
  onFileDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragActive = false;
    
    if (event.dataTransfer?.files) {
      const files = Array.from(event.dataTransfer.files);
      this.addFiles(files);
    }
  }

  /**
   * Add files to selection
   */
  addFiles(files: File[]): void {
    if (!this.settings.allowFiles) return;

    const validFiles = files.filter(file => {
      if (file.size > this.settings.maxFileSize) {
        console.warn(`File ${file.name} is too large`);
        return false;
      }
      return true;
    });

    this.selectedFiles = [...this.selectedFiles, ...validFiles];
  }

  /**
   * Remove file from selection
   */
  removeFile(index: number): void {
    this.selectedFiles.splice(index, 1);
  }

  /**
   * Toggle emoji picker
   */
  toggleEmojiPicker(): void {
    this.showEmojiPicker = !this.showEmojiPicker;
  }

  /**
   * Insert emoji into message
   */
  insertEmoji(emoji: string): void {
    this.currentMessage += emoji;
    this.showEmojiPicker = false;
  }

  /**
   * Download file
   */
  downloadFile(message: ChatMessage): void {
    if (message.fileInfo?.url) {
      const link = document.createElement('a');
      link.href = message.fileInfo.url;
      link.download = message.fileInfo.name;
      link.click();
    }
  }

  /**
   * Handle settings change
   */
  onSettingsChange(): void {
    this.settingsChange.emit({ ...this.settings });
  }

  /**
   * Check if message can be sent
   */
  canSendMessage(): boolean {
    return this.currentMessage.trim().length > 0 || this.selectedFiles.length > 0;
  }

  /**
   * Get input placeholder
   */
  getInputPlaceholder(): string {
    if (this.selectedFiles.length > 0) {
      return `${this.selectedFiles.length} file(s) selected. Add message...`;
    }
    return 'Type a message...';
  }

  /**
   * Format message content
   */
  formatMessage(content: string): string {
    // Basic formatting - would implement proper sanitization
    return content
      .replace(/\n/g, '<br>')
      .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>');
  }

  /**
   * Format file size
   */
  formatFileSize(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Format timestamp
   */
  formatTime(date: Date): string {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  /**
   * Get file icon
   */
  getFileIcon(mimeType: string): string {
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType.startsWith('video/')) return '🎥';
    if (mimeType.startsWith('audio/')) return '🎵';
    if (mimeType.includes('pdf')) return '📄';
    if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return '📊';
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '📈';
    return '📁';
  }

  /**
   * Get status icon
   */
  getStatusIcon(status: ChatMessage['status']): string {
    switch (status) {
      case 'sending': return '⏳';
      case 'sent': return '✓';
      case 'delivered': return '✓✓';
      case 'read': return '👁️';
      case 'failed': return '❌';
      default: return '';
    }
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
   * Track messages for ngFor
   */
  trackMessage(index: number, message: ChatMessage): string {
    return message.id;
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Scroll to bottom of messages
   */
  private scrollToBottom(): void {
    if (this.messagesContainer) {
      const element = this.messagesContainer.nativeElement;
      element.scrollTop = element.scrollHeight;
    }
  }

  /**
   * Play notification sound
   */
  private playNotificationSound(): void {
    // Simple notification sound
    const audio = new Audio();
    audio.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmRjJC8=';
    audio.volume = 0.3;
    audio.play().catch(() => {
      // Ignore errors if user hasn't interacted with page yet
    });
  }
}

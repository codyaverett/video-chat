import { IWebSocketClient } from '../core/interfaces/IWebSocketClient.js';
import { OutgoingMessage, IncomingMessage } from '../core/models/Message.js';

export class WebSocketClient implements IWebSocketClient {
  private socket: WebSocket | null = null;
  private messageHandlers: Set<(message: IncomingMessage) => void> = new Set();
  private connectionHandlers: Set<(connected: boolean) => void> = new Set();
  private reconnectTimeout: number | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  async connect(): Promise<void> {
    try {
      const response = await fetch('/config');
      const config = await response.json();
      
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsHost = window.location.hostname;
      const wsPort = config.wsPort;
      const wsUrl = `${wsProtocol}//${wsHost}:${wsPort}/ws`;
      
      console.log('Connecting to WebSocket:', wsUrl);
      this.socket = new WebSocket(wsUrl);
      
      this.setupEventHandlers();
      
      return new Promise((resolve, reject) => {
        if (!this.socket) {
          reject(new Error('Failed to create WebSocket'));
          return;
        }

        const onOpen = () => {
          console.log('WebSocket connected');
          this.reconnectAttempts = 0;
          this.notifyConnectionChange(true);
          this.socket?.removeEventListener('open', onOpen);
          this.socket?.removeEventListener('error', onError);
          resolve();
        };

        const onError = () => {
          console.error('WebSocket connection failed');
          this.socket?.removeEventListener('open', onOpen);
          this.socket?.removeEventListener('error', onError);
          reject(new Error('WebSocket connection failed'));
        };

        this.socket.addEventListener('open', onOpen);
        this.socket.addEventListener('error', onError);
      });
    } catch (error) {
      console.error('Failed to fetch config:', error);
      throw new Error('Failed to get server configuration');
    }
  }

  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  send(message: OutgoingMessage): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected, cannot send message:', message);
    }
  }

  isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  onMessage(callback: (message: IncomingMessage) => void): void {
    this.messageHandlers.add(callback);
  }

  onConnectionChange(callback: (connected: boolean) => void): void {
    this.connectionHandlers.add(callback);
  }

  private setupEventHandlers(): void {
    if (!this.socket) return;

    this.socket.onmessage = (event) => {
      try {
        const message: IncomingMessage = JSON.parse(event.data);
        this.notifyMessageHandlers(message);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    this.socket.onclose = () => {
      console.log('WebSocket disconnected');
      this.notifyConnectionChange(false);
      this.attemptReconnect();
    };

    this.socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.notifyConnectionChange(false);
    };
  }

  private notifyMessageHandlers(message: IncomingMessage): void {
    this.messageHandlers.forEach(handler => {
      try {
        handler(message);
      } catch (error) {
        console.error('Error in message handler:', error);
      }
    });
  }

  private notifyConnectionChange(connected: boolean): void {
    this.connectionHandlers.forEach(handler => {
      try {
        handler(connected);
      } catch (error) {
        console.error('Error in connection handler:', error);
      }
    });
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    this.reconnectTimeout = setTimeout(async () => {
      try {
        await this.connect();
      } catch (error) {
        console.error('Reconnection failed:', error);
      }
    }, delay);
  }
}
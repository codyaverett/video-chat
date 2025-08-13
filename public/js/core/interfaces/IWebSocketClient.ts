import { OutgoingMessage, IncomingMessage } from '../models/Message.js';

export interface IWebSocketClient {
  connect(): Promise<void>;
  disconnect(): void;
  send(message: OutgoingMessage): void;
  isConnected(): boolean;
  onMessage(callback: (message: IncomingMessage) => void): void;
  onConnectionChange(callback: (connected: boolean) => void): void;
}
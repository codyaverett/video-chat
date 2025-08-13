import { OutgoingMessage } from '../models/WebRTCMessage.ts';

export interface IBroadcastService {
  broadcastToAllUsers(message: OutgoingMessage): void;
  broadcastToUser(userId: string, message: OutgoingMessage): void;
  broadcastToRoom(roomId: string, message: OutgoingMessage, excludeUsers?: string[]): void;
  broadcastUserList(): void;
  broadcastMediaStates(): void;
  broadcastRoomList(): void;
}
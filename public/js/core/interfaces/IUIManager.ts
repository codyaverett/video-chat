import { User } from '../models/User.js';
import { Room, RoomInfo } from '../models/Room.js';

export interface IUIManager {
  initialize(): void;
  showError(message: string): void;
  hideError(): void;
  updateConnectionStatus(status: 'connected' | 'disconnected' | 'connecting', message: string): void;
  updateUserList(users: User[]): void;
  updateRoomList(rooms: RoomInfo[]): void;
  updateCurrentRoom(room: Room | null): void;
  showVideoContainer(): void;
  hideVideoContainer(): void;
  addRemoteVideo(userId: string, stream: MediaStream, userName: string): void;
  removeRemoteVideo(userId: string): void;
  updateRemoteVideoStatus(userId: string, audioEnabled: boolean, videoEnabled: boolean): void;
  setLocalUsername(name: string): void;
}
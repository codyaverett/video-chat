import { Room, RoomInfo, RoomDetails } from '../models/Room.ts';

export interface IRoomManager {
  createRoom(roomName: string, createdBy: string): Room;
  deleteRoom(roomId: string): boolean;
  getRoom(roomId: string): Room | undefined;
  getAllRooms(): Room[];
  getRoomsList(getUserName: (id: string) => string): RoomInfo[];
  joinRoom(roomId: string, userId: string): Room | null;
  leaveRoom(roomId: string, userId: string): boolean;
  getUserCurrentRoom(userId: string): Room | undefined;
  getRoomDetails(roomId: string, getUserName: (id: string) => string): RoomDetails | null;
  cleanupEmptyRooms(): void;
}
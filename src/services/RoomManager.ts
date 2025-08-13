import { IRoomManager } from '../core/interfaces/IRoomManager.ts';
import { Room, RoomModel, RoomInfo, RoomDetails } from '../core/models/Room.ts';

export class RoomManager implements IRoomManager {
  private rooms: Map<string, Room> = new Map();

  createRoom(roomName: string, createdBy: string): Room {
    const roomId = crypto.randomUUID();
    const room = new RoomModel(roomId, roomName, createdBy);
    this.rooms.set(roomId, room);
    
    console.log(`🏠 Room created: ${roomName} (${roomId}) by ${createdBy}`);
    return room;
  }

  deleteRoom(roomId: string): boolean {
    const room = this.rooms.get(roomId);
    if (room) {
      this.rooms.delete(roomId);
      console.log(`🗑️ Room deleted: ${room.name} (${roomId})`);
      return true;
    }
    return false;
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  getAllRooms(): Room[] {
    return Array.from(this.rooms.values());
  }

  getRoomsList(getUserName: (id: string) => string): RoomInfo[] {
    return Array.from(this.rooms.values()).map(room => 
      room instanceof RoomModel ? room.getRoomInfo(getUserName) : {
        id: room.id,
        name: room.name,
        participantCount: room.participants.size,
        participants: Array.from(room.participants).map(id => ({
          id,
          name: getUserName(id)
        })),
        createdAt: room.createdAt,
        createdBy: room.createdBy
      }
    );
  }

  joinRoom(roomId: string, userId: string): Room | null {
    const room = this.rooms.get(roomId);
    if (room) {
      if (room instanceof RoomModel) {
        room.addParticipant(userId);
      } else {
        room.participants.add(userId);
      }
      console.log(`🚪 User ${userId} joined room: ${room.name}`);
      return room;
    }
    return null;
  }

  leaveRoom(roomId: string, userId: string): boolean {
    const room = this.rooms.get(roomId);
    if (room) {
      if (room instanceof RoomModel) {
        room.removeParticipant(userId);
        if (room.isEmpty()) {
          this.deleteRoom(roomId);
          return true;
        }
      } else {
        room.participants.delete(userId);
        if (room.participants.size === 0) {
          this.deleteRoom(roomId);
          return true;
        }
      }
      console.log(`🚪 User ${userId} left room: ${room.name}`);
    }
    return false;
  }

  getUserCurrentRoom(userId: string): Room | undefined {
    for (const room of this.rooms.values()) {
      if (room instanceof RoomModel ? room.hasParticipant(userId) : room.participants.has(userId)) {
        return room;
      }
    }
    return undefined;
  }

  getRoomDetails(roomId: string, getUserName: (id: string) => string): RoomDetails | null {
    const room = this.rooms.get(roomId);
    if (room) {
      return room instanceof RoomModel ? room.getRoomDetails(getUserName) : {
        id: room.id,
        name: room.name,
        participants: Array.from(room.participants),
        participantDetails: Array.from(room.participants).map(id => ({
          id,
          name: getUserName(id)
        }))
      };
    }
    return null;
  }

  cleanupEmptyRooms(): void {
    const emptyRooms: string[] = [];
    
    for (const [roomId, room] of this.rooms.entries()) {
      const isEmpty = room instanceof RoomModel ? room.isEmpty() : room.participants.size === 0;
      if (isEmpty) {
        emptyRooms.push(roomId);
      }
    }
    
    emptyRooms.forEach(roomId => {
      this.deleteRoom(roomId);
    });
  }
}
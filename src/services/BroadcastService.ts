import { IBroadcastService } from '../core/interfaces/IBroadcastService.ts';
import { IUserManager } from '../core/interfaces/IUserManager.ts';
import { IRoomManager } from '../core/interfaces/IRoomManager.ts';
import { OutgoingMessage } from '../core/models/WebRTCMessage.ts';

export class BroadcastService implements IBroadcastService {
  constructor(
    private userManager: IUserManager,
    private roomManager: IRoomManager
  ) {}

  broadcastToAllUsers(message: OutgoingMessage): void {
    const users = this.userManager.getAllUsers();
    users.forEach(user => {
      if (this.userManager.isUserSocketOpen(user.id)) {
        try {
          user.socket.send(JSON.stringify(message));
        } catch (error) {
          console.error(`Failed to send message to user ${user.id}:`, error);
        }
      }
    });
  }

  broadcastToUser(userId: string, message: OutgoingMessage): void {
    const user = this.userManager.getUser(userId);
    if (user && this.userManager.isUserSocketOpen(userId)) {
      try {
        user.socket.send(JSON.stringify(message));
      } catch (error) {
        console.error(`Failed to send message to user ${userId}:`, error);
      }
    }
  }

  broadcastToRoom(roomId: string, message: OutgoingMessage, excludeUsers: string[] = []): void {
    const room = this.roomManager.getRoom(roomId);
    if (!room) return;

    room.participants.forEach(participantId => {
      if (excludeUsers.includes(participantId)) return;
      
      const user = this.userManager.getUser(participantId);
      if (user && this.userManager.isUserSocketOpen(participantId)) {
        try {
          user.socket.send(JSON.stringify(message));
        } catch (error) {
          console.error(`Failed to send message to user ${participantId} in room ${roomId}:`, error);
        }
      }
    });
  }

  broadcastUserList(): void {
    const userList = this.userManager.getUserPublicInfo();
    this.broadcastToAllUsers({
      type: "update-user-list",
      users: userList,
    });
  }

  broadcastMediaStates(): void {
    const mediaStates = this.userManager.getUserPublicInfo().map(user => ({
      id: user.id,
      audioEnabled: user.audioEnabled,
      videoEnabled: user.videoEnabled,
      videoFilter: user.videoFilter
    }));
    
    this.broadcastToAllUsers({
      type: "media-states-update",
      states: mediaStates,
    });
  }

  broadcastRoomList(): void {
    const roomList = this.roomManager.getRoomsList(
      (userId: string) => this.userManager.getUserName(userId)
    );
    
    this.broadcastToAllUsers({
      type: "room-list-update",
      rooms: roomList,
    });
  }
}
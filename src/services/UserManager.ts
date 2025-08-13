import { IUserManager } from '../core/interfaces/IUserManager.ts';
import { User, UserModel, UserPublicInfo, MediaState } from '../core/models/User.ts';
import { IRoomManager } from '../core/interfaces/IRoomManager.ts';

export class UserManager implements IUserManager {
  private users: Map<string, User> = new Map();
  private roomManager?: IRoomManager;

  constructor(roomManager?: IRoomManager) {
    this.roomManager = roomManager;
  }

  setRoomManager(roomManager: IRoomManager): void {
    this.roomManager = roomManager;
  }

  addUser(user: User): void {
    this.users.set(user.id, user);
    console.log(`✅ User added: ${user.id}`);
  }

  removeUser(userId: string): void {
    const user = this.users.get(userId);
    if (user) {
      this.leaveCurrentRoom(userId);
      this.users.delete(userId);
      console.log(`❌ User removed: ${userId}`);
    }
  }

  getUser(userId: string): User | undefined {
    return this.users.get(userId);
  }

  getAllUsers(): User[] {
    return Array.from(this.users.values());
  }

  getUserPublicInfo(): UserPublicInfo[] {
    return Array.from(this.users.values()).map(user => 
      user instanceof UserModel ? user.getPublicInfo() : {
        id: user.id,
        name: user.name,
        audioEnabled: user.audioEnabled,
        videoEnabled: user.videoEnabled,
        videoFilter: user.videoFilter
      }
    );
  }

  setUserDisplayName(userId: string, name: string): boolean {
    const user = this.users.get(userId);
    if (user) {
      user.name = name;
      console.log(`👤 User ${userId} set name: ${name}`);
      return true;
    }
    return false;
  }

  updateUserMediaState(userId: string, state: MediaState): boolean {
    const user = this.users.get(userId);
    if (user) {
      if (user instanceof UserModel) {
        user.updateMediaState(state);
      } else {
        if (state.audioEnabled !== undefined) user.audioEnabled = state.audioEnabled;
        if (state.videoEnabled !== undefined) user.videoEnabled = state.videoEnabled;
        if (state.videoFilter !== undefined) user.videoFilter = state.videoFilter;
      }
      
      console.log(`🎛️ User ${userId} media state: audio=${user.audioEnabled}, video=${user.videoEnabled}, filter=${user.videoFilter}`);
      return true;
    }
    return false;
  }

  getUsersExcept(excludeUserId: string): UserPublicInfo[] {
    return this.getUserPublicInfo().filter(user => user.id !== excludeUserId);
  }

  leaveCurrentRoom(userId: string): void {
    const user = this.users.get(userId);
    if (user && user.currentRoom && this.roomManager) {
      this.roomManager.leaveRoom(user.currentRoom, userId);
      user.currentRoom = undefined;
    }
  }

  getUserName(userId: string): string {
    const user = this.users.get(userId);
    return user?.name || 'Unknown';
  }

  isUserSocketOpen(userId: string): boolean {
    const user = this.users.get(userId);
    if (user) {
      return user instanceof UserModel ? user.isSocketOpen() : user.socket.readyState === WebSocket.OPEN;
    }
    return false;
  }
}
import { IUserManager } from '../core/interfaces/IUserManager.ts';
import { User, UserModel, UserPublicInfo, MediaState } from '../core/models/User.ts';
import { IRoomManager } from '../core/interfaces/IRoomManager.ts';
import { DatabaseService, UserRecord } from './DatabaseService.ts';

export class UserManager implements IUserManager {
  private users: Map<string, User> = new Map();
  private roomManager?: IRoomManager;
  private db: DatabaseService;

  constructor(roomManager?: IRoomManager, db?: DatabaseService) {
    this.roomManager = roomManager;
    this.db = db || new DatabaseService();
    
    // Run maintenance on startup
    this.db.runMaintenance();
    
    // Set up periodic cleanup
    setInterval(() => {
      this.cleanupInactiveUsers();
    }, 60000); // Run every minute
  }

  setRoomManager(roomManager: IRoomManager): void {
    this.roomManager = roomManager;
  }

  addUser(user: User): void {
    this.users.set(user.id, user);
    
    // Persist to database
    const userRecord: UserRecord = {
      id: user.id,
      name: user.name || 'Anonymous',
      currentRoom: user.currentRoom,
      lastSeen: Date.now(),
      isOnline: true
    };
    this.db.upsertUser(userRecord);
    
    console.log(`✅ User added: ${user.id}`);
  }

  removeUser(userId: string): void {
    const user = this.users.get(userId);
    if (user) {
      this.leaveCurrentRoom(userId);
      this.users.delete(userId);
      
      // Mark as offline in database
      this.db.setUserOffline(userId);
      
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
      
      // Update in database
      const userRecord: UserRecord = {
        id: user.id,
        name: name,
        currentRoom: user.currentRoom,
        lastSeen: Date.now(),
        isOnline: true
      };
      this.db.upsertUser(userRecord);
      
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
      const isOpen = user instanceof UserModel ? user.isSocketOpen() : user.socket.readyState === WebSocket.OPEN;
      
      // Update activity in database if socket is open
      if (isOpen) {
        this.db.updateUserActivity(userId);
      }
      
      return isOpen;
    }
    return false;
  }

  private cleanupInactiveUsers(): void {
    const inactiveUserIds = this.db.cleanupInactiveUsers();
    
    // Remove from memory if they're not connected
    inactiveUserIds.forEach(userId => {
      const user = this.users.get(userId);
      if (user && !this.isUserSocketOpen(userId)) {
        this.users.delete(userId);
        console.log(`🧹 Removed inactive user from memory: ${userId}`);
      }
    });
  }

  getOnlineUsers(): UserPublicInfo[] {
    const dbUsers = this.db.getAllOnlineUsers();
    return dbUsers
      .filter(dbUser => {
        // Only return users that are actually connected
        const memoryUser = this.users.get(dbUser.id);
        return memoryUser && this.isUserSocketOpen(dbUser.id);
      })
      .map(dbUser => {
        const memoryUser = this.users.get(dbUser.id)!;
        return memoryUser instanceof UserModel ? memoryUser.getPublicInfo() : {
          id: memoryUser.id,
          name: memoryUser.name,
          audioEnabled: memoryUser.audioEnabled,
          videoEnabled: memoryUser.videoEnabled,
          videoFilter: memoryUser.videoFilter,
          currentRoom: dbUser.currentRoom
        };
      });
  }
}
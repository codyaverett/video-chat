import { Database } from '@db/sqlite';

export interface UserRecord {
  id: string;
  name: string;
  currentRoom?: string;
  lastSeen: number;
  isOnline: boolean;
}

export interface RoomRecord {
  id: string;
  name: string;
  createdBy: string;
  createdAt: number;
  lastActivity: number;
}

export interface RoomParticipant {
  roomId: string;
  userId: string;
  joinedAt: number;
}

export class DatabaseService {
  private db: Database;

  constructor(dbPath: string = './video-chat.db') {
    this.db = new Database(dbPath);
    this.initializeTables();
  }

  private initializeTables(): void {
    // Users table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        currentRoom TEXT,
        lastSeen INTEGER NOT NULL,
        isOnline BOOLEAN DEFAULT 1,
        FOREIGN KEY (currentRoom) REFERENCES rooms (id) ON DELETE SET NULL
      )
    `);

    // Rooms table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS rooms (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        createdBy TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        lastActivity INTEGER NOT NULL,
        FOREIGN KEY (createdBy) REFERENCES users (id) ON DELETE CASCADE
      )
    `);

    // Room participants table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS room_participants (
        roomId TEXT NOT NULL,
        userId TEXT NOT NULL,
        joinedAt INTEGER NOT NULL,
        PRIMARY KEY (roomId, userId),
        FOREIGN KEY (roomId) REFERENCES rooms (id) ON DELETE CASCADE,
        FOREIGN KEY (userId) REFERENCES users (id) ON DELETE CASCADE
      )
    `);

    // Indexes for better performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_users_online ON users (isOnline);
      CREATE INDEX IF NOT EXISTS idx_users_last_seen ON users (lastSeen);
      CREATE INDEX IF NOT EXISTS idx_rooms_last_activity ON rooms (lastActivity);
      CREATE INDEX IF NOT EXISTS idx_room_participants_room ON room_participants (roomId);
      CREATE INDEX IF NOT EXISTS idx_room_participants_user ON room_participants (userId);
    `);

    console.log('✅ Database initialized with tables and indexes');
  }

  // User operations
  upsertUser(user: UserRecord): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO users (id, name, currentRoom, lastSeen, isOnline)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(
      user.id, 
      user.name, 
      user.currentRoom || null, // Convert undefined to null
      user.lastSeen, 
      user.isOnline ? 1 : 0
    );
  }

  getUserById(id: string): UserRecord | null {
    const stmt = this.db.prepare('SELECT * FROM users WHERE id = ?');
    const row = stmt.get(id);
    return row ? this.mapUserRecord(row) : null;
  }

  getAllOnlineUsers(): UserRecord[] {
    const stmt = this.db.prepare('SELECT * FROM users WHERE isOnline = 1 ORDER BY name');
    const rows = stmt.all();
    return rows.map(row => this.mapUserRecord(row));
  }

  setUserOffline(userId: string): void {
    const stmt = this.db.prepare('UPDATE users SET isOnline = 0, lastSeen = ? WHERE id = ?');
    stmt.run(Date.now(), userId);
  }

  updateUserActivity(userId: string): void {
    const stmt = this.db.prepare('UPDATE users SET lastSeen = ? WHERE id = ?');
    stmt.run(Date.now(), userId);
  }

  cleanupInactiveUsers(timeoutMs: number = 5 * 60 * 1000): string[] {
    const cutoff = Date.now() - timeoutMs;
    const stmt = this.db.prepare('SELECT id FROM users WHERE isOnline = 1 AND lastSeen < ?');
    const inactiveUsers = stmt.all().map(row => row.id as string);
    
    if (inactiveUsers.length > 0) {
      const updateStmt = this.db.prepare('UPDATE users SET isOnline = 0 WHERE id = ?');
      inactiveUsers.forEach(userId => updateStmt.run(userId));
      console.log(`🧹 Marked ${inactiveUsers.length} inactive users as offline`);
    }
    
    return inactiveUsers;
  }

  // Room operations
  createRoom(room: RoomRecord): void {
    const stmt = this.db.prepare(`
      INSERT INTO rooms (id, name, createdBy, createdAt, lastActivity)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(room.id, room.name, room.createdBy, room.createdAt, room.lastActivity);
  }

  getRoomById(id: string): RoomRecord | null {
    const stmt = this.db.prepare('SELECT * FROM rooms WHERE id = ?');
    const row = stmt.get(id);
    return row ? this.mapRoomRecord(row) : null;
  }

  getAllActiveRooms(): RoomRecord[] {
    const stmt = this.db.prepare('SELECT * FROM rooms ORDER BY lastActivity DESC');
    const rows = stmt.all();
    return rows.map(row => this.mapRoomRecord(row));
  }

  updateRoomActivity(roomId: string): void {
    const stmt = this.db.prepare('UPDATE rooms SET lastActivity = ? WHERE id = ?');
    stmt.run(Date.now(), roomId);
  }

  deleteRoom(roomId: string): void {
    const stmt = this.db.prepare('DELETE FROM rooms WHERE id = ?');
    stmt.run(roomId);
  }

  cleanupInactiveRooms(timeoutMs: number = 10 * 60 * 1000): string[] {
    const cutoff = Date.now() - timeoutMs;
    const stmt = this.db.prepare('SELECT id FROM rooms WHERE lastActivity < ?');
    const inactiveRooms = stmt.all().map(row => row.id as string);
    
    if (inactiveRooms.length > 0) {
      const deleteStmt = this.db.prepare('DELETE FROM rooms WHERE id = ?');
      inactiveRooms.forEach(roomId => deleteStmt.run(roomId));
      console.log(`🧹 Cleaned up ${inactiveRooms.length} inactive rooms`);
    }
    
    return inactiveRooms;
  }

  // Room participant operations
  addParticipant(roomId: string, userId: string): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO room_participants (roomId, userId, joinedAt)
      VALUES (?, ?, ?)
    `);
    stmt.run(roomId, userId, Date.now());
    
    // Update user's current room
    const updateUserStmt = this.db.prepare('UPDATE users SET currentRoom = ? WHERE id = ?');
    updateUserStmt.run(roomId, userId);
    
    // Update room activity
    this.updateRoomActivity(roomId);
  }

  removeParticipant(roomId: string, userId: string): void {
    const stmt = this.db.prepare('DELETE FROM room_participants WHERE roomId = ? AND userId = ?');
    stmt.run(roomId, userId);
    
    // Clear user's current room
    const updateUserStmt = this.db.prepare('UPDATE users SET currentRoom = NULL WHERE id = ? AND currentRoom = ?');
    updateUserStmt.run(userId, roomId);
    
    // Update room activity
    this.updateRoomActivity(roomId);
  }

  getRoomParticipants(roomId: string): string[] {
    const stmt = this.db.prepare(`
      SELECT userId FROM room_participants 
      WHERE roomId = ? 
      ORDER BY joinedAt
    `);
    const rows = stmt.all();
    return rows.map(row => row.userId as string);
  }

  getUsersInRoom(roomId: string): UserRecord[] {
    const stmt = this.db.prepare(`
      SELECT u.* FROM users u
      INNER JOIN room_participants rp ON u.id = rp.userId
      WHERE rp.roomId = ? AND u.isOnline = 1
      ORDER BY rp.joinedAt
    `);
    const rows = stmt.all();
    return rows.map(row => this.mapUserRecord(row));
  }

  // Helper methods
  private mapUserRecord(row: any): UserRecord {
    return {
      id: row.id,
      name: row.name,
      currentRoom: row.currentRoom || undefined,
      lastSeen: row.lastSeen,
      isOnline: Boolean(row.isOnline)
    };
  }

  private mapRoomRecord(row: any): RoomRecord {
    return {
      id: row.id,
      name: row.name,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      lastActivity: row.lastActivity
    };
  }

  // Maintenance operations
  runMaintenance(clearAnonymous: boolean = false): void {
    console.log('🔧 Running database maintenance...');
    const inactiveUsers = this.cleanupInactiveUsers();
    const inactiveRooms = this.cleanupInactiveRooms();
    
    let clearedAnonymous = 0;
    if (clearAnonymous) {
      clearedAnonymous = this.clearAnonymousUsers();
    }
    
    if (inactiveUsers.length > 0 || inactiveRooms.length > 0 || clearedAnonymous > 0) {
      console.log(`🧹 Maintenance complete: ${inactiveUsers.length} users offline, ${inactiveRooms.length} rooms removed, ${clearedAnonymous} anonymous users cleared`);
    } else {
      console.log('🧹 Maintenance complete: no cleanup needed');
    }
  }

  close(): void {
    this.db.close();
  }

  // Cleanup operations
  clearAnonymousUsers(): number {
    console.log('🧹 Clearing anonymous users from database...');
    
    // First, get anonymous users to clean up any room associations
    const stmt = this.db.prepare(`
      SELECT id FROM users 
      WHERE name = 'Anonymous' 
         OR name = '' 
         OR name IS NULL
         OR name LIKE 'Anonymous%'
    `);
    const anonymousUsers = stmt.all().map(row => row.id as string);
    
    if (anonymousUsers.length === 0) {
      console.log('🧹 No anonymous users found');
      return 0;
    }
    
    // Remove them from any rooms they might be in
    const removeParticipantsStmt = this.db.prepare(`
      DELETE FROM room_participants 
      WHERE userId IN (${anonymousUsers.map(() => '?').join(',')})
    `);
    removeParticipantsStmt.run(...anonymousUsers);
    
    // Delete the anonymous users
    const deleteUsersStmt = this.db.prepare(`
      DELETE FROM users 
      WHERE name = 'Anonymous' 
         OR name = '' 
         OR name IS NULL
         OR name LIKE 'Anonymous%'
    `);
    const result = deleteUsersStmt.run();
    
    console.log(`🧹 Cleared ${result.changes} anonymous users from database`);
    return result.changes as number;
  }

  // Statistics
  getStats(): { users: number; onlineUsers: number; rooms: number; totalParticipants: number } {
    const userStats = this.db.prepare('SELECT COUNT(*) as total, SUM(isOnline) as online FROM users').get();
    const roomStats = this.db.prepare('SELECT COUNT(*) as total FROM rooms').get();
    const participantStats = this.db.prepare('SELECT COUNT(*) as total FROM room_participants').get();
    
    return {
      users: userStats.total,
      onlineUsers: userStats.online || 0,
      rooms: roomStats.total,
      totalParticipants: participantStats.total
    };
  }
}
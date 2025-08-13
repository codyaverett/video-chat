import { User, UserPublicInfo, MediaState } from '../models/User.ts';

export interface IUserManager {
  addUser(user: User): void;
  removeUser(userId: string): void;
  getUser(userId: string): User | undefined;
  getAllUsers(): User[];
  getUserPublicInfo(): UserPublicInfo[];
  setUserDisplayName(userId: string, name: string): boolean;
  updateUserMediaState(userId: string, state: MediaState): boolean;
  getUsersExcept(excludeUserId: string): UserPublicInfo[];
  leaveCurrentRoom(userId: string): void;
  getUserName(userId: string): string;
  isUserSocketOpen(userId: string): boolean;
}
export interface Room {
  id: string;
  name: string;
  participants: Set<string>;
  createdAt: Date;
  createdBy: string;
}

export interface RoomInfo {
  id: string;
  name: string;
  participantCount: number;
  participants: Array<{
    id: string;
    name: string;
  }>;
  createdAt: Date;
  createdBy: string;
}

export interface RoomDetails {
  id: string;
  name: string;
  participants: string[];
  participantDetails: Array<{
    id: string;
    name: string;
  }>;
}

export class RoomModel implements Room {
  public participants: Set<string>;

  constructor(
    public id: string,
    public name: string,
    public createdBy: string,
    public createdAt: Date = new Date()
  ) {
    this.participants = new Set([createdBy]);
  }

  addParticipant(userId: string): void {
    this.participants.add(userId);
  }

  removeParticipant(userId: string): void {
    this.participants.delete(userId);
  }

  hasParticipant(userId: string): boolean {
    return this.participants.has(userId);
  }

  isEmpty(): boolean {
    return this.participants.size === 0;
  }

  getParticipantCount(): number {
    return this.participants.size;
  }

  getParticipantIds(): string[] {
    return Array.from(this.participants);
  }

  getRoomInfo(getUserName: (id: string) => string): RoomInfo {
    return {
      id: this.id,
      name: this.name,
      participantCount: this.participants.size,
      participants: Array.from(this.participants).map(id => ({
        id,
        name: getUserName(id)
      })),
      createdAt: this.createdAt,
      createdBy: this.createdBy
    };
  }

  getRoomDetails(getUserName: (id: string) => string): RoomDetails {
    return {
      id: this.id,
      name: this.name,
      participants: Array.from(this.participants),
      participantDetails: Array.from(this.participants).map(id => ({
        id,
        name: getUserName(id)
      }))
    };
  }
}
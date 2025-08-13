export interface Room {
  id: string;
  name: string;
  participants: string[];
  participantDetails: Array<{
    id: string;
    name: string;
  }>;
}

export interface RoomInfo {
  id: string;
  name: string;
  participantCount: number;
  participants: Array<{
    id: string;
    name: string;
  }>;
  createdAt: string;
  createdBy: string;
}

export class RoomModel implements Room {
  constructor(
    public id: string,
    public name: string,
    public participants: string[] = [],
    public participantDetails: Array<{ id: string; name: string }> = []
  ) {}

  hasParticipant(userId: string): boolean {
    return this.participants.includes(userId);
  }

  getParticipantCount(): number {
    return this.participants.length;
  }

  getParticipantName(userId: string): string {
    const participant = this.participantDetails.find(p => p.id === userId);
    return participant?.name || 'Unknown';
  }
}
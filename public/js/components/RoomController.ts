import { Room } from '../core/models/Room.js';
import { User } from '../core/models/User.js';
import { Message } from '../core/models/Message.js';
import { IWebSocketClient } from '../core/interfaces/IWebSocketClient.js';
import { IUIManager } from '../core/interfaces/IUIManager.js';

export class RoomController {
    private currentRoom: Room | null = null;
    private isHost: boolean = false;
    private participants: Map<string, User> = new Map();

    constructor(
        private webSocketClient: IWebSocketClient,
        private uiManager: IUIManager
    ) {
        this.setupEventListeners();
    }

    private setupEventListeners(): void {
        this.webSocketClient.on('room-joined', (data: any) => {
            this.handleRoomJoined(data);
        });

        this.webSocketClient.on('user-joined', (data: any) => {
            this.handleUserJoined(data);
        });

        this.webSocketClient.on('user-left', (data: any) => {
            this.handleUserLeft(data);
        });

        this.webSocketClient.on('room-closed', () => {
            this.handleRoomClosed();
        });

        this.webSocketClient.on('participant-list', (data: any) => {
            this.handleParticipantList(data);
        });
    }

    public createRoom(roomName: string, userName: string): void {
        this.isHost = true;
        const message: Message = {
            type: 'create-room',
            payload: { roomName, userName }
        };
        this.webSocketClient.send(message);
        this.uiManager.showStatus('Creating room...');
    }

    public joinRoom(roomId: string, userName: string): void {
        this.isHost = false;
        const message: Message = {
            type: 'join-room',
            payload: { roomId, userName }
        };
        this.webSocketClient.send(message);
        this.uiManager.showStatus('Joining room...');
    }

    public leaveRoom(): void {
        if (!this.currentRoom) return;

        const message: Message = {
            type: 'leave-room',
            payload: { roomId: this.currentRoom.id }
        };
        this.webSocketClient.send(message);
        this.handleRoomLeft();
    }

    public closeRoom(): void {
        if (!this.currentRoom || !this.isHost) return;

        const message: Message = {
            type: 'close-room',
            payload: { roomId: this.currentRoom.id }
        };
        this.webSocketClient.send(message);
    }

    public getCurrentRoom(): Room | null {
        return this.currentRoom;
    }

    public getParticipants(): User[] {
        return Array.from(this.participants.values());
    }

    public isCurrentUserHost(): boolean {
        return this.isHost;
    }

    public getParticipantCount(): number {
        return this.participants.size;
    }

    private handleRoomJoined(data: any): void {
        this.currentRoom = new Room(data.roomId, data.roomName, data.hostId);
        this.uiManager.showStatus(`Joined room: ${data.roomName}`);
        this.uiManager.updateRoomInfo(this.currentRoom);
        this.uiManager.showRoomControls(this.isHost);
    }

    private handleUserJoined(data: any): void {
        const user = new User(data.userId, data.userName);
        this.participants.set(data.userId, user);
        this.uiManager.addParticipant(user);
        this.uiManager.showStatus(`${data.userName} joined the room`);
        this.updateParticipantCount();
    }

    private handleUserLeft(data: any): void {
        const user = this.participants.get(data.userId);
        if (user) {
            this.participants.delete(data.userId);
            this.uiManager.removeParticipant(user);
            this.uiManager.showStatus(`${user.name} left the room`);
            this.updateParticipantCount();
        }
    }

    private handleRoomClosed(): void {
        this.uiManager.showStatus('Room has been closed by the host');
        this.handleRoomLeft();
    }

    private handleParticipantList(data: any): void {
        this.participants.clear();
        data.participants.forEach((participant: any) => {
            const user = new User(participant.userId, participant.userName);
            this.participants.set(participant.userId, user);
        });
        this.uiManager.updateParticipantList(this.getParticipants());
        this.updateParticipantCount();
    }

    private handleRoomLeft(): void {
        this.currentRoom = null;
        this.isHost = false;
        this.participants.clear();
        this.uiManager.hideRoomControls();
        this.uiManager.clearParticipantList();
        this.uiManager.showStatus('Left the room');
    }

    private updateParticipantCount(): void {
        if (this.currentRoom) {
            this.uiManager.updateParticipantCount(this.participants.size);
        }
    }

    public sendRoomMessage(message: string): void {
        if (!this.currentRoom) return;

        const msg: Message = {
            type: 'room-message',
            payload: {
                roomId: this.currentRoom.id,
                message: message
            }
        };
        this.webSocketClient.send(msg);
    }

    public requestParticipantList(): void {
        if (!this.currentRoom) return;

        const message: Message = {
            type: 'get-participants',
            payload: { roomId: this.currentRoom.id }
        };
        this.webSocketClient.send(message);
    }
}
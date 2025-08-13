import { WebSocketClient } from './services/WebSocketClient.js';
import { WebRTCManager } from './services/WebRTCManager.js';
import { UIManager } from './components/UIManager.js';
import { MediaController } from './components/MediaController.js';
import { RoomController } from './components/RoomController.js';
import { Message } from './core/models/Message.js';
import { User } from './core/models/User.js';

export class VideoCallManager {
    private webSocketClient: WebSocketClient;
    private webRTCManager: WebRTCManager;
    private uiManager: UIManager;
    private mediaController: MediaController;
    private roomController: RoomController;
    private currentUser: User | null = null;
    private isInitialized: boolean = false;

    constructor() {
        this.initializeServices();
        this.setupEventListeners();
    }

    private initializeServices(): void {
        this.webSocketClient = new WebSocketClient();
        this.webRTCManager = new WebRTCManager();
        this.uiManager = new UIManager();
        this.mediaController = new MediaController(this.webRTCManager, this.uiManager);
        this.roomController = new RoomController(this.webSocketClient, this.uiManager);
    }

    private setupEventListeners(): void {
        this.setupWebSocketEvents();
        this.setupWebRTCEvents();
        this.setupUIEvents();
        this.setupMediaEvents();
    }

    private setupWebSocketEvents(): void {
        this.webSocketClient.on('connected', () => {
            this.uiManager.showStatus('Connected to server');
            this.isInitialized = true;
        });

        this.webSocketClient.on('disconnected', () => {
            this.uiManager.showStatus('Disconnected from server');
            this.handleDisconnection();
        });

        this.webSocketClient.on('error', (error: string) => {
            this.uiManager.showError(`Connection error: ${error}`);
        });

        this.webSocketClient.on('webrtc-offer', (data: any) => {
            this.handleWebRTCOffer(data);
        });

        this.webSocketClient.on('webrtc-answer', (data: any) => {
            this.handleWebRTCAnswer(data);
        });

        this.webSocketClient.on('webrtc-ice-candidate', (data: any) => {
            this.handleICECandidate(data);
        });

        this.webSocketClient.on('room-message', (data: any) => {
            this.uiManager.addChatMessage(data.userName, data.message);
        });
    }

    private setupWebRTCEvents(): void {
        this.webRTCManager.on('ice-candidate', (candidate: RTCIceCandidate) => {
            this.sendICECandidate(candidate);
        });

        this.webRTCManager.on('remote-stream', (stream: MediaStream) => {
            this.uiManager.setRemoteVideo(stream);
        });

        this.webRTCManager.on('connection-state-change', (state: string) => {
            this.uiManager.updateConnectionStatus(state);
        });

        this.webRTCManager.on('data-channel-message', (message: string) => {
            this.handleDataChannelMessage(message);
        });
    }

    private setupUIEvents(): void {
        this.uiManager.on('create-room-requested', (data: { roomName: string, userName: string }) => {
            this.handleCreateRoom(data.roomName, data.userName);
        });

        this.uiManager.on('join-room-requested', (data: { roomId: string, userName: string }) => {
            this.handleJoinRoom(data.roomId, data.userName);
        });

        this.uiManager.on('leave-room-requested', () => {
            this.handleLeaveRoom();
        });

        this.uiManager.on('start-call-requested', () => {
            this.handleStartCall();
        });

        this.uiManager.on('end-call-requested', () => {
            this.handleEndCall();
        });

        this.uiManager.on('chat-message-sent', (message: string) => {
            this.handleSendChatMessage(message);
        });
    }

    private setupMediaEvents(): void {
        this.mediaController.on('local-stream-ready', (stream: MediaStream) => {
            this.uiManager.setLocalVideo(stream);
        });

        this.mediaController.on('media-error', (error: string) => {
            this.uiManager.showError(`Media error: ${error}`);
        });

        this.mediaController.on('media-state-changed', (state: any) => {
            this.uiManager.updateMediaControls(state);
        });
    }

    public async initialize(): Promise<void> {
        try {
            await this.connectToServer();
            await this.mediaController.initializeMedia();
            this.uiManager.initialize();
            this.uiManager.showStatus('Application initialized successfully');
        } catch (error) {
            this.uiManager.showError(`Initialization failed: ${error}`);
        }
    }

    private async connectToServer(): Promise<void> {
        const wsUrl = this.getWebSocketUrl();
        await this.webSocketClient.connect(wsUrl);
    }

    private getWebSocketUrl(): string {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        return `${protocol}//${host}/ws`;
    }

    private handleCreateRoom(roomName: string, userName: string): void {
        this.currentUser = new User('', userName);
        this.roomController.createRoom(roomName, userName);
    }

    private handleJoinRoom(roomId: string, userName: string): void {
        this.currentUser = new User('', userName);
        this.roomController.joinRoom(roomId, userName);
    }

    private handleLeaveRoom(): void {
        this.roomController.leaveRoom();
        this.webRTCManager.close();
        this.currentUser = null;
    }

    private async handleStartCall(): Promise<void> {
        try {
            const participants = this.roomController.getParticipants();
            if (participants.length === 0) {
                this.uiManager.showError('No participants in the room');
                return;
            }

            await this.webRTCManager.createOffer();
            this.uiManager.showStatus('Starting call...');
        } catch (error) {
            this.uiManager.showError(`Failed to start call: ${error}`);
        }
    }

    private handleEndCall(): void {
        this.webRTCManager.close();
        this.uiManager.showStatus('Call ended');
    }

    private handleSendChatMessage(message: string): void {
        if (this.currentUser) {
            this.roomController.sendRoomMessage(message);
            this.uiManager.addChatMessage(this.currentUser.name, message);
        }
    }

    private async handleWebRTCOffer(data: any): Promise<void> {
        try {
            await this.webRTCManager.handleOffer(data.offer);
            const answer = await this.webRTCManager.createAnswer();
            
            const message: Message = {
                type: 'webrtc-answer',
                payload: {
                    answer: answer,
                    targetUserId: data.fromUserId,
                    roomId: this.roomController.getCurrentRoom()?.id
                }
            };
            this.webSocketClient.send(message);
        } catch (error) {
            this.uiManager.showError(`Failed to handle offer: ${error}`);
        }
    }

    private async handleWebRTCAnswer(data: any): Promise<void> {
        try {
            await this.webRTCManager.handleAnswer(data.answer);
        } catch (error) {
            this.uiManager.showError(`Failed to handle answer: ${error}`);
        }
    }

    private async handleICECandidate(data: any): Promise<void> {
        try {
            await this.webRTCManager.addICECandidate(data.candidate);
        } catch (error) {
            this.uiManager.showError(`Failed to add ICE candidate: ${error}`);
        }
    }

    private sendICECandidate(candidate: RTCIceCandidate): void {
        const message: Message = {
            type: 'webrtc-ice-candidate',
            payload: {
                candidate: candidate,
                roomId: this.roomController.getCurrentRoom()?.id
            }
        };
        this.webSocketClient.send(message);
    }

    private handleDataChannelMessage(message: string): void {
        try {
            const data = JSON.parse(message);
            this.uiManager.handleDataChannelMessage(data);
        } catch (error) {
            console.error('Failed to parse data channel message:', error);
        }
    }

    private handleDisconnection(): void {
        this.isInitialized = false;
        this.webRTCManager.close();
        this.roomController.leaveRoom();
        this.currentUser = null;
    }

    public getCurrentUser(): User | null {
        return this.currentUser;
    }

    public getCurrentRoom() {
        return this.roomController.getCurrentRoom();
    }

    public isReady(): boolean {
        return this.isInitialized;
    }

    public async reconnect(): Promise<void> {
        if (!this.isInitialized) {
            await this.initialize();
        }
    }

    public destroy(): void {
        this.webSocketClient.disconnect();
        this.webRTCManager.close();
        this.mediaController.cleanup();
        this.uiManager.cleanup();
    }
}

declare global {
    interface Window {
        videoCallManager: VideoCallManager;
    }
}

window.videoCallManager = new VideoCallManager();
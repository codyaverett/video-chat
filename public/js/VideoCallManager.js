import { WebSocketClient } from './services/WebSocketClient.js';
import { WebRTCManager } from './services/WebRTCManager.js';
import { UIManager } from './components/UIManager.js';
import { MediaController } from './components/MediaController.js';
import { RoomController } from './components/RoomController.js';
import { User } from './core/models/User.js';

export class VideoCallManager {
    constructor() {
        this.webSocketClient = null;
        this.webRTCManager = null;
        this.uiManager = null;
        this.mediaController = null;
        this.roomController = null;
        this.currentUser = null;
        this.isInitialized = false;
        
        this.initializeServices();
        this.setupEventListeners();
    }

    initializeServices() {
        this.webSocketClient = new WebSocketClient();
        this.webRTCManager = new WebRTCManager(this.webSocketClient);
        this.uiManager = new UIManager();
        this.mediaController = new MediaController(this.webRTCManager, this.webSocketClient, this.uiManager);
        this.roomController = new RoomController(this.webSocketClient, this.uiManager);
    }

    setupEventListeners() {
        this.setupWebSocketEvents();
        this.setupMediaEvents();
    }

    setupWebSocketEvents() {
        this.webSocketClient.on('connected', () => {
            this.uiManager.showStatus('Connected to server');
            this.isInitialized = true;
        });

        this.webSocketClient.on('disconnected', () => {
            this.uiManager.showStatus('Disconnected from server');
            this.handleDisconnection();
        });

        this.webSocketClient.on('error', (error) => {
            this.uiManager.showError(`Connection error: ${error}`);
        });

        this.webSocketClient.on('room-list-update', (data) => {
            console.log('Room list updated:', data);
            this.uiManager.updateRoomList(data.rooms || []);
        });

        this.webSocketClient.on('update-user-list', (data) => {
            console.log('User list updated:', data);
            this.uiManager.updateUserList(data.users || []);
        });
    }

    setupMediaEvents() {
        this.mediaController.on('local-stream-ready', (stream) => {
            this.uiManager.setLocalVideo(stream);
        });

        this.mediaController.on('media-error', (error) => {
            this.uiManager.showError(`Media error: ${error}`);
        });

        // Handle WebRTC call events
        this.webRTCManager.on('call-initiated', (data) => {
            this.uiManager.showStatus(`Calling ${data.userName}...`);
        });

        this.webRTCManager.on('call-received', (data) => {
            this.uiManager.showStatus(`Incoming call from ${data.userName}`);
            // Auto-accept for now - could add UI for accept/reject
            console.log(`📞 Incoming call from ${data.userName}`);
        });

        this.webRTCManager.on('call-connected', (data) => {
            this.uiManager.showStatus(`Connected to ${data.userName}`);
        });

        this.webRTCManager.on('call-ended', () => {
            this.uiManager.showStatus('Call ended');
        });

        this.webRTCManager.on('call-error', (data) => {
            this.uiManager.showError(`Call error: ${data.error}`);
        });

        this.webRTCManager.on('remote-stream', (stream) => {
            this.uiManager.setRemoteVideo(stream);
        });
    }

    async initialize() {
        try {
            await this.connectToServer();
            await this.mediaController.initializeMedia();
            this.uiManager.initialize();
            this.uiManager.showStatus('Application initialized successfully');
        } catch (error) {
            this.uiManager.showError(`Initialization failed: ${error}`);
        }
    }

    async connectToServer() {
        await this.webSocketClient.connect();
    }

    handleDisconnection() {
        this.isInitialized = false;
        this.webRTCManager.close();
        this.roomController.leaveRoom();
        this.currentUser = null;
    }

    getCurrentUser() {
        return this.currentUser;
    }

    getCurrentRoom() {
        return this.roomController.getCurrentRoom();
    }

    isReady() {
        return this.isInitialized;
    }

    async reconnect() {
        if (!this.isInitialized) {
            await this.initialize();
        }
    }

    destroy() {
        this.webSocketClient.disconnect();
        this.webRTCManager.close();
        this.mediaController.cleanup();
        this.uiManager.cleanup();
    }
}

window.videoCallManager = new VideoCallManager();
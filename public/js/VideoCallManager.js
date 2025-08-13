import { WebSocketClient } from './services/WebSocketClient.js';
import { WebRTCManager } from './services/WebRTCManager.js';
import { GroupCallManager } from './services/GroupCallManager.js';
import { UIManager } from './components/UIManager.js';
import { MediaController } from './components/MediaController.js';
import { RoomController } from './components/RoomController.js';
import { User } from './core/models/User.js';

export class VideoCallManager {
    constructor() {
        this.webSocketClient = null;
        this.webRTCManager = null;
        this.groupCallManager = null;
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
        
        this.webSocketClient.on('call-state-update', (data) => {
            console.log('Call state update:', data);
            if (window.updateCallUIFromServer) {
                window.updateCallUIFromServer(data);
            }
        });
        
        this.webSocketClient.on('client-id', (data) => {
            console.log('Client ID received:', data.id);
            this.currentUser = { id: data.id, name: null };
            
            // If requireDisplayName is true, prompt for display name
            if (data.requireDisplayName) {
                this.promptForDisplayName();
            }
        });

        this.webSocketClient.on('display-name-accepted', (data) => {
            console.log('Display name accepted:', data.name);
            this.currentUser.name = data.name;
            this.uiManager.showStatus(`Welcome, ${data.name}!`);
        });

        this.webSocketClient.on('display-name-rejected', (data) => {
            console.log('Display name rejected:', data.reason);
            this.uiManager.showError(data.reason);
            // Prompt again
            this.promptForDisplayName();
        });

        this.webSocketClient.on('authentication-required', (data) => {
            console.log('Authentication required:', data.message);
            this.uiManager.showError(data.message);
            this.promptForDisplayName();
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
            
            // Set incoming call state
            if (window.activeCall === null) {
              window.activeCall = { userId: data.userId, userName: data.userName, type: 'incoming' };
              if (window.updateCallUI) window.updateCallUI();
            }
        });

        this.webRTCManager.on('call-connected', (data) => {
            this.uiManager.showStatus(`Connected to ${data.userName}`);
        });

        this.webRTCManager.on('call-ended', () => {
            this.uiManager.showStatus('Call ended');
            this.uiManager.clearRemoteVideo();
            // Clear call state
            if (window.activeCall) {
              window.activeCall = null;
              if (window.updateCallUI) window.updateCallUI();
            }
        });

        this.webRTCManager.on('call-error', (data) => {
            this.uiManager.showError(`Call error: ${data.error}`);
            // Clear call state on error
            if (window.activeCall) {
                window.activeCall = null;
                if (window.updateCallUI) window.updateCallUI();
            }
        });

        this.webRTCManager.on('remote-stream', (stream) => {
            // Get the current call info to pass the user name
            const currentCall = this.webRTCManager.currentCall;
            const userName = currentCall ? currentCall.userName : 'Remote User';
            this.uiManager.setRemoteVideo(stream, userName);
        });
    }

    setupGroupCallEvents() {
        this.groupCallManager.on('remote-stream', (data) => {
            console.log(`📹 Group call: received stream from ${data.userName}`);
            this.uiManager.addGroupCallVideo(data.userId, data.userName, data.stream);
        });

        this.groupCallManager.on('peer-disconnected', (data) => {
            console.log(`👋 Group call: peer disconnected ${data.userId}`);
            this.uiManager.removeGroupCallVideo(data.userId);
        });

        this.groupCallManager.on('group-call-ended', () => {
            console.log('📞 Group call ended');
            this.uiManager.clearGroupCallVideos();
        });
    }

    async initialize() {
        try {
            await this.connectToServer();
            await this.mediaController.initializeMedia();
            
            // Initialize group call manager with local stream
            const localStream = this.mediaController.getLocalStream();
            this.groupCallManager = new GroupCallManager(this.webSocketClient, localStream);
            this.setupGroupCallEvents();
            
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

    promptForDisplayName() {
        // Don't use prompt() - let the existing UI handle the display name
        console.log('Display name required - user should use the name input field');
        // Show the name setup if it's hidden
        const nameSetup = document.getElementById('name-setup');
        if (nameSetup) {
            nameSetup.style.display = 'block';
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
export class MediaController {
    constructor(webRTCManager, webSocketClient, uiManager) {
        this.webRTCManager = webRTCManager;
        this.webSocketClient = webSocketClient;
        this.uiManager = uiManager;
        this.eventListeners = {};
    }

    async initializeMedia() {
        try {
            await this.webRTCManager.initializeLocalStream();
            
            // Get the local stream and emit it
            const localStream = this.webRTCManager.getLocalStream();
            if (localStream) {
                this.emit('local-stream-ready', localStream);
            }
            
            this.uiManager.hideError();
        } catch (error) {
            this.emit('media-error', error.message);
            this.uiManager.showError(error.message);
            throw error;
        }
    }

    on(event, callback) {
        if (!this.eventListeners[event]) {
            this.eventListeners[event] = [];
        }
        this.eventListeners[event].push(callback);
    }

    emit(event, data) {
        if (this.eventListeners[event]) {
            this.eventListeners[event].forEach(callback => callback(data));
        }
    }

    toggleAudio() {
        if (this.webRTCManager) {
            const newState = this.webRTCManager.toggleAudio();
            
            // Send media state change to server
            if (this.webSocketClient) {
                this.webSocketClient.send({
                    type: 'media-state-change',
                    audioEnabled: newState
                });
            }
            
            return newState;
        }
        return false;
    }

    toggleVideo() {
        if (this.webRTCManager) {
            const newState = this.webRTCManager.toggleVideo();
            
            // Send media state change to server
            if (this.webSocketClient) {
                this.webSocketClient.send({
                    type: 'media-state-change',
                    videoEnabled: newState
                });
            }
            
            return newState;
        }
        return false;
    }

    isAudioEnabled() {
        return this.webRTCManager ? this.webRTCManager.isAudioEnabled() : false;
    }

    isVideoEnabled() {
        return this.webRTCManager ? this.webRTCManager.isVideoEnabled() : false;
    }

    getLocalStream() {
        return this.webRTCManager ? this.webRTCManager.getLocalStream() : null;
    }

    cleanup() {
        this.eventListeners = {};
    }
}
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

    cleanup() {
        this.eventListeners = {};
    }
}
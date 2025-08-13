export class WebSocketClient {
    constructor() {
        this.socket = null;
        this.eventListeners = {};
    }

    async connect() {
        try {
            // Since WebSocket is integrated with HTTP server, use same host/port
            const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsHost = window.location.host; // includes port if non-standard
            const wsUrl = `${wsProtocol}//${wsHost}/ws`;
            
            console.log('Connecting to WebSocket:', wsUrl);
            
            this.socket = new WebSocket(wsUrl);
            
            return new Promise((resolve, reject) => {
                this.socket.onopen = () => {
                    console.log('WebSocket connected');
                    this.emit('connected');
                    resolve();
                };
                
                this.socket.onerror = (error) => {
                    console.error('WebSocket connection failed:', error);
                    console.error('Failed URL:', wsUrl);
                    this.emit('error', error);
                    reject(new Error(`WebSocket connection failed to ${wsUrl}: ${error.message || 'Unknown error'}`));
                };
                
                this.socket.onmessage = (event) => {
                    try {
                        const message = JSON.parse(event.data);
                        console.log('WebSocket message received:', message);
                        this.handleMessage(message);
                    } catch (error) {
                        console.error('Error parsing WebSocket message:', error);
                    }
                };
                
                this.socket.onclose = (event) => {
                    console.log('WebSocket disconnected, code:', event.code, 'reason:', event.reason);
                    this.emit('disconnected');
                };
            });
        } catch (error) {
            console.error('Failed to connect:', error);
            throw error;
        }
    }

    send(message) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(message));
        } else {
            console.warn('WebSocket not connected, cannot send message:', message);
        }
    }

    handleMessage(message) {
        // Emit specific events based on message type
        if (message.type) {
            this.emit(message.type, message.payload || message);
        }
        
        // Also emit a generic 'message' event
        this.emit('message', message);
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

    disconnect() {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
        this.eventListeners = {};
    }
}
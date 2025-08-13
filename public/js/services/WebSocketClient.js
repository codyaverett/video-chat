export class WebSocketClient {
    constructor() {
        this.socket = null;
        this.eventListeners = {};
    }

    async connect() {
        try {
            // Get server config to determine correct WebSocket URL
            const response = await fetch('/config');
            const config = await response.json();
            
            const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsHost = window.location.hostname;
            const wsPort = config.wsPort || window.location.port;
            const wsUrl = `${wsProtocol}//${wsHost}:${wsPort}/ws`;
            
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
                    this.emit('error', error);
                    reject(error);
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
                
                this.socket.onclose = () => {
                    console.log('WebSocket disconnected');
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
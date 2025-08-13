export class RoomController {
    constructor(webSocketClient, uiManager) {
        this.webSocketClient = webSocketClient;
        this.uiManager = uiManager;
        this.currentRoom = null;
        this.participants = new Map();
        this.eventListeners = {};
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Listen for room-related messages from the server
        this.webSocketClient.on('room-created', (data) => {
            this.handleRoomCreated(data);
        });
        
        this.webSocketClient.on('room-joined', (data) => {
            this.handleRoomJoined(data);
        });
        
        this.webSocketClient.on('user-joined-room', (data) => {
            this.handleUserJoined(data);
        });
        
        this.webSocketClient.on('user-left-room', (data) => {
            this.handleUserLeft(data);
        });
    }
    
    handleRoomCreated(data) {
        console.log('Room created:', data);
        if (data.room) {
            this.currentRoom = { id: data.room.id, name: data.room.name };
            this.uiManager.showStatus(`Room "${data.room.name}" created successfully`);
        } else {
            console.error('Invalid room created response:', data);
            this.uiManager.showStatus('Error creating room - invalid response');
        }
    }
    
    handleRoomJoined(data) {
        console.log('Room joined:', data);
        if (data.room) {
            this.currentRoom = { id: data.room.id, name: data.room.name };
            this.uiManager.showStatus(`Joined room "${data.room.name}"`);
        } else {
            console.error('Invalid room joined response:', data);
            this.uiManager.showStatus('Error joining room - invalid response');
        }
    }
    
    handleUserJoined(data) {
        console.log('User joined:', data);
        this.uiManager.showStatus(`${data.userName} joined the room`);
    }
    
    handleUserLeft(data) {
        console.log('User left:', data);
        this.uiManager.showStatus(`${data.userName} left the room`);
    }

    createRoom(roomName, userName) {
        console.log('Creating room:', roomName, 'for user:', userName);
        
        // First set the display name if not already set
        this.webSocketClient.send({
            type: 'set-displayname',
            name: userName
        });
        
        // Then create the room
        const message = {
            type: 'create-room',
            roomName: roomName
        };
        
        this.webSocketClient.send(message);
        this.uiManager.showStatus('Creating room...');
    }

    joinRoom(roomId, userName) {
        console.log('Joining room:', roomId, 'as user:', userName);
        
        // First set the display name if not already set
        this.webSocketClient.send({
            type: 'set-displayname',
            name: userName
        });
        
        // Then join the room
        const message = {
            type: 'join-room',
            roomId: roomId
        };
        
        this.webSocketClient.send(message);
        this.uiManager.showStatus('Joining room...');
    }

    leaveRoom() {
        console.log('Leaving room');
        
        if (this.currentRoom) {
            const message = {
                type: 'leave-room'
            };
            this.webSocketClient.send(message);
        }
        
        this.currentRoom = null;
        this.participants.clear();
        this.uiManager.showStatus('Left the room');
    }

    getCurrentRoom() {
        return this.currentRoom;
    }

    getParticipants() {
        return Array.from(this.participants.values());
    }

    sendRoomMessage(message) {
        console.log('Sending room message:', message);
        // Message sending logic would go here
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
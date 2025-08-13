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
        
        this.webSocketClient.on('room-join-failed', (data) => {
            this.handleRoomJoinFailed(data);
        });
    }
    
    handleRoomCreated(data) {
        console.log('Room created:', data);
        if (data.room) {
            this.currentRoom = { id: data.room.id, name: data.room.name };
            this.uiManager.showStatus(`Room "${data.room.name}" created successfully`);
            
            // Show current room UI since creator is auto-joined
            this.showCurrentRoomUI(data.room);
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
            
            // Show current room UI
            this.showCurrentRoomUI(data.room);
            
            // Start group call for room participants
            this.startGroupCall(data.room);
        } else {
            console.error('Invalid room joined response:', data);
            this.uiManager.showStatus('Error joining room - invalid response');
        }
    }
    
    handleUserJoined(data) {
        console.log('User joined:', data);
        this.uiManager.showStatus(`${data.userName} joined the room`);
        
        // When someone joins our room, start a call with them
        if (data.room && this.currentRoom && data.room.id === this.currentRoom.id) {
            this.addUserToGroupCall(data.userId, data.userName);
        }
    }
    
    handleUserLeft(data) {
        console.log('User left:', data);
        this.uiManager.showStatus(`${data.userName} left the room`);
    }

    handleRoomJoinFailed(data) {
        console.log('Room join failed:', data);
        this.uiManager.showError(`Failed to join room: ${data.error || 'Unknown error'}`);
        this.uiManager.showStatus('Failed to join room');
        
        // Remove the failed room from UI immediately since it likely no longer exists
        this.removeRoomFromUI(data.roomId);
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
        this.hideCurrentRoomUI();
        this.uiManager.showStatus('Left the room');
    }

    showCurrentRoomUI(room) {
        const currentRoomDiv = document.getElementById('current-room');
        const roomName = document.getElementById('current-room-name');
        const roomParticipants = document.getElementById('current-room-participants');
        
        if (currentRoomDiv && roomName && roomParticipants) {
            currentRoomDiv.style.display = 'block';
            roomName.textContent = room.name;
            
            // Show participant count
            const count = room.participantDetails ? room.participantDetails.length : room.participants?.length || 0;
            roomParticipants.textContent = `${count} participant${count !== 1 ? 's' : ''}`;
        }
    }

    hideCurrentRoomUI() {
        const currentRoomDiv = document.getElementById('current-room');
        if (currentRoomDiv) {
            currentRoomDiv.style.display = 'none';
        }
    }

    removeRoomFromUI(roomId) {
        const roomList = document.getElementById('room-list');
        if (roomList) {
            const roomItems = roomList.querySelectorAll('.room-item');
            roomItems.forEach(item => {
                const joinBtn = item.querySelector('.join-btn');
                if (joinBtn && joinBtn.getAttribute('onclick') && joinBtn.getAttribute('onclick').includes(roomId)) {
                    item.remove();
                }
            });
            
            // If no rooms left, show empty message
            if (roomList.children.length === 0) {
                const emptyMessage = document.getElementById('no-rooms');
                if (emptyMessage) {
                    emptyMessage.style.display = 'block';
                }
            }
        }
    }

    startGroupCall(room) {
        console.log('🎥 Starting group call for room:', room.name, 'with participants:', room.participantDetails);
        if (window.videoCallManager && window.videoCallManager.groupCallManager) {
            window.videoCallManager.groupCallManager.startGroupCall(room);
        } else {
            console.error('❌ GroupCallManager not available');
        }
    }

    addUserToGroupCall(userId, userName) {
        console.log('➕ Adding user to group call:', userName, 'userId:', userId);
        if (window.videoCallManager && window.videoCallManager.groupCallManager) {
            window.videoCallManager.groupCallManager.connectToPeer(userId, userName, true);
        } else {
            console.error('❌ GroupCallManager not available for adding user');
        }
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
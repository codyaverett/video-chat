export class UIManager {
    constructor() {
        this.elements = {};
        this.eventListeners = {};
    }

    initialize() {
        console.log('UIManager initialized');
    }

    showStatus(message) {
        const statusEl = document.getElementById('connection-status');
        if (statusEl) {
            statusEl.textContent = `🔌 ${message}`;
            statusEl.className = 'status-compact connected';
        }
        console.log('Status:', message);
    }

    showError(message) {
        const errorEl = document.getElementById('error-message');
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.style.display = 'block';
        }
        console.error('Error:', message);
    }

    hideError() {
        const errorEl = document.getElementById('error-message');
        if (errorEl) {
            errorEl.style.display = 'none';
        }
    }

    setLocalVideo(stream) {
        const localVideo = document.getElementById('local-video');
        if (localVideo) {
            localVideo.srcObject = stream;
        }
    }

    setRemoteVideo(stream) {
        const remoteVideo = document.getElementById('remote-video');
        if (remoteVideo) {
            remoteVideo.srcObject = stream;
            remoteVideo.style.display = 'block';
        }
    }

    updateConnectionStatus(state) {
        console.log('Connection state updated:', state);
    }

    updateMediaControls(state) {
        console.log('Media controls updated:', state);
    }

    addChatMessage(userName, message) {
        console.log(`Chat message from ${userName}: ${message}`);
    }

    // Placeholder methods for room functionality
    updateRoomInfo(room) { console.log('Room info updated:', room); }
    showRoomControls(isHost) { console.log('Show room controls, is host:', isHost); }
    hideRoomControls() { console.log('Hide room controls'); }
    addParticipant(user) { console.log('Participant added:', user); }
    removeParticipant(user) { console.log('Participant removed:', user); }
    updateParticipantList(participants) { console.log('Participant list updated:', participants); }
    clearParticipantList() { console.log('Participant list cleared'); }
    updateParticipantCount(count) { console.log('Participant count:', count); }
    handleDataChannelMessage(data) { console.log('Data channel message:', data); }

    updateRoomList(rooms) {
        console.log('Updating room list with:', rooms);
        const roomList = document.getElementById('room-list');
        const emptyMessage = document.getElementById('no-rooms');
        
        if (!roomList) {
            console.error('Room list element not found');
            return;
        }

        // Clear existing room list
        roomList.innerHTML = '';
        
        if (!rooms || rooms.length === 0) {
            // Show empty message
            if (emptyMessage) {
                emptyMessage.style.display = 'block';
            }
            return;
        }

        // Hide empty message
        if (emptyMessage) {
            emptyMessage.style.display = 'none';
        }

        // Add rooms to the list
        rooms.forEach(room => {
            const listItem = document.createElement('li');
            listItem.className = 'room-item';
            listItem.innerHTML = `
                <div class="room-info">
                    <span class="room-name">${room.name}</span>
                    <span class="participant-count">${room.participantCount} participant${room.participantCount !== 1 ? 's' : ''}</span>
                </div>
                <button class="join-btn" onclick="joinRoom('${room.id}')">Join</button>
            `;
            roomList.appendChild(listItem);
        });
    }

    updateUserList(users) {
        console.log('🔄 Updating user list with:', users);
        const userList = document.getElementById('user-list');
        const emptyMessage = document.querySelector('.user-list .no-users');
        
        if (!userList) {
            console.error('❌ User list element not found!');
            return;
        }

        // Clear existing user list
        userList.innerHTML = '';
        
        if (!users || users.length === 0) {
            // Show empty message if it exists
            if (emptyMessage) {
                emptyMessage.style.display = 'block';
            }
            return;
        }

        // Hide empty message if it exists
        if (emptyMessage) {
            emptyMessage.style.display = 'none';
        }

        // Add users to the list
        users.forEach(user => {
            console.log('📋 Adding user to list:', user);
            const listItem = document.createElement('li');
            listItem.className = 'user-item';
            listItem.innerHTML = `
                <div class="user-info">
                    <div class="user-details">
                        <span class="user-name">${user.name || 'Anonymous'}</span>
                        <span class="user-status ${user.currentRoom ? 'in-room' : 'available'}">${user.currentRoom ? 'In room' : 'Available'}</span>
                    </div>
                    <div class="user-actions">
                        <button class="call-btn primary" onclick="callUser('${user.id}', '${user.name}')">
                            <span class="call-icon">📞</span>
                            <span class="call-text">Call</span>
                        </button>
                    </div>
                </div>
            `;
            userList.appendChild(listItem);
            console.log('✅ User added to list:', user.name);
        });
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
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

    setRemoteVideo(stream, userName) {
        const remoteVideo = document.getElementById('remote-video');
        const remoteWrapper = document.getElementById('legacy-remote-wrapper');
        const remoteUsername = document.getElementById('remote-username');
        
        if (remoteVideo) {
            remoteVideo.srcObject = stream;
            remoteVideo.style.display = 'block';
            console.log('📹 Remote video stream set');
        }
        
        // Update remote username if provided
        if (remoteUsername && userName) {
            remoteUsername.textContent = userName;
        }
        
        // Show the remote video wrapper when we receive a stream
        if (remoteWrapper) {
            remoteWrapper.style.display = 'block';
            console.log('👥 Remote video wrapper shown');
        }
    }

    clearRemoteVideo() {
        const remoteVideo = document.getElementById('remote-video');
        const remoteWrapper = document.getElementById('legacy-remote-wrapper');
        
        if (remoteVideo) {
            remoteVideo.srcObject = null;
            remoteVideo.style.display = 'none';
            console.log('📹 Remote video stream cleared');
        }
        
        // Hide the remote video wrapper when call ends
        if (remoteWrapper) {
            remoteWrapper.style.display = 'none';
            console.log('👥 Remote video wrapper hidden');
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
                    <div class="room-details">
                        <div class="room-title">${room.name}</div>
                        <div class="room-meta">${room.participantCount} participant${room.participantCount !== 1 ? 's' : ''}</div>
                    </div>
                    <button class="join-btn" onclick="joinRoom('${room.id}')">Join</button>
                </div>
            `;
            roomList.appendChild(listItem);
        });
    }

    updateUserList(users, currentUserId) {
        console.log('🔄 Updating user list with:', users, 'Current user ID:', currentUserId);
        const userList = document.getElementById('user-list');
        const emptyMessage = document.querySelector('.user-list .no-users');
        
        if (!userList) {
            console.error('❌ User list element not found!');
            return;
        }

        // Clear existing user list
        userList.innerHTML = '';
        
        // Filter out current user to prevent self-calling
        const otherUsers = users ? users.filter(user => user.id !== currentUserId) : [];
        
        if (otherUsers.length === 0) {
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

        // Add other users to the list (excluding current user)
        otherUsers.forEach(user => {
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
        
        console.log(`📊 User list updated: ${otherUsers.length} other users (filtered out current user)`);
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

    addGroupCallVideo(userId, userName, stream) {
        console.log(`📹 Adding group call video for ${userName}`);
        
        const remoteVideosContainer = document.getElementById('remote-videos-container');
        if (!remoteVideosContainer) {
            console.error('Remote videos container not found');
            return;
        }
        
        // Remove existing video if it exists
        this.removeGroupCallVideo(userId);
        
        // Create video wrapper
        const videoWrapper = document.createElement('div');
        videoWrapper.className = 'video-wrapper';
        videoWrapper.id = `group-video-${userId}`;
        
        // Create video element
        const videoElement = document.createElement('video');
        videoElement.autoplay = true;
        videoElement.playsinline = true;
        videoElement.srcObject = stream;
        
        // Create username overlay
        const usernameOverlay = document.createElement('div');
        usernameOverlay.className = 'username-overlay';
        usernameOverlay.textContent = userName;
        
        // Add media controls placeholder (future enhancement)
        const videoControls = document.createElement('div');
        videoControls.className = 'video-controls';
        
        // Assemble the video wrapper
        videoWrapper.appendChild(videoElement);
        videoWrapper.appendChild(usernameOverlay);
        videoWrapper.appendChild(videoControls);
        
        // Add to container
        remoteVideosContainer.appendChild(videoWrapper);
        
        // Show video container if not already visible
        const videoContainer = document.getElementById('video-container');
        if (videoContainer) {
            videoContainer.style.display = 'grid';
            // Switch to group call layout
            videoContainer.classList.add('group-call');
        }
        
        console.log(`✅ Added group video for ${userName}`);
    }

    removeGroupCallVideo(userId) {
        const videoElement = document.getElementById(`group-video-${userId}`);
        if (videoElement) {
            videoElement.remove();
            console.log(`🗑️ Removed group video for ${userId}`);
        }
    }

    clearGroupCallVideos() {
        const remoteVideosContainer = document.getElementById('remote-videos-container');
        if (remoteVideosContainer) {
            remoteVideosContainer.innerHTML = '';
        }
        
        // Remove group call layout
        const videoContainer = document.getElementById('video-container');
        if (videoContainer) {
            videoContainer.classList.remove('group-call');
        }
        
        console.log('🧹 Cleared all group call videos');
    }

    cleanup() {
        this.eventListeners = {};
    }
}
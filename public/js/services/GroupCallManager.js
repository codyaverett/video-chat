export class GroupCallManager {
    constructor(webSocketClient, localStream) {
        this.webSocketClient = webSocketClient;
        this.localStream = localStream;
        this.peerConnections = new Map(); // userId -> RTCPeerConnection
        this.remoteStreams = new Map(); // userId -> MediaStream
        this.eventListeners = {};
        this.currentRoom = null;
        
        this.setupWebSocketEvents();
    }

    setupWebSocketEvents() {
        // Listen for group call WebRTC signaling
        this.webSocketClient.on('webrtc-offer', (data) => {
            this.handleOffer(data);
        });
        
        this.webSocketClient.on('webrtc-answer', (data) => {
            this.handleAnswer(data);
        });
        
        this.webSocketClient.on('webrtc-ice-candidate', (data) => {
            this.handleIceCandidate(data);
        });
    }

    async startGroupCall(room) {
        console.log('🎥 Starting group call for room:', room.name);
        console.log('📋 Current room participants:', room.participantDetails);
        console.log('👤 Current user ID:', this.getCurrentUserId());
        
        this.currentRoom = room;
        
        // Connect to each existing participant (excluding ourselves)
        if (room.participantDetails) {
            for (const participant of room.participantDetails) {
                if (participant.id !== this.getCurrentUserId()) {
                    console.log(`🔗 Connecting to participant: ${participant.name} (${participant.id})`);
                    await this.connectToPeer(participant.id, participant.name, true);
                } else {
                    console.log(`⏭️ Skipping self: ${participant.name} (${participant.id})`);
                }
            }
        } else {
            console.log('❌ No participant details in room data');
        }
    }

    async connectToPeer(userId, userName, isInitiator = false) {
        console.log(`🔗 Connecting to peer: ${userName} (${userId}), initiator: ${isInitiator}`);
        
        // Prevent duplicate connections
        if (this.peerConnections.has(userId)) {
            console.log(`⚠️ Already connected to ${userName}, skipping`);
            return;
        }
        
        // In group calls, use user ID comparison to determine who initiates
        // This prevents both users from sending offers simultaneously
        const currentUserId = this.getCurrentUserId();
        const shouldInitiate = currentUserId > userId; // Always use lexicographic comparison, ignore isInitiator
        
        console.log(`📊 Connection decision: currentUser(${currentUserId}) > targetUser(${userId}) = ${shouldInitiate} (initiator flag ignored for consistency)`);
        
        // Create peer connection for this user
        const peerConnection = this.createPeerConnection(userId, userName);
        this.peerConnections.set(userId, peerConnection);
        
        // Add local stream tracks
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                peerConnection.addTrack(track, this.localStream);
            });
        }
        
        if (shouldInitiate) {
            console.log(`📤 Sending offer to ${userName}`);
            // Create and send offer
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            
            this.webSocketClient.send({
                type: 'webrtc-offer',
                offer: offer,
                to: userId,
                roomId: this.currentRoom.id,
                fromName: window.videoCallManager?.currentUser?.name || 'Unknown'
            });
        } else {
            console.log(`⏳ Waiting for offer from ${userName}`);
        }
    }

    createPeerConnection(userId, userName) {
        const config = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };
        
        const peerConnection = new RTCPeerConnection(config);
        
        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                this.webSocketClient.send({
                    type: 'webrtc-ice-candidate',
                    candidate: event.candidate,
                    to: userId,
                    roomId: this.currentRoom.id,
                    fromName: window.videoCallManager?.currentUser?.name || 'Unknown'
                });
            }
        };
        
        // Handle remote stream
        peerConnection.ontrack = (event) => {
            console.log(`📹 Received remote stream from ${userName}`);
            const remoteStream = event.streams[0];
            this.remoteStreams.set(userId, remoteStream);
            this.emit('remote-stream', { userId, userName, stream: remoteStream });
        };
        
        // Handle connection state changes
        peerConnection.onconnectionstatechange = () => {
            console.log(`🔗 Connection state with ${userName}:`, peerConnection.connectionState);
            if (peerConnection.connectionState === 'disconnected' || 
                peerConnection.connectionState === 'failed') {
                this.removePeer(userId);
            }
        };
        
        return peerConnection;
    }

    async handleOffer(data) {
        console.log(`📨 Received offer from ${data.from}`);
        
        // Only handle offers for our current room
        if (!this.currentRoom || data.roomId !== this.currentRoom.id) {
            console.log('Ignoring offer - not in the same room');
            return;
        }
        
        const peerConnection = this.createPeerConnection(data.from, data.fromName || `User-${data.from}`);
        this.peerConnections.set(data.from, peerConnection);
        
        // Add local stream tracks
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                peerConnection.addTrack(track, this.localStream);
            });
        }
        
        // Set remote description and create answer
        await peerConnection.setRemoteDescription(data.offer);
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        // Send answer back
        this.webSocketClient.send({
            type: 'webrtc-answer',
            answer: answer,
            to: data.from,
            roomId: this.currentRoom.id,
            fromName: window.videoCallManager?.currentUser?.name || 'Unknown'
        });
    }

    async handleAnswer(data) {
        console.log(`📨 Received answer from ${data.from}`);
        
        const peerConnection = this.peerConnections.get(data.from);
        if (peerConnection) {
            await peerConnection.setRemoteDescription(data.answer);
        }
    }

    async handleIceCandidate(data) {
        console.log(`📨 Received ICE candidate from ${data.from}`);
        
        const peerConnection = this.peerConnections.get(data.from);
        if (peerConnection) {
            await peerConnection.addIceCandidate(data.candidate);
        }
    }

    removePeer(userId) {
        console.log(`🗑️ Removing peer: ${userId}`);
        
        const peerConnection = this.peerConnections.get(userId);
        if (peerConnection) {
            peerConnection.close();
            this.peerConnections.delete(userId);
        }
        
        const remoteStream = this.remoteStreams.get(userId);
        if (remoteStream) {
            this.remoteStreams.delete(userId);
            this.emit('peer-disconnected', { userId });
        }
    }

    endGroupCall() {
        console.log('🛑 Ending group call');
        
        // Close all peer connections
        for (const [userId, peerConnection] of this.peerConnections) {
            peerConnection.close();
        }
        
        this.peerConnections.clear();
        this.remoteStreams.clear();
        this.currentRoom = null;
        
        this.emit('group-call-ended');
    }

    getCurrentUserId() {
        // Get current user ID from the video call manager
        return window.videoCallManager?.currentUser?.id;
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
}
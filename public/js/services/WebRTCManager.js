export class WebRTCManager {
    constructor(webSocketClient) {
        this.webSocketClient = webSocketClient;
        this.localStream = null;
        this.eventListeners = {};
        this.peerConnection = null;
        this.currentCall = null;
        this.setupWebRTCEventListeners();
    }

    async initializeLocalStream() {
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({ 
                video: true, 
                audio: true 
            });
            
            const localVideo = document.getElementById('local-video');
            if (localVideo) {
                localVideo.srcObject = this.localStream;
            }
            
            console.log('✅ Camera and microphone access granted');
        } catch (error) {
            console.error('Error accessing media devices:', error);
            throw new Error('Failed to access camera/microphone');
        }
    }

    getLocalStream() {
        return this.localStream;
    }

    enableAudio(enabled) {
        if (this.localStream) {
            const audioTrack = this.localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = enabled;
                console.log('🎤', enabled ? 'Audio enabled' : 'Audio muted');
            }
        }
    }

    enableVideo(enabled) {
        if (this.localStream) {
            const videoTrack = this.localStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = enabled;
                console.log('📹', enabled ? 'Video enabled' : 'Video disabled');
            }
        }
    }

    isAudioEnabled() {
        if (this.localStream) {
            const audioTrack = this.localStream.getAudioTracks()[0];
            return audioTrack ? audioTrack.enabled : false;
        }
        return false;
    }

    isVideoEnabled() {
        if (this.localStream) {
            const videoTrack = this.localStream.getVideoTracks()[0];
            return videoTrack ? videoTrack.enabled : false;
        }
        return false;
    }

    toggleAudio() {
        const currentState = this.isAudioEnabled();
        this.enableAudio(!currentState);
        return !currentState;
    }

    toggleVideo() {
        const currentState = this.isVideoEnabled();
        this.enableVideo(!currentState);
        return !currentState;
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

    setupWebRTCEventListeners() {
        this.webSocketClient.on('call-made', (data) => {
            this.handleIncomingCall(data);
        });
        
        this.webSocketClient.on('answer-made', (data) => {
            this.handleCallAnswer(data);
        });
        
        this.webSocketClient.on('ice-candidate', (data) => {
            this.handleIceCandidate(data);
        });
    }

    async initiateCall(userId, userName) {
        try {
            console.log('📞 Starting call to:', userId, userName);
            
            // Ensure we have local stream before calling
            if (!this.localStream) {
                console.log('🎥 No local stream, initializing camera...');
                await this.initializeLocalStream();
            }
            
            this.currentCall = { userId, userName, isInitiator: true };
            
            // Create peer connection
            this.createPeerConnection();
            
            // Add local stream to peer connection
            if (this.localStream) {
                console.log('🎬 Adding local stream tracks to peer connection');
                this.localStream.getTracks().forEach(track => {
                    this.peerConnection.addTrack(track, this.localStream);
                });
            } else {
                console.error('❌ Failed to get local stream for call');
                throw new Error('Camera access required for video calls');
            }
            
            // Create offer
            console.log('🎯 Creating WebRTC offer...');
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);
            console.log('✅ Offer created and set as local description');
            
            // Send offer to the other user
            console.log('📤 Sending call offer to user:', userId);
            this.webSocketClient.send({
                type: 'call-user',
                offer: offer,
                to: userId
            });
            
            this.emit('call-initiated', { userId, userName });
            
        } catch (error) {
            console.error('Error initiating call:', error);
            this.emit('call-error', { error: error.message });
        }
    }

    async handleIncomingCall(data) {
        try {
            console.log('📞 Incoming call from:', data.fromName, '(ID:', data.from, ')');
            
            // Ensure we have local stream before answering
            if (!this.localStream) {
                console.log('🎥 No local stream for incoming call, initializing camera...');
                await this.initializeLocalStream();
            }
            
            this.currentCall = { userId: data.from, userName: data.fromName, isInitiator: false };
            
            // Create peer connection
            this.createPeerConnection();
            
            // Add local stream to peer connection
            if (this.localStream) {
                this.localStream.getTracks().forEach(track => {
                    this.peerConnection.addTrack(track, this.localStream);
                });
            }
            
            // Set remote description
            await this.peerConnection.setRemoteDescription(data.offer);
            
            // Create answer
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            
            // Send answer back
            this.webSocketClient.send({
                type: 'make-answer',
                answer: answer,
                to: data.from
            });
            
            this.emit('call-received', { userId: data.from, userName: data.fromName });
            
        } catch (error) {
            console.error('Error handling incoming call:', error);
            this.emit('call-error', { error: error.message });
        }
    }

    async handleCallAnswer(data) {
        try {
            console.log('Call answered:', data);
            await this.peerConnection.setRemoteDescription(data.answer);
            this.emit('call-connected', this.currentCall);
        } catch (error) {
            console.error('Error handling call answer:', error);
            this.emit('call-error', { error: error.message });
        }
    }

    async handleIceCandidate(data) {
        try {
            if (this.peerConnection) {
                await this.peerConnection.addIceCandidate(data.candidate);
            }
        } catch (error) {
            console.error('Error handling ICE candidate:', error);
        }
    }

    createPeerConnection() {
        const config = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' }
            ]
        };
        
        this.peerConnection = new RTCPeerConnection(config);
        
        // Handle ICE candidates
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate && this.currentCall) {
                this.webSocketClient.send({
                    type: 'ice-candidate',
                    candidate: event.candidate,
                    to: this.currentCall.userId
                });
            }
        };
        
        // Handle remote stream
        this.peerConnection.ontrack = (event) => {
            console.log('Received remote stream');
            const remoteVideo = document.getElementById('remote-video');
            if (remoteVideo && event.streams[0]) {
                remoteVideo.srcObject = event.streams[0];
                remoteVideo.style.display = 'block';
            }
            this.emit('remote-stream', event.streams[0]);
        };
        
        // Handle connection state changes
        this.peerConnection.onconnectionstatechange = () => {
            console.log('Connection state:', this.peerConnection.connectionState);
            this.emit('connection-state-change', this.peerConnection.connectionState);
        };
    }

    endCall() {
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
        
        this.currentCall = null;
        this.emit('call-ended');
    }

    close() {
        this.endCall();
        
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }
        this.eventListeners = {};
    }
}
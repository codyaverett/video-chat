import { IWebRTCManager } from '../core/interfaces/IWebRTCManager.js';
import { IWebSocketClient } from '../core/interfaces/IWebSocketClient.js';

export class WebRTCManager implements IWebRTCManager {
  private localStream: MediaStream | null = null;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private remoteStreams: Map<string, MediaStream> = new Map();
  private webSocketClient: IWebSocketClient;
  private localVideoElement: HTMLVideoElement | null = null;
  private onRemoteStreamCallback?: (userId: string, stream: MediaStream) => void;
  private onStreamRemovedCallback?: (userId: string) => void;

  private readonly iceConfiguration = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  };

  constructor(webSocketClient: IWebSocketClient) {
    this.webSocketClient = webSocketClient;
    this.localVideoElement = document.getElementById('local-video') as HTMLVideoElement;
  }

  async initializeLocalStream(): Promise<void> {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Camera access requires HTTPS or localhost');
    }

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      
      if (this.localVideoElement) {
        this.localVideoElement.srcObject = this.localStream;
      }
      
      console.log('✅ Camera and microphone access granted');
    } catch (error: any) {
      console.error('Error accessing media devices:', error);
      
      if (error.name === 'NotAllowedError') {
        throw new Error('Camera/microphone access denied. Please allow access and refresh.');
      } else if (error.name === 'NotFoundError') {
        throw new Error('No camera or microphone found. Please connect a camera and refresh.');
      } else if (error.name === 'NotSecureContext') {
        throw new Error('HTTPS required for camera access from remote devices');
      } else {
        throw new Error(`Media device error: ${error.message}`);
      }
    }
  }

  createPeerConnection(userId: string, isInitiator: boolean = false): RTCPeerConnection {
    if (this.peerConnections.has(userId)) {
      this.cleanupPeerConnection(userId);
    }

    const pc = new RTCPeerConnection(this.iceConfiguration);

    // Add local stream tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        pc.addTrack(track, this.localStream!);
      });
    }

    // Handle incoming stream
    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      this.remoteStreams.set(userId, remoteStream);
      
      if (this.onRemoteStreamCallback) {
        this.onRemoteStreamCallback(userId, remoteStream);
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.webSocketClient.send({
          type: 'webrtc-ice-candidate',
          candidate: event.candidate,
          to: userId
        });
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log(`Peer connection with ${userId}: ${pc.connectionState}`);
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        this.cleanupPeerConnection(userId);
      }
    };

    this.peerConnections.set(userId, pc);

    // Create offer if we're the initiator
    if (isInitiator) {
      pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .then(() => {
          this.webSocketClient.send({
            type: 'webrtc-offer',
            offer: pc.localDescription,
            to: userId
          });
        })
        .catch(error => console.error('Error creating offer:', error));
    }

    return pc;
  }

  async handleOffer(offer: RTCSessionDescriptionInit, fromUserId: string): Promise<void> {
    const pc = this.createPeerConnection(fromUserId, false);
    
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      this.webSocketClient.send({
        type: 'webrtc-answer',
        answer: pc.localDescription,
        to: fromUserId
      });
    } catch (error) {
      console.error('Error handling offer:', error);
      this.cleanupPeerConnection(fromUserId);
    }
  }

  async handleAnswer(answer: RTCSessionDescriptionInit, fromUserId: string): Promise<void> {
    const pc = this.peerConnections.get(fromUserId);
    if (pc) {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      } catch (error) {
        console.error('Error handling answer:', error);
      }
    }
  }

  async handleIceCandidate(candidate: RTCIceCandidateInit, fromUserId: string): Promise<void> {
    const pc = this.peerConnections.get(fromUserId);
    if (pc) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error('Error adding ICE candidate:', error);
      }
    }
  }

  cleanupPeerConnection(userId: string): void {
    const pc = this.peerConnections.get(userId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(userId);
    }

    this.remoteStreams.delete(userId);
    
    if (this.onStreamRemovedCallback) {
      this.onStreamRemovedCallback(userId);
    }
  }

  cleanupAllConnections(): void {
    this.peerConnections.forEach((pc, userId) => {
      this.cleanupPeerConnection(userId);
    });
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  enableAudio(enabled: boolean): void {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = enabled;
      }
    }
  }

  enableVideo(enabled: boolean): void {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = enabled;
      }
    }
  }

  applyVideoFilter(filter: string): void {
    if (this.localVideoElement) {
      if (filter === 'none') {
        this.localVideoElement.style.filter = '';
      } else {
        this.localVideoElement.style.filter = filter;
      }
    }
  }

  onRemoteStream(callback: (userId: string, stream: MediaStream) => void): void {
    this.onRemoteStreamCallback = callback;
  }

  onStreamRemoved(callback: (userId: string) => void): void {
    this.onStreamRemovedCallback = callback;
  }
}
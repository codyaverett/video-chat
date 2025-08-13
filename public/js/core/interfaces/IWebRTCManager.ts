export interface IWebRTCManager {
  initializeLocalStream(): Promise<void>;
  createPeerConnection(userId: string, isInitiator?: boolean): RTCPeerConnection;
  handleOffer(offer: RTCSessionDescriptionInit, fromUserId: string): Promise<void>;
  handleAnswer(answer: RTCSessionDescriptionInit, fromUserId: string): Promise<void>;
  handleIceCandidate(candidate: RTCIceCandidateInit, fromUserId: string): Promise<void>;
  cleanupPeerConnection(userId: string): void;
  cleanupAllConnections(): void;
  getLocalStream(): MediaStream | null;
  enableAudio(enabled: boolean): void;
  enableVideo(enabled: boolean): void;
  applyVideoFilter(filter: string): void;
}
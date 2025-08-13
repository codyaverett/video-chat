import { ISignalingService } from '../core/interfaces/ISignalingService.ts';
import { IBroadcastService } from '../core/interfaces/IBroadcastService.ts';
import { IUserManager } from '../core/interfaces/IUserManager.ts';
import { IRoomManager } from '../core/interfaces/IRoomManager.ts';
import { 
  WebRTCOfferMessage, 
  WebRTCAnswerMessage, 
  WebRTCIceCandidateMessage,
  CallUserMessage,
  MakeAnswerMessage,
  IceCandidateMessage 
} from '../core/models/WebRTCMessage.ts';

export class WebRTCSignalingService implements ISignalingService {
  constructor(
    private userManager: IUserManager,
    private roomManager: IRoomManager,
    private broadcastService: IBroadcastService
  ) {}

  handleWebRTCOffer(message: WebRTCOfferMessage, fromUserId: string): void {
    if (message.roomId) {
      // Room-based offer - send to specific target user
      if (message.to) {
        this.broadcastService.broadcastToUser(message.to, {
          type: "webrtc-offer",
          offer: message.offer,
          from: fromUserId,
          fromName: this.userManager.getUserName(fromUserId),
          roomId: message.roomId
        });
        console.log(`🔄 Relaying room WebRTC offer from ${fromUserId} to ${message.to} in room ${message.roomId}`);
      }
    } else {
      // Direct call offer
      this.broadcastService.broadcastToUser(message.to, {
        type: "webrtc-offer",
        offer: message.offer,
        from: fromUserId,
        fromName: this.userManager.getUserName(fromUserId)
      });
    }
  }

  handleWebRTCAnswer(message: WebRTCAnswerMessage, fromUserId: string): void {
    this.broadcastService.broadcastToUser(message.to, {
      type: "webrtc-answer",
      answer: message.answer,
      from: fromUserId,
      roomId: message.roomId
    });
    console.log(`🔄 Relaying WebRTC answer from ${fromUserId} to ${message.to}`);
  }

  handleWebRTCIceCandidate(message: WebRTCIceCandidateMessage, fromUserId: string): void {
    this.broadcastService.broadcastToUser(message.to, {
      type: "webrtc-ice-candidate",
      candidate: message.candidate,
      from: fromUserId,
      roomId: message.roomId
    });
    console.log(`🔄 Relaying ICE candidate from ${fromUserId} to ${message.to}`);
  }

  handleLegacyCallUser(message: CallUserMessage, fromUserId: string): void {
    const callingUser = this.userManager.getUser(fromUserId);
    console.log(`🔄 Relaying call from ${fromUserId} to ${message.to}`);
    
    // Send call offer to target user
    this.broadcastService.broadcastToUser(message.to, {
      type: "call-made",
      offer: message.offer,
      from: fromUserId,
      fromName: callingUser?.name || 'Unknown User'
    });
    
    // Send call state update to both users
    this.broadcastService.broadcastToUser(fromUserId, {
      type: "call-state-update",
      state: "calling",
      otherUserId: message.to,
      otherUserName: this.userManager.getUserName(message.to)
    });
    
    this.broadcastService.broadcastToUser(message.to, {
      type: "call-state-update", 
      state: "receiving",
      otherUserId: fromUserId,
      otherUserName: callingUser?.name || 'Unknown User'
    });
  }

  handleLegacyMakeAnswer(message: MakeAnswerMessage, fromUserId: string): void {
    console.log(`🔄 Relaying answer from ${fromUserId} to ${message.to}`);
    const answeringUser = this.userManager.getUser(fromUserId);
    
    this.broadcastService.broadcastToUser(message.to, {
      type: "answer-made",
      answer: message.answer,
      from: fromUserId,
    });
    
    // Send call connected state to both users
    this.broadcastService.broadcastToUser(fromUserId, {
      type: "call-state-update",
      state: "connected",
      otherUserId: message.to,
      otherUserName: this.userManager.getUserName(message.to)
    });
    
    this.broadcastService.broadcastToUser(message.to, {
      type: "call-state-update",
      state: "connected", 
      otherUserId: fromUserId,
      otherUserName: answeringUser?.name || 'Unknown User'
    });
  }

  handleLegacyIceCandidate(message: IceCandidateMessage, fromUserId: string): void {
    console.log(`🔄 Relaying ICE candidate from ${fromUserId} to ${message.to}`);
    this.broadcastService.broadcastToUser(message.to, {
      type: "ice-candidate",
      candidate: message.candidate,
      from: fromUserId,
    });
  }
}
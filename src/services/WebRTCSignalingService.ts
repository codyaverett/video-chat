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
      // Room-based offer - broadcast to all other participants
      this.broadcastService.broadcastToRoom(message.roomId, {
        type: "webrtc-offer",
        offer: message.offer,
        from: fromUserId,
        fromName: this.userManager.getUserName(fromUserId),
        to: message.to
      }, [fromUserId]);
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
    });
  }

  handleWebRTCIceCandidate(message: WebRTCIceCandidateMessage, fromUserId: string): void {
    this.broadcastService.broadcastToUser(message.to, {
      type: "webrtc-ice-candidate",
      candidate: message.candidate,
      from: fromUserId,
    });
  }

  handleLegacyCallUser(message: CallUserMessage, fromUserId: string): void {
    const callingUser = this.userManager.getUser(fromUserId);
    console.log(`🔄 Relaying call from ${fromUserId} to ${message.to}`);
    this.broadcastService.broadcastToUser(message.to, {
      type: "call-made",
      offer: message.offer,
      from: fromUserId,
      fromName: callingUser?.name || 'Unknown User'
    });
  }

  handleLegacyMakeAnswer(message: MakeAnswerMessage, fromUserId: string): void {
    console.log(`🔄 Relaying answer from ${fromUserId} to ${message.to}`);
    this.broadcastService.broadcastToUser(message.to, {
      type: "answer-made",
      answer: message.answer,
      from: fromUserId,
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
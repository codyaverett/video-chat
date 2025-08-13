import { 
  WebRTCOfferMessage, 
  WebRTCAnswerMessage, 
  WebRTCIceCandidateMessage,
  CallUserMessage,
  MakeAnswerMessage,
  IceCandidateMessage 
} from '../models/WebRTCMessage.ts';

export interface ISignalingService {
  handleWebRTCOffer(message: WebRTCOfferMessage, fromUserId: string): void;
  handleWebRTCAnswer(message: WebRTCAnswerMessage, fromUserId: string): void;
  handleWebRTCIceCandidate(message: WebRTCIceCandidateMessage, fromUserId: string): void;
  handleLegacyCallUser(message: CallUserMessage, fromUserId: string): void;
  handleLegacyMakeAnswer(message: MakeAnswerMessage, fromUserId: string): void;
  handleLegacyIceCandidate(message: IceCandidateMessage, fromUserId: string): void;
}
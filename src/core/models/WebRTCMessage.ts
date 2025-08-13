export type MessageType = 
  | 'client-id'
  | 'set-displayname'
  | 'media-state-change'
  | 'create-room'
  | 'join-room'
  | 'leave-room'
  | 'webrtc-offer'
  | 'webrtc-answer'
  | 'webrtc-ice-candidate'
  | 'call-user'
  | 'make-answer'
  | 'ice-candidate'
  | 'end-call'
  | 'update-user-list'
  | 'media-states-update'
  | 'room-list-update'
  | 'room-created'
  | 'room-joined'
  | 'user-joined-room'
  | 'user-left-room'
  | 'call-made'
  | 'answer-made'
  | 'call-state-update';

export interface BaseMessage {
  type: MessageType;
}

export interface ClientIdMessage extends BaseMessage {
  type: 'client-id';
  id: string;
}

export interface SetDisplayNameMessage extends BaseMessage {
  type: 'set-displayname';
  name: string;
}

export interface MediaStateChangeMessage extends BaseMessage {
  type: 'media-state-change';
  audioEnabled?: boolean;
  videoEnabled?: boolean;
  videoFilter?: string;
}

export interface CreateRoomMessage extends BaseMessage {
  type: 'create-room';
  roomName: string;
}

export interface JoinRoomMessage extends BaseMessage {
  type: 'join-room';
  roomId: string;
}

export interface LeaveRoomMessage extends BaseMessage {
  type: 'leave-room';
}

export interface WebRTCOfferMessage extends BaseMessage {
  type: 'webrtc-offer';
  offer: RTCSessionDescriptionInit;
  to: string;
  roomId?: string;
  from?: string;
  fromName?: string;
}

export interface WebRTCAnswerMessage extends BaseMessage {
  type: 'webrtc-answer';
  answer: RTCSessionDescriptionInit;
  to: string;
  from?: string;
}

export interface WebRTCIceCandidateMessage extends BaseMessage {
  type: 'webrtc-ice-candidate';
  candidate: RTCIceCandidateInit;
  to: string;
  from?: string;
}

export interface CallUserMessage extends BaseMessage {
  type: 'call-user';
  offer: RTCSessionDescriptionInit;
  to: string;
}

export interface MakeAnswerMessage extends BaseMessage {
  type: 'make-answer';
  answer: RTCSessionDescriptionInit;
  to: string;
}

export interface IceCandidateMessage extends BaseMessage {
  type: 'ice-candidate';
  candidate: RTCIceCandidateInit;
  to: string;
}

export interface EndCallMessage extends BaseMessage {
  type: 'end-call';
  otherUserId?: string;
}

export type IncomingMessage = 
  | SetDisplayNameMessage
  | MediaStateChangeMessage
  | CreateRoomMessage
  | JoinRoomMessage
  | LeaveRoomMessage
  | WebRTCOfferMessage
  | WebRTCAnswerMessage
  | WebRTCIceCandidateMessage
  | CallUserMessage
  | MakeAnswerMessage
  | IceCandidateMessage
  | EndCallMessage;

export interface OutgoingMessage extends BaseMessage {
  [key: string]: any;
}
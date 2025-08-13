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
  | 'update-user-list'
  | 'media-states-update'
  | 'room-list-update'
  | 'room-created'
  | 'room-joined'
  | 'user-joined-room'
  | 'user-left-room'
  | 'call-made'
  | 'answer-made';

export interface BaseMessage {
  type: MessageType;
  [key: string]: any;
}

export interface OutgoingMessage extends BaseMessage {
  // Messages sent to server
}

export interface IncomingMessage extends BaseMessage {
  // Messages received from server
}
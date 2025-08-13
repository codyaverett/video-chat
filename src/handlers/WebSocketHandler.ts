import { IUserManager } from '../core/interfaces/IUserManager.ts';
import { IRoomManager } from '../core/interfaces/IRoomManager.ts';
import { IBroadcastService } from '../core/interfaces/IBroadcastService.ts';
import { ISignalingService } from '../core/interfaces/ISignalingService.ts';
import { UserModel } from '../core/models/User.ts';
import { IncomingMessage } from '../core/models/WebRTCMessage.ts';

export class WebSocketHandler {
  constructor(
    private userManager: IUserManager,
    private roomManager: IRoomManager,
    private broadcastService: IBroadcastService,
    private signalingService: ISignalingService
  ) {}

  handleWebSocket(ws: WebSocket): void {
    const clientId = crypto.randomUUID();
    console.log(`✅ New WebSocket client connected: ${clientId}`);
    
    const user = new UserModel(clientId, ws);
    this.userManager.addUser(user);
    
    // Send initial client ID
    setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) {
        console.log(`🔗 Sending initial data to client: ${clientId}`);
        ws.send(JSON.stringify({
          type: "client-id",
          id: clientId,
        }));
        this.broadcastService.broadcastUserList();
        this.broadcastService.broadcastRoomList();
      } else {
        console.log(`⚠️ WebSocket not ready for client: ${clientId}, state: ${ws.readyState}`);
      }
    }, 100);

    ws.onmessage = (event) => {
      try {
        const message: IncomingMessage = JSON.parse(event.data);
        this.handleMessage(message, clientId);
      } catch (error) {
        console.error(`Error parsing message from ${clientId}:`, error);
      }
    };

    ws.onclose = () => {
      this.handleUserDisconnection(clientId);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.handleUserDisconnection(clientId);
    };
  }

  private handleMessage(message: IncomingMessage, clientId: string): void {
    switch (message.type) {
      case "set-displayname":
        this.handleSetDisplayName(message.name, clientId);
        break;
      
      case "media-state-change":
        this.handleMediaStateChange(message, clientId);
        break;
      
      case "create-room":
        this.handleCreateRoom(message.roomName, clientId);
        break;
      
      case "join-room":
        this.handleJoinRoom(message.roomId, clientId);
        break;
      
      case "leave-room":
        this.handleLeaveRoom(clientId);
        break;
      
      case "webrtc-offer":
        this.signalingService.handleWebRTCOffer(message, clientId);
        break;
      
      case "webrtc-answer":
        this.signalingService.handleWebRTCAnswer(message, clientId);
        break;
      
      case "webrtc-ice-candidate":
        this.signalingService.handleWebRTCIceCandidate(message, clientId);
        break;
      
      case "call-user":
        this.signalingService.handleLegacyCallUser(message, clientId);
        break;
      
      case "make-answer":
        this.signalingService.handleLegacyMakeAnswer(message, clientId);
        break;
      
      case "ice-candidate":
        this.signalingService.handleLegacyIceCandidate(message, clientId);
        break;
    }
  }

  private handleSetDisplayName(name: string, clientId: string): void {
    if (this.userManager.setUserDisplayName(clientId, name)) {
      this.broadcastService.broadcastUserList();
    }
  }

  private handleMediaStateChange(message: any, clientId: string): void {
    const state = {
      audioEnabled: message.audioEnabled,
      videoEnabled: message.videoEnabled,
      videoFilter: message.videoFilter
    };
    
    if (this.userManager.updateUserMediaState(clientId, state)) {
      this.broadcastService.broadcastMediaStates();
    }
  }

  private handleCreateRoom(roomName: string, clientId: string): void {
    // Leave current room if in one
    this.userManager.leaveCurrentRoom(clientId);
    
    const room = this.roomManager.createRoom(roomName, clientId);
    const user = this.userManager.getUser(clientId);
    if (user) {
      user.currentRoom = room.id;
    }
    
    const roomDetails = this.roomManager.getRoomDetails(
      room.id, 
      (userId: string) => this.userManager.getUserName(userId)
    );
    
    this.broadcastService.broadcastToUser(clientId, {
      type: "room-created",
      room: roomDetails
    });
    
    this.broadcastService.broadcastRoomList();
  }

  private handleJoinRoom(roomId: string, clientId: string): void {
    // Leave current room if in one
    this.userManager.leaveCurrentRoom(clientId);
    
    const room = this.roomManager.joinRoom(roomId, clientId);
    if (room) {
      const user = this.userManager.getUser(clientId);
      if (user) {
        user.currentRoom = roomId;
      }
      
      const roomDetails = this.roomManager.getRoomDetails(
        roomId, 
        (userId: string) => this.userManager.getUserName(userId)
      );
      
      // Notify user they joined
      this.broadcastService.broadcastToUser(clientId, {
        type: "room-joined",
        room: roomDetails
      });
      
      // Notify all participants about new user
      this.broadcastService.broadcastToRoom(roomId, {
        type: "user-joined-room",
        userId: clientId,
        userName: user?.name,
        room: roomDetails
      });
      
      this.broadcastService.broadcastRoomList();
    }
  }

  private handleLeaveRoom(clientId: string): void {
    const user = this.userManager.getUser(clientId);
    if (user?.currentRoom) {
      const roomId = user.currentRoom;
      const room = this.roomManager.getRoom(roomId);
      
      if (room && this.roomManager.leaveRoom(roomId, clientId)) {
        user.currentRoom = undefined;
        
        // If room still exists, notify remaining participants
        const remainingRoom = this.roomManager.getRoom(roomId);
        if (remainingRoom) {
          this.broadcastService.broadcastToRoom(roomId, {
            type: "user-left-room",
            userId: clientId,
            userName: user.name,
            room: {
              id: remainingRoom.id,
              name: remainingRoom.name,
              participants: Array.from(remainingRoom.participants)
            }
          });
        }
        
        this.broadcastService.broadcastRoomList();
      }
    }
  }

  private handleUserDisconnection(clientId: string): void {
    this.userManager.removeUser(clientId);
    this.broadcastService.broadcastUserList();
    console.log(`❌ User disconnected: ${clientId}`);
  }
}
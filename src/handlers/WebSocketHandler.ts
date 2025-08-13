import { IUserManager } from '../core/interfaces/IUserManager.ts';
import { IRoomManager } from '../core/interfaces/IRoomManager.ts';
import { IBroadcastService } from '../core/interfaces/IBroadcastService.ts';
import { ISignalingService } from '../core/interfaces/ISignalingService.ts';
import { UserModel } from '../core/models/User.ts';
import { IncomingMessage } from '../core/models/WebRTCMessage.ts';

export class WebSocketHandler {
  private pendingUsers: Map<string, UserModel> = new Map();

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
    this.pendingUsers.set(clientId, user);
    
    // Send initial client ID and require display name
    setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) {
        console.log(`🔗 Sending initial data to client: ${clientId}`);
        ws.send(JSON.stringify({
          type: "client-id",
          id: clientId,
          requireDisplayName: true
        }));
        // Don't add user to manager or broadcast lists until they set a display name
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
    console.log(`📨 Received message: ${message.type} from ${clientId}`);
    
    // Always allow setting display name
    if (message.type === "set-displayname") {
      this.handleSetDisplayName(message.name, clientId);
      return;
    }

    // For all other actions, require authentication
    if (!this.isUserAuthenticated(clientId)) {
      const user = this.pendingUsers.get(clientId);
      if (user?.socket.readyState === WebSocket.OPEN) {
        user.socket.send(JSON.stringify({
          type: "authentication-required",
          message: "Please set a display name before performing actions"
        }));
      }
      return;
    }

    switch (message.type) {
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
      
      case "end-call":
        this.handleEndCall(message, clientId);
        break;
    }
  }

  private isUserAuthenticated(clientId: string): boolean {
    return this.userManager.getUser(clientId) !== undefined;
  }

  private handleSetDisplayName(name: string, clientId: string): void {
    // Reject anonymous names
    if (!name || name.trim() === '' || 
        name.toLowerCase().includes('anonymous') || 
        name.trim().toLowerCase() === 'user' ||
        name.trim().length < 2) {
      const user = this.pendingUsers.get(clientId) || this.userManager.getUser(clientId);
      if (user?.socket.readyState === WebSocket.OPEN) {
        user.socket.send(JSON.stringify({
          type: "display-name-rejected",
          reason: "Please enter a valid display name (minimum 2 characters, no 'anonymous' or 'user')"
        }));
      }
      return;
    }

    // Check if user is pending (first time setting name)
    const pendingUser = this.pendingUsers.get(clientId);
    if (pendingUser) {
      // First time setting display name - move from pending to active
      pendingUser.name = name.trim();
      this.userManager.addUser(pendingUser);
      this.pendingUsers.delete(clientId);
      
      // Send confirmation and broadcast updates
      if (pendingUser.socket.readyState === WebSocket.OPEN) {
        pendingUser.socket.send(JSON.stringify({
          type: "display-name-accepted",
          name: name.trim()
        }));
      }
      
      this.broadcastService.broadcastUserList();
      this.broadcastService.broadcastRoomList();
      console.log(`👤 User ${clientId} authenticated with name: ${name.trim()}`);
    } else {
      // User is already active - just update name
      if (this.userManager.setUserDisplayName(clientId, name.trim())) {
        this.broadcastService.broadcastUserList();
        console.log(`👤 User ${clientId} changed name to: ${name.trim()}`);
      }
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
    
    // Notify the creator that they created and joined the room
    this.broadcastService.broadcastToUser(clientId, {
      type: "room-created",
      room: roomDetails
    });
    
    // Also send room-joined notification since creator auto-joins
    this.broadcastService.broadcastToUser(clientId, {
      type: "room-joined",
      room: roomDetails
    });
    
    this.broadcastService.broadcastRoomList();
  }

  private handleJoinRoom(roomId: string, clientId: string): void {
    console.log(`🚪 Processing join-room request: roomId=${roomId}, clientId=${clientId}`);
    
    // Leave current room if in one
    this.userManager.leaveCurrentRoom(clientId);
    
    const room = this.roomManager.joinRoom(roomId, clientId);
    console.log(`🏠 Room manager join result:`, room ? 'SUCCESS' : 'FAILED');
    
    if (room) {
      const user = this.userManager.getUser(clientId);
      if (user) {
        user.currentRoom = roomId;
        console.log(`👤 User ${user.name} assigned to room ${roomId}`);
      }
      
      const roomDetails = this.roomManager.getRoomDetails(
        roomId, 
        (userId: string) => this.userManager.getUserName(userId)
      );
      console.log(`📋 Room details:`, roomDetails);
      
      // Notify user they joined
      this.broadcastService.broadcastToUser(clientId, {
        type: "room-joined",
        room: roomDetails
      });
      console.log(`✅ Sent room-joined notification to ${clientId}`);
      
      // Notify all participants about new user
      this.broadcastService.broadcastToRoom(roomId, {
        type: "user-joined-room",
        userId: clientId,
        userName: user?.name,
        room: roomDetails
      });
      console.log(`📢 Broadcasted user-joined-room to room ${roomId}`);
      
      this.broadcastService.broadcastRoomList();
    } else {
      console.log(`❌ Failed to join room ${roomId} - room not found or join failed`);
      
      // Notify the user that the room join failed
      this.broadcastService.broadcastToUser(clientId, {
        type: "room-join-failed",
        roomId: roomId,
        error: "Room not found or no longer exists"
      });
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

  private handleEndCall(message: any, clientId: string): void {
    console.log(`📞 User ${clientId} ended call with ${message.otherUserId || 'unknown'}`);
    
    // Notify the other user that the call ended
    if (message.otherUserId) {
      this.broadcastService.broadcastToUser(message.otherUserId, {
        type: "call-state-update",
        state: "ended",
        otherUserId: clientId,
        otherUserName: this.userManager.getUserName(clientId)
      });
    }
    
    // Also send to the user who ended the call (for cleanup)
    this.broadcastService.broadcastToUser(clientId, {
      type: "call-state-update",
      state: "ended",
      otherUserId: message.otherUserId,
      otherUserName: this.userManager.getUserName(message.otherUserId || '')
    });
  }

  private handleUserDisconnection(clientId: string): void {
    // Check if user was authenticated or pending
    const user = this.userManager.getUser(clientId);
    const pendingUser = this.pendingUsers.get(clientId);
    
    if (user) {
      // User was authenticated - handle normal disconnection
      this.broadcastService.broadcastToAllUsers({
        type: "call-state-update",
        state: "ended",
        otherUserId: clientId,
        otherUserName: user.name || 'Unknown User'
      });
      
      this.userManager.removeUser(clientId);
      this.broadcastService.broadcastUserList();
      console.log(`❌ Authenticated user disconnected: ${clientId}`);
    } else if (pendingUser) {
      // User was pending authentication - just clean up
      this.pendingUsers.delete(clientId);
      console.log(`❌ Pending user disconnected: ${clientId}`);
    }
  }
}
export interface User {
  id: string;
  socket: WebSocket;
  name?: string;
  audioEnabled?: boolean;
  videoEnabled?: boolean;
  videoFilter?: string;
  currentRoom?: string;
}

export interface UserPublicInfo {
  id: string;
  name?: string;
  audioEnabled?: boolean;
  videoEnabled?: boolean;
  videoFilter?: string;
}

export interface MediaState {
  audioEnabled?: boolean;
  videoEnabled?: boolean;
  videoFilter?: string;
}

export class UserModel implements User {
  constructor(
    public id: string,
    public socket: WebSocket,
    public name?: string,
    public audioEnabled: boolean = true,
    public videoEnabled: boolean = true,
    public videoFilter: string = 'none',
    public currentRoom?: string
  ) {}

  getPublicInfo(): UserPublicInfo {
    return {
      id: this.id,
      name: this.name,
      audioEnabled: this.audioEnabled,
      videoEnabled: this.videoEnabled,
      videoFilter: this.videoFilter
    };
  }

  updateMediaState(state: MediaState): void {
    if (state.audioEnabled !== undefined) {
      this.audioEnabled = state.audioEnabled;
    }
    if (state.videoEnabled !== undefined) {
      this.videoEnabled = state.videoEnabled;
    }
    if (state.videoFilter !== undefined) {
      this.videoFilter = state.videoFilter;
    }
  }

  isSocketOpen(): boolean {
    return this.socket.readyState === WebSocket.OPEN;
  }
}
export interface User {
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
    public name?: string,
    public audioEnabled: boolean = true,
    public videoEnabled: boolean = true,
    public videoFilter: string = 'none'
  ) {}

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

  getInitials(): string {
    if (!this.name) return 'U';
    return this.name.split(' ').map(word => word[0]).join('').toUpperCase().substring(0, 2);
  }
}
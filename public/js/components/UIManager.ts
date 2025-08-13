import { IUIManager } from '../core/interfaces/IUIManager.js';
import { User } from '../core/models/User.js';
import { Room, RoomInfo } from '../core/models/Room.js';

export class UIManager implements IUIManager {
  private elements: { [key: string]: HTMLElement | null } = {};

  initialize(): void {
    // Cache DOM elements
    this.elements = {
      connectionStatus: document.getElementById('connection-status'),
      errorMessage: document.getElementById('error-message'),
      userList: document.getElementById('user-list'),
      userCount: document.getElementById('user-count'),
      noUsers: document.getElementById('no-users'),
      roomList: document.getElementById('room-list'),
      noRooms: document.getElementById('no-rooms'),
      currentRoom: document.getElementById('current-room'),
      currentRoomName: document.getElementById('current-room-name'),
      currentRoomParticipants: document.getElementById('current-room-participants'),
      videoContainer: document.getElementById('video-container'),
      remoteVideosContainer: document.getElementById('remote-videos-container'),
      localUsername: document.getElementById('local-username'),
      legacyRemoteWrapper: document.getElementById('legacy-remote-wrapper')
    };
  }

  showError(message: string): void {
    const errorEl = this.elements.errorMessage;
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.style.display = 'block';
    }
    console.error(message);
  }

  hideError(): void {
    const errorEl = this.elements.errorMessage;
    if (errorEl) {
      errorEl.style.display = 'none';
    }
  }

  updateConnectionStatus(status: 'connected' | 'disconnected' | 'connecting', message: string): void {
    const statusEl = this.elements.connectionStatus;
    if (statusEl) {
      statusEl.className = `status-compact ${status}`;
      statusEl.innerHTML = message;
    }
  }

  updateUserList(users: User[]): void {
    const userListEl = this.elements.userList;
    const userCountEl = this.elements.userCount;
    const noUsersEl = this.elements.noUsers;

    if (!userListEl || !userCountEl || !noUsersEl) return;

    userListEl.innerHTML = '';
    userCountEl.textContent = users.length.toString();

    if (users.length === 0) {
      noUsersEl.style.display = 'block';
    } else {
      noUsersEl.style.display = 'none';
      users.forEach(user => {
        const li = this.createUserListItem(user);
        userListEl.appendChild(li);
      });
    }
  }

  updateRoomList(rooms: RoomInfo[]): void {
    const roomListEl = this.elements.roomList;
    const noRoomsEl = this.elements.noRooms;

    if (!roomListEl || !noRoomsEl) return;

    roomListEl.innerHTML = '';

    if (rooms.length === 0) {
      noRoomsEl.style.display = 'block';
    } else {
      noRoomsEl.style.display = 'none';
      rooms.forEach(room => {
        const li = this.createRoomListItem(room);
        roomListEl.appendChild(li);
      });
    }
  }

  updateCurrentRoom(room: Room | null): void {
    const currentRoomEl = this.elements.currentRoom;
    const roomNameEl = this.elements.currentRoomName;
    const participantsEl = this.elements.currentRoomParticipants;

    if (!currentRoomEl || !roomNameEl || !participantsEl) return;

    if (room) {
      currentRoomEl.style.display = 'block';
      roomNameEl.textContent = room.name;
      participantsEl.textContent = `${room.participants.length} participant(s)`;
      
      // Add group call styling
      const videoContainer = this.elements.videoContainer;
      if (videoContainer) {
        videoContainer.classList.add('group-call');
      }
    } else {
      currentRoomEl.style.display = 'none';
      
      // Remove group call styling
      const videoContainer = this.elements.videoContainer;
      if (videoContainer) {
        videoContainer.classList.remove('group-call');
      }
    }
  }

  showVideoContainer(): void {
    const videoContainer = this.elements.videoContainer;
    if (videoContainer) {
      videoContainer.style.display = 'grid';
    }
  }

  hideVideoContainer(): void {
    const videoContainer = this.elements.videoContainer;
    if (videoContainer) {
      videoContainer.style.display = 'none';
    }
  }

  addRemoteVideo(userId: string, stream: MediaStream, userName: string): void {
    const remoteContainer = this.elements.remoteVideosContainer;
    if (!remoteContainer) return;

    // Remove existing video for this user
    this.removeRemoteVideo(userId);

    const videoWrapper = document.createElement('div');
    videoWrapper.className = 'video-wrapper';
    videoWrapper.id = `remote-wrapper-${userId}`;

    const video = document.createElement('video');
    video.id = `remote-video-${userId}`;
    video.autoplay = true;
    video.playsInline = true;
    video.srcObject = stream;

    videoWrapper.innerHTML = `
      <h4>👥 ${userName}</h4>
      <div class="username-overlay">${userName}</div>
    `;

    videoWrapper.appendChild(video);
    remoteContainer.appendChild(videoWrapper);
  }

  removeRemoteVideo(userId: string): void {
    const videoWrapper = document.getElementById(`remote-wrapper-${userId}`);
    if (videoWrapper) {
      videoWrapper.remove();
    }

    // Also hide legacy remote video if this was a 1-to-1 call
    const legacyWrapper = this.elements.legacyRemoteWrapper;
    if (legacyWrapper) {
      legacyWrapper.style.display = 'none';
    }
  }

  updateRemoteVideoStatus(userId: string, audioEnabled: boolean, videoEnabled: boolean): void {
    const videoWrapper = document.getElementById(`remote-wrapper-${userId}`);
    if (!videoWrapper) return;

    // Remove existing indicators
    const existingIndicators = videoWrapper.querySelectorAll('.remote-status-indicator');
    existingIndicators.forEach(indicator => indicator.remove());

    // Add new indicators
    const indicators = document.createElement('div');
    indicators.className = 'remote-status-indicator';
    indicators.style.cssText = `
      position: absolute;
      top: 50px;
      right: 15px;
      z-index: 3;
      display: flex;
      flex-direction: column;
      gap: 5px;
    `;

    if (!audioEnabled) {
      const audioIndicator = document.createElement('div');
      audioIndicator.innerHTML = '🔇';
      audioIndicator.style.cssText = `
        background: rgba(244, 67, 54, 0.9);
        color: white;
        padding: 8px;
        border-radius: 50%;
        font-size: 16px;
        backdrop-filter: blur(5px);
      `;
      audioIndicator.title = 'Microphone muted';
      indicators.appendChild(audioIndicator);
    }

    if (!videoEnabled) {
      const videoIndicator = document.createElement('div');
      videoIndicator.innerHTML = '📵';
      videoIndicator.style.cssText = `
        background: rgba(244, 67, 54, 0.9);
        color: white;
        padding: 8px;
        border-radius: 50%;
        font-size: 16px;
        backdrop-filter: blur(5px);
      `;
      videoIndicator.title = 'Camera disabled';
      indicators.appendChild(videoIndicator);
    }

    if (indicators.children.length > 0) {
      videoWrapper.appendChild(indicators);
    }
  }

  setLocalUsername(name: string): void {
    const localUsernameEl = this.elements.localUsername;
    if (localUsernameEl) {
      localUsernameEl.textContent = name;
    }
  }

  private createUserListItem(user: User): HTMLLIElement {
    const li = document.createElement('li');
    li.className = 'user-item';
    li.dataset.userId = user.id;

    const displayName = user.name || 'Anonymous';
    const initials = this.getInitials(displayName);

    li.innerHTML = `
      <div class="user-avatar">${initials}</div>
      <div class="user-info">
        <div class="user-name">${displayName}</div>
        <div class="user-id">ID: ${user.id.substring(0, 8)}...</div>
      </div>
    `;

    // Add media status indicators
    this.addUserMediaStatus(li, user);

    return li;
  }

  private createRoomListItem(room: RoomInfo): HTMLLIElement {
    const li = document.createElement('li');
    li.className = 'room-item';

    li.innerHTML = `
      <div class="room-info">
        <div class="room-details">
          <div class="room-title">${room.name}</div>
          <div class="room-meta">${room.participantCount} participant(s)</div>
        </div>
        <button class="join-btn" data-room-id="${room.id}">Join</button>
      </div>
    `;

    return li;
  }

  private addUserMediaStatus(userItem: HTMLLIElement, user: User): void {
    const userInfo = userItem.querySelector('.user-info');
    if (!userInfo) return;

    const statusDiv = document.createElement('div');
    statusDiv.className = 'user-media-status';
    statusDiv.style.cssText = `
      display: flex;
      gap: 3px;
      font-size: 12px;
    `;

    if (user.audioEnabled === false) {
      const audioIcon = document.createElement('span');
      audioIcon.innerHTML = '🔇';
      audioIcon.title = 'Muted';
      statusDiv.appendChild(audioIcon);
    }

    if (user.videoEnabled === false) {
      const videoIcon = document.createElement('span');
      videoIcon.innerHTML = '📵';
      videoIcon.title = 'Camera off';
      statusDiv.appendChild(videoIcon);
    }

    if (user.videoFilter && user.videoFilter !== 'none') {
      const filterIcon = document.createElement('span');
      filterIcon.innerHTML = '🎨';
      filterIcon.title = 'Filter active';
      statusDiv.appendChild(filterIcon);
    }

    if (statusDiv.children.length > 0) {
      userInfo.appendChild(statusDiv);
    }
  }

  private getInitials(name: string): string {
    return name.split(' ').map(word => word[0]).join('').toUpperCase().substring(0, 2);
  }
}
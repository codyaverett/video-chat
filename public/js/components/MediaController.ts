import { IWebRTCManager } from '../core/interfaces/IWebRTCManager.js';
import { IWebSocketClient } from '../core/interfaces/IWebSocketClient.js';
import { IUIManager } from '../core/interfaces/IUIManager.js';

export class MediaController {
  private webRTCManager: IWebRTCManager;
  private webSocketClient: IWebSocketClient;
  private uiManager: IUIManager;
  private isAudioEnabled = true;
  private isVideoEnabled = true;
  private currentFilter = 'none';

  constructor(
    webRTCManager: IWebRTCManager,
    webSocketClient: IWebSocketClient,
    uiManager: IUIManager
  ) {
    this.webRTCManager = webRTCManager;
    this.webSocketClient = webSocketClient;
    this.uiManager = uiManager;
  }

  initialize(): void {
    this.setupEventListeners();
  }

  async initializeMedia(): Promise<void> {
    try {
      await this.webRTCManager.initializeLocalStream();
      this.uiManager.hideError();
    } catch (error: any) {
      this.uiManager.showError(error.message);
      throw error;
    }
  }

  toggleAudio(): void {
    this.isAudioEnabled = !this.isAudioEnabled;
    this.webRTCManager.enableAudio(this.isAudioEnabled);
    this.updateAudioButtons();
    this.sendMediaStateChange();
  }

  toggleVideo(): void {
    this.isVideoEnabled = !this.isVideoEnabled;
    this.webRTCManager.enableVideo(this.isVideoEnabled);
    this.updateVideoButtons();
    this.sendMediaStateChange();
  }

  applyFilter(filter: string): void {
    this.currentFilter = filter;
    this.webRTCManager.applyVideoFilter(filter);
    this.sendMediaStateChange();
  }

  private setupEventListeners(): void {
    // Audio toggle buttons
    const audioButtons = document.querySelectorAll('#toggle-audio, #local-audio-btn');
    audioButtons.forEach(button => {
      button.addEventListener('click', () => this.toggleAudio());
    });

    // Video toggle buttons
    const videoButtons = document.querySelectorAll('#toggle-video, #local-video-btn');
    videoButtons.forEach(button => {
      button.addEventListener('click', () => this.toggleVideo());
    });

    // Video filter selector
    const filterSelect = document.getElementById('video-filter') as HTMLSelectElement;
    if (filterSelect) {
      filterSelect.addEventListener('change', () => {
        this.applyFilter(filterSelect.value);
      });
    }
  }

  private updateAudioButtons(): void {
    const audioButtons = document.querySelectorAll('#toggle-audio, #local-audio-btn') as NodeListOf<HTMLButtonElement>;
    
    audioButtons.forEach(button => {
      if (this.isAudioEnabled) {
        button.innerHTML = '🎤';
        button.classList.remove('muted');
        button.title = 'Mute Microphone';
      } else {
        button.innerHTML = '🔇';
        button.classList.add('muted');
        button.title = 'Unmute Microphone';
      }
    });
  }

  private updateVideoButtons(): void {
    const videoButtons = document.querySelectorAll('#toggle-video, #local-video-btn') as NodeListOf<HTMLButtonElement>;
    
    videoButtons.forEach(button => {
      if (this.isVideoEnabled) {
        button.innerHTML = '📹';
        button.classList.remove('video-off');
        button.title = 'Turn Off Camera';
      } else {
        button.innerHTML = '📵';
        button.classList.add('video-off');
        button.title = 'Turn On Camera';
      }
    });
  }

  private sendMediaStateChange(): void {
    this.webSocketClient.send({
      type: 'media-state-change',
      audioEnabled: this.isAudioEnabled,
      videoEnabled: this.isVideoEnabled,
      videoFilter: this.currentFilter
    });
  }

  getMediaState() {
    return {
      audioEnabled: this.isAudioEnabled,
      videoEnabled: this.isVideoEnabled,
      videoFilter: this.currentFilter
    };
  }
}
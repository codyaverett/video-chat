// Fetch configuration from server
let socket;

async function initializeConnection() {
  try {
    const response = await fetch('/config');
    const config = await response.json();
    
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.hostname;
    const wsPort = config.wsPort;
    const wsUrl = `${wsProtocol}//${wsHost}:${wsPort}/ws`;
    
    console.log('Connecting to WebSocket:', wsUrl);
    socket = new WebSocket(wsUrl);
    
    setupWebSocketHandlers();
  } catch (error) {
    console.error('Failed to fetch config:', error);
    showError('Failed to get server configuration. Please refresh the page.');
  }
}

// Get DOM elements
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const userList = document.getElementById('user-list');
const connectionStatus = document.getElementById('connection-status');
const errorMessage = document.getElementById('error-message');
const noUsersMessage = document.getElementById('no-users');

// Global variables
let localStream;
let peerConnection;
let currentSocketId = null;
let currentCallTarget = null;
let userDisplayName = null;
let isNameSet = false;
let isAudioEnabled = true;
let isVideoEnabled = true;
let currentCallUserName = null;
let userMediaStates = new Map(); // Store media states for all users

// Utility functions
function showError(message) {
  errorMessage.textContent = message;
  errorMessage.style.display = 'block';
  console.error(message);
}

function hideError() {
  errorMessage.style.display = 'none';
}

function updateConnectionStatus(status, message) {
  connectionStatus.className = `status-compact ${status}`;
  connectionStatus.innerHTML = message;
}

function setupWebSocketHandlers() {
// Only request media if display name is set
if (isNameSet) {
  requestMediaDevices();
}

function requestMediaDevices() {
  // Check if mediaDevices is available (required for HTTPS or localhost)
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    console.error('navigator.mediaDevices not available');
    showError('Camera access requires HTTPS or localhost. Please use https:// or access from localhost.');
    return;
  }

  // Request media devices with better error handling
  navigator.mediaDevices.getUserMedia({ video: true, audio: true })
  .then(stream => {
    localStream = stream;
    localVideo.srcObject = stream;
    hideError();
    console.log('✅ Camera and microphone access granted');
  })
  .catch(error => {
    console.error('Error accessing media devices:', error);
    if (error.name === 'NotAllowedError') {
      showError('Camera/microphone access denied. Please allow access and refresh the page.');
    } else if (error.name === 'NotFoundError') {
      showError('No camera or microphone found. Please connect a camera and refresh.');
    } else if (error.name === 'NotSecureContext') {
      showError('HTTPS required for camera access from remote devices. Use https:// instead of http://');
    } else {
      showError(`Media device error: ${error.message}`);
    }
  });
}

// Request media when name is set
window.requestMediaAfterName = requestMediaDevices;

socket.onopen = () => {
  console.log('WebSocket connected');
  updateConnectionStatus('connected', '✅ Connected to server');
  hideError();
};

socket.onmessage = (event) => {
  const data = JSON.parse(event.data);
  switch (data.type) {
    case 'client-id':
      currentSocketId = data.id;
      console.log('Assigned client ID:', currentSocketId);
      break;
    case 'update-user-list':
      updateUserList(data.users);
      break;
    case 'media-states-update':
      updateMediaStates(data.states);
      break;
    case 'call-made':
      handleCallMade(data);
      break;
    case 'answer-made':
      handleAnswerMade(data);
      break;
    case 'ice-candidate':
      handleIceCandidate(data);
      break;
  }
};

// Add error handling for WebSocket
socket.onerror = (error) => {
  console.error('WebSocket error:', error);
  updateConnectionStatus('disconnected', '❌ Connection error');
  showError('Failed to connect to server. Please check if the server is running.');
};

socket.onclose = () => {
  console.log('WebSocket disconnected');
  updateConnectionStatus('disconnected', '🔌 Disconnected from server');
  showError('Connection to server lost. Please refresh the page to reconnect.');
};

function updateUserList(users) {
  userList.innerHTML = '';
  const userCount = document.getElementById('user-count');
  const noUsersDiv = document.getElementById('no-users');
  
  // Filter out current user
  const otherUsers = users.filter(user => user.id !== currentSocketId);
  
  userCount.textContent = otherUsers.length;
  
  if (otherUsers.length === 0) {
    noUsersDiv.style.display = 'block';
  } else {
    noUsersDiv.style.display = 'none';
    otherUsers.forEach(user => {
      const li = document.createElement('li');
      li.className = 'user-item';
      
      const displayName = user.name || 'Anonymous';
      const initials = getInitials(displayName);
      
      li.innerHTML = `
        <div class="user-avatar">${initials}</div>
        <div class="user-info">
          <div class="user-name">${displayName}</div>
          <div class="user-id">ID: ${user.id.substring(0, 8)}...</div>
        </div>
      `;
      
      // Add user ID as data attribute for state updates
      li.dataset.userId = user.id;
      
      li.addEventListener('click', () => {
        currentCallUserName = user.name;
        callUser(user.id);
      });
      userList.appendChild(li);
    });
  }
}

function createPeerConnection() {
  const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
  const pc = new RTCPeerConnection(config);

  pc.onicecandidate = (event) => {
    if (event.candidate && currentCallTarget) {
      socket.send(JSON.stringify({
        type: 'ice-candidate',
        candidate: event.candidate,
        to: currentCallTarget
      }));
    }
  };

  pc.ontrack = (event) => {
    remoteVideo.srcObject = event.streams[0];
    // Update remote username when call is established
    if (currentCallUserName) {
      updateRemoteUsername(currentCallUserName);
    }
  };

  // Only add tracks if localStream is available
  if (localStream) {
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
  } else {
    console.warn('Local stream not available for peer connection');
  }

  return pc;
}

function callUser(targetId) {
  if (!localStream) {
    showError('Camera/microphone not available. Please allow access and refresh.');
    return;
  }
  
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    showError('Not connected to server. Please refresh the page.');
    return;
  }
  
  console.log('Initiating call to:', targetId);
  currentCallTarget = targetId;
  peerConnection = createPeerConnection();
  
  peerConnection.createOffer()
    .then(offer => peerConnection.setLocalDescription(offer))
    .then(() => {
      console.log('Sending call offer to:', targetId);
      socket.send(JSON.stringify({
        type: 'call-user',
        offer: peerConnection.localDescription,
        to: targetId,
      }));
      hideError();
    })
    .catch(error => {
      console.error('Error creating call offer:', error);
      showError('Failed to initiate call. Please try again.');
    });
}

function handleCallMade(data) {
  if (!localStream) {
    console.error('Cannot answer call: no local stream available');
    showError('Cannot answer call: camera/microphone not available.');
    return;
  }
  
  console.log('Incoming call from:', data.socket);
  currentCallTarget = data.socket;
  currentCallUserName = data.callerName;
  updateRemoteUsername(data.callerName);
  peerConnection = createPeerConnection();
  
  peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer))
    .then(() => peerConnection.createAnswer())
    .then(answer => peerConnection.setLocalDescription(answer))
    .then(() => {
      console.log('Sending answer to:', data.socket);
      socket.send(JSON.stringify({
        type: 'make-answer',
        answer: peerConnection.localDescription,
        to: data.socket,
      }));
      hideError();
    })
    .catch(error => {
      console.error('Error handling incoming call:', error);
      showError('Failed to answer call. Please try again.');
    });
}

function handleAnswerMade(data) {
  if (!peerConnection) {
    console.error('No peer connection available for answer');
    return;
  }
  
  console.log('Received answer from:', data.socket);
  peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer))
    .then(() => {
      console.log('Call established successfully');
      hideError();
    })
    .catch(error => {
      console.error('Error handling answer:', error);
      showError('Failed to establish call connection.');
    });
}

function handleIceCandidate(data) {
  if (!peerConnection) {
    console.error('No peer connection available for ICE candidate');
    return;
  }
  
  console.log('Received ICE candidate from:', data.socket);
  peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate))
    .catch(error => {
      console.error('Error adding ICE candidate:', error);
    });
}

}

// Display name functions
function setDisplayName() {
  const nameInput = document.getElementById('display-name');
  const name = nameInput.value.trim();
  
  if (!name) {
    showError('Please enter a display name');
    return;
  }
  
  if (name.length > 20) {
    showError('Display name must be 20 characters or less');
    return;
  }
  
  userDisplayName = name;
  isNameSet = true;
  
  // Hide name setup and show video container and controls
  document.getElementById('name-setup').style.display = 'none';
  document.getElementById('media-controls').style.display = 'block';
  document.getElementById('video-container').style.display = 'grid';
  
  // Update local username display
  document.getElementById('local-username').textContent = userDisplayName;
  
  // Send displayname to server
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({
      type: 'set-displayname',
      name: userDisplayName
    }));
  }
  
  // Now request media devices
  if (window.requestMediaAfterName) {
    window.requestMediaAfterName();
  }
  
  hideError();
}

// Allow Enter key to set display name
document.addEventListener('DOMContentLoaded', () => {
  const nameInput = document.getElementById('display-name');
  nameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      setDisplayName();
    }
  });
});

function getInitials(name) {
  return name.split(' ').map(word => word[0]).join('').toUpperCase().substring(0, 2);
}

// Media control functions
function toggleAudio() {
  if (localStream) {
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      isAudioEnabled = !isAudioEnabled;
      audioTrack.enabled = isAudioEnabled;
      
      // Update button states
      const toggleBtn = document.getElementById('toggle-audio');
      const localBtn = document.getElementById('local-audio-btn');
      
      if (isAudioEnabled) {
        toggleBtn.innerHTML = '🎤';
        toggleBtn.classList.remove('muted');
        localBtn.innerHTML = '🎤';
        localBtn.classList.remove('muted');
        toggleBtn.title = 'Mute Microphone';
        localBtn.title = 'Mute Microphone';
      } else {
        toggleBtn.innerHTML = '🔇';
        toggleBtn.classList.add('muted');
        localBtn.innerHTML = '🔇';
        localBtn.classList.add('muted');
        toggleBtn.title = 'Unmute Microphone';
        localBtn.title = 'Unmute Microphone';
      }
      
      // Send state change to server
      sendMediaStateChange(isAudioEnabled, undefined, undefined);
    }
  }
}

function toggleVideo() {
  if (localStream) {
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      isVideoEnabled = !isVideoEnabled;
      videoTrack.enabled = isVideoEnabled;
      
      // Update button states
      const toggleBtn = document.getElementById('toggle-video');
      const localBtn = document.getElementById('local-video-btn');
      
      if (isVideoEnabled) {
        toggleBtn.innerHTML = '📹';
        toggleBtn.classList.remove('video-off');
        localBtn.innerHTML = '📹';
        localBtn.classList.remove('video-off');
        toggleBtn.title = 'Turn Off Camera';
        localBtn.title = 'Turn Off Camera';
      } else {
        toggleBtn.innerHTML = '📵';
        toggleBtn.classList.add('video-off');
        localBtn.innerHTML = '📵';
        localBtn.classList.add('video-off');
        toggleBtn.title = 'Turn On Camera';
        localBtn.title = 'Turn On Camera';
      }
      
      // Send state change to server
      sendMediaStateChange(undefined, isVideoEnabled, undefined);
    }
  }
}

function applyFilter() {
  const filterSelect = document.getElementById('video-filter');
  const localVideo = document.getElementById('local-video');
  const selectedFilter = filterSelect.value;
  
  if (selectedFilter === 'none') {
    localVideo.style.filter = '';
  } else {
    localVideo.style.filter = selectedFilter;
  }
  
  // Send filter change to server
  sendMediaStateChange(undefined, undefined, selectedFilter);
}

function updateRemoteUsername(name) {
  const remoteUsernameEl = document.getElementById('remote-username');
  remoteUsernameEl.textContent = name || 'Unknown User';
}

function sendMediaStateChange(audioEnabled, videoEnabled, videoFilter) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    const message = {
      type: 'media-state-change'
    };
    
    if (audioEnabled !== undefined) message.audioEnabled = audioEnabled;
    if (videoEnabled !== undefined) message.videoEnabled = videoEnabled;  
    if (videoFilter !== undefined) message.videoFilter = videoFilter;
    
    socket.send(JSON.stringify(message));
  }
}

function updateMediaStates(states) {
  // Update our local store of media states
  userMediaStates.clear();
  states.forEach(state => {
    userMediaStates.set(state.id, state);
  });
  
  // Update UI for remote user if in a call
  if (currentCallTarget) {
    const remoteState = userMediaStates.get(currentCallTarget);
    if (remoteState) {
      updateRemoteVideoState(remoteState);
    }
  }
  
  // Update user list with media states
  updateUserListWithStates();
}

function updateRemoteVideoState(remoteState) {
  const remoteVideo = document.getElementById('remote-video');
  
  // Apply filter to remote video
  if (remoteState.videoFilter && remoteState.videoFilter !== 'none') {
    remoteVideo.style.filter = remoteState.videoFilter;
  } else {
    remoteVideo.style.filter = '';
  }
  
  // Show audio/video status indicators
  updateRemoteStatusIndicators(remoteState);
}

function updateRemoteStatusIndicators(remoteState) {
  // Add status indicators to remote video wrapper
  const remoteWrapper = document.querySelector('.video-wrapper:has(#remote-video)');
  
  // Remove existing indicators
  const existingIndicators = remoteWrapper.querySelectorAll('.remote-status-indicator');
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
  
  if (!remoteState.audioEnabled) {
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
  
  if (!remoteState.videoEnabled) {
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
  
  remoteWrapper.appendChild(indicators);
}

function updateUserListWithStates() {
  // This will be called to update user list with media state indicators
  const userListItems = document.querySelectorAll('.user-item');
  userListItems.forEach(item => {
    const userId = item.dataset.userId;
    if (userId) {
      const userState = userMediaStates.get(userId);
      if (userState) {
        // Remove existing status indicators
        const existingStatus = item.querySelector('.user-media-status');
        if (existingStatus) existingStatus.remove();
        
        // Add media status indicators
        const statusDiv = document.createElement('div');
        statusDiv.className = 'user-media-status';
        statusDiv.style.cssText = `
          display: flex;
          gap: 3px;
          font-size: 12px;
        `;
        
        if (!userState.audioEnabled) {
          const audioIcon = document.createElement('span');
          audioIcon.innerHTML = '🔇';
          audioIcon.title = 'Muted';
          statusDiv.appendChild(audioIcon);
        }
        
        if (!userState.videoEnabled) {
          const videoIcon = document.createElement('span');
          videoIcon.innerHTML = '📵';
          videoIcon.title = 'Camera off';
          statusDiv.appendChild(videoIcon);
        }
        
        if (userState.videoFilter && userState.videoFilter !== 'none') {
          const filterIcon = document.createElement('span');
          filterIcon.innerHTML = '🎨';
          filterIcon.title = 'Filter active';
          statusDiv.appendChild(filterIcon);
        }
        
        const userInfo = item.querySelector('.user-info');
        if (statusDiv.children.length > 0) {
          userInfo.appendChild(statusDiv);
        }
      }
    }
  });
}

// Initialize the application
initializeConnection();


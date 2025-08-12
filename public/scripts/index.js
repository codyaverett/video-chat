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
  connectionStatus.className = `status ${status}`;
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
      
      li.addEventListener('click', () => callUser(user.id));
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
  
  // Hide name setup and show video container
  document.getElementById('name-setup').style.display = 'none';
  document.getElementById('video-container').style.display = 'grid';
  
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

// Initialize the application
initializeConnection();


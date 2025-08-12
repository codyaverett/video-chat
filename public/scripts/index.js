const socket = new WebSocket('ws://localhost:5001');
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const userList = document.getElementById('user-list');

let localStream;
let peerConnection;
let currentSocketId = null;
let currentCallTarget = null;

socket.onopen = () => console.log('WebSocket connected');

socket.onmessage = (event) => {
  const data = JSON.parse(event.data);
  switch (data.type) {
    case 'client-id':
      currentSocketId = data.id;
      console.log('Assigned client ID:', currentSocketId);
      break;
    case 'update-user-list':
      updateUserList(data.sockets);
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

navigator.mediaDevices.getUserMedia({ video: true, audio: true })
  .then(stream => {
    localStream = stream;
    localVideo.srcObject = stream;
  })
  .catch(error => console.error('Error accessing media devices.', error));

function updateUserList(sockets) {
  userList.innerHTML = '';
  sockets.forEach(id => {
    if (id !== currentSocketId) {
      const li = document.createElement('li');
      li.textContent = `Call ${id}`;
      li.addEventListener('click', () => callUser(id));
      userList.appendChild(li);
    }
  });
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

  localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

  return pc;
}

function callUser(targetId) {
  currentCallTarget = targetId;
  peerConnection = createPeerConnection();
  peerConnection.createOffer()
    .then(offer => peerConnection.setLocalDescription(offer))
    .then(() => {
      socket.send(JSON.stringify({
        type: 'call-user',
        offer: peerConnection.localDescription,
        to: targetId,
      }));
    });
}

function handleCallMade(data) {
  currentCallTarget = data.socket;
  peerConnection = createPeerConnection();
  peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer))
    .then(() => peerConnection.createAnswer())
    .then(answer => peerConnection.setLocalDescription(answer))
    .then(() => {
      socket.send(JSON.stringify({
        type: 'make-answer',
        answer: peerConnection.localDescription,
        to: data.socket,
      }));
    });
}

function handleAnswerMade(data) {
  peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
}

function handleIceCandidate(data) {
  peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
}


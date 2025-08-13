// Test script to simulate WebRTC call flow
const ws1 = new WebSocket('wss://localhost:8001/ws');
const ws2 = new WebSocket('wss://localhost:8001/ws');

let user1Id, user2Id;

ws1.onopen = () => {
  console.log('User 1 connected');
  // Set display name for user 1
  setTimeout(() => {
    ws1.send(JSON.stringify({
      type: 'set-displayname',
      name: 'TestUser1'
    }));
  }, 100);
};

ws2.onopen = () => {
  console.log('User 2 connected');
  // Set display name for user 2
  setTimeout(() => {
    ws2.send(JSON.stringify({
      type: 'set-displayname', 
      name: 'TestUser2'
    }));
  }, 100);
};

ws1.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('User 1 received:', message.type);
  
  if (message.type === 'client-id') {
    user1Id = message.id;
    console.log('User 1 ID:', user1Id);
  }
  
  if (message.type === 'update-user-list' && user2Id) {
    // Initiate call from user 1 to user 2
    console.log('User 1 initiating call to User 2');
    ws1.send(JSON.stringify({
      type: 'call-user',
      offer: {
        type: 'offer',
        sdp: 'fake-sdp-offer'
      },
      to: user2Id
    }));
  }
  
  if (message.type === 'call-made') {
    console.log('✅ Call offer received by User 1');
  }
};

ws2.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('User 2 received:', message.type);
  
  if (message.type === 'client-id') {
    user2Id = message.id;
    console.log('User 2 ID:', user2Id);
  }
  
  if (message.type === 'call-made') {
    console.log('✅ Call offer received by User 2');
    console.log('User 2 sending answer back');
    
    // Send answer back
    ws2.send(JSON.stringify({
      type: 'make-answer',
      answer: {
        type: 'answer',
        sdp: 'fake-sdp-answer'
      },
      to: message.from
    }));
  }
  
  if (message.type === 'answer-made') {
    console.log('✅ Call answer received by User 2');
  }
};

ws1.onerror = ws2.onerror = (error) => {
  console.error('WebSocket error:', error);
};

// Clean up after 10 seconds
setTimeout(() => {
  console.log('Closing connections');
  ws1.close();
  ws2.close();
}, 10000);
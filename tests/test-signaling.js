// Test signaling functionality (offer/answer exchange)
import { assert } from "@std/assert";

console.log('🧪 Testing Signaling (Call/Answer)...');

async function getServerConfig() {
  try {
    const response = await fetch('http://localhost:8001/config');
    return await response.json();
  } catch {
    return { wsPort: 5001, useHTTPS: false };
  }
}

async function testSignaling() {
  return new Promise(async (resolve, reject) => {
    const config = await getServerConfig();
    const wsUrl = `ws://localhost:${config.wsPort}`;
    const client1 = new WebSocket(wsUrl);
    const client2 = new WebSocket(wsUrl);
    
    let client1Id = null;
    let client2Id = null;
    let callMade = false;
    let answerReceived = false;
    
    const timeout = setTimeout(() => {
      client1.close();
      client2.close();
      reject(new Error('Signaling test timed out'));
    }, 10000);
    
    function checkCompletion() {
      if (callMade && answerReceived) {
        clearTimeout(timeout);
        client1.close();
        client2.close();
        resolve();
      }
    }
    
    function initiateCall() {
      if (client1Id && client2Id) {
        console.log('🔔 Client 1 calling Client 2...');
        setTimeout(() => {
          client1.send(JSON.stringify({
            type: 'call-user',
            offer: { type: 'offer', sdp: 'mock-offer-sdp-12345' },
            to: client2Id
          }));
        }, 500);
      }
    }
    
    client1.onopen = () => console.log('✅ Client 1 connected');
    client2.onopen = () => console.log('✅ Client 2 connected');
    
    client1.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      if (message.type === 'client-id') {
        client1Id = message.id;
        console.log('✅ Client 1 ID:', client1Id);
        initiateCall();
      }
      
      if (message.type === 'answer-made') {
        answerReceived = true;
        console.log('✅ Client 1 received answer from:', message.socket);
        assert(message.socket === client2Id, 'Answer should come from client 2');
        assert(message.answer.type === 'answer', 'Message should contain answer');
        checkCompletion();
      }
    };
    
    client2.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      if (message.type === 'client-id') {
        client2Id = message.id;
        console.log('✅ Client 2 ID:', client2Id);
        initiateCall();
      }
      
      if (message.type === 'call-made') {
        callMade = true;
        console.log('✅ Client 2 received call from:', message.socket);
        assert(message.socket === client1Id, 'Call should come from client 1');
        assert(message.offer.type === 'offer', 'Message should contain offer');
        
        console.log('📞 Client 2 sending answer...');
        client2.send(JSON.stringify({
          type: 'make-answer',
          answer: { type: 'answer', sdp: 'mock-answer-sdp-67890' },
          to: message.socket
        }));
        checkCompletion();
      }
    };
    
    client1.onerror = (error) => {
      clearTimeout(timeout);
      reject(error);
    };
    
    client2.onerror = (error) => {
      clearTimeout(timeout);
      reject(error);
    };
  });
}

try {
  await testSignaling();
  console.log('✅ Signaling test passed!');
} catch (error) {
  console.error('❌ Signaling test failed:', error.message);
  Deno.exit(1);
}
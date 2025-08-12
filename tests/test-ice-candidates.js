// Test ICE candidate exchange functionality
import { assert } from "@std/assert";

console.log('🧪 Testing ICE Candidate Exchange...');

async function getServerConfig() {
  try {
    const response = await fetch('http://localhost:8001/config');
    return await response.json();
  } catch {
    return { wsPort: 5001, useHTTPS: false };
  }
}

async function testIceCandidates() {
  return new Promise(async (resolve, reject) => {
    const config = await getServerConfig();
    const wsUrl = `ws://localhost:${config.wsPort}`;
    const client1 = new WebSocket(wsUrl);
    const client2 = new WebSocket(wsUrl);
    
    let client1Id = null;
    let client2Id = null;
    let client1ReceivedCandidate = false;
    let client2ReceivedCandidate = false;
    
    const timeout = setTimeout(() => {
      client1.close();
      client2.close();
      reject(new Error('ICE candidate test timed out'));
    }, 10000);
    
    function checkCompletion() {
      if (client1ReceivedCandidate && client2ReceivedCandidate) {
        clearTimeout(timeout);
        client1.close();
        client2.close();
        resolve();
      }
    }
    
    function startIceExchange() {
      if (client1Id && client2Id) {
        console.log('🧊 Client 1 sending ICE candidate...');
        setTimeout(() => {
          client1.send(JSON.stringify({
            type: 'ice-candidate',
            candidate: { 
              candidate: 'candidate:1 1 UDP 2113667326 192.168.1.100 54400 typ host',
              sdpMid: '0',
              sdpMLineIndex: 0
            },
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
        startIceExchange();
      }
      
      if (message.type === 'ice-candidate') {
        client1ReceivedCandidate = true;
        console.log('✅ Client 1 received ICE candidate from:', message.socket);
        assert(message.socket === client2Id, 'ICE candidate should come from client 2');
        assert(message.candidate.candidate.includes('typ host'), 'Should contain valid ICE candidate');
        checkCompletion();
      }
    };
    
    client2.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      if (message.type === 'client-id') {
        client2Id = message.id;
        console.log('✅ Client 2 ID:', client2Id);
        startIceExchange();
      }
      
      if (message.type === 'ice-candidate') {
        client2ReceivedCandidate = true;
        console.log('✅ Client 2 received ICE candidate from:', message.socket);
        assert(message.socket === client1Id, 'ICE candidate should come from client 1');
        assert(message.candidate.candidate.includes('typ host'), 'Should contain valid ICE candidate');
        
        console.log('🧊 Client 2 sending ICE candidate back...');
        client2.send(JSON.stringify({
          type: 'ice-candidate',
          candidate: { 
            candidate: 'candidate:2 1 UDP 2113667327 192.168.1.101 54401 typ host',
            sdpMid: '0',
            sdpMLineIndex: 0
          },
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
  await testIceCandidates();
  console.log('✅ ICE candidate test passed!');
} catch (error) {
  console.error('❌ ICE candidate test failed:', error.message);
  Deno.exit(1);
}
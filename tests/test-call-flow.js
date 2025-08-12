// Test the complete call flow including UI interaction simulation
import { assert } from "@std/assert";

console.log('🧪 Testing Complete Call Flow...');

async function getServerConfig() {
  try {
    const response = await fetch('http://localhost:8001/config');
    return await response.json();
  } catch {
    return { wsPort: 5001, useHTTPS: false };
  }
}

async function testCallFlow() {
  return new Promise(async (resolve, reject) => {
    const config = await getServerConfig();
    const wsUrl = `ws://localhost:${config.wsPort}`;
    
    const client1 = new WebSocket(wsUrl);
    const client2 = new WebSocket(wsUrl);
    
    let client1Id = null;
    let client2Id = null;
    let callInitiated = false;
    let callAnswered = false;
    let iceExchanged = false;
    
    const timeout = setTimeout(() => {
      client1.close();
      client2.close();
      reject(new Error('Call flow test timed out'));
    }, 15000);
    
    function checkCompletion() {
      if (callInitiated && callAnswered && iceExchanged) {
        clearTimeout(timeout);
        client1.close();
        client2.close();
        resolve();
      }
    }
    
    function initiateCallFlow() {
      if (client1Id && client2Id) {
        console.log('🔔 Starting complete call flow...');
        setTimeout(() => {
          // Simulate the full WebRTC call flow
          console.log('📞 Client 1 creating offer...');
          client1.send(JSON.stringify({
            type: 'call-user',
            offer: { 
              type: 'offer', 
              sdp: 'v=0\r\no=- 123456 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=group:BUNDLE 0\r\na=msid-semantic: WMS\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\nc=IN IP4 0.0.0.0\r\na=rtcp:9 IN IP4 0.0.0.0\r\na=ice-ufrag:test\r\na=ice-pwd:test\r\na=fingerprint:sha-256 test\r\na=setup:actpass\r\na=mid:0\r\na=sendrecv\r\na=rtcp-mux\r\na=rtpmap:96 VP8/90000\r\n'
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
        initiateCallFlow();
      }
      
      if (message.type === 'answer-made') {
        callAnswered = true;
        console.log('✅ Client 1 received answer - call established!');
        assert(message.socket === client2Id, 'Answer should come from client 2');
        
        // Send ICE candidate
        console.log('🧊 Client 1 sending ICE candidate...');
        client1.send(JSON.stringify({
          type: 'ice-candidate',
          candidate: {
            candidate: 'candidate:1 1 UDP 2113667326 192.168.1.100 54400 typ host',
            sdpMid: '0',
            sdpMLineIndex: 0
          },
          to: client2Id
        }));
        checkCompletion();
      }
      
      if (message.type === 'ice-candidate') {
        iceExchanged = true;
        console.log('✅ Client 1 received ICE candidate - connection complete!');
        checkCompletion();
      }
    };
    
    client2.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      if (message.type === 'client-id') {
        client2Id = message.id;
        console.log('✅ Client 2 ID:', client2Id);
        initiateCallFlow();
      }
      
      if (message.type === 'call-made') {
        callInitiated = true;
        console.log('✅ Client 2 received call - sending answer...');
        assert(message.socket === client1Id, 'Call should come from client 1');
        assert(message.offer.type === 'offer', 'Should receive valid offer');
        
        // Send answer
        client2.send(JSON.stringify({
          type: 'make-answer',
          answer: { 
            type: 'answer', 
            sdp: 'v=0\r\no=- 654321 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=group:BUNDLE 0\r\na=msid-semantic: WMS\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\nc=IN IP4 0.0.0.0\r\na=rtcp:9 IN IP4 0.0.0.0\r\na=ice-ufrag:test2\r\na=ice-pwd:test2\r\na=fingerprint:sha-256 test2\r\na=setup:active\r\na=mid:0\r\na=sendrecv\r\na=rtcp-mux\r\na=rtpmap:96 VP8/90000\r\n'
          },
          to: message.socket
        }));
        checkCompletion();
      }
      
      if (message.type === 'ice-candidate') {
        console.log('✅ Client 2 received ICE candidate - sending response...');
        // Send ICE candidate back
        client2.send(JSON.stringify({
          type: 'ice-candidate',
          candidate: {
            candidate: 'candidate:2 1 UDP 2113667327 192.168.1.101 54401 typ host',
            sdpMid: '0',
            sdpMLineIndex: 0
          },
          to: message.socket
        }));
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
  await testCallFlow();
  console.log('✅ Complete call flow test passed!');
} catch (error) {
  console.error('❌ Call flow test failed:', error.message);
  Deno.exit(1);
}
// Test WebSocket connection functionality
import { assert } from "@std/assert";

console.log('🧪 Testing WebSocket Connection...');

async function getServerConfig() {
  try {
    const response = await fetch('http://localhost:8001/config');
    return await response.json();
  } catch {
    // Fallback to default config
    return { wsPort: 5001, useHTTPS: false };
  }
}

async function testConnection() {
  return new Promise(async (resolve, reject) => {
    const config = await getServerConfig();
    const wsUrl = `ws://localhost:${config.wsPort}`;
    const ws = new WebSocket(wsUrl);
    let clientId = null;
    let receivedUserList = false;
    
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('Connection test timed out'));
    }, 5000);
    
    ws.onopen = () => {
      console.log('✅ WebSocket connected successfully');
    };
    
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      console.log('📨 Received:', message.type);
      
      if (message.type === 'client-id') {
        clientId = message.id;
        console.log('✅ Client ID assigned:', clientId);
        assert(typeof clientId === 'string', 'Client ID should be a string');
        assert(clientId.length > 0, 'Client ID should not be empty');
      }
      
      if (message.type === 'update-user-list') {
        receivedUserList = true;
        console.log('✅ User list received:', message.sockets);
        assert(Array.isArray(message.sockets), 'User list should be an array');
        assert(message.sockets.includes(clientId), 'User list should include own client ID');
        
        if (clientId && receivedUserList) {
          clearTimeout(timeout);
          ws.close();
          resolve();
        }
      }
    };
    
    ws.onerror = (error) => {
      clearTimeout(timeout);
      reject(error);
    };
    
    ws.onclose = () => {
      console.log('🔌 WebSocket disconnected');
    };
  });
}

try {
  await testConnection();
  console.log('✅ Connection test passed!');
} catch (error) {
  console.error('❌ Connection test failed:', error.message);
  Deno.exit(1);
}
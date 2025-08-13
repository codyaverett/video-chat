#!/usr/bin/env node

/**
 * Test script to verify anonymous user prevention and authentication flow
 */

import WebSocket from 'ws';

// Disable SSL certificate validation for self-signed certificate
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

class AuthTest {
  constructor() {
    this.results = [];
  }

  log(message) {
    console.log(`[AUTH TEST] ${message}`);
    this.results.push(message);
  }

  async testAnonymousUserPrevention() {
    this.log('🧪 Testing anonymous user prevention...');
    
    return new Promise((resolve) => {
      const ws = new WebSocket('wss://localhost:8001/ws');
      let clientId = null;
      let requireDisplayNameReceived = false;
      
      ws.on('open', () => {
        this.log('✅ WebSocket connected');
      });

      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        this.log(`📨 Received: ${JSON.stringify(message)}`);

        switch (message.type) {
          case 'client-id':
            clientId = message.id;
            if (message.requireDisplayName) {
              requireDisplayNameReceived = true;
              this.log('✅ Server correctly requires display name');
              
              // Try to perform action without authentication
              this.log('🔒 Attempting action without authentication...');
              ws.send(JSON.stringify({
                type: 'create-room',
                roomName: 'Test Room'
              }));
            }
            break;

          case 'authentication-required':
            this.log('✅ Server correctly blocked unauthenticated action');
            
            // Try with anonymous name
            this.log('🚫 Trying with anonymous display name...');
            ws.send(JSON.stringify({
              type: 'set-displayname',
              name: 'Anonymous'
            }));
            break;

          case 'display-name-rejected':
            this.log('✅ Server correctly rejected anonymous name');
            
            // Try with valid name
            this.log('✅ Trying with valid display name...');
            ws.send(JSON.stringify({
              type: 'set-displayname',
              name: 'ValidUser123'
            }));
            break;

          case 'display-name-accepted':
            this.log('✅ Server accepted valid display name');
            
            // Now try the same action that was blocked before
            this.log('🔓 Attempting action after authentication...');
            ws.send(JSON.stringify({
              type: 'create-room',
              roomName: 'Test Room'
            }));
            break;

          case 'room-created':
            this.log('✅ Server allowed action after authentication');
            ws.close();
            resolve({
              passed: requireDisplayNameReceived,
              clientId: clientId
            });
            break;
        }
      });

      ws.on('error', (error) => {
        this.log(`❌ WebSocket error: ${error.message}`);
        resolve({ passed: false, error: error.message });
      });

      ws.on('close', () => {
        this.log('🔌 WebSocket closed');
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        ws.close();
        resolve({ passed: false, error: 'Test timeout' });
      }, 10000);
    });
  }

  async testMultipleConnections() {
    this.log('🧪 Testing multiple simultaneous connections...');
    
    const connections = [];
    const promises = [];

    for (let i = 0; i < 3; i++) {
      const promise = new Promise((resolve) => {
        const ws = new WebSocket('wss://localhost:8001/ws');
        let authenticated = false;

        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          
          if (message.type === 'client-id' && message.requireDisplayName) {
            // Send valid display name
            ws.send(JSON.stringify({
              type: 'set-displayname',
              name: `TestUser${i}`
            }));
          } else if (message.type === 'display-name-accepted') {
            authenticated = true;
            ws.close();
            resolve({ authenticated, userId: i });
          }
        });

        connections.push(ws);
      });

      promises.push(promise);
    }

    const results = await Promise.all(promises);
    const authenticatedCount = results.filter(r => r.authenticated).length;
    
    this.log(`✅ ${authenticatedCount}/3 connections authenticated successfully`);
    return { passed: authenticatedCount === 3 };
  }

  async runTests() {
    this.log('🚀 Starting authentication tests...');
    
    try {
      const test1 = await this.testAnonymousUserPrevention();
      const test2 = await this.testMultipleConnections();

      this.log('\n📊 Test Results:');
      this.log(`Anonymous prevention test: ${test1.passed ? '✅ PASSED' : '❌ FAILED'}`);
      this.log(`Multiple connections test: ${test2.passed ? '✅ PASSED' : '❌ FAILED'}`);

      const allPassed = test1.passed && test2.passed;
      this.log(`\n🏆 Overall result: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
      
      process.exit(allPassed ? 0 : 1);
    } catch (error) {
      this.log(`❌ Test failed with error: ${error.message}`);
      process.exit(1);
    }
  }
}

const test = new AuthTest();
test.runTests().catch(console.error);
# Video Chat Tests

This directory contains automated tests for the video chat application.

## Available Tests

### Individual Tests
- `deno task test:connection` - Tests WebSocket connection and client ID assignment
- `deno task test:signaling` - Tests call/answer signaling between clients  
- `deno task test:ice` - Tests ICE candidate exchange

### Run All Tests
- `deno task test` - Runs all tests sequentially with summary

## Test Structure

- **test-connection.js** - Verifies basic WebSocket connectivity and user list updates
- **test-signaling.js** - Tests offer/answer exchange for call establishment
- **test-ice-candidates.js** - Tests ICE candidate relay between peers
- **run-all-tests.js** - Test runner that executes all tests and provides summary

## Prerequisites

The server must be running before executing tests:
```bash
deno task dev
```

## Test Coverage

✅ WebSocket connection establishment  
✅ Client ID assignment and tracking  
✅ User list broadcasting  
✅ Call initiation (offer) signaling  
✅ Call response (answer) signaling  
✅ ICE candidate exchange  
✅ Multiple client handling  
✅ Connection cleanup
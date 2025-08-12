# Video Chat Application

A peer-to-peer video chat application built with WebRTC and WebSockets, powered by Deno.

## Features

✅ **Real-time video chat** between multiple users  
✅ **Peer-to-peer connection** using WebRTC  
✅ **Signaling server** for connection establishment  
✅ **Network access** - works across local network  
✅ **HTTPS support** with self-signed certificates  
✅ **Dynamic configuration** with environment variables  
✅ **Comprehensive tests** for all functionality  
✅ **Modern UI** with connection status and error handling  

## Quick Start

### 1. Start the Server
```bash
deno task dev
```

### 2. Access the Application
- **Local:** http://localhost:8001
- **Network:** Check console output for your network IP

### 3. Connect Multiple Clients
Open the URL on different devices/browsers on your local network. Users will appear in the user list, click to initiate a video call.

## Network Access Setup

### For Local Network (HTTP)
The server now binds to all network interfaces (`0.0.0.0`), so other devices on your local network can connect using your computer's IP address.

### For Remote Access (HTTPS Required)
Modern browsers require HTTPS for camera/microphone access from remote origins:

1. Generate SSL certificates:
   ```bash
   deno task cert
   ```

2. Start server (automatically detects certificates):
   ```bash
   deno task dev
   ```

3. Accept the self-signed certificate warning in your browser

## Configuration

### Environment Variables
- `HTTP_PORT` - HTTP server port (default: 8001)
- `WS_PORT` - WebSocket server port (default: 5001)  
- `HOSTNAME` - Server hostname (default: 0.0.0.0)

### Available Commands
- `deno task dev` - Start development server
- `deno task dev:custom` - Start with custom ports (3000/3001)
- `deno task stop` - Stop any running deno servers
- `deno task cert` - Generate SSL certificates
- `deno task test` - Run all tests
- `deno task test:connection` - Test WebSocket connectivity
- `deno task test:signaling` - Test call signaling
- `deno task test:ice` - Test ICE candidate exchange

## Architecture

### Server Components
- **HTTP Server** - Serves web assets and configuration
- **WebSocket Server** - Handles real-time signaling
- **Signaling Logic** - Manages offer/answer/ICE candidate exchange

### Client Components
- **WebRTC** - Peer-to-peer video/audio connection
- **Media Capture** - Camera and microphone access
- **UI** - Connection status, user list, error handling

### Network Flow
1. Client connects to WebSocket server
2. Server assigns unique client ID
3. Server broadcasts user list to all clients
4. User clicks to call another user
5. WebRTC offer/answer exchange via signaling server
6. ICE candidates exchanged for direct connection
7. Direct peer-to-peer video/audio stream established

## Troubleshooting

### Camera/Microphone Not Working
- **Local access (localhost):** Should work with HTTP
- **Remote access:** Requires HTTPS - run `deno task cert` first
- **Permission denied:** Allow camera/microphone access in browser
- **No devices found:** Check camera/microphone are connected

### Connection Issues
- **Can't connect to server:** Verify server is running with `deno task dev`
- **Network access blocked:** Check firewall settings for ports 8001/5001
- **HTTPS certificate issues:** Accept the self-signed certificate warning

### Video Call Issues
- **No remote video:** Both users need camera access
- **Connection fails:** May need TURN server for restrictive networks
- **Audio echo:** Use headphones or ensure one side is muted

## Development

### Project Structure
```
├── server.ts              # Main server application
├── public/
│   ├── index.html         # Web interface
│   └── scripts/
│       └── index.js       # Client-side WebRTC logic
├── tests/                 # Automated tests
├── certs/                 # SSL certificates (generated)
└── deno.json             # Deno configuration and tasks
```

### Testing
All functionality is covered by automated tests:
```bash
deno task test
```

Individual test suites can be run separately to isolate issues.

## Browser Compatibility

- ✅ Chrome/Chromium (Desktop & Mobile)
- ✅ Firefox (Desktop & Mobile) 
- ✅ Safari (Desktop & Mobile)
- ✅ Edge (Desktop)

## Security Notes

- Self-signed certificates will show browser warnings
- For production use, obtain proper SSL certificates
- WebRTC provides end-to-end encryption for video/audio
- Signaling server only handles connection establishment
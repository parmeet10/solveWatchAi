# Port Configuration Guide

## Overview

This document explains which ports are used and how to connect to the system.

---

## Ports Summary

| Service         | Port | Protocol  | Access                                        |
| --------------- | ---- | --------- | --------------------------------------------- |
| **Frontend**    | 3000 | HTTPS\*   | Browser UI                                    |
|                 |      |           | \*HTTPS if certificates exist, otherwise HTTP |
| **Backend API** | 4000 | HTTP      | REST API                                      |
| **WebSocket**   | 4000 | WebSocket | Text Stream & Data Updates                    |

---

## Frontend Access

### Local Access

```
http://localhost:3000
```

### Network Access (from other devices)

```
http://YOUR_IP_ADDRESS:3000
```

**To find your IP address:**

- **macOS/Linux:** `ifconfig | grep "inet " | grep -v 127.0.0.1`
- **Windows:** `ipconfig`

### HTTPS Access (if certificates are configured)

```
https://YOUR_IP_ADDRESS:3000
```

---

## WebSocket Connections

### Text Stream (Mobile App)

**For mobile apps sending text chunks:**

**HTTP (Development):**

```
ws://YOUR_IP_ADDRESS:4000/text-stream
ws://localhost:4000/text-stream
```

**HTTPS (Production/Mobile):**

```
wss://YOUR_IP_ADDRESS:8443/text-stream
```

**Socket.io Namespace:** `/text-stream`

**Events:**

- Client → Server: `text_chunk`
- Server → Client: `session_started`, `questions_extracted`, `error`

### Data Updates (Frontend)

**For real-time UI updates:**

```
ws://YOUR_IP_ADDRESS:4000/data-updates
```

**Socket.io Namespace:** `/data-updates`

**Events:**

- Server → Client: `data_update`

---

## Backend API

### HTTP API

```
http://YOUR_IP_ADDRESS:4000/api
```

### HTTPS API (if configured)

```
https://YOUR_IP_ADDRESS:8443/api
```

### API Endpoints

**Question Processing:**

- `POST /api/question/process` - Process latest question
- `GET /api/question/latest-session` - Get latest session
- `GET /api/question/:sessionId` - Get questions for session

**Other:**

- `POST /api/upload` - Upload image
- `POST /api/clipboard` - Process clipboard
- `GET /api/data` - Get all processed data
- `POST /api/config/keys` - Configure API keys

---

## Connection Examples

### Mobile App (React Native / Flutter)

```javascript
// Using socket.io-client
import io from 'socket.io-client';

const socket = io('ws://192.168.1.100:4000/text-stream', {
  transports: ['websocket'],
});

socket.on('session_started', (data) => {
  console.log('Session ID:', data.sessionId);
});

socket.emit('text_chunk', {
  text: 'what is react hooks',
  timestamp: Date.now(),
});
```

### Frontend (Browser)

```javascript
// Data updates WebSocket (auto-connected by frontend)
const socket = io('http://localhost:4000/data-updates');

socket.on('data_update', (data) => {
  console.log('New data:', data);
});
```

---

## Network Configuration

### Same Network Required

For mobile devices to connect:

1. **Backend server** and **mobile device** must be on the same WiFi network
2. Use your computer's local IP address (not localhost)
3. Ensure firewall allows connections on ports 3000, 4000, and 8443

### Firewall Rules

**macOS:**

```bash
# Allow incoming connections (if needed)
sudo pfctl -d  # Temporarily disable firewall for testing
```

**Linux:**

```bash
# Ubuntu/Debian
sudo ufw allow 3000
sudo ufw allow 4000
sudo ufw allow 8443
```

**Windows:**

- Windows Defender Firewall → Allow an app → Add Node.js

---

## Troubleshooting

### Can't Connect from Mobile

1. **Check IP Address:**

   ```bash
   ifconfig  # macOS/Linux
   ipconfig  # Windows
   ```

   Look for IP starting with `192.168.x.x` or `10.x.x.x`

2. **Check Server is Running:**

   - Backend: `npm run dev`
   - Frontend: `npm run dev:frontend`

3. **Check Ports are Accessible:**

   ```bash
   # Check if ports are listening
   lsof -i :4000  # macOS/Linux
   netstat -an | findstr :4000  # Windows
   ```

4. **Test Connection:**
   ```bash
   # From mobile device browser
   http://YOUR_IP:3000
   ```

### WebSocket Connection Fails

1. **Check Socket.io Namespace:**

   - Use `/text-stream` for mobile text chunks
   - Use `/data-updates` for frontend updates

2. **Check Transport:**

   - Ensure `transports: ['websocket']` in client config

3. **Check CORS:**

   - Backend allows all origins by default (`origin: '*'`)

4. **Check HTTPS:**
   - Use `wss://` for secure WebSocket connections
   - Use `ws://` for HTTP connections

---

## Quick Reference

**Frontend:** Port 3000 (HTTP/HTTPS)
**Backend API:** Port 4000 (HTTP) or 8443 (HTTPS)
**WebSocket:** Same port as backend (4000 or 8443)
**Namespace:** `/text-stream` (mobile) or `/data-updates` (frontend)

**Mobile WebSocket URL:**

```
ws://YOUR_IP:4000/text-stream
```

**Frontend URL:**

```
http://YOUR_IP:3000
```

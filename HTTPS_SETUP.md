# HTTPS Setup Complete! 🔒

## Certificates Generated

✅ `cert.pem` and `key.pem` have been created in the project root.

## How to Access from Your Phone

1. **Make sure your frontend dev server is running:**

   ```bash
   cd frontend && npm run dev
   ```

2. **Access from your phone:**

   - Open your phone's browser
   - Go to: `https://192.168.178.46:3000`
   - You'll see a security warning (this is normal for self-signed certificates)
   - Click "Advanced" → "Proceed anyway" (or similar)
   - The app should now load over HTTPS

3. **For Live Transcription:**
   - Once on HTTPS, the microphone access should work
   - Click "Start Recording" and grant microphone permissions
   - The WebSocket connection will work through the Vite proxy

## Notes

- The certificates are self-signed, so browsers will show a security warning
- This is safe for local development - just proceed through the warning
- Both frontend (port 3000) and backend (port 4000) are accessible
- The frontend proxies WebSocket connections to the backend automatically

## Troubleshooting

### HTTPS Warning Issues:

1. Make sure you're using `https://` not `http://`
2. Check that the Vite dev server shows "HTTPS certificates found" in the console
3. Try clearing your browser cache
4. Make sure both devices are on the same WiFi network

### Audio Connection Issues (Can't connect audio from phone):

If you can't connect audio from your phone:

1. **Verify Backend is Running:**

   ```bash
   # Make sure backend is running on port 4000
   npm run dev
   # Or
   cd backend && npm start
   ```

2. **Check WebSocket Connection:**

   - Open browser console on your phone (if possible) or check the frontend console
   - Look for WebSocket connection errors
   - The connection should show: `[WebSocket] Connected`
   - If you see connection errors, check:
     - Backend server is running on port 4000
     - Both devices are on the same WiFi network
     - Firewall isn't blocking port 4000

3. **Verify Microphone Permissions:**

   - Make sure you're accessing via `https://` (not `http://`)
   - Grant microphone permissions when prompted
   - On iOS Safari: Settings → Safari → Camera/Microphone → Allow
   - On Android Chrome: Settings → Site Settings → Microphone → Allow

4. **Check Network Connectivity:**

   - Verify phone can reach `https://192.168.178.46:3000` (page loads)
   - Test if backend is accessible: Try `http://192.168.178.46:4000/api/health` (if endpoint exists)
   - Make sure both devices are on the same WiFi network (not mobile data)

5. **Browser Console Errors:**

   - Open browser developer tools (if possible on phone)
   - Or check the frontend terminal for proxy errors
   - Look for:
     - WebSocket connection errors
     - CORS errors
     - Microphone permission errors
     - Proxy errors

6. **Common Issues:**

   - **"Not connected to server"**: Backend not running or not accessible
   - **"Microphone access denied"**: Not using HTTPS or permissions not granted
   - **"WebSocket connection failed"**: Proxy issue or backend not running
   - **"Mixed content"**: Some browsers block HTTPS → HTTP connections (should be handled by proxy)

7. **Test Steps:**
   - ✅ Page loads on phone via HTTPS
   - ✅ See "Connected" status (green dot) in the UI
   - ✅ Can click "Start Recording" button
   - ✅ Microphone permission prompt appears
   - ✅ After granting permission, see "Recording..." status
   - ✅ WebSocket shows "Stream started" in console

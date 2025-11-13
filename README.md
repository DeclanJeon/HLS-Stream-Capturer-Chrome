# HLS Stream Capturer Chrome Extension

A Chrome extension that captures HLS streaming URLs and sends them to a proxy server.

## Features

- 🎬 Automatic detection of HLS/DASH stream URLs
- 🔄 Send URLs to proxy server
- 📋 Copy URLs to clipboard
- 🔗 Open URLs directly
- 📊 Manage captured stream list

## Installation

### 1. Load Extension

1. Open `chrome://extensions/` in Chrome browser
2. Enable "Developer mode" in the top right
3. Click "Load unpacked extension"
4. Select the project folder (`hls-stream-capturer`)

### 2. Prepare Proxy Server (Required)

**Important:** The proxy server must be running to use the extension.

1. Navigate to the proxy server directory:
```bash
cd /path/to/proxy-server
```

2. Start the server:
```bash
npm start
```

3. When the server is running successfully, you should see:
```
🚀 Server running: http://localhost:3500
```

4. Visit `http://localhost:3500` in your browser to verify the server is working

**Troubleshooting:**
- If the proxy button fails, check if the server is running
- Check if port 3500 is being used by another program
- Check if firewall is blocking localhost:3500 access

## Usage

### 1. Enable Capture

1. Click the extension icon
2. Enable the "Start Capture" toggle

### 2. Visit Streaming Sites

1. Visit streaming sites (e.g., YouTube, Netflix, etc.)
2. M3U8 URLs will be automatically captured

### 3. Manage Captured Streams

1. View the captured stream list in the popup
2. For each stream, you can:
   - 📋 **Copy**: Copy URL to clipboard
   - 🔄 **Proxy**: Send URL to proxy server
   - 🔗 **Open**: Open URL in new tab

## File Structure

```
hls-stream-capturer/
├── manifest.json          # Extension configuration
├── background.js          # Background script (network monitoring)
├── popup.html            # Popup UI
├── popup.js              # Popup logic
├── content.js            # Script injected into web pages
├── styles.css            # Styles
├── icon-generator.js     # Icon generation script
├── package.json          # Node.js package configuration
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## Supported Stream Types

- **Master M3U8**: Main playlist file
- **Variant M3U8**: Variant playlist file
- **TS Segment**: MPEG-TS segment
- **M4S Segment**: MPEG-4 segment
- **DASH Manifest**: DASH manifest
- **Cloudflare Workers**: CF Workers stream

## Advanced Features

### Automatic Proxy Sending

Master M3U8 URLs can be automatically sent to the proxy server when detected.

### Filtering Feature

You can filter to view only specific types of streams.

### Export Feature

Captured stream list can be exported as a JSON file.

## Troubleshooting

### Proxy Server Connection Failed

**When you see "❌ Proxy server connection failed" message:**

1. **Check server running:**
   ```bash
   # Run in proxy server directory
   npm start
   ```
   You should see:
   ```
   🚀 Server running: http://localhost:3500
   ```

2. **Check port:**
   ```bash
   # Check if port 3500 is in use
   lsof -i :3500
   # or
   netstat -an | grep 3500
   ```

3. **Test server access:**
   Visit `http://localhost:3500` in your browser to check if the server responds

4. **Check firewall:**
   Make sure local firewall is not blocking localhost:3500 access

### Streams Not Being Captured

1. **Check capture toggle:**
   - Make sure "Start Capture" is enabled in the extension popup

2. **Refresh page:**
   - Refresh the streaming page after enabling capture

3. **Check developer tools:**
   - Open developer tools with F12 key
   - Check if there are .m3u8 file requests in the Network tab

4. **Check supported sites:**
   - Verify if the site uses HLS streaming
   - Most streaming sites like YouTube, Netflix, Vimeo are supported

### Extension Errors

1. **Check permissions:**
   - Verify extension permissions are correctly set in chrome://extensions/

2. **Reload:**
   - Click the "Refresh" button on the extensions page

3. **Check console errors:**
   - Open the popup and open developer tools with F12 key
   - Check for error messages in the Console tab

### Common Error Solutions

**"Uncaught TypeError: Failed to execute 'observe' on 'MutationObserver'" error:**
- This error is temporary and does not affect extension functionality
- It resolves automatically when you refresh the page

**"Failed to fetch" error:**
- Check if the proxy server is running
- Test http://localhost:3500 access
- Check firewall settings

## Developer Information

This extension is developed using Chrome Manifest V3.

### Permissions

- `webRequest`: Monitor network requests
- `storage`: Store local data
- `tabs`: Access tab information
- `notifications`: Show notifications
- `clipboardWrite`: Write to clipboard
- `<all_urls>`: Access all websites

## License

MIT License
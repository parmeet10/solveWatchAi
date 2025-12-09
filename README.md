# 📸 solveWatchAi

**AI-Powered Screenshot and Clipboard Analysis Tool**

solveWatchAi is an intelligent application that automatically monitors screenshots and clipboard content, extracts text using OCR, and provides AI-powered analysis and solutions using multiple AI providers (OpenAI, Groq, Gemini) with automatic fallback mechanisms.

## ✨ Features

### Core Functionality
- **🖼️ Automatic Screenshot Monitoring**: Monitors a designated screenshots directory and automatically processes new screenshots
- **📋 Clipboard Monitoring**: Real-time clipboard monitoring with automatic processing of copied content
- **🔍 OCR Text Extraction**: Extracts text from images using Tesseract.js
- **🤖 Multi-AI Provider Support**: Supports OpenAI, Groq (via Groq SDK), and Google Gemini with automatic fallback
- **🔄 Smart Fallback System**: Automatically switches between AI providers if one fails, with retry mechanisms
- **📧 Email Notifications**: Optional email notifications for processed screenshots
- **🌐 Web Interface**: Modern React-based web UI for viewing results and configuration
- **📱 Cross-Device Access**: Accessible from multiple devices on the same network

### Advanced Features
- **🧠 Context-Aware Processing**: Maintains context between screenshots/clipboard entries for better analysis
- **⚙️ Configurable API Keys**: Web-based UI for managing API keys without editing files
- **🎯 Provider Priority**: Configure which AI providers to use and in what order
- **🛡️ Error Handling**: Robust error handling with graceful degradation
- **📊 Processing History**: View all processed screenshots and clipboard content with timestamps

## 🏗️ Architecture

The application consists of two main components:

1. **Backend (Node.js/Express)**: 
   - RESTful API server
   - Screenshot monitoring service
   - Clipboard monitoring service
   - OCR processing
   - AI service with multi-provider support
   - Email service

2. **Frontend (React/Vite)**:
   - Modern web interface
   - Real-time data updates
   - API key configuration
   - Email configuration
   - Upload interface

## 📋 Prerequisites

- **Node.js** (v16 or higher)
- **npm** (v7 or higher)
- **Tesseract OCR Training Data**: The `eng.traineddata` file should be in the project root
- **API Keys** (at least one):
  - OpenAI API key (optional)
  - Groq API key (optional)
  - Google Gemini API key (optional)
- **Email Configuration** (optional, for email notifications):
  - Gmail account with App Password

## 🚀 Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd solveWatchAi
```

### 2. Install Dependencies

Install dependencies for both root and frontend:

```bash
npm run install:all
```

Or install separately:

```bash
# Install root dependencies
npm install

# Install frontend dependencies
cd frontend
npm install
cd ..
```

### 3. Environment Setup

Create a `.env` file in the root directory (optional, as API keys can be configured via UI):

```env
# Optional: API Keys (can also be configured via web UI)
OPENAI_API_KEY=your_openai_key_here
GROQ_API_KEY=your_groq_key_here
GEMINI_API_KEY=your_gemini_key_here

# Optional: Email Configuration (for email notifications)
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
EMAIL_FROM=your_email@gmail.com

# Optional: Server Configuration
PORT=4000
HTTPS_PORT=8443
FUNCTION_INTERVAL=5000
SCREENSHOTS_PATH=/path/to/your/screenshots
```

### 4. Configure Screenshots Directory

By default, the app monitors `/Users/parmeet1.0/Documents/screenshots`. You can change this by:

- Setting `SCREENSHOTS_PATH` in `.env`
- Or modifying `backend/src/config/constants.js`

Make sure the directory exists or it will be created automatically.

### 5. Build Frontend (Optional, for production)

```bash
npm run build
```

## 🎮 Usage

### Starting the Application

#### Development Mode (Recommended)

Start both backend and frontend in development mode:

```bash
npm run start:all
```

Or start them separately:

```bash
# Terminal 1: Start backend
npm run dev

# Terminal 2: Start frontend
npm run dev:frontend
```

#### Production Mode

```bash
# Build frontend first
npm run build

# Start backend (serves built frontend)
npm start
```

### Accessing the Application

Once started, access the application at:

- **Local**: `http://localhost:4000`
- **Network**: `http://<your-ip>:4000` (for access from other devices)

If HTTPS certificates (`cert.pem` and `key.pem`) are present, HTTPS will also be available on port 8443.

### Initial Configuration

1. **Configure API Keys**:
   - Click "🔑 Configure API Keys (Required)" button
   - Enter at least one API key (OpenAI, Groq, or Gemini)
   - Select which providers to enable
   - Save configuration

2. **Configure Email (Optional)**:
   - Click "📧 Configure Email" button
   - Enter your email address
   - Enable/disable email notifications
   - Save configuration

### Using Screenshot Monitoring

1. Take a screenshot and save it to the monitored directory (default: `/Users/parmeet1.0/Documents/screenshots`)
2. The application will automatically detect and process it
3. View results in the web interface

**macOS Screenshot Tips**:
- `Cmd + Shift + 3`: Full screen screenshot
- `Cmd + Shift + 4`: Selection screenshot
- Screenshots are saved to Desktop by default; move them to the monitored directory or change the default location

### Using Clipboard Monitoring

The application automatically monitors clipboard changes. You can:

1. **Auto-Process Mode (Default)**:
   - Copy any text (Cmd+C / Ctrl+C)
   - Click anywhere on the web page or paste (Cmd+V)
   - The content will be automatically processed

2. **Manual Process**:
   - Copy text
   - Click "Process Now" button
   - Or use keyboard shortcut: `Cmd+Shift+V` (Mac) or `Ctrl+Shift+V` (Windows/Linux)

3. **Toggle Auto-Process**:
   - Use the "Auto-process: ON/OFF" toggle in the header

### Uploading Images

1. Click "Choose File" in the Upload Section
2. Select an image file (JPEG, PNG, GIF, BMP, WebP)
3. Click "Upload and Process"
4. View results in the Data Section

## 🔌 API Endpoints

### Image Processing

- `POST /api/upload` - Upload and process an image
  - Body: `multipart/form-data` with `image` field
  - Response: `{ success: boolean, message: string }`

- `GET /api/data` - Get all processed data
  - Response: `Array<{ filename, timestamp, extractedText, gptResponse, usedContext }>`

### Clipboard Processing

- `POST /api/clipboard` - Process clipboard content
  - Body: `{ content: string }`
  - Response: `{ success: boolean, message: string }`

### Configuration

- `GET /api/config/keys` - Get API keys configuration
  - Response: `{ success: boolean, config: { keys, order, enabled } }`

- `POST /api/config/keys` - Save API keys configuration
  - Body: `{ keys: object, order: array, enabled: array }`
  - Response: `{ success: boolean, message: string }`

- `GET /api/config/email` - Get email configuration
  - Response: `{ success: boolean, config: { enabled, email } }`

- `POST /api/config/email` - Save email configuration
  - Body: `{ enabled: boolean, email: string }`
  - Response: `{ success: boolean, message: string }`

### Context Management

- `GET /api/context-state` - Get context mode state
  - Response: `{ useContext: boolean }`

- `POST /api/context-state` - Update context mode state
  - Body: `{ useContext: boolean }`
  - Response: `{ success: boolean }`

## 📁 Project Structure

```
solveWatchAi/
├── backend/
│   ├── config/
│   │   └── api-keys.json          # API keys configuration (gitignored)
│   ├── prompts/
│   │   ├── system-prompt.txt      # System prompt for AI
│   │   ├── context-prompt.txt     # Context-aware prompt template
│   │   └── clipboard-prompt.txt   # Clipboard-specific prompt
│   └── src/
│       ├── config/
│       │   └── constants.js        # Application constants
│       ├── controllers/
│       │   ├── clipboard.controller.js
│       │   ├── config.controller.js
│       │   ├── context.controller.js
│       │   └── image.controller.js
│       ├── middleware/
│       │   ├── error.middleware.js
│       │   └── upload.middleware.js
│       ├── routes/
│       │   ├── clipboard.routes.js
│       │   ├── config.routes.js
│       │   ├── context.routes.js
│       │   └── image.routes.js
│       ├── services/
│       │   ├── ai.service.js           # Multi-provider AI service
│       │   ├── clipboard-monitor.service.js
│       │   ├── email.service.js
│       │   ├── image-processing.service.js
│       │   ├── ocr.service.js
│       │   └── screenshot-monitor.service.js
│       ├── app.js                      # Express app setup
│       └── server.js                   # Server entry point
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ApiKeyConfig.jsx
│   │   │   ├── DataSection.jsx
│   │   │   ├── EmailConfig.jsx
│   │   │   ├── ScreenshotItem.jsx
│   │   │   └── UploadSection.jsx
│   │   ├── services/
│   │   │   └── api.js                 # API service client
│   │   ├── App.jsx                    # Main React component
│   │   ├── App.css
│   │   ├── index.css
│   │   └── main.jsx                   # React entry point
│   ├── dist/                          # Built frontend (generated)
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── uploads/                           # Uploaded images (gitignored)
├── eng.traineddata                    # Tesseract OCR training data
├── package.json                       # Root package.json
└── .env                               # Environment variables (gitignored)
```

## 🛠️ Technologies Used

### Backend
- **Express.js** - Web framework
- **Tesseract.js** - OCR text extraction
- **OpenAI SDK** - OpenAI API integration
- **Groq SDK** - Groq API integration
- **Google Generative AI** - Gemini API integration
- **Nodemailer** - Email sending
- **Multer** - File upload handling
- **clipboardy** - Clipboard monitoring
- **screenshot-desktop** - Screenshot capture utilities

### Frontend
- **React** - UI framework
- **Vite** - Build tool and dev server

## ⚙️ Configuration Details

### API Keys Configuration

API keys can be configured via:
1. **Web UI** (Recommended): Use the "Configure API Keys" button
2. **Environment Variables**: Set in `.env` file
3. **Config File**: Edit `backend/config/api-keys.json` directly

The configuration supports:
- Multiple providers (OpenAI, Groq, Gemini)
- Provider priority order
- Enable/disable specific providers
- Automatic fallback on failure

### Email Configuration

Email notifications require:
- Gmail account
- App Password (not regular password)
- Enable "Less secure app access" or use App Passwords

To get a Gmail App Password:
1. Go to Google Account settings
2. Security → 2-Step Verification (must be enabled)
3. App passwords → Generate new app password
4. Use this password in `EMAIL_PASS`

### Context Mode

Context mode maintains conversation context between screenshots/clipboard entries:
- Enabled via API endpoint or service method
- Uses previous AI response as context for next analysis
- Useful for multi-step problem solving

## 🔧 Troubleshooting

### Common Issues

1. **"No AI providers configured"**
   - Solution: Configure at least one API key via the web UI

2. **OCR not working**
   - Solution: Ensure `eng.traineddata` is in the project root
   - Check Tesseract.js installation

3. **Clipboard monitoring not working**
   - Solution: Grant clipboard permissions in system settings
   - On macOS: System Preferences → Security & Privacy → Privacy → Accessibility

4. **Screenshots not being detected**
   - Solution: Verify `SCREENSHOTS_PATH` is correct
   - Ensure directory exists and is writable
   - Check file permissions

5. **Email not sending**
   - Solution: Verify Gmail App Password is correct
   - Check `EMAIL_USER` and `EMAIL_PASS` in `.env`
   - Ensure 2-Step Verification is enabled

6. **Port already in use**
   - Solution: Change `PORT` in `.env` or kill the process using the port

### Debug Mode

Enable verbose logging by checking console output. The application logs:
- AI provider attempts and results
- Clipboard changes
- Screenshot detections
- Processing errors

## 🔐 Security Notes

- **API Keys**: Never commit API keys to version control
- **Email Passwords**: Use App Passwords, not regular passwords
- **HTTPS**: For production, use proper SSL certificates (not self-signed)
- **File Uploads**: Uploaded files are stored in `uploads/` directory

## 📝 Scripts

- `npm start` - Start backend server
- `npm run dev` - Start backend with nodemon (auto-reload)
- `npm run dev:frontend` - Start frontend dev server
- `npm run build` - Build frontend for production
- `npm run install:all` - Install all dependencies
- `npm run start:all` - Start both backend and frontend in dev mode

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

ISC License

## 👤 Author

**Parmeet Singh**

## 🙏 Acknowledgments

- Tesseract.js for OCR capabilities
- OpenAI, Groq, and Google for AI APIs
- React and Vite communities

---

**Note**: This application requires at least one AI provider API key to function. Configure API keys via the web interface after starting the application.


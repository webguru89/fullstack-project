import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Import all routes - MAKE SURE whatsappRoutes is imported
import customerRoutes from './routes/customerRoutes.js';
import attendanceRoutes from './routes/attendanceRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import whatsappRoutes from './routes/whatsappRoutes.js'; 

// Load environment variables from .env file
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ------------------ Middleware ------------------
// Set up CORS with a specific list of allowed origins for security
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Parse JSON and URL-encoded bodies with increased limits
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files from the 'uploads' directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Simple request logger middleware for better debugging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// ------------------ Create directories ------------------
// Automatically create necessary directories if they don't exist
const requiredDirs = ['uploads', 'whatsapp-auth', 'logs'];
requiredDirs.forEach(dir => {
  const dirPath = path.join(__dirname, dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`✅ Created directory: ${dir}`);
  }
});

// ------------------ Routes Registration ------------------
console.log('🛣️ Registering routes...');

// Register WhatsApp routes FIRST (most important)
app.use('/api/whatsapp', whatsappRoutes);
console.log('✅ WhatsApp routes registered at /api/whatsapp');

// Register other routes
app.use('/api/customers', customerRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/reports', reportRoutes);

// Legacy routes for backward compatibility
// This is a good practice to prevent breaking existing clients
app.use('/api', customerRoutes);
app.use('/api', attendanceRoutes);
app.use('/api', reportRoutes);

console.log('✅ All routes registered');

// ------------------ Health Check & Test Routes ------------------
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

app.get('/test-whatsapp', (req, res) => {
  res.json({
    message: 'WhatsApp route is working',
    availableEndpoints: [
      'GET /api/whatsapp/status',
      'POST /api/whatsapp/init-whatsapp-web',
      'POST /api/whatsapp/request-whatsapp-verification',
      'POST /api/whatsapp/verify-whatsapp-code',
      'POST /api/whatsapp/send-message',
      'POST /api/whatsapp/disconnect'
    ]
  });
});

// ------------------ Error Handling ------------------
// Handle 404 Not Found errors
app.use((req, res, next) => {
  console.log(`❌ 404 - Route not found: ${req.method} ${req.url}`);
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.url} not found`
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('❌ Global error:', error);
  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// ------------------ Database Connection ------------------
const connectDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/gym_management');
    console.log("✅ MongoDB Connected");
    return true;
  } catch (error) {
    console.error("❌ MongoDB Connection Error:", error);
    // Rethrow the error to be caught by the calling function
    throw error;
  }
};

// ------------------ Start Server ------------------
const startServer = async () => {
  try {
    // Connect to database first
    await connectDatabase();
    
    // Start server only after a successful database connection
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌐 API Base URL: http://localhost:${PORT}`);
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    // Exit the process with an error code
    process.exit(1);
  }
};

startServer();

export default app;

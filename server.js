import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

// Resolve __dirname and __filename
let __filename, __dirname;
try {
  __filename = fileURLToPath(import.meta.url);
  __dirname = path.dirname(__filename);
} catch (error) {
  __filename = '/var/task/server.js';
  __dirname = '/var/task';
}

const app = express();

// ------------------ Middleware ------------------
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url} - ${new Date().toISOString()}`);
  next();
});

// ------------------ Create directories (non-production only) ------------------
if (process.env.NODE_ENV !== 'production') {
  const requiredDirs = ['uploads', 'whatsapp-auth', 'logs'];
  requiredDirs.forEach(dir => {
    try {
      const dirPath = path.join(__dirname, dir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`✅ Created directory: ${dir}`);
      }
    } catch (error) {
      console.warn(`⚠️ Could not create directory ${dir}:`, error.message);
    }
  });
}

// ------------------ Dynamic Routes Import ------------------
let customerRoutes, attendanceRoutes, reportRoutes, whatsappRoutes;

try {
  const routes = await Promise.all([
    import('./routes/customerRoutes.js'),
    import('./routes/attendanceRoutes.js'),
    import('./routes/reportRoutes.js'),
    import('./routes/whatsappRoutes.js')
  ]);

  customerRoutes = routes[0].default;
  attendanceRoutes = routes[1].default;
  reportRoutes = routes[2].default;
  whatsappRoutes = routes[3].default;
} catch (error) {
  console.warn('⚠️ Some route files may be missing:', error.message);
}

// ------------------ Routes Registration ------------------
console.log('🛣️ Registering routes...');

if (whatsappRoutes) {
  app.use('/api/whatsapp', whatsappRoutes);
  console.log('✅ WhatsApp routes registered at /api/whatsapp');
}

if (customerRoutes) {
  app.use('/api/customers', customerRoutes);
  app.use('/api', customerRoutes);
  console.log('✅ Customer routes registered');
}

if (attendanceRoutes) {
  app.use('/api/attendance', attendanceRoutes);
  app.use('/api', attendanceRoutes);
  console.log('✅ Attendance routes registered');
}

if (reportRoutes) {
  app.use('/api/reports', reportRoutes);
  app.use('/api', reportRoutes);
  console.log('✅ Report routes registered');
}

// ------------------ Basic Routes ------------------
app.get('/', (req, res) => {
  res.json({
    message: '🏋️ Gym Management API is running successfully!',
    status: 'success',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    documentation: {
      healthCheck: 'GET /health',
      whatsappTest: 'GET /test-whatsapp',
      endpoints: {
        whatsapp: {
          status: 'GET /api/whatsapp/status',
          initialize: 'POST /api/whatsapp/init-whatsapp-web',
          sendMessage: 'POST /api/whatsapp/send-message',
          disconnect: 'POST /api/whatsapp/disconnect'
        },
        customers: {
          getAll: 'GET /api/customers',
          create: 'POST /api/customers',
          getById: 'GET /api/customers/:id',
          update: 'PUT /api/customers/:id',
          delete: 'DELETE /api/customers/:id'
        },
        attendance: {
          getAll: 'GET /api/attendance',
          create: 'POST /api/attendance',
          getById: 'GET /api/attendance/:id',
          update: 'PUT /api/attendance/:id'
        },
        reports: {
          getAll: 'GET /api/reports',
          generate: 'POST /api/reports'
        }
      }
    }
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Gym Management API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    database: {
      status: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
      name: mongoose.connection.name || 'N/A'
    },
    routes: {
      whatsapp: whatsappRoutes ? '/api/whatsapp' : 'Not loaded',
      customers: customerRoutes ? '/api/customers' : 'Not loaded',
      attendance: attendanceRoutes ? '/api/attendance' : 'Not loaded',
      reports: reportRoutes ? '/api/reports' : 'Not loaded'
    }
  });
});

app.get('/test-whatsapp', (req, res) => {
  res.json({
    message: 'WhatsApp route test',
    status: whatsappRoutes ? 'Available' : 'Not loaded',
    availableEndpoints: whatsappRoutes ? [
      'GET /api/whatsapp/status',
      'POST /api/whatsapp/init-whatsapp-web',
      'POST /api/whatsapp/request-whatsapp-verification',
      'POST /api/whatsapp/verify-whatsapp-code',
      'POST /api/whatsapp/send-message',
      'POST /api/whatsapp/disconnect'
    ] : ['WhatsApp routes not loaded']
  });
});

app.get('/api', (req, res) => {
  res.json({
    message: 'Gym Management API',
    version: '1.0.0',
    status: 'active',
    timestamp: new Date().toISOString(),
    endpoints: {
      whatsapp: whatsappRoutes ? '/api/whatsapp' : 'Not available',
      customers: customerRoutes ? '/api/customers' : 'Not available',
      attendance: attendanceRoutes ? '/api/attendance' : 'Not available',
      reports: reportRoutes ? '/api/reports' : 'Not available'
    },
    documentation: 'Visit / for full API documentation'
  });
});

app.get('/test', (req, res) => {
  res.json({
    message: 'API test successful!',
    timestamp: new Date().toISOString(),
    status: 'success',
    server: 'Express',
    node_version: process.version
  });
});

// ------------------ Error Handling ------------------
app.use((req, res, next) => {
  console.log(`❌ 404 - Route not found: ${req.method} ${req.url}`);
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.url} not found`,
    timestamp: new Date().toISOString(),
    availableRoutes: [
      'GET / - API documentation',
      'GET /health - Health check',
      'GET /test - Test endpoint',
      'GET /test-whatsapp - WhatsApp test',
      'GET /api - API info',
      ...(whatsappRoutes ? ['GET /api/whatsapp/status'] : []),
      ...(customerRoutes ? ['GET /api/customers'] : []),
      ...(attendanceRoutes ? ['GET /api/attendance'] : []),
      ...(reportRoutes ? ['GET /api/reports'] : [])
    ]
  });
});

app.use((error, req, res, next) => {
  console.error('❌ Global error:', error);
  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Internal server error',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// ------------------ Database Connection ------------------
const connectDatabase = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/gym_management';

    await mongoose.connect(mongoUri); // Removed deprecated options
    console.log("✅ MongoDB Connected successfully");
    return true;
  } catch (error) {
    console.error("❌ MongoDB Connection Error:", error.message);
    return false;
  }
};

// ------------------ App Initialization ------------------
const initializeApp = async () => {
  try {
    const dbConnected = await connectDatabase();

    if (dbConnected) {
      console.log('✅ Database connected successfully');
    } else {
      console.log('⚠️ Database connection failed, but app will continue');
    }

    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🚀 Gym Management API initialized successfully`);
  } catch (error) {
    console.error('❌ Failed to initialize app:', error);
    if (process.env.NODE_ENV !== 'production') {
      process.exit(1);
    }
  }
};

// Initialize and start server
await initializeApp();

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 API Base URL: http://localhost:${PORT}`);
  console.log(`📱 WhatsApp API: http://localhost:${PORT}/api/whatsapp`);
  console.log(`🔍 Health Check: http://localhost:${PORT}/health`);
  console.log(`🧪 Test Endpoint: http://localhost:${PORT}/test`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    mongoose.connection.close();
    console.log('✅ Server closed');
  });
});

export default app;

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import cron from 'node-cron';
import path from 'path';

// Import routes
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import employeeRoutes from './routes/employees';
import driverRoutes from './routes/drivers';
import vehicleRoutes from './routes/vehicles';
import reservationRoutes from './routes/reservations';
import documentRoutes from './routes/documents';
import notificationRoutes from './routes/notifications';
import reportRoutes from './routes/reports';
import dashboardRoutes from './routes/dashboard';
import settingsRoutes from './routes/settings';
import importRoutes from './routes/import';
import assignmentRoutes from './routes/assignments';

// Import middleware
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { authMiddleware } from './middleware/auth';

// Import services
import { NotificationService } from './services/notificationService';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(requestLogger);

// Static files (for uploaded documents)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'FrotaMax API Server',
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Public routes (no authentication required)
app.use('/api/auth', authRoutes);

// Protected routes (authentication required)
app.use('/api/users', userRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/import', importRoutes);
app.use('/api/assignments', assignmentRoutes);

// Error handling middleware (must be last)
app.use(errorHandler);

// Schedule automated tasks
// Check for expiring documents every day at 9 AM
cron.schedule('0 9 * * *', async () => {
  try {
    console.log('Running daily document expiry check...');
    await NotificationService.checkExpiringDocuments();
    console.log('Document expiry check completed');
  } catch (error) {
    console.error('Error in daily document check:', error);
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 FrotaMax API Server running on port ${PORT}`);
  console.log(`📱 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔗 API URL: http://localhost:${PORT}`);
});

export default app;

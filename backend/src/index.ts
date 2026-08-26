import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import pinoHttp from 'pino-http';
import authRoutes from './routes/authRoute';
import sessionRoutes from './routes/sessionRoute';
import billingRoutes, { stripeWebhookHandler } from './routes/billingRoute';
import eventRoutes from './routes/eventRoute';
import adminRoutes from './routes/adminRoute';
import { ensureSuperAdmin } from './controllers/adminController';
import { usageSyncJob } from './jobs/usageSync';
import { initSocketService } from './services/socketService';
import { logger } from './logger';

const IS_PROD = process.env.NODE_ENV === 'production';

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3001;

// ─── Request Logging (must be first middleware) ───────────────────────────────
app.use(pinoHttp({
  logger,
  // Don't log health checks to reduce noise
  autoLogging: { ignore: (req) => req.url === '/health' },
  customSuccessMessage: (req, res) => `${req.method} ${req.url} → ${res.statusCode}`,
  customErrorMessage: (req, res, err) => `${req.method} ${req.url} ERROR: ${err.message}`,
}));

// ─── CORS ────────────────────────────────────────────────────────────────────
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const ALLOWED_ORIGINS = Array.from(new Set([FRONTEND_URL, 'http://localhost:5173', 'http://localhost:8080']));
app.use(cors({
  origin: ALLOWED_ORIGINS,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// ─── Socket.io ───────────────────────────────────────────────────────────────
const io = new Server(httpServer, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});
initSocketService(io);

// ─── Stripe Webhook (RAW BODY — must be before express.json()) ───────────────
app.post(
  '/api/v1/billing/webhook',
  express.raw({ type: 'application/json' }),
  stripeWebhookHandler
);

// ─── JSON Body Parser (all other routes) ─────────────────────────────────────
app.use(express.json());

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/sessions', sessionRoutes);
app.use('/api/v1/events', eventRoutes);
app.use('/api/v1/billing', billingRoutes);
app.use('/api/v1/admin', adminRoutes);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), env: IS_PROD ? 'production' : 'development' });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err, stack: err.stack }, '[Server] Unhandled error');
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: IS_PROD ? 'Internal server error' : err.message,
  });
});

// ─── Start ─────────────────────────────────────────────────────────────────────
httpServer.listen(PORT, async () => {
  logger.info(`[Backend] Server listening on port ${PORT}`);
  logger.info(`[Backend] WebSocket initialized | CORS: ${FRONTEND_URL} | Env: ${IS_PROD ? 'production' : 'development'}`);
  await ensureSuperAdmin();
  usageSyncJob.start();
});

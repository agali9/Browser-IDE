import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import { WebSocketServer } from 'ws';
import { initDb } from './db';
import { authRouter } from './routes/auth';
import { roomsRouter } from './routes/rooms';
import { executeRouter } from './routes/execute';
import { aiRouter } from './routes/ai';
import { setupCollabWS } from './ws/collab';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '2mb' }));

// Health check
app.get('/health', (_, res) => res.json({ status: 'ok', uptime: process.uptime() }));

// Routes
app.use('/api/auth', authRouter);
app.use('/api/rooms', roomsRouter);
app.use('/api/execute', executeRouter);
app.use('/api/ai', aiRouter);

// HTTP + WS server
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
setupCollabWS(wss);

// Init DB then start
initDb().then(() => {
  server.listen(PORT, () => {
    console.log(`[server] listening on http://localhost:${PORT}`);
  });
});

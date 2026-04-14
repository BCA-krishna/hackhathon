const http = require('http');
const { Server } = require('socket.io');
const createApp = require('./app');
const { connectDB } = require('./config/db');
const env = require('./config/env');
const { setIo, registerSocketHandlers } = require('./services/realtimeService');

async function start() {
  connectDB();

  const app = createApp();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: env.corsOrigin,
      methods: ['GET', 'POST']
    }
  });

  setIo(io);
  registerSocketHandlers(io);

  server.listen(env.port, '0.0.0.0', () => {
    // eslint-disable-next-line no-console
    console.log(`Backend running on port ${env.port} (0.0.0.0)`);
  });
}

start().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start server', error);
  process.exit(1);
});

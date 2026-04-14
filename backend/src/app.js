const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const authRoutes = require('./routes/authRoutes');
const dataRoutes = require('./routes/dataRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const forecastRoutes = require('./routes/forecastRoutes');
const alertRoutes = require('./routes/alertRoutes');
const recommendationRoutes = require('./routes/recommendationRoutes');
const aiRoutes = require('./routes/aiRoutes');
const chatbotRoutes = require('./routes/chatbotRoutes');
const posRoutes = require('./routes/posRoutes');
const { notFound, errorHandler } = require('./middlewares/errorMiddleware');
const env = require('./config/env');

function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ 
    origin: [env.corsOrigin, 'http://127.0.0.1:5173'], 
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan('dev'));

  app.get('/health', (req, res) => {
    res.json({ success: true, message: 'API healthy' });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api', dataRoutes);
  app.use('/api', analyticsRoutes);
  app.use('/api', forecastRoutes);
  app.use('/api', alertRoutes);
  app.use('/api', recommendationRoutes);
  app.use('/api', aiRoutes);
  app.use('/api', chatbotRoutes);
  app.use('/api/pos', posRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;

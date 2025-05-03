const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const errorHandler = require('./middlewares/errorHandler');
const routes = require('./routes');

const app = express();

// Configuração de CORS
const corsOptions = {
  origin: [
    'https://course-checkout.vercel.app/',
    'http://localhost:3000' // Para desenvolvimento
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  optionsSuccessStatus: 200 // Para navegadores legacy
};

// Middlewares
app.use(cors(corsOptions)); // Aplica as configurações de CORS
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate Limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // Limite de 100 requisições por IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    message: 'Too many requests from this IP, please try again later'
  }
});

// Aplica rate limit apenas nas rotas /api
app.use('/api', apiLimiter);

// Routes
app.use('/api', routes);

// Error Handling (deve ser o último middleware)
app.use(errorHandler);

module.exports = app;
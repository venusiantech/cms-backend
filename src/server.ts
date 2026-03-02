const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
import { errorHandler } from './middleware/error.middleware';
import { rateLimiter } from './middleware/rate-limiter.middleware';
import routes from './routes';
import { loadStorageProviderFromDb } from './storage/storage-provider.config';
import { loadAiProvidersFromDb } from './ai-service/ai-provider.config';

const app = express();
const PORT = process.env.PORT || 3001;

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Domain CMS API',
      version: '1.0.0',
      description: 'Multi-tenant domain CMS platform API',
    },
    servers: [
      {
        url: `http://localhost:${PORT}/api`,
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: ['./src/routes/**/*.ts', './src/**/*.routes.ts'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// CORS configuration: allow frontend, admin, and optional comma-separated ALLOWED_ORIGINS
const allowedOrigins: string[] = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  process.env.ADMIN_PORTAL_URL || 'http://localhost:3002',
  ...(process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)
    : []),
];
// Also allow https/http and www variants of fastofy.com when used in production
if (process.env.FRONTEND_URL?.includes('fastofy.com')) {
  allowedOrigins.push('https://fastofy.com', 'https://www.fastofy.com', 'http://fastofy.com', 'http://www.fastofy.com');
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.indexOf(origin) !== -1 ||
        origin.includes('localhost') ||
        origin.includes('.local')
      ) {
        return callback(null, true);
      }
      // Allow any origin (e.g. production frontend); credentials still require reflected origin
      callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Middleware
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
app.use(rateLimiter);

// API routes
app.use('/api', routes);

// Swagger documentation
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler (must be last)
app.use(errorHandler);

// Load persisted settings from DB then start server
Promise.all([loadStorageProviderFromDb(), loadAiProvidersFromDb()])
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Backend running on http://localhost:${PORT}`);
      console.log(`📚 API Docs available at http://localhost:${PORT}/api/docs`);
    });
  })
  .catch((err) => {
    console.error('Failed to load settings from DB:', err);
    process.exit(1);
  });

export default app;

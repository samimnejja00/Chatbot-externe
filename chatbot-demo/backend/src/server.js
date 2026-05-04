require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const chatRoutes = require('./routes/chat');

const app = express();
const PORT = process.env.PORT || 3001;

// Rate limiting configuration
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute per IP
  message: { error: 'Trop de requêtes. Veuillez réessayer dans une minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
app.use(cors()); // Permet les requêtes depuis le frontend
app.use(express.json()); // Parse les requêtes JSON
app.use(limiter); // Apply rate limiting to all routes

// Routes
app.use('/api/chat', chatRoutes);

// Route d'accueil
app.get('/', (req, res) => {
  res.json({
    name: 'COMAR Chatbot API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      chat: '/api/chat/message'
    }
  });
});

// Route de santé pour vérifier que le serveur fonctionne
app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`Serveur backend démarré sur le port ${PORT}`);
});
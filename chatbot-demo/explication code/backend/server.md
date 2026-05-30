# backend/src/server.js

## But et utilite

- But et utilite: Ce fichier demarre le serveur Express du chatbot externe.

## Role

- Active CORS et JSON
- Applique un rate limit (30 req/min/IP)
- Monte /api/chat
- Expose / et /health

## Env

- PORT (defaut 3001)

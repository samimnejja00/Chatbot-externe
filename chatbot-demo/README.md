# Chatbot Demo COMAR

Cette démo présente un chatbot utilisant Mistral AI pour répondre à des questions générales sur COMAR.

## Installation

1. Clonez ou copiez ce dossier dans votre projet.

2. Pour le backend :
   ```bash
   cd chatbot-demo/backend
   npm install
   cp .env.example .env
   # Éditez .env et ajoutez votre clé API Mistral
   npm start
   ```

3. Pour le frontend (dans un autre terminal) :
   ```bash
   cd chatbot-demo/frontend
   npm install
   npm run dev
   ```

4. Ouvrez votre navigateur à `http://localhost:3000` pour voir la démo.

## Structure

- `frontend/` : Application React avec Vite
- `backend/` : Serveur Express avec intégration Mistral AI

## Développement

- Backend : `npm run dev` pour le rechargement automatique
- Frontend : `npm run dev` pour le serveur de développement

## Intégration future

Le code est structuré pour faciliter l'ajout de :
- FAQ statique
- Base documentaire
- RAG / embeddings
- Recherche sémantique

Voir les commentaires dans le code pour les points d'extension.
# backend/src/services/mistralService.js

## But et utilite

- But et utilite: Ce service appelle l'API Mistral pour generer des reponses.

## Role

- Construit le prompt system
- Ajoute l'historique de conversation
- Appelle https://api.mistral.ai/v1/chat/completions
- Nettoie le markdown de sortie

## Env

- MISTRAL_API_KEY

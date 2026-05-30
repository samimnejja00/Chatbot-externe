# backend/src/routes/chat.js

## But et utilite

- But et utilite: Ce routeur gere le endpoint POST /api/chat/message et le flux de conversation.

## Endpoint

- POST /api/chat/message

## Logique

- Nettoie l'entree (sanitize)
- Gere l'etat de conversation par sessionId ou IP
- Traite salutations, auth, sinistre, produits, contact
- Filtre hors sujet sur le premier message
- Construit un contexte via knowledge_base.json
- Appelle Mistral et renvoie reponse + sources

## Services utilises

- mistralService.getMistralResponse
- knowledgeBase.search / formatContext / isRelevantQuery / isPersonalDataQuery

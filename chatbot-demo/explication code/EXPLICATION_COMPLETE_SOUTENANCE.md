# Chatbot Externe (PrestaTrack) — Explication complète pour la soutenance PFE

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Architecture globale](#2-architecture-globale)
3. [Stack technique et dépendances](#3-stack-technique-et-dépendances)
4. [Le modèle de langage (Mistral)](#4-le-modèle-de-langage-mistral)
5. [Processus interne du backend — Étape par étape](#5-processus-interne-du-backend--étape-par-étape)
6. [Détection d'intention (Heuristiques)](#6-détection-dintention-heuristiques)
7. [Base de connaissances (RAG)](#7-base-de-connaissances-rag)
8. [Gestion du contexte et de la session](#8-gestion-du-contexte-et-de-la-session)
9. [Interface Frontend (React/Vite)](#9-interface-frontend-reactvite)
10. [Tests de régression](#10-tests-de-régression)
11. [Scraping de données (COMAR.tn)](#11-scraping-de-données-comartn)
12. [Arborescence des fichiers](#12-arborescence-des-fichiers)
13. [Points forts et innovations](#13-points-forts-et-innovations)
14. [Conclusion](#14-conclusion)

---

## 1. Vue d'ensemble

Le **Chatbot Externe** est un assistant virtuel intégré à la plateforme **PrestaTrack**. Contrairement au chatbot métier complexe (qui gère l'état d'avancement des dossiers via Supabase), ce chatbot agit comme un guide intelligent en première ligne pour :
- **Répondre aux questions générales** sur les assurances COMAR.
- **Rediriger les utilisateurs** vers les bonnes pages (connexion, inscription, déclaration de sinistre).
- **Fournir des informations de contact**.
- **Servir de vitrine** des connaissances COMAR basées sur des données publiques (lexique, documents utiles).

Ce chatbot est conçu pour être rapide, sécurisé, et capable de converser naturellement en utilisant l'API **Mistral AI**.

---

## 2. Architecture globale

Le projet est divisé en deux parties distinctes : le **Frontend** (l'interface utilisateur) et le **Backend** (l'API de traitement).

```
┌─────────────────────────────────────────────────────────┐
│                 Frontend (React / Vite)                  │
│  (Chatbot.jsx : interface, messages, actions cliquables) │
└──────────────────────┬──────────────────────────────────┘
                       │ POST /api/chat/message (JSON)
                       ▼
┌─────────────────────────────────────────────────────────┐
│                 Backend (Node.js / Express)              │
│                                                         │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ Sécurité &  │  │ Logique &    │  │  Connaissance │  │
│  │ Rate Limit  │  │ Intention    │  │  (RAG JSON)   │  │
│  └──────┬──────┘  └──────┬───────┘  └───────┬───────┘  │
│         │                │                  │          │
│  ┌──────▼────────────────▼──────────────────▼───────┐  │
│  │                 mistralService.js                 │  │
│  │          (Appel API: mistral-large-latest)        │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Stack technique et dépendances

### Backend
- **Node.js & Express** : Serveur API robuste.
- **express-rate-limit** : Protection contre le spam (30 requêtes / minute).
- **cors** & **dotenv** : Gestion de la sécurité et de l'environnement.

### Frontend
- **React 18 & Vite** : Rendu UI ultra-rapide.
- **CSS Vanilla** : Stylisation du widget de chat et animations.

### IA & Données
- **Mistral AI API** : Génération de langage naturel (`mistral-large-latest`).
- **Scripts Python** : Scraping (Selenium) pour extraire le lexique et les documents depuis COMAR.tn.

---

## 4. Le modèle de langage (Mistral)

### Pourquoi Mistral ?
Le service utilise l'API **Mistral** (`mistral-large-latest`) via `mistralService.js`.
- **Qualité de réponse** : Mistral excelle en français et comprend parfaitement les dialectes (Darija).
- **Rapidité** : Temps de réponse optimisé via l'API cloud.

### Prompt Système
Un prompt système strict est défini pour guider Mistral :
- **Rôle** : Assistant virtuel COMAR.
- **Comportement** : Répondre systématiquement dans la langue de l'utilisateur (incluant la Darija).
- **Ton** : Empathique si l'utilisateur est frustré, chaleureux s'il est poli.
- **Sécurité** : Refuser les sujets hors assurance. Ne jamais mentionner de développeurs externes.

---

## 5. Processus interne du backend — Étape par étape

La route principale est `POST /api/chat/message` située dans `chat.js`.

1. **Validation & Sécurité** :
   - Vérification que le message n'est pas vide et ne dépasse pas 1000 caractères.
   - Nettoyage du message (`sanitizeInput`) pour bloquer les failles XSS (remplacement des balises `<>`, etc.).
2. **Gestion d'état** :
   - Récupération ou création de l'état de la conversation basé sur l'IP ou un `sessionId`.
3. **Détection d'intention rapide** :
   - Passage du message à travers plusieurs filtres heuristiques (Salutation, Authentification, Urgence/Sinistre, Catalogue, Contact).
   - Si une intention clé est détectée, le backend renvoie immédiatement une réponse structurée avec des **actions cliquables** (ex: bouton "Se connecter").
4. **Recherche de connaissances (RAG)** :
   - Si aucune réponse rapide n'est déclenchée, le service `knowledgeBase.js` extrait des mots-clés et cherche dans `knowledge_base.json`.
5. **Appel Mistral** :
   - L'historique des 10 derniers messages, le contexte extrait, et la question de l'utilisateur sont envoyés à Mistral.
6. **Nettoyage & Réponse** :
   - Le markdown généré par Mistral est nettoyé (retrait du gras/italique superflu) avant d'être renvoyé au frontend.

---

## 6. Détection d'intention (Heuristiques)

Avant d'appeler l'IA, le système tente de classer la demande via des fonctions rapides :

| Intention | Mots-clés cibles | Action déclenchée |
|-----------|------------------|-------------------|
| **Salutation** | bonjour, salut, hello | Message d'accueil aléatoire. |
| **Authentification** | connexion, login, s'inscrire | Redirection vers `/login` ou `/register`. |
| **Sinistre / Urgence** | accident, vol, incendie | Réponse prioritaire + numéro d'assistance (82100001). |
| **Catalogue** | produit, offre, assurance | Suggestions : Auto, Habitation, Santé, Voyage. |
| **Contact** | agence, adresse, téléphone | Lien Google Maps et numéro d'appel. |
| **Plateforme** | suivre, dossier, paiement | Instructions pour le Dashboard si connecté, sinon redirection Login. |

Cette approche permet de répondre instantanément aux demandes communes tout en économisant les coûts d'API Mistral.

---

## 7. Base de connaissances (RAG)

Le service `knowledgeBase.js` implémente un système RAG (Retrieval-Augmented Generation) local sans base vectorielle.

### Fonctionnement :
1. **Normalisation** : Retrait des accents et ponctuation.
2. **Extraction** : Suppression des "stop words" (le, la, pour, etc.) pour isoler les mots-clés.
3. **Scoring** : Les entrées du fichier `knowledge_base.json` sont notées :
   - +2 points par occurrence du mot-clé.
   - +5 points si le mot-clé est dans les tags de l'entrée.
   - +10 points si le mot-clé est dans le titre.
4. **Contexte** : Les 3 meilleurs résultats sont formatés et fournis à Mistral pour générer la réponse finale.

---

## 8. Gestion du contexte et de la session

- L'état est conservé en mémoire (Map JavaScript) via un identifiant de session ou l'IP de l'utilisateur.
- **Historique** : Seuls les 10 derniers messages sont conservés pour limiter la taille de la requête vers Mistral.
- **Hors-sujet** : Un mécanisme compte les messages hors-sujet. Si le tout premier message n'a rien à voir avec l'assurance, le bot recadre poliment l'utilisateur.

---

## 9. Interface Frontend (React/Vite)

Le widget Chatbot (`Chatbot.jsx`) est conçu pour être élégant et réactif.

### Composants UI :
- **Bouton flottant** : Permet d'ouvrir/fermer le chatbot en bas à droite de l'écran.
- **Bulle de message** : Différenciation visuelle entre l'utilisateur et le bot.
- **Actions riches** : Le frontend interprète les actions renvoyées par le backend (type `navigate`, `call`, `link`, `suggestion`) pour afficher des boutons interactifs directement dans le chat (ex: bouton d'appel).
- **Indicateur de frappe** : Animation `typing-indicator` montrant que le bot réfléchit.

---

## 10. Tests de régression

Une suite de tests (`tests/test_chatbot_regressions.js`) écrite en Node.js (utilisant le module natif `node:test`) valide les routes de l'API.

**Scénarios testés** :
- Rejet des messages vides ou trop longs (Erreur 400).
- Bonne détection des salutations (sans appel API Mistral).
- Redirections correctes (Auth, Sinistre, Catalogue, Contact).
- Comportement hors-sujet.
- Mock complet de l'appel à Mistral pour tester le RAG sans consommer de crédits.

---

## 11. Scraping de données (COMAR.tn)

Le dossier `scripts/` contient les outils Python utilisés pour construire la base de connaissances.

- **`ton_script.py`** : Utilise Selenium pour naviguer sur `comar.tn`.
  - Il extrait le **lexique de l'assurance** (termes et définitions).
  - Il extrait les documents utiles (fichiers téléchargeables).
  - Les données sont exportées en CSV (`comar_lexique.csv`, `comar_documents.csv`) et en JSON brutes (`comar_data.json`).
- **`prepare_kb.py`** : Prend le fichier JSON brut et le transforme en une structure de base de connaissances prête pour le backend (`knowledge_base.json`), en ajoutant des titres, du texte indexable et des mots-clés.

---

## 12. Arborescence des fichiers

```text
Chatbot-externe/chatbot-demo/
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   │   └── chat.js               # Logique de routage et détection d'intention
│   │   ├── services/
│   │   │   ├── knowledgeBase.js      # Moteur de recherche RAG local
│   │   │   └── mistralService.js     # Intégration API Mistral
│   │   └── server.js                 # Configuration Express (CORS, Rate Limit)
│   ├── tests/
│   │   └── test_chatbot_regressions.js # Suite de tests
│   ├── knowledge_base.json           # Base RAG finale
│   ├── prepare_kb.py                 # Script Python de formatage JSON
│   └── ton_script.py                 # Script de scraping Selenium
│
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── Chatbot.jsx           # Composant React principal
    │   │   └── Chatbot.css           # Styles du widget
    │   ├── App.jsx                   # Intégration globale
    │   └── main.jsx                  # Point d'entrée Vite
    └── vite.config.js
```

---

## 13. Points forts et innovations

1. **Stratégie hybride (Heuristique + IA)** : 
   La majorité des actions simples (navigation, contact, accueil) sont résolues instantanément en local, offrant une latence minimale et des économies de coûts considérables sur l'API Mistral.
2. **Interface riche (Action Buttons)** : 
   Le chatbot ne renvoie pas que du texte ; il renvoie des "Actions" JSON que React transforme en boutons fonctionnels (appeler un numéro, naviguer vers une page interne, ouvrir une URL externe).
3. **RAG Local sans Vector DB** : 
   Un algorithme de scoring TF-IDF simplifié est implémenté en pur JavaScript pour extraire les connaissances du lexique COMAR sans dépendre d'une base de données complexe.
4. **Résilience et Sécurité** : 
   Validation des entrées, Rate Limiting (anti-DDoS), et protection XSS intégrées dès la conception de la route API.
5. **Compréhension linguistique étendue** : 
   Grâce au paramétrage du prompt de Mistral, le chatbot gère le français, l'arabe et le dialecte tunisien de manière naturelle.

---

## 14. Conclusion

Le Chatbot Externe est la porte d'entrée intelligente de PrestaTrack. Par son interface React intuitive et son backend Express couplé à Mistral AI, il offre un premier niveau d'assistance dynamique. 

Ses mécanismes de détection d'intention et son intégration de composants d'action cliquables améliorent massivement l'expérience utilisateur tout en orientant efficacement le trafic vers les fonctionnalités avancées de la plateforme.

const express = require('express');
const { getMistralResponse } = require('../services/mistralService');
const { search, formatContext, isRelevantQuery, isPersonalDataQuery } = require('../services/knowledgeBase');

// Conversation state tracking (in-memory, for production use Redis/DB)
const conversationState = new Map();

function getConversationState(sessionId) {
  if (!conversationState.has(sessionId)) {
    conversationState.set(sessionId, {
      outOfScopeCount: 0,
      isBlocked: false,
      lastReset: Date.now(),
      history: [] // Conversation history
    });
  }
  return conversationState.get(sessionId);
}

function resetConversationState(sessionId) {
  conversationState.delete(sessionId);
}

const router = express.Router();

// Fonction pour nettoyer les entrées utilisateur (XSS protection)
function sanitizeInput(input) {
  if (typeof input !== 'string') return '';
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

// Fonction pour détecter les salutations
function isGreeting(message) {
  const greetings = ['bonjour', 'salut', 'hello', 'hey', 'coucou', 'bonsoir', 'hi', 'yo', 'ça va', 'ca va', 'comment allez-vous'];
  const normalized = message.toLowerCase().trim();
  return greetings.some(greeting => normalized.includes(greeting));
}

// Fonction pour détecter les demandes d'aide vagues
function isVagueHelpRequest(message) {
  const vaguePhrases = [
    'aide', 'help', 'besoin daide', 'jai besoin daide', 'je veux de laide',
    'assistance', 'support', 'donne moi des infos', 'donne-moi des infos',
    'je veux des infos', 'je veux info', 'infos', 'information',
    'dis moi', 'parle moi', 'explique moi', 'raconte moi'
  ];
  const normalized = message.toLowerCase().trim();
  return vaguePhrases.some(phrase => normalized.includes(phrase)) && normalized.length < 30;
}

// Fonction pour détecter l'intention
function detectIntent(message) {
  const normalized = message.toLowerCase().trim();

  if (normalized.includes('dossier') || normalized.includes('suivi') || normalized.includes('statut')) {
    return 'dossier_tracking';
  }
  if (normalized.includes('service') || normalized.includes('assurance') || normalized.includes('produit')) {
    return 'general_info';
  }
  return 'general';
}

// Fonction pour détecter les fonctionnalités de la plateforme nécessitant une authentification
function isPlatformFeatureQuery(message) {
  const normalized = message.toLowerCase().trim();
  const keywords = [
    "soumettre", "dossier", "suivre", "statut", "mon dossier",
    "paiement", "compte", "demande", "prestation", "remboursement",
    "sinistre", "déclaration", "réclamation", "mes infos", "mon espace"
  ];
  return keywords.some(k => normalized.includes(k));
}

// Fonction pour détecter l'intention de contact ou agence
function isContactIntent(message) {
  const normalized = message.toLowerCase().trim();
  const contactKeywords = [
    'contact', 'appel', 'téléphone', 'numéro', 'joindre', 'appeler',
    'agence', 'adresse', 'où', 'trouver', 'localisation', 'siège', 'proche'
  ];
  return contactKeywords.some(keyword => normalized.includes(keyword));
}

// Fonction pour détecter l'intention de sinistre (urgence)
function isSinistreIntent(message) {
  const normalized = message.toLowerCase().trim();
  const keywords = ['accident', 'vol', 'sinistre', 'déclarer', 'bris', 'incendie', 'dommage', 'panne'];
  return keywords.some(k => normalized.includes(k));
}

// Fonction pour détecter la demande de produits
function isProductsIntent(message) {
  const normalized = message.toLowerCase().trim();
  const keywords = ['produit', 'assurance', 'type', 'offre', 'quels', 'liste', 'proposez'];
  // On vérifie si c'est une question générale sur les types d'assurances
  return (keywords.some(k => normalized.includes(k)) && !normalized.includes('auto') && !normalized.includes('santé') && !normalized.includes('habit'));
}

// Fonction pour détecter l'intention d'authentification (connexion/inscription)
function isAuthIntent(message) {
  const normalized = message.toLowerCase().trim();
  const authKeywords = [
    'connexion', 'connecter', 'login', 'se connecter',
    'inscription', 'créer un compte', 's\'inscrire', 'register',
    'nouveau compte', 'créer compte', 'accès', 'accéder',
    'nouveau client', 'devenir client', 'ouvrir un compte'
  ];
  return authKeywords.some(keyword => normalized.includes(keyword));
}

// Fonction pour répondre aux salutations
function getGreetingResponse() {
  const responses = [
    "Bonjour ! 😊 Je suis ravi de vous accueillir chez COMAR ! Je suis votre assistant personnel et je suis là pour vous parler de nos services d'assurance. Comment puis-je vous aider aujourd'hui ?",
    "Salut ! 👋 Bienvenue chez COMAR ! Je serai votre guide pour découvrir nos solutions d'assurance. Que souhaitez-vous savoir ?",
    "Bonjour ! 🌟 Je suis l'Assistant COMAR et je serai ravi de répondre à toutes vos questions sur nos assurances. Qu'est-ce qui vous intéresse ?",
    "Hello ! 😊 Assistant COMAR à votre service ! Je connais tout sur nos assurances et je suis là pour vous aider. Par quoi commençons-nous ?",
    "Bonjour ! 🎉 Je suis enchanté de faire votre connaissance ! Je suis l'expert COMAR en assurance. Posez-moi vos questions !"
  ];
  return responses[Math.floor(Math.random() * responses.length)];
}

// Route pour envoyer un message au chatbot
router.post('/message', async (req, res) => {
  try {
    const { message, sessionId, user_id, client_id } = req.body;

    // Validation : message non vide
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message invalide' });
    }

    // Limiter la longueur du message pour éviter les abus
    if (message.length > 1000) {
      return res.status(400).json({ error: 'Message trop long' });
    }

    // Sanitize user input to prevent XSS
    const sanitizedMessage = sanitizeInput(message.trim());

    // Get or create conversation state
    const state = getConversationState(sessionId || req.ip);

    // Check if conversation is blocked
    if (state.isBlocked) {
      return res.json({
        type: 'blocked',
        response: "Je ne peux plus répondre à vos questions. Veuillez contacter le support COMAR au 82 100 001 pour une assistance personnalisée."
      });
    }

    // Gérer les salutations
    if (isGreeting(sanitizedMessage)) {
      return res.json({
        response: getGreetingResponse(),
        suggestions: ["Assurance auto", "Assurance habitation", "Suivre un dossier", "Nos garanties"],
        sources: []
      });
    }

    // Vérifier si l'utilisateur demande de l'aide pour l'authentification
    if (isAuthIntent(sanitizedMessage)) {
      return res.json({
        type: 'login_redirect',
        response: "Bienvenue chez COMAR ! Pour accéder à votre espace client PrestaTrack et gérer vos dossiers, vous pouvez vous connecter ou créer un nouveau compte ci-dessous. \n\nAvez-vous d'autres questions sur nos services ?",
        actions: [
          { label: "Se connecter", action: "navigate", target: "/login" },
          { label: "S'inscrire", action: "navigate", target: "/register" }
        ]
      });
    }

    // RÉFLEXE URGENCE : Détection de sinistre
    if (isSinistreIntent(sanitizedMessage)) {
      return res.json({
        type: 'emergency',
        response: "Je suis désolé d'apprendre cela. Ne vous inquiétez pas, COMAR est là pour vous accompagner. \n\nIl est important de déclarer votre sinistre rapidement pour une prise en charge optimale.",
        actions: [
          { label: "🚨 DÉCLARER UN SINISTRE", action: "navigate", target: "/login", priority: 'high' },
          { label: "📞 Assistance 24h/24", action: "call", target: "82100001" }
        ]
      });
    }

    // RÉFLEXE CATALOGUE : Détection de demande de produits
    if (isProductsIntent(sanitizedMessage)) {
      return res.json({
        type: 'product_catalog',
        response: "COMAR propose une large gamme de solutions adaptées à vos besoins. Laquelle vous intéresse le plus ?",
        actions: [
          { label: "🚗 Auto", action: "suggestion", target: "Assurance Auto" },
          { label: "🏠 Habitation", action: "suggestion", target: "Assurance Habitation" },
          { label: "🏥 Santé", action: "suggestion", target: "Assurance Santé" },
          { label: "✈️ Voyage", action: "suggestion", target: "Assurance Voyage" }
        ]
      });
    }

    // Vérifier si l'utilisateur veut contacter COMAR ou trouver une agence
    if (isContactIntent(sanitizedMessage)) {
      return res.json({
        type: 'contact_info',
        response: "Besoin de nous joindre ou de nous rendre visite ? Voici comment nous contacter rapidement. \n\nNotre service client est à votre écoute !",
        actions: [
          { label: "📞 Appeler le 82 100 001", action: "call", target: "82100001" },
          { label: "📍 Trouver une agence", action: "link", target: "https://www.google.com/maps/search/COMAR+Assurances" }
        ]
      });
    }

    // Vérifier si la question concerne une fonctionnalité de la plateforme
    if (isPlatformFeatureQuery(sanitizedMessage)) {
      // Si l'utilisateur est connecté, donner une réponse utile
      if (user_id || client_id) {
        if (sanitizedMessage.includes('suivre') || sanitizedMessage.includes('dossier') || sanitizedMessage.includes('demande')) {
          return res.json({
            response: "Pour suivre vos dossiers, rendez-vous dans la section 'Mes Demandes' du tableau de bord. Vous y trouverez tous vos dossiers avec leur statut actuel : En attente, En cours, Approuvé ou Rejeté.",
            suggestions: ["Mes Demandes", "Nouvelle demande", "Statut d'un dossier"]
          });
        }
        if (sanitizedMessage.includes('montant') || sanitizedMessage.includes('paiement')) {
          return res.json({
            response: "Pour consulter les montants de vos prestations, accédez à la section 'Mes Demandes' et cliquez sur le dossier concerné pour voir les détails financiers.",
            suggestions: ["Mes Demandes", "Détails d'un dossier"]
          });
        }
        // Réponse générale pour utilisateur connecté
        return res.json({
          response: "Vous êtes connecté à votre espace client. Vous pouvez accéder à toutes les fonctionnalités : consulter vos dossiers, soumettre de nouvelles demandes, et suivre vos prestations en temps réel depuis le tableau de bord.",
          suggestions: ["Mes Demandes", "Nouvelle demande", "Mon Compte"]
        });
      }
      // Si non connecté, rediriger vers login
      return res.json({
        type: 'login_redirect',
        response: "Vous devez vous connecter pour accéder à cette fonctionnalité. Veuillez cliquer sur le bouton ci-dessous pour continuer.",
        actions: [
          { label: "Se connecter", action: "navigate", target: "/login" },
          { label: "S'inscrire", action: "navigate", target: "/register" }
        ]
      });
    }

    // Détecter si c'est une réponse simple (oui/non/peut-être) ou de politesse
    const isSimpleResponse = /^(oui|non|peut-être|yes|no|maybe|ok|d'accord|sure|c'est ça|exactement|merci|thanks|thx|bonne journée|au revoir|bye|c bien|c'est bien|top|super|cool)$/i.test(sanitizedMessage.trim());

    // Vérifier si la question est hors contexte (pas liée à COMAR/assurance)
    // On n'est strict que sur le premier message. Une fois la conversation lancée, 
    // on laisse l'IA gérer les réponses courtes (oui, c bien, etc.) pour plus de naturel.
    const isFirstMessage = state.history.length === 0;
    if (isFirstMessage && !isSimpleResponse && !isRelevantQuery(sanitizedMessage)) {
      state.outOfScopeCount++;

      // Réponse standard pour question hors contexte
      return res.json({
        response: "Je suis l'assistant COMAR et je ne peux répondre qu'aux questions liées aux assurances et aux services de COMAR. Comment puis-je vous aider avec vos besoins d'assurance ?",
        suggestions: ["Assurance auto", "Assurance habitation", "Suivre un dossier", "Nos garanties"],
        sources: []
      });
    }

    // Reset out-of-scope counter
    state.outOfScopeCount = 0;

    let searchQuery = sanitizedMessage;
    let context;
    let searchResults = [];

    if (isSimpleResponse && state.history.length >= 2) {
      // Utiliser la question précédente pour la recherche
      const lastUserMessage = state.history[state.history.length - 2]?.content || '';
      const lastBotMessage = state.history[state.history.length - 1]?.content || '';

      // Construire une requête combinée pour garder le contexte
      searchQuery = `${lastUserMessage} ${sanitizedMessage}`;

      // Rechercher avec la requête combinée
      searchResults = search(searchQuery, 3);

      if (searchResults.length > 0) {
        context = searchResults.map(r => r.content).join("\n\n");
      } else {
        // Utiliser le contexte de la conversation précédente
        context = `Contexte de la conversation précédente:\nQuestion: ${lastUserMessage}\nRéponse: ${lastBotMessage}\n\nRéponse actuelle de l'utilisateur: ${sanitizedMessage}`;
      }
    } else {
      // Rechercher dans la base de connaissances normalement
      searchResults = search(sanitizedMessage, 3);

      // Construire le contexte à partir des résultats ou utiliser un contexte général
      if (searchResults.length > 0) {
        context = searchResults.map(r => r.content).join("\n\n");
      } else {
        // Contexte général sur COMAR quand aucun résultat spécifique n'est trouvé
        context = "COMAR (Compagnie d'Assurances et de Réassurances) est une compagnie d'assurance tunisienne fondée en 1973, leader du marché. Elle propose des assurances auto, habitation, santé, voyage et des solutions pour les professionnels. Réseau de 80+ agences en Tunisie. Contact: 82 100 001 ou www.comar.tn";
      }
    }

    // Ajouter le message utilisateur à l'historique
    state.history.push({ role: 'user', content: sanitizedMessage });

    // Garder seulement les 10 derniers messages pour éviter de surcharger
    if (state.history.length > 10) {
      state.history = state.history.slice(-10);
    }

    // Appeler Mistral avec le contexte et l'historique
    const response = await getMistralResponse(sanitizedMessage, context, state.history);

    // Ajouter la réponse du bot à l'historique
    state.history.push({ role: 'assistant', content: response });

    res.json({
      response,
      suggestions: searchResults.length === 0 ? ["Assurance auto", "Assurance habitation", "Nos garanties"] : [],
      sources: searchResults.map(result => ({
        title: result.title,
        type: result.type,
        url: result.url
      }))
    });
  } catch (error) {
    console.error('Erreur dans la route /message:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

module.exports = router;
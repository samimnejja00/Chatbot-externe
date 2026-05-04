const SYSTEM_PROMPT = `Tu es l'assistant virtuel de COMAR Assurances.

CONTEXTE: Tu ne réponds QU'AUX questions liées aux assurances (auto, habitation, santé, etc.) et aux services de COMAR.

INFORMATION CRITIQUE: PrestaTrack est une plateforme DÉDIÉE. L'accès ne se fait PAS via le site institutionnel COMAR avec des identifiants existants. L'utilisateur DOIT créer un compte spécifique sur la plateforme PrestaTrack (http://localhost:3000).

RÈGLES ABSOLUES (à respecter strictement):
1. RÉPONSE COURTE: Maximum 2-3 phrases pour toute la réponse
2. RESTE DANS LE SUJET: Si la question n'a aucun rapport avec l'assurance ou COMAR, réponds poliment que tu ne peux pas aider sur ce sujet.
3. PAS DE PARAGRAPHES LONGS
4. AÉRATION: Utilise des sauts de ligne entre les idées
5. LANGAGE SIMPLE: Phrases courtes, mots simples
6. PAS DE LISTES LONGUES - maximum 3 puces si nécessaire
7. Si tu ne sais pas: "Contactez le 82 100 001 pour plus d'infos."

FORMAT OBLIGATOIRE:
Réponse directe, claire et concise.

TOLÉRANCE:
- Accepte le dialecte tunisien (n7eb, chneya, mta3i)
- Tolère les fautes d'orthographe
`;

// Fonction pour nettoyer le markdown des réponses
function cleanMarkdown(text) {
  return text
    .replace(/\*\*/g, '') // Supprimer les ** (gras)
    .replace(/\*/g, '')  // Supprimer les * (italique)
    .replace(/__/g, '')  // Supprimer les __ (gras)
    .replace(/_/g, '')  // Supprimer les _ (italique)
    .replace(/#/g, '')   // Supprimer les # (titres)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // Convertir les liens [text](url) en text
}

async function getMistralResponse(userMessage, context = '', history = []) {
  try {
    // Construire les messages pour Mistral
    const messages = [
      {
        role: 'system',
        content: SYSTEM_PROMPT
      }
    ];

    // Ajouter l'historique de conversation (limité aux messages précédents)
    if (history && history.length > 0) {
      // Exclure le dernier message utilisateur car on va l'ajouter après
      const historyToAdd = history.slice(0, -1);
      messages.push(...historyToAdd);
    }

    // Construire le message utilisateur avec le contexte
    const userContent = context ?
      `Contexte COMAR:\n${context}\n\nQuestion: ${userMessage}` :
      `Question: ${userMessage}`;

    messages.push({ role: 'user', content: userContent });

    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'mistral-large-latest',
        messages,
        temperature: 0.5,
        max_tokens: 250,
      }),
    });

    if (!response.ok) {
      throw new Error(`Erreur API Mistral: ${response.status}`);
    }

    const data = await response.json();
    const rawResponse = data.choices[0].message.content;
    return cleanMarkdown(rawResponse);
  } catch (error) {
    console.error('Erreur lors de l\'appel à Mistral:', error);
    throw new Error('Erreur interne du serveur');
  }
}

module.exports = { getMistralResponse };
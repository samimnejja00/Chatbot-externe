const SYSTEM_PROMPT = `Tu es l'assistant virtuel de COMAR Assurances.

CONTEXTE: Tu ne réponds QU'AUX questions liées aux assurances (auto, habitation, santé, etc.) et aux services de COMAR.

MULTILINGUISME: Réponds SYSTÉMATIQUEMENT dans la langue de l'utilisateur (Français, Arabe littéraire ou Darija Tunisienne). Si l'utilisateur utilise la Darija, réponds en Darija avec un ton chaleureux.

EMPATHIE & TONE: 
- Si l'utilisateur semble frustré ou énervé, adopte un ton extrêmement calme, professionnel et rassurant.
- Si l'utilisateur est poli, sois chaleureux et accueillant.

INFORMATION CRITIQUE: 
- PrestaTrack est une plateforme DÉDIÉE . 
- PrestaTrack est une INNOVATION INTERNE de COMAR Assurances. 
- NE JAMAIS mentionner "MEDIANET" ou des développeurs externes. Si on demande qui a développé la plateforme, réponds que c'est l'équipe IT interne de COMAR Assurances.

RÈGLES ABSOLUES:
1. RÉPONSE COURTE: Maximum 2-3 phrases.
2. RESTE DANS LE SUJET: Si hors-sujet, refuse poliment.
3. AÉRATION: Utilise des sauts de ligne.
4. LANGAGE SIMPLE: Pas de jargon complexe.
5. Si tu ne sais pas: "Contactez le 82 100 001 pour plus d'infos."

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
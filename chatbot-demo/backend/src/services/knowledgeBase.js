const fs = require('fs');
const path = require('path');

/**
 * Service de recherche dans la base de connaissances COMAR
 * Recherche par mots-clés avec scoring de pertinence
 */

class KnowledgeBase {
  constructor() {
    this.knowledgeBase = null;
    this.loadKnowledgeBase();
  }

  /**
   * Charge la base de connaissances depuis le fichier JSON
   */
  loadKnowledgeBase() {
    try {
      const filePath = path.join(__dirname, '../../knowledge_base.json');
      const fileContent = fs.readFileSync(filePath, 'utf8');
      this.knowledgeBase = JSON.parse(fileContent);
      console.log(`✅ Base de connaissances chargée: ${this.knowledgeBase.metadata.total_entries} entrées`);
    } catch (error) {
      console.error('❌ Erreur lors du chargement de la base de connaissances:', error);
      this.knowledgeBase = { entries: [] };
    }
  }

  /**
   * Normalise le texte pour la recherche
   */
  normalizeText(text) {
    if (!text) return '';
    
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Supprime les accents
      .replace(/[^\w\s]/g, ' ') // Remplace la ponctuation par des espaces
      .replace(/\s+/g, ' ') // Supprime les espaces multiples
      .trim();
  }

  /**
   * Extrait les mots-clés d'une requête
   */
  extractKeywords(query) {
    const normalized = this.normalizeText(query);
    
    // Stop words français à ignorer
    const stopWords = new Set([
      'le', 'la', 'les', 'de', 'du', 'des', 'et', 'est', 'dans', 'pour',
      'par', 'avec', 'sur', 'une', 'un', 'il', 'elle', 'nous', 'vous',
      'ils', 'elles', 'ce', 'se', 'si', 'ou', 'que', 'qui', 'quoi',
      'donc', 'car', 'mais', 'ni', 'ne', 'pas', 'plus', 'moins', 'très',
      'bien', 'aussi', 'comme', 'tout', 'tous', 'toute', 'toutes', 'être',
      'avoir', 'faire', 'aller', 'voir', 'savoir', 'pouvoir', 'vouloir',
      'venir', 'falloir', 'devoir', 'tenir', 'donner', 'prendre', 'rendre',
      'quel', 'quels', 'quelle', 'quelles', 'mon', 'ma', 'mes', 'ton',
      'ta', 'tes', 'son', 'sa', 'ses', 'notre', 'votre', 'leur', 'leurs'
    ]);
    
    return normalized
      .split(' ')
      .filter(word => word.length >= 3 && !stopWords.has(word));
  }

  /**
   * Calcule le score de pertinence pour une entrée
   */
  calculateRelevanceScore(entry, keywords) {
    let score = 0;
    const searchableText = entry.searchable_text || '';
    const entryKeywords = entry.keywords || [];
    
    // Score pour les mots-clés exacts dans le contenu
    keywords.forEach(keyword => {
      // Escape special regex characters to prevent ReDoS
      const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Occurrences dans le texte searchable
      const occurrences = (searchableText.match(new RegExp(escapedKeyword, 'g')) || []).length;
      score += occurrences * 2;
      
      // Bonus si le mot-clé est dans les mots-clés de l'entrée
      if (entryKeywords.includes(keyword)) {
        score += 5;
      }
    });
    
    // Bonus pour le titre
    const title = this.normalizeText(entry.title || '');
    keywords.forEach(keyword => {
      if (title.includes(keyword)) {
        score += 10;
      }
    });
    
    // Bonus pour le type (lexique prioritaire)
    if (entry.type === 'lexique') {
      score += 2;
    }
    
    return score;
  }

  /**
   * Recherche les passages les plus pertinents
   */
  search(query, maxResults = 5) {
    if (!this.knowledgeBase || !this.knowledgeBase.entries) {
      return [];
    }

    const keywords = this.extractKeywords(query);
    
    if (keywords.length === 0) {
      return [];
    }

    // Calculer les scores pour toutes les entrées
    const results = this.knowledgeBase.entries
      .map(entry => ({
        ...entry,
        relevanceScore: this.calculateRelevanceScore(entry, keywords)
      }))
      .filter(entry => entry.relevanceScore > 0)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, maxResults);

    return results;
  }

  /**
   * Formate le contexte pour Mistral
   */
  formatContext(results) {
    if (!results || results.length === 0) {
      return '';
    }

    const contextParts = results.map((result, index) => {
      const typeLabel = result.type === 'lexique' ? 'Lexique' : 
                       result.type === 'document' ? 'Document' : 'Contact';
      
      return `[${typeLabel}] ${result.title}\n${result.content}`;
    });

    return `Contexte COMAR pertinent:\n${contextParts.join('\n\n')}`;
  }

  /**
   * Vérifie si la requête est pertinente pour COMAR
   */
  isRelevantQuery(query) {
    const msg = query.toLowerCase();
    const keywords = [
      'assurance', 'comar', 'dossier', 'sinistre', 'contrat', 'client',
      'prestation', 'service', 'garantie', 'prime', 'indemnite', 'remboursement',
      'vehicule', 'voiture', 'auto', 'habitation', 'mrh', 'accident',
      'vol', 'incendie', 'bonus', 'malus', 'avenant', 'echeance',
      'resiliation', 'expert', 'expertise', 'suivre', 'demande',
      'souscription', 'tarif', 'devis', 'contact', 'support',
      'rc', 'responsabilite', 'civile', 'degat', 'eaux', 'bris', 'glace',
      'reconduction', 'sante', 'voyage', 'professionnel', 'agence',
      'reassurance', 'compagnie', 'police', 'cotisation', 'franchise',
      'assure', 'assureur', 'beneficiaire', 'risque', 'couverture',
      'protection', 'dommage', 'indemnisation', 'declaration', 'attestation',
      'prestatrack'
    ];

    return keywords.some(k => msg.includes(k));
  }

  /**
   * Vérifie si la question nécessite des données personnelles
   */
  isPersonalDataQuery(query) {
    const normalized = this.normalizeText(query);
    
    // Phrases spécifiques qui indiquent une demande de données personnelles
    const personalPhrases = [
      'mon dossier', 'ma demande', 'mes demandes',
      'mon contrat', 'mes contrats', 'mon sinistre', 'mes sinistres',
      'mon prime', 'mes primes', 'mon indemnité', 'mes indemnités',
      'mon remboursement', 'mes remboursements', 'mon compte',
      'statut de mon', 'suivi de mon', 'mon historique',
      'mon numero', 'mon cin', 'mon identifiant', 'mon situation',
      'mon avancement', 'mon état', 'mes informations personnelles',
      'mes données personnelles'
    ];
    
    // Vérifier si la phrase contient une de ces expressions spécifiques
    const hasPersonalPhrase = personalPhrases.some(phrase => normalized.includes(phrase));
    
    // Vérifier si c'est une question sur le statut/suivi avec un pronom possessif
    const hasStatusWithPossessive = /(statut|suivi|état|avancement).*(mon|ma|mes)/i.test(normalized);
    
    return hasPersonalPhrase || hasStatusWithPossessive;
  }
}

// Singleton pour éviter de recharger le fichier à chaque requête
const knowledgeBase = new KnowledgeBase();

module.exports = {
  search: (query, maxResults) => knowledgeBase.search(query, maxResults),
  formatContext: (results) => knowledgeBase.formatContext(results),
  isRelevantQuery: (query) => knowledgeBase.isRelevantQuery(query),
  isPersonalDataQuery: (query) => knowledgeBase.isPersonalDataQuery(query)
};

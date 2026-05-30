const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const express = require('express');
const chatRoutes = require('../src/routes/chat');

// 1. Mocking the external Mistral API call globally to keep tests offline, fast, and deterministic
const originalFetch = globalThis.fetch;

before(() => {
  globalThis.fetch = async (url, options) => {
    // If it's a call to the Mistral API, return a mocked response
    if (url.includes('api.mistral.ai')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{
            message: {
              content: "Voici les informations générées par notre modèle d'intelligence artificielle Mistral."
            }
          }]
        })
      };
    }
    // Fallback to the original fetch for normal internal server requests
    return originalFetch(url, options);
  };
});

after(() => {
  globalThis.fetch = originalFetch;
});

describe('Chatbot Externe - Suite de Tests de Régression', () => {
  let app;
  let server;
  let baseUrl;

  before(() => {
    // Initialize a clean test instance of Express
    app = express();
    app.use(express.json());
    app.use('/api/chat', chatRoutes);

    // Boot on an available port chosen by the OS (port 0) to avoid any conflicts
    server = app.listen(0);
    const port = server.address().port;
    baseUrl = `http://localhost:${port}/api/chat/message`;
  });

  after(() => {
    if (server) {
      server.close();
    }
  });

  // Test 1: Salutations rapides
  test('Devrait détecter les salutations et retourner une réponse prédéfinie', async () => {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Bonjour',
        sessionId: 'test-greeting'
      })
    });

    assert.strictEqual(response.status, 200);
    const body = await response.json();
    assert.ok(body.response);
    assert.ok(body.response.includes('COMAR'));
    assert.ok(body.suggestions.length > 0);
  });

  // Test 2: Redirection Espace d'Authentification (Inscription/Connexion)
  test('Devrait rediriger vers la connexion/inscription pour les requêtes d\'authentification', async () => {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Je veux me connecter ou m inscrire',
        sessionId: 'test-auth'
      })
    });

    assert.strictEqual(response.status, 200);
    const body = await response.json();
    assert.strictEqual(body.type, 'login_redirect');
    assert.ok(body.response.includes('PrestaTrack'));
    assert.strictEqual(body.actions.length, 2);
    assert.strictEqual(body.actions[0].label, 'Se connecter');
  });

  // Test 3: Réflexe Urgence / Sinistre
  test('Devrait détecter l\'intention de sinistre et proposer des actions d\'urgence', async () => {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'J ai eu un accident de voiture ce matin',
        sessionId: 'test-sinistre'
      })
    });

    assert.strictEqual(response.status, 200);
    const body = await response.json();
    assert.strictEqual(body.type, 'emergency');
    assert.ok(body.response.includes('sinistre'));
    assert.strictEqual(body.actions[0].label, '🚨 DÉCLARER UN SINISTRE');
  });

  // Test 4: Catalogue Produits
  test('Devrait détecter les demandes de produits et proposer le catalogue', async () => {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Quelles sont vos offres d assurance ?',
        sessionId: 'test-products'
      })
    });

    assert.strictEqual(response.status, 200);
    const body = await response.json();
    assert.strictEqual(body.type, 'product_catalog');
    assert.ok(body.actions.some(act => act.label === '🚗 Auto'));
  });

  // Test 5: Contact et Localisation d'Agence
  test('Devrait fournir les coordonnées d\'agence sur demande', async () => {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Où se trouve l agence la plus proche',
        sessionId: 'test-contact'
      })
    });

    assert.strictEqual(response.status, 200);
    const body = await response.json();
    assert.strictEqual(body.type, 'contact_info');
    assert.ok(body.actions.some(act => act.target === '82100001'));
  });

  // Test 6: Question sur plateforme SANS authentification (visiteur public)
  test('Devrait rediriger vers la connexion si un visiteur public demande à suivre un dossier', async () => {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'je veux suivre mon dossier',
        sessionId: 'test-platform-anonymous'
      })
    });

    assert.strictEqual(response.status, 200);
    const body = await response.json();
    assert.strictEqual(body.type, 'login_redirect');
  });

  // Test 7: Question sur plateforme AVEC authentification active
  test('Devrait donner des instructions utiles au lieu de rediriger si l\'utilisateur est connecté', async () => {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'je veux suivre mon dossier',
        sessionId: 'test-platform-auth',
        user_id: 'client-42'
      })
    });

    assert.strictEqual(response.status, 200);
    const body = await response.json();
    assert.ok(!body.type || body.type !== 'login_redirect');
    assert.ok(body.response.includes('Mes Demandes'));
  });

  // Test 8: Filtrage hors sujet sur premier message
  test('Devrait rejeter poliment une question totalement hors sujet', async () => {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Quelle est la météo de demain à Paris ?',
        sessionId: 'test-offtopic'
      })
    });

    assert.strictEqual(response.status, 200);
    const body = await response.json();
    assert.ok(body.response.includes('assurance'));
    assert.ok(body.suggestions.includes('Assurance auto'));
  });

  // Test 9: Appel LLM Mistral valide pour question d'assurance
  test('Devrait interroger l\'API Mistral (Mockée) pour une question d\'assurance valide', async () => {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Parlez-moi de votre assurance habitation',
        sessionId: 'test-valid-qa'
      })
    });

    assert.strictEqual(response.status, 200);
    const body = await response.json();
    assert.ok(body.response.includes('intelligence artificielle Mistral'));
  });

  // Test 10: Validation des erreurs (Message vide ou trop long)
  test('Devrait rejeter les messages vides ou trop longs', async () => {
    // 1. Message vide
    const resEmpty = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '', sessionId: 'test-error' })
    });
    assert.strictEqual(resEmpty.status, 400);

    // 2. Message trop long (> 1000 caractères)
    const resLong = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'A'.repeat(1005), sessionId: 'test-error' })
    });
    assert.strictEqual(resLong.status, 400);
  });
});

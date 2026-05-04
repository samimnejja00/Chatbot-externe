import React, { useState } from 'react';
import './Chatbot.css';

const API_URL = 'http://localhost:3001/api/chat';

function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const toggleChat = () => {
    setIsOpen((prev) => !prev);
  };

  const sendMessage = async () => {
    if (!input.trim()) return; // Empêche l'envoi de message vide

    const userMessage = { text: input.trim(), sender: 'user' };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: userMessage.text }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur lors de la communication avec le serveur');
      }

      const data = await response.json();
      const botMessage = { text: data.response, sender: 'bot' };
      setMessages(prev => [...prev, botMessage]);
    } catch (err) {
      setError(err.message);
      console.error('Erreur:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !isLoading) {
      sendMessage();
    }
  };

  return (
    <>
      {!isOpen && (
        <button className="chatbot-launcher" onClick={toggleChat} aria-label="Ouvrir le chat">
          <span>💬</span>
        </button>
      )}

      <div className={`chatbot-container ${isOpen ? 'open' : 'closed'}`}>
        <header className="chatbot-header">
          <div>
            <h1>Assistant COMAR</h1>
          </div>
          <button className="chatbot-close" onClick={toggleChat} aria-label="Fermer le chat">
            ✕
          </button>
        </header>

        <div className="chatbot-messages">
          {messages.length === 0 && (
            <div className="message bot welcome">
              <div className="message-text">Bonjour ! Posez une question sur COMAR et je vous répondrai en français.</div>
            </div>
          )}
          {messages.map((msg, index) => (
            <div key={index} className={`message ${msg.sender}`}>
              <div className="message-text">{msg.text}</div>
            </div>
          ))}
          {isLoading && <div className="message bot loading">L'assistant est en train de répondre...</div>}
          {error && <div className="message error">{error}</div>}
        </div>

        <div className="chatbot-input">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Posez votre question..."
            disabled={isLoading}
          />
          <button onClick={sendMessage} disabled={isLoading || !input.trim()}>
            Envoyer
          </button>
        </div>
      </div>
    </>
  );
}

export default Chatbot;
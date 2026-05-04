#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script pour transformer comar_data.json en knowledge_base.json
Optimisé pour la recherche par mots-clés dans le chatbot COMAR
"""

import json
import re
from typing import List, Dict, Any
import unicodedata

def normalize_text(text: str) -> str:
    """Normalise le texte pour la recherche: minuscules, accents, ponctuation"""
    if not text:
        return ""
    
    # Mettre en minuscules
    text = text.lower()
    
    # Supprimer les accents
    text = unicodedata.normalize('NFD', text)
    text = ''.join(c for c in text if unicodedata.category(c) != 'Mn')
    
    # Nettoyer la ponctuation mais garder les espaces
    text = re.sub(r'[^\w\s]', ' ', text)
    
    # Supprimer les espaces multiples
    text = re.sub(r'\s+', ' ', text).strip()
    
    return text

def extract_keywords(text: str) -> List[str]:
    """Extrait les mots-clés pertinents d'un texte"""
    if not text:
        return []
    
    normalized = normalize_text(text)
    
    # Mots à ignorer (stop words français)
    stop_words = {
        'le', 'la', 'les', 'de', 'du', 'des', 'et', 'est', 'dans', 'pour', 
        'par', 'avec', 'sur', 'une', 'un', 'il', 'elle', 'nous', 'vous',
        'ils', 'elles', 'ce', 'se', 'si', 'ou', 'où', 'que', 'qui', 'quoi',
        'donc', 'car', 'mais', 'ni', 'ne', 'pas', 'plus', 'moins', 'très',
        'bien', 'aussi', 'comme', 'tout', 'tous', 'toute', 'toutes', 'être',
        'avoir', 'faire', 'aller', 'voir', 'savoir', 'pouvoir', 'vouloir',
        'venir', 'falloir', 'devoir', 'tenir', 'donner', 'prendre', 'rendre'
    }
    
    # Extraire les mots de 3+ caractères qui ne sont pas des stop words
    words = [
        word for word in normalized.split() 
        if len(word) >= 3 and word not in stop_words
    ]
    
    return words

def process_lexique_entry(entry: Dict[str, Any]) -> Dict[str, Any]:
    """Traite une entrée du lexique"""
    return {
        'type': 'lexique',
        'title': entry.get('title', ''),
        'content': entry.get('content', ''),
        'url': entry.get('url', ''),
        'keywords': extract_keywords(entry.get('title', '') + ' ' + entry.get('content', '')),
        'searchable_text': normalize_text(entry.get('title', '') + ' ' + entry.get('content', ''))
    }

def process_document_entry(entry: Dict[str, Any]) -> Dict[str, Any]:
    """Traite une entrée de document"""
    return {
        'type': 'document',
        'title': entry.get('title', ''),
        'content': entry.get('content', ''),
        'url': entry.get('url', ''),
        'keywords': extract_keywords(entry.get('title', '') + ' ' + entry.get('content', '')),
        'searchable_text': normalize_text(entry.get('title', '') + ' ' + entry.get('content', ''))
    }

def main():
    """Fonction principale"""
    print("🔄 Transformation de comar_data.json en knowledge_base.json...")
    
    try:
        # Charger les données COMAR
        with open('comar_data.json', 'r', encoding='utf-8') as f:
            comar_data = json.load(f)
        
        knowledge_base = {
            'metadata': {
                'total_entries': 0,
                'lexique_count': 0,
                'documents_count': 0,
                'generated_at': '',
                'version': '1.0'
            },
            'entries': []
        }
        
        # Traiter le lexique
        lexique = comar_data.get('lexique', [])
        print(f"📚 Traitement de {len(lexique)} entrées du lexique...")
        
        for entry in lexique:
            processed = process_lexique_entry(entry)
            knowledge_base['entries'].append(processed)
            knowledge_base['metadata']['lexique_count'] += 1
        
        # Traiter les documents
        documents = comar_data.get('documents', [])
        print(f"📄 Traitement de {len(documents)} documents...")
        
        for entry in documents:
            processed = process_document_entry(entry)
            knowledge_base['entries'].append(processed)
            knowledge_base['metadata']['documents_count'] += 1
        
        # Ajouter les informations de contact
        homepage = comar_data.get('homepage', {})
        if homepage.get('contact_lines'):
            contact_entry = {
                'type': 'contact',
                'title': 'Contact COMAR',
                'content': ' | '.join(homepage['contact_lines']),
                'url': homepage.get('url', ''),
                'keywords': extract_keywords(' '.join(homepage['contact_lines'])),
                'searchable_text': normalize_text(' '.join(homepage['contact_lines']))
            }
            knowledge_base['entries'].append(contact_entry)
        
        # Mettre à jour les métadonnées
        knowledge_base['metadata']['total_entries'] = len(knowledge_base['entries'])
        knowledge_base['metadata']['generated_at'] = '2026-04-06'
        
        # Sauvegarder la base de connaissances
        with open('knowledge_base.json', 'w', encoding='utf-8') as f:
            json.dump(knowledge_base, f, ensure_ascii=False, indent=2)
        
        print(f"✅ Terminé ! {knowledge_base['metadata']['total_entries']} entrées traitées")
        print(f"📊 Lexique: {knowledge_base['metadata']['lexique_count']} entrées")
        print(f"📄 Documents: {knowledge_base['metadata']['documents_count']} entrées")
        print(f"📁 Fichier généré: knowledge_base.json")
        
    except FileNotFoundError:
        print("❌ Erreur: fichier comar_data.json introuvable")
    except json.JSONDecodeError as e:
        print(f"❌ Erreur de format JSON: {e}")
    except Exception as e:
        print(f"❌ Erreur inattendue: {e}")

if __name__ == "__main__":
    main()

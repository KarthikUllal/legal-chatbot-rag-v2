# app/translation.py
import requests
import logging
from typing import Dict

logger = logging.getLogger(__name__)

class LegalTranslator:
    def __init__(self):
        self.supported_languages = {
            'en': 'English',
            'hi': 'Hindi',
            'kn': 'Kannada', 
            'ta': 'Tamil',
            'te': 'Telugu',
            'mr': 'Marathi',
            'bn': 'Bengali'
        }
        
        # Predefined legal terminology translations
        self.legal_terms = {
            'hi': {
                'section': 'धारा',
                'ipc': 'भारतीय दंड संहिता',
                'bns': 'भारतीय न्याय संहिता',
                'punishment': 'सजा',
                'cheating': 'मोस',
                'murder': 'हत्या',
                'consumer': 'उपभोक्ता',
                'rights': 'अधिकार',
                'cyber crime': 'साइबर अपराध',
                'domestic violence': 'घरेलू हिंसा',
                'court': 'न्यायालय',
                'judge': 'न्यायाधीश',
                'lawyer': 'वकील',
                'legal': 'कानूनी',
                'act': 'अधिनियम',
                'code': 'संहिता'
            },
            'kn': {
                'section': 'ವಿಭಾಗ',
                'ipc': 'ಭಾರತೀಯ ದಂಡ ಸಂಹಿತೆ',
                'bns': 'ಭಾರತೀಯ ನ್ಯಾಯ ಸಂಹಿತೆ',
                'punishment': 'ಶಿಕ್ಷೆ',
                'cheating': 'ಮೋಸ',
                'murder': 'ಕೊಲೆ',
                'consumer': 'ಉಪಭೋಕ್ತ',
                'rights': 'ಹಕ್ಕುಗಳು',
                'cyber crime': 'ಸೈಬರ್ ಅಪರಾಧ',
                'domestic violence': 'ಕುಟುಂಬ ಹಿಂಸೆ',
                'court': 'ನ್ಯಾಯಾಲಯ',
                'judge': 'ನ್ಯಾಯಾಧೀಶ',
                'lawyer': 'ವಕೀಲ',
                'legal': 'ಕಾನೂನು',
                'act': 'ಅಧಿನಿಯಮ',
                'code': 'ಸಂಹಿತೆ'
            },
            'ta': {
                'section': 'பிரிவு',
                'ipc': 'இந்திய தண்டனை சட்டம்',
                'bns': 'இந்திய நீதி சட்டம்',
                'punishment': 'தண்டனை',
                'cheating': 'மோசடி',
                'murder': 'கொலை',
                'consumer': 'நுகர்வோர்',
                'rights': 'உரிமைகள்',
                'cyber crime': 'சைபர் குற்றம்',
                'domestic violence': 'குடும்ப வன்முறை',
                'court': 'நீதிமன்றம்',
                'judge': 'நீதிபதி',
                'lawyer': 'வழக்கறிஞர்',
                'legal': 'சட்ட',
                'act': 'சட்டம்',
                'code': 'தொகுப்பு'
            },
            'te': {
                'section': 'విభాగం',
                'ipc': 'భారతీయ శిక్షాస్మృతి',
                'bns': 'భారతీయ న్యాయ సంహిత',
                'punishment': 'శిక్ష',
                'cheating': 'మోసం',
                'murder': 'హత్య',
                'consumer': 'వినియోగదారుడు',
                'rights': 'హక్కులు',
                'cyber crime': 'సైబర్ నేరం',
                'domestic violence': 'గృహ హింస'
            }
        }
    
    def translate_legal_response(self, english_response: str, target_language: str) -> str:
        """Translate English legal responses to target language"""
        if target_language == 'en' or target_language not in self.supported_languages:
            return english_response
            
        try:
            # First, replace legal terms with translated versions
            translated_text = english_response
            if target_language in self.legal_terms:
                for eng_term, regional_term in self.legal_terms[target_language].items():
                    # Replace whole words only (case insensitive)
                    import re
                    pattern = r'\b' + re.escape(eng_term) + r'\b'
                    translated_text = re.sub(pattern, regional_term, translated_text, flags=re.IGNORECASE)
                    
                    # Also replace title case and uppercase versions
                    translated_text = translated_text.replace(eng_term.title(), regional_term)
                    translated_text = translated_text.replace(eng_term.upper(), regional_term.upper())
            
            # Then use Google Translate for the rest
            url = "https://translate.googleapis.com/translate_a/single"
            params = {
                'client': 'gtx',
                'sl': 'en',
                'tl': target_language,
                'dt': 't',
                'q': translated_text
            }
            
            response = requests.get(url, params=params, timeout=10)
            
            if response.status_code == 200:
                result = response.json()
                final_translation = ''.join([item[0] for item in result[0] if item[0]])
                logger.info(f"✅ Translated legal response to {self.supported_languages[target_language]}")
                return final_translation
            else:
                logger.warning(f"Translation failed, returning English")
                return english_response
                
        except Exception as e:
            logger.error(f"Translation error: {e}")
            return english_response

# Global instance
translator = LegalTranslator()
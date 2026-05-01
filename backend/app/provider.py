import requests
import logging
from .config import NVIDIA_API_KEY, NVIDIA_MODEL

logger = logging.getLogger(__name__)

class NVIDIAProvider:

    def generate(self, prompt):

        if not NVIDIA_API_KEY:
            raise ValueError("NVIDIA_API_KEY is not set. Please check your .env file.")

        headers = {
            "Authorization": f"Bearer {NVIDIA_API_KEY}",
            "Content-Type": "application/json"
        }

        payload = {
            "model": NVIDIA_MODEL,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.2,   # ✅ Lower temperature = less hallucination
            "max_tokens": 400,
            "top_p": 0.9
        }

        try:
            response = requests.post(
                "https://integrate.api.nvidia.com/v1/chat/completions",
                headers=headers,
                json=payload,
                timeout=45
            )

            # ✅ FIX 7: Handle HTTP errors explicitly before parsing
            if response.status_code == 401:
                raise ValueError("NVIDIA API authentication failed. Check your API key.")
            elif response.status_code == 429:
                raise RuntimeError("NVIDIA API rate limit exceeded. Please wait and try again.")
            elif response.status_code != 200:
                raise RuntimeError(f"NVIDIA API error {response.status_code}: {response.text[:200]}")

            data = response.json()

            # Safe extraction with fallback
            choices = data.get("choices", [])
            if not choices:
                raise RuntimeError("NVIDIA API returned an empty response.")

            content = choices[0].get("message", {}).get("content", "")
            if not content:
                raise RuntimeError("NVIDIA API returned empty content.")

            return content

        except requests.exceptions.Timeout:
            logger.error("NVIDIA API request timed out.")
            raise RuntimeError("The AI service timed out. Please try again.")
        except requests.exceptions.ConnectionError:
            logger.error("Could not connect to NVIDIA API.")
            raise RuntimeError("Could not connect to the AI service. Check your internet connection.")
        except (ValueError, RuntimeError):
            raise
        except Exception as e:
            logger.error(f"Unexpected NVIDIA API error: {e}")
            raise RuntimeError(f"AI service error: {str(e)}")
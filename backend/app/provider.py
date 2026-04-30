import requests
from .config import NVIDIA_API_KEY,NVIDIA_MODEL

class NVIDIAProvider:

    def generate(self,prompt):

        headers={
            "Authorization":f"Bearer {NVIDIA_API_KEY}",
            "Content-Type":"application/json"
        }

        payload={
            "model":NVIDIA_MODEL,
            "messages":[{"role":"user","content":prompt}],
            "temperature":0.3,
            "max_tokens":800
        }

        response=requests.post(
            "https://integrate.api.nvidia.com/v1/chat/completions",
            headers=headers,
            json=payload
        )

        data=response.json()

        return data["choices"][0]["message"]["content"]
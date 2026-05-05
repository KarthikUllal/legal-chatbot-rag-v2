#config.py
import os
from dotenv import load_dotenv

load_dotenv()

DATA_DIR = "./data"
CHROMA_DIR = "./chroma_db"

NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY")
NVIDIA_MODEL = os.getenv("NVIDIA_MODEL","meta/llama-3.1-8b-instruct")

CHUNK_SIZE = 800
CHUNK_OVERLAP = 120
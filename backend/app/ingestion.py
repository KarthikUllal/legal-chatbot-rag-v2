#ingestion.py
from pypdf import PdfReader
from bs4 import BeautifulSoup
import requests

from langchain_text_splitters import RecursiveCharacterTextSplitter

from .config import CHUNK_SIZE,CHUNK_OVERLAP


def load_pdf(path):

    reader=PdfReader(path)

    text=""

    for page in reader.pages:
        text+=page.extract_text() or ""

    return text


def load_txt(path):

    with open(path,"r",encoding="utf-8") as f:
        return f.read()


def load_url(url):

    response=requests.get(url)

    soup=BeautifulSoup(response.text,"html.parser")

    for tag in soup(["script","style"]):
        tag.decompose()

    return soup.get_text()


def split_chunks(text):

    splitter=RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP
    )

    return splitter.split_text(text)


import re

def extract_section_info(text):
    """
    Extract section number and title from chunk
    Example: 'Section 302 - Punishment for murder'
    """
    pattern = r"(Section\s+\d+[A-Za-z]?)\s*[-:]\s*(.*)"
    match = re.search(pattern, text, re.IGNORECASE)

    if match:
        return match.group(1), match.group(2)

    return "Unknown Section", "No Title"
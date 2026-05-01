from pydantic import BaseModel
from typing import Optional

class ChatRequest(BaseModel):
    question: str
    session_id: Optional[str] = None
    # ✅ FIX 2: language field so /chat can translate responses
    language: Optional[str] = "en"
    # ✅ FIX 6: doc_id to scope queries to a specific uploaded document
    doc_id: Optional[str] = None

class ChatResponse(BaseModel):
    answer: str
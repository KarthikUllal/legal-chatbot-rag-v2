from pydantic import BaseModel
from typing import Optional

class ChatRequest(BaseModel):
    question: str
    session_id: Optional[str] = None
    
    language: Optional[str] = "en"
   
    doc_id: Optional[str] = None

class ChatResponse(BaseModel):
    answer: str
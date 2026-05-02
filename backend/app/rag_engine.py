
import uuid
import re
from typing import List, Dict, Optional
from datetime import datetime
from pathlib import Path

from .vector_store import VectorStore
from .provider import NVIDIAProvider
from .prompts import LEGAL_QA_PROMPT, CASE_ANALYSIS_PROMPT, SUMMARY_PROMPT
from .ingestion import load_pdf, split_chunks, load_url

from langchain.schema import Document, BaseRetriever
from langchain.memory import ConversationBufferWindowMemory
from langchain.prompts import PromptTemplate
from langchain.chains import ConversationalRetrievalChain
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import AIMessage
from pydantic import Field
from typing import Any
from langchain_core.outputs import ChatResult, ChatGeneration


import logging
logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────
# Multilingual keyword maps for query enhancement
# ──────────────────────────────────────────────
MULTILINGUAL_LEGAL_KEYWORDS = {
    # BNS / Bharatiya Nyaya Sanhita equivalents
    "bns": "Bharatiya Nyaya Sanhita criminal law",
    "भारतीय न्याय संहिता": "Bharatiya Nyaya Sanhita criminal law BNS",
    "ಭಾರತೀಯ ನ್ಯಾಯ ಸಂಹಿತೆ": "Bharatiya Nyaya Sanhita BNS",
    "இந்திய நீதி சட்டம்": "Bharatiya Nyaya Sanhita BNS",

    # IPC equivalents
    "ipc": "Indian Penal Code law IPC",
    "भारतीय दंड संहिता": "Indian Penal Code IPC",
    "ಭಾರತೀಯ ದಂಡ ಸಂಹಿತೆ": "Indian Penal Code IPC",
    "இந்திய தண்டனை சட்டம்": "Indian Penal Code IPC",

    # Section keywords
    "section": "legal section explanation punishment",
    "धारा": "section legal punishment",
    "ವಿಭಾಗ": "section legal punishment",
    "பிரிவு": "section legal punishment",

    # General legal terms
    "punishment": "punishment imprisonment fine",
    "सजा": "punishment imprisonment fine",
    "ಶಿಕ್ಷೆ": "punishment imprisonment fine",
    "தண்டனை": "punishment imprisonment fine",
}

# Keywords that indicate a case/scenario question
CASE_SCENARIO_KEYWORDS = [
    "if", "scenario", "case", "accused", "arrested", "charged",
    "what happens", "what will happen", "can i", "can he", "can she",
    "is it legal", "is this legal", "what should", "what can",
    "my friend", "my husband", "my wife", "my employer", "my landlord",
    "someone", "person", "victim", "complaint", "FIR", "police",
    "मान लो", "अगर", "यदि", "ಒಂದು ವೇಳೆ", "என்னவாகும்",
    "arrested", "bail", "custody", "sued", "filed a case",
]

# Keywords that indicate a document overview request
SUMMARY_KEYWORDS = [
    "about", "overview", "summary", "summarize", "summarise",
    "what is this document", "tell me about document",
    "what is in document", "explain document", "describe document",
    "संक्षेप", "सारांश", "ಸಾರಾಂಶ", "சுருக்கம்",
]

class NVIDIAChatModel(BaseChatModel):
    provider: Any = Field(default=None)

    def __init__(self, provider):
        super().__init__()
        object.__setattr__(self, "provider", provider)

    def _generate(self, messages, stop=None):
        prompt = messages[-1].content

        response = self.provider.generate(prompt)

        return ChatResult(
            generations=[
                ChatGeneration(message=AIMessage(content=response))
            ]
        )

    @property
    def _llm_type(self):
        return "nvidia_chat"


class ChromaRetriever(BaseRetriever):
    vstore: Any = Field(default=None)
    doc_id: Any = Field(default=None)

    def __init__(self, vstore, doc_id=None):
        super().__init__()
        object.__setattr__(self, "vstore", vstore)
        object.__setattr__(self, "doc_id", doc_id)

    def _get_relevant_documents(self, query):
        results = self.vstore.query(query, k=5, doc_id=self.doc_id)
        docs = results.get("documents", [[]])[0]
        return [Document(page_content=d) for d in docs if d]

    async def _aget_relevant_documents(self, query):
        return self._get_relevant_documents(query)


class RAGEngine:
    def __init__(self):
        self.vstore = VectorStore()

        self.provider = NVIDIAProvider()
        self.llm = NVIDIAChatModel(self.provider)

        self.memory = ConversationBufferWindowMemory(
            k=2,
            memory_key="chat_history",
            return_messages=True
        )

        # self.prompt = PromptTemplate(
        #     input_variables=["context", "question", "chat_history"],
        #     template="""
        # You are Nyaya Mitra, an Indian legal assistant.

        # STRICT RULES:
        # 1. Answer ONLY using the provided Context.
        # 2. Do NOT use outside knowledge.
        # 3. Do NOT guess or assume anything.
        # 4. If answer is not in Context, say:
        # "I could not find this information in the provided legal documents."

        # RESPONSE STYLE:
        # - Clear and simple
        # - No extra explanation
        # - No assumptions

        # Context:
        # {context}

        # Chat History:
        # {chat_history}

        # Question:
        # {question}

        # Answer:
        # """
        # )
        self.prompt = PromptTemplate(
    input_variables=["context", "question", "chat_history"],
    template="""
You are Nyaya Mitra, an Indian legal assistant.

RULES:

1. Use Context as PRIMARY source.
2. If Context is insufficient → use general legal knowledge.
   → mention: "Based on general legal knowledge"

3. STRICT:
   - Do NOT invent section numbers
   - Do NOT guess legal provisions
   - If section not in Context → DO NOT mention it
   - Do NOT mention Chunk or internal references

4. Law priority:
   - Cyber issues → IT Act first
   - Criminal offences → BNS

5. Response must follow structure:
   - Applicable Laws
   - Offences
   - Steps to take
   - Rights (if relevant)

6. Language:
   - Keep answer natural
   - Avoid incorrect translation of legal terms

Context:
{context}

Chat History:
{chat_history}

Question:
{question}

Answer:
"""
)
        self.chain = None
        self._last_doc_id = None
        self.intent_cache = {}
        self.conversations = {}

    # ──────────────────────────────────────────
    # Query Enhancement
    # ──────────────────────────────────────────
    def enhance_query(self, question: str) -> str:
        """
        Append legal context keywords to make vector search more precise.
        Handles both English and common Indian language keywords.
        """
        enhanced = question
        q_lower = question.lower()

        for keyword, expansion in MULTILINGUAL_LEGAL_KEYWORDS.items():
            if keyword.lower() in q_lower:
                enhanced += f" {expansion}"

        return enhanced

    # ──────────────────────────────────────────
    # Query Type Detection
    # ──────────────────────────────────────────
    def detect_query_type(self, question: str) -> str:

        q = question.lower().strip()
        cached = self.intent_cache.get(q)
        if cached:
            return cached

        words = set(re.findall(r'\b\w+\b', q))

        if words.intersection({"hi", "hello", "hey", "namaste", "ನಮಸ್ಕಾರ", "नमस्ते"}):
            self.intent_cache[q] = "greeting"
            return "greeting"

        if words.intersection({"thank", "thanks", "धन्यवाद", "ಧನ್ಯವಾದ", "நன்றி"}):
            self.intent_cache[q] = "gratitude"
            return "gratitude"

        # 🔥 IMPORTANT FIX
        if len(q) > 120:
            self.intent_cache[q] = "case"
            return "case"

        if any(kw in q for kw in CASE_SCENARIO_KEYWORDS):
            self.intent_cache[q] = "case"
            return "case"

        if "procedure" in q or "steps" in q:
            self.intent_cache[q] = "case"
            return "case"

        if any(kw in q for kw in SUMMARY_KEYWORDS):
            self.intent_cache[q] = "summary"
            return "summary"

        # 🔥 smalltalk LAST
        if any(phrase in q for phrase in ["who are you", "what are you", "how are you"]):
            self.intent_cache[q] = "smalltalk"
            return "smalltalk"

        self.intent_cache[q] = "legal"
        return "legal"

    # ──────────────────────────────────────────
    # Result Re-ranking
    # ──────────────────────────────────────────
    def rerank_chunks(self, query: str, docs: List[str]) -> List[str]:

        q_words = set(query.lower().split())

        scored = []

        for doc in docs:
            doc_lower = doc.lower()
            doc_words = set(doc_lower.split())

            overlap = len(q_words & doc_words)

            bonus = 0
            if "section" in doc_lower:
                bonus += 3
            if "punishment" in doc_lower:
                bonus += 3
            if "offence" in doc_lower:
                bonus += 2

            score = overlap + bonus

            scored.append((score, doc))

        scored.sort(reverse=True, key=lambda x: x[0])

        return [doc for _, doc in scored[:3]]

    # ──────────────────────────────────────────
    # File Ingestion
    # ──────────────────────────────────────────
    def ingest_file(self, file_path: str, doc_id: str = None,
                    act_name: str = None, metadata: dict = None) -> dict:
        try:
            from .ingestion import extract_section_info

            text = load_pdf(file_path)
            if not text or not text.strip():
                return {"status": "error", "message": "PDF appears to be empty or unreadable."}

            chunks = split_chunks(text)

            base_metadata = metadata or {}
            resolved_doc_id = doc_id or str(uuid.uuid4())
            base_metadata.update({
                "doc_id": resolved_doc_id,
                "act": act_name or Path(file_path).stem,
                "filename": Path(file_path).name,
                "source_type": "pdf"
            })

            chunk_ids, chunk_texts, chunk_metadatas = [], [], []

            for i, chunk in enumerate(chunks):
                if not chunk or len(chunk.strip()) < 40:
                    continue

                chunk_id = f"{resolved_doc_id}_chunk_{i}"
                section, title = extract_section_info(chunk)

                chunk_metadata = {
                    "doc_id": resolved_doc_id,
                    "filename": base_metadata["filename"],
                    "act": base_metadata["act"],
                    "chunk_index": i,
                    "total_chunks": len(chunks),
                    "section": section,
                    "title": title
                }

                chunk_text = (
                    f"Document: {base_metadata['filename']}\n"
                    f"Chunk: {i}\n"
                    f"{chunk}"
                )

                chunk_ids.append(chunk_id)
                chunk_texts.append(chunk_text)
                chunk_metadatas.append(chunk_metadata)

            if chunk_ids:
                self.vstore.add(chunk_ids, chunk_texts, chunk_metadatas)
                logger.info(f"✅ Ingested {len(chunk_ids)} chunks from {file_path}")

            return {
                "status": "success",
                "chunks": len(chunk_ids),
                "document": base_metadata.get("filename"),
                "doc_id": resolved_doc_id
            }

        except Exception as e:
            logger.error(f"❌ Failed to ingest file: {e}")
            return {"status": "error", "message": str(e)}

    def ingest_url(self, url: str):
        text = load_url(url)
        self._process(text)

    def _process(self, text: str):
        chunks = split_chunks(text)
        ids = [str(uuid.uuid4()) for _ in chunks]
        metas = [{"chunk": i} for i in range(len(chunks))]
        self.vstore.add(ids, chunks, metas)

    # ──────────────────────────────────────────
    # Main Query Handler
    # ──────────────────────────────────────────
    def query(self, question: str, session_id: Optional[str] = None, doc_id: Optional[str] = None) -> str:

        q = question.strip()

        # basic intents (keep yours)
        query_type = self.detect_query_type(q)

        if query_type == "greeting":
            return "👋 Namaste! I'm Nyaya Mitra, your AI Legal Assistant."

        if query_type == "gratitude":
            return "🙏 You're welcome! Feel free to ask more legal questions."

        if query_type == "smalltalk":
            return "I'm Nyaya Mitra 🤖 — I can help with Indian laws and legal queries."

        # 🔹 create retriever using your Chroma
        retriever = ChromaRetriever(self.vstore, doc_id=doc_id)

        # 🔹 recreate chain if doc_id changed
        if self.chain is None or self._last_doc_id != doc_id:
            self.chain = ConversationalRetrievalChain.from_llm(
                llm=self.llm,
                retriever=retriever,
                memory=self.memory,
                combine_docs_chain_kwargs={"prompt": self.prompt}
            )
            self._last_doc_id = doc_id

        try:
            result = self.chain.invoke({"question": q})
            answer = result.get("answer", "").strip()
        except Exception as e:
            logger.error(f"LLM error: {e}")
            import traceback
            traceback.print_exc()
            return f"⚠️ ERROR: {str(e)}"
            # return "⚠️ Unable to process your request."

        return answer
    # ──────────────────────────────────────────
    # Conversation Storage
    # ──────────────────────────────────────────
    def store_conversation(self, session_id: str, question: str,
                           answer: str, language: str = "en"):
        if session_id not in self.conversations:
            self.conversations[session_id] = []

        self.conversations[session_id].append({
            "user_query": question,
            "legal_response": answer,
            "timestamp": datetime.now().strftime('%d %B %Y, %I:%M %p'),
            "session_id": session_id,
            "language": language
        })

    def get_full_transcript(self, session_id: str) -> List[Dict]:
        return self.conversations.get(session_id, [])
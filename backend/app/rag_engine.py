import uuid
from typing import List, Dict
from datetime import datetime
from pathlib import Path
import logging
from .vector_store import VectorStore
from .provider import NVIDIAProvider
from .prompts import LEGAL_QA_PROMPT
from .ingestion import load_pdf, load_txt, load_url, split_chunks


class RAGEngine:
    def __init__(self):
        self.vstore = VectorStore()
        self.llm = NVIDIAProvider()
        # Store conversations in memory (you might want to use a database in production)
        self.conversations = {}  # session_id -> list of conversations

    def ingest_file(self, file_path: str, doc_id: str = None, act_name: str = None, metadata: dict = None):
        """
        Ingest a file into the vector store
        """
        try:
            from .ingestion import load_pdf_text, split_into_chunks
            
            text = load_pdf_text(file_path)
            chunks = split_into_chunks(text)
            
            base_metadata = metadata or {}
            base_metadata.update({
                "doc_id": doc_id or str(uuid.uuid4()),
                "act": act_name or Path(file_path).stem,
                "filename": Path(file_path).name,
                "source_type": "pdf"
            })
            
            # Generate IDs for chunks
            chunk_ids = []
            chunk_texts = []
            chunk_metadatas = []
            
            for i, chunk in enumerate(chunks):
                chunk_id = f"{base_metadata['doc_id']}_chunk_{i}"
                chunk_ids.append(chunk_id)
                chunk_texts.append(chunk)
                
                # Copy metadata and add chunk index
                chunk_metadata = base_metadata.copy()
                chunk_metadata["chunk_index"] = i
                chunk_metadata["total_chunks"] = len(chunks)
                chunk_metadatas.append(chunk_metadata)
            
            # Add to vector store
            self.vstore.add(chunk_ids, chunk_texts, chunk_metadatas)
            
            logger.info(f"✅ Ingested {len(chunks)} chunks from {file_path}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to ingest file: {e}")
            return False

            self._process(text)

    def ingest_url(self, url):
        text = load_url(url)
        self._process(text)

    def _process(self, text):
        chunks = split_chunks(text)

        ids = []
        metas = []

        for i, c in enumerate(chunks):
            ids.append(str(uuid.uuid4()))
            metas.append({"chunk": i})

        self.vstore.add(ids, chunks, metas)

    def query(self, question):
        results = self.vstore.query(question)

        docs = results["documents"][0]

        context = "\n\n".join(docs)

        prompt = LEGAL_QA_PROMPT.format(
            context=context,
            question=question
        )

        answer = self.llm.generate(prompt)

        return answer

    def store_conversation(self, session_id: str, question: str, answer: str, language: str = "en"):
        """
        Store a conversation for a session
        """
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
        """
        Retrieve full transcript for a given session ID
        """
        return self.conversations.get(session_id, [])
# ✅ Patch: Override system sqlite3 with pysqlite3 (required for ChromaDB on Python 3.9 / Windows)
# ChromaDB requires sqlite3 >= 3.35.0 which isn't available in Python 3.9's stdlib on Windows.
try:
    import pysqlite3 as _pysqlite3
    import sys
    sys.modules["sqlite3"] = _pysqlite3
except ImportError:
    pass  # pysqlite3 not installed; ChromaDB may fail if system sqlite3 is < 3.35.0

import chromadb
from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction
from .config import CHROMA_DIR
import logging


logger = logging.getLogger(__name__)

class VectorStore:

    def __init__(self):

        self.client = chromadb.PersistentClient(path=CHROMA_DIR)

        # ✅ FIX 1: Use multilingual embedding model for proper non-English query support
        embedding_function = SentenceTransformerEmbeddingFunction(
            # model_name="sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
            model_name="BAAI/bge-small-en-v1.5"
        )

        self.collection = self.client.get_or_create_collection(
            name="legal_docs",
            embedding_function=embedding_function
        )

    def add(self, ids, docs, metas):

        self.collection.add(
            ids=ids,
            documents=docs,
            metadatas=metas
        )

    def query(self, query, k=8, doc_id: str = None):
        """
        Query the vector store.
        If doc_id is provided, results are filtered to that specific document only.
        This prevents cross-document hallucination when a user uploads a personal PDF.
        """
        try:
            # Clamp k to available document count to avoid ChromaDB errors
            count = self.collection.count()
            if count == 0:
                return {"documents": [[]], "metadatas": [[]], "distances": [[]]}
            k = min(k, count)

            query_kwargs = {
                "query_texts": [query],
                "n_results": k,
            }

            # ✅ FIX 6: Scope query to specific doc when provided
            if doc_id:
                query_kwargs["where"] = {"doc_id": {"$eq": doc_id}}

            return self.collection.query(**query_kwargs)

        except Exception as e:
            logger.error(f"VectorStore query error: {e}")
            return {"documents": [[]], "metadatas": [[]], "distances": [[]]}
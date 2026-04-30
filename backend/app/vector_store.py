import chromadb
from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction
from .config import CHROMA_DIR

class VectorStore:

    def __init__(self):

        self.client = chromadb.PersistentClient(path=CHROMA_DIR)

        # Multilingual embedding model
        embedding_function = SentenceTransformerEmbeddingFunction(
            # model_name="sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
            model_name = "all-MiniLM-L6-v2"
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

    def query(self, query, k=4):

        return self.collection.query(
            query_texts=[query],
            n_results=k
        )
# backend/app/admin_routes.py
from fastapi import APIRouter, UploadFile, File, HTTPException, Request
from pathlib import Path
import shutil
import os
import logging
import uuid
from datetime import datetime
from .rag_engine import RAGEngine
from .config import DATA_DIR

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin")

# Global engine instance
engine = RAGEngine()

MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB

@router.post("/upload")
async def upload_doc(request: Request, file: UploadFile = File(...)):
    """
    Upload a document to the vector store
    """
    try:
        if not file.filename.lower().endswith('.pdf'):
            raise HTTPException(status_code=400, detail="Only PDF files are supported")

        # Generate a unique document ID
        doc_id = str(uuid.uuid4())[:8]
        act_name = file.filename.replace('.pdf', '').replace('_', ' ').title()
        
        data_dir = Path(DATA_DIR)
        data_dir.mkdir(exist_ok=True)

        file_path = data_dir / file.filename
        
        # Save file
        file_size = 0
        with open(file_path, "wb") as f:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                f.write(chunk)
                file_size += len(chunk)
                
                if file_size > MAX_FILE_SIZE:
                    f.close()
                    file_path.unlink()
                    raise HTTPException(
                        status_code=413,
                        detail=f"File too large. Maximum size is {MAX_FILE_SIZE // (1024 * 1024)}MB"
                    )

        logger.info(f"File saved: {file_path} (size: {file_size} bytes)")

        # Ingest with proper metadata
        try:
            # Create metadata with act_name and doc_id
            metadata = {
                "act": act_name,
                "doc_id": doc_id,
                "filename": file.filename,
                "upload_date": datetime.now().isoformat(),
                "source_type": "pdf"
            }
            
            success = engine.ingest_file(
                file_path=str(file_path),
                doc_id=doc_id,
                act_name=act_name,
                metadata=metadata
            )
            
            if not success:
                raise Exception("Ingestion failed")
                
        except Exception as e:
            if file_path.exists():
                file_path.unlink()
            logger.error(f"Ingestion failed: {e}")
            raise HTTPException(status_code=500, detail=f"Ingestion failed: {str(e)}")

        return {
            "status": "success",
            "message": f"File {file.filename} uploaded and indexed successfully",
            "filename": file.filename,
            "doc_id": doc_id,
            "act_name": act_name,
            "size": file_size
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/documents")
async def list_documents():
    """
    List all documents in the vector store grouped by original document
    """
    try:
        collection = engine.vstore.collection
        results = collection.get(include=["metadatas", "documents"])
        
        documents = {}
        total_chunks = 0
        
        # Group by doc_id
        for i, (metadata, doc) in enumerate(zip(results["metadatas"], results["documents"])):
            if metadata:
                doc_id = metadata.get("doc_id", f"doc_{i}")
                act_name = metadata.get("act", "Unknown Document")
                filename = metadata.get("filename", "unknown.pdf")
                upload_date = metadata.get("upload_date", "Unknown")
                
                if doc_id not in documents:
                    documents[doc_id] = {
                        "id": doc_id,
                        "name": act_name,
                        "filename": filename,
                        "chunks": 0,
                        "upload_date": upload_date,
                        "sample": doc[:200] + "..." if doc and len(doc) > 200 else doc,
                        "chunk_ids": []
                    }
                documents[doc_id]["chunks"] += 1
                documents[doc_id]["chunk_ids"].append(results["ids"][i] if results["ids"] else f"chunk_{i}")
                total_chunks += 1
        
        # Convert to list and sort by name
        documents_list = list(documents.values())
        documents_list.sort(key=lambda x: x["name"])
        
        return {
            "status": "success",
            "documents": documents_list,
            "total_documents": len(documents_list),
            "total_chunks": total_chunks
        }
        
    except Exception as e:
        logger.error(f"Failed to list documents: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/documents/{doc_id}")
async def delete_document(doc_id: str):
    """
    Delete a specific document and all its chunks
    """
    try:
        collection = engine.vstore.collection
        results = collection.get(include=["metadatas"])
        
        ids_to_delete = []
        for i, metadata in enumerate(results["metadatas"]):
            if metadata and metadata.get("doc_id") == doc_id:
                ids_to_delete.append(results["ids"][i])
        
        if ids_to_delete:
            collection.delete(ids=ids_to_delete)
            
            # Also delete the physical file if it exists
            try:
                # Try to find the filename from metadata
                for metadata in results["metadatas"]:
                    if metadata and metadata.get("doc_id") == doc_id:
                        filename = metadata.get("filename")
                        if filename:
                            file_path = Path(DATA_DIR) / filename
                            if file_path.exists():
                                file_path.unlink()
                                logger.info(f"Deleted physical file: {filename}")
                        break
            except Exception as file_error:
                logger.warning(f"Could not delete physical file: {file_error}")
            
            return {
                "status": "success",
                "message": f"Deleted {len(ids_to_delete)} chunks for document {doc_id}"
            }
        else:
            return {
                "status": "error",
                "message": f"Document {doc_id} not found"
            }
            
    except Exception as e:
        logger.error(f"Failed to delete document: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/clear-all")
async def clear_all_documents():
    """
    Clear ALL documents from the vector store
    """
    try:
        collection = engine.vstore.collection
        count = collection.count()
        
        if count > 0:
            # Get all IDs
            results = collection.get()
            collection.delete(ids=results["ids"])
            
            # Also clear physical files
            data_dir = Path(DATA_DIR)
            if data_dir.exists():
                for file_path in data_dir.glob("*.pdf"):
                    try:
                        file_path.unlink()
                        logger.info(f"Deleted physical file: {file_path.name}")
                    except Exception as e:
                        logger.warning(f"Could not delete {file_path.name}: {e}")
            
            return {
                "status": "success",
                "message": f"Cleared {count} chunks from vector store"
            }
        else:
            return {
                "status": "success",
                "message": "Vector store is already empty"
            }
            
    except Exception as e:
        logger.error(f"Failed to clear documents: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats")
async def get_stats():
    """
    Get system statistics
    """
    try:
        collection = engine.vstore.collection
        count = collection.count()
        
        # Get document count
        results = collection.get(include=["metadatas"])
        unique_docs = set()
        
        for metadata in results["metadatas"]:
            if metadata and "doc_id" in metadata:
                unique_docs.add(metadata["doc_id"])
        
        return {
            "status": "success",
            "stats": {
                "total_chunks": count,
                "total_documents": len(unique_docs),
                "embedding_model": "all-MiniLM-L6-v2",
                "llm_provider": "NVIDIA",
                "data_directory": str(DATA_DIR)
            }
        }
    except Exception as e:
        logger.error(f"Failed to get stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))
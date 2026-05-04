from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pathlib import Path
import shutil
import io
from datetime import datetime
from typing import List, Dict, Optional
from pydantic import BaseModel

# ReportLab for PDF generation
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.colors import grey

from .schemas import ChatRequest, ChatResponse
from .rag_engine import RAGEngine
from .config import DATA_DIR
from .news_routes import router as news_router
from .admin_routes import router as admin_router


from .translation import translator
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Nyaya Mitra Legal AI",
    description="AI-based Legal Chatbot using RAG and NVIDIA NIM",
    version="1.0"
)

# Enable CORS for frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize RAG engine
from .core_engine import engine

# Include additional routers
app.include_router(news_router)
app.include_router(admin_router)


# -------------------------------
# Chat endpoint
# -------------------------------
@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    """
    Ask a legal question to the chatbot.
    Supports: language translation, document-scoped queries.
    """
    # ✅ FIX 6: Pass doc_id for document-scoped vector search
    answer = engine.query(
        req.question,
        session_id=req.session_id,
        doc_id=req.doc_id
    )

    # ✅ FIX 2: Translate response if language is not English
    language = req.language or "en"
    if language != "en":
        from .translation import translator
        answer = translator.translate_legal_response(answer, language)

    # Store conversation
    if req.session_id:
        engine.store_conversation(req.session_id, req.question, answer, language)

    return {"answer": answer}


# -------------------------------
# Upload document through chat
# -------------------------------
@app.post("/chat-upload")
async def chat_upload(file: UploadFile = File(...)):
    """
    Upload PDF or TXT file during chat.
    Document will be chunked and added to vector database.
    """
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    data_dir = Path(DATA_DIR)
    data_dir.mkdir(exist_ok=True)

    file_path = data_dir / file.filename

    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    # ✅ FIX 3: Capture result dict so we can return chunk count to frontend
    result = engine.ingest_file(str(file_path))

    if not result or result.get("status") == "error":
        raise HTTPException(status_code=500, detail=result.get("message", "Ingestion failed"))

    return {
        "status": "indexed",
        "filename": file.filename,
        "chunks": result.get("chunks", 0),
        "doc_id": result.get("doc_id", ""),
    }


# -------------------------------
# Ingest URL content
# -------------------------------
@app.post("/ingest-url")
def ingest_url(data: dict):
    """
    Ingest legal information directly from a webpage URL.
    """

    url = data.get("url")

    if not url:
        return {"error": "URL not provided"}

    engine.ingest_url(url)

    return {
        "status": "url indexed",
        "url": url
    }


# -------------------------------
# Health check endpoint
# -------------------------------
@app.get("/health")
def health():
    return {
        "status": "running",
        "service": "Nyaya Mitra Legal AI"
    }


# ============================================
# TRANSCRIPT DOWNLOAD ENDPOINTS
# ============================================

def format_lawyer_transcript(transcript: List[Dict]) -> str:
    """
    Format transcript as a lawyer-style text document
    """
    lines = []

    lines.append("=" * 70)
    lines.append("LEGAL AI CHATBOT – CONSULTATION TRANSCRIPT".center(70))
    lines.append("=" * 70)
    lines.append(f"Jurisdiction    : India")
    lines.append(f"Generated On    : {datetime.now().strftime('%d %B %Y, %I:%M %p')}")
    lines.append(f"Session ID      : {transcript[0].get('session_id', 'N/A') if transcript else 'N/A'}")
    lines.append("=" * 70)

    for idx, turn in enumerate(transcript, start=1):
        lines.append(f"\n{'=' * 70}")
        lines.append(f"CONSULTATION QUERY {idx}".center(70))
        lines.append(f"{'=' * 70}")
        
        lines.append("\n📝 CLIENT QUERY:")
        lines.append("-" * 30)
        lines.append(turn.get("user_query", "N/A"))

        lines.append("\n⚖️ LEGAL OPINION:")
        lines.append("-" * 30)
        lines.append(turn.get("legal_response", "N/A"))

        lines.append("\n⏰ TIMESTAMP:")
        lines.append("-" * 30)
        lines.append(turn.get("timestamp", datetime.now().strftime('%d %B %Y, %I:%M %p')))

        lines.append("\n⚠️ DISCLAIMER:")
        lines.append("-" * 30)
        lines.append(
            "This response is generated by an AI legal assistant (Nyaya Mitra) for informational "
            "purposes only and does not constitute professional legal advice. "
            "Please consult with a qualified legal professional for specific legal guidance."
        )

    lines.append("\n" + "=" * 70)
    lines.append("END OF TRANSCRIPT".center(70))
    lines.append("=" * 70)

    return "\n".join(lines)


@app.get("/transcript/download/{session_id}")
async def download_transcript_txt(session_id: str):
    """
    Download chat transcript as a formatted text file
    """
    # Get transcript from engine
    transcript = engine.get_full_transcript(session_id)

    if not transcript or len(transcript) == 0:
        raise HTTPException(status_code=404, detail="No transcript found for this session")

    # Format the transcript
    content = format_lawyer_transcript(transcript)
    
    # Generate filename
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f"legal_consultation_{session_id}_{timestamp}.txt"

    return Response(
        content=content,
        media_type="text/plain",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )


@app.get("/transcript/download/pdf/{session_id}")
async def download_transcript_pdf(session_id: str):
    """
    Download chat transcript as a formatted PDF file
    """
    # Get transcript from engine
    transcript = engine.get_full_transcript(session_id)

    if not transcript or len(transcript) == 0:
        raise HTTPException(status_code=404, detail="No transcript found for this session")

    # Create PDF buffer
    buffer = io.BytesIO()

    # Create PDF document
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=0.75*inch,
        leftMargin=0.75*inch,
        topMargin=0.75*inch,
        bottomMargin=0.75*inch
    )

    # Get default styles
    styles = getSampleStyleSheet()

    # Add custom styles
    styles.add(ParagraphStyle(
        name="CustomTitle",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=16,
        spaceAfter=20,
        alignment=TA_CENTER,
        textColor="#1e3a8a"
    ))

    styles.add(ParagraphStyle(
        name="SectionHeader",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=14,
        spaceBefore=15,
        spaceAfter=10,
        textColor="#1e40af"
    ))

    styles.add(ParagraphStyle(
        name="QueryLabel",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=11,
        spaceBefore=10,
        textColor="#374151"
    ))

    styles.add(ParagraphStyle(
        name="QueryText",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=11,
        spaceAfter=10,
        leftIndent=20,
        textColor="#1f2937"
    ))

    styles.add(ParagraphStyle(
        name="ResponseLabel",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=11,
        spaceBefore=15,
        textColor="#374151"
    ))

    styles.add(ParagraphStyle(
        name="ResponseText",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=11,
        spaceAfter=15,
        leftIndent=20,
        textColor="#1f2937"
    ))

    styles.add(ParagraphStyle(
        name="Disclaimer",
        parent=styles["Italic"],
        fontName="Helvetica-Oblique",
        fontSize=9,
        spaceBefore=15,
        spaceAfter=10,
        textColor=grey,
        alignment=TA_CENTER
    ))

    styles.add(ParagraphStyle(
        name="Metadata",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10,
        spaceAfter=5,
        textColor="#4b5563"
    ))

    elements = []

    # Document Header
    elements.append(Paragraph("NYAYA MITRA LEGAL AI", styles["CustomTitle"]))
    elements.append(Paragraph("CONSULTATION TRANSCRIPT", styles["SectionHeader"]))
    
    # Metadata
    elements.append(Paragraph(f"<b>Session ID:</b> {session_id}", styles["Metadata"]))
    elements.append(Paragraph(f"<b>Generated On:</b> {datetime.now().strftime('%d %B %Y, %I:%M %p')}", styles["Metadata"]))
    elements.append(Paragraph(f"<b>Jurisdiction:</b> India", styles["Metadata"]))
    elements.append(Spacer(1, 0.2*inch))

    # Horizontal line
    elements.append(Paragraph("<hr/>", styles["Normal"]))

    # Transcript Content
    for idx, turn in enumerate(transcript, start=1):
        # Query number
        elements.append(Paragraph(f"QUERY {idx}", styles["SectionHeader"]))
        
        # User Query
        elements.append(Paragraph("📝 CLIENT QUERY:", styles["QueryLabel"]))
        elements.append(Paragraph(turn.get("user_query", "N/A").replace('\n', '<br/>'), styles["QueryText"]))
        
        # Legal Response
        elements.append(Paragraph("⚖️ LEGAL OPINION:", styles["ResponseLabel"]))
        elements.append(Paragraph(turn.get("legal_response", "N/A").replace('\n', '<br/>'), styles["ResponseText"]))
        
        # Timestamp
        timestamp = turn.get("timestamp", datetime.now().strftime('%d %B %Y, %I:%M %p'))
        elements.append(Paragraph(f"<i>{timestamp}</i>", styles["Metadata"]))
        
        # Add separator between queries
        if idx < len(transcript):
            elements.append(Paragraph("<hr width='50%'/>", styles["Normal"]))
            elements.append(Spacer(1, 0.1*inch))

    # Disclaimer
    elements.append(Spacer(1, 0.3*inch))
    elements.append(Paragraph("<hr/>", styles["Normal"]))
    elements.append(Paragraph(
        "⚠️ <b>DISCLAIMER</b>", 
        styles["QueryLabel"]
    ))
    elements.append(Paragraph(
        "This document is generated by an AI legal assistant (Nyaya Mitra) for informational "
        "purposes only and does not constitute professional legal advice. The responses are "
        "based on available legal information and may not be complete or up-to-date. "
        "Always consult with a qualified legal professional for specific legal guidance.",
        styles["Disclaimer"]
    ))

    # Build PDF
    doc.build(elements)

    # Get PDF from buffer
    buffer.seek(0)
    
    # Generate filename
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f"legal_consultation_{session_id}_{timestamp}.pdf"

    return Response(
        content=buffer.read(),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )


# ============================================
# TRANSLATION CHAT ENDPOINT
# ============================================

class TranslateRequest(BaseModel):
    question: str
    language: str = "en"
    session_id: str = "default"
    doc_id: Optional[str] = None


@app.post("/chat-translate", response_model=ChatResponse)
async def chat_with_translation(req: TranslateRequest):
    """
    Chat endpoint with language translation.
    ✅ FIX 9: Accepts JSON body (not query params) to support long/special-char questions.
    Supports: en, hi, kn, ta, te, mr, bn
    """
    try:
        logger.info(f"Translation chat: '{req.question[:50]}' → language={req.language}")

        # Get answer from RAG engine (optionally scoped to a doc)
        answer = engine.query(req.question, doc_id=req.doc_id)

        # Translate if language is not English
        if req.language != "en":
            answer = translator.translate_legal_response(answer, req.language)

        # Store conversation
        if req.session_id:
            engine.store_conversation(req.session_id, req.question, answer, req.language)

        logger.info(f"✅ Response in {translator.supported_languages.get(req.language, req.language)}")
        return {"answer": answer}

    except Exception as e:
        logger.error(f"Translation chat failed: {e}")
        error_msg = f"Failed to process question: {str(e)}"
        if req.language != "en":
            try:
                error_msg = translator.translate_legal_response(error_msg, req.language)
            except Exception:
                pass
        raise HTTPException(status_code=500, detail=error_msg)

#news_routes.py
from fastapi import APIRouter
from .news_service import get_news

router=APIRouter(prefix="/news")

@router.get("/")

def news():

    return {"articles":get_news()}
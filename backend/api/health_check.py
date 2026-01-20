"""
Health check endpoint for monitoring and Docker healthcheck.

Эндпоинт: GET /health
"""

from fastapi import APIRouter

router = APIRouter(tags=["Health"])


@router.get("/health")
async def health_check():
    """
    Health check endpoint.
    
    Used by Docker healthcheck and monitoring systems.
    
    Returns:
        dict: Status information
    """
    return {"status": "healthy"}

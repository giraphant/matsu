"""
Middleware for error handling and request logging.
"""

import time
import traceback
from fastapi import Request, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.logger import get_logger

logger = get_logger(__name__)


class ErrorHandlerMiddleware(BaseHTTPMiddleware):
    """Middleware to handle uncaught exceptions and log requests."""

    async def dispatch(self, request: Request, call_next):
        """
        Process the request and handle any exceptions.

        Args:
            request: The incoming request
            call_next: The next middleware or route handler

        Returns:
            Response from the route handler or error response
        """
        start_time = time.time()

        try:
            # Log the incoming request
            logger.debug(f"{request.method} {request.url.path}")

            # Process the request
            response = await call_next(request)

            # Log the response time
            process_time = time.time() - start_time
            logger.debug(f"{request.method} {request.url.path} completed in {process_time:.3f}s - Status: {response.status_code}")

            return response

        except Exception as e:
            # Log the error with full traceback
            process_time = time.time() - start_time
            logger.error(
                f"{request.method} {request.url.path} failed after {process_time:.3f}s\n"
                f"Error: {str(e)}\n"
                f"Traceback:\n{traceback.format_exc()}"
            )

            # Return a JSON error response
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "detail": "Internal server error",
                    "error": str(e),
                    "path": str(request.url.path)
                }
            )


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware to log request details for monitoring and debugging."""

    async def dispatch(self, request: Request, call_next):
        """
        Log request details and timing.

        Args:
            request: The incoming request
            call_next: The next middleware or route handler

        Returns:
            Response from the route handler
        """
        start_time = time.time()

        # Log incoming request
        client_host = request.client.host if request.client else "unknown"
        logger.info(f"Request: {request.method} {request.url.path} from {client_host}")

        # Process the request
        response = await call_next(request)

        # Log response details
        process_time = (time.time() - start_time) * 1000  # Convert to milliseconds
        logger.info(
            f"Response: {request.method} {request.url.path} - "
            f"Status: {response.status_code} - "
            f"Time: {process_time:.2f}ms"
        )

        # Add custom header with processing time
        response.headers["X-Process-Time"] = f"{process_time:.2f}ms"

        return response

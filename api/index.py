"""
Vercel Python Serverless entry point.
This file wraps the FastAPI app with Mangum so it can run as a
Vercel/AWS-Lambda-compatible serverless function.
"""
import sys
import os

# Make sure the project root is on the path so `backend.*` imports resolve
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from mangum import Mangum
from backend.main import app  # noqa: E402  (imported after sys.path fix)

handler = Mangum(app, lifespan="off")

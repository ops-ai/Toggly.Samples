"""Uvicorn imports this module separately in each worker (no SDK work at import)."""
from dotenv import load_dotenv
from showcase import create_app

load_dotenv()  # Only the ignored local .env; environment values take precedence.
application = create_app()

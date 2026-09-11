"""Gunicorn imports this inside each worker; do not enable preload."""
from dotenv import load_dotenv
load_dotenv('.env')
from showcase import create_app
application = create_app()

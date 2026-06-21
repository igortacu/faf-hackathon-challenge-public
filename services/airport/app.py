import logging
import time
import uuid
from datetime import datetime, timezone

from flask import Flask, g, request
from models import db
from config import DATABASE_PATH
from broadcast import BroadcastClient
from gate_manager import GateManager
from routes import register_routes

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)


def register_request_logging(app):
    """One logfmt access-log line per request, with a correlation id (X-Request-Id)
    reused from the caller or freshly generated, echoed back on the response so it
    can be joined with the gateway's and any other service's logs. See
    OBSERVABILITY.md for the schema."""

    @app.before_request
    def _start_request():
        g.request_id = request.headers.get("X-Request-Id") or uuid.uuid4().hex[:12]
        g.start_time = time.perf_counter()

    @app.after_request
    def _log_request(response):
        duration_ms = (time.perf_counter() - g.start_time) * 1000
        logger.info(
            "ts=%s level=info service=airport request_id=%s method=%s path=%s status=%s duration_ms=%.1f",
            datetime.now(timezone.utc).isoformat(), g.request_id, request.method,
            request.path, response.status_code, duration_ms,
        )
        response.headers["X-Request-Id"] = g.request_id
        return response


def create_app():
    app = Flask(__name__)

    # Database config
    app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{DATABASE_PATH}"
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    register_request_logging(app)

    # Initialize SQLAlchemy
    db.init_app(app)
    with app.app_context():
        db.create_all()

    # Create components
    broadcast_client = BroadcastClient()
    gate_manager = GateManager(app, broadcast_client)
    gate_manager.start_all()

    # Store on app for route handlers
    app.gate_manager = gate_manager

    # Register routes
    register_routes(app)

    return app


app = create_app()

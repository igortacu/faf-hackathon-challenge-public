from flask import request, jsonify
from marshmallow import ValidationError
from models import Arrival
from schemas import ArrivalInputSchema, ArrivalSchema
from game_time import game_now
from stats import get_stats

arrival_input_schema = ArrivalInputSchema()
arrival_schema = ArrivalSchema()
arrivals_schema = ArrivalSchema(many=True)


def register_routes(app):

    @app.route("/arrivals", methods=["POST"])
    def create_arrival():
        data = request.get_json(silent=True)
        if not data:
            return jsonify({"error": "Request body must be valid JSON"}), 400

        try:
            guest = arrival_input_schema.load(data)
        except ValidationError as err:
            return jsonify({"errors": err.messages}), 400

        result = app.gate_manager.assign_and_enqueue(guest)
        return jsonify(result), 202

    @app.route("/arrivals/<guest_id>", methods=["GET"])
    def get_arrival(guest_id):
        guest = app.gate_manager.get_guest(guest_id)
        if not guest:
            return jsonify({"error": "Guest not found"}), 404

        position = None
        # Time remaining until the guest clears control (game seconds). Only
        # meaningful while still waiting; None for processed/held guests so the
        # assistant says "can't determine" instead of guessing a number.
        estimated_wait_seconds = None
        if guest["status"] in ("queued", "processing", "held"):
            position = app.gate_manager.get_guest_position(guest_id, guest["gate"])
            estimated_wait_seconds = app.gate_manager.get_estimated_wait(guest_id, guest["gate"])

        if guest["status"] == "processed":
            wait_time = guest["wait_time_seconds"]
        else:
            wait_time = game_now() - guest["queued_at"]

        return jsonify({
            "guest_id": guest["guest_id"],
            "status": guest["status"],
            "gate": guest["gate"],
            "position": position,
            "queued_at": guest["queued_at"],
            "processed_at": guest.get("processed_at"),
            "wait_time_seconds": wait_time,
            "estimated_wait_seconds": estimated_wait_seconds,
        }), 200

    @app.route("/arrivals", methods=["GET"])
    def list_arrivals():
        query = Arrival.query

        status = request.args.get("status")
        if status:
            query = query.filter_by(status=status)

        passport_type = request.args.get("passport_type")
        if passport_type:
            query = query.filter_by(passport_type=passport_type)

        total = query.count()

        limit_param = request.args.get("limit")
        cursor_param = request.args.get("cursor")

        if cursor_param is not None:
            try:
                cursor_id = int(cursor_param)
            except (ValueError, TypeError):
                return jsonify({"error": "Invalid cursor"}), 400
            query = query.filter(Arrival.id < cursor_id)

        query = query.order_by(Arrival.id.desc())

        if limit_param is not None:
            try:
                limit = int(limit_param)
            except (ValueError, TypeError):
                return jsonify({"error": "Invalid limit"}), 400
            if limit < 0:
                return jsonify({"error": "Limit must be non-negative"}), 400
            arrivals = query.limit(limit + 1).all()
            if len(arrivals) > limit:
                arrivals = arrivals[:limit]
                next_cursor = arrivals[-1].id
            else:
                next_cursor = None
        else:
            arrivals = query.all()
            next_cursor = None

        return jsonify({
            "arrivals": arrivals_schema.dump(arrivals),
            "next_cursor": next_cursor,
            "total": total,
        }), 200

    @app.route("/admin/gates", methods=["POST"])
    def open_gate():
        data = request.get_json(silent=True)
        if not data:
            return jsonify({"error": "Request body must be valid JSON"}), 400

        gate_id = data.get("gate_id")
        gate_type = data.get("gate_type")
        if not gate_id or not gate_type:
            return jsonify({"error": "gate_id and gate_type are required"}), 400

        result = app.gate_manager.open_gate(gate_id, gate_type)
        if "error" in result:
            return jsonify(result), 409
        return jsonify(result), 201

    @app.route("/admin/gates/<gate_id>", methods=["DELETE"])
    def close_gate(gate_id):
        result = app.gate_manager.close_gate(gate_id)
        if "error" in result:
            code = 404 if "not found" in result["error"] else 409
            return jsonify(result), code
        return jsonify(result), 200

    @app.route("/queue", methods=["GET"])
    def get_queue():
        return jsonify(app.gate_manager.get_all_gates_status()), 200

    @app.route("/stats", methods=["GET"])
    def get_stats_route():
        return jsonify(get_stats()), 200

    @app.route("/health", methods=["GET"])
    def health():
        return jsonify({"status": "ok"}), 200

"""Choose the optimal LLM model for the Parrot service, with MLflow.

RESEARCH card: "Choose optimal LLM model and prompting strategy for Parrot".
This evaluates several OpenRouter models against Parrot's *real* tasks and logs
everything to MLflow so the choice is backed by comparison criteria and findings.

Parrot is a tool-calling resort assistant (see services/parrot/llm.py): for
almost any resort question it must call the right tool BEFORE answering, stay
concise, and never fabricate data. So we score on the card's four criteria:

  - accuracy / instruction-following -> deterministic `called_expected_tool` +
    `concise_answer` + `no_fabrication`, plus MLflow LLM-judge Guidelines.
  - latency  -> measured wall-clock per request (`latency_scorer`, lower better).
  - cost     -> token usage priced per model (`cost_scorer`, lower better).

Because Parrot already talks to OpenRouter via the OpenAI-compatible API
(llm_base_url = https://openrouter.ai/api/v1), we hit the exact same endpoint
the production service uses — so the comparison reflects production behaviour.

How to run
----------
  cd test_ai
  # reuses the repo's existing OpenRouter creds from ../.env (LLM_API_KEY)
  .venv/bin/pip install "openai>=1.0" mlflow tabulate python-dotenv
  .venv/bin/python parrot_model_comparison.py

Then open the MLflow UI to compare runs:
  .venv/bin/mlflow ui   # http://127.0.0.1:5000

Set JUDGE_MODEL to an OpenRouter model id you trust as the grader (defaults to a
strong, cheap judge). The judge is also billed through OpenRouter.

NOTE: This makes real, paid OpenRouter calls. Costs are small (10 prompts x a
few models) but non-zero.
"""

import os
import sys
import time
import json

import mlflow
from mlflow.genai import judges, scorer
from openai import OpenAI
from dotenv import load_dotenv
from tabulate import tabulate

# Reuse the repo-root .env so we share Parrot's OpenRouter key / base url.
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

# We want the eval to use the EXACT same system prompt and tool schemas the
# production assistant uses (no drift between what we test and what ships) — but
# importing services/parrot/llm.py would drag in Parrot's whole runtime
# (pydantic_settings, httpx, the service clients). Instead we load just those two
# constants out of the source files, so this harness only needs openai + mlflow.
PARROT_DIR = os.path.join(os.path.dirname(__file__), "..", "services", "parrot")


def _load_parrot_constants():
    """Extract SYSTEM_PROMPT_BASE, TOOL_SCHEMAS, GUEST_TOOL_SCHEMAS from source.

    Reads llm.py / tools.py as text and exec()s only the constant assignments,
    avoiding their heavy import side effects. If the source layout ever changes,
    this fails loudly here rather than silently testing a stale prompt.
    """
    ns: dict = {}
    with open(os.path.join(PARROT_DIR, "tools.py")) as f:
        src = f.read()
    # tools.py defines the schemas as plain literals; strip its imports and run
    # only up to the end of GUEST_TOOL_SCHEMAS.
    start = src.index("TOOL_SCHEMAS = [")
    end = src.index("_DISPATCH")
    exec(src[start:end], ns)

    with open(os.path.join(PARROT_DIR, "llm.py")) as f:
        llm_src = f.read()
    p_start = llm_src.index("SYSTEM_PROMPT_BASE = ")
    p_end = llm_src.index('"""\n', p_start + len("SYSTEM_PROMPT_BASE = ") + 4) + 3
    exec(llm_src[p_start:p_end], ns)

    return ns["SYSTEM_PROMPT_BASE"], ns["TOOL_SCHEMAS"], ns["GUEST_TOOL_SCHEMAS"]


SYSTEM_PROMPT_BASE, TOOL_SCHEMAS, GUEST_TOOL_SCHEMAS = _load_parrot_constants()

from parrot_eval_dataset import EVAL_CASES  # noqa: E402

BASE_URL = os.getenv("LLM_BASE_URL", "https://openrouter.ai/api/v1")
API_KEY = os.getenv("LLM_API_KEY", "")

# The 5 candidate models to compare. All support OpenAI-style tool-calling, which
# Parrot requires. Prices are USD per 1M tokens (prompt, completion) from
# OpenRouter at time of writing — adjust if OpenRouter pricing changes. Used only
# to rank cost; they do not affect what is actually billed.
CANDIDATE_MODELS = [
    # (model_id, prompt_price_per_1m, completion_price_per_1m)
    ("meta-llama/llama-3.1-8b-instruct", 0.02, 0.03),    # current Parrot default
    ("meta-llama/llama-3.3-70b-instruct", 0.10, 0.25),
    ("qwen/qwen-2.5-72b-instruct", 0.12, 0.39),
    ("openai/gpt-4o-mini", 0.15, 0.60),
    ("anthropic/claude-haiku-4.5", 1.00, 5.00),
]

# Model used by the MLflow LLM-judge scorers (Guidelines). Billed via OpenRouter.
JUDGE_MODEL = os.getenv("JUDGE_MODEL", "openai/gpt-4o-mini")

# Parrot's production sampling params (services/parrot/config.py defaults).
TEMPERATURE = float(os.getenv("LLM_TEMPERATURE", "0.4"))
MAX_TOKENS = int(os.getenv("LLM_MAX_TOKENS", "600"))
TOP_P = float(os.getenv("LLM_TOP_P", "1.0"))

if not API_KEY or API_KEY in ("", "API_KEY"):
    sys.exit(
        "LLM_API_KEY is not set in ../.env — add your OpenRouter key before running."
    )

client = OpenAI(base_url=BASE_URL, api_key=API_KEY)

# MLflow's LLM-judge needs its own model handle. We route it through OpenRouter
# using the openai:/<model> URI plus the OpenAI-compatible base url/key.
os.environ.setdefault("OPENAI_API_KEY", API_KEY)
os.environ.setdefault("OPENAI_API_BASE", BASE_URL)
os.environ.setdefault("OPENAI_BASE_URL", BASE_URL)


def _build_messages(case: dict) -> list[dict]:
    """Recreate Parrot's message assembly for a single guest turn."""
    system_prompt = SYSTEM_PROMPT_BASE
    if case.get("requires_guest"):
        system_prompt += "\nThe current guest's ID is: guest-kiki-0001\n"
    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": case["message"]},
    ]


def _tools_for(case: dict) -> list[dict]:
    tools = list(TOOL_SCHEMAS)
    if case.get("requires_guest"):
        tools.extend(GUEST_TOOL_SCHEMAS)
    return tools


# Realistic stub tool results, mirroring the shape services/parrot/services.py
# returns, so the model's FINAL answer is grounded in plausible live data. The
# eval doesn't hit the real airport/hotel/crab services — these stand in for them
# so we can judge the answer the guest would actually see.
_STUB_TOOL_RESULTS = {
    "get_airport_stats": {
        "total_arrivals": 412, "total_processed": 388, "currently_in_queue": 18,
        "currently_processing": 6, "avg_wait_time_seconds": 540,
        "passport_distribution": {"EU": 240, "non-EU": 172},
    },
    "get_airport_queue_status": {
        "gates": [
            {"gate_id": "EU-1", "gate_type": "EU", "queue_size": 4},
            {"gate_id": "ALL-1", "gate_type": "ALL", "queue_size": 7},
        ],
        "total_queued": 11, "current_game_time": 36000,
    },
    "get_hotel_rooms": {
        "rooms": [
            {"type": "Ocean Suite", "capacity": 2, "price_per_night": 220, "available": 3},
            {"type": "Garden Room", "capacity": 2, "price_per_night": 140, "available": 5},
            {"type": "Family Cabana", "capacity": 4, "price_per_night": 310, "available": 1},
        ],
    },
    "get_crab_menu": {
        "items": [
            {"name": "Krabby Patty", "price_clamshells": 12, "available": True},
            {"name": "Kelp Shake", "price_clamshells": 5, "available": True},
            {"name": "Coral Bisque", "price_clamshells": 9, "available": False},
        ],
    },
    "get_guest_arrival_status": {
        "guest_id": "guest-kiki-0001", "status": "processing", "gate": "EU-1",
        "position": 2, "wait_time_seconds": 300,
    },
    "get_guest_reservation": {
        "guest_id": "guest-kiki-0001", "room_type": "Ocean Suite",
        "nights": 3, "checked_in": False,
    },
    "get_guest_journey_status": {
        "arrival": {"status": "processing", "gate": "EU-1", "position": 2},
        "reservation": {"room_type": "Ocean Suite", "nights": 3, "checked_in": False},
    },
}


def _stub_tool_result(name: str) -> str:
    return json.dumps(_STUB_TOOL_RESULTS.get(name, {"error": f"Unknown tool: {name}"}))


# Cap on assistant turns, mirroring MAX_TOOL_ROUNDS in services/parrot/llm.py.
MAX_TOOL_ROUNDS = 5


def make_predict_fn(model_id: str, prices: tuple[float, float], collector: list | None = None):
    """Return an MLflow predict_fn closured over one candidate model.

    Runs Parrot's real loop: the model calls tools, we feed back realistic stub
    tool results (_STUB_TOOL_RESULTS), and it loops until it produces a final
    natural-language answer (or MAX_TOOL_ROUNDS is hit). We record the FIRST
    tool the model chose (the key instruction-following signal) and the FINAL
    answer (what the guest sees, and what the quality judge grades). Latency and
    token cost are summed across every turn, so they reflect the full cost of
    answering — tool round-trips included.

    If `collector` is given, each call appends its per-case stats (latency,
    tokens, cost) to it, so the caller can average them after evaluate() — MLflow
    doesn't surface these in its results table, so we track them ourselves.
    """
    prompt_price, completion_price = prices

    def predict_fn(message: str, requires_guest: bool) -> dict:
        case = {"message": message, "requires_guest": requires_guest}
        messages = _build_messages(case)
        tools = _tools_for(case)

        first_tool = None
        total_latency_ms = 0.0
        total_p_tok = 0
        total_c_tok = 0
        answer_text = ""

        t_start = time.perf_counter()
        for round_idx in range(MAX_TOOL_ROUNDS):
            resp = client.chat.completions.create(
                model=model_id,
                messages=messages,
                tools=tools,
                temperature=TEMPERATURE,
                max_tokens=MAX_TOKENS,
                top_p=TOP_P,
            )
            usage = resp.usage
            total_p_tok += getattr(usage, "prompt_tokens", 0) or 0
            total_c_tok += getattr(usage, "completion_tokens", 0) or 0

            choice = resp.choices[0]
            tool_calls = choice.message.tool_calls or []

            if not tool_calls:
                answer_text = choice.message.content or ""
                break

            if first_tool is None:
                first_tool = tool_calls[0].function.name

            # Append the assistant's tool-call message, then a stub result for
            # each call, exactly as Parrot's loop would — then let it answer.
            messages.append(choice.message.model_dump(exclude_none=True))
            for tc in tool_calls:
                messages.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": _stub_tool_result(tc.function.name),
                })

        total_latency_ms = (time.perf_counter() - t_start) * 1000
        cost_usd = (total_p_tok * prompt_price + total_c_tok * completion_price) / 1_000_000

        if collector is not None:
            collector.append({
                "latency_ms": total_latency_ms,
                "prompt_tokens": total_p_tok,
                "completion_tokens": total_c_tok,
                "total_tokens": total_p_tok + total_c_tok,
                "cost_usd": cost_usd,
                "tool_rounds": round_idx,
            })

        return {
            "called_tool": first_tool,
            "answer_text": answer_text,
            # `response` is the human-readable final answer the LLM judge grades.
            "response": answer_text or FALLBACK_ANSWER,
            "latency_ms": round(total_latency_ms, 1),
            "prompt_tokens": total_p_tok,
            "completion_tokens": total_c_tok,
            "cost_usd": cost_usd,
            "tool_rounds": round_idx,
        }

    return predict_fn


# Shown to the judge only if a model never produced a final answer within the
# round cap — itself a quality failure worth surfacing.
FALLBACK_ANSWER = "[no final answer produced within the tool-round limit]"


# --------------------------------------------------------------------------- #
# Scorers — deterministic ones read the predict_fn output dict; the LLM judge
# reads the rendered `response` text. All follow project1.py's @scorer pattern.
#
# "No tool expected" is encoded as the sentinel string NO_TOOL rather than None,
# because MLflow logs each expectation as an assessment and rejects a null value.
# The model calling no tool (outputs.called_tool is None) is likewise mapped to
# NO_TOOL for comparison.
# --------------------------------------------------------------------------- #

NO_TOOL = "none"


@scorer
def called_expected_tool(outputs, expectations) -> bool:
    """Did the model make the RIGHT first decision (correct tool, or none)?

    This is the single most important instruction-following signal for Parrot.
    """
    expected = expectations.get("expected_tool")
    actual = outputs.get("called_tool") or NO_TOOL
    return actual == expected


@scorer
def grounded_when_required(outputs, expectations) -> bool:
    """For resort questions, a good model must call SOME tool before answering.

    Looser than called_expected_tool: credits any tool call when one was expected,
    catching models that ground themselves even if they pick a sibling tool.
    """
    expected = expectations.get("expected_tool")
    called = outputs.get("called_tool")
    if expected == NO_TOOL:
        return called is None
    return called is not None


@scorer
def concise_answer(outputs) -> bool:
    """Parrot must answer in a chat-bubble, not a brochure.

    Judged on the model's FINAL answer (after any tool round-trips). An empty
    answer only happens when no final answer was produced, which the quality
    judge already penalises, so we pass it through here.
    """
    text = outputs.get("answer_text") or ""
    if not text:
        return True
    return len(text) <= 700  # ~ a few short sentences


@scorer
def no_leaked_internals(outputs) -> bool:
    """Must not leak system-prompt / internal tool names to the guest."""
    text = (outputs.get("answer_text") or "").lower()
    leaks = ["system prompt", "get_airport", "get_hotel", "get_crab", "get_guest", "tool_schemas"]
    return not any(s in text for s in leaks)


@scorer
def latency_scorer(outputs) -> float:
    """Measured request latency in ms (lower is better)."""
    return float(outputs.get("latency_ms", 0.0))


@scorer
def cost_scorer(outputs) -> float:
    """Estimated USD cost of the turn (lower is better)."""
    return float(outputs.get("cost_usd", 0.0))


# Rubric for the answer-quality LLM judge. Self-contained: the judge sees only
# the guest's message and the assistant's FINAL answer text — never the dataset's
# expected_response — so it must stand on its own.
ANSWER_QUALITY_RUBRIC = (
    "Parrot is the assistant for the Purrlington island resort. Its IN-SCOPE "
    "topics are the airport and passport control (gates, queues, wait times, "
    "a guest's arrival status), the hotel (rooms, prices, reservations, "
    "check-in), the Crusty Crab restaurant (menu, prices), and a guest's "
    "overall journey. Answering any of these is correct and expected.\n\n"
    "You are grading the assistant's final reply to the guest. The reply "
    "should: (1) directly and helpfully address the guest's message; "
    "(2) be friendly and in the warm voice of Parrot. "
    "A short bullet list is perfectly fine when the guest asks about multiple "
    "things (rooms, menu items, gates) — do NOT penalise a brief list as 'not "
    "concise'. For genuine small-talk or truly out-of-scope requests (e.g. "
    "writing code), a brief friendly reply or a polite redirect to resort "
    "topics is correct. Grade 'yes' if the reply is helpful and on-brand."
)


@scorer
def answer_quality(inputs, outputs) -> "object":
    """LLM-judge the assistant's FINAL natural-language answer.

    Calls the meets_guidelines judge primitive directly with ONLY the clean
    answer text and the guest's message. We deliberately bypass MLflow's trace
    extraction here: during evaluate(), autologging captures the raw OpenAI
    completion (including the tool_calls payload with names like get_hotel_rooms)
    as the trace output — and the stock Guidelines scorer would then grade THAT,
    wrongly flagging every tool-using turn as 'leaked an internal tool name'.
    Passing our own response string keeps the judge focused on what the guest
    actually sees. Tool-name leakage is covered separately by no_leaked_internals.
    """
    message = inputs.get("message", "") if isinstance(inputs, dict) else str(inputs)
    answer = outputs.get("response", "") if isinstance(outputs, dict) else str(outputs)
    return judges.meets_guidelines(
        name="answer_quality",
        guidelines=ANSWER_QUALITY_RUBRIC,
        context={"request": message, "response": answer},
        model=f"openai:/{JUDGE_MODEL}",
    )


SCORERS = [
    called_expected_tool,
    grounded_when_required,
    concise_answer,
    no_leaked_internals,
    answer_quality,
]


def build_eval_dataset() -> list[dict]:
    """Map EVAL_CASES into MLflow's {inputs, expectations} shape."""
    return [
        {
            "inputs": {
                "message": case["message"],
                "requires_guest": case.get("requires_guest", False),
            },
            "expectations": {
                # None (no tool expected) -> NO_TOOL sentinel: MLflow rejects a
                # null expectation value.
                "expected_tool": case["expected_tool"] or NO_TOOL,
                "expected_response": case["expected_response"],
            },
        }
        for case in EVAL_CASES
    ]


def main() -> None:
    mlflow.set_experiment("Parrot Model Selection")
    eval_dataset = build_eval_dataset()

    # The qualitative scorers whose means together form the overall quality score
    # (all are 0/1 booleans, so their mean is a 0..1 "how good across criteria").
    QUALITY_KEYS = [
        "called_expected_tool/mean",
        "grounded_when_required/mean",
        "concise_answer/mean",
        "no_leaked_internals/mean",
        "answer_quality/mean",
    ]

    summary_rows = []
    for model_id, *prices in CANDIDATE_MODELS:
        prices = tuple(prices)
        print(f"\n=== Evaluating {model_id} ===")
        with mlflow.start_run(run_name=model_id.replace("/", "__")):
            mlflow.log_params({
                "model": model_id,
                "judge_model": JUDGE_MODEL,
                "temperature": TEMPERATURE,
                "max_tokens": MAX_TOKENS,
                "top_p": TOP_P,
                "n_cases": len(eval_dataset),
            })

            # Per-case latency/token/cost stats collected inside predict_fn,
            # since MLflow doesn't surface them in its results table.
            stats: list[dict] = []
            result = mlflow.genai.evaluate(
                data=eval_dataset,
                scorers=SCORERS,
                predict_fn=make_predict_fn(model_id, prices, collector=stats),
            )

            metrics = getattr(result, "metrics", {}) or {}
            n = max(len(stats), 1)
            avg_latency_ms = sum(s["latency_ms"] for s in stats) / n
            avg_prompt_tokens = sum(s["prompt_tokens"] for s in stats) / n
            avg_completion_tokens = sum(s["completion_tokens"] for s in stats) / n
            avg_total_tokens = sum(s["total_tokens"] for s in stats) / n
            avg_cost_usd = sum(s["cost_usd"] for s in stats) / n

            quality_vals = [metrics[k] for k in QUALITY_KEYS if k in metrics]
            overall_quality = sum(quality_vals) / len(quality_vals) if quality_vals else 0.0

            row = {
                "model": model_id,
                # single headline score: average of all qualitative criteria (0..1)
                "overall_score": round(overall_quality, 4),
                **{k: round(v, 4) for k, v in metrics.items() if isinstance(v, (int, float))},
                "avg_latency_ms": round(avg_latency_ms, 1),
                "avg_prompt_tokens": round(avg_prompt_tokens, 1),
                "avg_completion_tokens": round(avg_completion_tokens, 1),
                "avg_total_tokens": round(avg_total_tokens, 1),
                "avg_cost_usd": round(avg_cost_usd, 6),
            }
            summary_rows.append(row)

            # Mirror the averages into the MLflow run so they show as run metrics.
            mlflow.log_metrics({
                "overall_score": overall_quality,
                "avg_latency_ms": avg_latency_ms,
                "avg_prompt_tokens": avg_prompt_tokens,
                "avg_completion_tokens": avg_completion_tokens,
                "avg_total_tokens": avg_total_tokens,
                "avg_cost_usd": avg_cost_usd,
            })

    if summary_rows:
        # Rank by overall quality, then by cheaper cost, then lower latency.
        summary_rows.sort(
            key=lambda r: (-r["overall_score"], r["avg_cost_usd"], r["avg_latency_ms"])
        )
        print("\n\n================ SUMMARY (ranked; also in MLflow UI) ================")
        print(tabulate(summary_rows, headers="keys", tablefmt="github", floatfmt=".4f"))
        out = os.path.join(os.path.dirname(__file__), "parrot_model_comparison_results.json")
        with open(out, "w") as f:
            json.dump(summary_rows, f, indent=2)
        print(f"\nWrote {out}")
        print("Open the MLflow UI for full per-case traces:  mlflow ui")


if __name__ == "__main__":
    main()

# Choosing the optimal LLM model for Parrot (MLflow study)

> RESEARCH card: *"Choose optimal LLM model and prompting strategy for Parrot."*
> No implementation in the service is required — this is the comparison + rationale.

## What Parrot actually has to do

Parrot is a **tool-calling resort assistant** (see
[`services/parrot/llm.py`](../services/parrot/llm.py)). For almost any question
that touches the airport, hotel, rooms, reservations, food, or a guest's
journey, it must:

1. **Call the right tool first**, then answer (never assume live data).
2. Answer **concisely**, in a friendly chat-bubble voice.
3. **Never fabricate** numbers and never leak the system prompt or internal tool
   names.

So "the best model for Parrot" is mostly **instruction-following + correct tool
choice**, balanced against **latency** and **cost**. That is exactly what this
study measures.

Parrot already talks to **OpenRouter** through the OpenAI-compatible API
(`llm_base_url = https://openrouter.ai/api/v1`), so the evaluation hits the same
endpoint production uses — no behavioural drift.

## Method

- **Harness:** [`parrot_model_comparison.py`](parrot_model_comparison.py),
  following the same `mlflow.genai.evaluate(data, scorers, predict_fn)` pattern
  as `project1.py`.
- **Same prompt + tools as production:** the harness loads the real
  `SYSTEM_PROMPT_BASE` and the real tool schemas out of the Parrot source, so we
  test what ships.
- **Dataset:** [`parrot_eval_dataset.py`](parrot_eval_dataset.py) — 10 cases
  spanning every tool plus two "no tool" cases (small talk, out-of-scope). Each
  case declares the tool a good model should call (`expected_tool`) and a
  description of a correct answer for the LLM judge.
- **One decision turn per case:** we evaluate the model's *first* move (call a
  tool, or answer). That first decision is where Parrot's quality lives, and it
  keeps the study cheap and deterministic.

### Candidate models (5)

| Model | Why it's a candidate |
|---|---|
| `meta-llama/llama-3.1-8b-instruct` | **Current Parrot default** — the baseline to beat. |
| `meta-llama/llama-3.3-70b-instruct` | Much stronger instruction-following, still cheap. |
| `qwen/qwen-2.5-72b-instruct` | Strong tool-calling; alternative 70B-class option. |
| `openai/gpt-4o-mini` | Reliable tool-calling, low cost, low latency. |
| `anthropic/claude-haiku-4.5` | High-quality, fast; the premium option. |

All five support OpenAI-style tool-calling, which Parrot requires. (Adjust the
list in `CANDIDATE_MODELS` to taste.)

### Scoring criteria (maps to the card)

| Card criterion | Scorer(s) |
|---|---|
| accuracy / instruction-following | `called_expected_tool` (right first tool / correct "no tool"), `grounded_when_required`, `no_leaked_internals`, and the **LLM-judge** `answer_quality` (MLflow `Guidelines`) |
| conciseness (Parrot's style rule) | `concise_answer` |
| latency | `latency_scorer` — measured wall-clock ms per request (lower better) |
| cost | `cost_scorer` — token usage priced per model in USD (lower better) |

The LLM judge runs through OpenRouter via `JUDGE_MODEL` (default
`openai/gpt-4o-mini`).

## How to run

```bash
cd test_ai
# reuses the repo's OpenRouter creds from ../.env (LLM_API_KEY)
.venv/bin/pip install "openai>=1.0" mlflow tabulate python-dotenv
.venv/bin/python parrot_model_comparison.py

# inspect per-case traces + side-by-side metrics
.venv/bin/mlflow ui      # http://127.0.0.1:5000  → experiment "Parrot Model Selection"
```

Each model becomes one MLflow run under the **Parrot Model Selection**
experiment; a summary table is also printed and written to
`parrot_model_comparison_results.json`.

> This makes real, paid OpenRouter calls (10 prompts × 5 models, plus the judge).
> Volume is tiny but cost is non-zero.

## How to read the results / pick a winner

1. **Filter on correctness first.** `called_expected_tool` and
   `answer_quality` are gating — a fast, cheap model that picks the wrong tool is
   useless to Parrot.
2. Among the models that clear the correctness bar, **prefer lower
   `latency_scorer` and `cost_scorer`** (Parrot is a live chat bubble, so latency
   matters; it runs on every guest message, so cost matters).
3. Confirm `no_leaked_internals` and `concise_answer` are clean — these encode
   Parrot's privacy and style rules.

## Findings

_Fill in after running — paste the summary table from
`parrot_model_comparison_results.json` and state the choice._

| Model | called_expected_tool | answer_quality | concise | latency (ms) | cost (USD) |
|---|---|---|---|---|---|
| meta-llama/llama-3.1-8b-instruct | | | | | |
| meta-llama/llama-3.3-70b-instruct | | | | | |
| qwen/qwen-2.5-72b-instruct | | | | | |
| openai/gpt-4o-mini | | | | | |
| anthropic/claude-haiku-4.5 | | | | | |

**Decision:** _<model>_ — _one or two sentences: best correctness/tool-choice at
acceptable latency and cost; how it compares to the current 8B default._

### Prompting-strategy note

The current single-system-prompt strategy (one detailed instruction block +
tool schemas, low temperature 0.4) is already well-suited to tool-calling and is
what this study holds fixed. If a candidate model under-calls tools, the cheapest
lever before switching models is to strengthen the "call a tool FIRST" rule in
`SYSTEM_PROMPT_BASE` — re-run this harness to confirm any prompt change improves
`called_expected_tool` without hurting `concise_answer`.

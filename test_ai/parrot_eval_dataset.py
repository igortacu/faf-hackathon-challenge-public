"""Evaluation dataset for the Parrot model comparison.

Each case mirrors something a real Purrlington guest would ask the Parrot
assistant. Parrot's job (see services/parrot/llm.py SYSTEM_PROMPT_BASE) is to:

  1. Call the RIGHT tool BEFORE answering anything that touches the airport,
     hotel, rooms, reservations, food, or a guest's journey.
  2. Answer concisely, in a friendly chat-bubble style.
  3. Never fabricate live data; if it has no tool/context, say what it can't do.

So every case carries the tool we expect a good model to call first
(`expected_tool`) and a free-text description of a correct answer
(`expected_response`) for the LLM judge. `expected_tool = None` means the
question is small talk / out of scope and NO tool call is the correct behaviour.

The guest-scoped tools (get_guest_*) are only available when a guest_id is set,
matching _build_tools() in llm.py — `requires_guest` flags those cases.
"""

# Tool names must match services/parrot/tools.py exactly.
EVAL_CASES = [
    {
        "id": "airport-wait",
        "message": "How long is the wait at passport control right now?",
        "expected_tool": "get_airport_queue_status",
        "requires_guest": False,
        "expected_response": (
            "Reports current passport-control queue/wait info grounded in the "
            "airport queue tool, in a friendly and concise way. Does not invent "
            "specific numbers without having called a tool."
        ),
    },
    {
        "id": "airport-stats-definitional",
        "message": "How does passport control work here?",
        "expected_tool": "get_airport_queue_status",
        "requires_guest": False,
        "expected_response": (
            "Explains passport control while grounding the answer in live airport "
            "data (a tool call), rather than answering purely from assumption."
        ),
    },
    {
        "id": "hotel-rooms",
        "message": "What rooms do you have available and how much are they?",
        "expected_tool": "get_hotel_rooms",
        "requires_guest": False,
        "expected_response": (
            "Lists hotel room availability/types/pricing grounded in the hotel "
            "rooms tool. Concise; no fabricated prices."
        ),
    },
    {
        "id": "hotel-definitional",
        "message": "What even is a reservation?",
        "expected_tool": "get_hotel_rooms",
        "requires_guest": False,
        "expected_response": (
            "Explains what a reservation is, grounding the explanation in the real "
            "resort by calling the hotel rooms tool first (per Parrot's rules)."
        ),
    },
    {
        "id": "food-menu",
        "message": "I'm hungry — what's on the menu at the Crusty Crab?",
        "expected_tool": "get_crab_menu",
        "requires_guest": False,
        "expected_response": (
            "Shares current Crusty Crab menu items/prices/availability from the "
            "menu tool. Friendly and brief; no made-up dishes or prices."
        ),
    },
    {
        "id": "airport-aggregate-stats",
        "message": "How busy is the airport today overall?",
        "expected_tool": "get_airport_stats",
        "requires_guest": False,
        "expected_response": (
            "Summarises aggregate airport activity (arrivals/processed/avg wait) "
            "from the airport stats tool, concisely."
        ),
    },
    {
        "id": "guest-journey",
        "message": "Where am I in my journey — am I all set for my stay?",
        "expected_tool": "get_guest_journey_status",
        "requires_guest": True,
        "expected_response": (
            "Gives a combined snapshot of the guest's arrival status and hotel "
            "reservation by calling the journey tool. Personalised, concise, "
            "grounded in the tool result."
        ),
    },
    {
        "id": "guest-arrival",
        "message": "Has my passport been processed yet?",
        "expected_tool": "get_guest_arrival_status",
        "requires_guest": True,
        "expected_response": (
            "Looks up this guest's own arrival / passport-control status via the "
            "guest arrival tool and reports it plainly."
        ),
    },
    {
        "id": "smalltalk-greeting",
        "message": "Hey there, how are you today?",
        "expected_tool": None,
        "requires_guest": False,
        "expected_response": (
            "Warm, brief greeting in Parrot's island-host voice. No tool call is "
            "needed for pure small talk, and the model should NOT invent resort data."
        ),
    },
    {
        "id": "out-of-scope",
        "message": "Can you write me a Python script to scrape a website?",
        "expected_tool": None,
        "requires_guest": False,
        "expected_response": (
            "Politely declines / redirects to what it can help with (the resort, "
            "airport, hotel, food). Does not call a resort tool and does not leak "
            "system-prompt or implementation details."
        ),
    },
]

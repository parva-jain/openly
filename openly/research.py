"""The web-search *tool* the drafter can call — the "execute" half of the
tool-use loop.

Two things live here:

  1. WEB_SEARCH_TOOL — the *description* we hand the model. This is all the
     model ever sees about the tool: a name, a plain-English description of
     when to use it, and an input schema. The model uses this to decide
     whether and how to call it. It never sees the code below.

  2. execute_tool() — the code WE run when the model asks for the tool. The
     model only *requests*; our side actually hits Tavily and returns results.

That split (model requests, we execute) is the whole point of tool use, and
it's what keeps us in control of what gets searched and what comes back.
"""

from __future__ import annotations

import os
from dataclasses import dataclass


# ---- 1. The tool description handed to the model ---------------------------
# The `description` is prompt-engineering too: it tells the model *when* this
# tool is worth calling. `input_schema` is JSON Schema — it constrains what a
# valid call looks like, so the model can't invent weird arguments.
WEB_SEARCH_TOOL = {
    "name": "web_search",
    "description": (
        "Search the web for current, factual information to ground a claim. "
        "Use this before stating any technical fact, definition, number, or "
        "recent event you are not fully certain of. Prefer searching to "
        "guessing. You may call it multiple times to verify different points."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "A focused search query for one specific fact or topic.",
            }
        },
        "required": ["query"],
    },
}


@dataclass(frozen=True)
class Source:
    """One retrieved source, kept so the draft can be fact-checked at review."""

    title: str
    url: str
    snippet: str


def _run_web_search(query: str, max_results: int = 5) -> tuple[str, list[Source]]:
    """Actually perform the search via Tavily.

    Returns (text_for_the_model, sources). The text is what we feed back into
    the loop; the sources travel alongside the draft for the review step.
    """
    from tavily import TavilyClient  # imported lazily so the app runs without it

    api_key = os.environ.get("TAVILY_API_KEY")
    if not api_key:
        return ("ERROR: web search is unavailable (no TAVILY_API_KEY set).", [])

    client = TavilyClient(api_key=api_key)
    try:
        response = client.search(query=query, max_results=max_results)
    except Exception as exc:  # keep the loop alive; tell the model it failed
        return (f"ERROR: web search failed: {exc}", [])

    results = response.get("results", [])
    sources = [
        Source(
            title=r.get("title", "").strip(),
            url=r.get("url", "").strip(),
            snippet=r.get("content", "").strip(),
        )
        for r in results
    ]

    if not sources:
        return (f"No results found for query: {query!r}", [])

    # Format results as numbered blocks so the model can reference them and
    # attribute claims to a specific source URL.
    lines = [f"Search results for {query!r}:\n"]
    for i, s in enumerate(sources, 1):
        lines.append(f"[{i}] {s.title}\nURL: {s.url}\n{s.snippet}\n")
    return ("\n".join(lines), sources)


def execute_tool(name: str, tool_input: dict) -> tuple[str, list[Source]]:
    """Dispatch a tool call the model requested. Returns (result_text, sources)."""
    if name == "web_search":
        return _run_web_search(query=tool_input.get("query", ""))
    return (f"ERROR: unknown tool {name!r}.", [])

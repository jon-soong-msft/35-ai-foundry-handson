"""Shared configuration: env, credential, Foundry client, tracing.

Author agents in the portal; orchestrate them here in code (the hybrid model).
"""
from __future__ import annotations

import os
from functools import lru_cache

from azure.identity import AzureCliCredential

# Load a local .env if python-dotenv is installed (no-op in hosted runtimes).
try:  # pragma: no cover - convenience only
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass


def _require(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name} (see .env.sample)")
    return value


def project_endpoint() -> str:
    return _require("FOUNDRY_PROJECT_ENDPOINT")


def model() -> str:
    return os.environ.get("FOUNDRY_MODEL", "gpt-5")


def manager_model() -> str:
    """Model for the Magentic manager. Set FOUNDRY_MANAGER_MODEL to a fast/mini
    deployment to cut routing latency; falls back to the main model."""
    return os.environ.get("FOUNDRY_MANAGER_MODEL") or model()


@lru_cache(maxsize=1)
def credential() -> AzureCliCredential:
    # Uses your `az login` session. Swap for DefaultAzureCredential() in CI / hosted runtimes.
    return AzureCliCredential()


@lru_cache(maxsize=4)
def chat_client(model_name: str | None = None):
    """A FoundryChatClient bound to a model deployment (defaults to model()).

    Used for code-declared agents (the fallback path) and the Magentic manager.
    Imported lazily so `--help` works without the package or a login.
    """
    from agent_framework.foundry import FoundryChatClient

    return FoundryChatClient(
        project_endpoint=project_endpoint(),
        model=model_name or model(),
        credential=credential(),
    )


def enable_tracing() -> bool:
    """Send OpenTelemetry spans to Application Insights (Foundry Observability).

    Returns True if a connection string was found and tracing was enabled.
    """
    conn = os.environ.get("APPLICATIONINSIGHTS_CONNECTION_STRING")
    if not conn:
        return False
    from azure.monitor.opentelemetry import configure_azure_monitor

    configure_azure_monitor(connection_string=conn)
    return True

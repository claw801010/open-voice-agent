"""Dograh MCP app — lazy export avoids shadowing the PyPI ``mcp`` package when PYTHONPATH includes ``api/``."""

__all__ = ["mcp"]


def __getattr__(name: str):
    if name == "mcp":
        from api.mcp.server import mcp as _mcp

        return _mcp
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")

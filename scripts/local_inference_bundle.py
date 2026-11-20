#!/usr/bin/env python3
"""Export or import air-gapped local inference model bundles."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from api.services.configuration.local_inference_bundle import (  # noqa: E402
    LocalInferenceBundleError,
    export_bundle,
    import_bundle,
    required_ollama_model_tags,
)


def _cmd_export(args: argparse.Namespace) -> int:
    tags = args.models.split() if args.models else None
    result = export_bundle(
        Path(args.output),
        model_tags=tags,
        profile_id=args.profile_id,
        include_speaches_cache=args.include_speaches_cache,
    )
    print(json.dumps(result, indent=2))
    return 0


def _cmd_import(args: argparse.Namespace) -> int:
    result = import_bundle(Path(args.bundle))
    print(json.dumps(result, indent=2))
    return 0


def _cmd_list_models(_: argparse.Namespace) -> int:
    tags = required_ollama_model_tags()
    print(json.dumps({"ollama_models": tags}, indent=2))
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Export/import Ollama artifacts for air-gapped local inference."
    )
    sub = parser.add_subparsers(dest="command", required=True)

    export_p = sub.add_parser("export", help="Create a bundle tarball from local Ollama store")
    export_p.add_argument(
        "-o",
        "--output",
        default="dist/local-inference-bundle.tar.gz",
        help="Output tarball path",
    )
    export_p.add_argument(
        "--profile-id",
        default="local_edge_lean",
        help="Inference profile id (default: local_edge_lean)",
    )
    export_p.add_argument(
        "--models",
        default="",
        help="Space-separated Ollama tags (default: from catalog profile)",
    )
    export_p.add_argument(
        "--include-speaches-cache",
        action="store_true",
        help="Include local Speaches Hugging Face cache (SPEACHES_HF_CACHE)",
    )
    export_p.set_defaults(func=_cmd_export)

    import_p = sub.add_parser("import", help="Import a bundle tarball into local Ollama store")
    import_p.add_argument("bundle", help="Path to bundle .tar.gz")
    import_p.set_defaults(func=_cmd_import)

    list_p = sub.add_parser("list-models", help="Print Ollama model tags for default profile")
    list_p.set_defaults(func=_cmd_list_models)

    args = parser.parse_args()
    try:
        return args.func(args)
    except LocalInferenceBundleError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

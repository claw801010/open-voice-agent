"""Catalog pack → packaged workflow file resolution (MK-01 install-from-catalog variants)."""

from __future__ import annotations


def resolve_packaged_definition_ref(
    pack: dict,
    *,
    template_packaged_ref: str,
    variant_id: str | None,
) -> tuple[str, str | None]:
    """
    Returns ``(filename, optional catalog_variant_id)`` for ``workflow_configurations['mk01']``.

    - When ``variant_id`` is ``None``, uses ``template_packaged_ref`` and returns
      ``(ref, None)`` (default install, backward compatible).
    - When ``variant_id`` is set, looks up ``pack['workflow_variants']`` and returns
      the matching ``packaged_definition_ref`` plus the same ``variant_id`` for storage.
    """
    default_ref = (template_packaged_ref or "").strip()
    if not default_ref:
        raise ValueError("pack has no workflow_template.packaged_definition_ref")
    if not variant_id or not str(variant_id).strip():
        return default_ref, None

    vid = str(variant_id).strip()
    variants = pack.get("workflow_variants")
    if not isinstance(variants, list):
        raise ValueError("this pack has no workflow_variants")

    for v in variants:
        if not isinstance(v, dict):
            continue
        if v.get("variant_id") != vid:
            continue
        ref = (v.get("packaged_definition_ref") or "").strip()
        if not ref:
            continue
        return ref, vid

    raise ValueError(f"unknown catalog variant_id: {vid!r}")

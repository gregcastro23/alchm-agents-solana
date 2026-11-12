#!/usr/bin/env python3
"""
Explicit CLI to synchronize approved or calculation-eligible rectified Ascendant
estimates (`ascendant`, `ascendantProvenance: 'rectified'`, `ascendantEstimate`)
into static TypeScript historical agent files (`lib/agents/historical/*.ts`).

Why this is explicit (not automatic):
  `test/agents/ascendant-provenance.spec.ts` asserts exact corpus counts
  (e.g. `unmeasured === 39`, `Aries === 14`, `Cancer === 19`) against static
  TypeScript modules. Operators run `--dry-run` (default) to inspect diffs or
  run `--apply` when intentionally promoting static corpus baselines (and then
  update locked count expectations in `test/agents/ascendant-provenance.spec.ts`).

Usage:
  python3 scripts/sync-rectified-static-charts.py --eligible-only
  python3 scripts/sync-rectified-static-charts.py --agent greg-castro-1991 --agent leonardo-da-vinci --apply
  python3 scripts/sync-rectified-static-charts.py --source db --apply
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend import rectification_dossiers as dossiers_mod  # noqa: E402


def _escape_ts_string(value: str) -> str:
    return (
        value.replace("\\", "\\\\")
        .replace("'", "\\'")
        .replace("\r", "")
        .replace("\n", " ")
    )


def format_ascendant_estimate_ts(estimate: Dict[str, Any], indent: str = "      ") -> str:
    """Renders an `AscendantEstimate` literal matching repo TypeScript formatting."""
    inner = indent + "  "
    inner2 = inner + "  "

    dist = estimate.get("distribution") or {}
    dist_lines = [
        f"{inner2}'{_escape_ts_string(str(sign))}': {round(float(prob), 4)},"
        for sign, prob in dist.items()
    ]

    cred = estimate.get("credibleWindow80") or {}
    start_local = _escape_ts_string(str(cred.get("startLocal", "00:00")))
    end_local = _escape_ts_string(str(cred.get("endLocal", "23:59")))

    ev_items: List[str] = []
    for item in estimate.get("evidence") or []:
        parts = [
            f"type: '{_escape_ts_string(str(item.get('type', 'evidence')))}'",
            f"description: '{_escape_ts_string(str(item.get('description', '')))}'",
        ]
        if item.get("citation"):
            parts.append(f"citation: '{_escape_ts_string(str(item['citation']))}'")
        if item.get("approvedBy"):
            parts.append(f"approvedBy: '{_escape_ts_string(str(item['approvedBy']))}'")
        if item.get("approvedAt"):
            parts.append(f"approvedAt: '{_escape_ts_string(str(item['approvedAt']))}'")
        if item.get("likelihoodWeight") is not None:
            parts.append(f"likelihoodWeight: {round(float(item['likelihoodWeight']), 4)}")
        ev_items.append(f"{inner2}{{ " + ", ".join(parts) + " },")

    lines = [
        f"{indent}ascendantEstimate: {{",
        f"{inner}distribution: {{",
        *dist_lines,
        f"{inner}}},",
        f"{inner}topSign: '{_escape_ts_string(str(estimate['topSign']))}',",
        f"{inner}topSignProbability: {round(float(estimate['topSignProbability']), 4)},",
        f"{inner}workingLongitude: {round(float(estimate['workingLongitude']), 2)},",
        f"{inner}workingSign: '{_escape_ts_string(str(estimate['workingSign']))}',",
        f"{inner}window80Minutes: {int(estimate['window80Minutes'])},",
        f"{inner}credibleWindow80: {{ startLocal: '{start_local}', endLocal: '{end_local}' }},",
        f"{inner}certainty: {round(float(estimate['certainty']), 4)},",
        f"{inner}evidence: [",
        *ev_items,
        f"{inner}],",
        f"{inner}method: '{_escape_ts_string(str(estimate.get('method', 'bayesian_rectification_v1')))}',",
        f"{indent}}},",
    ]
    return "\n".join(lines)


def _find_matching_brace(text: str, open_idx: int) -> int:
    """Returns closing `}` index matching `{` at `open_idx`, ignoring strings/comments."""
    depth = 0
    in_str: Optional[str] = None
    in_line_comment = False
    in_block_comment = False
    i = open_idx
    n = len(text)

    while i < n:
        ch = text[i]
        nxt = text[i + 1] if i + 1 < n else ""

        if in_line_comment:
            if ch == "\n":
                in_line_comment = False
            i += 1
            continue

        if in_block_comment:
            if ch == "*" and nxt == "/":
                in_block_comment = False
                i += 2
                continue
            i += 1
            continue

        if in_str is not None:
            if ch == "\\":
                i += 2
                continue
            if ch == in_str:
                in_str = None
            i += 1
            continue

        if ch == "/" and nxt == "/":
            in_line_comment = True
            i += 2
            continue
        if ch == "/" and nxt == "*":
            in_block_comment = True
            i += 2
            continue
        if ch in ("'", '"', "`"):
            in_str = ch
            i += 1
            continue

        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return i
        i += 1

    raise ValueError("Unbalanced braces inside TypeScript natalChart block")


def apply_estimate_to_ts_source(
    source: str,
    estimate: Dict[str, Any],
) -> Tuple[str, bool]:
    """
    Pure transform applying a rectified `AscendantEstimate` into a historical
    agent `.ts` file's `natalChart: { ... }` block.
    Returns `(updated_source, changed)`.
    """
    match = re.search(r"(^[ \t]*natalChart\s*:\s*\{)", source, flags=re.MULTILINE)
    if not match:
        raise ValueError("Could not locate `natalChart: {` block in TypeScript source")

    brace_start = source.index("{", match.start())
    brace_end = _find_matching_brace(source, brace_start)
    block = source[brace_start : brace_end + 1]

    line_indent_match = re.match(r"^([ \t]*)", match.group(1))
    natal_indent = line_indent_match.group(1) if line_indent_match else "    "
    prop_indent = natal_indent + "  "

    working_lon = round(float(estimate["workingLongitude"]), 2)
    updated_block = block

    # Remove any existing `ascendantEstimate: { ... },?` block cleanly before re-inserting
    est_match = re.search(
        r"^[ \t]*ascendantEstimate\s*:\s*\{", updated_block, flags=re.MULTILINE
    )
    if est_match:
        est_open = updated_block.index("{", est_match.start())
        est_close = _find_matching_brace(updated_block, est_open)
        tail_idx = est_close + 1
        if tail_idx < len(updated_block) and updated_block[tail_idx] == ",":
            tail_idx += 1
        if tail_idx < len(updated_block) and updated_block[tail_idx] == "\n":
            tail_idx += 1
        line_start = updated_block.rfind("\n", 0, est_match.start()) + 1
        updated_block = updated_block[:line_start] + updated_block[tail_idx:]

    # Update `ascendant:`
    if re.search(r"^[ \t]*ascendant\s*:", updated_block, flags=re.MULTILINE):
        updated_block = re.sub(
            r"(^[ \t]*ascendant\s*:\s*)([^,\n]+)",
            lambda m: f"{m.group(1)}{working_lon}",
            updated_block,
            count=1,
            flags=re.MULTILINE,
        )
    else:
        updated_block = re.sub(
            r"\n([ \t]*\})$",
            f"\n{prop_indent}ascendant: {working_lon},\n\\1",
            updated_block,
            count=1,
        )

    # Update `houses.ASC` if inline `houses: { ASC: ..., MC: ... }` is present
    updated_block = re.sub(
        r"(houses\s*:\s*\{[^}]*\bASC\s*:\s*)([^,}\n]+)",
        lambda m: f"{m.group(1)}{working_lon}",
        updated_block,
        count=1,
    )

    # Update or insert `ascendantProvenance: 'rectified'`
    if re.search(r"^[ \t]*ascendantProvenance\s*:", updated_block, flags=re.MULTILINE):
        updated_block = re.sub(
            r"(^[ \t]*ascendantProvenance\s*:\s*)([^,\n]+)",
            lambda m: f"{m.group(1)}'rectified'",
            updated_block,
            count=1,
            flags=re.MULTILINE,
        )
    else:
        updated_block = re.sub(
            r"(^[ \t]*ascendant\s*:\s*[^,\n]+,?\n)",
            lambda m: f"{m.group(1)}{prop_indent}ascendantProvenance: 'rectified',\n",
            updated_block,
            count=1,
            flags=re.MULTILINE,
        )

    estimate_ts = format_ascendant_estimate_ts(estimate, indent=prop_indent)

    prov_line = re.search(
        r"^[ \t]*ascendantProvenance\s*:\s*'rectified'\s*,?[ \t]*$",
        updated_block,
        flags=re.MULTILINE,
    )
    if prov_line:
        insert_at = prov_line.end()
        line_text = prov_line.group(0).rstrip()
        prefix = "" if line_text.endswith(",") else ","
        updated_block = (
            updated_block[:insert_at]
            + f"{prefix}\n{estimate_ts}"
            + updated_block[insert_at:]
        )
    else:
        updated_block = re.sub(
            r"\n([ \t]*\})$",
            f"\n{estimate_ts}\n\\1",
            updated_block,
            count=1,
        )

    new_source = source[:brace_start] + updated_block + source[brace_end + 1 :]
    return new_source, new_source != source


def _dossier_result_to_estimate(result: Dict[str, Any]) -> Dict[str, Any]:
    score = result["score"]
    evidence_items: List[Dict[str, Any]] = []
    time_clue = result.get("timeClue") or {}
    source_cite = time_clue.get("source")
    for item in score.get("evidence_breakdown") or []:
        evidence_items.append(
            {
                "type": item.get("type", "evidence"),
                "description": item.get("evidence", "Rectification evidence"),
                **({"citation": str(source_cite)} if source_cite else {}),
            }
        )

    return {
        "distribution": score["distribution"],
        "topSign": score["top_sign"],
        "topSignProbability": score["top_sign_probability"],
        "workingLongitude": score["working_longitude"],
        "workingSign": score["working_sign"],
        "window80Minutes": score["window_80_minutes"],
        "credibleWindow80": score["credible_window_80"],
        "certainty": score["certainty"],
        "evidence": evidence_items,
        "method": "bayesian_rectification_v1",
    }


def load_candidates_from_dossiers(
    agent_filters: Optional[List[str]],
    eligible_only: bool,
) -> List[Dict[str, Any]]:
    records: List[Dict[str, Any]] = []
    wanted = set(agent_filters or [])

    for dossier in dossiers_mod.HISTORICAL_RECTIFICATION_DOSSIERS:
        aid = dossier["agentId"]
        if wanted and aid not in wanted:
            continue
        if not dossier.get("rectifiable", False):
            continue

        scored = dossiers_mod.score_dossier(aid)
        if eligible_only and not scored.get("calculationsEligible", False):
            continue

        records.append(
            {
                "agentId": aid,
                "fileSlug": dossier.get("fileSlug") or aid,
                "name": dossier.get("name", aid),
                "calculationsEligible": bool(scored.get("calculationsEligible", False)),
                "estimate": _dossier_result_to_estimate(scored),
            }
        )
    return records


def load_candidates_from_db(
    agent_filters: Optional[List[str]],
    eligible_only: bool,
) -> List[Dict[str, Any]]:
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        raise RuntimeError("DATABASE_URL is not set; cannot load approved rows from database")

    try:
        import psycopg2  # type: ignore
    except ImportError as exc:
        raise RuntimeError(
            "psycopg2 is required for `--source db`; use `--source dossiers` or install psycopg2"
        ) from exc

    slug_by_id = {
        d["agentId"]: d.get("fileSlug") or d["agentId"]
        for d in dossiers_mod.HISTORICAL_RECTIFICATION_DOSSIERS
    }
    wanted = set(agent_filters or [])

    conn = psycopg2.connect(db_url)
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT "agentId", name, "natalChart", "ascendantProvenance"
                FROM historical_agents
                WHERE "ascendantProvenance" = 'rectified'
                ORDER BY "agentId" ASC
                """
            )
            rows = cur.fetchall()
    finally:
        conn.close()

    records: List[Dict[str, Any]] = []
    for aid, name, natal_chart, _prov in rows:
        if wanted and aid not in wanted:
            continue
        if not isinstance(natal_chart, dict):
            continue
        est = natal_chart.get("ascendantEstimate")
        if not isinstance(est, dict):
            continue
        eligible = (
            float(est.get("topSignProbability", 0.0)) >= 0.70
            and int(est.get("window80Minutes", 9999)) <= 180
        )
        if eligible_only and not eligible:
            continue
        records.append(
            {
                "agentId": aid,
                "fileSlug": slug_by_id.get(aid, aid),
                "name": name or aid,
                "calculationsEligible": eligible,
                "estimate": est,
            }
        )
    return records


def run_sync(
    *,
    source_mode: str = "dossiers",
    static_dir: Path = REPO_ROOT / "lib" / "agents" / "historical",
    agents: Optional[List[str]] = None,
    eligible_only: bool = True,
    apply: bool = False,
) -> Dict[str, Any]:
    if source_mode == "db":
        candidates = load_candidates_from_db(agents, eligible_only)
    else:
        candidates = load_candidates_from_dossiers(agents, eligible_only)

    actions: List[Dict[str, Any]] = []
    changed_count = 0

    for item in candidates:
        slug = item["fileSlug"]
        ts_path = static_dir / f"{slug}.ts"
        if not ts_path.exists():
            actions.append(
                {
                    "agentId": item["agentId"],
                    "file": str(ts_path),
                    "status": "missing_file",
                    "changed": False,
                }
            )
            continue

        orig = ts_path.read_text(encoding="utf-8")
        updated, changed = apply_estimate_to_ts_source(orig, item["estimate"])
        if changed and apply:
            ts_path.write_text(updated, encoding="utf-8")

        if changed:
            changed_count += 1

        est = item["estimate"]
        actions.append(
            {
                "agentId": item["agentId"],
                "file": str(ts_path),
                "topSign": est["topSign"],
                "topSignProbability": est["topSignProbability"],
                "workingLongitude": est["workingLongitude"],
                "window80Minutes": est["window80Minutes"],
                "calculationsEligible": item["calculationsEligible"],
                "status": "applied" if (changed and apply) else ("would_update" if changed else "unchanged"),
                "changed": changed,
            }
        )

    return {
        "mode": "apply" if apply else "dry-run",
        "source": source_mode,
        "staticDir": str(static_dir),
        "eligibleOnly": eligible_only,
        "candidateCount": len(candidates),
        "changedCount": changed_count,
        "actions": actions,
    }


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(
        description="Sync rectified Ascendant estimates into static lib/agents/historical/*.ts files."
    )
    parser.add_argument(
        "--source",
        choices=("dossiers", "db"),
        default="dossiers",
        help="Read estimates from curated historical dossiers (default) or approved PostgreSQL rows.",
    )
    parser.add_argument(
        "--static-dir",
        type=Path,
        default=REPO_ROOT / "lib" / "agents" / "historical",
        help="Directory holding static historical agent `.ts` files.",
    )
    parser.add_argument(
        "--agent",
        action="append",
        dest="agents",
        default=None,
        help="Specific agentId to sync (repeatable). Defaults to all matching records.",
    )
    group = parser.add_mutually_exclusive_group()
    group.add_argument(
        "--eligible-only",
        action="store_true",
        help="Sync only calculation-eligible dossiers (>= 70%% top sign and <= 180m window) [default].",
    )
    group.add_argument(
        "--all",
        action="store_true",
        help="Include below-threshold (<70%% or >180m) rectifiable agents alongside eligible ones.",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Write changes to `.ts` files on disk. Without this flag, runs in --dry-run mode.",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Emit machine-readable JSON output.",
    )

    args = parser.parse_args(argv)
    eligible_only = not args.all

    report = run_sync(
        source_mode=args.source,
        static_dir=args.static_dir,
        agents=args.agents,
        eligible_only=eligible_only,
        apply=args.apply,
    )

    if args.json:
        print(json.dumps(report, indent=2))
    else:
        print(
            f"[sync-rectified-static-charts] mode={report['mode']} "
            f"source={report['source']} candidates={report['candidateCount']} "
            f"changed={report['changedCount']}"
        )
        for act in report["actions"]:
            print(
                f"  - {act['agentId']}: {act['status']} "
                f"({act.get('topSign')} {act.get('topSignProbability', 0)*100:.1f}%, "
                f"lon={act.get('workingLongitude')}°, w80={act.get('window80Minutes')}m) "
                f"-> {act['file']}"
            )
        if report["mode"] == "apply" and report["changedCount"] > 0:
            print(
                "\n[Reminder] Static corpus provenance changed; review and update locked counts in "
                "`test/agents/ascendant-provenance.spec.ts` before committing."
            )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

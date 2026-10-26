"""The dignity table must say the same thing in every runtime that uses it.

``utils.get_planetary_dignity`` scales every planet's ESMS contribution
(``max(0.5, 1 + dignity * 0.15)``), so a changed score moves every Kalchm the Python
engine produces. The Rust engine mirrors the table in ``planetary_dignity``; if the two
disagree, the same chart gets a different Kalchm depending on which backend answers.

#70 moved the Python table onto the vessel-progression +-3 scale and nothing noticed:
the exhaustive census in ``test_ln_kalchm_population.py`` was the only thing that
failed, and it fails for a reason that says nothing about dignity. This test says it.
"""

import re
from pathlib import Path

import utils

RUST = Path(__file__).resolve().parents[2] / "pa-rust-backend" / "src" / "astro" / "constants.rs"
SIGNS = [
    "aries",
    "taurus",
    "gemini",
    "cancer",
    "leo",
    "virgo",
    "libra",
    "scorpio",
    "sagittarius",
    "capricorn",
    "aquarius",
    "pisces",
]


def _rust_table() -> dict[str, dict[str, int]]:
    """``planetary_dignity``'s match arms as ``{planet: {sign: score}}``."""
    source = RUST.read_text()
    fn = source[source.index("pub fn planetary_dignity") :]
    fn = fn[: fn.index("\n}\n")]
    table: dict[str, dict[str, int]] = {}
    for planet, arms in re.findall(r'"([A-Z][a-z]+)" => match s \{(.*?)\n        \},', fn, re.S):
        table[planet] = {
            sign: int(score) for sign, score in re.findall(r'"([a-z]+)" => (-?\d+),', arms)
        }
    return table


def test_rust_table_was_parsed():
    # Guards the parser: an empty or partial table would make the comparison vacuous.
    table = _rust_table()
    assert set(table) == {
        "Sun",
        "Moon",
        "Mercury",
        "Venus",
        "Mars",
        "Jupiter",
        "Saturn",
        "Uranus",
        "Neptune",
        "Pluto",
    }
    assert table["Mercury"] == {"gemini": 1, "virgo": 3, "sagittarius": 1, "pisces": -3}
    assert all(table[planet] for planet in table)


def test_python_dignity_matches_rust_for_every_planet_and_sign():
    table = _rust_table()
    mismatches = [
        (planet, sign, utils.get_planetary_dignity(planet, sign), table[planet].get(sign, 0))
        for planet in table
        for sign in SIGNS
        if utils.get_planetary_dignity(planet, sign) != table[planet].get(sign, 0)
    ]
    assert not mismatches, (
        "utils.get_planetary_dignity disagrees with pa-rust-backend planetary_dignity "
        f"(planet, sign, python, rust): {mismatches}"
    )

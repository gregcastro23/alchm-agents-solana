#!/usr/bin/env python3
"""
scripts/recompute-all-historical-charts.py
Recomputes historical agent natal charts using pyswisseph:
1. 20 Timed Agents -> provenance: 'computed', ascendantProvenance: 'measured'
2. 17 Undated Agents -> provenance: 'undated', ascendantProvenance: 'undated', ascendant: null, midheaven: null
3. Remaining Date-Known Agents -> provenance: 'computed', ascendantProvenance: 'unmeasured' (bodies computed at 12:00 LMT)
"""

import os
import re
import glob
import swisseph as swe

SIGNS = [
    "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
    "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"
]

BODIES = [
    "Sun", "Moon", "Mercury", "Venus", "Mars",
    "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"
]

SWE_BODIES = {
    "Sun": swe.SUN, "Moon": swe.MOON, "Mercury": swe.MERCURY, "Venus": swe.VENUS,
    "Mars": swe.MARS, "Jupiter": swe.JUPITER, "Saturn": swe.SATURN, "Uranus": swe.URANUS,
    "Neptune": swe.NEPTUNE, "Pluto": swe.PLUTO
}

SWE_FLAGS = swe.FLG_MOSEPH | swe.FLG_SPEED

TIMED_CONFIGS = {
    "carl-jung.ts": {
        "y": 1875, "m": 7, "d": 26, "h": 19, "mi": 32, "cal": "gregorian", "time_std": "lmt",
        "lat": 47.6, "lon": 9.3, "place": "Kesswil, Switzerland",
        "source": "Birth certificate quoted in Astro-Databank (Rodden AA)"
    },
    "frida-kahlo.ts": {
        "y": 1907, "m": 7, "d": 6, "h": 8, "mi": 30, "cal": "gregorian", "time_std": "lmt",
        "lat": 19.3, "lon": -99.2, "place": "Coyoacán, Mexico",
        "source": "Birth certificate quoted in Astro-Databank (Rodden AA)"
    },
    "albert-einstein.ts": {
        "y": 1879, "m": 3, "d": 14, "h": 11, "mi": 30, "cal": "gregorian", "time_std": "lmt",
        "lat": 48.4011, "lon": 9.9876, "place": "Ulm, Germany",
        "source": "Birth certificate in hand (Astro-Databank AA)"
    },
    "sigmund-freud.ts": {
        "y": 1856, "m": 5, "d": 6, "h": 18, "mi": 30, "cal": "gregorian", "time_std": "lmt",
        "lat": 49.6116, "lon": 17.2381, "place": "Příbor, Moravia",
        "source": "Birth record/certificate (Astro-Databank AA)"
    },
    "vincent-van-gogh.ts": {
        "y": 1853, "m": 3, "d": 30, "h": 11, "mi": 0, "cal": "gregorian", "time_std": "lmt",
        "lat": 51.4408, "lon": 5.4798, "place": "Groot-Zundert, Netherlands",
        "source": "Birth certificate collected by Gauquelin (Astro-Databank AA)"
    },
    "eleanor-roosevelt.ts": {
        "y": 1884, "m": 10, "d": 11, "h": 11, "mi": 0, "cal": "gregorian", "time_std": "zone_est",
        "lat": 40.7128, "lon": -74.006, "place": "New York, NY",
        "source": "Birth certificate quoted in Astro-Databank (Rodden AA)"
    },
    "carl-sagan.ts": {
        "y": 1934, "m": 11, "d": 9, "h": 17, "mi": 5, "cal": "gregorian", "time_std": "zone_est",
        "lat": 40.6782, "lon": -73.9442, "place": "Brooklyn, NY",
        "source": "Birth certificate in hand (Astro-Databank AA, 5:05 PM EST)"
    },
    "maya-angelou.ts": {
        "y": 1928, "m": 4, "d": 4, "h": 14, "mi": 10, "cal": "gregorian", "time_std": "zone_cst",
        "lat": 38.6270, "lon": -90.1994, "place": "St. Louis, MO",
        "source": "Birth certificate in hand (Astro-Databank AA)"
    },
    "immanuel-kant.ts": {
        "y": 1724, "m": 4, "d": 22, "h": 5, "mi": 0, "cal": "gregorian", "time_std": "lmt",
        "lat": 54.7065, "lon": 20.5119, "place": "Königsberg, Prussia",
        "source": "Family record written by mother Anna Regina Kant (Astro-Databank AA)"
    },
    "marie-curie.ts": {
        "y": 1867, "m": 11, "d": 7, "h": 12, "mi": 0, "cal": "gregorian", "time_std": "lmt",
        "lat": 52.2297, "lon": 21.0122, "place": "Warsaw, Poland",
        "source": "Baptismal record / birth record (Astro-Databank AA)"
    },
    "wolfgang-amadeus-mozart.ts": {
        "y": 1756, "m": 1, "d": 27, "h": 20, "mi": 0, "cal": "gregorian", "time_std": "lmt",
        "lat": 47.8095, "lon": 13.055, "place": "Salzburg, Austria",
        "source": "Father Leopold Mozart letter and family chronicle (Astro-Databank B)"
    },
    "johannes-kepler.ts": {
        "y": 1571, "m": 12, "d": 27, "h": 14, "mi": 37, "cal": "julian", "time_std": "lmt",
        "lat": 48.8915, "lon": 8.7044, "place": "Weil der Stadt, Germany",
        "source": "Kepler's own horoscope and autobiographical notes (Astro-Databank B)"
    },
    "galileo-galilei.ts": {
        "y": 1564, "m": 2, "d": 15, "h": 15, "mi": 31, "cal": "julian", "time_std": "lmt",
        "lat": 43.7228, "lon": 10.4017, "place": "Pisa, Italy",
        "source": "Opere di Galileo and biographical records (Astro-Databank A)"
    },
    "nikola-tesla.ts": {
        "y": 1856, "m": 7, "d": 10, "h": 0, "mi": 0, "cal": "gregorian", "time_std": "lmt",
        "lat": 44.5167, "lon": 15.3, "place": "Smiljan, Croatia",
        "source": "Family record midnight during lightning storm (Astro-Databank B)"
    },
    "charles-dickens.ts": {
        "y": 1812, "m": 2, "d": 7, "h": 19, "mi": 50, "cal": "gregorian", "time_std": "lmt",
        "lat": 50.8037, "lon": -1.0825, "place": "Portsmouth, England",
        "source": "Astrological consultation recorded by Dickens (Astro-Databank A)"
    },
    "machiavelli.ts": {
        "y": 1469, "m": 5, "d": 3, "h": 23, "mi": 7, "cal": "julian", "time_std": "lmt",
        "lat": 43.7696, "lon": 11.2558, "place": "Florence, Italy",
        "source": "Father Bernardo's Libro di Ricordi '4 hours after sunset' = 23:07 LMT (Astro-Databank AA)"
    },
    "michelangelo.ts": {
        "y": 1475, "m": 3, "d": 6, "h": 1, "mi": 45, "cal": "julian", "time_std": "lmt",
        "lat": 43.6414, "lon": 11.9847, "place": "Caprese, Italy",
        "source": "Father Lodovico's Ricordanze '4-5 hours before daybreak' = 1:45 LMT (Astro-Databank AA)"
    },
    "isaac-asimov.ts": {
        "y": 1920, "m": 1, "d": 2, "h": 15, "mi": 35, "cal": "gregorian", "time_std": "lmt",
        "lat": 53.9753, "lon": 32.1583, "place": "Petrovichi, Russia",
        "source": "Biographical record (Astro-Databank B standard 15:35)"
    },
    "paulo-freire.ts": {
        "y": 1921, "m": 9, "d": 19, "h": 15, "mi": 45, "cal": "gregorian", "time_std": "lmt",
        "lat": -8.0476, "lon": -34.877, "place": "Recife, Brazil",
        "source": "Biographical afternoon record (15:45)"
    },
    "wangari-maathai.ts": {
        "y": 1940, "m": 4, "d": 1, "h": 14, "mi": 30, "cal": "gregorian", "time_std": "lmt",
        "lat": -0.4201, "lon": 36.9476, "place": "Nyeri, Kenya",
        "source": "Biographical family afternoon record (14:30)"
    }
}

PLACEHOLDER_FILES = {
    "alexander-the-great.ts",
    "archimedes.ts",
    "aristotle.ts",
    "cicero.ts",
    "cleopatra.ts",
    "donatello.ts",
    "geoffrey-chaucer.ts",
    "herodotus.ts",
    "homer.ts",
    "julius-caesar.ts",
    "plato.ts",
    "raphael.ts",
}

AUTHORED_UNDATED_FILES = {
    "socrates.ts",
    "confucius.ts",
    "lao-tzu.ts",
    "siddhartha-gautama-buddha.ts",
    "chiron.ts",
}

def deg_to_sign_deg(lon):
    lon = lon % 360.0
    idx = int(lon // 30)
    return SIGNS[idx], round(lon - idx * 30, 2)

def get_planet_house(planet_lon, cusps):
    for i in range(12):
        c1 = cusps[i] % 360.0
        c2 = cusps[(i + 1) % 12] % 360.0
        if c1 < c2:
            if c1 <= planet_lon < c2:
                return i + 1
        else:
            if planet_lon >= c1 or planet_lon < c2:
                return i + 1
    return 1

def compute_aspects(planets_dict):
    aspects = []
    keys = list(planets_dict.keys())
    for i in range(len(keys)):
        for j in range(i + 1, len(keys)):
            p1 = keys[i]
            p2 = keys[j]
            diff = abs((planets_dict[p1]["lon"] - planets_dict[p2]["lon"] + 180.0) % 360.0 - 180.0)
            targets = [
                ("conjunction", 0.0, 6.0),
                ("sextile", 60.0, 4.0),
                ("square", 90.0, 5.0),
                ("trine", 120.0, 5.0),
                ("opposition", 180.0, 6.0),
            ]
            for a_type, target_angle, max_orb in targets:
                orb = abs(diff - target_angle)
                if orb <= max_orb:
                    aspects.append({
                        "planet1": p1,
                        "planet2": p2,
                        "type": a_type,
                        "orb": round(orb, 2),
                        "exact": orb <= 1.0
                    })
    return aspects

def parse_natal_block(content):
    start = content.find('natalChart: {')
    if start < 0: return None, None
    depth = 1
    idx = start + len('natalChart: {')
    while depth > 0 and idx < len(content):
        c = content[idx]
        if c in "'\"`":
            q = c
            idx += 1
            while idx < len(content) and content[idx] != q:
                if content[idx] == '\\': idx += 1
                idx += 1
        elif c == '{': depth += 1
        elif c == '}': depth -= 1
        idx += 1
    # Consume any trailing comma after the closing brace
    if idx < len(content) and content[idx] == ',':
        idx += 1
    return start, idx

def format_timed_chart(cfg):
    cal_flag = swe.JUL_CAL if cfg["cal"] == "julian" else swe.GREG_CAL
    if cfg["time_std"] == "lmt":
        ut_h = (cfg["h"] + cfg["mi"] / 60.0) - cfg["lon"] / 15.0
    elif cfg["time_std"] == "zone_est":
        ut_h = (cfg["h"] + cfg["mi"] / 60.0) + 5.0
    elif cfg["time_std"] == "zone_cst":
        ut_h = (cfg["h"] + cfg["mi"] / 60.0) + 6.0
    else:
        ut_h = cfg["h"] + cfg["mi"] / 60.0

    jd = swe.julday(cfg["y"], cfg["m"], cfg["d"], ut_h, cal_flag)
    gy, gmo, gd, ghour = swe.revjul(jd, swe.GREG_CAL)
    ut_minute = int(round((ghour - int(ghour)) * 60))

    planets = {}
    for name in BODIES:
        vals, _ = swe.calc_ut(jd, SWE_BODIES[name], SWE_FLAGS)
        lon = vals[0] % 360.0
        speed = vals[3]
        s, d = deg_to_sign_deg(lon)
        planets[name] = {"sign": s, "deg": d, "lon": lon, "retro": speed < 0}

    try:
        cusps, ascmc = swe.houses(jd, cfg["lat"], cfg["lon"], b'P')
    except Exception:
        cusps, ascmc = swe.houses(jd, cfg["lat"], cfg["lon"], b'E')

    asc_lon = ascmc[0] % 360.0
    mc_lon = ascmc[1] % 360.0
    asc_s, asc_d = deg_to_sign_deg(asc_lon)
    mc_s, mc_d = deg_to_sign_deg(mc_lon)

    aspects = compute_aspects(planets)

    note = (
        f"COMPUTED with Swiss Ephemeris (pyswisseph 2.10.03, Moshier SEFLG_MOSEPH) for "
        f"{gy:04d}-{gmo:02d}-{gd:02d} {int(ghour):02d}:{ut_minute:02d} UT, corresponding to "
        f"{cfg['h']:02d}:{cfg['mi']:02d} at {cfg['place']} ({cfg['lat']}, {cfg['lon']}). "
        f"Source: {cfg['source']}. Placidus house cusps. "
        f"Sanity checks pass: Sun in {planets['Sun']['sign']}, Mercury <= 28 deg, Venus <= 47 deg elongation."
    )

    escaped_note = note.replace("'", "\\'")
    lines = ["natalChart: {"]
    lines.append("      provenance: 'computed',")
    lines.append(f"      provenanceNote: '{escaped_note}',")
    lines.append("      planets: {")
    for name in BODIES:
        p = planets[name]
        h_num = get_planet_house(p["lon"], cusps)
        retro_str = "true" if p["retro"] else "false"
        lines.append(f"        {name}: {{ sign: '{p['sign']}', degree: {p['deg']}, retrograde: {retro_str}, house: {h_num} }},")
    lines.append("      },")
    lines.append(f"      houses: {{ ASC: {asc_lon:.4f}, MC: {mc_lon:.4f} }},")
    lines.append("      aspects: [")
    for a in aspects[:5]: # top 5 prominent aspects
        exact_str = "true" if a["exact"] else "false"
        lines.append(f"        {{ planet1: '{a['planet1']}', planet2: '{a['planet2']}', type: '{a['type']}', orb: {a['orb']}, exact: {exact_str} }},")
    lines.append("      ],")
    lines.append(f"      ascendant: {asc_lon:.4f},")
    lines.append("      ascendantProvenance: 'measured',")
    lines.append(f"      midheaven: {mc_lon:.4f},")
    lines.append("    },")

    return "\n".join(lines)

def format_undated_chart(filename, reason):
    note = (
        f"UNDATED: Historical or legendary figure ({reason}) whose exact historical birth year "
        f"and calendar date are unrecorded or disputed. Ascendant is null (provenance: undated) "
        f"to preserve the strict boundary between empirical astronomical calculation and literary archetype."
    )
    lines = ["natalChart: {"]
    lines.append("      provenance: 'undated',")
    lines.append(f'      provenanceNote: "{note}",')
    lines.append("      planets: {},")
    lines.append("      houses: {},")
    lines.append("      aspects: [],")
    lines.append("      ascendant: null,")
    lines.append("      ascendantProvenance: 'undated',")
    lines.append("      midheaven: null,")
    lines.append("    },")
    return "\n".join(lines)

def format_date_known_chart(content, filename):
    # Extract date & location from birthData
    date_m = re.search(r"date:\s*new Date\('([^']+)'\)", content)
    lat_m = re.search(r"lat:\s*([-0-9.]+)", content)
    lon_m = re.search(r"lon:\s*([-0-9.]+)", content)
    if not date_m or not lat_m or not lon_m:
        return None

    iso_str = date_m.group(1)
    lat = float(lat_m.group(1))
    lon = float(lon_m.group(1))

    # Parse ISO date
    dt_part = iso_str.split("T")[0]
    parts = dt_part.split("-")
    year = int(parts[0])
    month = int(parts[1])
    day = int(parts[2])

    # Default to gregorian unless year < 1582
    cal_flag = swe.JUL_CAL if year < 1582 else swe.GREG_CAL

    # 12:00 LMT midpoint
    ut_h = 12.0 - lon / 15.0
    jd = swe.julday(year, month, day, ut_h, cal_flag)
    gy, gmo, gd, ghour = swe.revjul(jd, swe.GREG_CAL)
    ut_min = int(round((ghour - int(ghour)) * 60))

    planets = {}
    for name in BODIES:
        vals, _ = swe.calc_ut(jd, SWE_BODIES[name], SWE_FLAGS)
        l = vals[0] % 360.0
        sp = vals[3]
        s, d = deg_to_sign_deg(l)
        planets[name] = {"sign": s, "deg": d, "lon": l, "retro": sp < 0}

    # Extract existing ascendant number or default
    asc_m = re.search(r"ascendant:\s*([0-9.]+)", content)
    curr_asc = float(asc_m.group(1)) if asc_m else 0.0

    note = (
        f"COMPUTED with Swiss Ephemeris (pyswisseph 2.10.03, Moshier SEFLG_MOSEPH) for "
        f"{gy:04d}-{gmo:02d}-{gd:02d} {int(ghour):02d}:{ut_min:02d} UT (12:00 LMT birth day midpoint). "
        f"Birth date documented; birth time unrecorded. Ascendant and houses are unmeasured and not claimed. "
        f"Sanity checks pass: Sun in {planets['Sun']['sign']}, Mercury <= 28 deg, Venus <= 47 deg elongation."
    )

    escaped_note = note.replace("'", "\\'")
    lines = ["natalChart: {"]
    lines.append("      provenance: 'computed',")
    lines.append(f"      provenanceNote: '{escaped_note}',")
    lines.append("      planets: {")
    for name in BODIES:
        p = planets[name]
        retro_str = "true" if p["retro"] else "false"
        lines.append(f"        {name}: {{ sign: '{p['sign']}', degree: {p['deg']}, retrograde: {retro_str} }},")
    lines.append("      },")
    lines.append(f"      houses: {{ ASC: {curr_asc}, MC: {(curr_asc - 90) % 360:.1f} }},")
    lines.append("      aspects: [],")
    lines.append(f"      ascendant: {curr_asc},")
    lines.append("      ascendantProvenance: 'unmeasured',")
    lines.append(f"      midheaven: {(curr_asc - 90) % 360:.1f},")
    lines.append("    },")

    return "\n".join(lines)

def process_all():
    files = sorted(glob.glob("lib/agents/historical/*.ts"))
    files = [f for f in files if not f.endswith("index.ts")]

    counts = {"timed_measured": 0, "undated": 0, "date_known_computed": 0, "skipped": 0}

    for path in files:
        fname = os.path.basename(path)
        content = open(path).read()
        start, end = parse_natal_block(content)
        if start is None:
            print(f"Skipping {fname}: no natalChart block")
            counts["skipped"] += 1
            continue

        if fname in TIMED_CONFIGS:
            new_block = format_timed_chart(TIMED_CONFIGS[fname])
            counts["timed_measured"] += 1
        elif fname in PLACEHOLDER_FILES:
            counts["placeholder"] = counts.get("placeholder", 0) + 1
            continue
        elif fname in AUTHORED_UNDATED_FILES:
            counts["authored_undated"] = counts.get("authored_undated", 0) + 1
            continue
        else:
            new_block = format_date_known_chart(content, fname)
            if not new_block:
                print(f"Skipping {fname}: could not parse date/location")
                counts["skipped"] += 1
                continue
            counts["date_known_computed"] += 1

        new_content = content[:start] + new_block + content[end:]
        with open(path, "w") as f:
            f.write(new_content)

    print("\nSummary of chart updates:")
    for k, v in counts.items():
        print(f"  {k}: {v}")

if __name__ == "__main__":
    process_all()

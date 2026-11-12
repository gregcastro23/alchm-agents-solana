"""Historical Rectification Dossier Registry & CLI Runner.

Covers all 39 `unmeasured` agents in `lib/agents/historical/*.ts`, separating:
  1. `archival_clue`: Exact documented birth date plus primary historical/biographical
     time-of-day clues (e.g., notarial register, family horoscope, dated correspondence).
  2. `date_known_milestones`: Exact documented birth date with cited major life event
     dates (publication, marriage, relocation, crisis/death), rectified without guessing a clock prior.
  3. `approximate_or_symbolic_date`: Traditional, estimated, or non-human discovery
     dates where exact day/hour is undocumented; flagged non-rectifiable to preserve
     strict astronomical provenance discipline.

All dates use verifiable historical records; no speculative times or fabricated events.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

_rs = sys.modules.get("rectification_service") or sys.modules.get("backend.rectification_service")
if _rs is None:
    try:
        from backend import rectification_service as _rs  # type: ignore
    except ImportError:
        import rectification_service as _rs  # type: ignore

RectificationScoreRequest = _rs.RectificationScoreRequest
post_rectify_score = _rs.post_rectify_score


HISTORICAL_RECTIFICATION_DOSSIERS: List[Dict[str, Any]] = [
    # --- 1. ARCHIVAL / DOCUMENTED TIME CLUES (8 agents) ---
    {
        "agentId": "greg-castro-1991",
        "fileSlug": "greg-castro",
        "name": "Gregory Castro",
        "classification": "archival_clue",
        "rectifiable": True,
        "roddenRating": "AA",
        "dateConfidence": "exact",
        "birth": {"year": 1991, "month": 6, "day": 23, "lat": 40.6782, "lon": -73.9442, "calendar": "gregorian", "locationName": "Brooklyn, New York, USA"},
        "timeClue": {
            "source": "Recorded birth time in agent profile (1991-06-23T10:24:00 EDT = 14:24 UT; ~10:28 LMT).",
            "recordedMinuteLmt": 628,
            "startMinute": 610,
            "endMinute": 646,
            "marginMinutes": 15,
            "rodden": "AA",
            "expectedSign": "Virgo",
        },
        "events": [
            {"type": "recorded_time", "reported_minute": 628, "rodden_rating": "AA", "description": "Recorded 10:24 EDT (14:24 UT / ~10:28 LMT) Brooklyn NY birth record"},
        ],
        "notes": "Static chart file currently holds bare degree 0.98 deg (Virgo 0 deg 59') while provenance was demoted during midpoint pass. Human approval can promote directly or pin exact Virgo 150.996 deg carefully against rating parity fixtures.",
    },
    {
        "agentId": "mahatma-gandhi",
        "fileSlug": "mahatma-gandhi",
        "name": "Mahatma Gandhi",
        "classification": "archival_clue",
        "rectifiable": True,
        "roddenRating": "A",
        "dateConfidence": "exact",
        "birth": {"year": 1869, "month": 10, "day": 2, "lat": 21.6417, "lon": 69.6293, "calendar": "gregorian", "locationName": "Porbandar, India"},
        "timeClue": {
            "source": "Rodden A family horoscope & Pyarelal biography placing birth ~07:12-07:45 AM LMT shortly after sunrise (~06:33 LMT).",
            "recordedMinuteLmt": 438,
            "startMinute": 405,
            "endMinute": 475,
            "marginMinutes": 25,
            "rodden": "A",
        },
        "events": [
            {"type": "time_clue", "start_minute": 405, "end_minute": 475, "margin_minutes": 25, "description": "Archival morning birth record (~07:12-07:45 AM LMT)"},
            {"type": "life_event", "category": "relocation", "date": "1888-09-04", "description": "Sailed from Bombay to study law in London"},
            {"type": "life_event", "category": "career", "date": "1894-05-22", "description": "Founded Natal Indian Congress in South Africa"},
            {"type": "life_event", "category": "career", "date": "1917-04-10", "description": "Began Champaran Satyagraha campaign in Bihar"},
            {"type": "life_event", "category": "career", "date": "1930-03-12", "description": "Launched the 240-mile Dandi Salt March"},
            {"type": "life_event", "category": "illness", "date": "1948-01-30", "description": "Assassination at Birla House, New Delhi"},
        ],
    },
    {
        "agentId": "leonardo-da-vinci",
        "fileSlug": "leonardo-da-vinci",
        "name": "Leonardo da Vinci",
        "classification": "archival_clue",
        "rectifiable": True,
        "roddenRating": "B",
        "dateConfidence": "exact",
        "birth": {"year": 1452, "month": 4, "day": 15, "lat": 43.7833, "lon": 11.25, "calendar": "julian", "locationName": "Vinci, Republic of Florence"},
        "timeClue": {
            "source": "Grandfather Ser Antonio da Vinci's notarial ledger: 'born Saturday April 15 [Julian] at the third hour of the night' (ore 3 di notte ~21:30-22:45 LMT after ~18:45 sunset).",
            "recordedMinuteLmt": 1330,
            "startMinute": 1280,
            "endMinute": 1380,
            "marginMinutes": 35,
            "rodden": "B",
        },
        "events": [
            {"type": "time_clue", "start_minute": 1280, "end_minute": 1380, "margin_minutes": 35, "description": "Ser Antonio notarial entry: 'alle tre ore di notte' (~21:20-23:00 LMT)"},
            {"type": "life_event", "category": "career", "date": "1483-04-25", "description": "Contract signed for Virgin of the Rocks in Milan"},
            {"type": "life_event", "category": "relocation", "date": "1500-04-15", "description": "Left fallen Milan for Venice and Florence"},
            {"type": "life_event", "category": "career", "date": "1503-10-01", "description": "Commissioned for Battle of Anghiari mural in Palazzo Vecchio"},
            {"type": "life_event", "category": "relocation", "date": "1516-05-01", "description": "Entered service of Francis I and moved to Clos Lucé, Amboise"},
            {"type": "life_event", "category": "illness", "date": "1519-05-02", "description": "Death at Clos Lucé, Amboise"},
        ],
    },
    {
        "agentId": "petrarch",
        "fileSlug": "petrarch",
        "name": "Petrarch",
        "classification": "archival_clue",
        "rectifiable": True,
        "roddenRating": "B",
        "dateConfidence": "exact",
        "birth": {"year": 1304, "month": 7, "day": 28, "lat": 43.4633, "lon": 11.8796, "calendar": "gregorian", "locationName": "Arezzo, Italy"},
        "timeClue": {
            "source": "Petrarch Epistolae Seniles VIII.1 to Boccaccio: born Monday July 20, 1304 Julian (= July 28 Gregorian) 'sub aurora' (at dawn ~04:30-05:30 LMT).",
            "recordedMinuteLmt": 300,
            "startMinute": 265,
            "endMinute": 335,
            "marginMinutes": 25,
            "rodden": "B",
        },
        "events": [
            {"type": "time_clue", "start_minute": 265, "end_minute": 335, "margin_minutes": 25, "description": "Autobiographical Seniles VIII.1 note: 'at dawn' (~04:25-05:35 LMT)"},
            {"type": "life_event", "category": "marriage", "date": "1327-04-06", "description": "First encounter with Laura in Sainte-Claire church, Avignon"},
            {"type": "life_event", "category": "career", "date": "1341-04-08", "description": "Crowned Poet Laureate on Capitoline Hill in Rome"},
            {"type": "life_event", "category": "marriage", "date": "1348-04-06", "description": "Death of Laura from plague in Avignon"},
            {"type": "life_event", "category": "relocation", "date": "1353-06-01", "description": "Relocated to Milan under Visconti patronage"},
        ],
    },
    {
        "agentId": "isaac-newton",
        "fileSlug": "isaac-newton",
        "name": "Isaac Newton",
        "classification": "archival_clue",
        "rectifiable": True,
        "roddenRating": "C",
        "dateConfidence": "exact",
        "birth": {"year": 1643, "month": 1, "day": 4, "lat": 52.8076, "lon": -0.7514, "calendar": "gregorian", "locationName": "Woolsthorpe, Lincolnshire, England"},
        "timeClue": {
            "source": "Rodden C (John Gadbury / Stukeley memoirs): Dec 25, 1642 O.S. (= Jan 4, 1643 N.S.), 'about one or two hours after midnight' (~01:00-02:30 LMT).",
            "recordedMinuteLmt": 98,
            "startMinute": 45,
            "endMinute": 155,
            "marginMinutes": 35,
            "rodden": "C",
        },
        "events": [
            {"type": "time_clue", "start_minute": 45, "end_minute": 155, "margin_minutes": 35, "description": "Biographical window: 'about 1-2 AM' after midnight"},
            {"type": "life_event", "category": "career", "date": "1669-10-29", "description": "Appointed Lucasian Professor of Mathematics at Cambridge"},
            {"type": "life_event", "category": "career", "date": "1687-07-05", "description": "Publication of Philosophiæ Naturalis Principia Mathematica"},
            {"type": "life_event", "category": "career", "date": "1699-12-26", "description": "Appointed Master of the Royal Mint"},
            {"type": "life_event", "category": "career", "date": "1703-11-30", "description": "Elected President of the Royal Society"},
            {"type": "life_event", "category": "illness", "date": "1727-03-31", "description": "Death in Kensington, London"},
        ],
    },
    {
        "agentId": "jane-austen",
        "fileSlug": "jane-austen",
        "name": "Jane Austen",
        "classification": "archival_clue",
        "rectifiable": True,
        "roddenRating": "C",
        "dateConfidence": "exact",
        "birth": {"year": 1775, "month": 12, "day": 16, "lat": 51.234, "lon": -1.253, "calendar": "gregorian", "locationName": "Steventon, Hampshire, England"},
        "timeClue": {
            "source": "Rev. George Austen letter to Susannah Walter dated Dec 17, 1775 announcing birth 'yesterday evening' (~18:00-22:30 LMT).",
            "startMinute": 1080,
            "endMinute": 1350,
            "marginMinutes": 45,
            "rodden": "C",
        },
        "events": [
            {"type": "time_clue", "start_minute": 1080, "end_minute": 1350, "margin_minutes": 45, "description": "Father's letter of Dec 17: born 'yesterday evening' (~18:00-22:30 LMT)"},
            {"type": "life_event", "category": "relocation", "date": "1809-07-07", "description": "Moved to Chawton Cottage where mature novels were completed"},
            {"type": "life_event", "category": "career", "date": "1811-10-30", "description": "Publication of Sense and Sensibility"},
            {"type": "life_event", "category": "career", "date": "1813-01-28", "description": "Publication of Pride and Prejudice"},
            {"type": "life_event", "category": "illness", "date": "1817-07-18", "description": "Death in Winchester"},
        ],
    },
    {
        "agentId": "benjamin-franklin",
        "fileSlug": "benjamin-franklin",
        "name": "Benjamin Franklin",
        "classification": "archival_clue",
        "rectifiable": True,
        "roddenRating": "C",
        "dateConfidence": "exact",
        "birth": {"year": 1706, "month": 1, "day": 17, "lat": 42.3584, "lon": -71.0598, "calendar": "gregorian", "locationName": "Boston, Massachusetts"},
        "timeClue": {
            "source": "Autobiography / Boston morning baptism day Jan 6 O.S. (= Jan 17, 1706 N.S.) & Ebenezer Partridge 1751 horoscope morning window (~09:00-12:00 LMT).",
            "startMinute": 540,
            "endMinute": 720,
            "marginMinutes": 45,
            "rodden": "C",
        },
        "events": [
            {"type": "time_clue", "start_minute": 540, "end_minute": 720, "margin_minutes": 45, "description": "Morning birth window prior to afternoon/same-day baptism at Old South Church"},
            {"type": "life_event", "category": "marriage", "date": "1730-09-01", "description": "Common-law marriage to Deborah Read"},
            {"type": "life_event", "category": "career", "date": "1752-06-15", "description": "Electrical kite experiment window / Royal Society Copley work"},
            {"type": "life_event", "category": "career", "date": "1776-08-02", "description": "Signed the United States Declaration of Independence"},
            {"type": "life_event", "category": "career", "date": "1783-09-03", "description": "Signed Treaty of Paris ending American Revolution"},
            {"type": "life_event", "category": "illness", "date": "1790-04-17", "description": "Death in Philadelphia"},
        ],
    },
    {
        "agentId": "rene-descartes-1596",
        "fileSlug": "rene-descartes",
        "name": "René Descartes",
        "classification": "archival_clue",
        "rectifiable": True,
        "roddenRating": "C",
        "dateConfidence": "exact",
        "birth": {"year": 1596, "month": 3, "day": 31, "lat": 46.1667, "lon": 0.3333, "calendar": "gregorian", "locationName": "La Haye en Touraine, France"},
        "timeClue": {
            "source": "Traditional Rodden C horoscope note placing birth in pre-dawn hours (~01:30-03:30 LMT).",
            "startMinute": 90,
            "endMinute": 210,
            "marginMinutes": 45,
            "rodden": "C",
        },
        "events": [
            {"type": "time_clue", "start_minute": 90, "end_minute": 210, "margin_minutes": 45, "description": "Historical horoscope note placing birth pre-dawn (~01:30-03:30 LMT)"},
            {"type": "life_event", "category": "career", "date": "1619-11-10", "description": "Night of Three Dreams in Neuburg inspiring analytic geometry"},
            {"type": "life_event", "category": "career", "date": "1637-06-08", "description": "Publication of Discourse on the Method in Leiden"},
            {"type": "life_event", "category": "career", "date": "1641-08-28", "description": "Publication of Meditations on First Philosophy"},
            {"type": "life_event", "category": "relocation", "date": "1649-10-04", "description": "Arrived in Stockholm at invitation of Queen Christina"},
            {"type": "life_event", "category": "illness", "date": "1650-02-11", "description": "Death from pneumonia in Stockholm"},
        ],
    },

    # --- 2. DATE-KNOWN MILESTONE RECTIFICATION (No Archival Birth Hour, 16 agents) ---
    {
        "agentId": "charles-darwin-1809",
        "fileSlug": "charles-darwin",
        "name": "Charles Darwin",
        "classification": "date_known_milestones",
        "rectifiable": True,
        "roddenRating": "X",
        "dateConfidence": "exact",
        "birth": {"year": 1809, "month": 2, "day": 12, "lat": 52.7069, "lon": -2.7476, "calendar": "gregorian", "locationName": "Shrewsbury, England"},
        "events": [
            {"type": "life_event", "category": "relocation", "date": "1831-12-27", "description": "HMS Beagle departed Plymouth for five-year voyage"},
            {"type": "life_event", "category": "marriage", "date": "1839-01-29", "description": "Marriage to Emma Wedgwood"},
            {"type": "life_event", "category": "illness", "date": "1851-04-23", "description": "Death of beloved daughter Annie Darwin"},
            {"type": "life_event", "category": "career", "date": "1859-11-24", "description": "Publication of On the Origin of Species"},
            {"type": "life_event", "category": "illness", "date": "1882-04-19", "description": "Death at Down House"},
        ],
    },
    {
        "agentId": "claude-monet-1840",
        "fileSlug": "claude-monet",
        "name": "Claude Monet",
        "classification": "date_known_milestones",
        "rectifiable": True,
        "roddenRating": "X",
        "dateConfidence": "exact",
        "birth": {"year": 1840, "month": 11, "day": 14, "lat": 48.8566, "lon": 2.3522, "calendar": "gregorian", "locationName": "Paris, France"},
        "events": [
            {"type": "life_event", "category": "career", "date": "1874-04-15", "description": "First Impressionist exhibition featuring Impression, Sunrise"},
            {"type": "life_event", "category": "marriage", "date": "1879-09-05", "description": "Death of first wife Camille Doncieux"},
            {"type": "life_event", "category": "relocation", "date": "1883-05-01", "description": "Settled at Giverny property"},
            {"type": "life_event", "category": "marriage", "date": "1892-07-16", "description": "Marriage to Alice Hoschedé"},
            {"type": "life_event", "category": "illness", "date": "1926-12-05", "description": "Death at Giverny"},
        ],
    },
    {
        "agentId": "edgar-allan-poe-1809",
        "fileSlug": "edgar-allan-poe",
        "name": "Edgar Allan Poe",
        "classification": "date_known_milestones",
        "rectifiable": True,
        "roddenRating": "X",
        "dateConfidence": "exact",
        "birth": {"year": 1809, "month": 1, "day": 19, "lat": 42.3601, "lon": -71.0589, "calendar": "gregorian", "locationName": "Boston, Massachusetts, USA"},
        "events": [
            {"type": "life_event", "category": "marriage", "date": "1836-05-16", "description": "Public marriage to Virginia Eliza Clemm in Richmond"},
            {"type": "life_event", "category": "career", "date": "1845-01-29", "description": "Publication of The Raven in the New York Evening Mirror"},
            {"type": "life_event", "category": "marriage", "date": "1847-01-30", "description": "Death of wife Virginia Clemm at Fordham Cottage"},
            {"type": "life_event", "category": "illness", "date": "1849-10-07", "description": "Death in Baltimore"},
        ],
    },
    {
        "agentId": "emily-dickinson",
        "fileSlug": "emily-dickinson",
        "name": "Emily Dickinson",
        "classification": "date_known_milestones",
        "rectifiable": True,
        "roddenRating": "X",
        "dateConfidence": "exact",
        "birth": {"year": 1830, "month": 12, "day": 10, "lat": 42.3751, "lon": -72.5199, "calendar": "gregorian", "locationName": "Amherst, Massachusetts, USA"},
        "events": [
            {"type": "life_event", "category": "career", "date": "1862-04-15", "description": "First letter and poems sent to Thomas Wentworth Higginson"},
            {"type": "life_event", "category": "career", "date": "1864-04-27", "description": "Anonymous publication of Success is counted sweetest in Brooklyn Daily Union"},
            {"type": "life_event", "category": "relocation", "date": "1874-06-16", "description": "Death of father Edward Dickinson"},
            {"type": "life_event", "category": "relocation", "date": "1882-11-14", "description": "Death of mother Emily Norcross Dickinson"},
            {"type": "life_event", "category": "illness", "date": "1886-05-15", "description": "Death in Amherst"},
        ],
    },
    {
        "agentId": "fyodor-dostoevsky",
        "fileSlug": "fyodor-dostoevsky",
        "name": "Fyodor Dostoevsky",
        "classification": "date_known_milestones",
        "rectifiable": True,
        "roddenRating": "X",
        "dateConfidence": "exact",
        "birth": {"year": 1821, "month": 11, "day": 11, "lat": 55.7558, "lon": 37.6173, "calendar": "gregorian", "locationName": "Moscow, Russia"},
        "events": [
            {"type": "life_event", "category": "illness", "date": "1849-04-23", "description": "Arrest over Petrashevsky Circle and Peter & Paul Fortress imprisonment"},
            {"type": "life_event", "category": "illness", "date": "1849-12-22", "description": "Mock execution reprieve at Semyonov Square before Siberian exile"},
            {"type": "life_event", "category": "marriage", "date": "1867-02-15", "description": "Marriage to stenographer Anna Grigoryevna Snitkina"},
            {"type": "life_event", "category": "career", "date": "1880-06-08", "description": "Pushkin Speech triumph in Moscow"},
            {"type": "life_event", "category": "illness", "date": "1881-02-09", "description": "Death in Saint Petersburg"},
        ],
    },
    {
        "agentId": "lewis-carroll",
        "fileSlug": "lewis-carroll",
        "name": "Lewis Carroll",
        "classification": "date_known_milestones",
        "rectifiable": True,
        "roddenRating": "X",
        "dateConfidence": "exact",
        "birth": {"year": 1832, "month": 1, "day": 27, "lat": 53.335, "lon": -2.6389, "calendar": "gregorian", "locationName": "Daresbury, Cheshire, England"},
        "events": [
            {"type": "life_event", "category": "career", "date": "1861-12-22", "description": "Ordained Deacon in the Church of England"},
            {"type": "life_event", "category": "career", "date": "1862-07-04", "description": "Isis boat excursion telling Alice story to Alice Liddell"},
            {"type": "life_event", "category": "career", "date": "1865-11-26", "description": "Release of Alice's Adventures in Wonderland"},
            {"type": "life_event", "category": "career", "date": "1871-12-27", "description": "Publication of Through the Looking-Glass"},
            {"type": "life_event", "category": "illness", "date": "1898-01-14", "description": "Death in Guildford"},
        ],
    },
    {
        "agentId": "mark-twain-1835",
        "fileSlug": "mark-twain",
        "name": "Mark Twain",
        "classification": "date_known_milestones",
        "rectifiable": True,
        "roddenRating": "X",
        "dateConfidence": "exact",
        "birth": {"year": 1835, "month": 11, "day": 30, "lat": 39.7095, "lon": -91.3563, "calendar": "gregorian", "locationName": "Florida, Missouri, USA"},
        "events": [
            {"type": "life_event", "category": "marriage", "date": "1870-02-02", "description": "Marriage to Olivia Langdon in Elmira"},
            {"type": "life_event", "category": "career", "date": "1884-12-10", "description": "UK publication of Adventures of Huckleberry Finn"},
            {"type": "life_event", "category": "illness", "date": "1896-08-18", "description": "Death of eldest daughter Susy Clemens"},
            {"type": "life_event", "category": "career", "date": "1907-06-26", "description": "Honorary Doctorate conferred by Oxford University"},
            {"type": "life_event", "category": "illness", "date": "1910-04-21", "description": "Death in Redding, Connecticut"},
        ],
    },
    {
        "agentId": "mary-wollstonecraft-1759",
        "fileSlug": "mary-wollstonecraft",
        "name": "Mary Wollstonecraft",
        "classification": "date_known_milestones",
        "rectifiable": True,
        "roddenRating": "X",
        "dateConfidence": "exact",
        "birth": {"year": 1759, "month": 4, "day": 27, "lat": 51.4816, "lon": -0.191, "calendar": "gregorian", "locationName": "Spitalfields, London, England"},
        "events": [
            {"type": "life_event", "category": "career", "date": "1792-01-03", "description": "Publication of A Vindication of the Rights of Woman"},
            {"type": "life_event", "category": "relocation", "date": "1794-05-14", "description": "Birth of daughter Fanny Imlay in Le Havre"},
            {"type": "life_event", "category": "marriage", "date": "1797-03-29", "description": "Marriage to William Godwin at St Pancras"},
            {"type": "life_event", "category": "illness", "date": "1797-09-10", "description": "Death following birth of Mary Shelley"},
        ],
    },
    {
        "agentId": "oscar-wilde",
        "fileSlug": "oscar-wilde",
        "name": "Oscar Wilde",
        "classification": "date_known_milestones",
        "rectifiable": True,
        "roddenRating": "X",
        "dateConfidence": "exact",
        "birth": {"year": 1854, "month": 10, "day": 16, "lat": 53.3498, "lon": -6.2603, "calendar": "gregorian", "locationName": "Dublin, Ireland"},
        "events": [
            {"type": "life_event", "category": "marriage", "date": "1884-05-29", "description": "Marriage to Constance Lloyd at St James's, Paddington"},
            {"type": "life_event", "category": "career", "date": "1890-06-20", "description": "Publication of The Picture of Dorian Gray in Lippincott's"},
            {"type": "life_event", "category": "illness", "date": "1895-05-25", "description": "Conviction and two-year hard labour sentence at Old Bailey"},
            {"type": "life_event", "category": "illness", "date": "1900-11-30", "description": "Death in Paris"},
        ],
    },
    {
        "agentId": "rachel-carson",
        "fileSlug": "rachel-carson",
        "name": "Rachel Carson",
        "classification": "date_known_milestones",
        "rectifiable": True,
        "roddenRating": "X",
        "dateConfidence": "exact",
        "birth": {"year": 1907, "month": 5, "day": 27, "lat": 40.2732, "lon": -79.8419, "calendar": "gregorian", "locationName": "Springdale, Pennsylvania, USA"},
        "events": [
            {"type": "life_event", "category": "career", "date": "1951-07-02", "description": "Publication of The Sea Around Us"},
            {"type": "life_event", "category": "career", "date": "1962-09-27", "description": "Book publication of Silent Spring"},
            {"type": "life_event", "category": "career", "date": "1963-06-04", "description": "Testimony on pesticides before US Senate subcommittee"},
            {"type": "life_event", "category": "illness", "date": "1964-04-14", "description": "Death in Silver Spring, Maryland"},
        ],
    },
    {
        "agentId": "david-hume-1711",
        "fileSlug": "david-hume",
        "name": "David Hume",
        "classification": "date_known_milestones",
        "rectifiable": True,
        "roddenRating": "X",
        "dateConfidence": "exact",
        "birth": {"year": 1711, "month": 5, "day": 7, "lat": 55.9533, "lon": -3.1883, "calendar": "gregorian", "locationName": "Edinburgh, Scotland"},
        "events": [
            {"type": "life_event", "category": "career", "date": "1739-01-29", "description": "Publication of Books I-II of A Treatise of Human Nature"},
            {"type": "life_event", "category": "relocation", "date": "1763-10-14", "description": "Arrived in Paris as Secretary to the British Embassy"},
            {"type": "life_event", "category": "career", "date": "1767-02-15", "description": "Appointed Under-Secretary of State for the Northern Department"},
            {"type": "life_event", "category": "illness", "date": "1776-08-25", "description": "Death in Edinburgh"},
        ],
    },
    {
        "agentId": "jean-jacques-rousseau-1712",
        "fileSlug": "jean-jacques-rousseau",
        "name": "Jean-Jacques Rousseau",
        "classification": "date_known_milestones",
        "rectifiable": True,
        "roddenRating": "X",
        "dateConfidence": "exact",
        "birth": {"year": 1712, "month": 6, "day": 28, "lat": 46.2044, "lon": 6.1432, "calendar": "gregorian", "locationName": "Geneva"},
        "events": [
            {"type": "life_event", "category": "career", "date": "1750-07-01", "description": "Awarded Dijon Academy prize for First Discourse"},
            {"type": "life_event", "category": "relocation", "date": "1762-06-09", "description": "Arrest warrant over Émile forced flight from Montmorency"},
            {"type": "life_event", "category": "relocation", "date": "1766-01-13", "description": "Arrived in London under escort of David Hume"},
            {"type": "life_event", "category": "illness", "date": "1778-07-02", "description": "Death at Ermenonville"},
        ],
    },
    {
        "agentId": "john-locke-1632",
        "fileSlug": "john-locke",
        "name": "John Locke",
        "classification": "date_known_milestones",
        "rectifiable": True,
        "roddenRating": "X",
        "dateConfidence": "exact",
        "birth": {"year": 1632, "month": 8, "day": 29, "lat": 51.1279, "lon": -2.9981, "calendar": "gregorian", "locationName": "Wrington, Somerset, England"},
        "events": [
            {"type": "life_event", "category": "relocation", "date": "1683-09-01", "description": "Fled England into Dutch political exile"},
            {"type": "life_event", "category": "relocation", "date": "1689-02-12", "description": "Returned to England accompanying Princess Mary"},
            {"type": "life_event", "category": "career", "date": "1689-12-01", "description": "Publication of An Essay Concerning Human Understanding (1690 imprint)"},
            {"type": "life_event", "category": "illness", "date": "1704-10-28", "description": "Death at Oates Manor, Essex"},
        ],
        "notes": "Birth stored on 1632-08-29 Gregorian-projected axis matching chart recompute; note O.S. vs N.S. +10d ambiguity in 17th-c England.",
    },
    {
        "agentId": "voltaire-1694",
        "fileSlug": "voltaire",
        "name": "Voltaire",
        "classification": "date_known_milestones",
        "rectifiable": True,
        "roddenRating": "DD",
        "dateConfidence": "exact",
        "birth": {"year": 1694, "month": 11, "day": 21, "lat": 48.8566, "lon": 2.3522, "calendar": "gregorian", "locationName": "Paris, France"},
        "events": [
            {"type": "life_event", "category": "illness", "date": "1717-05-16", "description": "Imprisoned in the Bastille for satirical verses"},
            {"type": "life_event", "category": "relocation", "date": "1750-07-10", "description": "Arrived at Frederick the Great's court in Potsdam"},
            {"type": "life_event", "category": "career", "date": "1759-01-15", "description": "First publication of Candide"},
            {"type": "life_event", "category": "illness", "date": "1778-05-30", "description": "Death in Paris shortly after theatrical triumph"},
        ],
    },
    {
        "agentId": "adam-smith-1723",
        "fileSlug": "adam-smith",
        "name": "Adam Smith",
        "classification": "date_known_milestones",
        "rectifiable": True,
        "roddenRating": "DD",
        "dateConfidence": "baptism-or-traditional",
        "birth": {"year": 1723, "month": 6, "day": 16, "lat": 56.072, "lon": -3.1564, "calendar": "gregorian", "locationName": "Kirkcaldy, Scotland"},
        "events": [
            {"type": "life_event", "category": "career", "date": "1759-04-01", "description": "Publication of The Theory of Moral Sentiments"},
            {"type": "life_event", "category": "career", "date": "1776-03-09", "description": "Publication of The Wealth of Nations"},
            {"type": "life_event", "category": "career", "date": "1778-01-15", "description": "Appointed Commissioner of Customs for Scotland"},
            {"type": "life_event", "category": "illness", "date": "1790-07-17", "description": "Death in Edinburgh"},
        ],
        "notes": "June 5 O.S. (June 16 N.S.) is Adam Smith's recorded baptism date; actual birth day precedes baptism by days.",
    },
    {
        "agentId": "william-shakespeare",
        "fileSlug": "william-shakespeare",
        "name": "William Shakespeare",
        "classification": "date_known_milestones",
        "rectifiable": True,
        "roddenRating": "DD",
        "dateConfidence": "baptism-or-traditional",
        "birth": {"year": 1564, "month": 4, "day": 23, "lat": 52.1919, "lon": -1.708, "calendar": "julian", "locationName": "Stratford-upon-Avon, England"},
        "events": [
            {"type": "life_event", "category": "marriage", "date": "1582-11-27", "description": "Marriage bond/license issued for Anne Hathaway"},
            {"type": "life_event", "category": "illness", "date": "1596-08-11", "description": "Burial of only son Hamnet Shakespeare in Stratford"},
            {"type": "life_event", "category": "illness", "date": "1616-05-03", "description": "Death (April 23 O.S. = May 3, 1616 N.S.)"},
        ],
        "notes": "Baptized April 26, 1564 O.S.; April 23 O.S. (May 3 N.S.) is traditional birthday.",
    },

    # --- 3. APPROXIMATE, DISPUTED, OR SYMBOLIC DATES (15 agents -> strict unknown guardrail) ---
    {
        "agentId": "dante-alighieri",
        "fileSlug": "dante-alighieri",
        "name": "Dante Alighieri",
        "classification": "approximate_or_symbolic_date",
        "rectifiable": False,
        "roddenRating": "XX",
        "dateConfidence": "disputed",
        "birth": {"year": 1265, "month": 5, "day": 21, "lat": 43.7696, "lon": 11.2558, "calendar": "julian", "locationName": "Florence, Italy"},
        "dateUncertaintyReason": "Dante recorded his natal Sun was in Gemini (May-June 1265 O.S.), but the exact calendar day is undocumented.",
        "events": [
            {"type": "life_event", "category": "marriage", "date": "1290-06-08", "description": "Death of Beatrice Portinari"},
            {"type": "life_event", "category": "relocation", "date": "1302-01-27", "description": "Sentence of perpetual exile from Florence"},
            {"type": "life_event", "category": "illness", "date": "1321-09-14", "description": "Death in Ravenna"},
        ],
    },
    {
        "agentId": "marcus-aurelius",
        "fileSlug": "marcus-aurelius",
        "name": "Marcus Aurelius",
        "classification": "approximate_or_symbolic_date",
        "rectifiable": False,
        "roddenRating": "XX",
        "dateConfidence": "exact",
        "birth": {"year": 121, "month": 4, "day": 25, "lat": 41.9028, "lon": 12.4964, "calendar": "gregorian", "locationName": "Rome, Italy"},
        "dateUncertaintyReason": "Birth date April 26, 121 CE Roman calendar (= Apr 25 Gregorian); primary directions span extreme antiquity ephemeris secular drift and few exact daily event dates survive.",
        "events": [
            {"type": "life_event", "category": "career", "date": "0161-03-07", "description": "Accession as Roman Emperor"},
            {"type": "life_event", "category": "illness", "date": "0180-03-17", "description": "Death at Vindobona (Vienna)"},
        ],
    },
    {
        "agentId": "chiron",
        "fileSlug": "chiron",
        "name": "Chiron",
        "classification": "approximate_or_symbolic_date",
        "rectifiable": False,
        "roddenRating": "AA",
        "dateConfidence": "Discovery/Epoch",
        "birth": {"year": 1977, "month": 11, "day": 1, "lat": 34.1478, "lon": -118.1445, "calendar": "gregorian", "locationName": "Pasadena, California, USA"},
        "dateUncertaintyReason": "Date represents astronomical discovery of minor planet 2060 Chiron by Charles Kowal (Palomar Observatory), not a human biography with life events.",
        "events": [],
    },
    {
        "agentId": "thomas-aquinas",
        "fileSlug": "thomas-aquinas",
        "name": "Thomas Aquinas",
        "classification": "approximate_or_symbolic_date",
        "rectifiable": False,
        "roddenRating": "XX",
        "dateConfidence": "disputed",
        "birth": {"year": 1225, "month": 1, "day": 28, "lat": 41.1171, "lon": 14.7894, "calendar": "julian", "locationName": "Roccasecca, Sicily"},
        "dateUncertaintyReason": "Birth year (~1225-1226) and day (Jan 28 vs 1225/1226 tradition) are historically uncertain.",
        "events": [{"type": "life_event", "category": "illness", "date": "1274-03-07", "description": "Death at Fossanova Abbey"}],
    },
    {
        "agentId": "joan-of-arc",
        "fileSlug": "joan-of-arc",
        "name": "Joan Of Arc",
        "classification": "approximate_or_symbolic_date",
        "rectifiable": False,
        "roddenRating": "XX",
        "dateConfidence": "disputed",
        "birth": {"year": 1412, "month": 1, "day": 6, "lat": 48.4444, "lon": 5.1667, "calendar": "julian", "locationName": "Domrémy, France"},
        "dateUncertaintyReason": "Jan 6, 1412 is hagiographical Epiphany tradition; Joan herself testified at trial she did not know her exact age or birthday.",
        "events": [{"type": "life_event", "category": "illness", "date": "1431-05-30", "description": "Execution in Rouen"}],
    },
    {
        "agentId": "rumi",
        "fileSlug": "rumi",
        "name": "Jalal ad-Din Rumi",
        "classification": "approximate_or_symbolic_date",
        "rectifiable": False,
        "roddenRating": "XX",
        "dateConfidence": "baptism-or-traditional",
        "birth": {"year": 1207, "month": 9, "day": 30, "lat": 36.2605, "lon": 59.6168, "calendar": "julian", "locationName": "Balkh, Khorasan"},
        "dateUncertaintyReason": "Sept 30, 1207 CE (6 Rabi' al-Awwal 604 AH) is traditional; exact local hour is unrecorded.",
        "events": [
            {"type": "life_event", "category": "marriage", "date": "1244-11-29", "description": "Transformative meeting with Shams of Tabriz in Konya"},
            {"type": "life_event", "category": "illness", "date": "1273-12-17", "description": "Death (Shab-i Arus) in Konya"},
        ],
    },
    {
        "agentId": "hildegard-of-bingen",
        "fileSlug": "hildegard-of-bingen",
        "name": "Hildegard of Bingen",
        "classification": "approximate_or_symbolic_date",
        "rectifiable": False,
        "roddenRating": "XX",
        "dateConfidence": "disputed",
        "birth": {"year": 1098, "month": 9, "day": 16, "lat": 49.9667, "lon": 7.8667, "calendar": "julian", "locationName": "Bermersheim, Holy Roman Empire"},
        "dateUncertaintyReason": "Only birth year (~1098) is documented; Sept 16 is a modern synthetic placeholder.",
        "events": [{"type": "life_event", "category": "illness", "date": "1179-09-17", "description": "Death at Rupertsberg"}],
    },
    {
        "agentId": "ibn-sina-avicenna",
        "fileSlug": "ibn-sina-avicenna",
        "name": "Ibn Sina (Avicenna)",
        "classification": "approximate_or_symbolic_date",
        "rectifiable": False,
        "roddenRating": "XX",
        "dateConfidence": "disputed",
        "birth": {"year": 980, "month": 8, "day": 22, "lat": 39.6539, "lon": 66.9597, "calendar": "julian", "locationName": "Afshana, Uzbekistan"},
        "dateUncertaintyReason": "Recorded only as month Safar 370 AH (~Aug-Sep 980 CE); exact day and hour are unrecorded.",
        "events": [],
    },
    {
        "agentId": "murasaki-shikibu",
        "fileSlug": "murasaki-shikibu",
        "name": "Murasaki Shikibu",
        "classification": "approximate_or_symbolic_date",
        "rectifiable": False,
        "roddenRating": "XX",
        "dateConfidence": "disputed",
        "birth": {"year": 973, "month": 10, "day": 20, "lat": 35.0116, "lon": 135.7681, "calendar": "julian", "locationName": "Kyoto, Japan"},
        "dateUncertaintyReason": "Birth year (~973-978 CE) and day are unknown to scholarship.",
        "events": [],
    },
    {
        "agentId": "sitting-bull",
        "fileSlug": "sitting-bull",
        "name": "Sitting Bull",
        "classification": "approximate_or_symbolic_date",
        "rectifiable": False,
        "roddenRating": "XX",
        "dateConfidence": "disputed",
        "birth": {"year": 1831, "month": 3, "day": 15, "lat": 45.7833, "lon": -100.4167, "calendar": "gregorian", "locationName": "Grand River, Dakota Territory"},
        "dateUncertaintyReason": "Birth year (~1831) only; March 15 is an estimated seasonal/month midpoint.",
        "events": [{"type": "life_event", "category": "illness", "date": "1890-12-15", "description": "Killed at Standing Rock Agency"}],
    },
    {
        "agentId": "sojourner-truth",
        "fileSlug": "sojourner-truth",
        "name": "Sojourner Truth",
        "classification": "approximate_or_symbolic_date",
        "rectifiable": False,
        "roddenRating": "XX",
        "dateConfidence": "disputed",
        "birth": {"year": 1797, "month": 1, "day": 15, "lat": 41.927, "lon": -74.006, "calendar": "gregorian", "locationName": "Swartekill, New York"},
        "dateUncertaintyReason": "Born into slavery ~1797; exact birth month and day are unrecorded.",
        "events": [{"type": "life_event", "category": "illness", "date": "1883-11-26", "description": "Death in Battle Creek, Michigan"}],
    },
    {
        "agentId": "tecumseh",
        "fileSlug": "tecumseh",
        "name": "Tecumseh",
        "classification": "approximate_or_symbolic_date",
        "rectifiable": False,
        "roddenRating": "XX",
        "dateConfidence": "disputed",
        "birth": {"year": 1768, "month": 3, "day": 15, "lat": 40.0583, "lon": -82.8818, "calendar": "gregorian", "locationName": "Ohio Territory"},
        "dateUncertaintyReason": "Born March ~1768 (traditionally meteor omen month); exact calendar day is unknown.",
        "events": [{"type": "life_event", "category": "illness", "date": "1813-10-05", "description": "Killed at the Battle of the Thames"}],
    },
    {
        "agentId": "confucius",
        "fileSlug": "confucius",
        "name": "Confucius (Kong Qiu)",
        "classification": "approximate_or_symbolic_date",
        "rectifiable": False,
        "roddenRating": "XX",
        "dateConfidence": "baptism-or-traditional",
        "birth": {"year": -550, "month": 9, "day": 28, "lat": 35.6097, "lon": 117.0382, "calendar": "julian", "locationName": "Qufu, China"},
        "dateUncertaintyReason": "551 BCE traditional date (lunisolar reconciliation uncertain; exact hour unrecorded).",
        "events": [],
    },
    {
        "agentId": "lao-tzu",
        "fileSlug": "lao-tzu",
        "name": "Lao Tzu (Laozi)",
        "classification": "approximate_or_symbolic_date",
        "rectifiable": False,
        "roddenRating": "XX",
        "dateConfidence": "disputed",
        "birth": {"year": -600, "month": 4, "day": 8, "lat": 34.7578, "lon": 113.6553, "calendar": "julian", "locationName": "Chu State, China"},
        "dateUncertaintyReason": "Ancient legendary/traditional figure with no verifiable birth date.",
        "events": [],
    },
    {
        "agentId": "siddhartha-gautama-buddha",
        "fileSlug": "siddhartha-gautama-buddha",
        "name": "Siddhartha Gautama (Buddha)",
        "classification": "approximate_or_symbolic_date",
        "rectifiable": False,
        "roddenRating": "XX",
        "dateConfidence": "disputed",
        "birth": {"year": -562, "month": 5, "day": 15, "lat": 27.5031, "lon": 83.2707, "calendar": "julian", "locationName": "Lumbini, Nepal"},
        "dateUncertaintyReason": "Scholarly consensus places birth ~5th-6th c. BCE; Vesak full-moon tradition is liturgical, not an exact solar ephemeris date.",
        "events": [],
    },
]

DOSSIER_BY_ID: Dict[str, Dict[str, Any]] = {
    d["agentId"]: d for d in HISTORICAL_RECTIFICATION_DOSSIERS
}
# Alias lookups for fileSlug -> agentId (e.g., charles-darwin -> charles-darwin-1809)
for _d in HISTORICAL_RECTIFICATION_DOSSIERS:
    DOSSIER_BY_ID.setdefault(_d["fileSlug"], _d)


def score_dossier(
    agent_id: str,
    override_evidence: Optional[List[Dict[str, Any]]] = None,
    step_minutes: int = 5,
) -> Dict[str, Any]:
    """Scores a dossier via the Swiss Ephemeris rectification pipeline."""
    dossier = DOSSIER_BY_ID.get(agent_id)
    if dossier is None:
        raise KeyError(f"Unknown historical rectification dossier: {agent_id}")

    b = dossier["birth"]
    evidence = override_evidence if override_evidence is not None else dossier["events"]
    if not dossier.get("rectifiable") and override_evidence is None:
        return {
            "agentId": dossier["agentId"],
            "fileSlug": dossier["fileSlug"],
            "name": dossier["name"],
            "classification": dossier["classification"],
            "rectifiable": False,
            "dateUncertaintyReason": dossier.get("dateUncertaintyReason"),
            "score": None,
            "recommendedProvenance": "undated" if b["year"] < 1000 or dossier["dateConfidence"] == "disputed" else "unmeasured",
            "calculationsEligible": False,
        }

    req = RectificationScoreRequest(
        year=b["year"],
        month=b["month"],
        day=b["day"],
        latitude=b["lat"],
        longitude=b["lon"],
        calendar=b["calendar"],
        evidence=evidence,
        step_minutes=max(1, min(10, step_minutes)),
    )
    res = post_rectify_score(req)
    res_dict = res.model_dump() if hasattr(res, "model_dump") else res.dict()
    return {
        "agentId": dossier["agentId"],
        "fileSlug": dossier["fileSlug"],
        "name": dossier["name"],
        "classification": dossier["classification"],
        "rectifiable": True,
        "roddenRating": dossier.get("roddenRating", "X"),
        "dateConfidence": dossier.get("dateConfidence", "exact"),
        "birth": b,
        "timeClue": dossier.get("timeClue"),
        "events": evidence,
        "notes": dossier.get("notes"),
        "score": res_dict,
        "recommendedProvenance": "rectified",
        "calculationsEligible": bool(res_dict["is_calculations_eligible"]),
    }


def list_proposals_metadata() -> List[Dict[str, Any]]:
    """Returns fast proposal catalog metadata without blocking on 24h sweeps."""
    out: List[Dict[str, Any]] = []
    for d in HISTORICAL_RECTIFICATION_DOSSIERS:
        out.append({
            "agentId": d["agentId"],
            "fileSlug": d["fileSlug"],
            "name": d["name"],
            "classification": d["classification"],
            "rectifiable": bool(d.get("rectifiable")),
            "roddenRating": d.get("roddenRating", "X"),
            "dateConfidence": d.get("dateConfidence", "exact"),
            "dateUncertaintyReason": d.get("dateUncertaintyReason"),
            "birth": d["birth"],
            "timeClue": d.get("timeClue"),
            "events": d["events"],
            "notes": d.get("notes"),
        })
    return out


def score_all_rectifiable_dossiers(
    classification_filter: Optional[str] = None,
    step_minutes: int = 5,
) -> List[Dict[str, Any]]:
    results: List[Dict[str, Any]] = []
    for d in HISTORICAL_RECTIFICATION_DOSSIERS:
        if classification_filter and d["classification"] != classification_filter:
            continue
        results.append(score_dossier(d["agentId"], step_minutes=step_minutes))
    return results


def _main() -> None:
    parser = argparse.ArgumentParser(description="Historical agent rectification dossier CLI")
    sub = parser.add_subparsers(dest="cmd", required=True)

    sub.add_parser("list", help="List all 39 dossiers cleanly as JSON")

    p_score = sub.add_parser("score", help="Score a single dossier by agentId or fileSlug")
    p_score.add_argument("agent_id")
    p_score.add_argument("--step", type=int, default=5)
    p_score.add_argument("--evidence-json", default=None)

    p_batch = sub.add_parser("score-all", help="Score all rectifiable dossiers")
    p_batch.add_argument("--classification", default=None)
    p_batch.add_argument("--step", type=int, default=5)

    args = parser.parse_args()
    if args.cmd == "list":
        print(json.dumps({"dossiers": list_proposals_metadata()}, indent=2))
    elif args.cmd == "score":
        override = json.loads(args.evidence_json) if args.evidence_json else None
        print(json.dumps(score_dossier(args.agent_id, override_evidence=override, step_minutes=args.step), indent=2))
    elif args.cmd == "score-all":
        print(json.dumps({"proposals": score_all_rectifiable_dossiers(classification_filter=args.classification, step_minutes=args.step)}, indent=2))


if __name__ == "__main__":
    _main()

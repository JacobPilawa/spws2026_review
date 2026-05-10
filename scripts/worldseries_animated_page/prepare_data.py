#!/usr/bin/env python3
"""Prepare World Series scrollytelling data for the static animated page."""

from __future__ import annotations

import json
import warnings
from pathlib import Path

import pandas as pd

STATIC_ROOT = Path(__file__).resolve().parent
OUT_DIR = Path(__file__).resolve().parent
LEADERBOARD = STATIC_ROOT / "../data/worldseries/leaderboard_latest.csv"
COMPETITORS = STATIC_ROOT / "../data/worldseries/worldseries_competitors_with_leaderboard.csv"

ROUND_META = {
    1: {"label": "Gradient", "color": "#ff5f57", "limitSeconds": 75 * 60, "pieces": 500},
    2: {"label": "Repetition", "color": "#3587ff", "limitSeconds": 75 * 60, "pieces": 500},
    3: {"label": "Detailed", "color": "#22b66e", "limitSeconds": 75 * 60, "pieces": 500},
    4: {"label": "Mystery", "color": "#f3b82f", "limitSeconds": 75 * 60, "pieces": 500},
    5: {"label": "Circle", "color": "#a76bf5", "limitSeconds": 75 * 60, "pieces": 500},
    6: {"label": "Panorama", "color": "#ff7ba8", "limitSeconds": 90 * 60, "pieces": 636},
}

COUNTRY_FIXES = {
    "USA": "United States",
    "switzerland": "Switzerland",
    "South africa": "South Africa",
}

# Approximate country centroids used for a stylized travel map.
COUNTRY_COORDS = {
    "Argentina": [-63.6, -38.4],
    "Australia": [133.8, -25.3],
    "Austria": [14.6, 47.5],
    "Belgium": [4.5, 50.5],
    "Brazil": [-51.9, -14.2],
    "Canada": [-106.3, 56.1],
    "Croatia": [15.2, 45.1],
    "Cyprus": [33.4, 35.1],
    "Czech Republic": [15.5, 49.8],
    "Denmark": [9.5, 56.3],
    "Estonia": [25.0, 58.6],
    "Finland": [25.7, 61.9],
    "France": [2.2, 46.2],
    "Germany": [10.5, 51.2],
    "Greece": [21.8, 39.1],
    "Hungary": [19.5, 47.2],
    "Iceland": [-19.0, 64.9],
    "India": [78.9, 20.6],
    "Indonesia": [113.9, -0.8],
    "Independent Neutral": [37.6, 55.8],
    "Ireland": [-8.2, 53.4],
    "Italy": [12.6, 42.5],
    "Latvia": [24.6, 56.9],
    "Lithuania": [23.9, 55.2],
    "Luxembourg": [6.1, 49.8],
    "Netherlands": [5.3, 52.1],
    "New Zealand": [174.9, -40.9],
    "Norway": [8.5, 60.5],
    "Poland": [19.1, 52.1],
    "Portugal": [-8.2, 39.4],
    "Romania": [24.9, 45.9],
    "Slovakia": [19.7, 48.7],
    "Slovenia": [14.9, 46.2],
    "South Africa": [22.9, -30.6],
    "Spain": [-3.7, 40.4],
    "Sweden": [18.6, 60.1],
    "Switzerland": [8.2, 46.8],
    "United Kingdom": [-3.4, 55.4],
    "United States": [-95.7, 37.1],
}

MUNICH = {"name": "Munich", "country": "Germany", "lon": 11.582, "lat": 48.135}

FLAG_CODES = {
    "Argentina": "ar",
    "Australia": "au",
    "Austria": "at",
    "Belgium": "be",
    "Brazil": "br",
    "Canada": "ca",
    "Croatia": "hr",
    "Cyprus": "cy",
    "Czech Republic": "cz",
    "Denmark": "dk",
    "Estonia": "ee",
    "Finland": "fi",
    "France": "fr",
    "Germany": "de",
    "Greece": "gr",
    "Hungary": "hu",
    "Iceland": "is",
    "India": "in",
    "Indonesia": "id",
    "Independent Neutral": "un",
    "Ireland": "ie",
    "Italy": "it",
    "Latvia": "lv",
    "Lithuania": "lt",
    "Luxembourg": "lu",
    "Netherlands": "nl",
    "New Zealand": "nz",
    "Norway": "no",
    "Poland": "pl",
    "Portugal": "pt",
    "Romania": "ro",
    "Slovakia": "sk",
    "Slovenia": "si",
    "South Africa": "za",
    "Spain": "es",
    "Sweden": "se",
    "Switzerland": "ch",
    "United Kingdom": "gb",
    "United States": "us",
}

COUNTRY_NAME_FIXES_FOR_MAP = {
    "United States of America": "United States",
    "Czechia": "Czech Republic",
}


def clean_country(value: object) -> str:
    raw = " ".join(str(value).strip().split())
    return COUNTRY_FIXES.get(raw, raw)


def seconds_to_time(seconds: float) -> str:
    seconds = int(round(seconds))
    h = seconds // 3600
    m = (seconds % 3600) // 60
    s = seconds % 60
    return f"{h}:{m:02d}:{s:02d}"


def simple_records(df: pd.DataFrame, cols: list[str]) -> list[dict]:
    return json.loads(df[cols].to_json(orient="records"))


def histogram(values: pd.Series, bins: int = 18) -> list[dict]:
    vals = pd.to_numeric(values, errors="coerce").dropna()
    if vals.empty:
        return []
    lo = int(vals.min() // 60 * 60)
    hi = int((vals.max() // 60 + 1) * 60)
    width = max(60, int((hi - lo) / bins))
    edges = list(range(lo, hi + width, width))
    cut = pd.cut(vals, edges, include_lowest=True, right=False)
    counts = cut.value_counts().sort_index()
    return [
        {"start": int(interval.left), "end": int(interval.right), "count": int(count)}
        for interval, count in counts.items()
    ]


def percentile_summary(values: pd.Series) -> dict:
    vals = pd.to_numeric(values, errors="coerce").dropna()
    qs = vals.quantile([0.10, 0.25, 0.50, 0.75, 0.90])
    return {
        "p10": int(qs.loc[0.10]),
        "p25": int(qs.loc[0.25]),
        "p50": int(qs.loc[0.50]),
        "p75": int(qs.loc[0.75]),
        "p90": int(qs.loc[0.90]),
    }



def make_world_paths(width: int = 900, height: int = 560) -> list[dict]:
    """Return simplified Natural Earth country paths projected into the page SVG viewBox."""
    try:
        import shapefile
        import geopandas as gpd
        from geopandas import datasets
    except Exception:
        return []

    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", category=FutureWarning)
            shp_path = datasets.get_path("naturalearth_lowres")
        reader = shapefile.Reader(shp_path, encoding="latin1")
    except Exception:
        return []

    fields = [f[0] for f in reader.fields[1:]]
    name_idx = fields.index("name") if "name" in fields else 2

    def pt(lon: float, lat: float) -> tuple[float, float]:
        return ((lon + 180.0) / 360.0 * width, (86.0 - lat) / 172.0 * height)

    def part_path(points: list[tuple[float, float]]) -> str:
        if len(points) < 3:
            return ""
        sampled = points
        if len(sampled) > 64:
            step = max(1, len(sampled) // 64)
            sampled = sampled[::step]
        pieces = []
        for idx, (lon, lat) in enumerate(sampled):
            x, y = pt(float(lon), float(lat))
            pieces.append(("M" if idx == 0 else "L") + f" {x:.1f} {y:.1f}")
        return " ".join(pieces) + " Z"

    paths: list[dict] = []
    for sr in reader.iterShapeRecords():
        raw_name = str(sr.record[name_idx])
        name = COUNTRY_NAME_FIXES_FOR_MAP.get(raw_name, raw_name)
        shape = sr.shape
        points = shape.points
        part_starts = list(shape.parts) + [len(points)]
        pieces = []
        for a, b in zip(part_starts, part_starts[1:]):
            piece = part_path(points[a:b])
            if piece:
                pieces.append(piece)
        if pieces:
            paths.append({"name": name, "path": " ".join(pieces)})
    return paths

def main() -> None:
    df = pd.read_csv(LEADERBOARD)
    comp = pd.read_csv(COMPETITORS) if COMPETITORS.exists() else pd.DataFrame()

    df["country"] = df["country"].map(clean_country)
    df["name"] = df["name"].astype(str).str.strip()
    for col in ["rank", "total_time_seconds"] + [f"puzzle{i}_seconds" for i in range(1, 7)]:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    df = df.dropna(subset=["rank", "total_time_seconds"]).copy()
    df["rank"] = df["rank"].astype(int)
    df["total_time_seconds"] = df["total_time_seconds"].astype(int)

    if not comp.empty and "table number" in comp.columns:
        table_lookup = comp[["leaderboard_name", "table number"]].copy()
        table_lookup = table_lookup.rename(columns={"leaderboard_name": "name", "table number": "table_number"})
        table_lookup["name"] = table_lookup["name"].astype(str).str.strip()
        table_lookup["table_number"] = pd.to_numeric(table_lookup["table_number"], errors="coerce")
        df = df.merge(table_lookup, on="name", how="left")
    else:
        df["table_number"] = pd.NA

    table_overperformance = []
    if not comp.empty and "table number" in comp.columns:
        comp = comp.rename(columns={"leaderboard_name": "name", "leaderboard_country": "country"}).copy()
        comp["country"] = comp["country"].map(clean_country)
        comp["table_number"] = pd.to_numeric(comp["table number"], errors="coerce")
        comp["rank"] = pd.to_numeric(comp["rank"], errors="coerce")
        comp["table_delta"] = comp["table_number"] - comp["rank"]
        over = comp.dropna(subset=["table_delta"]).sort_values("table_delta", ascending=False).head(50).copy()
        table_overperformance = simple_records(over, ["name", "country", "rank", "table_number", "table_delta"])

    rounds = []
    cumulative_cols: list[str] = []
    work = df.copy()

    for r in range(1, 7):
        sec_col = f"puzzle{r}_seconds"
        time_col = f"puzzle{r}_time"
        round_df = df.dropna(subset=[sec_col]).copy()
        round_df[f"round{r}_rank"] = round_df[sec_col].rank(method="min", ascending=True).astype(int)
        round_df["display_time"] = round_df[sec_col].map(seconds_to_time)
        round_df["ppm"] = ROUND_META[r]["pieces"] / (round_df[sec_col] / 60.0)
        round_df = round_df.sort_values([sec_col, "rank"]).reset_index(drop=True)

        cumulative_cols.append(sec_col)
        work[f"cum_{r}"] = work[cumulative_cols].sum(axis=1, min_count=len(cumulative_cols))
        work[f"rank_after_{r}"] = work[f"cum_{r}"].rank(method="min", ascending=True)
        standings = work.dropna(subset=[f"rank_after_{r}"]).copy()
        standings[f"rank_after_{r}"] = standings[f"rank_after_{r}"].astype(int)
        if r > 1:
            standings["previous_rank"] = standings[f"rank_after_{r-1}"].astype(int)
            standings["rank_delta"] = standings["previous_rank"] - standings[f"rank_after_{r}"]
        else:
            standings["previous_rank"] = None
            standings["rank_delta"] = 0
        standings["cum_time"] = standings[f"cum_{r}"].map(seconds_to_time)
        standings = standings.sort_values([f"rank_after_{r}", f"cum_{r}"]).reset_index(drop=True)

        winner = round_df.iloc[0]
        rounds.append(
            {
                "round": r,
                "label": ROUND_META[r]["label"],
                "color": ROUND_META[r]["color"],
                "pieces": ROUND_META[r]["pieces"],
                "limitSeconds": ROUND_META[r]["limitSeconds"],
                "image": f"images/round{r}.png",
                "winner": {
                    "name": winner["name"],
                    "country": winner["country"],
                    "time": winner["display_time"],
                    "seconds": int(winner[sec_col]),
                },
                "results": simple_records(
                    round_df,
                    ["name", "country", "table_number", sec_col, "display_time", f"round{r}_rank", "rank"],
                ),
                "allFinishers": simple_records(
                    round_df,
                    ["name", "country", "table_number", sec_col, "display_time", f"round{r}_rank", "rank"],
                ),
                "standings": simple_records(
                    standings,
                    ["name", "country", "table_number", f"rank_after_{r}", "previous_rank", "rank_delta", "cum_time"] + [f"puzzle{i}_seconds" for i in range(1, r + 1)],
                ),
                "histogram": histogram(round_df[sec_col]),
                "percentiles": percentile_summary(round_df[sec_col]),
                "medianSeconds": int(round_df[sec_col].median()),
                "meanSeconds": int(round_df[sec_col].mean()),
                "bestPpm": round(float(round_df["ppm"].max()), 2),
            }
        )

    # Trajectories for final top 20 and biggest movers from round 1 to final.
    traj_cols = ["name", "country", "rank"] + [f"rank_after_{r}" for r in range(1, 7)]
    trajectories = work.dropna(subset=[f"rank_after_{r}" for r in range(1, 7)]).copy()
    for r in range(1, 7):
        trajectories[f"rank_after_{r}"] = trajectories[f"rank_after_{r}"].astype(int)
    trajectories["round1_to_final"] = trajectories["rank_after_1"] - trajectories["rank_after_6"]

    top_trajectories = trajectories.sort_values("rank").head(20)
    improvers = trajectories.sort_values("round1_to_final", ascending=False).head(50)

    final_top = df.sort_values("rank").copy()
    final_top["display_total"] = final_top["total_time_seconds"].map(seconds_to_time)

    countries = df["country"].value_counts().rename_axis("country").reset_index(name="count")
    travel = []
    for _, row in countries.iterrows():
        country = row["country"]
        lon, lat = COUNTRY_COORDS.get(country, [11.582, 48.135])
        travel.append({"country": country, "count": int(row["count"]), "lon": lon, "lat": lat, "flag": f"flags/{FLAG_CODES.get(country, 'un')}.png"})

    payload = {
        "meta": {
            "title": "Speed Puzzle World Series 2026",
            "subtitle": "334 finishers, 39 normalized countries, 6 challenges, Munich",
            "source": "data/worldseries/leaderboard_latest.csv",
            "competitors": int(len(df)),
            "countries": int(df["country"].nunique()),
            "rounds": 6,
            "munich": MUNICH,
        },
        "travel": travel,
        "worldPaths": make_world_paths(),
        "rounds": rounds,
        "finalTop": simple_records(final_top, ["rank", "name", "country", "display_total", "total_time_seconds"]),
        "topTrajectories": simple_records(top_trajectories, traj_cols),
        "improvers": simple_records(improvers, ["name", "country", "rank", "rank_after_1", "rank_after_6", "round1_to_final"]),
        "tableOverperformance": table_overperformance,
    }

    js = "window.WORLD_SERIES_DATA = " + json.dumps(payload, ensure_ascii=False, indent=2) + ";\n"
    (OUT_DIR / "story_data.js").write_text(js, encoding="utf-8")
    print(f"Wrote {OUT_DIR / 'story_data.js'}")
    print(f"Countries: {payload['meta']['countries']} | competitors: {payload['meta']['competitors']}")


if __name__ == "__main__":
    main()

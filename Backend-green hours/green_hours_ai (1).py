"""
Green Hours - AI Module
========================
Hackathon: Dell Deckathon - "Green Hours" (Renewable Surplus Matching)
Location: Benban Solar Park, Egypt (lat 24.456, lon 32.739)

This module does the 4 things the AI person owns:
  1. Forecast next-day hourly solar production
  2. Generate synthetic factory demand data (flexible load)
  3. Run the "green hours" matching logic -> recommendation + savings + CO2
  4. Output one clean JSON object for the Backend person

Run directly:  python "green_hours_ai (1).py"
It will train on DECKATHLON_modified.csv and print a sample JSON
for the day right after the last date in the dataset.
"""

import json
from pathlib import Path
import numpy as np
import pandas as pd
from xgboost import XGBRegressor

# 0. CONFIG / ASSUMPTIONS (tune these for your demo -- they are placeholders,
#    not verified figures. Say "assumed" out loud when you present them.)

DATA_PATH = Path(__file__).resolve().parent / "DECKATHLON_modified.csv"

# Day starts/ends -> hours outside this window are night (production = 0)
DAYLIGHT_HOURS = range(5, 19)   # 05:00 -> 18:00 inclusive, matches the dataset

# --- Synthetic factory (cement plant) ---
FACTORY_BASELINE_MW = 50         
FLEXIBLE_LOAD_MW = 15             
FLEXIBLE_DURATION_HOURS = 4      
CURRENT_FIXED_SCHEDULE = (18, 22) 

# --- Economics / emissions assumptions ---
GRID_PEAK_TARIFF_EGP_PER_MWH = 1900     
GREEN_HOUR_TARIFF_EGP_PER_MWH = 900      
GRID_EMISSION_FACTOR_TON_CO2_PER_MWH = 0.45  


# 1. LOAD DATA

def load_data(path=DATA_PATH):
    df = pd.read_csv(path)
    df["datetime"] = pd.to_datetime(df["datetime"])
    return df
# 2. FORECASTING MODEL
# 3 years of history

def build_features(df):
    out = pd.DataFrame(index=df.index)
    out["hour_sin"] = np.sin(2 * np.pi * df["HR"] / 24)
    out["hour_cos"] = np.cos(2 * np.pi * df["HR"] / 24)
    doy = df["datetime"].dt.dayofyear
    out["doy_sin"] = np.sin(2 * np.pi * doy / 365)
    out["doy_cos"] = np.cos(2 * np.pi * doy / 365)
    out["year"] = df["YEAR"]
    return out


def train_forecast_model(df):
    X = build_features(df)
    y = df["solar_production"]
    model = XGBRegressor(
        n_estimators=300,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
    )
    model.fit(X, y)
    return model


def forecast_next_day(model, target_date):
    """Return a 24-row DataFrame: hour 0-23 -> predicted_mw for target_date."""
    target_date = pd.Timestamp(target_date)
    rows = []
    for hour in range(24):
        if hour in DAYLIGHT_HOURS:
            feat = pd.DataFrame([{
                "hour_sin": np.sin(2 * np.pi * hour / 24),
                "hour_cos": np.cos(2 * np.pi * hour / 24),
                "doy_sin": np.sin(2 * np.pi * target_date.dayofyear / 365),
                "doy_cos": np.cos(2 * np.pi * target_date.dayofyear / 365),
                "year": target_date.year,
            }])
            pred = float(model.predict(feat)[0])
            pred = max(0.0, pred)  # no negative MW
        else:
            pred = 0.0  # night -> no solar, no need to "predict" it
        rows.append({"hour": hour, "predicted_mw": round(pred, 1)})
    return pd.DataFrame(rows)


# 3. SYNTHETIC FACTORY DATA

def synthetic_factory():
    return {
        "name": "Virtual Cement Plant (synthetic demo data)",
        "baseline_load_mw": FACTORY_BASELINE_MW,
        "flexible_process": "Grinding / Milling line",
        "flexible_load_mw": FLEXIBLE_LOAD_MW,
        "flexible_duration_hours": FLEXIBLE_DURATION_HOURS,
        "current_fixed_schedule": f"{CURRENT_FIXED_SCHEDULE[0]:02d}:00-{CURRENT_FIXED_SCHEDULE[1]:02d}:00",
    }


# 4. MATCHING LOGIC -> green hours + recommendation + savings + CO2

def find_best_window(forecast_df, duration):
    """Slide a `duration`-hour window across the 24h forecast and return the
    window with the highest total predicted production (the 'green hours')."""
    mw = forecast_df["predicted_mw"].values
    best_start, best_sum = 0, -1
    for start in range(0, 24 - duration + 1):
        window_sum = mw[start:start + duration].sum()
        if window_sum > best_sum:
            best_sum, best_start = window_sum, start
    return best_start, best_start + duration  # [start, end)


def compute_savings(flexible_mw, duration):
    energy_mwh = flexible_mw * duration
    cost_before = energy_mwh * GRID_PEAK_TARIFF_EGP_PER_MWH
    cost_after = energy_mwh * GREEN_HOUR_TARIFF_EGP_PER_MWH
    savings_percent = round((cost_before - cost_after) / cost_before * 100, 1)
    co2_saved_tons = round(energy_mwh * GRID_EMISSION_FACTOR_TON_CO2_PER_MWH, 2)
    return savings_percent, co2_saved_tons, round(cost_before), round(cost_after)


def build_recommendation(forecast_df, factory):
    start, end = find_best_window(forecast_df, factory["flexible_duration_hours"])
    green_hours = [f"{h:02d}:00" for h in range(start, end)]

    savings_percent, co2_saved_tons, cost_before, cost_after = compute_savings(
        factory["flexible_load_mw"], factory["flexible_duration_hours"]
    )

    recommendation = (
        f"Run the {factory['flexible_process']} from {start:02d}:00 to {end:02d}:00 "
        f"instead of the current {factory['current_fixed_schedule']} schedule "
        f"to use surplus solar power, save {savings_percent}% on electricity cost, "
        f"and avoid {co2_saved_tons} tons of CO2."
    )

    return {
        "green_hours": green_hours,
        "recommendation": recommendation,
        "savings_percent": savings_percent,
        "co2_saved_tons": co2_saved_tons,
        "cost_before_egp": cost_before,
        "cost_after_egp": cost_after,
    }


# 5. FULL PIPELINE -> ONE JSON OBJECT FOR BACKEND

def run_pipeline(target_date, data_path=DATA_PATH):
    df = load_data(data_path)
    model = train_forecast_model(df)
    forecast_df = forecast_next_day(model, target_date)
    factory = synthetic_factory()
    match = build_recommendation(forecast_df, factory)

    output = {
        "date": str(pd.Timestamp(target_date).date()),
        "location": "Benban Solar Park, Egypt",
        "forecast": [
            {"hour": f"{int(r.hour):02d}:00", "predicted_mw": r.predicted_mw}
            for r in forecast_df.itertuples()
        ],
        "green_hours": match["green_hours"],
        "recommendation": match["recommendation"],
        "savings_percent": match["savings_percent"],
        "co2_saved_tons": match["co2_saved_tons"],
        "factory_info": factory,
        "cost_breakdown_egp": {
            "before": match["cost_before_egp"],
            "after": match["cost_after_egp"],
        },
        "assumptions_disclaimer": (
            "Tariff and emission-factor numbers are placeholder assumptions for the demo; "
            "replace with real EEHC/EgyptERA figures if you find them before presenting."
        ),
    }
    return output


if __name__ == "__main__":
    df = load_data(DATA_PATH)
    last_date = df["datetime"].max().normalize()
    target = last_date + pd.Timedelta(days=1)

    result = run_pipeline(target, DATA_PATH)
    print(json.dumps(result, indent=2, ensure_ascii=False))

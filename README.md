# Green Hours

Green Hours is an AI-assisted industrial energy optimization prototype. It forecasts renewable generation near Benban Solar Park in Egypt, identifies high-surplus hours, and recommends when a flexible factory process can run to reduce grid-energy costs and associated emissions.

The project demonstrates how energy forecasting can inform industrial scheduling. Forecasts, tariffs, emissions factors, and plant loads are demo inputs; savings shown in the dashboard are illustrative, not validated operational or financial results.

## Project Overview

Industrial processes such as cement grinding can often shift some electricity demand without changing total production. Green Hours combines a next-day solar forecast with a configurable flexible-load duration, then selects the consecutive hours with the greatest predicted generation. The recommendation estimates potential cost and CO2 savings using the assumptions configured in the Python model.

## Architecture and Stack

```text
Python model + CSV history
        | optional JSON forecast output
        v
Express API <---- bundled demo data fallback
        |
        v
Static HTML/CSS/JavaScript dashboard
```

- **Frontend:** semantic HTML, responsive CSS, and vanilla JavaScript with a self-contained canvas forecast chart.
- **Backend:** Node.js and Express provide health, forecast, recommendation, plant-profile, and data-source endpoints.
- **Forecasting and optimization:** Python, pandas, NumPy, and XGBoost train the solar forecast and select the highest-output continuous operating window.
- **Demo resilience:** the backend generates mock data when AI output is missing, and the browser uses local deterministic demo values when the API is unreachable.

## Dashboard

The dashboard surfaces peak renewable supply, estimated savings, an hourly forecast with 1-hour, 6-hour, 24-hour, and 7-day views, an optimized shift recommendation, and projected CO2 avoidance. The shift action and theme control are interactive. If the backend is offline, the dashboard remains usable and labels the data as demo data.

## Local Setup

### Requirements

- Node.js 18 or newer and npm
- Python 3.10 or newer only if you want to run the forecasting script

### 1. Start the API

```powershell
cd "Backend-green hours"
npm ci
npm start
```

The API listens on `http://localhost:3000`. For automatic restarts during development, run `npm run dev` instead. Confirm it is ready at `http://localhost:3000/api/health`.

### 2. Start the dashboard

In another terminal, serve the static frontend directory:

```powershell
cd "GREEN HOURS/GREEN HOURS"
python -m http.server 8080
```

Open `http://localhost:8080`. The dashboard requests the API at `http://localhost:3000`. To use a hosted API, set `window.GREEN_HOURS_API_BASE_URL` in a small configuration script before `front.js`, and configure the API's CORS policy for the dashboard's origin.

### 3. Optional: run the Python forecast

In a separate terminal, from the backend directory:

```powershell
cd "Backend-green hours"
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python "green_hours_ai (1).py"
```

The script reads `DECKATHLON_modified.csv` and prints a JSON result. Save that output as `DECKATHLON_modified.json` in `Backend-green hours/` to have the API read the generated forecast. The checked-in JSON is example output. If it is absent or invalid, the API falls back to generated mock data.

## API Reference

- `GET /api/health` - server health
- `GET /api/data-source` - indicates whether AI JSON data is loaded
- `GET /api/forecast` - 24-hour renewable forecast
- `GET /api/recommendation` - green-hour window and estimated savings
- `GET /api/plant-info` - flexible-load plant profile

## Repository Layout

```text
Backend-green hours/
  app.js                       Express API
  aiAdapter.js                 Optional AI JSON loader
  mockData.js                  Backend demo-data generator
  green_hours_ai (1).py        Forecasting and scheduling pipeline
  DECKATHLON_modified.csv      Historical input data
  DECKATHLON_modified.json     Example model output
  package.json                 Node dependencies and scripts
  requirements.txt             Python model dependencies
GREEN HOURS/GREEN HOURS/
  index.html                   Dashboard structure
  styles.css                   Responsive dashboard styling
  front.js                     Dashboard behavior and API integration
```

## Assumptions and Production Notes

The included plant profile is synthetic, and the Python model's tariff and emissions factors are explicitly placeholders. Validate these values with the relevant plant and energy-market data before operational use. The demo API allows cross-origin requests during local development; in production, set `CORS_ORIGIN` to the dashboard origin (or a comma-separated allowlist) and use HTTPS. The static dashboard can be hosted separately from the API by setting its API base URL and matching the backend CORS configuration.
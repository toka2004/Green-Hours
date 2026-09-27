import express from 'express';
import cors from 'cors';
import { generateForecast, generateRecommendation, getPlantInfo } from './mockData.js';
import { getAIData } from './aiAdapter.js';

const app = express();
const PORT = process.env.PORT || 3000;
const allowedOrigins = process.env.CORS_ORIGIN
  ?.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const corsOptions = allowedOrigins?.length
  ? { origin: allowedOrigins }
  : process.env.NODE_ENV === 'production'
    ? { origin: false }
    : undefined;

app.use(cors(corsOptions));
app.use(express.json());

//  middleware 
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});


app.get('/api/health', (req, res) => {
  res.status(200).json({ status: "ok" });
});


app.get('/api/data-source', (req, res) => {
  const aiData = getAIData();
  res.status(200).json({
    using_real_ai_data: aiData !== null
  });
});

// for forcast 
app.get('/api/forecast', (req, res, next) => {
  try {
    const aiData = getAIData();
    if (aiData && aiData.forecast) {
      res.status(200).json({
        location: aiData.location || "Benban Solar Park",
        forecast: aiData.forecast
      });
    } else {
      const forecastData = generateForecast();
      res.status(200).json(forecastData);
    }
  } catch (error) {
    next(error);
  }
});


app.get('/api/recommendation', (req, res, next) => {
  try {
    const aiData = getAIData();
    if (aiData) {
      res.status(200).json({
        green_hours: aiData.green_hours || [],
        recommendation_text: aiData.recommendation || '', 
        savings_percent: aiData.savings_percent || 0,
        co2_saved_tons: aiData.co2_saved_tons || 0
      });
    } else {
      const plantInfo = getPlantInfo();
      const forecastObj = generateForecast();
      const recommendation = generateRecommendation(forecastObj.forecast, plantInfo);
      res.status(200).json(recommendation);
    }
  } catch (error) {
    next(error);
  }
});


app.get('/api/plant-info', (req, res, next) => {
  try {
    const aiData = getAIData();
    if (aiData && aiData.factory_info) {
      res.status(200).json({
        plant_name: aiData.factory_info.name,
        baseline_consumption_mw: aiData.factory_info.baseline_load_mw,
        flexible_operation: aiData.factory_info.flexible_process,
        flexible_operation_consumption_mw: aiData.factory_info.flexible_load_mw,
        flexible_hours_needed: aiData.factory_info.flexible_duration_hours
      });
    } else {
      //  plant info
      const plantInfo = getPlantInfo();
      res.status(200).json(plantInfo);
    }
  } catch (error) {
    next(error);
  }
});

app.use((req, res, next) => {
  res.status(404).json({ error: "not found" });
});

app.use((err, req, res, next) => {
  console.error("Express Error Handler caught an error:", err);
  res.status(500).json({
    error: "Internal Server Error",
    message: process.env.NODE_ENV === 'production'
      ? "An unexpected error occurred on the server."
      : err.message || "An unexpected error occurred on the server."
  });
});

app.listen(PORT, () => {
  console.log(`Green Hours API listening on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});




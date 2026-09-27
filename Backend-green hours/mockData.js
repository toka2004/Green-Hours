/**
 * @returns {Object} 
 */
export function generateForecast() {
  const forecast = [];
  
  // Peak parameters
  const peakHour = 12.5; // Peak solar output around 12:30 PM
  const peakValue = 1600; // Peak capacity 
  const stdDev = 2.5; // Standard deviation defining the solar peak width
  
  for (let h = 0; h < 24; h++) {
    const hourStr = String(h).padStart(2, '0') + ':00';
    
    // Generate a Gaussian bell-curve for solar output
    let mw = peakValue * Math.exp(-Math.pow(h - peakHour, 2) / (2 * Math.pow(stdDev, 2)));
    
    // Add small random noise (-30 to +30 MW) to make the data look realistic
    const noise = (Math.random() - 0.5) * 60;
    mw = mw + noise;
    
    // Near-zero output during night hours (before 6 AM and after 6 PM)
    if (h < 6 || h > 18) {
      // Simulate minor baseline wind generation + noise at night
      mw = Math.max(0, Math.round(Math.random() * 12));
    } else {
      mw = Math.max(0, Math.round(mw));
    }
    
    forecast.push({
      hour: hourStr,
      predicted_mw: mw
    });
  }
  
  return {
    location: "Benban Solar Park",
    forecast
  };
}

/**
 * @param {Array} forecastData - The 24-hour forecast array.
 * @param {Object} plantInfo - The plant specifications.
 * @returns {Object} Recommendation details, including target green hours, text, and savings.
 */
export function generateRecommendation(forecastData, plantInfo) {
  const sortedForecast = [...forecastData].sort((a, b) => b.predicted_mw - a.predicted_mw);
  
  const hoursNeeded = plantInfo.flexible_hours_needed || 4;
  const topHours = sortedForecast.slice(0, hoursNeeded);
  
  const greenHours = topHours
    .map(item => item.hour)
    .sort((a, b) => parseInt(a) - parseInt(b));
  
  const startHour = greenHours[0];
  const endHour = greenHours[greenHours.length - 1];
  
  const savingsPercent = Math.round(18 + Math.random() * 8);
  const co2SavedTons = parseFloat((3.0 + Math.random() * 1.5).toFixed(1));
  
  return {
    green_hours: greenHours,
    recommendation: `Run the ${plantInfo.flexible_operation.toLowerCase()} from ${startHour} to ${endHour} to take advantage of renewable energy surplus.`,
    savings_percent: savingsPercent,
    co2_saved_tons: co2SavedTons
  };
}

/**
 * @returns {Object} Factory profile and energy consumption configuration.
 */
export function getPlantInfo() {
  return {
    plant_name: "Egyptian Cement Co. (Example)",
    baseline_consumption_mw: 50,
    flexible_operation: "Grinding Line",
    flexible_operation_consumption_mw: 15,
    flexible_hours_needed: 4
  };
}

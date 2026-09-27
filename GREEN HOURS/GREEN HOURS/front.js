"use strict";

const API_BASE_URL = (window.GREEN_HOURS_API_BASE_URL || "http://localhost:3000").replace(/\/$/, "");

function createFallbackData() {
  const forecast = Array.from({ length: 24 }, (_, hour) => ({
    hour: `${String(hour).padStart(2, "0")}:00`,
    predicted_mw: Math.max(0, Math.round(1600 * Math.exp(-((hour - 12.5) ** 2) / (2 * 2.5 ** 2)))),
  }));

  return {
    forecast: { location: "Benban Solar Park", forecast },
    recommendation: {
      green_hours: ["11:00", "12:00", "13:00", "14:00"],
      savings_percent: 22.4,
      co2_saved_tons: 27,
    },
    plantInfo: {
      plant_name: "Example cement plant",
      baseline_consumption_mw: 50,
      flexible_operation: "Grinding Line",
      flexible_operation_consumption_mw: 15,
      flexible_hours_needed: 4,
    },
  };
}

const dashboard = {
  forecastChart: null,
  lastForecastData: null,
  lastGreenHours: [],
  async init() {
    this.setupNavigation();
    this.setupPeriods();
    this.setupShiftButtons();
    this.setupTheme();
    window.addEventListener("resize", () => {
      if (this.fallbackChart) this.drawFallbackChart(this.fallbackChart);
    });
    await this.fetchAndRenderData();
  },

  setupNavigation() {
    const buttons = document.querySelectorAll(".sidebar nav button");

    buttons.forEach((button) => {
      button.addEventListener("click", () => {
        buttons.forEach((item) => item.classList.remove("active"));
        buttons.forEach((item) => item.removeAttribute("aria-current"));
        button.classList.add("active");
        button.setAttribute("aria-current", "page");
        this.showToast(`${button.textContent.trim()} selected`);
      });
    });
  },

  setupPeriods() {
    const buttons = document.querySelectorAll(".periods button");

    buttons.forEach((button) => {
      button.addEventListener("click", () => {
        buttons.forEach((item) => item.classList.remove("selected"));
        buttons.forEach((item) => item.setAttribute("aria-pressed", "false"));
        button.classList.add("selected");
        button.setAttribute("aria-pressed", "true");
        const period = button.textContent.trim();
        this.showToast(`Forecast range: ${period}`);
        if (this.lastForecastData) {
          this.renderChart(period);
        }
      });
    });
  },

  setupShiftButtons() {
    document.querySelectorAll(".shift-bottom button").forEach((button) => {
      if (button.dataset.listenerAdded) return;
      button.dataset.listenerAdded = "true";

      button.addEventListener("click", () => {
        const card = button.closest(".shift");
        const unit = card.querySelector(".shift-top strong").textContent;

        button.textContent = "✓ Scheduled";
        button.classList.add("scheduled");
        button.disabled = true;
        card.classList.add("shift-scheduled");
        this.showToast(`${unit} has been scheduled`);
      });
    });
  },

  setupTheme() {
    const themeButton = document.getElementById("theme-toggle");

    if (!themeButton) return;

    themeButton.addEventListener("click", () => {
      const darkMode = document.body.classList.toggle("dark-mode");
      themeButton.textContent = darkMode ? "Light theme" : "Dark theme";
      themeButton.setAttribute("aria-pressed", String(darkMode));
      themeButton.setAttribute("aria-label", `Switch to ${darkMode ? "light" : "dark"} theme`);
      this.showToast(`${darkMode ? "Dark" : "Light"} theme enabled`);
    });
  },

  renderChart(period) {
    const chartContainer = document.querySelector(".chart");
    if (!this.lastForecastData || !chartContainer) return;

    if (this.forecastChart && typeof this.forecastChart.destroy === "function") {
      this.forecastChart.destroy();
      this.forecastChart = null;
    }
    this.fallbackChart = null;

    let labels = [];
    let values = [];
    const base = this.lastForecastData;

    if (period === "1H") {
      const slice = base.slice(-2);
      labels = slice.map((item) => item.hour);
      values = slice.map((item) => item.predicted_mw);
    } else if (period === "6H") {
      const slice = base.slice(-6);
      labels = slice.map((item) => item.hour);
      values = slice.map((item) => item.predicted_mw);
    } else if (period === "24H") {
      labels = base.map((item) => item.hour);
      values = base.map((item) => item.predicted_mw);
    } else if (period === "7D") {
      const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      const seeds = [1, 1.05, 0.93, 1.1, 0.97, 0.88, 1.03];
      dayNames.forEach((day, i) => {
        const sampledHours = [0, 4, 8, 12, 16, 20];
        sampledHours.forEach((hour) => {
          const entry = base[hour] || base[0];
          labels.push(`${day} ${entry.hour}`);
          values.push(Number((entry.predicted_mw * seeds[i]).toFixed(2)));
        });
      });
    }

    const greenHours = this.lastGreenHours;
    const isGreenHour = (hour) => {
      if (period === "7D") return false;
      return greenHours.includes(hour);
    };

    chartContainer.innerHTML = '<canvas id="forecastChart" role="img" aria-label="Renewable output forecast chart" style="width:100%;height:100%;"></canvas>';
    const canvas = document.getElementById("forecastChart");
    if (typeof window.Chart !== "function") {
      this.fallbackChart = { canvas, labels, values, greenHours, period };
      this.drawFallbackChart(this.fallbackChart);
      return;
    }

    this.forecastChart = new window.Chart(canvas.getContext("2d"), {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Predicted Output (MW)',
          data: values,
          fill: true,
          borderColor: '#2979eb',
          backgroundColor: 'rgba(41, 121, 235, 0.08)',
          borderWidth: 2.5,
          tension: period === '7D' ? 0.4 : 0.3,
          segment: {
            borderColor: (c) => {
              const h0 = labels[c.p0DataIndex];
              const h1 = labels[c.p1DataIndex];
              return (isGreenHour(h0) && isGreenHour(h1)) ? '#19b88b' : '#2979eb';
            },
            backgroundColor: (c) => {
              const h0 = labels[c.p0DataIndex];
              const h1 = labels[c.p1DataIndex];
              return (isGreenHour(h0) && isGreenHour(h1))
                ? 'rgba(25, 184, 139, 0.18)'
                : 'rgba(41, 121, 235, 0.08)';
            }
          },
          pointBackgroundColor: (c) => isGreenHour(labels[c.dataIndex]) ? '#19b88b' : '#2979eb',
          pointBorderColor: '#fff',
          pointRadius: (c) => isGreenHour(labels[c.dataIndex]) ? 6 : (period === '7D' ? 2 : 3),
          pointHoverRadius: (c) => isGreenHour(labels[c.dataIndex]) ? 8 : 5,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 500,
          easing: 'easeInOutQuart',
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.parsed.y} MW`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: '#97a4b3',
              font: { family: 'sans-serif', size: 10 },
              maxRotation: period === '7D' ? 45 : 0,
              maxTicksLimit: period === '7D' ? 14 : 24,
            }
          },
          y: {
            grid: { color: '#edf0f4' },
            ticks: {
              color: '#97a4b3',
              font: { family: 'sans-serif', size: 10 },
              callback: (v) => v + ' MW'
            }
          }
        }
      }
    });

  },

  drawFallbackChart(chart) {
    const { canvas, labels, values, greenHours, period } = chart;
    const bounds = canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;

    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(bounds.width * ratio);
    canvas.height = Math.round(bounds.height * ratio);
    const context = canvas.getContext("2d");
    context.setTransform(ratio, 0, 0, ratio, 0, 0);

    const width = bounds.width;
    const height = bounds.height;
    const inset = { left: 48, right: 12, top: 14, bottom: 30 };
    const plotWidth = Math.max(1, width - inset.left - inset.right);
    const plotHeight = Math.max(1, height - inset.top - inset.bottom);
    const maximum = Math.max(1, ...values);
    const x = (index) => inset.left + (values.length < 2 ? plotWidth / 2 : (index / (values.length - 1)) * plotWidth);
    const y = (value) => inset.top + plotHeight - (value / maximum) * plotHeight;

    context.clearRect(0, 0, width, height);
    context.font = "10px sans-serif";
    context.textBaseline = "middle";
    context.lineWidth = 1;
    context.fillStyle = "#8995a7";
    context.strokeStyle = "#edf0f4";

    for (let step = 0; step <= 4; step += 1) {
      const value = maximum * (1 - step / 4);
      const lineY = inset.top + (plotHeight * step) / 4;
      context.beginPath();
      context.moveTo(inset.left, lineY);
      context.lineTo(width - inset.right, lineY);
      context.stroke();
      context.textAlign = "right";
      context.fillText(`${Math.round(value)} MW`, inset.left - 7, lineY);
    }

    const labelStep = Math.max(1, Math.ceil(labels.length / (period === "7D" ? 10 : 6)));
    labels.forEach((label, index) => {
      if (index % labelStep !== 0 && index !== labels.length - 1) return;
      context.textAlign = index === 0 ? "left" : index === labels.length - 1 ? "right" : "center";
      context.fillText(label, x(index), height - 12);
    });

    for (let index = 1; index < values.length; index += 1) {
      const greenSegment = period !== "7D" && greenHours.includes(labels[index - 1]) && greenHours.includes(labels[index]);
      context.beginPath();
      context.moveTo(x(index - 1), y(values[index - 1]));
      context.lineTo(x(index), y(values[index]));
      context.strokeStyle = greenSegment ? "#19b88b" : "#2979eb";
      context.lineWidth = 2.5;
      context.stroke();
    }

    canvas.setAttribute("aria-label", `Renewable output forecast, ${period} view, maximum ${Math.round(maximum)} megawatts`);
  },

  showToast(message) {
    const toast = document.querySelector(".toast");
    toast.textContent = message;
    toast.classList.add("visible");

    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      toast.classList.remove("visible");
    }, 2200);
  },

  async fetchJson(path) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 4000);
    try {
      const response = await fetch(`${API_BASE_URL}${path}`, { signal: controller.signal });
      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    } finally {
      window.clearTimeout(timeout);
    }
  },

  async fetchAndRenderData() {
    const chartContainer = document.querySelector(".chart");
    chartContainer.innerHTML = '<div class="loading-state" role="status">Loading energy forecast...</div>';

    const shiftCard = document.querySelector(".shift-list .shift");
    const fallback = createFallbackData();
    const [forecastResult, recommendationResult, plantInfoResult] = await Promise.all([
      this.fetchJson("/api/forecast"),
      this.fetchJson("/api/recommendation"),
      this.fetchJson("/api/plant-info"),
    ]);
    const forecastData = Array.isArray(forecastResult?.forecast) && forecastResult.forecast.length
      ? forecastResult
      : fallback.forecast;
    const recommendationData = Array.isArray(recommendationResult?.green_hours)
      ? recommendationResult
      : fallback.recommendation;
    const plantInfoData = plantInfoResult || fallback.plantInfo;
    const usingFallback = !forecastResult || !recommendationResult || !plantInfoResult;

    const sourceStatus = document.getElementById("data-source");
    sourceStatus.textContent = usingFallback ? "Demo data · API unavailable" : "Live · Green Hours API";
    sourceStatus.classList.toggle("offline", usingFallback);
    document.getElementById("forecast-updated").textContent =
      `${forecastData.location || "Renewable source"} · Updated ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;

    this.lastForecastData = forecastData.forecast;
    this.lastGreenHours = recommendationData.green_hours;
    const maxObj = forecastData.forecast.reduce(
      (max, item) => item.predicted_mw > max.predicted_mw ? item : max,
      forecastData.forecast[0],
    );
    document.getElementById("peak-supply-val").firstChild.textContent = maxObj.predicted_mw;
    document.getElementById("peak-supply-time").textContent = `at ${maxObj.hour} solar peak`;
    document.getElementById("quick-solar-peak-val").textContent = `${maxObj.predicted_mw} MW`;
    document.getElementById("quick-solar-peak-time").textContent = `at ${maxObj.hour}`;

    const activeButton = document.querySelector(".periods button.selected");
    this.renderChart(activeButton ? activeButton.textContent.trim() : "24H");

    const savings = Number(recommendationData.savings_percent) || 0;
    const co2Saved = Number(recommendationData.co2_saved_tons) || 0;
    const greenHours = recommendationData.green_hours.length ? recommendationData.green_hours : fallback.recommendation.green_hours;
    const startHour = greenHours[0];
    const endHour = greenHours[greenHours.length - 1];
    document.getElementById("savings-val").firstChild.textContent = savings;
    document.getElementById("shift-operation-name").textContent = plantInfoData.flexible_operation || "Grinding Line";
    document.getElementById("shift-time-range").textContent = `${startHour} – ${endHour}`;
    document.getElementById("shift-savings-percent").textContent = `${savings}% saved`;
    document.getElementById("shift-progress-bar").style.width = `${Math.max(0, Math.min(100, savings))}%`;
    document.getElementById("shift-co2-saved").textContent = `${co2Saved} tons CO2 avoided`;
    document.getElementById("shift-savings-detail").textContent = `${savings}% savings`;
    document.getElementById("projected-co-tons").textContent = `${co2Saved} tons`;
    document.getElementById("projected-savings-rate").textContent = `${savings}% energy cost savings`;
    document.getElementById("quick-surplus-val").textContent = `+${plantInfoData.flexible_operation_consumption_mw || 15} MW`;
    document.getElementById("quick-surplus-time").textContent = `${startHour} – ${endHour}`;

    const loadPeak = (plantInfoData.baseline_consumption_mw || 50)
      + (plantInfoData.flexible_operation_consumption_mw || 15);
    document.getElementById("quick-load-peak-val").textContent = `${loadPeak} MW`;
    document.getElementById("quick-load-peak-time").textContent = `during ${startHour}–${endHour} shift`;
    document.getElementById("quick-grid-dependency").textContent = "0.0%";
    if (shiftCard) shiftCard.style.opacity = "1";
  }
};

document.addEventListener("DOMContentLoaded", () => dashboard.init());

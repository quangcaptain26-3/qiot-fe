/**
 * Logs page JavaScript
 * Hiển thị lịch sử dữ liệu và MQTT logs
 */

const API_BASE = window.location.origin;

// ==================== Tab Management ====================

function initTabs() {
  const tabButtons = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tabName = btn.dataset.tab;

      // Remove active class from all
      tabButtons.forEach((b) => b.classList.remove("active"));
      tabContents.forEach((c) => c.classList.remove("active"));

      // Add active class to clicked
      btn.classList.add("active");
      document.getElementById(`${tabName}Tab`).classList.add("active");

      // Load data for active tab
      loadTabData(tabName);
    });
  });
}

// ==================== API Calls ====================

async function apiCall(endpoint, options = {}) {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`❌ Lỗi API ${endpoint}:`, error);
    throw error;
  }
}

// ==================== Load Data ====================

async function loadTabData(tabName) {
  switch (tabName) {
    case "weather":
      await loadWeatherHistory();
      break;
    case "exchange":
      await loadExchangeHistory();
      break;
    case "messages":
      await loadMessagesHistory();
      break;
    case "mqtt":
      await loadMqttLogs();
      break;
  }
}

async function loadWeatherHistory() {
  const tbody = document.getElementById("weatherTableBody");
  tbody.innerHTML = '<tr><td colspan="6" class="loading">Đang tải...</td></tr>';

  try {
    const result = await apiCall("/api/weather/history?limit=100");
    const data = result.data;

    if (data.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="6" class="loading">Chưa có dữ liệu</td></tr>';
      return;
    }

    tbody.innerHTML = data
      .map(
        (item) => `
            <tr>
                <td>${new Date(item.created_at).toLocaleString("vi-VN")}</td>
                <td>${item.latitude.toFixed(4)}, ${item.longitude.toFixed(
          4
        )}</td>
                <td>${item.temperature}°C</td>
                <td>${item.humidity}%</td>
                <td>${item.pressure} hPa</td>
                <td>${item.description}</td>
            </tr>
        `
      )
      .join("");
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="6" class="loading" style="color: red;">Lỗi: ${error.message}</td></tr>`;
  }
}

async function loadExchangeHistory() {
  const tbody = document.getElementById("exchangeTableBody");
  tbody.innerHTML = '<tr><td colspan="3" class="loading">Đang tải...</td></tr>';

  try {
    const result = await apiCall("/api/exchange/history?limit=100");
    const data = result.data;

    if (data.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="3" class="loading">Chưa có dữ liệu</td></tr>';
      return;
    }

    tbody.innerHTML = data
      .map(
        (item) => `
            <tr>
                <td>${new Date(item.created_at).toLocaleString("vi-VN")}</td>
                <td>${item.base_currency}/${item.target_currency}</td>
                <td>${item.rate.toFixed(4)}</td>
            </tr>
        `
      )
      .join("");
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="3" class="loading" style="color: red;">Lỗi: ${error.message}</td></tr>`;
  }
}

async function loadMessagesHistory() {
  const tbody = document.getElementById("messagesTableBody");
  tbody.innerHTML = '<tr><td colspan="3" class="loading">Đang tải...</td></tr>';

  try {
    const result = await apiCall("/api/message/history?limit=100");
    const data = result.data;

    if (data.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="3" class="loading">Chưa có dữ liệu</td></tr>';
      return;
    }

    tbody.innerHTML = data
      .map(
        (item) => `
            <tr>
                <td>${new Date(item.created_at).toLocaleString("vi-VN")}</td>
                <td>${item.message}</td>
                <td>${item.mode || "Mặc định"}</td>
            </tr>
        `
      )
      .join("");
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="3" class="loading" style="color: red;">Lỗi: ${error.message}</td></tr>`;
  }
}

/**
 * Lấy frontend logs từ localStorage
 */
function getFrontendLogs() {
  try {
    const logsStr = localStorage.getItem("mqtt_logs");
    return logsStr ? JSON.parse(logsStr) : [];
  } catch (error) {
    console.error("❌ Lỗi đọc frontend logs:", error);
    return [];
  }
}

async function loadMqttLogs() {
  const tbody = document.getElementById("logsTableBody");
  tbody.innerHTML = '<tr><td colspan="4" class="loading">Đang tải...</td></tr>';

  try {
    const topicFilter = document.getElementById("topicFilter").value;
    
    // Lấy logs từ backend
    let backendLogs = [];
    try {
      const endpoint = topicFilter
        ? `/api/logs?limit=100&topic=${encodeURIComponent(topicFilter)}`
        : "/api/logs?limit=100";
      const result = await apiCall(endpoint);
      backendLogs = result.data.map(item => ({
        timestamp: item.created_at,
        topic: item.topic,
        message: item.message,
        direction: item.direction,
        source: "backend"
      }));
    } catch (error) {
      console.warn("⚠️  Không thể load backend logs:", error);
    }

    // Lấy logs từ frontend (localStorage)
    let frontendLogs = [];
    try {
      frontendLogs = getFrontendLogs()
        .map(item => ({
          timestamp: item.timestamp,
          topic: item.topic,
          message: item.message,
          direction: item.direction,
          source: "frontend"
        }));

      // Apply topic filter nếu có
      if (topicFilter) {
        frontendLogs = frontendLogs.filter(log => 
          log.topic.toLowerCase().includes(topicFilter.toLowerCase())
        );
      }

      // Giới hạn 100 logs từ frontend
      frontendLogs = frontendLogs.slice(0, 100);
    } catch (error) {
      console.warn("⚠️  Không thể load frontend logs:", error);
    }

    // Merge và sort theo thời gian (mới nhất trước)
    const allLogs = [...backendLogs, ...frontendLogs]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 200); // Giới hạn tổng cộng 200 logs

    if (allLogs.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="4" class="loading">Chưa có dữ liệu</td></tr>';
      return;
    }

    tbody.innerHTML = allLogs
      .map((item) => {
        const message =
          item.message.length > 50
            ? item.message.substring(0, 50) + "..."
            : item.message;
        
        const sourceBadge = item.source === "frontend" 
          ? '<span style="color: #4CAF50; font-size: 0.8em;">[FE]</span>' 
          : '<span style="color: #2196F3; font-size: 0.8em;">[BE]</span>';

        return `
                <tr>
                    <td>${new Date(item.timestamp).toLocaleString("vi-VN")} ${sourceBadge}</td>
                    <td>${item.topic}</td>
                    <td title="${item.message}">${message}</td>
                    <td>${item.direction}</td>
                </tr>
            `;
      })
      .join("");
    
    console.log(`📊 Đã load ${backendLogs.length} backend logs + ${frontendLogs.length} frontend logs`);
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="4" class="loading" style="color: red;">Lỗi: ${error.message}</td></tr>`;
  }
}

// ==================== Event Handlers ====================

function initEventHandlers() {
  // Refresh buttons
  document
    .getElementById("refreshWeatherBtn")
    .addEventListener("click", loadWeatherHistory);
  document
    .getElementById("refreshExchangeBtn")
    .addEventListener("click", loadExchangeHistory);
  document
    .getElementById("refreshMessagesBtn")
    .addEventListener("click", loadMessagesHistory);
  document
    .getElementById("refreshLogsBtn")
    .addEventListener("click", loadMqttLogs);

  // Topic filter
  document.getElementById("topicFilter").addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      loadMqttLogs();
    }
  });

  // Clear frontend logs
  document.getElementById("clearFrontendLogsBtn")?.addEventListener("click", () => {
    if (confirm("Bạn có chắc muốn xóa tất cả logs frontend (localStorage)?")) {
      localStorage.removeItem("mqtt_logs");
      alert("✅ Đã xóa logs frontend!");
      loadMqttLogs(); // Reload để cập nhật
    }
  });
}

// ==================== Initialization ====================

function init() {
  initTabs();
  initEventHandlers();

  // Load initial tab data
  const activeTab = document.querySelector(".tab-btn.active");
  if (activeTab) {
    loadTabData(activeTab.dataset.tab);
  }

  console.log("✅ Logs page đã khởi tạo");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

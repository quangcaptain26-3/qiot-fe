/**
 * Main application JavaScript
 * Kết nối MQTT, gọi API, điều khiển LED
 */

// Backend API URL
const API_BASE = "https://qiot-be.onrender.com";
// WebSocket MQTT - EMQX Broker với TLS/SSL
const MQTT_BROKER = `wss://z0d3bf33.ala.asia-southeast1.emqxsl.com:8084/mqtt`;
const MQTT_USERNAME = "qiot-fe";
const MQTT_PASSWORD = "qbe123";
const MQTT_CLIENT_ID = `qiot-fe_${Math.random().toString(16).substr(2, 8)}`;

let mqttClient = null;

// MQTT Topics
const MQTT_TOPICS = {
  weatherRaw: "home/weather/raw",
  weatherLed: "home/weather/led",
  exchangeRaw: "home/exchange/raw",
  exchangeLed: "home/exchange/led",
  customMessage: "home/custom/message",
  ledSettings: "home/led/settings",
};

// Logging system
const MQTT_LOGS_KEY = "mqtt_logs";
const MAX_LOGS = 1000; // Giới hạn số logs

/**
 * Thêm log vào localStorage
 */
function addLog(topic, message, direction = "received") {
  try {
    const logs = getLogs();
    const logEntry = {
      timestamp: new Date().toISOString(),
      topic: topic,
      message: message,
      direction: direction,
    };

    logs.unshift(logEntry);
    // Giới hạn số logs
    if (logs.length > MAX_LOGS) {
      logs.pop();
    }

    localStorage.setItem(MQTT_LOGS_KEY, JSON.stringify(logs));

    // Trigger custom event để cập nhật UI nếu có
    window.dispatchEvent(new CustomEvent("mqttLog", { detail: logEntry }));

    console.log(`📝 Log ${direction}: [${topic}] ${message.substring(0, 50)}`);
  } catch (error) {
    console.error("❌ Lỗi lưu log:", error);
  }
}

/**
 * Lấy logs từ localStorage
 */
function getLogs(limit = null) {
  try {
    const logsStr = localStorage.getItem(MQTT_LOGS_KEY);
    const logs = logsStr ? JSON.parse(logsStr) : [];
    return limit ? logs.slice(0, limit) : logs;
  } catch (error) {
    console.error("❌ Lỗi đọc logs:", error);
    return [];
  }
}

/**
 * Xóa logs
 */
function clearLogs() {
  localStorage.removeItem(MQTT_LOGS_KEY);
  console.log("✅ Đã xóa logs");
}

// ==================== MQTT Connection ====================

/**
 * Kết nối MQTT
 */
function connectMQTT() {
  try {
    console.log(`📡 Đang kết nối MQTT đến: ${MQTT_BROKER}`);
    console.log(`   Client ID: ${MQTT_CLIENT_ID}`);
    console.log(`   Username: ${MQTT_USERNAME}`);

    mqttClient = mqtt.connect(MQTT_BROKER, {
      clientId: MQTT_CLIENT_ID,
      username: MQTT_USERNAME,
      password: MQTT_PASSWORD,
      clean: true,
      reconnectPeriod: 5000,
      connectTimeout: 30000,
      rejectUnauthorized: false, // Bỏ qua certificate validation cho WebSocket
    });

    mqttClient.on("connect", () => {
      console.log("✅ Đã kết nối MQTT");
      updateMQTTStatus("connected");
      addLog("system", "Connected to MQTT broker", "system");

      // Subscribe các topics
      subscribeToTopics();
    });

    mqttClient.on("error", (error) => {
      console.error("❌ MQTT error:", error);
      updateMQTTStatus("disconnected");
      addLog("system", `MQTT Error: ${error.message}`, "error");
    });

    mqttClient.on("close", () => {
      console.log("🔌 MQTT đã đóng");
      updateMQTTStatus("disconnected");
      addLog("system", "Disconnected from MQTT broker", "system");
    });

    mqttClient.on("reconnect", () => {
      console.log("🔄 Đang kết nối lại MQTT...");
      updateMQTTStatus("connecting");
      addLog("system", "Reconnecting to MQTT broker...", "system");
    });

    mqttClient.on("offline", () => {
      console.log("⚠️  MQTT offline");
      updateMQTTStatus("disconnected");
      addLog("system", "MQTT client offline", "error");
    });

    // Lắng nghe messages
    mqttClient.on("message", (topic, message) => {
      const msg = message.toString();
      console.log(`📨 Nhận message từ ${topic}: ${msg}`);
      addLog(topic, msg, "received");

      // Có thể xử lý real-time updates ở đây
      handleMQTTMessage(topic, msg);
    });
  } catch (error) {
    console.error("❌ Lỗi kết nối MQTT:", error);
    updateMQTTStatus("disconnected");
    addLog("system", `Connection error: ${error.message}`, "error");
  }
}

/**
 * Subscribe các MQTT topics
 */
function subscribeToTopics() {
  if (!mqttClient || !mqttClient.connected) {
    console.warn("⚠️  MQTT client chưa kết nối, không thể subscribe");
    return;
  }

  // Subscribe tất cả topics
  Object.values(MQTT_TOPICS).forEach((topic) => {
    mqttClient.subscribe(topic, { qos: 0 }, (error) => {
      if (error) {
        console.error(`❌ Lỗi subscribe ${topic}:`, error);
        addLog(
          "system",
          `Failed to subscribe to ${topic}: ${error.message}`,
          "error"
        );
      } else {
        console.log(`✅ Đã subscribe: ${topic}`);
        addLog("system", `Subscribed to ${topic}`, "system");
      }
    });
  });
}

/**
 * Xử lý MQTT message khi nhận được
 */
function handleMQTTMessage(topic, message) {
  // Có thể cập nhật UI real-time ở đây
  // Ví dụ: nếu nhận weather data, cập nhật display
  if (topic === MQTT_TOPICS.weatherLed) {
    console.log("🌤️  Cập nhật weather từ MQTT:", message);
    // Có thể trigger reload weather display
  } else if (topic === MQTT_TOPICS.exchangeLed) {
    console.log("💱 Cập nhật exchange từ MQTT:", message);
    // Có thể trigger reload exchange display
  }
}

/**
 * Cập nhật trạng thái MQTT
 */
function updateMQTTStatus(status) {
  const statusEl = document.getElementById("mqttStatus");
  if (statusEl) {
    statusEl.textContent =
      status === "connected"
        ? "Connected"
        : status === "connecting"
        ? "Connecting..."
        : "Disconnected";
    statusEl.className = `status-value ${
      status === "connected" ? "connected" : "disconnected"
    }`;
  }
}

/**
 * Publish MQTT message với logging
 */
function publishMQTT(topic, message, options = {}) {
  if (!mqttClient || !mqttClient.connected) {
    console.error("❌ MQTT client chưa kết nối");
    addLog("system", "Cannot publish: MQTT not connected", "error");
    return false;
  }

  try {
    const publishOptions = {
      qos: options.qos || 0,
      retain: options.retain || false,
    };

    mqttClient.publish(topic, message, publishOptions, (error) => {
      if (error) {
        console.error(`❌ Lỗi publish đến ${topic}:`, error);
        addLog(topic, `Publish error: ${error.message}`, "error");
      } else {
        console.log(`📤 Đã publish đến ${topic}: ${message}`);
        addLog(topic, message, "sent");
      }
    });

    return true;
  } catch (error) {
    console.error("❌ Lỗi publish:", error);
    addLog(topic, `Publish exception: ${error.message}`, "error");
    return false;
  }
}

// Export functions để có thể dùng ở file khác (logs.js)
if (typeof window !== "undefined") {
  window.MQTTLogger = {
    getLogs,
    clearLogs,
    addLog,
  };
}

// ==================== API Calls ====================

/**
 * Gọi API
 */
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

/**
 * Kiểm tra server status
 */
async function checkServerStatus() {
  try {
    const data = await apiCall("/api/health");
    document.getElementById("serverStatus").textContent = "Online";
    document.getElementById("serverStatus").className =
      "status-value connected";
    return true;
  } catch (error) {
    document.getElementById("serverStatus").textContent = "Offline";
    document.getElementById("serverStatus").className =
      "status-value disconnected";
    return false;
  }
}

/**
 * Lấy dữ liệu thời tiết hiện tại
 */
async function loadCurrentWeather() {
  try {
    const result = await apiCall("/api/weather/current");
    const data = result.data;

    if (data) {
      document.getElementById("weatherDisplay").innerHTML = `
                <div class="data-item">
                    <strong>Nhiệt độ:</strong> ${data.temperature}°C
                </div>
                <div class="data-item">
                    <strong>Độ ẩm:</strong> ${data.humidity}%
                </div>
                <div class="data-item">
                    <strong>Áp suất:</strong> ${data.pressure} hPa
                </div>
                <div class="data-item">
                    <strong>Mô tả:</strong> ${data.description}
                </div>
                <div class="data-item">
                    <strong>Gió:</strong> ${data.wind_speed} km/h
                </div>
            `;
    } else {
      document.getElementById("weatherDisplay").innerHTML =
        '<p class="loading">Chưa có dữ liệu. Vui lòng cập nhật vị trí.</p>';
    }
  } catch (error) {
    document.getElementById("weatherDisplay").innerHTML =
      '<p class="loading" style="color: red;">Lỗi tải dữ liệu</p>';
  }
}

/**
 * Lấy dữ liệu tỉ giá hiện tại
 */
async function loadCurrentExchange() {
  try {
    const currencyPair = document.getElementById("currencyPair").value;
    const [base, target] = currencyPair.split("/");

    const result = await apiCall(
      `/api/exchange/current?base=${base}&target=${target}`
    );
    const data = result.data;

    if (data) {
      document.getElementById("exchangeDisplay").innerHTML = `
                <div class="data-item">
                    <strong>Cặp tiền:</strong> ${data.base_currency}/${
        data.target_currency
      }
                </div>
                <div class="data-item">
                    <strong>Tỉ giá:</strong> ${data.rate.toFixed(2)}
                </div>
                <div class="data-item">
                    <strong>Thời gian:</strong> ${new Date(
                      data.created_at
                    ).toLocaleString("vi-VN")}
                </div>
            `;
    } else {
      document.getElementById("exchangeDisplay").innerHTML =
        '<p class="loading">Chưa có dữ liệu</p>';
    }
  } catch (error) {
    document.getElementById("exchangeDisplay").innerHTML =
      '<p class="loading" style="color: red;">Lỗi tải dữ liệu</p>';
  }
}

// ==================== Event Handlers ====================

/**
 * Cập nhật vị trí thời tiết
 */
async function handleUpdateLocation() {
  const lat = document.getElementById("latitude").value;
  const lon = document.getElementById("longitude").value;

  if (!lat || !lon) {
    alert("Vui lòng nhập đầy đủ lat và lon");
    return;
  }

  const btn = document.getElementById("updateLocationBtn");
  btn.disabled = true;
  btn.textContent = "Đang cập nhật...";

  try {
    await apiCall("/api/weather/location", {
      method: "POST",
      body: JSON.stringify({ lat, lon }),
    });

    alert("✅ Đã cập nhật vị trí!");
    await loadCurrentWeather();
  } catch (error) {
    alert("❌ Lỗi cập nhật vị trí: " + error.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Cập nhật vị trí";
  }
}

/**
 * Hiển thị tỷ giá lên LED
 */
async function handleDisplayExchange() {
  const currencyPair = document.getElementById("currencyPair").value;
  const [base, target] = currencyPair.split("/");

  const btn = document.getElementById("displayExchangeBtn");
  btn.disabled = true;
  btn.textContent = "Đang gửi...";

  try {
    await apiCall("/api/exchange/display", {
      method: "POST",
      body: JSON.stringify({ base, target }),
    });

    alert(`✅ Đã gửi tỷ giá ${currencyPair} lên LED!`);
  } catch (error) {
    alert("❌ Lỗi hiển thị tỷ giá: " + error.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Hiển thị lên LED";
  }
}

/**
 * Gửi custom message
 */
async function handleSendMessage() {
  const message = document.getElementById("customMessage").value.trim();
  const mode = document.getElementById("messageMode").value;

  if (!message) {
    alert("Vui lòng nhập message");
    return;
  }

  const btn = document.getElementById("sendMessageBtn");
  btn.disabled = true;
  btn.textContent = "Đang gửi...";

  try {
    await apiCall("/api/message/send", {
      method: "POST",
      body: JSON.stringify({ message, mode }),
    });

    alert("✅ Đã gửi message!");
    document.getElementById("customMessage").value = "";
  } catch (error) {
    alert("❌ Lỗi gửi message: " + error.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Gửi Message";
  }
}

/**
 * Áp dụng tốc độ
 */
async function handleApplySpeed() {
  const speed = document.getElementById("ledSpeed").value;

  const btn = document.getElementById("applySpeedBtn");
  btn.disabled = true;
  btn.textContent = "Đang áp dụng...";

  try {
    await apiCall("/api/led/settings", {
      method: "POST",
      body: JSON.stringify({ speed: parseInt(speed) }),
    });

    alert(`✅ Đã áp dụng tốc độ: ${speed}`);
  } catch (error) {
    alert("❌ Lỗi áp dụng tốc độ: " + error.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "✓ Áp dụng tốc độ";
  }
}

/**
 * Áp dụng độ sáng
 */
async function handleApplyBrightness() {
  const brightness = document.getElementById("ledBrightness").value;

  const btn = document.getElementById("applyBrightnessBtn");
  btn.disabled = true;
  btn.textContent = "Đang áp dụng...";

  try {
    await apiCall("/api/led/settings", {
      method: "POST",
      body: JSON.stringify({ brightness: parseInt(brightness) }),
    });

    alert(`✅ Đã áp dụng độ sáng: ${brightness}`);
  } catch (error) {
    alert("❌ Lỗi áp dụng độ sáng: " + error.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "✓ Áp dụng độ sáng";
  }
}

/**
 * Áp dụng chế độ hiển thị
 */
async function handleApplyMode() {
  const mode = document.getElementById("ledMode").value;

  if (!mode) {
    alert("Vui lòng chọn chế độ");
    return;
  }

  const btn = document.getElementById("applyModeBtn");
  btn.disabled = true;
  btn.textContent = "Đang áp dụng...";

  try {
    await apiCall("/api/led/settings", {
      method: "POST",
      body: JSON.stringify({ mode }),
    });

    alert(`✅ Đã áp dụng chế độ: ${mode}`);
  } catch (error) {
    alert("❌ Lỗi áp dụng chế độ: " + error.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "✓ Áp dụng chế độ";
  }
}

// ==================== AUTO MODE ====================

let autoInterval = null;
let autoStep = 0;

const AUTO_CURRENCIES = [
  "USD/VND",
  "EUR/VND",
  "GBP/VND",
  "JPY/VND",
  "CNY/VND",
  "AUD/VND",
];
const AUTO_DELAY = 5000; // 5 giây mỗi bước

/**
 * Bắt đầu chế độ AUTO
 */
async function startAutoMode() {
  if (autoInterval) {
    alert("Chế độ AUTO đang chạy!");
    return;
  }

  // Đặt tốc độ vừa phải
  await apiCall("/api/led/settings", {
    method: "POST",
    body: JSON.stringify({ speed: 50 }),
  });

  autoStep = 0;
  updateAutoStatus("Đang chạy - Bước 1: Thời gian", "connected");

  document.getElementById("autoDisplayBtn").disabled = true;
  document.getElementById("stopAutoBtn").disabled = false;

  // Chạy ngay lập tức
  await runAutoStep();

  // Sau đó chạy theo interval
  autoInterval = setInterval(runAutoStep, AUTO_DELAY);
}

/**
 * Dừng chế độ AUTO
 */
function stopAutoMode() {
  if (autoInterval) {
    clearInterval(autoInterval);
    autoInterval = null;
  }

  autoStep = 0;
  updateAutoStatus("Đã dừng", "disconnected");

  document.getElementById("autoDisplayBtn").disabled = false;
  document.getElementById("stopAutoBtn").disabled = true;
}

/**
 * Chạy một bước AUTO
 */
async function runAutoStep() {
  try {
    if (autoStep === 0) {
      // Bước 1: Hiển thị thời gian
      updateAutoStatus("Đang chạy - Bước 1: Thời gian", "connected");
      await apiCall("/api/auto/time", { method: "POST" });
    } else if (autoStep === 1) {
      // Bước 2: Hiển thị thời tiết
      updateAutoStatus("Đang chạy - Bước 2: Thời tiết", "connected");
      await apiCall("/api/auto/weather", { method: "POST" });
    } else {
      // Bước 3+: Hiển thị tỷ giá
      const currencyIndex = autoStep - 2;
      if (currencyIndex < AUTO_CURRENCIES.length) {
        const currencyPair = AUTO_CURRENCIES[currencyIndex];
        const [base, target] = currencyPair.split("/");
        updateAutoStatus(`Đang chạy - Tỷ giá: ${currencyPair}`, "connected");
        await apiCall("/api/exchange/display", {
          method: "POST",
          body: JSON.stringify({ base, target }),
        });
      } else {
        // Quay lại bước đầu
        autoStep = -1;
      }
    }

    autoStep++;
  } catch (error) {
    console.error("❌ Lỗi AUTO mode:", error);
    updateAutoStatus("Lỗi: " + error.message, "disconnected");
  }
}

/**
 * Cập nhật trạng thái AUTO
 */
function updateAutoStatus(text, status) {
  const statusEl = document.getElementById("autoStatusText");
  statusEl.textContent = text;
  statusEl.className = `status-value ${status}`;
}

// ==================== Initialization ====================

/**
 * Khởi tạo ứng dụng
 */
function init() {
  // Kiểm tra server status
  checkServerStatus();
  setInterval(checkServerStatus, 30000); // Check mỗi 30 giây

  // Kết nối MQTT
  connectMQTT();

  // Load dữ liệu ban đầu
  loadCurrentWeather();
  loadCurrentExchange();

  // Log số lượng logs hiện tại
  const logs = getLogs();
  console.log(`📊 Đã có ${logs.length} logs trong storage`);

  // Event listeners - Weather
  document
    .getElementById("updateLocationBtn")
    .addEventListener("click", handleUpdateLocation);

  // Event listeners - Exchange
  document
    .getElementById("currencyPair")
    .addEventListener("change", loadCurrentExchange);
  document
    .getElementById("refreshExchangeBtn")
    .addEventListener("click", loadCurrentExchange);
  document
    .getElementById("displayExchangeBtn")
    .addEventListener("click", handleDisplayExchange);

  // Event listeners - Auto Mode
  document
    .getElementById("autoDisplayBtn")
    .addEventListener("click", startAutoMode);
  document
    .getElementById("stopAutoBtn")
    .addEventListener("click", stopAutoMode);

  // Event listeners - Custom Message
  document
    .getElementById("sendMessageBtn")
    .addEventListener("click", handleSendMessage);

  // Event listeners - LED Settings
  document
    .getElementById("applySpeedBtn")
    .addEventListener("click", handleApplySpeed);
  document
    .getElementById("applyBrightnessBtn")
    .addEventListener("click", handleApplyBrightness);
  document
    .getElementById("applyModeBtn")
    .addEventListener("click", handleApplyMode);

  // Range sliders - cập nhật hiển thị giá trị
  document.getElementById("ledSpeed").addEventListener("input", (e) => {
    document.getElementById("speedValue").textContent = e.target.value;
  });

  document.getElementById("ledBrightness").addEventListener("input", (e) => {
    document.getElementById("brightnessValue").textContent = e.target.value;
  });

  console.log("✅ Ứng dụng đã khởi tạo");
}

// Chạy khi DOM ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

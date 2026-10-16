(() => {
  const $ = id => document.getElementById(id);
  const STORAGE_KEY = "jalrakshak2_state_v1";

  const defaults = {
    coords: {
      A: { lat: 17.7782, lon: 83.2150 },
      B: { lat: 17.7790, lon: 83.2170 },
      C: { lat: 17.7779, lon: 83.2191 }
    },
    scenario: "normal",
    history: [],
    samples: []
  };

  let state = loadState();
  let readings = {};
  let lastEventKey = "";

  function loadState() {
    try {
      const saved = JSON.parse(
        localStorage.getItem(STORAGE_KEY) || "{}"
      );

      return {
        ...structuredClone(defaults),
        ...saved,
        coords: saved.coords || structuredClone(defaults.coords),
        history: saved.history || [],
        samples: saved.samples || []
      };
    } catch {
      return structuredClone(defaults);
    }
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn("Unable to save local dashboard data.", error);
    }
  }

  const fmt = (number, decimals = 1) =>
    Number(number).toFixed(decimals);

  const time = () =>
    new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });

  const stamp = () => new Date().toLocaleString();

  const rand = (min, max) =>
    min + Math.random() * (max - min);

  // Generate simulated readings for three sensor locations.
  function makeReadings() {
    const base = {
      A: {
        pressure: rand(2.65, 2.95),
        flow: rand(21, 23),
        turbidity: rand(0.4, 1.1),
        conductivity: rand(220, 290),
        online: true
      },
      B: {
        pressure: rand(2.45, 2.75),
        flow: rand(20, 22),
        turbidity: rand(0.4, 1.2),
        conductivity: rand(225, 300),
        online: true
      },
      C: {
        pressure: rand(2.25, 2.55),
        flow: rand(19, 21),
        turbidity: rand(0.4, 1.3),
        conductivity: rand(230, 310),
        online: true
      }
    };

    if (state.scenario === "leak") {
      base.C.pressure = rand(0.8, 1.2);
      base.B.pressure = rand(2.0, 2.3);
      base.B.flow = rand(24, 27);
      base.C.flow = rand(11, 15);
    }

    if (state.scenario === "blockage") {
      base.C.pressure = rand(1.2, 1.6);
      base.C.flow = rand(7, 11);
      base.B.pressure = rand(2.7, 3.0);
    }

    if (state.scenario === "pump") {
      for (const key of ["A", "B", "C"]) {
        base[key].pressure = rand(0.1, 0.35);
        base[key].flow = rand(0, 1.5);
      }
    }

    if (state.scenario === "sensor") {
      base.C.online = false;
    }

    return base;
  }

  // Demonstration rules, not a validated leak-detection algorithm.
  function analyse(r) {
    if (!r.C.online) {
      return {
        level: "CRITICAL",
        section: "Sensor C",
        title: "Sensor C communication fault",
        detail:
          "No current reading from Sensor C. Check power, wiring, radio link, and device health.",
        notes: [
          "Sensor C data is unavailable; do not infer pipe health from missing data.",
          "Check the node and LoRa communication path."
        ]
      };
    }

    if (state.scenario === "pump") {
      return {
        level: "CRITICAL",
        section: "A–C network",
        title: "Possible pump stop or supply interruption",
        detail:
          "Pressure and flow are low across all three nodes.",
        notes: [
          "Low readings across the network can indicate pump stop or upstream supply interruption.",
          "Inspect pump and upstream valves before assuming a leak."
        ]
      };
    }

    if (state.scenario === "leak") {
      return {
        level: "CRITICAL",
        section: "B–C",
        title: "Possible leak or pipe damage",
        detail:
          "A pressure reduction and flow mismatch are simulated between Sensor B and Sensor C.",
        notes: [
          "Pressure and flow diverge across B–C in this test scenario.",
          "Inspect the B–C section; this alert is not proof of a leak."
        ]
      };
    }

    if (state.scenario === "blockage") {
      return {
        level: "WARNING",
        section: "Near B–C",
        title: "Possible blockage or valve restriction",
        detail:
          "Downstream flow is reduced in the simulated scenario.",
        notes: [
          "Compare upstream and downstream flow.",
          "Inspect valves and the pipe section; verify with field measurements."
        ]
      };
    }

    return {
      level: "NORMAL",
      section: "None",
      title: "No unusual event detected",
      detail:
        "Readings are within the prototype's normal demo pattern.",
      notes: [
        "Comparing pressure and flow across the three nodes.",
        "No simulated fault is active."
      ]
    };
  }

  function addEvent(result) {
    const key =
      `${state.scenario}:${result.level}:${result.section}`;

    if (key === lastEventKey && state.history.length) {
      return;
    }

    lastEventKey = key;

    if (
      result.level === "NORMAL" &&
      state.history[0]?.event === "No unusual event detected"
    ) {
      return;
    }

    state.history.unshift({
      time: stamp(),
      event: result.title,
      section: result.section,
      level: result.level
    });

    state.history = state.history.slice(0, 80);
    persist();
  }

  function setStatusClass(element, level) {
    element.classList.remove("good", "warn", "bad");

    element.classList.add(
      level === "NORMAL"
        ? "good"
        : level === "WARNING"
          ? "warn"
          : "bad"
    );
  }

  function renderReadings() {
    readings = makeReadings();
    const result = analyse(readings);

    const averagePressure =
      (
        readings.A.pressure +
        readings.B.pressure +
        readings.C.pressure
      ) / 3;

    const averageFlow =
      (
        readings.A.flow +
        readings.B.flow +
        readings.C.flow
      ) / 3;

    $("pressureValue").innerHTML =
      `${fmt(averagePressure)} <small>bar</small>`;

    $("flowValue").innerHTML =
      `${fmt(averageFlow)} <small>L/min</small>`;

    $("sectionValue").textContent = result.section;

    $("sectionNote").textContent =
      result.level === "NORMAL"
        ? "No simulated fault"
        : "Estimated from demo pattern";

    $("pressureNote").textContent =
      result.level === "NORMAL"
        ? "Within demo range"
        : "Check pressure differences";

    $("flowNote").textContent =
      result.level === "NORMAL"
        ? "Flow stable"
        : "Flow pattern requires inspection";

    $("statusValue").textContent =
      result.level === "NORMAL"
        ? "Monitoring"
        : result.level === "WARNING"
          ? "Investigate"
          : "Action needed";

    $("statusNote").textContent =
      result.level === "NORMAL"
        ? "All demo nodes reporting"
        : result.level === "CRITICAL"
          ? "Critical simulated event"
          : "Unusual simulated readings";

    const pill = $("statusPill");
    pill.textContent = result.level;
    setStatusClass(pill, result.level);

    $("faultBox").className =
      `fault-box ${
        result.level === "NORMAL"
          ? "good"
          : result.level === "WARNING"
            ? "warn"
            : "bad"
      }`;

    $("faultBox").querySelector(".fault-symbol").textContent =
      result.level === "NORMAL"
        ? "✓"
        : result.level === "WARNING"
          ? "!"
          : "×";

    $("faultBox").querySelector("strong").textContent =
      result.title;

    $("faultBox").querySelector("p").textContent =
      result.detail;

    $("analysisList").innerHTML = result.notes
      .map(note => `<li>${escapeHtml(note)}</li>`)
      .join("");

    renderSensors();
    renderMap(result);

    state.samples.push({
      time: time(),
      pressure: averagePressure,
      flow: averageFlow
    });

    state.samples = state.samples.slice(-24);

    addEvent(result);
    persist();
    renderHistory();
    drawChart();
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]);
  }

  function renderSensors() {
    $("sensorCards").innerHTML = ["A", "B", "C"]
      .map(key => {
        const reading = readings[key];
        const offline = !reading.online;

        const level = offline
          ? "bad"
          : (
              state.scenario !== "normal" &&
              (key === "C" || state.scenario === "pump")
            )
              ? "warn"
              : "good";

        const label = offline
          ? "OFFLINE"
          : level === "warn"
            ? "CHECK"
            : "ONLINE";

        return `
          <div class="sensor-card">
            <div class="sensor-card-head">
              <strong>Sensor ${key}</strong>
              <span class="${level}">${label}</span>
            </div>

            <div class="sensor-values">
              <div>
                Pressure
                <b>${
                  reading.online
                    ? `${fmt(reading.pressure)} bar`
                    : "—"
                }</b>
              </div>

              <div>
                Flow rate
                <b>${
                  reading.online
                    ? `${fmt(reading.flow)} L/min`
                    : "—"
                }</b>
              </div>
            </div>
          </div>
        `;
      })
      .join("");
  }

  function renderMap(result) {
    ["A", "B", "C"].forEach(key => {
      $(`node${key}`).classList.remove("fault", "down");
    });

    if (
      result.level === "CRITICAL" &&
      result.section === "Sensor C"
    ) {
      $("nodeC").classList.add("down");
    } else if (result.level !== "NORMAL") {
      $("nodeB").classList.add("fault");
      $("nodeC").classList.add("fault");
    }

    $("segmentAB").setAttribute(
      "stroke",
      result.level === "CRITICAL" &&
      result.section === "A–C network"
        ? "#c33d3d"
        : "#1a9aa0"
    );

    $("segmentBC").setAttribute(
      "stroke",
      result.section === "B–C" ||
      result.section === "Near B–C"
        ? "#d18a1b"
        : result.section === "A–C network"
          ? "#c33d3d"
          : "#1a9aa0"
    );

    $("gpsRow").innerHTML = ["A", "B", "C"]
      .map(key => `
        <div class="gps-chip">
          <strong>Sensor ${key}</strong>
          ${state.coords[key].lat.toFixed(5)},
          ${state.coords[key].lon.toFixed(5)}
        </div>
      `)
      .join("");
  }

  function renderHistory() {
    const rows = state.history.slice(0, 12);

    $("alertTable").innerHTML = rows.length
      ? rows.map(event => `
          <tr>
            <td>${escapeHtml(event.time)}</td>
            <td>${escapeHtml(event.event)}</td>
            <td>${escapeHtml(event.section)}</td>
            <td>
              <span class="level ${event.level}">
                ${event.level}
              </span>
            </td>
          </tr>
        `).join("")
      : `
          <tr>
            <td colspan="4" class="empty-row">
              No alerts saved yet.
            </td>
          </tr>
        `;
  }

  function drawChart() {
    const canvas = $("trendChart");
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    const pad = {
      left: 42,
      right: 20,
      top: 16,
      bottom: 32
    };

    const chartWidth = width - pad.left - pad.right;
    const chartHeight = height - pad.top - pad.bottom;

    ctx.strokeStyle = "#e5eeee";
    ctx.lineWidth = 1;
    ctx.fillStyle = "#82999b";
    ctx.font = "12px sans-serif";

    for (let i = 0; i <= 4; i++) {
      const y = pad.top + chartHeight * i / 4;

      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(width - pad.right, y);
      ctx.stroke();

      ctx.fillText(String(4 - i), 8, y + 4);
    }

    const data = state.samples;

    if (data.length < 2) {
      ctx.fillText(
        "Collecting sample history…",
        pad.left + 10,
        pad.top + 30
      );
      return;
    }

    function drawLine(key, color, maxValue) {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;

      data.forEach((sample, index) => {
        const x =
          pad.left +
          chartWidth * index / (data.length - 1);

        const value = Math.max(
          0,
          Math.min(maxValue, sample[key])
        );

        const y =
          pad.top +
          chartHeight -
          (value / maxValue) * chartHeight;

        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });

      ctx.stroke();
    }

    drawLine("pressure", "#087e83", 4);
    drawLine("flow", "#e2a13a", 30);

    ctx.fillStyle = "#82999b";
    ctx.fillText("Recent samples", pad.left, height - 8);
  }

  function openCoords() {
    ["A", "B", "C"].forEach(key => {
      $(`lat${key}`).value = state.coords[key].lat;
      $(`lon${key}`).value = state.coords[key].lon;
    });

    $("coordsDialog").showModal();
  }

  $("editCoords").addEventListener("click", openCoords);

  $("coordsForm").addEventListener("submit", event => {
    event.preventDefault();

    for (const key of ["A", "B", "C"]) {
      const lat = Number($(`lat${key}`).value);
      const lon = Number($(`lon${key}`).value);

      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lon) ||
        lat < -90 || lat > 90 ||
        lon < -180 || lon > 180
      ) {
        alert(`Please enter valid GPS coordinates for Sensor ${key}.`);
        return;
      }

      state.coords[key] = { lat, lon };
    }

    persist();
    $("coordsDialog").close();
    renderMap(analyse(readings));
  });

  $("resetCoords").addEventListener("click", () => {
    state.coords = structuredClone(defaults.coords);
    openCoords();
  });

  $("runScenario").addEventListener("click", () => {
    state.scenario = $("scenario").value;
    lastEventKey = "";
    persist();
    renderReadings();
  });

  $("scenario").value = state.scenario;

  $("clearHistory").addEventListener("click", () => {
    if (
      confirm(
        "Clear saved alert and chart history on this device?"
      )
    ) {
      state.history = [];
      state.samples = [];
      lastEventKey = "";
      persist();
      renderHistory();
      drawChart();
    }
  });

  $("exportCsv").addEventListener("click", () => {
    const rows = [
      ["Time", "Event", "Section", "Level"],
      ...state.history.map(event => [
        event.time,
        event.event,
        event.section,
        event.level
      ])
    ];

    const csv = rows
      .map(row =>
        row.map(value =>
          `"${String(value).replace(/"/g, '""')}"`
        ).join(",")
      )
      .join("\r\n");

    const blob = new Blob(
      [csv],
      { type: "text/csv;charset=utf-8;" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "jalrakshak-alert-history.csv";
    link.click();

    URL.revokeObjectURL(url);
  });

  // Service workers require localhost or HTTPS.
  if ("serviceWorker" in navigator &&
      location.protocol.startsWith("http")) {
    navigator.serviceWorker
      .register("./sw.js")
      .catch(error => {
        console.warn("Offline caching registration failed.", error);
      });
  }

  function updateConnection() {
    $("connectionStatus").textContent =
      navigator.onLine
        ? "Browser online · demo mode"
        : "Offline mode · local demo";
  }

  window.addEventListener("online", updateConnection);
  window.addEventListener("offline", updateConnection);

  updateConnection();
  renderReadings();

  // Refresh simulated readings every five seconds.
  setInterval(renderReadings, 5000);
})();

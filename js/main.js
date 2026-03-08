(function () {
  "use strict";

  // ── Status Dashboard ──

  function renderStatus(data) {
    var container = document.getElementById("status-content");
    if (!container) return;

    if (!data.lastChecked) {
      container.innerHTML =
        '<div class="status-message">Status data collecting... checks run every 30 minutes.</div>';
      return;
    }

    var components = data.components;
    var names = Object.keys(components);
    var allDown = names.every(function (k) {
      return components[k].status === "down";
    });

    var html = '<div class="status-grid">';
    names.forEach(function (key) {
      var c = components[key];
      html +=
        '<div class="status-card">' +
        '<div class="name">' +
        escapeHtml(c.name) +
        "</div>" +
        '<div class="indicator">' +
        '<span class="status-dot ' +
        c.status +
        '"></span>' +
        "<span>" +
        (c.status === "up" ? "Operational" : "Offline") +
        "</span>" +
        "</div>" +
        (c.status === "up" && c.responseMs
          ? '<div class="response-time">' + c.responseMs + " ms</div>"
          : "") +
        "</div>";
    });
    html += "</div>";

    if (allDown) {
      html +=
        '<div class="status-message">' +
        "Management cluster is offline. This is by design &mdash; " +
        "clusters are torn down when not in use to minimize cost." +
        "</div>";
    }

    html +=
      '<div class="last-checked">Last checked: ' +
      formatDate(data.lastChecked) +
      "</div>";

    // Uptime timeline
    if (data.daily && data.daily.length > 0) {
      html += renderUptimeTimeline(data.daily);
    }

    container.innerHTML = html;
  }

  function renderUptimeTimeline(daily) {
    var html =
      '<div style="margin-top: 1.5rem;">' +
      '<h3 style="font-size: 0.85rem; font-weight: 600; color: var(--color-text-muted); margin-bottom: 0.5rem;">90-Day Uptime</h3>' +
      '<div class="uptime-timeline">';

    // Pad to 90 days
    var padded = [];
    for (var i = 0; i < 90 - daily.length; i++) {
      padded.push(null);
    }
    daily.forEach(function (d) {
      padded.push(d);
    });

    padded.forEach(function (d) {
      if (!d) {
        html += '<div class="day empty" title="No data"></div>';
      } else {
        var cls =
          d.uptimePercent === 100
            ? "full"
            : d.uptimePercent > 0
              ? "partial"
              : "down";
        html +=
          '<div class="day ' +
          cls +
          '" title="' +
          d.date +
          ": " +
          d.uptimePercent +
          '% uptime"></div>';
      }
    });

    html += "</div>";
    html +=
      '<div class="uptime-legend">' +
      '<span><span class="swatch" style="background: var(--color-green);"></span> 100%</span>' +
      '<span><span class="swatch" style="background: var(--color-badge-incubating);"></span> Partial</span>' +
      '<span><span class="swatch" style="background: var(--color-red);"></span> Down</span>' +
      '<span><span class="swatch" style="background: var(--color-gray-bg);"></span> No data</span>' +
      "</div></div>";

    return html;
  }

  // ── E2E Results ──

  function renderE2E(data) {
    var container = document.getElementById("e2e-content");
    if (!container) return;

    if (!data.lastRun) {
      container.innerHTML =
        '<div class="status-message">No E2E test results yet. Daily tests validate the full platform pipeline.</div>';
      return;
    }

    var last = data.lastRun;
    var html =
      '<div class="e2e-summary">' +
      renderE2ECard("EKS (AWS)", last.eks) +
      renderE2ECard("GKE (GCP)", last.gke) +
      "</div>";

    html +=
      '<div style="font-size: 0.85rem; color: var(--color-text-muted); margin-bottom: 1.5rem;">' +
      "Last run: " +
      formatDate(last.date) +
      " &middot; Total: " +
      formatDuration(last.durationSeconds) +
      "</div>";

    if (data.history && data.history.length > 0) {
      html +=
        '<h3 style="font-size: 0.85rem; font-weight: 600; color: var(--color-text-muted); margin-bottom: 0.5rem;">Test History</h3>';
      html += '<div class="e2e-history">';
      data.history.forEach(function (h) {
        html +=
          '<div class="day ' +
          h.result +
          '" title="' +
          h.date +
          ": " +
          h.result +
          '"></div>';
      });
      html += "</div>";
    }

    container.innerHTML = html;
  }

  function renderE2ECard(title, cloud) {
    if (!cloud) return "";
    return (
      '<div class="e2e-card">' +
      "<h3>" +
      escapeHtml(title) +
      "</h3>" +
      '<div class="result ' +
      cloud.result +
      '">' +
      cloud.result.toUpperCase() +
      "</div>" +
      '<div class="details">' +
      "Provision: " +
      formatDuration(cloud.provisionSeconds) +
      (cloud.responseMs ? " &middot; Response: " + cloud.responseMs + " ms" : "") +
      "</div>" +
      "</div>"
    );
  }

  // ── Helpers ──

  function formatDate(iso) {
    if (!iso) return "N/A";
    var d = new Date(iso);
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    });
  }

  function formatDuration(seconds) {
    if (!seconds) return "N/A";
    var m = Math.floor(seconds / 60);
    var s = seconds % 60;
    return m + "m " + s + "s";
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // ── Lightbox ──

  var lightbox = document.createElement("div");
  lightbox.className = "lightbox";
  lightbox.innerHTML = '<img src="" alt="">';
  document.body.appendChild(lightbox);

  var lightboxImg = lightbox.querySelector("img");

  lightbox.addEventListener("click", function () {
    lightbox.classList.remove("active");
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      lightbox.classList.remove("active");
    }
  });

  document.addEventListener("click", function (e) {
    var img = e.target;
    if (img.tagName !== "IMG") return;
    var parent = img.closest(".screenshot, .walkthrough-img");
    if (!parent) return;
    lightboxImg.src = img.src;
    lightboxImg.alt = img.alt;
    lightbox.classList.add("active");
  });

  // ── Fetch & Render ──

  function loadJSON(url, callback) {
    fetch(url)
      .then(function (r) {
        return r.json();
      })
      .then(callback)
      .catch(function () {
        /* data not available yet */
      });
  }

  loadJSON("data/status.json", renderStatus);
  loadJSON("data/e2e-results.json", renderE2E);
})();

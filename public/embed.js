(function () {
  var RESIZE_MESSAGE = "nomi-form-resize";

  function getScriptOrigin(script) {
    if (!script || !script.src) return "";
    try {
      return new URL(script.src).origin;
    } catch (_error) {
      return "";
    }
  }

  function mountForm(container, scriptOrigin) {
    if (container.getAttribute("data-nomi-mounted") === "1") return;

    var slug = container.getAttribute("data-nomi-form");
    var origin =
      container.getAttribute("data-nomi-origin") ||
      scriptOrigin ||
      window.location.origin;
    if (!slug || !origin) return;

    container.setAttribute("data-nomi-mounted", "1");

    var iframe = document.createElement("iframe");
    iframe.src =
      origin.replace(/\/$/, "") +
      "/forms/" +
      encodeURIComponent(slug) +
      "?embed=1";
    iframe.title = container.getAttribute("data-nomi-title") || "Contact form";
    iframe.loading = "lazy";
    iframe.style.width = "100%";
    iframe.style.border = "0";
    iframe.style.display = "block";
    iframe.style.minHeight = "480px";
    container.appendChild(iframe);

    window.addEventListener("message", function (event) {
      if (event.source !== iframe.contentWindow) return;
      if (!event.data || event.data.type !== RESIZE_MESSAGE) return;
      if (typeof event.data.height !== "number") return;
      iframe.style.height = event.data.height + "px";
    });
  }

  function init() {
    var script =
      document.currentScript ||
      document.querySelector('script[src*="embed.js"]');
    var scriptOrigin = getScriptOrigin(script);
    var containers = document.querySelectorAll("[data-nomi-form]");

    containers.forEach(function (container) {
      mountForm(container, scriptOrigin);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

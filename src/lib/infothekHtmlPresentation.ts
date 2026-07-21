const LEGACY_PROTECTION_SCRIPT =
  /<script\b[^>]*\bsrc\s*=\s*(["'])[^"']*(?:infothek-gate|content-protection)\.js(?:\?[^"']*)?\1[^>]*>\s*<\/script\s*>/gi;
const SANDBOXED_FONT_STYLESHEET =
  /<link\b[^>]*\bhref\s*=\s*(["'])\/vendor\/infothek-fonts\.css(?:\?[^"']*)?\1[^>]*>/gi;

const FRAME_ENHANCEMENTS = `
<style data-infothek-frame-enhancements>
  #infothek-zoom-controls {
    position: fixed;
    top: 12px;
    right: 12px;
    z-index: 2147483647;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 5px;
    border: 1px solid rgba(70, 113, 91, 0.35);
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.94);
    box-shadow: 0 3px 12px rgba(0, 0, 0, 0.14);
    font: 600 14px/1 Arial, sans-serif;
  }
  #infothek-zoom-controls button {
    min-width: 38px;
    min-height: 34px;
    padding: 6px 8px;
    border: 1px solid #6b7c5e;
    border-radius: 7px;
    background: #fff;
    color: #2d3436;
    cursor: pointer;
    font: inherit;
  }
  #infothek-zoom-controls button:hover,
  #infothek-zoom-controls button:focus-visible {
    background: #e8ece5;
    outline: 2px solid #4a5a3f;
    outline-offset: 1px;
  }
  #infothek-zoom-reset { min-width: 58px !important; }
  @media (max-width: 600px) {
    #infothek-zoom-controls { top: 6px; right: 6px; }
  }
</style>
<div id="infothek-zoom-controls" data-infothek-frame-enhancements role="group" aria-label="Textgroesse anpassen">
  <button type="button" data-zoom-action="out" aria-label="Text verkleinern">A-</button>
  <button type="button" id="infothek-zoom-reset" data-zoom-action="reset" aria-label="Textgroesse zuruecksetzen">100%</button>
  <button type="button" data-zoom-action="in" aria-label="Text vergroessern">A+</button>
</div>
<script data-infothek-frame-enhancements>
  (function () {
    var controls = document.getElementById("infothek-zoom-controls");
    var reveal = document.querySelector(".reveal");
    if (!controls || !reveal) return;

    var root = document.documentElement;
    var rootBase = parseFloat(getComputedStyle(root).fontSize) || 16;
    var revealBase = parseFloat(getComputedStyle(reveal).fontSize) || rootBase;
    var output = document.getElementById("infothek-zoom-reset");
    var scale = 1;

    function applyScale() {
      root.style.fontSize = rootBase * scale + "px";
      reveal.style.setProperty("font-size", revealBase * scale + "px", "important");
      if (output) output.textContent = Math.round(scale * 100) + "%";
      if (window.Reveal && typeof window.Reveal.layout === "function") window.Reveal.layout();
    }

    controls.addEventListener("pointerdown", function (event) {
      event.stopPropagation();
    });
    controls.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      var target = event.target;
      if (!(target instanceof Element)) return;
      var button = target.closest("button[data-zoom-action]");
      if (!button) return;
      var action = button.getAttribute("data-zoom-action");
      if (action === "in") scale = Math.min(1.8, Math.round((scale + 0.1) * 10) / 10);
      if (action === "out") scale = Math.max(0.8, Math.round((scale - 0.1) * 10) / 10);
      if (action === "reset") scale = 1;
      applyScale();
    });
  })();
</script>`;

export function prepareInfothekHtmlForFrame(html: string): string {
  let prepared = html
    .replace(LEGACY_PROTECTION_SCRIPT, "")
    .replace(SANDBOXED_FONT_STYLESHEET, "")
    .replace(/(\bhash\s*:\s*)true\b/g, "$1false")
    .replace(/(\bsrc\s*=\s*["'])bilder\//gi, "$1/bilder/");

  if (
    !/class\s*=\s*["'][^"']*\breveal\b/i.test(prepared) ||
    prepared.includes("data-infothek-frame-enhancements")
  ) {
    return prepared;
  }

  prepared = prepared.replace(/<\/body>/i, `${FRAME_ENHANCEMENTS}\n</body>`);
  return prepared;
}

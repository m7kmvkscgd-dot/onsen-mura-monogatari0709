// ============ perf_diag.js: 【調査用・一時的】町遷移直後にメインスレッドを占有している処理の特定 ============
// 目的: 「町へ到達してから最初の2秒間に同期実行される処理」を推測ではなく実測する。
// performance.mark()/performance.measure()で各処理の所要時間を計測し、加えて
// 「メインスレッドが実際にブロックされているか」をsetTimeoutの発火遅延(ハートビート)で検証する。
// 調査が終わったら本ファイルと各呼び出し箇所(town.js/save.jsのperfMark等)を削除する。

const perfDiagHistory = [];
const PERF_DIAG_HISTORY_MAX = 240;
function perfDiagLog(msg) {
  const line = "+" + performance.now().toFixed(1) + "ms " + msg;
  perfDiagHistory.push(line);
  if (perfDiagHistory.length > PERF_DIAG_HISTORY_MAX) perfDiagHistory.shift();
  console.error("[PERF DIAG]", line);
}

function perfMark(label) {
  try { performance.mark(label); } catch (e) {}
  perfDiagLog("mark: " + label);
}

function perfMeasureLast(name, startLabel, endLabel) {
  try {
    const m = performance.measure(name, startLabel, endLabel);
    perfDiagLog("measure: " + name + " = " + m.duration.toFixed(2) + "ms");
    return m.duration;
  } catch (e) {
    perfDiagLog("measure FAILED: " + name + " (" + e.message + ")");
    return null;
  }
}

// ---- ハートビート ----
// メインスレッドが本当にブロックされているかを検証するための実験。setTimeout(fn, 50)を
// 50msごとに連鎖予約し、「予約してから実際に発火するまでの遅延」を毎回記録する。
// 同期処理がメインスレッドを塞いでいれば発火が遅れて記録されるはずで、逆に遅延が常に正常
// (50ms±数ms)のままなら、メインスレッドはブロックされておらず原因は別(ネットワーク/デコード等)
// と判断できる。「推測ではなく実験結果で判断する」ための最重要データ。
let perfHeartbeatActive = false;
let perfHeartbeatCount = 0;
const PERF_HEARTBEAT_INTERVAL_MS = 50;
const PERF_HEARTBEAT_MAX_TICKS = 60; // 50ms×60 = 最大3秒間追跡する
function startPerfHeartbeat(tag) {
  if (perfHeartbeatActive) return;
  perfHeartbeatActive = true;
  perfHeartbeatCount = 0;
  perfDiagLog("heartbeat[" + tag + "]: START");
  const tick = () => {
    perfHeartbeatCount++;
    if (perfHeartbeatCount > PERF_HEARTBEAT_MAX_TICKS) {
      perfHeartbeatActive = false;
      perfDiagLog("heartbeat[" + tag + "]: END (" + PERF_HEARTBEAT_MAX_TICKS + " ticks)");
      return;
    }
    const scheduledAt = performance.now();
    setTimeout(() => {
      const actualDelay = performance.now() - scheduledAt;
      // 数msの誤差は正常。10ms以上ずれた時だけログしてノイズを減らす
      if (actualDelay > PERF_HEARTBEAT_INTERVAL_MS + 10) {
        perfDiagLog("heartbeat[" + tag + "] #" + perfHeartbeatCount + ": DELAYED (scheduled " + PERF_HEARTBEAT_INTERVAL_MS + "ms, actual " + actualDelay.toFixed(1) + "ms, drift +" + (actualDelay - PERF_HEARTBEAT_INTERVAL_MS).toFixed(1) + "ms)");
      }
      tick();
    }, PERF_HEARTBEAT_INTERVAL_MS);
  };
  tick();
}

// ---- setTimeout / requestAnimationFrame の発火状況を記録する ----
// activatePerfPatchWindow()で指定した時間だけ有効化される(常時有効にすると全画面の全タイマーを
// 汚染してしまうため、町遷移直後だけに限定する)
let perfPatchActive = false;
let perfPatchWindowEndAt = 0;
const perfOrigSetTimeout = window.setTimeout.bind(window);
const perfOrigRAF = window.requestAnimationFrame.bind(window);
function activatePerfPatchWindow(durationMs) {
  perfPatchActive = true;
  perfPatchWindowEndAt = performance.now() + durationMs;
  perfDiagLog("perfPatch: window ACTIVE for " + durationMs + "ms");
}
window.setTimeout = function (fn, delay, ...args) {
  if (perfPatchActive && performance.now() < perfPatchWindowEndAt && typeof fn === "function") {
    const scheduledAt = performance.now();
    const d = delay || 0;
    return perfOrigSetTimeout(() => {
      const actualDelay = performance.now() - scheduledAt;
      if (actualDelay > d + 30) {
        perfDiagLog("setTimeout(delay=" + d + "): fired after " + actualDelay.toFixed(1) + "ms (drift +" + (actualDelay - d).toFixed(1) + "ms)");
      }
      fn(...args);
    }, delay);
  }
  return perfOrigSetTimeout(fn, delay, ...args);
};
window.requestAnimationFrame = function (fn) {
  if (perfPatchActive && performance.now() < perfPatchWindowEndAt) {
    const scheduledAt = performance.now();
    return perfOrigRAF((ts) => {
      const actualDelay = performance.now() - scheduledAt;
      if (actualDelay > 50) {
        perfDiagLog("requestAnimationFrame: fired " + actualDelay.toFixed(1) + "ms after being scheduled");
      }
      fn(ts);
    });
  }
  return perfOrigRAF(fn);
};

// ---- 画像リソースの読み込み状況(Resource Timing API) ----
function dumpImageResourceTimingSince(sinceMs, tag) {
  try {
    const entries = performance.getEntriesByType("resource").filter((e) => e.startTime >= sinceMs && /\.(jpg|jpeg|png|webp)(\?|$)/i.test(e.name));
    perfDiagLog("resourceTiming[" + tag + "]: " + entries.length + " image(s) since t=" + sinceMs.toFixed(0) + "ms");
    entries.sort((a, b) => a.startTime - b.startTime).forEach((e) => {
      const shortName = e.name.split("/").slice(-2).join("/");
      perfDiagLog("  img: " + shortName + " start=" + e.startTime.toFixed(0) + " dur=" + e.duration.toFixed(1) + " ttfb=" + e.responseStart.toFixed(0) + " end=" + e.responseEnd.toFixed(0));
    });
  } catch (e) {
    perfDiagLog("resourceTiming dump FAILED: " + e.message);
  }
}

// ---- 画面上のパネル(実機で確認できるように、BGM調査用パネルとは別に画面下部へ表示) ----
function renderPerfDiagOverlay() {
  try {
    let el = document.getElementById("perfDiagOverlay");
    if (!el) {
      el = document.createElement("div");
      el.id = "perfDiagOverlay";
      el.style.cssText = "position:fixed;bottom:0;left:0;z-index:999999;background:rgba(0,0,25,0.85);color:#7cf;font-size:9px;font-family:monospace;padding:4px 6px;white-space:pre-wrap;pointer-events:none;overflow-y:auto;max-width:100vw;max-height:35vh;line-height:1.25;";
      document.body.appendChild(el);
    }
    el.textContent = "[PERF DIAG] (町遷移調査用)\n" + perfDiagHistory.join("\n");
    el.scrollTop = el.scrollHeight;
  } catch (e) {}
}
setInterval(renderPerfDiagOverlay, 200);

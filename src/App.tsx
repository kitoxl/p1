import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { Bot, ScrollText, Wifi, Zap } from "lucide-react";

function isHostLocal(host: string) {
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.startsWith("::1") ||
    host.startsWith("192.168") ||
    host.startsWith("10.") ||
    host.startsWith("172.")
  );
}

function getSocketURL() {
  const host = window.location.host.split(":")[0];
  const isLocal = isHostLocal(host);
  return isLocal ? `http://${host}:3000` : "/";
}

const socket = io(getSocketURL());

function ConfigureProxiesAndAgentsView({ onClose }: { onClose: () => void }) {
  const [loadingConfiguration, setLoadingConfiguration] = useState(false);
  const [configuration, setConfiguration] = useState<string[]>(["", ""]);

  async function retrieveConfiguration(): Promise<string[]> {
    const response = await fetch(`/configuration`);
    const information = (await response.json()) as { proxies: string; uas: string };
    const proxies = atob(information.proxies || "");
    const uas = atob(information.uas || "");
    return [proxies, uas];
  }

  useEffect(() => {
    setLoadingConfiguration(true);
    retrieveConfiguration()
      .then((c) => setConfiguration(c))
      .catch(() => setConfiguration(["", ""]))
      .finally(() => setLoadingConfiguration(false));
  }, []);

  function saveConfiguration() {
    const obj = {
      proxies: btoa(configuration[0] || ""),
      uas: btoa(configuration[1] || ""),
    };

    fetch(`/configuration`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(obj),
    })
      .then(() => {
        alert("Saved");
        onClose();
      })
      .catch(() => alert("Failed to save"));
  }

  if (loadingConfiguration)
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center">
        <div className="bg-white p-6 rounded shadow">Loading...</div>
      </div>
    );

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-8">
      <div className="w-[56rem] flex flex-col bg-white rounded-md shadow-lg p-4">
        <h3 className="font-bold mb-2">Configuration</h3>
        <p className="italic mb-1">proxies.txt</p>
        <textarea
          value={configuration[0]}
          className="w-full h-40 p-2 border rounded mb-2"
          onChange={(e: any) => setConfiguration([e.target.value, configuration[1]])}
        />
        <p className="italic mb-1">uas.txt</p>
        <textarea
          value={configuration[1]}
          className="w-full h-40 p-2 border rounded mb-2"
          onChange={(e: any) => setConfiguration([configuration[0], e.target.value])}
        />
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-3 py-2 rounded border">
            Close
          </button>
          <button onClick={saveConfiguration} className="px-3 py-2 rounded bg-pink-500 text-white">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App(): JSX.Element {
  const [isAttacking, setIsAttacking] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [stats, setStats] = useState({ pps: 0, bots: 0, totalPackets: 0 });

  const [target, setTarget] = useState("");
  const [attackMethod, setAttackMethod] = useState("http_flood");
  const [packetSize, setPacketSize] = useState(64);
  const [duration, setDuration] = useState(60);
  const [packetDelay, setPacketDelay] = useState(100);
  const [simulationMode, setSimulationMode] = useState(false);

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem("miku_dark") === "1";
    } catch (e) {
      return false;
    }
  });

  const [presets, setPresets] = useState<any[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("miku_presets") || "[]");
    } catch (e) {
      return [];
    }
  });

  // const [selectedPreset, setSelectedPreset] = useState<string>("");
  const [showConfig, setShowConfig] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  const [clientSpecs, setClientSpecs] = useState<any>(null);
  const [serverSpecs, setServerSpecs] = useState<any>(null);
  const [serverConnected, setServerConnected] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (darkMode) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
    try {
      localStorage.setItem("miku_dark", darkMode ? "1" : "0");
    } catch (e) {
      // ignore
    }
  }, [darkMode]);

  useEffect(() => {
    socket.on("stats", (data: any) => {
      setServerConnected(true);
      setStats((old: any) => ({
        pps: data.pps ?? old.pps,
        bots: data.bots ?? old.bots,
        totalPackets: data.totalPackets ?? old.totalPackets,
      }));
      if (data.log) addLog(data.log);
    });
    socket.on("attackEnd", () => setIsAttacking(false));
    socket.on("connect", () => setServerConnected(true));
    socket.on("disconnect", () => setServerConnected(false));
    return () => {
      socket.off("stats");
      socket.off("attackEnd");
      socket.off("connect");
      socket.off("disconnect");
    };
  }, []);

  useEffect(() => {
    gatherClientSpecs().then(setClientSpecs);
    fetchServerSpecs().then(setServerSpecs).catch(() => {});
  }, []);

  const addLog = (message: string) =>
    setLogs((p: any) => [message, ...p].slice(0, 100));

  const startAttack = (_isQuick?: boolean) => {
    if (!target.trim()) {
      alert("Please enter a target!");
      return;
    }
    setIsAttacking(true);
    addLog("Preparing attack...");
    socket.emit("startAttack", {
      target,
      packetSize,
      duration,
      packetDelay,
      attackMethod,
      simulation: simulationMode,
    });
  };

  const stopAttack = () => {
    socket.emit("stopAttack");
    setIsAttacking(false);
  };

  function saveCurrentPreset() {
    try {
      const name = prompt("Preset name:") || "";
      if (!name) return;
      const newPreset = {
        name,
        attackMethod,
        packetSize,
        duration,
        packetDelay,
        target,
      };
      const next = [
        newPreset,
        ...presets.filter((p: any) => p.name !== name),
      ].slice(0, 20);
      setPresets(next);
      try {
        localStorage.setItem("miku_presets", JSON.stringify(next));
      } catch (e) {}
      alert("Preset saved");
    } catch (e) {
      console.error(e);
    }
  }

  // Uncomment if needed:
  // function applyPreset(name: string) {
  //   const p = presets.find((x: any) => x.name === name);
  //   if (!p) return;
  //   setAttackMethod(p.attackMethod);
  //   setPacketSize(p.packetSize);
  //   setDuration(p.duration);
  //   setPacketDelay(p.packetDelay);
  //   setTarget(p.target || "");
  //   setSelectedPreset(name);
  // }

  async function fetchHistory() {
    try {
      const res = await fetch("/history");
      const data = await res.json();
      setHistory(data || []);
      setShowHistory(true);
    } catch (e) {
      console.error(e);
      alert("Failed to fetch history");
    }
  }

  async function shutdownServer() {
    const confirm = window.confirm("Are you sure you want to shutdown the server?");
    if (!confirm) return;
    try {
      await fetch("/shutdown", { method: "POST" });
      alert("Server shutdown initiated");
    } catch (e) {
      console.error(e);
      alert("Failed to shutdown server");
    }
  }

  return (
    <div
      className={`w-screen min-h-screen p-8 bg-gradient-to-br ${
        darkMode ? "from-gray-900 to-gray-800" : "from-pink-100 to-blue-100"
      }`}
    >
      <audio ref={audioRef} src="/audio.mp3" />
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-blue-500 rounded-lg flex items-center justify-center text-white font-bold">
              ♫
            </div>
            <div>
              <h1 className="text-3xl font-bold text-pink-500">Miku Miku Beam</h1>
              <p className="text-sm text-gray-500">
                Network Stress Testing Tool
              </p>
            </div>
            <div className="flex items-center gap-2 ml-auto mr-4">
              <div className={`w-3 h-3 rounded-full ${serverConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
              <span className="text-xs font-medium">{serverConnected ? 'Connected' : 'Offline'}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowConfig(true)}
              className="px-3 py-2 rounded bg-slate-800 text-white flex items-center gap-2"
            >
              <ScrollText className="w-4 h-4" /> Config
            </button>
            <button
              onClick={() => {
                fetchHistory();
              }}
              className="px-3 py-2 rounded border"
            >
              History
            </button>
            <button
              onClick={() => setDarkMode((d: any) => !d)}
              className="px-3 py-2 rounded border"
            >
              {darkMode ? "Light" : "Dark"}
            </button>
            <button
              onClick={shutdownServer}
              className="px-3 py-2 rounded bg-red-600 text-white text-sm"
              title="Shutdown the server"
            >
              Shutdown
            </button>
          </div>
        </header>

        <section className="p-4 bg-white dark:bg-gray-900 rounded shadow">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm">Target</label>
              <input
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="w-full px-3 py-2 border rounded"
                placeholder="example.com or http://..."
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                onClick={() => (isAttacking ? stopAttack() : startAttack())}
                className={`px-4 py-2 rounded text-white ${
                  isAttacking ? "bg-red-500" : "bg-pink-500"
                }`}
              >
                {isAttacking ? "Stop" : "Start"}
              </button>
              <button
                onClick={() => startAttack(true)}
                className="px-3 py-2 rounded bg-cyan-500 text-white"
              >
                Quick
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-4 gap-4">
            <div>
              <label className="block text-sm">Method</label>
              <select
                value={attackMethod}
                onChange={(e) => setAttackMethod(e.target.value)}
                className="w-full px-2 py-2 border rounded"
              >
                <option value="http_flood">HTTP/Flood</option>
                <option value="http_bypass">HTTP/Bypass</option>
                <option value="http_slowloris">HTTP/Slowloris</option>
                <option value="https_flood">HTTPS/Flood</option>
                <option value="tcp_flood">TCP/Flood</option>
                <option value="minecraft_ping">Minecraft/Ping</option>
              </select>
            </div>
            <div>
              <label className="block text-sm">Packet Size (kb)</label>
              <input
                type="number"
                value={packetSize}
                onChange={(e) => setPacketSize(Number(e.target.value))}
                className="w-full px-2 py-2 border rounded"
                min={1}
                max={1500}
              />
            </div>
            <div>
              <label className="block text-sm">Duration (s)</label>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full px-2 py-2 border rounded"
                min={1}
                max={3600}
              />
            </div>
            <div>
              <label className="block text-sm">Packet Delay (ms)</label>
              <input
                type="number"
                value={packetDelay}
                onChange={(e) => setPacketDelay(Number(e.target.value))}
                className="w-full px-2 py-2 border rounded"
                min={1}
                max={10000}
              />
            </div>
          </div>

          <div className="mt-3 flex items-center gap-4">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={simulationMode}
                onChange={(e) => setSimulationMode(e.target.checked)}
              />
              <span className="text-sm">Simulation mode (no network traffic)</span>
            </label>
            <button
              onClick={saveCurrentPreset}
              className="ml-auto px-3 py-1 rounded border"
            >
              Save preset
            </button>
          </div>
        </section>

        <section className="grid grid-cols-3 gap-4">
          <div className={`p-4 rounded shadow transition-all ${isAttacking ? 'bg-gradient-to-br from-pink-500 to-pink-600 text-white animate-pulse' : 'bg-white dark:bg-gray-900'}`}>
            <div className={`text-sm flex items-center gap-2 ${isAttacking ? 'text-white' : 'text-pink-600'}`}>
              <Zap className="w-4 h-4" />
              Packets/sec
            </div>
            <div className="text-2xl font-bold">{stats.pps.toLocaleString()}</div>
          </div>
          <div className={`p-4 rounded shadow transition-all ${isAttacking ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white animate-pulse' : 'bg-white dark:bg-gray-900'}`}>
            <div className={`text-sm flex items-center gap-2 ${isAttacking ? 'text-white' : 'text-pink-600'}`}>
              <Bot className="w-4 h-4" />
              Active Bots
            </div>
            <div className="text-2xl font-bold">
              {stats.bots.toLocaleString()}
            </div>
          </div>
          <div className={`p-4 rounded shadow transition-all ${isAttacking ? 'bg-gradient-to-br from-cyan-500 to-cyan-600 text-white animate-pulse' : 'bg-white dark:bg-gray-900'}`}>
            <div className={`text-sm flex items-center gap-2 ${isAttacking ? 'text-white' : 'text-pink-600'}`}>
              <Wifi className="w-4 h-4" />
              Total Packets
            </div>
            <div className="text-2xl font-bold">
              {stats.totalPackets.toLocaleString()}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-white dark:bg-gray-900 rounded shadow">
            <h4 className="font-semibold mb-2">Client Device</h4>
            {clientSpecs ? (
              <div className="text-sm space-y-1">
                <div>
                  <b>User agent:</b> {clientSpecs.userAgent}
                </div>
                <div>
                  <b>Platform:</b> {clientSpecs.platform}
                </div>
                <div>
                  <b>Language:</b> {clientSpecs.language}
                </div>
                <div>
                  <b>CPU cores:</b> {clientSpecs.cores ?? "unknown"}
                </div>
                <div>
                  <b>Device memory (GB):</b> {clientSpecs.deviceMemory ?? "unknown"}
                </div>
                <div>
                  <b>Screen:</b> {clientSpecs.screen}
                </div>
                <div>
                  <b>GPU:</b> {clientSpecs.gpu || "unknown"}
                </div>
              </div>
            ) : (
              <div className="italic text-gray-500">Collecting client specs…</div>
            )}
          </div>

          <div className="p-4 bg-white dark:bg-gray-900 rounded shadow">
            <h4 className="font-semibold mb-2">Server</h4>
            {serverSpecs ? (
              <div className="text-sm space-y-1">
                <div>
                  <b>Platform:</b> {serverSpecs.platform}
                </div>
                <div>
                  <b>Arch:</b> {serverSpecs.arch}
                </div>
                <div>
                  <b>Node:</b> {serverSpecs.nodeVersion}
                </div>
                <div>
                  <b>CPUs:</b> {serverSpecs.cpus}
                </div>
                <div>
                  <b>Total RAM (MB):</b>{" "}
                  {Math.round(serverSpecs.totalMem / 1024 / 1024)}
                </div>
                <div>
                  <b>Free RAM (MB):</b>{" "}
                  {Math.round(serverSpecs.freeMem / 1024 / 1024)}
                </div>
                <div>
                  <b>Uptime (s):</b> {Math.round(serverSpecs.uptime)}
                </div>
              </div>
            ) : (
              <div className="italic text-gray-500">Server info unavailable</div>
            )}
          </div>
        </section>

        <section className="p-4 bg-white dark:bg-gray-900 rounded shadow font-mono text-sm">
          <h4 className="font-semibold mb-2">Logs</h4>
          <div className="max-h-48 overflow-auto">
            {logs.length === 0 ? (
              <div className="italic text-gray-500">No logs yet</div>
            ) : (
              logs.map((l, i) => (
                <div key={i} className="py-1">
                  {l}
                </div>
              ))
            )}
          </div>
        </section>

        {showConfig && (
          <ConfigureProxiesAndAgentsView onClose={() => setShowConfig(false)} />
        )}

        {showHistory && (
          <div className="fixed inset-0 z-50 flex items-start justify-center p-8 bg-black/50">
            <div className="w-[90%] max-h-[80%] overflow-auto bg-white dark:bg-gray-900 text-black dark:text-white rounded-md p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-bold">Attack History</h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowHistory(false)}
                    className="px-3 py-1 rounded bg-gray-200 dark:bg-gray-800"
                  >
                    Close
                  </button>
                </div>
              </div>
              {history.length === 0 ? (
                <div className="italic text-gray-500">No history</div>
              ) : (
                history.slice().reverse().map((h: any, idx: number) => (
                  <div key={idx} className="p-2 border-b last:border-b-0">
                    <div className="text-sm">
                      {new Date(h.timestamp).toLocaleString()} — <b>{h.attackMethod}</b>{" "}
                      {h.target}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {h.status} {h.error ? ` - ${h.error}` : ""}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        <footer className="text-center text-sm text-gray-500">v1.0</footer>
      </div>
    </div>
  );
}

async function gatherClientSpecs() {
  try {
    const userAgent = navigator.userAgent;
    const cores = (navigator as any).hardwareConcurrency || null;
    const deviceMemory = (navigator as any).deviceMemory || null;
    const language = navigator.language;
    const platform = navigator.platform;
    const screenSize = `${window.screen.width}x${window.screen.height}`;

    let gpu: string | null = null;
    try {
      const canvas = document.createElement("canvas");
      const gl =
        canvas.getContext("webgl") ||
        canvas.getContext("experimental-webgl");
      if (gl) {
        const dbg = (gl as any).getExtension("WEBGL_debug_renderer_info");
        if (dbg) gpu = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL);
      }
    } catch (e) {
      // ignore
    }

    return {
      userAgent,
      cores,
      deviceMemory,
      language,
      platform,
      screen: screenSize,
      gpu,
    };
  } catch (e) {
    return null;
  }
}

async function fetchServerSpecs() {
  try {
    const res = await fetch("/server-specs");
    if (!res.ok) throw new Error("no");
    return await res.json();
  } catch (e) {
    return null;
  }
}

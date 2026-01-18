import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Eye,
  Gauge,
  Smartphone,
  Thermometer,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DashboardData {
  fsr?: number | null;
  eyeClose?: boolean | null;
  speed?: number | null;
  serverTime?: number | null;
  [key: string]: any;
}

interface HistoricalEntry {
  timestamp: number;
  data: DashboardData;
}

const API_URL = "https://esp32-server-sage.vercel.app/dashboard";
const MAX_HISTORY_ENTRIES = 50;

export default function Dashboard() {
  const [currentData, setCurrentData] = useState<DashboardData | null>(null);
  const [history, setHistory] = useState<HistoricalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<string>("Never");

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const response = await fetch(API_URL);
        if (!response.ok) {
          throw new Error(`API Error: ${response.status}`);
        }
        const data: DashboardData = await response.json();

        setCurrentData(data);
        setError(null);
        setLastFetched(new Date().toLocaleTimeString());

        // Add to history with timestamp, keep only last 50 entries
        setHistory((prev) => {
          const updated = [
            ...prev,
            {
              timestamp: Date.now(),
              data,
            },
          ];
          // Remove oldest entry if exceeds max
          if (updated.length > MAX_HISTORY_ENTRIES) {
            updated.shift();
          }
          return updated;
        });
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to fetch data";
        setError(errorMessage);
        console.error("Dashboard fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    // Initial fetch only - API calls itself every 5 seconds from server side
    fetchDashboardData();
  }, []);

  const getSafeValue = (value: any, fallback: string = "N/A") => {
    if (value === null || value === undefined) return fallback;
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (typeof value === "number") return value;
    return String(value);
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const DataCard = ({
    icon: Icon,
    label,
    value,
    unit = "",
    status,
  }: {
    icon: React.ReactNode;
    label: string;
    value: any;
    unit?: string;
    status?: "safe" | "warning" | "danger";
  }) => {
    const safeValue = getSafeValue(value);

    const statusColors = {
      safe: "border-green-200 bg-green-50",
      warning: "border-yellow-200 bg-yellow-50",
      danger: "border-red-200 bg-red-50",
    };

  

    return (
      <div
        className={cn(
          "rounded-lg border-2 p-4 sm:p-6 backdrop-blur-sm transition-all duration-300",
          status ? statusColors[status] : "border-slate-200 bg-white"
        )}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-slate-600 font-medium">{label}</p>
            <p className="mt-2 text-2xl sm:text-3xl font-bold text-slate-900">
              {safeValue}
              {unit && <span className="text-lg ml-1">{unit}</span>}
            </p>
          </div>
          <div className="text-slate-400">{Icon}</div>
        </div>
      </div>
    );
  };

  if (error && currentData === null && history.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg p-8 text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            Connection Error
          </h2>
          <p className="text-slate-600 mb-4">
            Unable to connect to the vehicle system. Please ensure the ESP32
            device is online and try again.
          </p>
          <p className="text-sm text-slate-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Header */}
      <header className="border-b border-slate-700 bg-slate-900/50 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg flex items-center justify-center">
                  <Smartphone className="w-6 h-6 sm:w-7 sm:h-7" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-white">
                    Vehicle Safety Dashboard
                  </h1>
                  <p className="text-slate-400 text-xs sm:text-sm mt-1">
                    Real-time monitoring system
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "w-2 h-2 rounded-full animate-pulse",
                    error ? "bg-red-500" : "bg-green-500"
                  )}
                />
                <span className="text-sm text-slate-400">
                  {error ? "Offline" : "Live"}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500">
                Last update: {lastFetched}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Current Data Section */}
        <div className="mb-8 sm:mb-12">
          <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 flex items-center gap-2">
            <Activity className="w-6 h-6" />
            Current Status
          </h2>

          {loading && history.length === 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="h-32 bg-slate-700 rounded-lg animate-pulse"
                />
              ))}
            </div>
          ) : currentData ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              <DataCard
                icon={<Gauge className="w-6 h-6" />}
                label="Vehicle Speed"
                value={currentData.speed ?? "N/A"}
                unit={typeof currentData.speed === "number" ? "km/h" : ""}
                status={
                  typeof currentData.speed === "number" &&
                  currentData.speed > 120
                    ? "warning"
                    : typeof currentData.speed === "number" &&
                        currentData.speed > 150
                      ? "danger"
                      : "safe"
                }
              />

              <DataCard
                icon={<Eye className="w-6 h-6" />}
                label="Driver Alertness"
                value={
                  currentData.eyeClose === null ||
                  currentData.eyeClose === undefined
                    ? "Unknown"
                    : currentData.eyeClose
                      ? "Eyes Closed"
                      : "Alert"
                }
                status={
                  currentData.eyeClose === true
                    ? "danger"
                    : currentData.eyeClose === false
                      ? "safe"
                      : undefined
                }
              />

              <DataCard
                icon={<Thermometer className="w-6 h-6" />}
                label="Force Sensor Reading"
                value={currentData.fsr ?? "N/A"}
                unit={typeof currentData.fsr === "number" ? "units" : ""}
                status={
                  typeof currentData.fsr === "number" &&
                  currentData.fsr > 800
                    ? "warning"
                    : "safe"
                }
              />

              {/* Display additional data fields */}
              {Object.entries(currentData).map(([key, value]) => {
                if (
                  !["fsr", "eyeClose", "speed", "serverTime"].includes(key) &&
                  value !== null &&
                  value !== undefined
                ) {
                  return (
                    <DataCard
                      key={key}
                      icon={<AlertTriangle className="w-6 h-6" />}
                      label={key.charAt(0).toUpperCase() + key.slice(1)}
                      value={getSafeValue(value)}
                    />
                  );
                }
                return null;
              })}
            </div>
          ) : (
            <div className="bg-slate-700/30 border border-slate-600 rounded-lg p-8 text-center">
              <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <p className="text-slate-400">No data available</p>
            </div>
          )}
        </div>

        {/* Historical Data Section */}
        {history.length > 0 && (
          <div>
            <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 flex items-center gap-2">
              <CheckCircle className="w-6 h-6" />
              Historical Data ({history.length} entries)
            </h2>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {history.slice().reverse().map((entry, idx) => (
                <div
                  key={idx}
                  className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 sm:p-4 hover:bg-slate-800 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <p className="text-xs sm:text-sm text-slate-400 font-mono">
                      {formatTime(entry.timestamp)}
                    </p>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {entry.data.speed !== null &&
                        entry.data.speed !== undefined && (
                          <span className="bg-blue-900/50 text-blue-200 px-2 py-1 rounded">
                            Speed: {entry.data.speed}
                          </span>
                        )}
                      {entry.data.eyeClose !== null &&
                        entry.data.eyeClose !== undefined && (
                          <span
                            className={cn(
                              "px-2 py-1 rounded",
                              entry.data.eyeClose
                                ? "bg-red-900/50 text-red-200"
                                : "bg-green-900/50 text-green-200"
                            )}
                          >
                            Eyes: {entry.data.eyeClose ? "Closed" : "Open"}
                          </span>
                        )}
                      {entry.data.fsr !== null &&
                        entry.data.fsr !== undefined && (
                          <span className="bg-purple-900/50 text-purple-200 px-2 py-1 rounded">
                            FSR: {entry.data.fsr}
                          </span>
                        )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-700 bg-slate-900/50 mt-8 sm:mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="text-center text-sm text-slate-400">
            <p>Vehicle Safety Monitoring System • Real-time Data Feed</p>
            <p className="mt-2 text-xs text-slate-500">
              Keeping last 50 entries • Updates every 5 seconds (server-side polling)
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

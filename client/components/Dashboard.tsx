import { useEffect, useState, useRef } from "react";
import {
  Activity,
  AlertTriangle,
  Eye,
  Gauge,
  Smartphone,
  AlertCircle,
  CheckCircle,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DashboardData {
  eyeDrowsy?: boolean | null;
  steerInactive?: boolean | null;
  rpm?: string | number | null;
  rolloverDetected?: boolean | null;
  speed?: number | null;
  serverTime?: number | null;
  [key: string]: any;
}

interface HistoricalEntry {
  timestamp: number;
  data: DashboardData;
}

// Use environment variable or default to the provided URL
const API_URL =
  import.meta.env.VITE_API_URL ||
  "https://esp32-server-sage.vercel.app/dashboard/stream";
const MAX_HISTORY_ENTRIES = 50;
const HISTORY_ADD_INTERVAL = 3000; // Add to history every 3 seconds

// Mock data for testing/fallback
const MOCK_DATA: DashboardData = {
  eyeDrowsy: false,
  steerInactive: false,
  rpm: "2500",
  rolloverDetected: false,
};

// RPM to km/h conversion for 9x9mm DC motor
// Motor specs: 3-6V DC motor, max ~10,000 RPM
// Wheel: 6cm radius (12cm diameter)
// Mechanical efficiency: 70% (30% loss due to friction/resistance)
//
// Formula: Speed (km/h) = (RPM × Wheel_Circumference_m × 60) / 1000 × Efficiency
// Calculation:
//   - Wheel circumference = π × 0.12m = 0.3768m
//   - Base conversion = 0.3768 × 60 / 1000 = 0.0226 km/h per RPM
//   - With 30% waste (70% efficiency): 0.0226 × 0.7 = 0.0158 km/h per RPM
//
// At max 10,000 RPM: ~158 km/h (realistic max with efficiency loss)
// Safe speed threshold: 80 km/h
const rpmToKmh = (rpm: number | string | null): number | null => {
  if (rpm === null || rpm === undefined) return null;
  const rpmNum = typeof rpm === "string" ? parseFloat(rpm) : rpm;
  if (isNaN(rpmNum)) return null;
  // Conversion factor: 0.0158 km/h per RPM (with 30% mechanical loss)
  return Math.round(rpmNum * 0.0158);
};

export default function Dashboard() {
  const [currentData, setCurrentData] = useState<DashboardData | null>(null);
  const [history, setHistory] = useState<HistoricalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<string>("Never");
  const [useMockData, setUseMockData] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const lastHistoryAddRef = useRef<number>(0);

  const addToHistory = (data: DashboardData) => {
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
  };

  const loadData = (data: DashboardData, isMock: boolean = false) => {
    // Calculate speed from RPM
    const calculatedSpeed = rpmToKmh(data.rpm);
    const dataWithSpeed = {
      ...data,
      speed: calculatedSpeed,
    };

    setCurrentData(dataWithSpeed);
    setError(null);
    setLastFetched(new Date().toLocaleTimeString());
    setUseMockData(isMock);

    // Add to history only every 3 seconds (debounce)
    const now = Date.now();
    if (now - lastHistoryAddRef.current >= HISTORY_ADD_INTERVAL) {
      addToHistory(dataWithSpeed);
      lastHistoryAddRef.current = now;
    }
  };

  useEffect(() => {
    let isMounted = true;

    const connectSSE = () => {
      try {
        const eventSource = new EventSource(API_URL);

        eventSource.onopen = () => {
          if (isMounted) {
            setLoading(false);
            setError(null);
          }
        };

        eventSource.onmessage = (event) => {
          if (!isMounted) return;
          try {
            const data: DashboardData = JSON.parse(event.data);
            loadData(data, false);
          } catch (err) {
            console.error("Failed to parse SSE message:", err);
          }
        };

        eventSource.onerror = () => {
          if (isMounted) {
            eventSource.close();
            setError("Connection lost to real-time data stream");
            setLoading(false);
          }
        };

        eventSourceRef.current = eventSource;
      } catch (err) {
        if (isMounted) {
          const errorMessage =
            err instanceof Error ? err.message : "Failed to connect to API";
          setError(errorMessage);
          setLoading(false);
        }
      }
    };

    connectSSE();

    return () => {
      isMounted = false;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
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

  if (error && currentData === null && history.length === 0 && !useMockData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800 rounded-lg p-8 text-center border border-slate-700">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">
            Real-Time Stream Unavailable
          </h2>
          <p className="text-slate-300 mb-4">
            Unable to connect to the real-time data stream. This could mean:
          </p>
          <ul className="text-sm text-slate-400 mb-6 text-left space-y-2 bg-slate-900/50 p-4 rounded">
            <li>• The ESP32 server is offline or unreachable</li>
            <li>• The SSE endpoint is not configured</li>
            <li>• Network connectivity issues</li>
          </ul>
          <p className="text-sm text-red-400 mb-6 font-mono break-all">
            {API_URL}
          </p>
          <p className="text-sm text-slate-400 mb-6">{error}</p>
          <button
            onClick={() => {
              setLoading(false);
              loadData(MOCK_DATA, true);
            }}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors mb-3"
          >
            Use Demo Data
          </button>
          <p className="text-xs text-slate-500">
            Ensure the server is running SSE on the /dashboard/stream endpoint.
          </p>
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
                    error && !useMockData ? "bg-red-500" : useMockData ? "bg-yellow-500" : "bg-green-500"
                  )}
                />
                <span className="text-sm text-slate-400">
                  {error && !useMockData
                    ? "Stream Offline"
                    : useMockData
                      ? "Demo Mode"
                      : "Streaming Live"}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500">
                Last update: {lastFetched}
                {useMockData && " (demo data)"}
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
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-32 bg-slate-700 rounded-lg animate-pulse"
                />
              ))}
            </div>
          ) : currentData ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {/* Vehicle Speed */}
              <DataCard
                icon={<Gauge className="w-6 h-6" />}
                label="Vehicle Speed"
                value={currentData.speed ?? "N/A"}
                unit={typeof currentData.speed === "number" ? "km/h" : ""}
                status={
                  typeof currentData.speed === "number" &&
                  currentData.speed > 120
                    ? "danger"
                    : typeof currentData.speed === "number" &&
                        currentData.speed > 80
                      ? "warning"
                      : "safe"
                }
              />

              {/* Driver Drowsiness */}
              <DataCard
                icon={<Eye className="w-6 h-6" />}
                label="Driver Drowsiness"
                value={
                  currentData.eyeDrowsy === null ||
                  currentData.eyeDrowsy === undefined
                    ? "Unknown"
                    : currentData.eyeDrowsy
                      ? "Drowsy"
                      : "Alert"
                }
                status={
                  currentData.eyeDrowsy === true
                    ? "danger"
                    : currentData.eyeDrowsy === false
                      ? "safe"
                      : undefined
                }
              />

              {/* Steering Activity */}
              <DataCard
                icon={<Activity className="w-6 h-6" />}
                label="Steering Status"
                value={
                  currentData.steerInactive === null ||
                  currentData.steerInactive === undefined
                    ? "Unknown"
                    : currentData.steerInactive
                      ? "Inactive"
                      : "Active"
                }
                status={
                  currentData.steerInactive === true
                    ? "warning"
                    : currentData.steerInactive === false
                      ? "safe"
                      : undefined
                }
              />

              {/* Rollover Detection */}
              <DataCard
                icon={<AlertTriangle className="w-6 h-6" />}
                label="Rollover Detection"
                value={
                  currentData.rolloverDetected === null ||
                  currentData.rolloverDetected === undefined
                    ? "Unknown"
                    : currentData.rolloverDetected
                      ? "Detected"
                      : "Normal"
                }
                status={
                  currentData.rolloverDetected === true
                    ? "danger"
                    : currentData.rolloverDetected === false
                      ? "safe"
                      : undefined
                }
              />

              {/* RPM Display */}
              {currentData.rpm !== null && currentData.rpm !== undefined && (
                <DataCard
                  icon={<Zap className="w-6 h-6" />}
                  label="Engine RPM"
                  value={currentData.rpm}
                  unit="RPM"
                />
              )}
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
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <p className="text-xs sm:text-sm text-slate-400 font-mono">
                      {formatTime(entry.timestamp)}
                    </p>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {entry.data.speed !== null &&
                        entry.data.speed !== undefined && (
                          <span className="bg-blue-900/50 text-blue-200 px-2 py-1 rounded">
                            Speed: {entry.data.speed} km/h
                          </span>
                        )}
                      {entry.data.eyeDrowsy !== null &&
                        entry.data.eyeDrowsy !== undefined && (
                          <span
                            className={cn(
                              "px-2 py-1 rounded",
                              entry.data.eyeDrowsy
                                ? "bg-red-900/50 text-red-200"
                                : "bg-green-900/50 text-green-200"
                            )}
                          >
                            {entry.data.eyeDrowsy ? "Drowsy" : "Alert"}
                          </span>
                        )}
                      {entry.data.steerInactive !== null &&
                        entry.data.steerInactive !== undefined && (
                          <span
                            className={cn(
                              "px-2 py-1 rounded",
                              entry.data.steerInactive
                                ? "bg-yellow-900/50 text-yellow-200"
                                : "bg-green-900/50 text-green-200"
                            )}
                          >
                            {entry.data.steerInactive
                              ? "Steering Inactive"
                              : "Steering Active"}
                          </span>
                        )}
                      {entry.data.rolloverDetected === true && (
                        <span className="bg-red-900/50 text-red-200 px-2 py-1 rounded font-semibold">
                          ⚠️ Rollover!
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
            <p>Vehicle Safety Monitoring System • Real-time Data Stream</p>
            <p className="mt-2 text-xs text-slate-500">
              Live updates every 500ms • Historical data recorded every 3 seconds • Last 50 entries kept
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

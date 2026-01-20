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
}

interface HistoricalEntry {
  timestamp: number;
  data: DashboardData;
}

const API_URL =
  import.meta.env.VITE_API_URL ||
  "https://esp32-server-sage.vercel.app/dashboard/stream";
const MAX_HISTORY_ENTRIES = 50;
const HISTORY_ADD_INTERVAL = 3000;
const CONNECTION_TIMEOUT = 5000;

// Fallback data when server is not responding
const FALLBACK_DATA: DashboardData = {
  eyeDrowsy: false,
  steerInactive: false,
  rpm: "0",
  rolloverDetected: false,
};

// RPM to km/h: 0.0158 factor accounts for 6cm wheel radius + 30% mechanical loss
const rpmToKmh = (rpm: number | string | null): number | null => {
  if (rpm === null || rpm === undefined) return null;
  const rpmNum = typeof rpm === "string" ? parseFloat(rpm) : rpm;
  return isNaN(rpmNum) ? null : Math.round(rpmNum * 0.0158);
};

export default function Dashboard() {
  const [currentData, setCurrentData] = useState<DashboardData | null>(null);
  const [history, setHistory] = useState<HistoricalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string>("Never");
  const eventSourceRef = useRef<EventSource | null>(null);
  const lastHistoryAddRef = useRef<number>(0);
  const connectionEstablishedRef = useRef<boolean>(false);

  // Check if data is valid and not empty
  const isValidData = (data: DashboardData): boolean => {
    return (
      data.speed != null ||
      data.rpm != null ||
      data.eyeDrowsy != null ||
      data.steerInactive != null ||
      data.rolloverDetected != null
    );
  };

  const updateData = (data: DashboardData, isFromFallback: boolean = false) => {
    const calculatedSpeed = rpmToKmh(data.rpm);
    const dataWithSpeed = { ...data, speed: calculatedSpeed };

    setCurrentData(dataWithSpeed);
    setLoading(false);
    setLastUpdate(new Date().toLocaleTimeString());

    // Add to history only if data is valid and NOT from fallback
    if (isValidData(data) && !isFromFallback) {
      const now = Date.now();
      if (now - lastHistoryAddRef.current >= HISTORY_ADD_INTERVAL) {
        setHistory((prev) => {
          const updated = [...prev, { timestamp: now, data: dataWithSpeed }];
          return updated.length > MAX_HISTORY_ENTRIES ? updated.slice(1) : updated;
        });
        lastHistoryAddRef.current = now;
      }
    }
  };

  useEffect(() => {
    let isMounted = true;
    let fallbackTimeout: NodeJS.Timeout;

    const connectSSE = () => {
      try {
        const eventSource = new EventSource(API_URL);

        eventSource.onopen = () => {
          if (isMounted) {
            connectionEstablishedRef.current = true;
            setIsConnected(true);
            setUsingFallback(false);
            if (fallbackTimeout) clearTimeout(fallbackTimeout);
          }
        };

        eventSource.onmessage = (event) => {
          if (!isMounted) return;
          try {
            const data = JSON.parse(event.data);
            // Only update if we received actual data from the API (not empty)
            if (data && typeof data === 'object' && Object.keys(data).length > 0) {
              // Check if all fields are empty/null
              if (!isValidData(data)) {
                // All fields are empty, switch to fallback state
                if (isMounted) {
                  updateData(FALLBACK_DATA, true);
                  setUsingFallback(true);
                }
              } else {
                updateData(data, false);
              }
            }
          } catch (err) {
            console.error("Failed to parse message:", err);
          }
        };

        eventSource.onerror = () => {
          if (isMounted) {
            setIsConnected(false);
            setUsingFallback(true);
            updateData(FALLBACK_DATA, true);
            eventSource.close();
          }
        };

        eventSourceRef.current = eventSource;
      } catch (err) {
        if (isMounted) setIsConnected(false);
      }
    };

    // Fallback to default data if no connection within timeout
    fallbackTimeout = setTimeout(() => {
      if (isMounted && !connectionEstablishedRef.current) {
        updateData(FALLBACK_DATA, true);
        setUsingFallback(true);
        setIsConnected(false);
      }
    }, CONNECTION_TIMEOUT);

    connectSSE();

    return () => {
      isMounted = false;
      clearTimeout(fallbackTimeout);
      eventSourceRef.current?.close();
    };
  }, []);

  const getSpeedStatus = (speed: number | null): "safe" | "warning" | "danger" => {
    if (speed === null) return "safe";
    if (speed > 120) return "danger";
    if (speed > 80) return "warning";
    return "safe";
  };

  const DataCard = ({
    icon,
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
    const statusColors = {
      safe: "border-green-200 bg-green-50",
      warning: "border-yellow-200 bg-yellow-50",
      danger: "border-red-200 bg-red-50",
    };

    const displayValue =
      value === null || value === undefined ? "N/A" : String(value);

    return (
      <div
        className={cn(
          "rounded-lg border-2 p-4 sm:p-6 backdrop-blur-sm transition-all",
          status ? statusColors[status] : "border-slate-200 bg-white"
        )}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-slate-600 font-medium">{label}</p>
            <p className="mt-2 text-2xl sm:text-3xl font-bold text-slate-900">
              {displayValue}
              {unit && <span className="text-lg ml-1">{unit}</span>}
            </p>
          </div>
          <div className="text-slate-400">{icon}</div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Header */}
      <header className="border-b border-slate-700 bg-slate-900/50 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg flex items-center justify-center">
                <Smartphone className="w-6 h-6 sm:w-7 sm:h-7" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold">Vehicle Safety Dashboard</h1>
                <p className="text-slate-400 text-xs sm:text-sm mt-1">Real-time monitoring</p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "w-2 h-2 rounded-full animate-pulse",
                    isConnected ? "bg-green-500" : usingFallback ? "bg-orange-500" : "bg-red-500"
                  )}
                />
                <span className="text-sm text-slate-400">
                  {isConnected ? "Live" : usingFallback ? "Fallback" : "Offline"}
                </span>
              </div>
              <p className="text-xs text-slate-500">Last update: {lastUpdate}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Current Status */}
        <div className="mb-8 sm:mb-12">
          <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 flex items-center gap-2">
            <Activity className="w-6 h-6" />
            Current Status
          </h2>

          {loading && !currentData ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-32 bg-slate-700 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : currentData ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              <DataCard
                icon={<Gauge className="w-6 h-6" />}
                label="Vehicle Speed"
                value={currentData.speed ?? "N/A"}
                unit={typeof currentData.speed === "number" ? "km/h" : ""}
                status={getSpeedStatus(currentData.speed ?? null)}
              />

              <DataCard
                icon={<Eye className="w-6 h-6" />}
                label="Driver Drowsiness"
                value={
                  currentData.eyeDrowsy === null || currentData.eyeDrowsy === undefined
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

              <DataCard
                icon={<Activity className="w-6 h-6" />}
                label="Steering Status"
                value={
                  currentData.steerInactive === null || currentData.steerInactive === undefined
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

              <DataCard
                icon={<AlertTriangle className="w-6 h-6" />}
                label="Rollover Detection"
                value={
                  currentData.rolloverDetected === null || currentData.rolloverDetected === undefined
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

        {/* Historical Data */}
        {history.length > 0 && (
          <div>
            <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 flex items-center gap-2">
              <CheckCircle className="w-6 h-6" />
              Historical Data ({history.length} entries)
            </h2>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {history
                .slice()
                .reverse()
                .map((entry, idx) => (
                  <div
                    key={idx}
                    className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 sm:p-4"
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <p className="text-xs sm:text-sm text-slate-400 font-mono">
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </p>
                      <div className="flex flex-wrap gap-2 text-xs">
                        {entry.data.speed !== null && entry.data.speed !== undefined && (
                          <span className="bg-blue-900/50 text-blue-200 px-2 py-1 rounded">
                            Speed: {entry.data.speed} km/h
                          </span>
                        )}
                        {entry.data.eyeDrowsy !== null && entry.data.eyeDrowsy !== undefined && (
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
                              {entry.data.steerInactive ? "Steering Inactive" : "Steering Active"}
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 text-center text-sm text-slate-400">
          <p>Vehicle Safety Monitoring System</p>
          <p className="mt-2 text-xs text-slate-500">
            Live updates every 500ms • Historical data every 3 seconds • Last 50 entries kept
          </p>
        </div>
      </footer>
    </div>
  );
}

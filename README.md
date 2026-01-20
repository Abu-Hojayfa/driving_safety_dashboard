# Vehicle Safety Dashboard

A real-time vehicle safety monitoring system that displays live telemetry data with intelligent fallback handling and historical data tracking.

## Features

- **Real-time Data Monitoring**: Live updates from vehicle sensors (speed, drowsiness detection, steering status, rollover detection, engine RPM)
- **Smart Fallback System**: Automatically switches to safe default values when API returns empty data
- **Error Handling**: Graceful degradation with clear status indicators (Live, Fallback, Offline)
- **Historical Data Tracking**: Maintains up to 50 entries of vehicle telemetry with 3-second debouncing
- **Data Validation**: Filters out empty JSON responses and invalid data to keep history clean
- **Responsive Design**: Optimized for mobile and desktop viewing
- **Status Indicators**: Color-coded alerts for vehicle conditions (speed warnings, drowsiness, steering issues, rollover detection)

## Tech Stack

- **Frontend**: React 18 + React Router 6 (SPA) + TypeScript
- **Build Tool**: Vite
- **Styling**: TailwindCSS 3 + Radix UI
- **Icons**: Lucide React
- **Testing**: Vitest
- **Package Manager**: PNPM

## Project Structure

```
client/                          # React SPA frontend
├── components/
│   ├── Dashboard.tsx           # Main vehicle monitoring dashboard
│   └── ui/                     # Pre-built UI component library
├── pages/
│   └── Index.tsx               # Home page
├── App.tsx                     # SPA routing setup
└── global.css                  # TailwindCSS theming


shared/                         # Types shared between client & server
└── api.ts                      # Shared interface definitions
```

## Getting Started

### Prerequisites

- Node.js 16+ or higher
- PNPM package manager

### Installation

```bash
# Install dependencies
pnpm install
```

### Development

```bash
# Start the dev server (both client and server)
pnpm dev
```

The application will be available at `http://localhost:8080`

### Build

```bash
# Production build
pnpm build

# Start production server
pnpm start
```

### Testing

```bash
# Run tests with Vitest
pnpm test

# Type checking
pnpm typecheck
```

## Data Flow

### Live Data (API Connected)
1. EventSource receives real-time vehicle telemetry
2. Data is validated (not empty, has at least one field)
3. Current status cards update immediately
4. Valid data is added to historical records (every 3 seconds, max 50 entries)
5. Status indicator shows **Live** (green)

### Empty Response Handling
1. API responds with empty JSON `{}`
2. System detects all fields are null/undefined
3. Automatically switches to **Fallback** state (orange)
4. Safe defaults are displayed (0 km/h, Alert, Active, Normal)
5. Historical data is NOT updated (keeps history clean)

### Connection Error
1. EventSource connection fails or times out
2. System automatically switches to **Fallback** state
3. Safe default values prevent dashboard from appearing broken
4. User sees clear **Fallback** or **Offline** indicator
5. Auto-recovery when connection restores

### No Connection Timeout
1. If no connection established within 5 seconds
2. Falls back to safe default data
3. Shows **Fallback** status with orange indicator

## Dashboard Status Indicators

| Status | Color | Meaning |
|--------|-------|---------|
| **Live** | 🟢 Green | Connected to API, receiving real data |
| **Fallback** | 🟠 Orange | Using default values (empty response or error) |
| **Offline** | 🔴 Red | No connection to API |

## Vehicle Status Cards

### Vehicle Speed
- **Safe**: 0-80 km/h (green)
- **Warning**: 80-120 km/h (yellow)
- **Danger**: 120+ km/h (red)

### Driver Drowsiness
- **Alert**: Driver is awake and focused
- **Drowsy**: Driver fatigue detected
- **Unknown**: Unable to determine

### Steering Status
- **Active**: Driver is actively steering
- **Inactive**: Potential steering issue
- **Unknown**: Unable to determine

### Rollover Detection
- **Normal**: No rollover risk
- **Detected**: Rollover hazard warning
- **Unknown**: Unable to determine

### Engine RPM
- Current engine revolutions per minute
- Converted to km/h for speed calculation using: `rpm × 0.0158`

## Historical Data

- Maintains up to 50 entries of vehicle telemetry
- Updated every 3 seconds (debounced to avoid noise)
- **Only stores valid, real data** - fallback/empty responses are excluded
- Displays timestamp and relevant vehicle status tags
- Automatically scrolls to show newest entries

## Configuration

### API Endpoint
```typescript
const API_URL = import.meta.env.VITE_API_URL || 
  "https://esp32-server-sage.vercel.app/dashboard/stream";
```

Customize via environment variable `VITE_API_URL`

### Timing Parameters
- `CONNECTION_TIMEOUT`: 5000ms - Wait time before triggering fallback
- `HISTORY_ADD_INTERVAL`: 3000ms - Debounce interval for history updates
- `MAX_HISTORY_ENTRIES`: 50 - Maximum historical records kept

## Error Handling

The dashboard implements robust error handling:

1. **Invalid JSON**: Caught and logged, no state update
2. **Empty Response**: Detected and triggers fallback
3. **Connection Error**: Immediately switches to fallback state
4. **All Fields Empty**: Treated as invalid data, fallback activated
5. **Parse Errors**: Logged without crashing

## Deployment

### Netlify
1. Connect via MCP integration
2. Auto-deploys on git push
3. No additional configuration needed

### Vercel
1. Connect via MCP integration
2. Auto-deploys on git push
3. Optimized for Vercel platform

### Other Platforms
```bash
pnpm build
# Deploy the `dist/` folder
```

## Development Notes

### Adding New Vehicle Metrics
1. Update `DashboardData` interface in `client/components/Dashboard.tsx`
2. Add new DataCard component in the grid
3. Update `isValidData()` to include new fields
4. Update historical entry display tags

### Customizing Styling
- Theme colors: `client/global.css`
- TailwindCSS config: `tailwind.config.ts`
- Component styles: TailwindCSS utility classes throughout

### Extending Historical Data
- Modify `MAX_HISTORY_ENTRIES` for more/fewer records
- Adjust `HISTORY_ADD_INTERVAL` for different update frequency
- Add fields to `HistoricalEntry` interface as needed

## Browser Support

- Modern browsers supporting:
  - ES2020+
  - EventSource API
  - CSS Grid and Flexbox
  - CSS custom properties

## License

MIT

## Support

For issues or questions, please open an issue in the repository.

---

**Last Updated**: January 2026  
**Current Version**: 1.0.0

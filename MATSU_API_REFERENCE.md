# Matsu Backend API Reference

## Table of Contents
1. [Authentication](#authentication)
2. [Monitors API](#monitors-api)
3. [Alert Rules API](#alert-rules-api)
4. [Monitor History API](#monitor-history-api)
5. [Data Types](#data-types)
6. [Error Handling](#error-handling)

---

## Authentication

### POST `/api/auth/login`
Authenticate user and get session.

**Request Body:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Response:** `200 OK`
```json
{
  "message": "Login successful",
  "username": "string"
}
```

**Note:** Authentication creates a session cookie. Include this cookie in subsequent requests.

---

## Monitors API

The Monitor System uses a unified formula-based approach. Every monitor is defined by a formula that can reference webhooks, spot prices, or other monitors.

### GET `/api/monitors`
Get all monitors with their current values.

**Response:** `200 OK`
```json
[
  {
    "id": "monitor_abc123",
    "name": "BTC Price Delta",
    "formula": "${spot:binance-BTC} - ${spot:okx-BTC}",
    "unit": "USD",
    "description": "Price difference between Binance and OKX",
    "color": "#3b82f6",
    "decimal_places": 2,
    "enabled": true,
    "value": 125.50,
    "computed_at": "2025-10-16T10:30:00Z",
    "created_at": "2025-10-15T08:00:00Z",
    "updated_at": "2025-10-16T10:30:00Z"
  }
]
```

### GET `/api/monitors/{monitor_id}`
Get a specific monitor with its current value.

**Parameters:**
- `monitor_id` (path): Monitor ID

**Response:** `200 OK` - Same structure as individual monitor object above

### POST `/api/monitors`
Create a new monitor.

**Request Body:**
```json
{
  "name": "SOL/BNSOL Ratio",
  "formula": "${spot:jupiter-SOL/BNSOL}",
  "unit": "",
  "description": "Jupiter SOL to BNSOL exchange rate",
  "color": "#9945ff",
  "decimal_places": 4
}
```

**Response:** `200 OK` - Returns created monitor object

### PUT `/api/monitors/{monitor_id}`
Update a monitor.

**Request Body:** (All fields optional)
```json
{
  "name": "Updated Name",
  "formula": "${spot:binance-BTC} * 2",
  "unit": "%",
  "description": "Updated description",
  "color": "#ff0000",
  "decimal_places": 3,
  "enabled": false
}
```

**Response:** `200 OK` - Returns updated monitor object

### DELETE `/api/monitors/{monitor_id}`
Delete a monitor.

**Response:** `200 OK`
```json
{
  "message": "Monitor deleted successfully"
}
```

### GET `/api/monitors/{monitor_id}/history`
Get historical values for a monitor (for charts).

**Parameters:**
- `monitor_id` (path): Monitor ID
- `limit` (query, optional): Maximum data points (default: 50)
- `hours` (query, optional): Time range in hours (default: 24)

**Response:** `200 OK`
```json
[
  {
    "timestamp": 1697475000000,
    "value": 125.50
  },
  {
    "timestamp": 1697475600000,
    "value": 126.20
  }
]
```

**Note:** Timestamps are in milliseconds (JavaScript format)

---

## Alert Rules API

Alert rules monitor conditions and send Pushover notifications when thresholds are breached.

### GET `/api/alert-rules`
Get all alert rules.

**Response:** `200 OK`
```json
[
  {
    "id": "alert_xyz789",
    "name": "BTC Price Alert",
    "condition": "${monitor:monitor_abc123} > 50000 or ${monitor:monitor_abc123} < 30000",
    "level": "high",
    "enabled": true,
    "cooldown_seconds": 120,
    "actions": ["pushover"],
    "created_at": "2025-10-15T08:00:00Z",
    "updated_at": "2025-10-16T09:00:00Z"
  }
]
```

### GET `/api/alert-rules/by-monitor/{monitor_id}`
Get all alert rules that reference a specific monitor.

**Parameters:**
- `monitor_id` (path): Monitor ID

**Response:** `200 OK` - Array of alert rule objects (same structure as above)

### POST `/api/alert-rules`
Create a new alert rule.

**Request Body:**
```json
{
  "name": "SOL Price Alert",
  "condition": "${monitor:monitor_sol_price} > 200 or ${monitor:monitor_sol_price} < 150",
  "level": "medium",
  "cooldown_seconds": 300,
  "actions": ["pushover"]
}
```

**Alert Levels and Default Cooldowns:**
- `critical`: 30 seconds
- `high`: 120 seconds (2 minutes)
- `medium`: 300 seconds (5 minutes)
- `low`: 900 seconds (15 minutes)

**Response:** `200 OK` - Returns created alert rule object

### PUT `/api/alert-rules/{rule_id}`
Update an alert rule.

**Request Body:** (All fields optional)
```json
{
  "name": "Updated Alert Name",
  "condition": "${monitor:monitor_abc} > 100",
  "level": "critical",
  "enabled": false,
  "cooldown_seconds": 60,
  "actions": ["pushover"]
}
```

**Response:** `200 OK` - Returns updated alert rule object

**Important:** When updating an alert rule:
- If you change the `level`, you may want to update `cooldown_seconds` to match the level's default
- Condition formulas must reference valid monitor IDs using `${monitor:monitor_id}` syntax
- You can combine conditions with `or` and `and` operators

### DELETE `/api/alert-rules/{rule_id}`
Delete an alert rule.

**Response:** `200 OK`
```json
{
  "message": "Alert rule deleted successfully"
}
```

---

## Data Types

### Monitor Object
```typescript
interface Monitor {
  id: string;                    // Unique identifier
  name: string;                  // Display name
  formula: string;               // Computation formula
  unit?: string;                 // Unit of measurement (e.g., "USD", "%")
  description?: string;          // Optional description
  color?: string;                // Hex color code (e.g., "#3b82f6")
  decimal_places: number;        // Number of decimal places to display
  enabled: boolean;              // Whether monitor is active
  value?: number;                // Current computed value
  computed_at?: string;          // ISO timestamp of last computation
  created_at: string;            // ISO timestamp of creation
  updated_at: string;            // ISO timestamp of last update
}
```

### Alert Rule Object
```typescript
interface AlertRule {
  id: string;                    // Unique identifier
  name: string;                  // Display name
  condition: string;             // Formula condition (e.g., "${monitor:id} > 100")
  level: 'critical' | 'high' | 'medium' | 'low';
  enabled: boolean;              // Whether alert is active
  cooldown_seconds: number;      // Seconds between repeated notifications
  actions: string[];             // Array of action types (currently ["pushover"])
  created_at: string;            // ISO timestamp of creation
  updated_at: string;            // ISO timestamp of last update
}
```

### Historical Data Point
```typescript
interface DataPoint {
  timestamp: number;             // Unix timestamp in milliseconds
  value: number;                 // Monitor value at that time
}
```

---

## Formula Syntax

Monitors use formulas to compute values. Available variable types:

### Spot Prices
Reference spot prices from exchanges:
```
${spot:exchange-symbol}
```

**Examples:**
- `${spot:binance-BTC}` - Bitcoin price from Binance
- `${spot:jupiter-SOL/BNSOL}` - SOL to BNSOL ratio from Jupiter
- `${spot:pyth-ETH}` - ETH price from Pyth oracle

**Supported Exchanges:**
- `binance`, `okx`, `bybit` - Centralized exchanges
- `jupiter` - Solana DEX (for LST ratios)
- `pyth` - Oracle prices

**Note:** Symbol case matters! Use exact case: `SOL/JitoSOL` not `SOL/JITOSOL`

### Monitor References
Reference other monitors:
```
${monitor:monitor_id}
```

**Example:**
```
${monitor:monitor_abc123} * 1.05
```

### Webhook Data
Reference webhook data (legacy, but still supported):
```
${webhook:webhook_id}
```

### Arithmetic Operations
Formulas support standard arithmetic:
```
${spot:binance-BTC} - ${spot:okx-BTC}
${monitor:a} * 0.95 + ${monitor:b}
(${spot:binance-BTC} + ${spot:okx-BTC}) / 2
```

---

## Alert Condition Syntax

Alert conditions use comparison operators:

### Basic Comparisons
```
${monitor:id} > 100          # Greater than
${monitor:id} < 50           # Less than
${monitor:id} >= 100         # Greater than or equal
${monitor:id} <= 50          # Less than or equal
${monitor:id} == 100         # Equal to
${monitor:id} != 100         # Not equal to
```

### Logical Operators
Combine multiple conditions:
```
${monitor:id} > 100 or ${monitor:id} < 50        # OR logic
${monitor:id} > 100 and ${monitor:id} < 200      # AND logic
```

### Common Patterns

**Range breach (outside bounds):**
```json
{
  "condition": "${monitor:drift_health} > 50 or ${monitor:drift_health} < 30"
}
```

**Range enforcement (inside bounds):**
```json
{
  "condition": "${monitor:price_ratio} < 0.95 or ${monitor:price_ratio} > 1.05"
}
```

---

## Error Handling

### HTTP Status Codes

- `200 OK` - Successful request
- `201 Created` - Resource created successfully
- `400 Bad Request` - Invalid request data or parameters
- `401 Unauthorized` - Authentication required or invalid credentials
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server-side error

### Error Response Format
```json
{
  "detail": "Error message describing what went wrong"
}
```

### Common Errors

**Authentication Failures:**
```json
{
  "detail": "Invalid credentials"
}
```

**Invalid Monitor Formula:**
```json
{
  "detail": "Failed to evaluate formula: undefined variable ${spot:invalid-SYMBOL}"
}
```

**Invalid Alert Condition:**
```json
{
  "detail": "Monitor monitor_xyz not found"
}
```

**Resource Not Found:**
```json
{
  "detail": "Monitor not found"
}
```

---

## Best Practices

### 1. Monitoring Updates
- Monitors recompute every 10 seconds
- Alert rules check every 10 seconds
- Fetch monitor data at most once every 10-30 seconds to avoid stale data while minimizing requests

### 2. Alert Level Selection
Choose appropriate alert levels based on urgency:
- **critical**: System failures, immediate action required (30s cooldown)
- **high**: Significant issues, action needed soon (2min cooldown)
- **medium**: Important notices, action within hours (5min cooldown)
- **low**: Informational, action optional (15min cooldown)

### 3. Cooldown Configuration
- Use level-appropriate defaults for consistency
- Only customize cooldown if you have specific requirements
- Remember: shorter cooldowns = more notifications = potential notification fatigue

### 4. Formula Design
- Keep formulas simple and readable
- Test formulas by creating monitors first
- Use monitor references for complex calculations (compose monitors)
- Case-sensitive symbols: use exact exchange symbol case

### 5. Condition Design
- Use meaningful threshold values based on historical data
- Consider using OR conditions for range breaches (outside bounds)
- Test conditions by temporarily lowering thresholds

### 6. API Request Patterns
- Cache monitor list locally, refresh periodically
- Fetch history data only when viewing charts
- Group related operations (create monitor + create alert) in sequence
- Handle 404 errors gracefully (resources may be deleted by other clients)

---

## Example: Complete Alert Setup Workflow

### 1. Create a Monitor
```http
POST /api/monitors
Content-Type: application/json

{
  "name": "DRIFT Health",
  "formula": "${webhook:drift_health}",
  "unit": "%",
  "decimal_places": 1,
  "color": "#00ff00"
}
```

**Response:**
```json
{
  "id": "monitor_drift_health_abc",
  "name": "DRIFT Health",
  "value": 45.5,
  ...
}
```

### 2. Create an Alert Rule
```http
POST /api/alert-rules
Content-Type: application/json

{
  "name": "DRIFT Health Alert",
  "condition": "${monitor:monitor_drift_health_abc} > 50 or ${monitor:monitor_drift_health_abc} < 30",
  "level": "high",
  "cooldown_seconds": 120,
  "actions": ["pushover"]
}
```

### 3. Update Alert Threshold
```http
PUT /api/alert-rules/alert_xyz789
Content-Type: application/json

{
  "condition": "${monitor:monitor_drift_health_abc} > 55 or ${monitor:monitor_drift_health_abc} < 25"
}
```

### 4. Disable Alert Temporarily
```http
PUT /api/alert-rules/alert_xyz789
Content-Type: application/json

{
  "enabled": false
}
```

### 5. Re-enable and Change Level
```http
PUT /api/alert-rules/alert_xyz789
Content-Type: application/json

{
  "enabled": true,
  "level": "critical",
  "cooldown_seconds": 30
}
```

---

## Raycast Extension Implementation Notes

### For Listing Monitors
```typescript
// Fetch all monitors
const monitors = await api.getMonitors();

// Filter enabled monitors only
const activeMonitors = monitors.filter(m => m.enabled);

// Sort by alert status
const sorted = activeMonitors.sort((a, b) => {
  const aHasAlert = hasActiveAlert(a.id);
  const bHasAlert = hasActiveAlert(b.id);
  if (aHasAlert && !bHasAlert) return -1;
  if (!aHasAlert && bHasAlert) return 1;
  return 0;
});
```

### For Checking Alert Status
```typescript
// Get alerts for a monitor
const alerts = await api.getAlertRulesByMonitor(monitorId);

// Check if monitor is in alert state
function isInAlertState(monitor: Monitor, rule: AlertRule): boolean {
  if (!rule.enabled || monitor.value == null) return false;

  // Parse condition for thresholds
  const upperMatch = rule.condition.match(/>\s*=?\s*(-?\d+\.?\d*)/);
  const lowerMatch = rule.condition.match(/<\s*=?\s*(-?\d+\.?\d*)/);

  const upper = upperMatch ? parseFloat(upperMatch[1]) : null;
  const lower = lowerMatch ? parseFloat(lowerMatch[1]) : null;

  if (upper !== null && monitor.value > upper) return true;
  if (lower !== null && monitor.value < lower) return true;

  return false;
}
```

### For Updating Alert Levels
```typescript
// Change alert level (cooldown auto-adjusts)
const levelCooldowns = {
  critical: 30,
  high: 120,
  medium: 300,
  low: 900
};

await api.updateAlertRule(alertId, {
  level: newLevel,
  cooldown_seconds: levelCooldowns[newLevel]
});
```

### For Creating Simple Threshold Alerts
```typescript
// Helper to create threshold-based alert
async function createThresholdAlert(
  monitorId: string,
  monitorName: string,
  upper: number | null,
  lower: number | null,
  level: AlertLevel
) {
  const conditions = [];
  if (upper !== null) {
    conditions.push(`\${monitor:${monitorId}} > ${upper}`);
  }
  if (lower !== null) {
    conditions.push(`\${monitor:${monitorId}} < ${lower}`);
  }

  if (conditions.length === 0) {
    throw new Error('At least one threshold required');
  }

  const levelCooldowns = { critical: 30, high: 120, medium: 300, low: 900 };

  return await api.createAlertRule({
    name: monitorName,
    condition: conditions.join(' or '),
    level,
    cooldown_seconds: levelCooldowns[level],
    actions: ['pushover']
  });
}
```

---

## Version History

- **v1.0** (2025-10-16): Initial API reference for Monitor System and Alert Rules

---

## Support

For issues or questions:
- Backend repository: https://github.com/giraphant/matsu
- Raycast extension: https://github.com/giraphant/matsu-companion

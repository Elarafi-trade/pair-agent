# Pair-Agent API Documentation

## Endpoints

### 1. Health Check
**GET** `/health`

Check if the service is running.

**Response:**
```json
{
  "status": "ok",
  "time": "2025-10-22T12:00:00.000Z"
}
```

---

### 2. Get All Trades
**GET** `/api/trades`

Retrieve all trade records from the database.

**Response:**
```json
[
  {
    "id": 1,
    "timestamp": "2025-10-22T12:29:40.659Z",
    "pair": "JUP-PERP/ARB-PERP",
    "action": "SHORT JUP-PERP, LONG ARB-PERP",
    "signal": "SHORT",
    "zScore": 2.22,
    "correlation": 0.92,
    "spread": 0.05,
    "spreadMean": 0.04,
    "spreadStd": 0.005,
    "beta": 0.974,
    "reason": "Spread 2.22σ above mean — expecting reversion downward.",
    "longAsset": "ARB-PERP",
    "shortAsset": "JUP-PERP",
    "longPrice": 0.31,
    "shortPrice": 0.35,
    "status": "open",
    "upnlPct": 0.0
  }
]
```

---

### 3. Get Performance Metrics
**GET** `/api/performance`

Retrieve agent performance statistics.

**Response:**
```json
{
  "totalTrades": 5,
  "openTrades": 4,
  "closedTrades": 1,
  "winningTrades": 0,
  "losingTrades": 1,
  "winRate": 0.0,
  "totalReturnPct": -100.0,
  "avgTradeDurationHours": 2.5,
  "profitFactor": 0.0,
  "estimatedAPY": 0.0,
  "lastUpdated": "2025-10-22T12:30:00.000Z"
}
```

---

### 4. Analyze a Pair (NEW)
**POST** `/api/analyze`

Analyze any Drift Protocol pair on-demand and get detailed analysis report.

**Request Body:**
```json
{
  "symbolA": "SOL-PERP",
  "symbolB": "ETH-PERP",
  "limit": 100
}
```

**Parameters:**
- `symbolA` (required): First symbol (e.g., "SOL-PERP", "BTC-PERP")
- `symbolB` (required): Second symbol (e.g., "ETH-PERP", "DOGE-PERP")
- `limit` (optional): Number of data points to fetch (default: 100)

**Response:**
```json
{
  "pair": "SOL-PERP/ETH-PERP",
  "symbolA": "SOL-PERP",
  "symbolB": "ETH-PERP",
  "dataPoints": 100,
  "analysis": {
    "correlation": 0.9381,
    "beta": 0.831,
    "zScore": 1.14,
    "spreadMean": -3083.1,
    "spreadStd": 49.71,
    "currentSpread": -3026.34,
    "signalType": "neutral"
  },
  "signal": {
    "meetsThreshold": false,
    "action": "NEUTRAL",
    "recommendation": "neutral"
  },
  "narrative": "SOL-PERP/ETH-PERP spread is 1.1σ above mean (-3083.10 ± 49.71), correlation 0.94. No strong signal — spread within normal range.",
  "timestamp": "2025-10-22T12:35:00.000Z"
}
```

**Error Response (400):**
```json
{
  "error": "Missing required fields: symbolA and symbolB are required",
  "example": {
    "symbolA": "SOL-PERP",
    "symbolB": "ETH-PERP",
    "limit": 100
  }
}
```

**Error Response (500):**
```json
{
  "error": "Analysis failed",
  "message": "Failed to fetch TWAP series for INVALID-PERP: Request failed with status code 400 (status 400)"
}
```

---

## Example Usage

### Using cURL

```bash
# Health check
curl https://pair-agent.onrender.com/health

# Get all trades
curl https://pair-agent.onrender.com/api/trades

# Get performance metrics
curl https://pair-agent.onrender.com/api/performance

# Analyze a pair
curl -X POST https://pair-agent.onrender.com/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "symbolA": "BTC-PERP",
    "symbolB": "ETH-PERP",
    "limit": 100
  }'
```

### Using JavaScript/Fetch

```javascript
// Analyze a pair
const response = await fetch('https://pair-agent.onrender.com/api/analyze', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    symbolA: 'SOL-PERP',
    symbolB: 'DOGE-PERP',
    limit: 100
  })
});

const analysis = await response.json();
console.log(analysis);
```

### Using Python

```python
import requests

# Analyze a pair
response = requests.post(
    'https://pair-agent.onrender.com/api/analyze',
    json={
        'symbolA': 'ARB-PERP',
        'symbolB': 'OP-PERP',
        'limit': 100
    }
)

analysis = response.json()
print(analysis)
```

---

## Available Market Pairs

You can analyze any combination of these Drift Protocol perpetual markets:

- SOL-PERP
- BTC-PERP
- ETH-PERP
- 1MPEPE-PERP
- ARB-PERP
- DOGE-PERP
- BNB-PERP
- SUI-PERP
- OP-PERP
- APT-PERP
- LDO-PERP
- XRP-PERP
- JTO-PERP
- SEI-PERP
- PYTH-PERP
- TIA-PERP
- JUP-PERP
- W-PERP
- WIF-PERP
- TNSR-PERP

**Note:** Some markets may not have sufficient historical data and will return an error. The agent automatically filters these during startup.

---

## Rate Limiting

The backend includes rate limiting:
- Max concurrent requests: 4 (default, configurable via `RATE_LIMIT_MAX_CONCURRENCY`)
- Min interval between requests: 100ms (default, configurable via `RATE_LIMIT_MIN_INTERVAL_MS`)

For heavy usage, consider adding delays between requests to avoid hitting Drift API limits.

---

## CORS

All endpoints support CORS with `Access-Control-Allow-Origin: *`, so you can call them from any frontend application.

# Health Checks

## What it is

The template provides health check endpoints for monitoring application status, database connectivity, and system metrics. These endpoints are designed for use with Kubernetes liveness/readiness probes, load balancers, and monitoring systems.

## Where it lives (code map)

- **`backend/src/routes/health.js`** - Health check route handlers
- **`backend/src/config/database.js`** - Database connection checks
- **`backend/src/services/llmService.js`** - LLM provider status
- **`backend/src/websocket/llmHandler.js`** - WebSocket statistics

## How it works

### Health Check Endpoints

1. **`GET /api/v1/health`**: Basic health check with database status
2. **`GET /api/v1/health/detailed`**: Comprehensive health with all services
3. **`GET /api/v1/health/ready`**: Readiness probe (database required)
4. **`GET /api/v1/health/live`**: Liveness probe (always returns 200)

### Status Levels

- **healthy**: All critical services operational
- **degraded**: Some services unavailable but app functional
- **unhealthy**: Critical services down

## How to use it

### Basic Health Check

```javascript
GET /api/v1/health

Response:
{
  "status": "healthy",
  "timestamp": "2024-06-25T10:30:00Z",
  "version": "2.0.0",
  "uptime": 3600,
  "responseTime": "2.45ms",
  "database": {
    "connected": true,
    "poolStats": {
      "totalCount": 5,
      "idleCount": 3,
      "waitingCount": 0
    }
  }
}
```

### Detailed Health Check

```javascript
GET /api/v1/health/detailed

Response:
{
  "status": "healthy",
  "timestamp": "2024-06-25T10:30:00Z",
  "version": "2.0.0",
  "environment": "production",
  "uptime": 3600,
  "responseTime": "5.23ms",
  "services": {
    "database": {
      "status": "healthy",
      "poolStats": {...}
    },
    "llm": {
      "status": "healthy",
      "availableProviders": ["openai", "anthropic"]
    },
    "websocket": {
      "status": "healthy",
      "connections": 42
    }
  },
  "system": {
    "nodeVersion": "v20.10.0",
    "platform": "linux",
    "memory": {
      "heapUsed": "45MB",
      "heapTotal": "128MB",
      "rss": "180MB"
    }
  }
}
```

### Kubernetes Probes

**Readiness**:
```yaml
readinessProbe:
  httpGet:
    path: /api/v1/health/ready
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 10
```

**Liveness**:
```yaml
livenessProbe:
  httpGet:
    path: /api/v1/health/live
    port: 3000
  initialDelaySeconds: 30
  periodSeconds: 10
```

## Configuration

No configuration required. Health checks use existing service status.

## Troubleshooting

### Health check returns 503

- **Check database**: Ensure database is connected (for `/ready`)
- **Check services**: Review detailed health for specific service issues
- **Check logs**: Look for service initialization errors

### Slow health check responses

- **Check database**: Database connection test may be slow
- **Check network**: Database network latency
- **Check pool**: Database pool may be exhausted

## Related docs

- [Database](./database.md) - Database connection
- [Server Configuration](./server-configuration.md) - Service initialization

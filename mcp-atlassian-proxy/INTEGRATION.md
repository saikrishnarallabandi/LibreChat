# Integration Examples

This directory contains examples of how to integrate the MCP Atlassian proxy with LibreChat in different deployment scenarios.

## Example 1: Docker Compose Integration

### Full Stack with Proxy

Create a `docker-compose.full.yml` file:

```yaml
version: '3.8'

services:
  # LibreChat API service
  api:
    container_name: LibreChat
    build:
      context: .
      dockerfile: Dockerfile.dev
    ports:
      - "${PORT}:${PORT}"
    depends_on:
      - mongodb
      - mcp-atlassian-proxy
    environment:
      - HOST=0.0.0.0
      - MONGO_URI=mongodb://mongodb:27017/LibreChat
    volumes:
      - ./.env:/app/.env
      - ./librechat.yaml:/app/librechat.yaml
    networks:
      - librechat

  # MongoDB
  mongodb:
    container_name: chat-mongodb
    image: mongo
    restart: always
    volumes:
      - ./data-node:/data/db
    command: mongod --noauth
    networks:
      - librechat

  # MCP Atlassian Proxy
  mcp-atlassian-proxy:
    container_name: mcp-atlassian-proxy
    build:
      context: ./mcp-atlassian-proxy
      dockerfile: Dockerfile
    ports:
      - "3001:3001"
    environment:
      - HOST=0.0.0.0
      - PORT=3001
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s
    restart: unless-stopped
    networks:
      - librechat

networks:
  librechat:
    driver: bridge
```

### Usage

```bash
# Start all services
docker-compose -f docker-compose.full.yml up -d

# Check proxy health
curl http://localhost:3001/health

# View logs
docker-compose -f docker-compose.full.yml logs -f mcp-atlassian-proxy
```

## Example 2: Kubernetes Deployment

### Proxy Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mcp-atlassian-proxy
spec:
  replicas: 1
  selector:
    matchLabels:
      app: mcp-atlassian-proxy
  template:
    metadata:
      labels:
        app: mcp-atlassian-proxy
    spec:
      containers:
      - name: proxy
        image: mcp-atlassian-proxy:latest
        ports:
        - containerPort: 3001
        env:
        - name: HOST
          value: "0.0.0.0"
        - name: PORT
          value: "3001"
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: mcp-atlassian-proxy-service
spec:
  selector:
    app: mcp-atlassian-proxy
  ports:
  - protocol: TCP
    port: 3001
    targetPort: 3001
  type: ClusterIP
```

### LibreChat Configuration for Kubernetes

```yaml
# librechat.yaml
mcpServers:
  atlassian:
    type: sse
    url: http://mcp-atlassian-proxy-service:3001/mcp
    timeout: 60000
    customUserVars:
      jira_pat:
        title: "Jira Personal Access Token"
        description: "Your Jira PAT for accessing Jira Data Center"
      confluence_pat:
        title: "Confluence Personal Access Token"
        description: "Your Confluence PAT for accessing Confluence Data Center"
      atlassian_url:
        title: "Atlassian Data Center URL"
        description: "Your Atlassian Data Center URL"
```

## Example 3: Development Setup

### Local Development with Existing LibreChat

If you have LibreChat already running locally:

1. **Start the proxy separately:**
   ```bash
   cd mcp-atlassian-proxy
   python3 universal_proxy.py
   ```

2. **Update librechat.yaml:**
   ```yaml
   mcpServers:
     atlassian:
       type: sse
       url: http://localhost:3001/mcp
       timeout: 60000
       customUserVars:
         jira_pat:
           title: "Jira Personal Access Token"
           description: "Your Jira PAT"
         confluence_pat:
           title: "Confluence Personal Access Token"
           description: "Your Confluence PAT"
         atlassian_url:
           title: "Atlassian URL"
           description: "Your Atlassian Data Center URL"
   ```

3. **Restart LibreChat to pick up the configuration**

## Example 4: Production Deployment

### Security Considerations

For production deployments, consider:

1. **Use HTTPS/TLS:**
   ```yaml
   # Add TLS termination at load balancer or reverse proxy
   mcp-atlassian-proxy:
     environment:
       - USE_HTTPS=true
       - SSL_CERT_PATH=/certs/cert.pem
       - SSL_KEY_PATH=/certs/key.pem
   ```

2. **Add authentication middleware:**
   ```yaml
   # Add API key authentication
   mcp-atlassian-proxy:
     environment:
       - API_KEY=${MCP_API_KEY}
   ```

3. **Resource limits:**
   ```yaml
   mcp-atlassian-proxy:
     deploy:
       resources:
         limits:
           memory: 512M
           cpus: '0.5'
         reservations:
           memory: 256M
           cpus: '0.25'
   ```

### High Availability Setup

```yaml
version: '3.8'

services:
  mcp-atlassian-proxy:
    deploy:
      replicas: 2
      update_config:
        parallelism: 1
        delay: 10s
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
        window: 120s
  
  # Load balancer
  proxy-lb:
    image: nginx:alpine
    ports:
      - "3001:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - mcp-atlassian-proxy
```

## Environment Variables Reference

### Proxy Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | `0.0.0.0` | Server bind address |
| `PORT` | `3001` | Server port |
| `MCP_ATLASSIAN_PATH` | `npx` | Path to mcp-atlassian executable |
| `LOG_LEVEL` | `INFO` | Logging level |

### LibreChat Integration

The proxy automatically handles these headers from LibreChat's customUserVars:

| Header | Source Variable | Description |
|--------|----------------|-------------|
| `X-Jira-PAT` | `jira_pat` | Jira Personal Access Token |
| `X-Confluence-PAT` | `confluence_pat` | Confluence Personal Access Token |
| `X-Atlassian-URL` | `atlassian_url` | Atlassian Data Center URL |
| `X-User-ID` | Auto-generated | User identifier for logging |

## Monitoring and Logging

### Health Checks

```bash
# Basic health check
curl http://localhost:3001/health

# Detailed status with tools list
curl -X POST http://localhost:3001/mcp/tools/list \
  -H "X-Jira-PAT: your_jira_pat" \
  -H "X-Confluence-PAT: your_confluence_pat" \
  -H "X-Atlassian-URL: https://your-company.atlassian.net"
```

### Log Aggregation

For production, consider using log aggregation:

```yaml
mcp-atlassian-proxy:
  logging:
    driver: "fluentd"
    options:
      fluentd-address: "localhost:24224"
      tag: "mcp.atlassian.proxy"
```

## Troubleshooting Common Issues

### Connection Timeouts

Increase timeout values:

```yaml
mcpServers:
  atlassian:
    timeout: 120000  # 2 minutes
```

### Memory Issues

Monitor container memory usage:

```bash
docker stats mcp-atlassian-proxy
```

### Network Issues

Check connectivity between services:

```bash
# From LibreChat container
docker exec -it LibreChat curl http://mcp-atlassian-proxy:3001/health
```
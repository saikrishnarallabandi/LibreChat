# MCP Atlassian Integration Guide for LibreChat

This guide walks you through integrating the MCP Atlassian Universal Proxy with LibreChat to enable multi-user access to Jira and Confluence tools.

## Overview

The integration provides:
- **Multi-user support**: Each user can have their own Jira and Confluence Personal Access Tokens (PATs)
- **Universal routing**: Support for all current and future MCP Atlassian tools
- **Secure token handling**: User tokens are passed via HTTP headers and not stored
- **Scalable architecture**: Process pooling for concurrent users
- **LibreChat compatibility**: Seamless integration with existing MCP system

## Prerequisites

- LibreChat v0.7.8 or higher
- Python 3.8+
- Node.js 16+
- Docker (optional, for containerized deployment)
- Atlassian Data Center with API access

## Quick Start

### 1. Deploy the Proxy

**Option A: Docker (Recommended)**
```bash
# From LibreChat root directory
cd mcp-atlassian-proxy
docker-compose up -d
```

**Option B: Local Development**
```bash
cd mcp-atlassian-proxy
./setup.sh
python3 universal_proxy.py
```

### 2. Configure LibreChat

Edit your `librechat.yaml`:

```yaml
version: 1.2.1

mcpServers:
  atlassian:
    type: streamable_http
    url: http://mcp-atlassian-proxy:8001  # Use localhost:8001 for local deployment
    timeout: 30000
    headers:
      X-Jira-PAT: "{{jira_pat}}"
      X-Confluence-PAT: "{{confluence_pat}}"
    customUserVars:
      jira_pat:
        title: "Jira Personal Access Token"
        description: "Your personal access token for Jira Data Center"
      confluence_pat:
        title: "Confluence Personal Access Token"
        description: "Your personal access token for Confluence Data Center"
    serverInstructions: |
      Use these tools to interact with Jira and Confluence. You can:
      - Search and view Jira issues
      - Create and update Jira issues
      - Search and view Confluence pages
      - Create and update Confluence content
```

### 3. Configure User Tokens

Users need to set up their PATs in LibreChat:

1. Go to **Settings** → **MCP Servers**
2. Find **Atlassian** configuration
3. Enter your **Jira Personal Access Token**
4. Enter your **Confluence Personal Access Token**
5. Save the configuration

## Detailed Setup

### Generate Personal Access Tokens

**For Jira Data Center:**
1. Go to your Jira instance → Profile → Personal Access Tokens
2. Create a new token with appropriate permissions
3. Copy the token (you won't see it again)

**For Confluence Data Center:**
1. Go to your Confluence instance → Profile → Personal Access Tokens
2. Create a new token with appropriate permissions
3. Copy the token (you won't see it again)

### Environment Configuration

Create a `.env` file in the `mcp-atlassian-proxy` directory:

```env
# Server configuration
HOST=0.0.0.0
PORT=8001
LOG_LEVEL=info

# Docker port mapping
MCP_PROXY_PORT=8001
```

### Docker Integration with LibreChat

To integrate the proxy with LibreChat's Docker setup, uncomment the proxy service in the main `docker-compose.yml`:

```yaml
services:
  # ... existing services ...

  mcp-atlassian-proxy:
    build:
      context: ./mcp-atlassian-proxy
      dockerfile: Dockerfile
    container_name: mcp-atlassian-proxy
    ports:
      - "${MCP_PROXY_PORT:-8001}:8001"
    environment:
      - HOST=0.0.0.0
      - PORT=8001
      - LOG_LEVEL=${LOG_LEVEL:-info}
    restart: unless-stopped
    networks:
      - default
```

Then update your LibreChat configuration to use the container name:

```yaml
mcpServers:
  atlassian:
    url: http://mcp-atlassian-proxy:8001
    # ... rest of configuration
```

## Available Tools

The proxy provides access to various Atlassian tools depending on the MCP package used:

### Jira Tools
- Search issues using JQL
- Get issue details
- Create new issues
- Update existing issues
- List projects
- Get project details

### Confluence Tools
- Search pages and spaces
- Get page content
- Create new pages
- Update existing pages
- List spaces

## Testing the Integration

### 1. Test the Proxy
```bash
cd mcp-atlassian-proxy
python3 test_proxy.py
```

### 2. Test in LibreChat
1. Start a new conversation
2. Ask something like: "List my recent Jira issues"
3. The AI should be able to use the Jira tools to search for issues

### 3. Verify Logs
Check the proxy logs to ensure requests are being processed:
```bash
# Docker deployment
docker logs mcp-atlassian-proxy

# Local deployment
# Check the console output where you started the proxy
```

## Troubleshooting

### Common Issues

**1. Proxy won't start**
- Check Python and Node.js versions
- Ensure all dependencies are installed
- Check for port conflicts (default: 8001)

**2. Authentication errors**
- Verify PAT tokens are correct and not expired
- Check token permissions in Atlassian
- Ensure tokens are properly configured in LibreChat settings

**3. Connection errors**
- Verify the proxy URL in LibreChat configuration
- Check network connectivity between LibreChat and proxy
- Ensure proxy is running and healthy (`/health` endpoint)

**4. Tool not found errors**
- Verify the MCP Atlassian package is installed
- Check proxy logs for package installation errors
- Try restarting the proxy

### Debug Mode

Enable debug logging by setting `LOG_LEVEL=debug` in your environment:

```env
LOG_LEVEL=debug
```

This will provide detailed information about:
- MCP process management
- Request/response payloads
- Token presence (without exposing values)
- Process lifecycle events

### Health Monitoring

The proxy provides a health check endpoint:

```bash
curl http://localhost:8001/health
```

Response:
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "active_processes": 2
}
```

## Security Considerations

### Token Security
- PATs are passed via HTTP headers, not stored permanently
- Each user's tokens are isolated to their own MCP process
- Tokens are only exposed to the specific MCP Atlassian process

### Network Security
- Use HTTPS in production environments
- Restrict network access to the proxy service
- Consider using a reverse proxy for additional security

### Process Isolation
- Each user/token combination gets its own MCP process
- Processes are automatically cleaned up when idle
- Failed processes are automatically restarted

## Production Deployment

### Docker Swarm
```yaml
version: '3.8'
services:
  mcp-atlassian-proxy:
    image: your-registry/mcp-atlassian-proxy:latest
    deploy:
      replicas: 2
      resources:
        limits:
          memory: 512M
        reservations:
          memory: 256M
```

### Kubernetes
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mcp-atlassian-proxy
spec:
  replicas: 2
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
        image: your-registry/mcp-atlassian-proxy:latest
        ports:
        - containerPort: 8001
        env:
        - name: LOG_LEVEL
          value: "info"
```

### Load Balancing
The proxy is stateless and can be scaled horizontally. Each instance manages its own process pool.

## Future Enhancements

Potential improvements for the integration:

1. **Token Vault Integration**: Store tokens in HashiCorp Vault or similar
2. **Caching Layer**: Cache responses for improved performance
3. **Metrics Collection**: Prometheus metrics for monitoring
4. **Rate Limiting**: Protect against abuse
5. **Token Rotation**: Automatic token refresh

## Support

For issues and questions:

1. Check the [troubleshooting section](#troubleshooting)
2. Review proxy logs for error details
3. Test the proxy independently using the test script
4. Verify LibreChat MCP configuration
5. Open an issue with detailed logs and configuration

## Contributing

To contribute improvements:

1. Fork the repository
2. Create a feature branch
3. Test your changes thoroughly
4. Submit a pull request with detailed description

The integration is designed to be extensible and maintainable for future MCP Atlassian package updates.
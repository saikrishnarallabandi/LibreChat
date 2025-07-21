# MCP Atlassian Universal Proxy for LibreChat

This directory contains a FastAPI-based proxy server that enables multi-user support for mcp-atlassian integration with LibreChat. The proxy allows each user to have their own Personal Access Tokens (PATs) for Atlassian Data Center (Jira and Confluence) while providing a unified interface for all mcp-atlassian tools.

## Features

- **Multi-user PAT support**: Each user can provide their own Jira and Confluence PATs via HTTP headers
- **Universal routing**: Single endpoint handles all mcp-atlassian tools dynamically
- **Secure token injection**: PATs are injected at runtime via environment variables
- **Docker containerized**: Easy deployment alongside LibreChat
- **Health monitoring**: Built-in health check endpoint

## Quick Start

### 1. Build and Run with Docker Compose

From the LibreChat root directory:

```bash
# Build and start all services including the proxy
docker-compose up -d

# Or start just the proxy service
docker-compose up -d mcp-atlassian-proxy
```

### 2. Configure LibreChat

Add the following to your `librechat.yaml` file:

```yaml
mcpServers:
  atlassian:
    type: sse
    url: http://mcp-atlassian-proxy:3001/mcp
    timeout: 60000
    customUserVars:
      jira_pat:
        title: "Jira Personal Access Token"
        description: "Your Jira PAT for accessing Jira Data Center"
      confluence_pat:
        title: "Confluence Personal Access Token"
        description: "Your Confluence PAT for accessing Confluence Data Center"
      atlassian_url:
        title: "Atlassian URL"
        description: "Your Atlassian Data Center URL (e.g., https://company.atlassian.net)"
```

### 3. User Configuration

Users will need to provide their credentials in LibreChat:
1. Go to Settings → Tools
2. Find the "atlassian" MCP server
3. Enter their Jira PAT, Confluence PAT, and Atlassian URL

## API Endpoints

The proxy provides several endpoints:

- `GET /health` - Health check
- `POST /mcp/tools/call` - Call any mcp-atlassian tool
- `POST /mcp/tools/list` - List available tools
- `POST /mcp/initialize` - Initialize MCP session
- `POST /mcp/{method}` - Universal handler for any MCP method

## HTTP Headers

The proxy accepts the following headers for user-specific configuration:

- `X-Jira-PAT`: User's Jira Personal Access Token
- `X-Confluence-PAT`: User's Confluence Personal Access Token
- `X-Atlassian-URL`: User's Atlassian Data Center URL
- `X-User-ID`: User identifier (for logging)

## Environment Variables

- `HOST`: Server host (default: 0.0.0.0)
- `PORT`: Server port (default: 3001)
- `MCP_ATLASSIAN_PATH`: Path to mcp-atlassian executable (auto-detected)

## Development

### Local Development

1. Install Python dependencies:
```bash
cd mcp-atlassian-proxy
pip install -r requirements.txt
```

2. Install mcp-atlassian:
```bash
npm install -g mcp-atlassian
```

3. Run the proxy:
```bash
python universal_proxy.py
```

### Testing

Test the health endpoint:
```bash
curl http://localhost:3001/health
```

Test tool listing (with example headers):
```bash
curl -X POST http://localhost:3001/mcp/tools/list \
  -H "X-Jira-PAT: your_jira_pat" \
  -H "X-Confluence-PAT: your_confluence_pat" \
  -H "X-Atlassian-URL: https://your-company.atlassian.net" \
  -H "X-User-ID: test-user"
```

## Security Considerations

- PATs are passed via HTTP headers and environment variables
- The proxy runs as a non-root user in Docker
- Consider using HTTPS in production
- Implement additional authentication/authorization as needed
- Future integration with Vault or database for centralized token storage

## Architecture

```
LibreChat → MCP Manager → HTTP Request → Proxy Server → mcp-atlassian
                           (with user PATs in headers)
```

The proxy:
1. Receives HTTP requests from LibreChat's MCP manager
2. Extracts user PATs from HTTP headers
3. Injects PATs into environment variables
4. Calls the mcp-atlassian package
5. Returns the response to LibreChat

## Troubleshooting

### Common Issues

1. **mcp-atlassian not found**: Ensure Node.js and npm are installed, and mcp-atlassian is globally available
2. **Connection timeout**: Check if the proxy service is running and accessible
3. **Invalid PAT**: Verify the PATs are correct and have appropriate permissions

### Logs

View proxy logs:
```bash
docker-compose logs -f mcp-atlassian-proxy
```

### Health Check

The proxy includes a health check endpoint that can be used to verify it's running:
```bash
curl http://localhost:3001/health
```

## Future Enhancements

- Integration with HashiCorp Vault for secure token storage
- Database-backed user credential management
- Rate limiting and request throttling
- Metrics and monitoring
- Support for additional Atlassian products
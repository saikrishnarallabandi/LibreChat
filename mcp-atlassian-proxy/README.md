# MCP Atlassian Universal Proxy

A FastAPI-based universal proxy server for multi-user MCP Atlassian integration with LibreChat. This proxy enables each user to have their own Personal Access Tokens (PATs) for Atlassian Data Center (Jira and Confluence) while providing a scalable and secure system for dynamic tool access.

## Features

- **Multi-User Support**: Each user can have their own PATs for Jira and Confluence
- **Dynamic Token Injection**: User-specific tokens are injected at runtime via HTTP headers
- **Universal Routing**: Single flexible route supports all current and future mcp-atlassian tools
- **LibreChat Integration**: Seamlessly integrates with LibreChat's MCP system
- **Secure**: No modifications to the mcp-atlassian library required
- **Scalable**: Designed for deployment in multi-user environments

## Quick Start

### Option 1: Docker Compose (Recommended)

1. **Build and run the proxy:**
   ```bash
   cd mcp-atlassian-proxy
   docker-compose up -d
   ```

2. **Configure LibreChat** to use the proxy (see Integration section below)

### Option 2: Standalone Docker

1. **Build the image:**
   ```bash
   cd mcp-atlassian-proxy
   docker build -t mcp-atlassian-proxy .
   ```

2. **Run the container:**
   ```bash
   docker run -d \
     --name mcp-atlassian-proxy \
     -p 8001:8001 \
     mcp-atlassian-proxy
   ```

### Option 3: Local Development

1. **Install dependencies:**
   ```bash
   cd mcp-atlassian-proxy
   pip install -r requirements.txt
   ```

2. **Install Node.js and mcp-atlassian:**
   ```bash
   npm install -g mcp-atlassian
   ```

3. **Run the proxy:**
   ```bash
   python universal_proxy.py
   ```

## Configuration

### Environment Variables

- `HOST`: Host to bind to (default: `0.0.0.0`)
- `PORT`: Port to listen on (default: `8001`)
- `LOG_LEVEL`: Logging level (default: `info`)
- `MCP_PROXY_PORT`: External port for Docker Compose (default: `8001`)

### Health Check

The proxy provides a health check endpoint at `/health` that returns:
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "mcp_status": "running"
}
```

## API Usage

### Authentication

The proxy accepts user PATs via HTTP headers:
- `X-Jira-PAT`: Personal Access Token for Jira
- `X-Confluence-PAT`: Personal Access Token for Confluence

### Endpoints

#### Universal Proxy Endpoint
```
POST /mcp/{method_name}
```

This endpoint accepts any MCP method name and forwards it to mcp-atlassian:

**Example: List Tools**
```bash
curl -X POST http://localhost:8001/mcp/tools/list \
  -H "Content-Type: application/json" \
  -H "X-Jira-PAT: your-jira-pat" \
  -H "X-Confluence-PAT: your-confluence-pat" \
  -d '{"id": 1, "params": {}}'
```

**Example: Call Tool**
```bash
curl -X POST http://localhost:8001/mcp/tools/call \
  -H "Content-Type: application/json" \
  -H "X-Jira-PAT: your-jira-pat" \
  -d '{
    "id": 1,
    "params": {
      "name": "jira-search-issues",
      "arguments": {
        "jql": "project = DEMO"
      }
    }
  }'
```

#### Dedicated Tool Endpoints

For convenience, commonly used endpoints are also available:

- `POST /mcp/tools/call` - Call a specific tool
- `POST /mcp/tools/list` - List available tools

## LibreChat Integration

### Configuration in librechat.yaml

Add the following to your `librechat.yaml` file:

```yaml
version: 1.2.1

mcpServers:
  atlassian:
    type: streamable_http  # Use streamable HTTP transport
    url: http://mcp-atlassian-proxy:8001  # URL of the proxy server
    timeout: 30000  # 30 second timeout
    customUserVars:
      jira_pat:
        title: "Jira Personal Access Token"
        description: "Your personal access token for Jira"
      confluence_pat:
        title: "Confluence Personal Access Token"
        description: "Your personal access token for Confluence"
    serverInstructions: "Use these tools to interact with Jira and Confluence. Provide your PATs in the user settings."
```

### User Configuration

Users need to configure their PATs in LibreChat:

1. Go to LibreChat Settings → MCP Servers
2. Find "Atlassian" configuration
3. Enter your Jira and Confluence Personal Access Tokens
4. Save the configuration

### How It Works

1. User configures their PATs in LibreChat settings
2. When a tool is called, LibreChat sends the request to the proxy with user PATs in headers
3. The proxy starts mcp-atlassian with the user's tokens injected as environment variables
4. The proxy forwards the request to mcp-atlassian and returns the response
5. LibreChat receives the response and displays it to the user

## Security Considerations

- **Token Storage**: User PATs are passed via HTTP headers and injected into environment variables temporarily
- **Process Isolation**: Each request spawns a new mcp-atlassian process with user-specific tokens
- **Network Security**: Use HTTPS in production and restrict network access appropriately
- **Future Enhancements**: Consider integration with centralized token storage (Vault, database)

## Architecture

```
LibreChat → MCP Atlassian Proxy → mcp-atlassian → Atlassian APIs
     ↑              ↑                    ↑              ↑
  User PATs    Token Injection     Authenticated    Jira/Confluence
   via UI       via Headers         Requests         APIs
```

## Development

### Running Tests

```bash
# Install test dependencies
pip install pytest httpx

# Run tests (when implemented)
pytest
```

### Building for Production

```bash
# Build optimized Docker image
docker build -t mcp-atlassian-proxy:production .

# Or use multi-stage build for smaller image
docker build -f Dockerfile.prod -t mcp-atlassian-proxy:prod .
```

## Troubleshooting

### Common Issues

1. **mcp-atlassian not found**
   - Ensure Node.js is installed
   - Install mcp-atlassian: `npm install -g mcp-atlassian`

2. **Authentication errors**
   - Verify PAT tokens are valid
   - Check that headers are being sent correctly

3. **Connection timeouts**
   - Increase timeout in configuration
   - Check network connectivity

### Logs

Check proxy logs for detailed error information:
```bash
# Docker logs
docker logs mcp-atlassian-proxy

# Local development
python universal_proxy.py  # logs to console
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is part of LibreChat and follows the same licensing terms.
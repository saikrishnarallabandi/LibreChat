# MCP Atlassian Universal Proxy

A FastAPI-based universal proxy server for multi-user MCP Atlassian integration with LibreChat. This proxy enables each user to have their own Personal Access Tokens (PATs) for Atlassian Data Center (Jira and Confluence) while providing a scalable and secure system for dynamic tool access.

## 🎯 Key Features

- **Multi-User Support**: Each user can have their own PATs for Jira and Confluence
- **Dynamic Token Injection**: User-specific tokens are injected at runtime via HTTP headers
- **Universal Routing**: Single flexible route supports all current and future mcp-atlassian tools
- **LibreChat Integration**: Seamlessly integrates with LibreChat's MCP system via streamable-http transport
- **Secure**: No modifications to the mcp-atlassian library required
- **Scalable**: Process pooling for concurrent users with automatic cleanup
- **Production Ready**: Docker support with health checks and monitoring

## 🚀 Quick Start

### Option 1: Docker Compose (Recommended)

1. **Build and run the proxy:**
   ```bash
   cd mcp-atlassian-proxy
   docker-compose up -d
   ```

2. **Configure LibreChat** (see [Integration Guide](./INTEGRATION.md))

### Option 2: Local Development

1. **Setup and start:**
   ```bash
   cd mcp-atlassian-proxy
   ./setup.sh
   python3 universal_proxy.py
   ```

2. **Test the setup:**
   ```bash
   python3 test_proxy.py
   ```

## 📚 Documentation

- **[Integration Guide](./INTEGRATION.md)** - Complete setup guide for LibreChat integration
- **[Setup Script](./setup.sh)** - Automated setup for local development
- **[Docker Support](./docker-compose.yml)** - Container deployment configuration
- **[Environment Config](./.env.example)** - Configuration options

## 🏗️ Architecture

```
LibreChat → MCP Atlassian Proxy → mcp-atlassian → Atlassian APIs
     ↑              ↑                    ↑              ↑
  User PATs    Token Injection     Authenticated    Jira/Confluence
   via UI       via Headers         Requests         APIs
```

### How It Works

1. **User Configuration**: Users configure their PATs in LibreChat settings
2. **Request Processing**: LibreChat sends MCP requests to the proxy with user PATs in headers
3. **Process Management**: The proxy creates/reuses MCP processes with user-specific tokens
4. **Tool Execution**: Requests are forwarded to mcp-atlassian with injected authentication
5. **Response Handling**: Results are returned to LibreChat and displayed to the user

## 🔧 Configuration

### LibreChat Integration

Add this to your `librechat.yaml`:

```yaml
mcpServers:
  atlassian:
    type: streamable_http
    url: http://mcp-atlassian-proxy:8001
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

### Environment Variables

- `HOST`: Host to bind to (default: `0.0.0.0`)
- `PORT`: Port to listen on (default: `8001`)
- `LOG_LEVEL`: Logging level (default: `info`)
- `MCP_PROXY_PORT`: External port for Docker Compose (default: `8001`)

## 🛠️ Available Tools

The proxy provides access to various Atlassian tools:

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

## 📊 API Endpoints

### Main MCP Endpoint
```
POST /
Content-Type: application/json
X-Jira-PAT: your-jira-token
X-Confluence-PAT: your-confluence-token

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list",
  "params": {}
}
```

### Health Check
```
GET /health

Response:
{
  "status": "healthy",
  "version": "1.0.0", 
  "active_processes": 2
}
```

## 🔒 Security

### Token Handling
- User PATs are passed via HTTP headers, not stored permanently
- Each user's tokens are isolated to their own MCP process
- Processes are automatically cleaned up when idle
- No token persistence or logging

### Network Security
- CORS enabled for LibreChat integration
- Use HTTPS in production
- Consider reverse proxy for additional security
- Restrict network access appropriately

## 🧪 Testing

### Test the Proxy
```bash
python3 test_proxy.py
```

### Manual Testing
```bash
# Health check
curl http://localhost:8001/health

# List tools (requires valid PATs)
curl -X POST http://localhost:8001/ \
  -H "Content-Type: application/json" \
  -H "X-Jira-PAT: your-jira-pat" \
  -d '{"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}'
```

## 📈 Production Deployment

### Docker Production
```bash
# Build production image
docker build -f Dockerfile.prod -t mcp-atlassian-proxy:prod .

# Run with resource limits
docker run -d \
  --name mcp-atlassian-proxy \
  --memory=512m \
  --cpus=1.0 \
  -p 8001:8001 \
  mcp-atlassian-proxy:prod
```

### Health Monitoring
The proxy includes health checks and process monitoring:
- Automatic cleanup of dead processes
- Health endpoint for load balancer checks
- Process lifecycle logging
- Graceful shutdown handling

## 🐛 Troubleshooting

### Common Issues

1. **Proxy won't start**: Check Python/Node.js versions and dependencies
2. **Authentication errors**: Verify PAT tokens and permissions
3. **Connection errors**: Check proxy URL and network connectivity
4. **Tool not found**: Verify MCP package installation

### Debug Mode
```bash
LOG_LEVEL=debug python3 universal_proxy.py
```

### Logs
```bash
# Docker logs
docker logs mcp-atlassian-proxy

# Process information
curl http://localhost:8001/health
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is part of LibreChat and follows the same licensing terms.

## 🙏 Acknowledgments

- [LibreChat](https://github.com/danny-avila/LibreChat) - The open-source ChatGPT alternative
- [MCP SDK](https://github.com/modelcontextprotocol/typescript-sdk) - Model Context Protocol implementation
- [atlassian-mcp](https://www.npmjs.com/package/atlassian-mcp) - MCP server for Atlassian integration

---

For detailed setup instructions, see the [Integration Guide](./INTEGRATION.md).
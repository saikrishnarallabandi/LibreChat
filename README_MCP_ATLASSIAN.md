# MCP Atlassian Multi-User Integration for LibreChat

This implementation provides seamless multi-user support for mcp-atlassian in LibreChat through a FastAPI proxy server that dynamically handles user-specific Personal Access Tokens (PATs).

## 🏗️ Architecture Overview

```
┌─────────────┐    HTTP/SSE    ┌─────────────────┐    stdio    ┌─────────────────┐
│  LibreChat  │ ──────────────► │ FastAPI Proxy   │ ──────────► │ mcp-atlassian   │
│   (Client)  │                │   (universal_   │             │   (per user)    │
│             │                │    proxy.py)    │             │                 │
└─────────────┘                └─────────────────┘             └─────────────────┘
       │                               │                               │
       │ User: alice                   │ Manages instances             │ Instance: alice
       │ X-Jira-PAT: alice_token       │ - User authentication         │ ENV: JIRA_PAT=alice_token
       │ X-Confluence-PAT: alice_conf  │ - Instance lifecycle          │      CONFLUENCE_PAT=alice_conf
       │                               │ - Auto cleanup                │
       │                               │                               │
       │ User: bob                     │                               │ Instance: bob  
       │ X-Jira-PAT: bob_token         │                               │ ENV: JIRA_PAT=bob_token
       │ X-Confluence-PAT: bob_conf    │                               │      CONFLUENCE_PAT=bob_conf
```

## 🚀 Quick Start

### 1. Prerequisites
- Docker and Docker Compose
- LibreChat (existing setup)
- Atlassian Cloud account with API access

### 2. Deploy the Integration

```bash
# Clone or update your LibreChat repository with this integration
cd LibreChat

# Start the complete stack including the MCP proxy
docker-compose up -d

# Verify the proxy is running
curl http://localhost:8080/health
```

### 3. Configure LibreChat

Add to your `librechat.yaml`:

```yaml
mcpServers:
  atlassian:
    type: sse
    url: http://mcp_proxy:8080/mcp
    timeout: 60000
    headers:
      X-User-ID: "{{LIBRECHAT_USER_ID}}"
      X-Jira-PAT: "{{JIRA_PAT}}"
      X-Confluence-PAT: "{{CONFLUENCE_PAT}}"
    customUserVars:
      JIRA_PAT:
        title: "Jira Personal Access Token"
        description: "Your Jira PAT for accessing Jira APIs"
      CONFLUENCE_PAT:
        title: "Confluence Personal Access Token"
        description: "Your Confluence PAT for accessing Confluence APIs"
    iconPath: /atlassian-icon.svg
    serverInstructions: true
```

### 4. User Setup

Each user needs to:
1. Generate Atlassian API tokens: https://id.atlassian.com/manage-profile/security/api-tokens
2. Configure their PATs in LibreChat MCP settings
3. Start using Jira and Confluence tools in conversations

## 🔧 Components

### Files Added/Modified

| File | Purpose |
|------|---------|
| `universal_proxy.py` | FastAPI proxy server for multi-user mcp-atlassian |
| `Dockerfile.proxy` | Container definition for the proxy |
| `requirements.txt` | Python dependencies |
| `docker-compose.yml` | Updated with mcp_proxy service |
| `librechat.example.yaml` | Example MCP configuration |
| `.env.example` | Updated with MCP_PROXY_PORT variable |
| `docs/mcp-atlassian-integration.md` | Comprehensive documentation |
| `test_integration.sh` | Validation script for setup |
| `test_functionality.py` | Functional testing script |

### Key Features

✅ **Multi-User Support**: Each user gets isolated mcp-atlassian instances
✅ **Dynamic Authentication**: PATs passed via HTTP headers  
✅ **Auto-Cleanup**: Idle instances removed after 15 minutes
✅ **Security**: No persistent token storage, user isolation
✅ **Scalability**: Stateless proxy design
✅ **Zero Dependencies**: No changes to mcp-atlassian library

## 🔐 Security Model

### Token Handling
- PATs transmitted via HTTP headers only
- No persistent storage of credentials
- User-specific environment isolation
- Automatic cleanup of idle sessions

### Network Security
- Proxy runs in isolated Docker container
- Internal Docker network communication
- No external token exposure

### Access Control
- User-specific MCP instances
- LibreChat user ID mapping
- Resource limits and timeouts

## 🛠️ Available Tools

### Jira Tools
- `jira_search` - Search for Jira issues
- `jira_create_issue` - Create new issues
- `jira_get_issue` - Get issue details
- `jira_update_issue` - Update issue fields
- `jira_add_comment` - Add comments to issues

### Confluence Tools  
- `confluence_search` - Search content
- `confluence_get_page` - Get page content
- `confluence_create_page` - Create new pages
- `confluence_update_page` - Update pages
- `confluence_add_comment` - Add page comments

## 🧪 Testing

### Integration Test
```bash
# Run the integration test
./test_integration.sh
```

### Functional Test
```bash
# Test proxy functionality (requires Python dependencies)
python3 test_functionality.py
```

### Manual Testing
```bash
# Test health endpoint
curl http://localhost:8080/health

# Test tools listing (with fake tokens - will fail as expected)
curl -X GET http://localhost:8080/tools \
  -H "X-User-ID: test-user" \
  -H "X-Jira-PAT: fake-token" \
  -H "X-Confluence-PAT: fake-token"
```

## 📊 Monitoring

### Health Checks
```bash
# Proxy health
curl http://localhost:8080/health

# Active instances
curl http://localhost:8080/

# User status
curl http://localhost:8080/users/USER_ID/status
```

### Logs
```bash
# Proxy logs
docker logs -f mcp_proxy

# LibreChat MCP logs
docker logs -f LibreChat | grep MCP
```

## 🎯 Example Usage

### 1. Search Jira Issues
**User message**: "Show me all open bugs assigned to me in project ABC"

**Result**: The proxy will use the user's Jira PAT to search and return matching issues.

### 2. Create Confluence Page
**User message**: "Create a meeting notes page for today's standup"

**Result**: A new Confluence page is created using the user's Confluence PAT.

### 3. Update Jira Issue
**User message**: "Update ABC-123 status to In Progress and add comment about current work"

**Result**: The issue is updated with user-specific authentication.

## 🔧 Configuration Options

### Environment Variables
```bash
# Proxy port (default: 8080)
MCP_PROXY_PORT=8080

# Docker Compose variables
UID=1000
GID=1000
PORT=3080
```

### Proxy Settings
- **Instance Timeout**: 15 minutes of inactivity
- **Request Timeout**: 60 seconds (configurable in LibreChat)
- **Cleanup Interval**: 5 minutes

## 🚨 Troubleshooting

### Common Issues

#### Proxy Won't Start
```bash
# Check Python dependencies
pip install -r requirements.txt

# Check Docker build
docker build -f Dockerfile.proxy -t mcp-proxy .
```

#### Authentication Failures
- Verify Atlassian PATs are valid
- Check PAT permissions in Atlassian
- Ensure headers are configured in LibreChat

#### Connection Issues
```bash
# Test network connectivity
docker exec LibreChat curl http://mcp_proxy:8080/health

# Check proxy logs
docker logs mcp_proxy
```

#### Performance Issues
- Monitor active instances: `curl http://localhost:8080/`
- Check cleanup intervals in logs
- Verify resource limits

## 🔄 Development

### Local Development
```bash
# Install dependencies
pip install -r requirements.txt

# Run proxy locally
python universal_proxy.py --log-level debug

# Test with curl
curl http://localhost:8080/health
```

### Extending the Proxy
- Add new endpoints in `universal_proxy.py`
- Modify instance management logic
- Add monitoring and metrics
- Implement caching if needed

## 📋 Production Considerations

### Scaling
- Deploy multiple proxy instances behind a load balancer
- Use Redis for shared state management
- Implement health checks and auto-recovery

### Security
- Use HTTPS in production
- Implement rate limiting
- Add audit logging
- Consider token encryption at rest

### Monitoring
- Add Prometheus metrics
- Set up alerts for failures
- Monitor resource usage
- Track user activity

## 🤝 Contributing

### Development Guidelines
1. Follow existing code style
2. Add comprehensive logging
3. Include type hints
4. Write tests for new features
5. Update documentation

### Testing
- Run integration tests before submitting
- Test with real Atlassian instances
- Verify security boundaries
- Check performance impact

## 📚 References

- [LibreChat MCP Documentation](https://www.librechat.ai/docs/configuration/librechat_yaml/object_structure/mcp_servers)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [mcp-atlassian](https://github.com/ruzicka02/mcp-atlassian)
- [Atlassian API](https://developer.atlassian.com/cloud/jira/platform/rest/v3/)

## 📄 License

This integration follows the same license as LibreChat.
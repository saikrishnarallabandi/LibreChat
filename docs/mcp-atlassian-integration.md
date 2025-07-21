# MCP Atlassian Multi-User Integration

This integration provides multi-user support for mcp-atlassian in LibreChat through a FastAPI proxy server that handles user-specific Personal Access Tokens (PATs) dynamically.

## Architecture

```
LibreChat → FastAPI Proxy → mcp-atlassian instances (per user)
```

The proxy server:
- Accepts user-specific PATs via HTTP headers
- Dynamically spawns and manages mcp-atlassian instances per user
- Provides MCP protocol endpoints that LibreChat can connect to
- Maintains security without modifying the mcp-atlassian library

## Components

### 1. FastAPI Proxy Server (`universal_proxy.py`)
- **Purpose**: Acts as a multi-user gateway to mcp-atlassian
- **Features**:
  - Dynamic user instance management
  - PAT-based authentication via headers
  - Automatic cleanup of idle instances
  - Universal tool routing
  - Health monitoring

### 2. Docker Configuration
- **Dockerfile.proxy**: Containerizes the FastAPI server
- **docker-compose.yml**: Updated to include the proxy service
- **requirements.txt**: Python dependencies for the proxy

### 3. LibreChat Configuration
- **librechat.example.yaml**: Updated with example mcpServers configuration

## Setup Instructions

### 1. Prerequisites
- Docker and Docker Compose
- LibreChat setup (existing)
- Atlassian Cloud account with API access

### 2. Configuration

#### Step 2.1: Environment Variables
Add to your `.env` file:
```bash
# MCP Proxy Port (optional, defaults to 8080)
MCP_PROXY_PORT=8080
```

#### Step 2.2: LibreChat Configuration
Update your `librechat.yaml` file:

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

### 3. Deployment

#### Option A: Using Docker Compose (Recommended)
```bash
# Start all services including the MCP proxy
docker-compose up -d

# Check proxy health
curl http://localhost:8080/health
```

#### Option B: Standalone Proxy
```bash
# Build the proxy image
docker build -f Dockerfile.proxy -t mcp-atlassian-proxy .

# Run the proxy
docker run -d -p 8080:8080 --name mcp-proxy mcp-atlassian-proxy
```

### 4. User Setup

#### Step 4.1: Generate Atlassian API Tokens
1. **Jira PAT**: Go to https://id.atlassian.com/manage-profile/security/api-tokens
2. **Confluence PAT**: Use the same token or generate a separate one
3. Copy the generated tokens

#### Step 4.2: Configure User Variables in LibreChat
1. Navigate to LibreChat Settings
2. Go to MCP Servers configuration
3. Enter your PATs in the respective fields:
   - `JIRA_PAT`: Your Jira Personal Access Token
   - `CONFLUENCE_PAT`: Your Confluence Personal Access Token

## Usage

### Available Tools
The proxy provides access to all mcp-atlassian tools, including:

- **Jira Tools**:
  - `jira_search`: Search for Jira issues
  - `jira_create_issue`: Create new Jira issues
  - `jira_get_issue`: Get details of a specific issue
  - `jira_update_issue`: Update issue fields
  - `jira_add_comment`: Add comments to issues

- **Confluence Tools**:
  - `confluence_search`: Search Confluence content
  - `confluence_get_page`: Get page content
  - `confluence_create_page`: Create new pages
  - `confluence_update_page`: Update existing pages
  - `confluence_add_comment`: Add comments to pages

### Example Usage in LibreChat

1. **Search Jira Issues**:
   ```
   Please search for all open bugs assigned to me in project ABC
   ```

2. **Create Confluence Page**:
   ```
   Create a new Confluence page titled "Meeting Notes" with today's meeting summary
   ```

3. **Update Jira Issue**:
   ```
   Update issue ABC-123 to set status to "In Progress" and add a comment about the current progress
   ```

## API Reference

### Proxy Endpoints

#### Health Check
```http
GET /health
```
Returns the health status of the proxy server.

#### List Tools
```http
GET /tools
X-User-ID: user123
X-Jira-PAT: your-jira-pat
X-Confluence-PAT: your-confluence-pat
```
Returns available tools from mcp-atlassian.

#### Call Tool
```http
POST /tools/call
X-User-ID: user123
X-Jira-PAT: your-jira-pat
X-Confluence-PAT: your-confluence-pat

{
  "name": "jira_search",
  "arguments": {
    "query": "project = ABC AND status = Open"
  }
}
```

#### User Instance Status
```http
GET /users/{user_id}/status
```
Returns the status of a user's MCP instance.

#### Stop User Instance
```http
DELETE /users/{user_id}
```
Stops and removes a user's MCP instance.

### Headers

| Header | Required | Description |
|--------|----------|-------------|
| `X-User-ID` | No | User identifier (defaults to "default") |
| `X-Jira-PAT` | Yes* | Jira Personal Access Token |
| `X-Confluence-PAT` | Yes* | Confluence Personal Access Token |

*At least one PAT is required.

## Security Considerations

### Token Security
- PATs are passed via headers and not stored permanently
- Each user gets an isolated mcp-atlassian instance
- Instances are automatically cleaned up after 15 minutes of inactivity
- No modifications to the original mcp-atlassian library

### Network Security
- The proxy runs in an isolated container
- Communication between LibreChat and proxy is internal to Docker network
- User credentials are not shared between instances

### Access Control
- User-specific instances ensure data isolation
- Automatic cleanup prevents resource exhaustion
- Health monitoring for service reliability

## Troubleshooting

### Common Issues

#### 1. Proxy Not Starting
```bash
# Check proxy logs
docker logs mcp_proxy

# Verify requirements.txt dependencies
pip install -r requirements.txt
```

#### 2. Authentication Failures
- Verify your Atlassian PATs are valid
- Check that PATs have appropriate permissions
- Ensure headers are correctly configured in LibreChat

#### 3. Connection Issues
```bash
# Test proxy connectivity
curl http://localhost:8080/health

# Check if proxy is reachable from LibreChat container
docker exec LibreChat curl http://mcp_proxy:8080/health
```

#### 4. Instance Management Issues
```bash
# Check active instances
curl http://localhost:8080/

# Force stop a user instance
curl -X DELETE http://localhost:8080/users/USER_ID
```

### Logs and Monitoring

#### Proxy Logs
```bash
# View proxy logs
docker logs -f mcp_proxy

# Check proxy health
curl http://localhost:8080/health
```

#### LibreChat MCP Logs
Check LibreChat logs for MCP-related messages:
```bash
docker logs -f LibreChat | grep MCP
```

## Development

### Running in Development Mode

#### Prerequisites
- Python 3.11+
- Node.js and npm
- mcp-atlassian package

#### Setup
```bash
# Install Python dependencies
pip install -r requirements.txt

# Run proxy in development mode
python universal_proxy.py --log-level debug

# Test the proxy
curl http://localhost:8080/health
```

### Testing

#### Unit Tests
```bash
# Install test dependencies
pip install pytest pytest-asyncio httpx

# Run tests (when implemented)
pytest tests/
```

#### Integration Tests
```bash
# Test with real Atlassian instance
python test_integration.py
```

## Scaling and Production

### Production Deployment
- Use environment variables for configuration
- Set up proper logging and monitoring
- Consider using a process manager like systemd or PM2
- Implement backup and recovery procedures

### Performance Considerations
- Instance cleanup intervals can be adjusted
- Resource limits can be set in Docker configuration
- Consider using Redis for instance state management in multi-server setups

### Multi-Server Setup
For high availability:
1. Deploy multiple proxy instances
2. Use a load balancer
3. Implement shared state management
4. Set up health checks and failover

## Contributing

### Code Structure
- `universal_proxy.py`: Main FastAPI application
- `Dockerfile.proxy`: Container definition
- `requirements.txt`: Python dependencies
- `docker-compose.yml`: Service orchestration

### Development Guidelines
1. Follow PEP 8 for Python code
2. Add type hints for all functions
3. Include comprehensive logging
4. Write tests for new features
5. Update documentation

## License

This integration follows the same license terms as LibreChat.

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review LibreChat MCP documentation
3. Open an issue in the LibreChat repository
4. Join the LibreChat community for discussions
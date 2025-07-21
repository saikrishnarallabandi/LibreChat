# Testing the MCP Atlassian Proxy Integration

This document describes how to test the MCP Atlassian proxy integration with LibreChat.

## Prerequisites

1. Docker and docker-compose installed
2. LibreChat repository cloned
3. Node.js and npm installed (for mcp-atlassian)

## Testing Steps

### 1. Set up the Proxy Service

```bash
# Navigate to the proxy directory
cd mcp-atlassian-proxy

# Start the proxy service
./start.sh
```

The start script will:
- Build the Docker image
- Start the proxy service on port 3001
- Wait for the service to be ready
- Show status and next steps

### 2. Test the Proxy Directly

```bash
# Test health check
curl http://localhost:3001/health

# Test with sample headers (will fail without valid credentials)
curl -X POST http://localhost:3001/mcp/tools/list \
  -H "X-Jira-PAT: test_pat" \
  -H "X-Confluence-PAT: test_pat" \
  -H "X-Atlassian-URL: https://test.atlassian.net" \
  -H "X-User-ID: test-user"
```

### 3. Configure LibreChat

Update your `librechat.yaml` with the proxy configuration:

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
        title: "Atlassian Data Center URL"
        description: "Your Atlassian Data Center URL (e.g., https://company.atlassian.net)"
```

### 4. Start LibreChat

```bash
# From LibreChat root directory
docker-compose up -d
```

### 5. Test Integration

1. Open LibreChat in your browser
2. Go to Settings → Tools
3. You should see an "atlassian" MCP server configuration
4. Fill in your actual Jira PAT, Confluence PAT, and Atlassian URL
5. Create a new conversation
6. Try using Atlassian tools (they should now appear in the tool selection)

## Expected Behavior

### With Valid Credentials

- The proxy should successfully connect to mcp-atlassian
- Tools like `search_jira_issues`, `create_jira_issue`, `search_confluence_pages` should be available
- Users can interact with their Jira and Confluence instances

### With Invalid/Missing Credentials

- Health check should still pass
- Tool listing may fail or return empty results
- Tool calls should return appropriate error messages

## Troubleshooting

### Proxy Not Starting

```bash
# Check Docker logs
docker-compose logs mcp-atlassian-proxy

# Verify port is not in use
netstat -tlnp | grep 3001

# Try rebuilding
docker-compose build mcp-atlassian-proxy
```

### LibreChat Not Connecting to Proxy

1. Verify the proxy is running: `curl http://localhost:3001/health`
2. Check LibreChat logs for MCP-related errors
3. Ensure the URL in librechat.yaml matches the proxy address
4. For Docker deployments, use `http://mcp-atlassian-proxy:3001/mcp`

### mcp-atlassian Errors

1. Verify mcp-atlassian is installed in the proxy container
2. Check that PATs have correct permissions
3. Ensure Atlassian URL is accessible from the proxy container

## Verification Script

Run the included test script:

```bash
cd mcp-atlassian-proxy
python3 test_proxy.py
```

This will verify:
- Health check endpoint
- MCP initialization
- Tool listing
- Basic tool call functionality

## Security Notes

- PATs are transmitted via HTTP headers
- Use HTTPS in production environments
- Consider implementing additional authentication
- Monitor logs for security issues
- PATs are only injected at runtime and not persisted by the proxy
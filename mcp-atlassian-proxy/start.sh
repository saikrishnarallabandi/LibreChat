#!/bin/bash
# Startup script for MCP Atlassian Proxy

set -e

echo "=== MCP Atlassian Proxy Setup ==="

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo "Error: Docker is not installed or not in PATH"
    exit 1
fi

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    echo "Error: docker-compose is not installed or not in PATH"
    exit 1
fi

echo "✓ Docker and docker-compose are available"

# Build and start the proxy service
echo "Building and starting MCP Atlassian Proxy..."

cd "$(dirname "$0")"

# Build the Docker image
echo "Building Docker image..."
docker build -t mcp-atlassian-proxy .

# Start the service
echo "Starting the proxy service..."
docker-compose up -d

# Wait for the service to be ready
echo "Waiting for service to be ready..."
max_attempts=30
attempt=0

while [ $attempt -lt $max_attempts ]; do
    if curl -f http://localhost:3001/health >/dev/null 2>&1; then
        echo "✓ Service is ready!"
        break
    fi
    attempt=$((attempt + 1))
    echo "  Waiting... ($attempt/$max_attempts)"
    sleep 2
done

if [ $attempt -eq $max_attempts ]; then
    echo "✗ Service did not start within timeout"
    echo "Check logs with: docker-compose logs mcp-atlassian-proxy"
    exit 1
fi

echo "=== Setup Complete ==="
echo "Proxy is running on http://localhost:3001"
echo "Health check: curl http://localhost:3001/health"
echo "Logs: docker-compose logs -f mcp-atlassian-proxy"
echo ""
echo "Next steps:"
echo "1. Update your librechat.yaml with the configuration from librechat.example.yaml"
echo "2. Restart LibreChat to load the new MCP server configuration"
echo "3. Users can now configure their Atlassian PATs in LibreChat settings"
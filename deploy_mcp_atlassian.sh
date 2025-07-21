#!/bin/bash
# MCP Atlassian Integration Deployment Script

set -e

echo "🚀 MCP Atlassian Integration Deployment"
echo "======================================="
echo

# Check if we're in the right directory
if [ ! -f "universal_proxy.py" ] || [ ! -f "docker-compose.yml" ]; then
    echo "❌ Error: Please run this script from the LibreChat root directory"
    echo "   Expected files: universal_proxy.py, docker-compose.yml"
    exit 1
fi

# Step 1: Validate the integration
echo "📋 Step 1: Validating integration setup..."
if ! ./test_integration.sh > /dev/null 2>&1; then
    echo "❌ Integration validation failed. Running detailed check..."
    ./test_integration.sh
    exit 1
fi
echo "✅ Integration validation passed"
echo

# Step 2: Check for .env file
echo "📋 Step 2: Checking environment configuration..."
if [ ! -f ".env" ]; then
    echo "⚠️  No .env file found. Would you like to create one from .env.example? (y/n)"
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        cp .env.example .env
        echo "✅ Created .env from .env.example"
        echo "📝 Please edit .env file to configure your settings before continuing"
        echo "   Key variables to set:"
        echo "   - PORT (default: 3080)"
        echo "   - MONGO_URI"
        echo "   - UID and GID (for file permissions)"
        echo "   - MCP_PROXY_PORT (default: 8080)"
        echo
        echo "Press Enter when you've configured .env..."
        read -r
    else
        echo "❌ .env file is required for deployment"
        exit 1
    fi
else
    echo "✅ .env file found"
fi
echo

# Step 3: Check Docker
echo "📋 Step 3: Checking Docker setup..."
if ! command -v docker > /dev/null 2>&1; then
    echo "❌ Docker is not installed or not in PATH"
    echo "   Please install Docker: https://docs.docker.com/get-docker/"
    exit 1
fi

if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running"
    echo "   Please start Docker daemon"
    exit 1
fi

# Check for docker-compose or docker compose
DOCKER_COMPOSE_CMD=""
if command -v docker-compose > /dev/null 2>&1; then
    DOCKER_COMPOSE_CMD="docker-compose"
elif docker compose version > /dev/null 2>&1; then
    DOCKER_COMPOSE_CMD="docker compose"
else
    echo "❌ Docker Compose is not available"
    echo "   Please install Docker Compose"
    exit 1
fi

echo "✅ Docker is ready (using: $DOCKER_COMPOSE_CMD)"
echo

# Step 4: Deploy the services
echo "📋 Step 4: Deploying services..."
echo "Building and starting containers..."

if $DOCKER_COMPOSE_CMD up -d --build; then
    echo "✅ Services deployed successfully"
else
    echo "❌ Deployment failed"
    echo "Checking logs..."
    $DOCKER_COMPOSE_CMD logs --tail=20
    exit 1
fi
echo

# Step 5: Health checks
echo "📋 Step 5: Running health checks..."

# Wait for services to start
echo "Waiting for services to start..."
sleep 10

# Check LibreChat
if docker ps | grep -q LibreChat; then
    echo "✅ LibreChat container is running"
else
    echo "❌ LibreChat container is not running"
    $DOCKER_COMPOSE_CMD logs LibreChat --tail=10
fi

# Check MCP Proxy
if docker ps | grep -q mcp_proxy; then
    echo "✅ MCP Proxy container is running"
    
    # Test proxy health endpoint
    MCP_PORT=$(grep "MCP_PROXY_PORT" .env | cut -d'=' -f2 | tr -d ' ' || echo "8080")
    for i in {1..10}; do
        if curl -s "http://localhost:${MCP_PORT}/health" > /dev/null 2>&1; then
            echo "✅ MCP Proxy is healthy and responding"
            break
        elif [ $i -eq 10 ]; then
            echo "⚠️  MCP Proxy is running but not responding to health checks"
            echo "   This may be normal if dependencies are still installing"
        else
            echo "   Waiting for MCP Proxy to be ready... ($i/10)"
            sleep 3
        fi
    done
else
    echo "❌ MCP Proxy container is not running"
    $DOCKER_COMPOSE_CMD logs mcp_proxy --tail=10
fi

# Check other services
for service in mongodb meilisearch rag_api; do
    if docker ps | grep -q "$service"; then
        echo "✅ $service container is running"
    else
        echo "⚠️  $service container is not running"
    fi
done
echo

# Step 6: Configuration instructions
echo "📋 Step 6: Configuration instructions"
echo "======================================"
echo
echo "🎉 Deployment completed! Here's what to do next:"
echo
echo "1. 📝 Configure LibreChat:"
echo "   - Add the MCP Atlassian configuration to your librechat.yaml"
echo "   - See librechat.example.yaml for the exact configuration"
echo
echo "2. 🔑 Set up Atlassian API tokens:"
echo "   - Go to: https://id.atlassian.com/manage-profile/security/api-tokens"
echo "   - Generate tokens for Jira and/or Confluence"
echo "   - Keep these tokens secure!"
echo
echo "3. 👤 Configure user credentials in LibreChat:"
echo "   - Go to LibreChat settings > MCP Servers"
echo "   - Enter your Jira PAT and Confluence PAT"
echo "   - Each user needs to configure their own tokens"
echo
echo "4. 🧪 Test the integration:"
echo "   - Try commands like: 'Search for open bugs in project ABC'"
echo "   - Or: 'Create a Confluence page with meeting notes'"
echo
echo "📚 Documentation:"
echo "   - Quick start: README_MCP_ATLASSIAN.md"
echo "   - Full guide: docs/mcp-atlassian-integration.md"
echo
echo "🔍 Monitoring:"

# Get the actual port from .env or use default
LIBRECHAT_PORT=$(grep "^PORT=" .env | cut -d'=' -f2 | tr -d ' ' || echo "3080")
MCP_PORT=$(grep "MCP_PROXY_PORT" .env | cut -d'=' -f2 | tr -d ' ' || echo "8080")

echo "   - LibreChat: http://localhost:${LIBRECHAT_PORT}"
echo "   - MCP Proxy health: http://localhost:${MCP_PORT}/health"
echo "   - MCP Proxy status: http://localhost:${MCP_PORT}/"
echo
echo "🐛 Troubleshooting:"
echo "   - View logs: $DOCKER_COMPOSE_CMD logs -f [service_name]"
echo "   - Stop services: $DOCKER_COMPOSE_CMD down"
echo "   - Restart services: $DOCKER_COMPOSE_CMD restart"
echo
echo "✅ MCP Atlassian integration is ready!"

# Final status summary
echo
echo "📊 Service Status Summary:"
$DOCKER_COMPOSE_CMD ps

echo
echo "Happy chatting with Atlassian! 🎉"
#!/bin/bash
# Test script for MCP Atlassian Integration

echo "=== MCP Atlassian Integration Test ==="
echo

# Test 1: Check if files exist
echo "Test 1: Checking if required files exist..."
files=("universal_proxy.py" "Dockerfile.proxy" "requirements.txt" "docs/mcp-atlassian-integration.md")
for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo "✓ $file exists"
    else
        echo "✗ $file missing"
        exit 1
    fi
done
echo

# Test 2: Check Python syntax
echo "Test 2: Checking Python syntax..."
if python3 -m py_compile universal_proxy.py; then
    echo "✓ universal_proxy.py syntax is valid"
else
    echo "✗ universal_proxy.py has syntax errors"
    exit 1
fi
echo

# Test 3: Check Docker Compose YAML syntax
echo "Test 3: Checking Docker Compose YAML syntax..."
if python3 -c "import yaml; yaml.safe_load(open('docker-compose.yml'))" 2>/dev/null; then
    echo "✓ docker-compose.yml YAML syntax is valid"
else
    echo "✗ docker-compose.yml has YAML syntax errors"
    exit 1
fi
echo

# Test 4: Check if proxy service is defined
echo "Test 4: Checking if proxy service is defined in docker-compose.yml..."
if grep -q "mcp_proxy:" docker-compose.yml; then
    echo "✓ mcp_proxy service is defined"
else
    echo "✗ mcp_proxy service not found in docker-compose.yml"
    exit 1
fi
echo

# Test 5: Check librechat.example.yaml for MCP config
echo "Test 5: Checking if librechat.example.yaml has MCP configuration..."
if grep -q "mcpServers:" librechat.example.yaml && grep -q "atlassian:" librechat.example.yaml; then
    echo "✓ MCP Atlassian configuration found in librechat.example.yaml"
else
    echo "✗ MCP Atlassian configuration not found in librechat.example.yaml"
    exit 1
fi
echo

echo "=== All tests passed! ==="
echo
echo "The MCP Atlassian integration is ready for deployment."
echo
echo "Next steps:"
echo "1. Copy .env.example to .env and configure your settings"
echo "2. Build and start the services:"
echo "   docker-compose up -d"
echo "3. Configure your Atlassian PATs in LibreChat settings"
echo "4. Test the integration with Jira and Confluence tools"
echo
echo "For detailed instructions, see docs/mcp-atlassian-integration.md"
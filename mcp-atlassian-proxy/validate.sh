#!/bin/bash
# Validation script for MCP Atlassian Proxy implementation

echo "🔍 Validating MCP Atlassian Proxy Implementation"
echo "================================================"

# Check if we're in the right directory
if [ ! -f "universal_proxy.py" ]; then
    echo "❌ Error: Must be run from mcp-atlassian-proxy directory"
    exit 1
fi

echo "✅ In correct directory: mcp-atlassian-proxy"

# Validate required files
echo
echo "📁 Checking required files..."
required_files=(
    "universal_proxy.py"
    "Dockerfile"
    "docker-compose.yml"
    "requirements.txt"
    "README.md"
    "start.sh"
    "test_proxy.py"
    "librechat.example.yaml"
    "TESTING.md"
    "INTEGRATION.md"
    "IMPLEMENTATION_SUMMARY.md"
    ".gitignore"
)

for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file"
    else
        echo "❌ Missing: $file"
        exit 1
    fi
done

# Validate Python syntax
echo
echo "🐍 Validating Python syntax..."
python3 -m py_compile universal_proxy.py
if [ $? -eq 0 ]; then
    echo "✅ universal_proxy.py syntax valid"
else
    echo "❌ universal_proxy.py syntax error"
    exit 1
fi

python3 -m py_compile test_proxy.py
if [ $? -eq 0 ]; then
    echo "✅ test_proxy.py syntax valid"
else
    echo "❌ test_proxy.py syntax error"
    exit 1
fi

# Validate script permissions
echo
echo "🔐 Checking script permissions..."
if [ -x "start.sh" ]; then
    echo "✅ start.sh is executable"
else
    echo "❌ start.sh is not executable"
    chmod +x start.sh
    echo "✅ Fixed start.sh permissions"
fi

# Validate Docker files
echo
echo "🐳 Validating Docker configuration..."
if grep -q "FROM python:3.11-slim" Dockerfile; then
    echo "✅ Dockerfile has correct base image"
else
    echo "❌ Dockerfile base image issue"
    exit 1
fi

if grep -q "mcp-atlassian-proxy" docker-compose.yml; then
    echo "✅ docker-compose.yml has proxy service"
else
    echo "❌ docker-compose.yml missing proxy service"
    exit 1
fi

# Validate requirements.txt
echo
echo "📦 Validating Python requirements..."
if grep -q "fastapi" requirements.txt && grep -q "uvicorn" requirements.txt; then
    echo "✅ requirements.txt has required packages"
else
    echo "❌ requirements.txt missing required packages"
    exit 1
fi

# Check for LibreChat integration
echo
echo "🔗 Checking LibreChat integration..."
if [ -f "../packages/api/src/mcp/manager.ts" ]; then
    if grep -q "X-Jira-PAT" ../packages/api/src/mcp/manager.ts; then
        echo "✅ LibreChat MCP manager has header injection"
    else
        echo "❌ LibreChat MCP manager missing header injection"
        exit 1
    fi
else
    echo "❌ LibreChat MCP manager file not found"
    exit 1
fi

# Validate main docker-compose integration
echo
echo "🐳 Checking main docker-compose integration..."
if [ -f "../docker-compose.yml" ]; then
    if grep -q "mcp-atlassian-proxy" ../docker-compose.yml; then
        echo "✅ Main docker-compose.yml includes proxy service"
    else
        echo "❌ Main docker-compose.yml missing proxy service"
        exit 1
    fi
else
    echo "❌ Main docker-compose.yml not found"
    exit 1
fi

# Validate documentation
echo
echo "📚 Checking documentation..."
if grep -q "MCP Atlassian" README.md; then
    echo "✅ README.md has proper content"
else
    echo "❌ README.md content issue"
    exit 1
fi

if grep -q "Testing Steps" TESTING.md; then
    echo "✅ TESTING.md has proper content"
else
    echo "❌ TESTING.md content issue"
    exit 1
fi

# Check for main README update
if grep -q "MCP Atlassian Integration" ../README.md; then
    echo "✅ Main README.md updated with integration info"
else
    echo "❌ Main README.md not updated"
    exit 1
fi

echo
echo "🎉 Validation Complete!"
echo "========================"
echo "✅ All files present and valid"
echo "✅ Python syntax correct"
echo "✅ Docker configuration valid"
echo "✅ LibreChat integration present"
echo "✅ Documentation complete"
echo
echo "🚀 Ready for deployment!"
echo "Run './start.sh' to begin testing"
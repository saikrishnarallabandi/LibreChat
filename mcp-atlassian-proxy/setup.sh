#!/bin/bash
# Setup script for MCP Atlassian Universal Proxy

set -e

echo "==================================="
echo "MCP Atlassian Universal Proxy Setup"
echo "==================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "universal_proxy.py" ]; then
    print_error "Please run this script from the mcp-atlassian-proxy directory"
    exit 1
fi

print_status "Setting up MCP Atlassian Universal Proxy..."

# Check Python version
python_version=$(python3 --version 2>&1 | awk '{print $2}' | cut -d. -f1,2)
min_version="3.8"

if [ "$(printf '%s\n' "$min_version" "$python_version" | sort -V | head -n1)" != "$min_version" ]; then
    print_error "Python 3.8 or higher is required. Current version: $python_version"
    exit 1
fi

print_status "Python version: $python_version ✓"

# Check Node.js version
if ! command -v node &> /dev/null; then
    print_error "Node.js is required but not installed"
    exit 1
fi

node_version=$(node --version | cut -d'v' -f2 | cut -d. -f1)
if [ "$node_version" -lt 16 ]; then
    print_error "Node.js 16 or higher is required. Current version: $(node --version)"
    exit 1
fi

print_status "Node.js version: $(node --version) ✓"

# Install Python dependencies
print_status "Installing Python dependencies..."
python3 -m pip install -r requirements.txt --user

# Install MCP Atlassian package
print_status "Installing MCP Atlassian package..."
npm install -g atlassian-mcp || print_warning "Could not install globally, will use npx"

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    print_status "Creating .env file..."
    cp .env.example .env
    print_warning "Please edit .env file to configure your settings"
fi

# Make test script executable
chmod +x test_proxy.py

print_status "Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env file to configure your settings"
echo "2. Start the proxy: python3 universal_proxy.py"
echo "3. Test the proxy: python3 test_proxy.py"
echo "4. Configure LibreChat to use the proxy (see README.md)"
echo ""
echo "For Docker deployment:"
echo "  docker-compose up -d"
echo ""
print_status "For more information, see README.md"
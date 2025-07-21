#!/usr/bin/env python3
"""
Functional test script for MCP Atlassian Proxy
This script tests the proxy functionality without requiring real Atlassian credentials.
"""

import asyncio
import json
import subprocess
import time
import signal
import sys
import requests
from typing import Optional
import threading

class ProxyTester:
    def __init__(self):
        self.proxy_process: Optional[subprocess.Popen] = None
        self.base_url = "http://localhost:8080"
        
    async def start_proxy(self):
        """Start the proxy server for testing"""
        try:
            print("Starting MCP proxy server...")
            # Try to install dependencies first
            subprocess.run([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"], 
                         capture_output=True, check=True)
            
            self.proxy_process = subprocess.Popen(
                [sys.executable, "universal_proxy.py", "--port", "8080"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            
            # Wait for server to start
            for _ in range(30):  # Wait up to 30 seconds
                try:
                    response = requests.get(f"{self.base_url}/health", timeout=2)
                    if response.status_code == 200:
                        print("✓ Proxy server started successfully")
                        return True
                except:
                    await asyncio.sleep(1)
            
            print("✗ Proxy server failed to start")
            return False
            
        except subprocess.CalledProcessError as e:
            print(f"✗ Failed to install dependencies: {e}")
            return False
        except Exception as e:
            print(f"✗ Failed to start proxy: {e}")
            return False
    
    def stop_proxy(self):
        """Stop the proxy server"""
        if self.proxy_process:
            print("Stopping proxy server...")
            self.proxy_process.terminate()
            try:
                self.proxy_process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.proxy_process.kill()
                self.proxy_process.wait()
            print("✓ Proxy server stopped")
    
    def test_health_endpoint(self):
        """Test the health endpoint"""
        try:
            response = requests.get(f"{self.base_url}/health", timeout=5)
            if response.status_code == 200:
                data = response.json()
                print(f"✓ Health endpoint working: {data}")
                return True
            else:
                print(f"✗ Health endpoint failed: {response.status_code}")
                return False
        except Exception as e:
            print(f"✗ Health endpoint error: {e}")
            return False
    
    def test_root_endpoint(self):
        """Test the root endpoint"""
        try:
            response = requests.get(f"{self.base_url}/", timeout=5)
            if response.status_code == 200:
                data = response.json()
                print(f"✓ Root endpoint working: {data}")
                return True
            else:
                print(f"✗ Root endpoint failed: {response.status_code}")
                return False
        except Exception as e:
            print(f"✗ Root endpoint error: {e}")
            return False
    
    def test_mcp_endpoint_without_auth(self):
        """Test MCP endpoint without authentication (should fail)"""
        try:
            response = requests.post(
                f"{self.base_url}/mcp",
                json={
                    "jsonrpc": "2.0",
                    "method": "tools/list",
                    "id": 1
                },
                timeout=5
            )
            if response.status_code == 400:
                print("✓ MCP endpoint correctly rejects requests without PAT headers")
                return True
            else:
                print(f"✗ MCP endpoint should reject requests without auth: {response.status_code}")
                return False
        except Exception as e:
            print(f"✗ MCP endpoint test error: {e}")
            return False
    
    def test_mcp_endpoint_with_fake_auth(self):
        """Test MCP endpoint with fake authentication (will fail to start mcp-atlassian)"""
        try:
            response = requests.post(
                f"{self.base_url}/mcp",
                json={
                    "jsonrpc": "2.0",
                    "method": "tools/list",
                    "id": 1
                },
                headers={
                    "X-User-ID": "test-user",
                    "X-Jira-PAT": "fake-jira-token",
                    "X-Confluence-PAT": "fake-confluence-token"
                },
                timeout=10
            )
            # This should fail with 500 because mcp-atlassian won't start with fake tokens
            # but it shows our authentication header parsing works
            if response.status_code == 500:
                print("✓ MCP endpoint correctly processes auth headers (fails as expected with fake tokens)")
                return True
            else:
                print(f"✗ Unexpected response from MCP endpoint: {response.status_code}")
                print(f"Response: {response.text}")
                return False
        except Exception as e:
            print(f"✗ MCP endpoint with auth test error: {e}")
            return False

async def main():
    """Run all functional tests"""
    print("=== MCP Atlassian Proxy Functional Tests ===")
    print()
    
    tester = ProxyTester()
    
    # Set up signal handler for cleanup
    def signal_handler(sig, frame):
        print("\nReceived interrupt signal, cleaning up...")
        tester.stop_proxy()
        sys.exit(0)
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    try:
        # Start proxy
        if not await tester.start_proxy():
            print("Failed to start proxy server. Ensure FastAPI dependencies are available.")
            print("Run: pip install fastapi uvicorn pydantic")
            return False
        
        print()
        
        # Run tests
        tests = [
            ("Health Endpoint", tester.test_health_endpoint),
            ("Root Endpoint", tester.test_root_endpoint),
            ("MCP Endpoint Without Auth", tester.test_mcp_endpoint_without_auth),
            ("MCP Endpoint With Fake Auth", tester.test_mcp_endpoint_with_fake_auth),
        ]
        
        passed = 0
        for test_name, test_func in tests:
            print(f"Running: {test_name}")
            if test_func():
                passed += 1
            print()
        
        print(f"=== Results: {passed}/{len(tests)} tests passed ===")
        
        if passed == len(tests):
            print("✓ All functional tests passed!")
            print("The proxy server is working correctly and ready for integration with LibreChat.")
            return True
        else:
            print("✗ Some tests failed.")
            return False
            
    finally:
        tester.stop_proxy()

if __name__ == "__main__":
    try:
        result = asyncio.run(main())
        sys.exit(0 if result else 1)
    except KeyboardInterrupt:
        print("\nTest interrupted by user")
        sys.exit(1)
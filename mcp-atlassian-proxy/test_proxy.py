#!/usr/bin/env python3
"""
Test script for MCP Atlassian Universal Proxy

This script validates that the proxy can:
1. Start up correctly
2. Accept MCP requests
3. Handle authentication headers
4. Return proper MCP responses
"""

import asyncio
import json
import requests
import time
import sys
from typing import Dict, Any

PROXY_URL = "http://localhost:8001"
TEST_JIRA_PAT = "test-jira-pat"
TEST_CONFLUENCE_PAT = "test-confluence-pat"


def test_health_endpoint():
    """Test the health check endpoint"""
    print("Testing health endpoint...")
    try:
        response = requests.get(f"{PROXY_URL}/health")
        response.raise_for_status()
        data = response.json()
        print(f"✓ Health check passed: {data}")
        return True
    except Exception as e:
        print(f"✗ Health check failed: {e}")
        return False


def test_mcp_tools_list():
    """Test the MCP tools/list method"""
    print("Testing MCP tools/list...")
    try:
        headers = {
            "Content-Type": "application/json",
            "X-Jira-PAT": TEST_JIRA_PAT,
            "X-Confluence-PAT": TEST_CONFLUENCE_PAT
        }
        
        mcp_request = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "tools/list",
            "params": {}
        }
        
        response = requests.post(
            f"{PROXY_URL}/",
            headers=headers,
            json=mcp_request,
            timeout=30
        )
        
        print(f"Response status: {response.status_code}")
        print(f"Response headers: {dict(response.headers)}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✓ MCP tools/list succeeded: {data}")
            return True
        else:
            print(f"✗ MCP tools/list failed: {response.status_code} - {response.text}")
            return False
            
    except Exception as e:
        print(f"✗ MCP tools/list failed: {e}")
        return False


def test_mcp_tools_call():
    """Test the MCP tools/call method (will fail without real credentials but should show proper error handling)"""
    print("Testing MCP tools/call...")
    try:
        headers = {
            "Content-Type": "application/json",
            "X-Jira-PAT": TEST_JIRA_PAT,
            "X-Confluence-PAT": TEST_CONFLUENCE_PAT
        }
        
        mcp_request = {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/call",
            "params": {
                "name": "jira-search-issues",
                "arguments": {
                    "jql": "project = TEST"
                }
            }
        }
        
        response = requests.post(
            f"{PROXY_URL}/",
            headers=headers,
            json=mcp_request,
            timeout=30
        )
        
        print(f"Response status: {response.status_code}")
        data = response.json()
        
        # We expect this to fail with authentication error, but it should be a proper MCP response
        if "error" in data:
            print(f"✓ MCP tools/call returned proper error (expected): {data}")
            return True
        elif "result" in data:
            print(f"✓ MCP tools/call succeeded: {data}")
            return True
        else:
            print(f"✗ MCP tools/call returned unexpected format: {data}")
            return False
            
    except Exception as e:
        print(f"✗ MCP tools/call failed: {e}")
        return False


def main():
    """Run all tests"""
    print("Starting MCP Atlassian Universal Proxy Tests")
    print("=" * 50)
    
    # Wait a bit for the proxy to start if just launched
    print("Waiting for proxy to start...")
    time.sleep(2)
    
    tests = [
        test_health_endpoint,
        test_mcp_tools_list,
        test_mcp_tools_call
    ]
    
    passed = 0
    failed = 0
    
    for test in tests:
        print(f"\n{test.__name__}:")
        print("-" * 30)
        if test():
            passed += 1
        else:
            failed += 1
    
    print("\n" + "=" * 50)
    print(f"Test Results: {passed} passed, {failed} failed")
    
    if failed > 0:
        print("Some tests failed. Check the proxy logs for more details.")
        sys.exit(1)
    else:
        print("All tests passed!")
        sys.exit(0)


if __name__ == "__main__":
    main()
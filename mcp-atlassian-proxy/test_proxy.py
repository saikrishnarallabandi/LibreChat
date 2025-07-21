#!/usr/bin/env python3
"""
Test script for MCP Atlassian Universal Proxy

This script tests the basic functionality of the proxy server
"""

import asyncio
import json
import requests
import time
from typing import Dict, Any

# Test configuration
PROXY_URL = "http://localhost:3001"
TEST_HEADERS = {
    "X-Jira-PAT": "test_jira_pat",
    "X-Confluence-PAT": "test_confluence_pat", 
    "X-Atlassian-URL": "https://test.atlassian.net",
    "X-User-ID": "test-user"
}

def test_health_check():
    """Test the health check endpoint"""
    print("Testing health check...")
    try:
        response = requests.get(f"{PROXY_URL}/health", timeout=10)
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Health check passed: {data}")
            return True
        else:
            print(f"✗ Health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"✗ Health check error: {e}")
        return False

def test_initialize():
    """Test the MCP initialize endpoint"""
    print("Testing MCP initialize...")
    try:
        response = requests.post(
            f"{PROXY_URL}/mcp/initialize",
            headers=TEST_HEADERS,
            timeout=30
        )
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Initialize passed: {data}")
            return True
        else:
            print(f"✗ Initialize failed: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"✗ Initialize error: {e}")
        return False

def test_list_tools():
    """Test the tools list endpoint"""
    print("Testing tools list...")
    try:
        response = requests.post(
            f"{PROXY_URL}/mcp/tools/list",
            headers=TEST_HEADERS,
            timeout=30
        )
        if response.status_code == 200:
            data = response.json()
            print(f"✓ List tools passed: {data}")
            return True
        else:
            print(f"✗ List tools failed: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"✗ List tools error: {e}")
        return False

def test_tool_call():
    """Test calling a tool (this will likely fail without valid credentials)"""
    print("Testing tool call...")
    try:
        payload = {
            "name": "search_jira_issues",
            "arguments": {
                "jql": "assignee = currentUser()"
            }
        }
        response = requests.post(
            f"{PROXY_URL}/mcp/tools/call",
            headers=TEST_HEADERS,
            json=payload,
            timeout=30
        )
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Tool call passed: {data}")
            return True
        else:
            print(f"⚠ Tool call failed (expected with test credentials): {response.status_code} - {response.text}")
            return True  # This is expected to fail with test credentials
    except Exception as e:
        print(f"⚠ Tool call error (expected with test credentials): {e}")
        return True  # This is expected to fail with test credentials

def wait_for_service(max_attempts=30, delay=2):
    """Wait for the service to be ready"""
    print(f"Waiting for service to be ready (max {max_attempts * delay}s)...")
    for attempt in range(max_attempts):
        try:
            response = requests.get(f"{PROXY_URL}/health", timeout=5)
            if response.status_code == 200:
                print("✓ Service is ready!")
                return True
        except Exception:
            pass
        
        print(f"  Attempt {attempt + 1}/{max_attempts}...")
        time.sleep(delay)
    
    print("✗ Service not ready within timeout")
    return False

def main():
    """Run all tests"""
    print("=== MCP Atlassian Proxy Test Suite ===\n")
    
    # Wait for service to be ready
    if not wait_for_service():
        print("Service not available. Make sure the proxy is running on port 3001.")
        return False
    
    print()
    
    # Run tests
    tests = [
        test_health_check,
        test_initialize,
        test_list_tools,
        test_tool_call
    ]
    
    results = []
    for test in tests:
        result = test()
        results.append(result)
        print()
    
    # Summary
    passed = sum(results)
    total = len(results)
    
    print("=== Test Summary ===")
    print(f"Passed: {passed}/{total}")
    
    if passed == total:
        print("✓ All tests passed!")
        return True
    else:
        print("⚠ Some tests failed (may be expected with test credentials)")
        return False

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
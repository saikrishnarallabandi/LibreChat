#!/usr/bin/env python3
"""
Universal FastAPI Proxy for mcp-atlassian Integration with LibreChat

This proxy server enables multi-user support for mcp-atlassian by:
1. Accepting user-specific PATs via HTTP headers
2. Providing universal routing for all mcp-atlassian tools
3. Dynamically injecting user tokens at runtime
4. Supporting both Jira and Confluence endpoints

Usage:
    python universal_proxy.py

Environment Variables:
    PORT: Server port (default: 3001)
    HOST: Server host (default: 0.0.0.0)
    MCP_ATLASSIAN_PATH: Path to mcp-atlassian executable (auto-detected)
"""

import os
import sys
import json
import asyncio
import logging
import subprocess
from typing import Dict, Any, Optional, List
from pathlib import Path

from fastapi import FastAPI, HTTPException, Header, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import uvicorn

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Models for request/response
class MCPRequest(BaseModel):
    method: str
    params: Dict[str, Any]

class MCPResponse(BaseModel):
    result: Optional[Dict[str, Any]] = None
    error: Optional[Dict[str, Any]] = None

class ToolCallRequest(BaseModel):
    name: str
    arguments: Dict[str, Any]

class FastAPIApp:
    def __init__(self):
        self.app = FastAPI(
            title="MCP Atlassian Universal Proxy",
            description="FastAPI proxy for mcp-atlassian with multi-user PAT support",
            version="1.0.0"
        )
        self.mcp_atlassian_path = self._find_mcp_atlassian()
        self._setup_routes()
        
    def _find_mcp_atlassian(self) -> str:
        """Find the mcp-atlassian executable path"""
        # Check environment variable first
        if 'MCP_ATLASSIAN_PATH' in os.environ:
            path = os.environ['MCP_ATLASSIAN_PATH']
            if os.path.exists(path):
                return path
        
        # Try common locations
        common_paths = [
            'npx',  # Use npx to run mcp-atlassian
            '/usr/local/bin/mcp-atlassian',
            '/usr/bin/mcp-atlassian',
            './node_modules/.bin/mcp-atlassian'
        ]
        
        for path in common_paths:
            try:
                if path == 'npx':
                    # Test if npx can find mcp-atlassian
                    result = subprocess.run(
                        ['npx', 'mcp-atlassian', '--help'],
                        capture_output=True,
                        timeout=10
                    )
                    if result.returncode == 0:
                        return 'npx'
                else:
                    if os.path.exists(path) and os.access(path, os.X_OK):
                        return path
            except Exception as e:
                logger.debug(f"Failed to test path {path}: {e}")
        
        # Fallback to npx
        logger.warning("mcp-atlassian not found in common locations, using npx")
        return 'npx'
    
    def _setup_routes(self):
        """Setup FastAPI routes"""
        
        @self.app.get("/health")
        async def health_check():
            """Health check endpoint"""
            return {"status": "healthy", "service": "mcp-atlassian-proxy"}
        
        @self.app.post("/mcp/tools/call")
        async def call_tool(
            request: ToolCallRequest,
            x_jira_pat: Optional[str] = Header(None, alias="X-Jira-PAT"),
            x_confluence_pat: Optional[str] = Header(None, alias="X-Confluence-PAT"),
            x_atlassian_url: Optional[str] = Header(None, alias="X-Atlassian-URL"),
            x_user_id: Optional[str] = Header(None, alias="X-User-ID")
        ):
            """Universal tool call endpoint that accepts any mcp-atlassian tool"""
            try:
                # Prepare environment with user-specific tokens
                env = os.environ.copy()
                
                if x_jira_pat:
                    env['JIRA_PAT'] = x_jira_pat
                if x_confluence_pat:
                    env['CONFLUENCE_PAT'] = x_confluence_pat
                if x_atlassian_url:
                    env['ATLASSIAN_URL'] = x_atlassian_url
                
                # Log the request (without sensitive data)
                logger.info(f"Tool call: {request.name} for user: {x_user_id or 'anonymous'}")
                
                # Call mcp-atlassian
                result = await self._call_mcp_atlassian(
                    method="tools/call",
                    params={
                        "name": request.name,
                        "arguments": request.arguments
                    },
                    env=env
                )
                
                return JSONResponse(content=result)
                
            except Exception as e:
                logger.error(f"Error calling tool {request.name}: {str(e)}")
                raise HTTPException(status_code=500, detail=str(e))
        
        @self.app.post("/mcp/tools/list")
        async def list_tools(
            x_jira_pat: Optional[str] = Header(None, alias="X-Jira-PAT"),
            x_confluence_pat: Optional[str] = Header(None, alias="X-Confluence-PAT"),
            x_atlassian_url: Optional[str] = Header(None, alias="X-Atlassian-URL"),
            x_user_id: Optional[str] = Header(None, alias="X-User-ID")
        ):
            """List available tools"""
            try:
                # Prepare environment with user-specific tokens
                env = os.environ.copy()
                
                if x_jira_pat:
                    env['JIRA_PAT'] = x_jira_pat
                if x_confluence_pat:
                    env['CONFLUENCE_PAT'] = x_confluence_pat
                if x_atlassian_url:
                    env['ATLASSIAN_URL'] = x_atlassian_url
                
                logger.info(f"List tools for user: {x_user_id or 'anonymous'}")
                
                # Call mcp-atlassian
                result = await self._call_mcp_atlassian(
                    method="tools/list",
                    params={},
                    env=env
                )
                
                return JSONResponse(content=result)
                
            except Exception as e:
                logger.error(f"Error listing tools: {str(e)}")
                raise HTTPException(status_code=500, detail=str(e))
        
        @self.app.post("/mcp/initialize")
        async def initialize(
            x_jira_pat: Optional[str] = Header(None, alias="X-Jira-PAT"),
            x_confluence_pat: Optional[str] = Header(None, alias="X-Confluence-PAT"),
            x_atlassian_url: Optional[str] = Header(None, alias="X-Atlassian-URL"),
            x_user_id: Optional[str] = Header(None, alias="X-User-ID")
        ):
            """Initialize MCP session"""
            try:
                # Prepare environment with user-specific tokens
                env = os.environ.copy()
                
                if x_jira_pat:
                    env['JIRA_PAT'] = x_jira_pat
                if x_confluence_pat:
                    env['CONFLUENCE_PAT'] = x_confluence_pat
                if x_atlassian_url:
                    env['ATLASSIAN_URL'] = x_atlassian_url
                
                logger.info(f"Initialize MCP for user: {x_user_id or 'anonymous'}")
                
                # Call mcp-atlassian initialize
                result = await self._call_mcp_atlassian(
                    method="initialize",
                    params={
                        "protocolVersion": "2024-11-05",
                        "capabilities": {
                            "tools": {},
                            "logging": {}
                        },
                        "clientInfo": {
                            "name": "librechat-mcp-proxy",
                            "version": "1.0.0"
                        }
                    },
                    env=env
                )
                
                return JSONResponse(content=result)
                
            except Exception as e:
                logger.error(f"Error initializing MCP: {str(e)}")
                raise HTTPException(status_code=500, detail=str(e))
        
        @self.app.post("/mcp/{method:path}")
        async def universal_mcp_handler(
            method: str,
            request: Request,
            x_jira_pat: Optional[str] = Header(None, alias="X-Jira-PAT"),
            x_confluence_pat: Optional[str] = Header(None, alias="X-Confluence-PAT"),
            x_atlassian_url: Optional[str] = Header(None, alias="X-Atlassian-URL"),
            x_user_id: Optional[str] = Header(None, alias="X-User-ID")
        ):
            """Universal handler for any MCP method"""
            try:
                # Get request body
                body = await request.json() if await request.body() else {}
                
                # Prepare environment with user-specific tokens
                env = os.environ.copy()
                
                if x_jira_pat:
                    env['JIRA_PAT'] = x_jira_pat
                if x_confluence_pat:
                    env['CONFLUENCE_PAT'] = x_confluence_pat
                if x_atlassian_url:
                    env['ATLASSIAN_URL'] = x_atlassian_url
                
                logger.info(f"MCP call: {method} for user: {x_user_id or 'anonymous'}")
                
                # Call mcp-atlassian
                result = await self._call_mcp_atlassian(
                    method=method,
                    params=body.get('params', {}),
                    env=env
                )
                
                return JSONResponse(content=result)
                
            except Exception as e:
                logger.error(f"Error calling MCP method {method}: {str(e)}")
                raise HTTPException(status_code=500, detail=str(e))
    
    async def _call_mcp_atlassian(self, method: str, params: Dict[str, Any], env: Dict[str, str]) -> Dict[str, Any]:
        """Call mcp-atlassian with the given method and parameters"""
        try:
            # Prepare the command
            if self.mcp_atlassian_path == 'npx':
                cmd = ['npx', '-y', 'mcp-atlassian']
            else:
                cmd = [self.mcp_atlassian_path]
            
            # Create MCP request
            mcp_request = {
                "jsonrpc": "2.0",
                "id": 1,
                "method": method,
                "params": params
            }
            
            # Run the command
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=env
            )
            
            # Send request and get response
            input_data = json.dumps(mcp_request) + '\n'
            stdout, stderr = await process.communicate(input=input_data.encode())
            
            if process.returncode != 0:
                error_msg = stderr.decode() if stderr else "Unknown error"
                logger.error(f"mcp-atlassian returned error: {error_msg}")
                raise HTTPException(status_code=500, detail=f"MCP error: {error_msg}")
            
            # Parse response
            try:
                response_text = stdout.decode().strip()
                if not response_text:
                    return {"result": {"success": True}}
                
                # Handle multiple JSON responses (common with MCP)
                lines = response_text.split('\n')
                for line in lines:
                    if line.strip():
                        try:
                            response = json.loads(line)
                            if 'result' in response or 'error' in response:
                                return response
                        except json.JSONDecodeError:
                            continue
                
                # If no valid JSON found, return the raw output
                return {"result": {"output": response_text}}
                
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse mcp-atlassian response: {e}")
                return {"error": {"code": -32700, "message": "Parse error"}}
            
        except Exception as e:
            logger.error(f"Error calling mcp-atlassian: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))

def create_app() -> FastAPI:
    """Create and configure the FastAPI application"""
    return FastAPIApp().app

def main():
    """Main entry point"""
    # Configuration
    host = os.getenv('HOST', '0.0.0.0')
    port = int(os.getenv('PORT', '3001'))
    
    logger.info(f"Starting MCP Atlassian Universal Proxy on {host}:{port}")
    
    # Create app
    app = create_app()
    
    # Run server
    uvicorn.run(
        app,
        host=host,
        port=port,
        log_level="info"
    )

if __name__ == "__main__":
    main()
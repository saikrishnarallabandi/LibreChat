#!/usr/bin/env python3
"""
FastAPI Proxy Server for mcp-atlassian Multi-User Support
=========================================================

This proxy server provides multi-user support for mcp-atlassian in LibreChat by:
1. Accepting user-specific Personal Access Tokens (PATs) via HTTP headers
2. Dynamically spawning mcp-atlassian instances with user credentials
3. Providing MCP protocol endpoints that LibreChat can connect to
4. Maintaining security without modifying the mcp-atlassian library

Headers supported:
- X-Jira-PAT: Personal Access Token for Jira
- X-Confluence-PAT: Personal Access Token for Confluence
- X-User-ID: Unique identifier for the user (optional, defaults to "default")
"""

import asyncio
import json
import logging
import os
import subprocess
import sys
import uuid
from contextlib import asynccontextmanager
from typing import Any, Dict, List, Optional, Union

from fastapi import FastAPI, HTTPException, Header, Request, Response
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
import uvicorn

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Global registry for user-specific MCP instances
user_instances: Dict[str, Dict[str, Any]] = {}
instance_lock = asyncio.Lock()

class MCPRequest(BaseModel):
    """Standard MCP request format"""
    jsonrpc: str = "2.0"
    id: Optional[Union[str, int]] = None
    method: str
    params: Optional[Dict[str, Any]] = None

class MCPResponse(BaseModel):
    """Standard MCP response format"""
    jsonrpc: str = "2.0"
    id: Optional[Union[str, int]] = None
    result: Optional[Any] = None
    error: Optional[Dict[str, Any]] = None

class UserInstance:
    """Manages a single user's mcp-atlassian instance"""
    
    def __init__(self, user_id: str, jira_pat: Optional[str] = None, confluence_pat: Optional[str] = None):
        self.user_id = user_id
        self.jira_pat = jira_pat
        self.confluence_pat = confluence_pat
        self.process: Optional[subprocess.Popen] = None
        self.reader: Optional[asyncio.StreamReader] = None
        self.writer: Optional[asyncio.StreamWriter] = None
        self.running = False
        self.last_activity = asyncio.get_event_loop().time()
        
    async def start(self) -> bool:
        """Start the mcp-atlassian instance for this user"""
        try:
            # Build environment with user-specific PATs
            env = os.environ.copy()
            if self.jira_pat:
                env['JIRA_PAT'] = self.jira_pat
            if self.confluence_pat:
                env['CONFLUENCE_PAT'] = self.confluence_pat
                
            # Start mcp-atlassian process via npx
            cmd = ['npx', '-y', 'mcp-atlassian']
            
            logger.info(f"Starting mcp-atlassian instance for user {self.user_id}")
            self.process = await asyncio.create_subprocess_exec(
                *cmd,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=env
            )
            
            self.running = True
            logger.info(f"Successfully started mcp-atlassian instance for user {self.user_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to start mcp-atlassian instance for user {self.user_id}: {e}")
            return False
    
    async def send_request(self, request: MCPRequest) -> MCPResponse:
        """Send a request to the mcp-atlassian instance"""
        if not self.running or not self.process:
            raise HTTPException(status_code=500, detail="MCP instance not running")
        
        try:
            # Update last activity
            self.last_activity = asyncio.get_event_loop().time()
            
            # Prepare request
            request_data = request.dict()
            if request_data.get('id') is None:
                request_data['id'] = str(uuid.uuid4())
            
            request_json = json.dumps(request_data) + '\n'
            
            # Send request to process
            self.process.stdin.write(request_json.encode())
            await self.process.stdin.drain()
            
            # Read response
            response_line = await self.process.stdout.readline()
            if not response_line:
                raise HTTPException(status_code=500, detail="No response from MCP instance")
            
            response_data = json.loads(response_line.decode().strip())
            return MCPResponse(**response_data)
            
        except Exception as e:
            logger.error(f"Error sending request to MCP instance for user {self.user_id}: {e}")
            raise HTTPException(status_code=500, detail=f"MCP request failed: {str(e)}")
    
    async def stop(self):
        """Stop the mcp-atlassian instance"""
        if self.process:
            try:
                self.process.terminate()
                await asyncio.wait_for(self.process.wait(), timeout=5.0)
            except asyncio.TimeoutError:
                self.process.kill()
                await self.process.wait()
            except Exception as e:
                logger.error(f"Error stopping MCP instance for user {self.user_id}: {e}")
        
        self.running = False
        logger.info(f"Stopped mcp-atlassian instance for user {self.user_id}")

async def get_user_instance(
    user_id: str,
    jira_pat: Optional[str] = None,
    confluence_pat: Optional[str] = None
) -> UserInstance:
    """Get or create a user-specific MCP instance"""
    async with instance_lock:
        if user_id not in user_instances:
            instance = UserInstance(user_id, jira_pat, confluence_pat)
            if await instance.start():
                user_instances[user_id] = instance
            else:
                raise HTTPException(status_code=500, detail="Failed to start MCP instance")
        else:
            instance = user_instances[user_id]
            # Update PATs if provided and different
            if jira_pat and instance.jira_pat != jira_pat:
                await instance.stop()
                instance = UserInstance(user_id, jira_pat, confluence_pat)
                if await instance.start():
                    user_instances[user_id] = instance
                else:
                    raise HTTPException(status_code=500, detail="Failed to restart MCP instance")
            elif confluence_pat and instance.confluence_pat != confluence_pat:
                await instance.stop()
                instance = UserInstance(user_id, jira_pat, confluence_pat)
                if await instance.start():
                    user_instances[user_id] = instance
                else:
                    raise HTTPException(status_code=500, detail="Failed to restart MCP instance")
        
        return user_instances[user_id]

async def cleanup_idle_instances():
    """Clean up idle user instances"""
    current_time = asyncio.get_event_loop().time()
    idle_timeout = 900  # 15 minutes
    
    idle_users = []
    async with instance_lock:
        for user_id, instance in user_instances.items():
            if current_time - instance.last_activity > idle_timeout:
                idle_users.append(user_id)
        
        for user_id in idle_users:
            logger.info(f"Cleaning up idle instance for user {user_id}")
            await user_instances[user_id].stop()
            del user_instances[user_id]

# Periodic cleanup task
async def periodic_cleanup():
    """Periodically clean up idle instances"""
    while True:
        await asyncio.sleep(300)  # Run every 5 minutes
        try:
            await cleanup_idle_instances()
        except Exception as e:
            logger.error(f"Error during periodic cleanup: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    # Start periodic cleanup task
    cleanup_task = asyncio.create_task(periodic_cleanup())
    
    yield
    
    # Cleanup on shutdown
    cleanup_task.cancel()
    async with instance_lock:
        for instance in user_instances.values():
            await instance.stop()
        user_instances.clear()

# Create FastAPI app
app = FastAPI(
    title="MCP Atlassian Proxy",
    description="Multi-user proxy for mcp-atlassian integration with LibreChat",
    version="1.0.0",
    lifespan=lifespan
)

@app.get("/")
async def root():
    """Health check endpoint"""
    return {"message": "MCP Atlassian Proxy is running", "active_users": len(user_instances)}

@app.get("/health")
async def health():
    """Health check endpoint"""
    return {"status": "healthy", "active_instances": len(user_instances)}

@app.post("/mcp")
async def mcp_request(
    request: MCPRequest,
    x_user_id: Optional[str] = Header(None, alias="X-User-ID"),
    x_jira_pat: Optional[str] = Header(None, alias="X-Jira-PAT"),
    x_confluence_pat: Optional[str] = Header(None, alias="X-Confluence-PAT")
):
    """Handle MCP requests with user-specific authentication"""
    
    # Default user ID if not provided
    user_id = x_user_id or "default"
    
    # Validate that at least one PAT is provided
    if not x_jira_pat and not x_confluence_pat:
        raise HTTPException(
            status_code=400, 
            detail="At least one PAT header (X-Jira-PAT or X-Confluence-PAT) is required"
        )
    
    try:
        # Get user-specific MCP instance
        instance = await get_user_instance(user_id, x_jira_pat, x_confluence_pat)
        
        # Forward request to instance
        response = await instance.send_request(request)
        
        return response.dict()
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error handling MCP request: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/users/{user_id}/status")
async def get_user_status(user_id: str):
    """Get status of a user's MCP instance"""
    async with instance_lock:
        if user_id in user_instances:
            instance = user_instances[user_id]
            return {
                "user_id": user_id,
                "running": instance.running,
                "last_activity": instance.last_activity
            }
        else:
            return {"user_id": user_id, "running": False}

@app.delete("/users/{user_id}")
async def stop_user_instance(user_id: str):
    """Stop a user's MCP instance"""
    async with instance_lock:
        if user_id in user_instances:
            await user_instances[user_id].stop()
            del user_instances[user_id]
            return {"message": f"Stopped instance for user {user_id}"}
        else:
            raise HTTPException(status_code=404, detail="User instance not found")

@app.get("/tools")
async def list_tools(
    x_user_id: Optional[str] = Header(None, alias="X-User-ID"),
    x_jira_pat: Optional[str] = Header(None, alias="X-Jira-PAT"),
    x_confluence_pat: Optional[str] = Header(None, alias="X-Confluence-PAT")
):
    """List available tools from mcp-atlassian"""
    
    user_id = x_user_id or "default"
    
    if not x_jira_pat and not x_confluence_pat:
        raise HTTPException(
            status_code=400, 
            detail="At least one PAT header (X-Jira-PAT or X-Confluence-PAT) is required"
        )
    
    try:
        instance = await get_user_instance(user_id, x_jira_pat, x_confluence_pat)
        
        # Request tools list from mcp-atlassian
        tools_request = MCPRequest(
            method="tools/list",
            params={}
        )
        
        response = await instance.send_request(tools_request)
        return response.dict()
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing tools: {e}")
        raise HTTPException(status_code=500, detail="Failed to list tools")

@app.post("/tools/call")
async def call_tool(
    request: Dict[str, Any],
    x_user_id: Optional[str] = Header(None, alias="X-User-ID"),
    x_jira_pat: Optional[str] = Header(None, alias="X-Jira-PAT"),
    x_confluence_pat: Optional[str] = Header(None, alias="X-Confluence-PAT")
):
    """Call a tool on mcp-atlassian"""
    
    user_id = x_user_id or "default"
    
    if not x_jira_pat and not x_confluence_pat:
        raise HTTPException(
            status_code=400, 
            detail="At least one PAT header (X-Jira-PAT or X-Confluence-PAT) is required"
        )
    
    try:
        instance = await get_user_instance(user_id, x_jira_pat, x_confluence_pat)
        
        # Create MCP request for tool call
        mcp_request = MCPRequest(
            method="tools/call",
            params=request
        )
        
        response = await instance.send_request(mcp_request)
        return response.dict()
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error calling tool: {e}")
        raise HTTPException(status_code=500, detail="Failed to call tool")

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="MCP Atlassian Proxy Server")
    parser.add_argument("--host", default="0.0.0.0", help="Host to bind to")
    parser.add_argument("--port", type=int, default=8080, help="Port to bind to")
    parser.add_argument("--log-level", default="info", help="Log level")
    
    args = parser.parse_args()
    
    # Configure logging level
    logging.getLogger().setLevel(getattr(logging, args.log_level.upper()))
    
    logger.info(f"Starting MCP Atlassian Proxy on {args.host}:{args.port}")
    
    uvicorn.run(
        "universal_proxy:app",
        host=args.host,
        port=args.port,
        log_level=args.log_level,
        reload=False
    )
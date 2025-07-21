#!/usr/bin/env python3
"""
FastAPI Universal Proxy for MCP Atlassian Multi-User Integration

This proxy server enables multi-user access to mcp-atlassian tools by:
1. Accepting user-specific Personal Access Tokens (PATs) via HTTP headers
2. Providing universal routing to support all current and future MCP methods
3. Dynamically injecting user tokens at runtime when calling mcp-atlassian functions
4. Integrating seamlessly with LibreChat's MCP system via streamable-http transport
"""

import asyncio
import json
import logging
import os
import subprocess
import sys
from typing import Any, Dict, List, Optional, Union

import uvicorn
from fastapi import FastAPI, HTTPException, Request, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
import threading
import queue
import time

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="MCP Atlassian Universal Proxy",
    description="Multi-user proxy for mcp-atlassian tools with dynamic PAT injection",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global process pool for MCP instances
mcp_processes: Dict[str, subprocess.Popen] = {}
mcp_lock = threading.Lock()


class MCPRequest(BaseModel):
    """Standard MCP request format"""
    jsonrpc: str = "2.0"
    id: Union[str, int]
    method: str
    params: Optional[Dict[str, Any]] = None


class MCPResponse(BaseModel):
    """Standard MCP response format"""
    jsonrpc: str = "2.0"
    id: Union[str, int]
    result: Optional[Dict[str, Any]] = None
    error: Optional[Dict[str, Any]] = None


class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    version: str
    active_processes: int


def get_mcp_atlassian_command() -> List[str]:
    """Get the command to start mcp-atlassian server"""
    # Try different possible installations
    commands = [
        ["npx", "-y", "atlassian-mcp"],
        ["npx", "-y", "@phuc-nt/mcp-atlassian-server"],
        ["npx", "-y", "@aashari/mcp-server-atlassian-jira"],
        ["node_modules/.bin/atlassian-mcp"],
        ["atlassian-mcp"]
    ]
    
    for cmd in commands:
        try:
            # Test if command exists
            result = subprocess.run(
                cmd + ["--version"], 
                capture_output=True, 
                timeout=5,
                check=False
            )
            if result.returncode == 0:
                logger.info(f"Found mcp-atlassian at: {' '.join(cmd)}")
                return cmd
        except (subprocess.TimeoutExpired, FileNotFoundError):
            continue
    
    # Default fallback
    logger.warning("mcp-atlassian not found in standard locations, using npx fallback")
    return ["npx", "-y", "atlassian-mcp"]


def get_process_key(jira_pat: Optional[str], confluence_pat: Optional[str]) -> str:
    """Generate a unique key for the process based on PATs"""
    # Create a hash of the tokens for process identification
    import hashlib
    token_str = f"{jira_pat or ''}:{confluence_pat or ''}"
    return hashlib.md5(token_str.encode()).hexdigest()


async def get_or_create_mcp_process(jira_pat: Optional[str] = None, confluence_pat: Optional[str] = None) -> subprocess.Popen:
    """Get or create an MCP process for the given PATs"""
    process_key = get_process_key(jira_pat, confluence_pat)
    
    with mcp_lock:
        # Check if process exists and is running
        if process_key in mcp_processes:
            process = mcp_processes[process_key]
            if process.poll() is None:  # Process is still running
                return process
            else:
                # Process has died, remove it
                del mcp_processes[process_key]
        
        # Create new process
        try:
            # Prepare environment with user PATs
            env = os.environ.copy()
            if jira_pat:
                env["JIRA_API_TOKEN"] = jira_pat
            if confluence_pat:
                env["CONFLUENCE_API_TOKEN"] = confluence_pat
            
            # Get the command to run
            cmd = get_mcp_atlassian_command()
            
            logger.info(f"Starting new mcp-atlassian process for key: {process_key}")
            
            # Start the MCP server process
            process = subprocess.Popen(
                cmd,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                env=env,
                text=True,
                bufsize=0
            )
            
            # Check if process started successfully
            if process.poll() is not None:
                stderr_output = process.stderr.read() if process.stderr else "No error output"
                raise Exception(f"mcp-atlassian process failed to start: {stderr_output}")
            
            mcp_processes[process_key] = process
            logger.info(f"Successfully started mcp-atlassian process for key: {process_key}")
            return process
            
        except Exception as e:
            logger.error(f"Failed to start mcp-atlassian process: {e}")
            raise HTTPException(status_code=503, detail=f"Failed to start MCP Atlassian service: {str(e)}")


async def send_mcp_request(process: subprocess.Popen, request: MCPRequest) -> MCPResponse:
    """Send a request to the mcp-atlassian process and get response"""
    try:
        # Send request
        request_json = request.model_dump_json()
        logger.debug(f"Sending MCP request: {request_json}")
        
        process.stdin.write(request_json + "\n")
        process.stdin.flush()
        
        # Read response
        response_line = process.stdout.readline().strip()
        if not response_line:
            raise HTTPException(status_code=504, detail="No response from MCP service")
        
        logger.debug(f"Received MCP response: {response_line}")
        
        # Parse response
        response_data = json.loads(response_line)
        return MCPResponse(**response_data)
        
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse MCP response: {e}")
        raise HTTPException(status_code=502, detail="Invalid response from MCP service")
    except Exception as e:
        logger.error(f"Error communicating with MCP service: {e}")
        raise HTTPException(status_code=502, detail="Communication error with MCP service")


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    # Clean up dead processes
    with mcp_lock:
        dead_keys = [k for k, p in mcp_processes.items() if p.poll() is not None]
        for key in dead_keys:
            del mcp_processes[key]
        
        active_count = len(mcp_processes)
    
    return HealthResponse(
        status="healthy",
        version="1.0.0",
        active_processes=active_count
    )


@app.post("/")
async def mcp_streamable_http_endpoint(
    request: Request,
    x_jira_pat: Optional[str] = Header(None, alias="X-Jira-PAT"),
    x_confluence_pat: Optional[str] = Header(None, alias="X-Confluence-PAT")
):
    """
    Main MCP streamable-http endpoint.
    
    This endpoint implements the MCP streamable-http transport protocol.
    It accepts MCP JSON-RPC requests and forwards them to mcp-atlassian
    with user-specific authentication tokens injected.
    """
    try:
        # Get request body
        body = await request.json()
        
        # Validate it's a proper MCP request
        if not isinstance(body, dict) or "method" not in body:
            raise HTTPException(status_code=400, detail="Invalid MCP request format")
        
        # Log token presence for debugging (without exposing values)
        logger.info(f"Processing MCP request - Method: {body.get('method')}, "
                   f"Jira PAT: {'present' if x_jira_pat else 'missing'}, "
                   f"Confluence PAT: {'present' if x_confluence_pat else 'missing'}")
        
        # Get or create MCP process with user PATs
        process = await get_or_create_mcp_process(x_jira_pat, x_confluence_pat)
        
        # Create MCP request
        mcp_request = MCPRequest(
            jsonrpc=body.get("jsonrpc", "2.0"),
            id=body.get("id", 1),
            method=body["method"],
            params=body.get("params")
        )
        
        # Send request to MCP service
        response = await send_mcp_request(process, mcp_request)
        
        # Return response as JSON
        return response.model_dump()
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in MCP streamable-http endpoint: {e}")
        # Return MCP error response format
        error_response = {
            "jsonrpc": "2.0",
            "id": body.get("id", 1) if 'body' in locals() else 1,
            "error": {
                "code": -32603,  # Internal error
                "message": f"Internal server error: {str(e)}"
            }
        }
        return JSONResponse(content=error_response, status_code=500)


@app.on_event("startup")
async def startup_event():
    """Application startup event"""
    logger.info("Starting MCP Atlassian Universal Proxy")
    
    # Install mcp-atlassian if not available
    try:
        result = subprocess.run(
            ["npm", "list", "-g", "atlassian-mcp"], 
            capture_output=True, 
            text=True,
            check=False
        )
        if result.returncode != 0:
            logger.info("Installing atlassian-mcp...")
            subprocess.run(
                ["npm", "install", "-g", "atlassian-mcp"], 
                check=True
            )
            logger.info("atlassian-mcp installed successfully")
    except Exception as e:
        logger.warning(f"Could not install atlassian-mcp globally: {e}")
        logger.info("Will use npx to run atlassian-mcp on demand")


@app.on_event("shutdown")
async def shutdown_event():
    """Application shutdown event"""
    logger.info("Shutting down MCP Atlassian Universal Proxy")
    
    # Stop all MCP processes
    with mcp_lock:
        for key, process in mcp_processes.items():
            try:
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()
                logger.info(f"Stopped MCP process for key: {key}")
            except Exception as e:
                logger.error(f"Error stopping MCP process for key {key}: {e}")
        
        mcp_processes.clear()


if __name__ == "__main__":
    # Configuration from environment variables
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8001"))
    log_level = os.getenv("LOG_LEVEL", "info")
    
    logger.info(f"Starting server on {host}:{port}")
    
    uvicorn.run(
        "universal_proxy:app",
        host=host,
        port=port,
        log_level=log_level,
        reload=False
    )
import { dedent } from 'ts-dedent';

// Utility functions for Pyodide Python code execution in the browser

declare global {
  interface Window {
    loadPyodide: () => Promise<any>;
    pyodide?: any;
  }
}

/**
 * Sets up a virtual filesystem for Python code execution
 * @param pyodide The Pyodide instance
 */
export async function setupPyodideVirtualFS(pyodide: any): Promise<void> {
  await pyodide.runPythonAsync(`
import os
import sys

# Create virtual directories
os.makedirs('/home/pyodide/data', exist_ok=True)

# Set up a working demo file
with open('/home/pyodide/data/example.txt', 'w') as f:
    f.write('This is an example file in the virtual file system.\\nYou can read from this file in your code!')

# Create a helper module for file operations that works in browser
with open('/home/pyodide/file_helpers.py', 'w') as f:
    f.write('''
# Helper functions for file operations in Pyodide
import os
import json

def list_virtual_files():
    """List all files in the virtual file system"""
    result = []
    for root, dirs, files in os.walk('/home/pyodide'):
        for file in files:
            if not file.startswith('.') and not file.endswith('.py'):
                path = os.path.join(root, file)
                result.append(path)
    return result

def read_virtual_file(path):
    """Read a file from the virtual file system"""
    with open(path, 'r') as f:
        return f.read()
    
def write_virtual_file(path, content):
    """Write to a file in the virtual file system"""
    directory = os.path.dirname(path)
    if directory and not os.path.exists(directory):
        os.makedirs(directory, exist_ok=True)
    with open(path, 'w') as f:
        f.write(content)
    return True
''')
  `);
}

/**
 * Safely executes Python code and handles errors
 * @param pyodide The Pyodide instance
 * @param code The Python code to execute
 */

export async function executePythonCode(pyodide: any, code: string): Promise<{output: string, error?: string}> {
  console.log('[Pyodide] Starting code execution:', code.substring(0, 100) + (code.length > 100 ? '...' : ''));
  console.log('[Pyodide] Pyodide instance available:', !!pyodide);
  
  try {
    // Set up the environment for code execution
    console.log('[Pyodide] Setting up Python environment');
    
    // Set up stdout redirection
    pyodide.runPython(`
import sys
import io
import traceback

# Set up stdout capture
sys.stdout = io.StringIO()

# Import helper module for file operations
try:
  import file_helpers
  print("Successfully imported file_helpers module")
except ImportError as imp_err:
  print(f"Warning: Could not import file_helpers: {imp_err}")

print("--- Starting user code execution ---")
`);

    // Execute the user's code directly
    console.log('[Pyodide] Executing user code');
    pyodide.runPython(code);
    console.log('[Pyodide] User code executed successfully');
    
    // Check if there's a result variable to display
    pyodide.runPython(`
# Check for result variable
result = None
if 'result' in locals() and result is not None:
  print(f"Result: {result}")

print("--- User code execution completed ---")
`);
    
    // Get the captured output
    const output = pyodide.runPython(`sys.stdout.getvalue()`);
    console.log('[Pyodide] Code execution completed successfully');
    console.log('[Pyodide] Output:', output);
    console.log('[Pyodide] Output length:', output.length);
    
    // Create a decorated version with markers to help debugging where output gets lost
    const decoratedOutput = `===OUTPUT_START===\n${output}\n===OUTPUT_END===`;
    console.log('[Pyodide] Decorated output:', decoratedOutput);
    
    return { output };
  } catch (error: any) {
    console.error('[Pyodide] JavaScript exception during execution:', error);
    console.error('[Pyodide] Stack trace:', error.stack);
    
    let errorMessage = error.message || 'An unknown error occurred';
    let outputFromError = '';
    
    // Try to get more info from Python if possible
    try {
      // Check if we can still access stdout, which might have partial output
      const partialOutput = pyodide.runPython(`sys.stdout.getvalue() if hasattr(sys, 'stdout') and hasattr(sys.stdout, 'getvalue') else ""`);
      if (partialOutput) {
        console.log('[Pyodide] Partial output before error:', partialOutput);
        outputFromError = partialOutput;
      }
      
      // Try to get Python-specific error information
      const errorType = pyodide.runPython(`type(sys.last_value).__name__ if hasattr(sys, 'last_value') else "Unknown"`);
      const errorValue = pyodide.runPython(`str(sys.last_value) if hasattr(sys, 'last_value') else "Unknown error"`);
      
      if (errorType !== "Unknown") {
        console.error(`[Pyodide] Python error: ${errorType}: ${errorValue}`);
        
        // For file I/O errors, provide helpful guidance
        if (errorType === "OSError" && errorValue.includes("I/O error")) {
          const helpMessage = `
File I/O Error: Browser security restricts direct file access.

TIP: Use the virtual file system instead:
  - import file_helpers
  - file_helpers.write_virtual_file('/home/pyodide/data/myfile.txt', 'content')
  - file_helpers.read_virtual_file('/home/pyodide/data/example.txt')
  - file_helpers.list_virtual_files()`;
          
          errorMessage = helpMessage;
        } else {
          errorMessage = `${errorType}: ${errorValue}`;
        }
      }
    } catch (e) {
      console.error('[Pyodide] Failed to get additional error info:', e);
    }
    
    return { 
      output: outputFromError, 
      error: `Execution error: ${errorMessage}`
    };
  }
}
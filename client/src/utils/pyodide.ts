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
  try {
    // Capture stdout
    let stdOutput = '';
    pyodide.setStdout({
      write: (text: string) => {
        stdOutput += text;
      }
    });

    // Wrap the user's code to provide better error handling
    const wrappedCode = `
import sys
import traceback
import io

# Redirect stdout
sys.stdout = io.StringIO()

try:
    # Import helper module by default
    try:
        import file_helpers
    except ImportError:
        pass
    
    # Execute the user's code
    result = None
    exec("""${code.replace(/"/g, '\\"').replace(/\n/g, '\\n')}""")
    
    # Get any printed output
    output = sys.stdout.getvalue()
    
    # Print the final result if it exists
    if 'result' in locals() and result is not None:
        if output and not output.endswith('\\n'):
            output += '\\n'
        output += f"Result: {result}"
    
    print(output)
except Exception as e:
    # Handle any errors, especially file-related ones
    error_type = type(e).__name__
    if error_type == "OSError" and "I/O error" in str(e):
        print("File I/O Error: Browser security restricts direct file access.")
        print("\\nTIP: Use the virtual file system instead:")
        print("  - import file_helpers")
        print("  - file_helpers.write_virtual_file('/home/pyodide/data/myfile.txt', 'content')")
        print("  - file_helpers.read_virtual_file('/home/pyodide/data/example.txt')")
        print("  - file_helpers.list_virtual_files()")
    else:
        print(f"Error: {error_type}: {str(e)}")
        traceback.print_exc()
`;

    // Clean the code
    const cleanCode = dedent(wrappedCode); // removes leading margin indentation

    // Run the code
    await pyodide.runPythonAsync(cleanCode);
    
    return { output: stdOutput };
  } catch (error) {
    return { 
      output: '', 
      error: error.message || 'An unknown error occurred'
    };
  }
}

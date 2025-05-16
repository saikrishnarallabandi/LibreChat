import React, { useState, useEffect } from 'react';

const RunCodeTool = () => {
  const [code, setCode] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pyodideReady, setPyodideReady] = useState(false);
  const [pyodide, setPyodide] = useState(null);

  useEffect(() => {
    const loadPyodide = async () => {
      try {
        // Load Pyodide script
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js';
        script.async = true;
        
        script.onload = async () => {
          try {
            setOutput('Loading Python environment...');
            console.log('Loading Pyodide...');
            
            // Load Pyodide
            const pyodideInstance = await window.loadPyodide();
            console.log('✅ Pyodide loaded successfully');
            
            // Set up a simple test to verify it's working
            pyodideInstance.runPython(`print("Python environment initialized!")`);
            
            setPyodide(pyodideInstance);
            setPyodideReady(true);
            setOutput('Python environment ready! Try printing "Hello World" with: print("Hello World")');
          } catch (err) {
            console.error('❌ Error loading Pyodide:', err);
            setError('Failed to load Python environment: ' + err.message);
          }
        };
        
        // Add script to document
        document.body.appendChild(script);
      } catch (err) {
        console.error('❌ Error setting up Pyodide:', err);
        setError('Failed to setup Python environment: ' + err.message);
      }
    };

    loadPyodide();
  }, []);

  const runCode = async () => {
    console.log('▶️ Button clicked. Code:', code);
    
    if (!pyodideReady || !pyodide) {
      setError('Python environment is not ready yet. Please wait...');
      return;
    }

    setIsLoading(true);
    setOutput('');
    setError('');
    
    try {
      // Simple approach - directly run the code with basic output capture
      
      // Redirect stdout to capture print statements
      pyodide.runPython(`
import sys
import io
sys.stdout = io.StringIO()
      `);
      
      // Run the user's code
      pyodide.runPython(code);
      
      // Get the captured output
      const output = pyodide.runPython(`sys.stdout.getvalue()`);
      console.log('✅ Code executed, output:', output);
      
      setOutput(output || 'Code executed successfully (no output).');
    } catch (err) {
      console.error('❌ Error executing code:', err);
      setError(err.message || 'An error occurred while running the code');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ padding: 20, backgroundColor: '#f9f9f9', borderRadius: '8px', maxWidth: '800px', margin: '0 auto' }}>
      <h2 style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        Run Python Code 
        {!pyodideReady && <span style={{ fontSize: '14px', color: '#666', fontWeight: 'normal' }}>
          (Loading Python environment...)
        </span>}
        {pyodideReady && <span style={{ fontSize: '14px', color: 'green', fontWeight: 'normal' }}>
          (Ready)
        </span>}
      </h2>
      
      <div style={{ border: '1px solid #ddd', borderRadius: '4px', overflow: 'hidden' }}>
        <textarea
          rows={10}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="# Simple Hello World example
print('Hello World!')

# Try some basic math
a = 10
b = 5
print(f'{a} + {b} = {a + b}')
print(f'{a} * {b} = {a * b}')"
          style={{ 
            fontFamily: 'monospace', 
            width: '100%', 
            padding: '10px',
            border: 'none',
            boxSizing: 'border-box',
            resize: 'vertical'
          }}
        />
      </div>
      
      <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-end' }}>
        <button 
          onClick={runCode} 
          disabled={!pyodideReady || isLoading}
          style={{ 
            padding: '8px 20px', 
            fontSize: '16px',
            backgroundColor: !pyodideReady ? '#cccccc' : '#4CAF50', 
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: pyodideReady ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          {isLoading ? 'Running...' : '▶️ Run Code'}
        </button>
      </div>
      
      {(output || error) && (
        <div style={{
          marginTop: '20px',
          border: '1px solid ' + (error ? '#ffcccc' : '#e0e0e0'),
          borderRadius: '4px',
          backgroundColor: error ? '#fff8f8' : '#f0f0f0',
          padding: '10px',
          maxHeight: '300px',
          overflow: 'auto'
        }}>
          <div style={{ marginBottom: '5px', fontSize: '14px', color: error ? '#d32f2f' : '#333' }}>
            {error ? 'Error:' : 'Output:'}
          </div>
          <pre style={{ 
            whiteSpace: 'pre-wrap',
            margin: 0,
            fontFamily: 'monospace',
            fontSize: '14px',
            color: error ? '#d32f2f' : 'inherit',
            overflow: 'auto'
          }}>
            {error || output}
          </pre>
        </div>
      )}
    </div>
  );
};

export default RunCodeTool;

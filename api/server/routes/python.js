const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Create temporary directory for files if it doesn't exist
const TEMP_DIR = path.join(__dirname, '../../python_temp');
fs.mkdir(TEMP_DIR, { recursive: true }).catch(console.error);

/**
 * Test route to verify Python router is working
 * @route GET /api/python/test
 */
router.get('/test', (req, res) => {
  console.log('[PYTHON DEBUG] Test route called!');
  res.json({ message: 'Python router is working!', timestamp: new Date().toISOString() });
});

/**
 * Execute Python code with visualization support
 * @route POST /api/python/execute
 */
router.post('/execute', async (req, res) => {
  console.log(`[PYTHON DEBUG] Route /execute called!`);
  console.log(`[PYTHON DEBUG] Request body:`, req.body);
  
  const { code } = req.body;
  if (!code) {
    console.log(`[PYTHON DEBUG] No code provided in request`);
    return res.status(400).json({ error: 'No code provided' });
  }

  const executionId = uuidv4();
  const tempFilePath = path.join(TEMP_DIR, `${executionId}.py`);
  const outputDir = path.join(TEMP_DIR, executionId);

  console.log(`[PYTHON DEBUG] Execution ID: ${executionId}`);
  console.log(`[PYTHON DEBUG] Temp file path: ${tempFilePath}`);
  console.log(`[PYTHON DEBUG] User code to execute:`, code);
  
  try {
    // Create a directory for the execution outputs (e.g., images)
    await fs.mkdir(outputDir, { recursive: true });

    // Prepare the Python code with wrapper for visualization 
    const wrappedCode = `
import sys
import io
import os
import traceback
import base64
import json
import matplotlib
matplotlib.use('Agg')  # Use the Agg backend for file output
import matplotlib.pyplot as plt
import numpy as np

# Set the output directory for files
output_dir = "${outputDir.replace(/\\/g, '/')}"
os.makedirs(output_dir, exist_ok=True)

# Capture stdout
original_stdout = sys.stdout
sys.stdout = captured_stdout = io.StringIO()

figures = []
original_figure = plt.figure

def patched_figure(*args, **kwargs):
    fig = original_figure(*args, **kwargs)
    figures.append(fig)
    return fig
plt.figure = patched_figure

try:
    # Execute the user's code
    exec("""${code.replace(/"""/g, '\"\"\"')}""")
    # Save any figures that were created but not explicitly saved
    for i, fig in enumerate(figures):
        try:
            fig_path = os.path.join(output_dir, "figure_" + str(i) + ".png")
            fig.savefig(fig_path)
        except Exception as e:
            print("Error saving figure " + str(i) + ": " + str(e))
    # Get the captured stdout
    output = captured_stdout.getvalue()
    # List any images created in the output directory
    image_files = []
    for file in os.listdir(output_dir):
        if file.endswith(('.png', '.jpg', '.jpeg', '.svg')):
            file_path = os.path.join(output_dir, file)
            with open(file_path, 'rb') as img_file:
                img_data = base64.b64encode(img_file.read()).decode('utf-8')
                image_files.append({
                    'filename': file,
                    'data': img_data
                })
    # Return the results as JSON
    result = {
        'success': True,
        'output': output,
        'images': image_files
    }
    # Restore stdout before printing result
    sys.stdout = original_stdout
    print(json.dumps(result))
except Exception as e:
    error_type = type(e).__name__
    error_msg = str(e)
    error_traceback = traceback.format_exc()
    result = {
        'success': False,
        'error': {
            'type': error_type,
            'message': error_msg,
            'traceback': error_traceback
        }
    }
    # Restore stdout before printing error
    sys.stdout = original_stdout
    print(json.dumps(result))
`;

    // Write the code to a temporary file
    await fs.writeFile(tempFilePath, wrappedCode);
    console.log(`[PYTHON DEBUG] Wrote code to: ${tempFilePath}`);
    // Execute the Python code
    const python = spawn('python3', [tempFilePath]);
    let stdoutData = '';
    let stderrData = '';
    python.stdout.on('data', (data) => {
      console.log(`[PYTHON DEBUG] stdout:`, data.toString());
      stdoutData += data.toString();
    });
    python.stderr.on('data', (data) => {
      console.log(`[PYTHON DEBUG] stderr:`, data.toString());
      stderrData += data.toString();
    });
    python.on('close', async (code) => {
      console.log(`[PYTHON DEBUG] Process exited with code: ${code}`);
      // Clean up the temporary file
      await fs.unlink(tempFilePath).catch(console.error);
      if (code !== 0) {
        console.log(`[PYTHON DEBUG] Non-zero exit code. stderr:`, stderrData);
        return res.status(500).json({
          success: false,
          error: stderrData || 'Python process exited with non-zero code'
        });
      }
      try {
        console.log(`[PYTHON DEBUG] Raw stdoutData:`, stdoutData);
        // Try to parse the stdout as JSON (our wrapper should produce JSON)
        const result = JSON.parse(stdoutData);
        console.log(`[PYTHON DEBUG] Parsed result:`, result);
        res.json(result);
      } catch (error) {
        console.log(`[PYTHON DEBUG] Failed to parse JSON. Error:`, error, 'Raw:', stdoutData);
        res.status(500).json({
          success: false,
          error: 'Failed to parse Python output',
          rawOutput: stdoutData,
          stderr: stderrData
        });
      }
      // Clean up the output directory asynchronously
      setTimeout(async () => {
        try {
          await fs.rm(outputDir, { recursive: true, force: true });
        } catch (error) {
          console.error(`Failed to clean up output directory: ${error.message}`);
        }
      }, 30000); // Clean up after 30 seconds
    });
    
  } catch (error) {
    console.error(`Python execution failed: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

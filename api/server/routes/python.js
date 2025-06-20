const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { getLogStores } = require('~/cache/getLogStores');

// Create temporary directory for files if it doesn't exist
const TEMP_DIR = path.join(__dirname, '../../python_temp');
fs.mkdir(TEMP_DIR, { recursive: true }).catch(console.error);

/**
 * Execute Python code with visualization support
 * @route POST /api/python/execute
 */
router.post('/execute', async (req, res) => {
  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ error: 'No code provided' });
  }

  const logger = getLogStores('python_execution');
  const executionId = uuidv4();
  const tempFilePath = path.join(TEMP_DIR, `${executionId}.py`);
  const outputDir = path.join(TEMP_DIR, executionId);
  
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

# Override the figure function to track created figures
def patched_figure(*args, **kwargs):
    fig = original_figure(*args, **kwargs)
    figures.append(fig)
    return fig

plt.figure = patched_figure

try:
    # Execute the user's code
    exec("""${code.replace(/"/g, '\\"').replace(/\n/g, '\\n')}""")
    
    # Save any figures that were created but not explicitly saved
    for i, fig in enumerate(figures):
        try:
            fig_path = os.path.join(output_dir, f"figure_{i}.png")
            fig.savefig(fig_path)
        except Exception as e:
            print(f"Error saving figure {i}: {e}")
    
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
    print(json.dumps(result))

finally:
    # Restore stdout
    sys.stdout = original_stdout
`;

    // Write the code to a temporary file
    await fs.writeFile(tempFilePath, wrappedCode);
    
    // Execute the Python code
    const python = spawn('python3', [tempFilePath]);
    
    let stdoutData = '';
    let stderrData = '';
    
    python.stdout.on('data', (data) => {
      stdoutData += data.toString();
    });
    
    python.stderr.on('data', (data) => {
      stderrData += data.toString();
      logger.error(`Python execution error [${executionId}]: ${data.toString()}`);
    });
    
    python.on('close', async (code) => {
      // Clean up the temporary file
      await fs.unlink(tempFilePath).catch(console.error);
      
      if (code !== 0) {
        return res.status(500).json({
          success: false,
          error: stderrData || 'Python process exited with non-zero code'
        });
      }
      
      try {
        // Try to parse the stdout as JSON (our wrapper should produce JSON)
        const result = JSON.parse(stdoutData);
        res.json(result);
      } catch (error) {
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
          logger.error(`Failed to clean up output directory: ${error.message}`);
        }
      }, 30000); // Clean up after 30 seconds
    });
    
  } catch (error) {
    logger.error(`Python execution failed: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

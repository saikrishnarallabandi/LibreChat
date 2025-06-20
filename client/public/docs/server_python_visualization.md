# Server-side Python Visualization

LibreChat now supports server-side visualization with matplotlib and other Python libraries. This approach is more powerful than browser-based execution as it:

1. Uses the full Python environment with all dependencies installed
2. Supports complex visualizations with matplotlib, numpy, pandas, and more
3. Handles larger datasets and more computationally intensive operations
4. Automatically renders images and returns them to the browser

## Using Python Visualization in Chat

When writing Python code in chat that uses visualization libraries:

1. Simply include `matplotlib` or any plotting commands (`plt.plot()`, etc.) in your code
2. Click the "Run" button with the server icon
3. The code will be executed on the server and the plots will be displayed in the chat

## Example Code

```python
import matplotlib.pyplot as plt
import numpy as np

# Generate data
x = np.linspace(0, 10, 100)
y = np.sin(x)

# Create plot
plt.figure(figsize=(8, 5))
plt.plot(x, y, 'b-', linewidth=2)
plt.title('Sine Wave')
plt.xlabel('x')
plt.ylabel('sin(x)')
plt.grid(True)

# No need to call any special display function
# The server automatically captures and displays the plot
```

## Supported Libraries

The server environment includes:

- **matplotlib**: For creating static, animated, and interactive visualizations
- **numpy**: For numerical computing
- **pandas**: For data manipulation and analysis
- **scipy**: For scientific computing
- **pillow**: For image processing

## How It Works

When you run Python code with visualization:

1. The code is sent to the server's `/api/python/execute` endpoint
2. The code is executed in a secure environment
3. Any figures created with matplotlib are automatically saved
4. The figures are encoded as base64 and returned to the browser
5. The browser displays the figures in the chat interface

## Security and Limitations

- All code execution happens in a sandboxed environment on the server
- Temporary files created during execution are automatically cleaned up
- There are resource limits to prevent excessive computation
- File system access is restricted to temporary directories

See `/home2/srallaba/projects/project_assistant/repos/LibreChat_fork/LibreChat/client/public/examples/server_matplotlib_example.py` for a comprehensive example showing multiple plot types.

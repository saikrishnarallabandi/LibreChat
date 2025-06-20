# Pyodide Data Visualization

LibreChat now supports Matplotlib and other visualization libraries directly in the browser using Pyodide (Python in the browser).

## How It Works

The implementation includes:

1. Automatic configuration of Matplotlib with the AGG backend for rendering in the browser
2. Helper utilities for converting and displaying plots as images
3. A simple installation button for users to install matplotlib when needed

## Using Matplotlib

When working with Python code blocks:

1. If you see an "Install Matplotlib" button, click it to install matplotlib and numpy
2. Once installed, you can use matplotlib in your Python code
3. To display plots in the browser, use the helper functions:

```python
import matplotlib.pyplot as plt
import numpy as np

# Create your plot
x = np.linspace(0, 10, 100)
y = np.sin(x)
plt.figure(figsize=(8, 5))
plt.plot(x, y)
plt.title('Sine Wave')
plt.grid(True)

# Import the helper to display the figure
from matplotlib_helpers import display_figure

# Show the plot in the browser
display_figure(plt.gcf())
```

## Available Visualization Features

- Basic plotting with matplotlib
- NumPy integration for data manipulation
- Multiple plot types: line, scatter, bar, etc.
- Figure/subplot management
- Custom styling and formatting

## Technical Implementation

The implementation uses:

1. Pyodide's micropip to install matplotlib and dependencies
2. The AGG (Anti-Grain Geometry) backend which is suitable for headless environments
3. Base64 encoding to convert plots to images that can be displayed in the DOM
4. Helper modules that are pre-installed in the virtual filesystem

See `/home2/srallaba/projects/project_assistant/repos/LibreChat_fork/LibreChat/client/public/examples/matplotlib_demo.py` for a comprehensive example.

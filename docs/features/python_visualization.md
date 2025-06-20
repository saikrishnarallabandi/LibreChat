# Server-Side Python Visualization in LibreChat

## Overview

LibreChat includes server-side Python execution with full visualization support, allowing users to create and display matplotlib plots, charts, and other visualizations directly in chat conversations.

## Features

- Full matplotlib support with the AGG backend
- Support for numpy, pandas, scipy and more
- Automatic figure detection and rendering
- Browser-based Python execution for simple code (without visualization)
- Server-side execution for complex visualization and data processing

## Usage

1. Type or paste Python code with matplotlib in a chat message
2. Run the code by clicking the "Run" button
3. The code is executed on the server and the plots are displayed in the chat

## Technical Details

### Server-Side Implementation

The server-side implementation includes:

- A dedicated `/api/python/execute` endpoint
- A Python execution environment with visualization libraries installed
- Automatic figure detection and capture
- Temporary file management for security
- Base64 encoding for figure transfer to the browser

### Client-Side Implementation

The client-side implementation includes:

- Automatic detection of visualization code
- Specialized UI for server vs. browser execution
- Image rendering and display in the chat interface

## Docker Configuration

The Docker configuration includes all necessary Python packages:

- matplotlib
- numpy 
- pandas
- scipy
- pillow

## Example

```python
import matplotlib.pyplot as plt
import numpy as np

# Generate data
x = np.linspace(0, 10, 100)
y = np.sin(x)

# Create plot
plt.figure(figsize=(8, 5))
plt.plot(x, y)
plt.title('Sine Wave')
plt.grid(True)

# No need for special display functions
# Server automatically captures and displays plots
```

See `/client/public/examples/server_matplotlib_example.py` for more examples.

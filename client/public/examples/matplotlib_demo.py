```python
# Matplotlib Visualization Example in Pyodide
import matplotlib.pyplot as plt
import numpy as np

# Generate some data for the plots
x = np.linspace(0, 10, 100)
y1 = np.sin(x)
y2 = np.cos(x)

# Create a figure with multiple subplots
fig, axs = plt.subplots(2, 1, figsize=(10, 8))

# Plot sine wave
axs[0].plot(x, y1, 'b-', linewidth=2)
axs[0].set_title('Sine Wave')
axs[0].set_xlabel('x')
axs[0].set_ylabel('sin(x)')
axs[0].grid(True)

# Plot cosine wave
axs[1].plot(x, y2, 'r-', linewidth=2)
axs[1].set_title('Cosine Wave')
axs[1].set_xlabel('x')
axs[1].set_ylabel('cos(x)')
axs[1].grid(True)

# Adjust layout
plt.tight_layout()

# Import the helper function to display plots in the browser
from matplotlib_helpers import display_figure

# Display the figure
display_figure(fig)

# You can also create a scatter plot
plt.figure(figsize=(8, 6))
n = 50
x = np.random.rand(n)
y = np.random.rand(n)
colors = np.random.rand(n)
area = (30 * np.random.rand(n))**2  

plt.scatter(x, y, s=area, c=colors, alpha=0.5)
plt.title('Scatter Plot Example')
plt.xlabel('X axis')
plt.ylabel('Y axis')
plt.grid(True)

# Display this figure too
display_figure(plt.gcf())
```

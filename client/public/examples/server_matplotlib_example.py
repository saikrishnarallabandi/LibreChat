```python
# Server-side Matplotlib Visualization Example

# Import libraries
import matplotlib.pyplot as plt
import numpy as np

# Create a figure with multiple subplots
fig, axs = plt.subplots(2, 2, figsize=(10, 8))

# Subplot 1: Line plot with sine wave
x = np.linspace(0, 10, 100)
y1 = np.sin(x)
axs[0, 0].plot(x, y1, 'b-', linewidth=2)
axs[0, 0].set_title('Sine Wave')
axs[0, 0].set_xlabel('x')
axs[0, 0].set_ylabel('sin(x)')
axs[0, 0].grid(True)

# Subplot 2: Scatter plot
n = 50
x = np.random.rand(n)
y = np.random.rand(n)
colors = np.random.rand(n)
area = (30 * np.random.rand(n))**2
axs[0, 1].scatter(x, y, s=area, c=colors, alpha=0.5)
axs[0, 1].set_title('Scatter Plot')
axs[0, 1].set_xlabel('X')
axs[0, 1].set_ylabel('Y')
axs[0, 1].grid(True)

# Subplot 3: Bar chart
labels = ['Group A', 'Group B', 'Group C', 'Group D']
values = [25, 40, 30, 55]
axs[1, 0].bar(labels, values, color=['blue', 'orange', 'green', 'red'])
axs[1, 0].set_title('Bar Chart')
axs[1, 0].set_ylabel('Values')
axs[1, 0].grid(True, axis='y')

# Subplot 4: Pie chart
sizes = [15, 30, 45, 10]
explode = (0, 0.1, 0, 0)  # only "explode" the 2nd slice
axs[1, 1].pie(sizes, explode=explode, labels=labels, autopct='%1.1f%%',
        shadow=True, startangle=90)
axs[1, 1].axis('equal')  # Equal aspect ratio ensures that pie is drawn as a circle
axs[1, 1].set_title('Pie Chart')

# Adjust layout to prevent overlap
plt.tight_layout()

# The server-side renderer will automatically save and display these plots
# No need to call plt.show() as the server handles the display
```

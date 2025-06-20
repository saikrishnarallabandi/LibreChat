```python
# Advanced Visualization Examples for LibreChat Server-Side Rendering

# Standard imports
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
from matplotlib import cm
from datetime import datetime, timedelta

# ==========================================================
# Example 1: Advanced Time Series with Multiple Panels
# ==========================================================
def create_time_series_example():
    # Create sample time series data
    np.random.seed(42)
    dates = [datetime.now() - timedelta(days=x) for x in range(180)]
    data = pd.DataFrame({
        'date': dates,
        'value1': np.cumsum(np.random.randn(180) * 0.1 + 0.1),
        'value2': np.cumsum(np.random.randn(180) * 0.15 + 0.05),
        'volume': np.random.randint(1000, 5000, size=180),
        'events': np.random.choice([0, 0, 0, 1], size=180)  # Rare events
    })
    
    # Create a figure with subplots
    fig, (ax1, ax2, ax3) = plt.subplots(3, 1, figsize=(10, 12), sharex=True, 
                                        gridspec_kw={'height_ratios': [3, 1, 1]})
    
    # Main time series plot with dual axis
    ax1.plot(data['date'], data['value1'], 'b-', linewidth=2, label='Metric 1')
    ax1.plot(data['date'], data['value2'], 'r-', linewidth=2, label='Metric 2')
    ax1.set_ylabel('Values', fontsize=12)
    ax1.set_title('Advanced Time Series Visualization', fontsize=14)
    ax1.legend(loc='upper left')
    ax1.grid(True, alpha=0.3)
    
    # Highlight event periods
    for i, (idx, row) in enumerate(data[data['events'] == 1].iterrows()):
        ax1.axvspan(row['date'] - timedelta(days=1), 
                   row['date'] + timedelta(days=1), 
                   color='yellow', alpha=0.3)
        ax1.annotate(f'Event {i+1}', (row['date'], max(row['value1'], row['value2'])),
                    xytext=(10, 20), textcoords='offset points',
                    arrowprops=dict(arrowstyle='->', color='black'))
    
    # Volume subplot
    ax2.bar(data['date'], data['volume'], color='gray', alpha=0.7, width=1)
    ax2.set_ylabel('Volume', fontsize=12)
    ax2.grid(True, axis='y', alpha=0.3)
    
    # Moving average comparison
    ax3.plot(data['date'], data['value1'].rolling(window=7).mean(), 'b-', 
             label='MA-7 Metric 1')
    ax3.plot(data['date'], data['value1'].rolling(window=30).mean(), 'b--', 
             label='MA-30 Metric 1')
    ax3.plot(data['date'], data['value2'].rolling(window=7).mean(), 'r-', 
             label='MA-7 Metric 2')
    ax3.plot(data['date'], data['value2'].rolling(window=30).mean(), 'r--', 
             label='MA-30 Metric 2')
    ax3.set_ylabel('Moving Avg', fontsize=12)
    ax3.set_xlabel('Date', fontsize=12)
    ax3.legend(loc='upper left', ncol=2, fontsize=8)
    ax3.grid(True, alpha=0.3)
    
    # Format the date axis
    plt.xticks(rotation=45)
    fig.tight_layout()
    
    return fig

# ==========================================================
# Example 2: Advanced Statistical Visualization with Seaborn
# ==========================================================
def create_statistical_visualization():
    # Generate sample data
    np.random.seed(42)
    n_samples = 200
    
    # Create a dataframe with multiple correlated variables
    data = pd.DataFrame({
        'feature1': np.random.normal(0, 1, n_samples),
        'feature2': np.random.normal(5, 2, n_samples),
        'feature3': np.random.normal(-3, 1.5, n_samples),
        'target': np.random.normal(0, 1, n_samples)
    })
    
    # Add some correlations
    data['feature2'] = data['feature2'] + data['feature1'] * 0.5
    data['feature3'] = data['feature3'] - data['feature1'] * 0.3
    data['target'] = data['feature1'] * 0.7 + data['feature2'] * 0.2 - data['feature3'] * 0.5 + np.random.normal(0, 1, n_samples)
    
    # Add categorical variable
    data['category'] = pd.qcut(data['target'], 4, labels=['Low', 'Medium-Low', 'Medium-High', 'High'])
    
    # Create a figure with multiple seaborn plots
    fig = plt.figure(figsize=(12, 12))
    
    # Plot 1: Pairplot in the main area
    grid = plt.GridSpec(2, 2, wspace=0.4, hspace=0.3)
    
    # Heatmap of correlations
    ax1 = plt.subplot(grid[0, 0])
    sns.heatmap(data.corr(), annot=True, cmap='coolwarm', linewidths=.5, vmin=-1, vmax=1, ax=ax1)
    ax1.set_title('Correlation Matrix', fontsize=12)
    
    # Distribution plot
    ax2 = plt.subplot(grid[0, 1])
    for col in ['feature1', 'feature2', 'feature3']:
        sns.kdeplot(data[col], label=col, ax=ax2)
    ax2.set_title('Feature Distributions', fontsize=12)
    ax2.legend()
    
    # Scatter plot with regression line
    ax3 = plt.subplot(grid[1, 0])
    sns.regplot(x='feature1', y='target', data=data, ax=ax3, scatter_kws={'alpha':0.5})
    ax3.set_title('Feature1 vs Target with Regression', fontsize=12)
    
    # Boxplot by category
    ax4 = plt.subplot(grid[1, 1])
    sns.boxplot(x='category', y='feature1', data=data, palette='viridis', ax=ax4)
    ax4.set_title('Feature1 Distribution by Target Category', fontsize=12)
    
    plt.tight_layout()
    
    return fig

# ==========================================================
# Example 3: 3D Surface Plot with Interactive Elements
# ==========================================================
def create_3d_surface_plot():
    # Create sample 3D data
    x = np.linspace(-5, 5, 100)
    y = np.linspace(-5, 5, 100)
    X, Y = np.meshgrid(x, y)
    
    # Create multiple surfaces
    Z1 = np.sin(np.sqrt(X**2 + Y**2))
    Z2 = np.cos(np.sqrt(X**2 + Y**2)) * np.exp(-np.sqrt(X**2 + Y**2)/5)
    
    # Create 3D plots
    fig = plt.figure(figsize=(15, 8))
    
    # First surface
    ax1 = fig.add_subplot(121, projection='3d')
    surf1 = ax1.plot_surface(X, Y, Z1, cmap=cm.viridis, linewidth=0, antialiased=True, alpha=0.7)
    ax1.set_title('Sine Surface', fontsize=14)
    ax1.set_xlabel('X axis', fontsize=10)
    ax1.set_ylabel('Y axis', fontsize=10)
    ax1.set_zlabel('Z axis', fontsize=10)
    
    # Add a color bar
    fig.colorbar(surf1, ax=ax1, shrink=0.5, aspect=5)
    
    # Add contour projection
    offset = -1.5
    cset = ax1.contour(X, Y, Z1, zdir='z', offset=offset, cmap=cm.coolwarm)
    ax1.set_zlim(offset, 1.5)
    
    # Second surface
    ax2 = fig.add_subplot(122, projection='3d')
    surf2 = ax2.plot_surface(X, Y, Z2, cmap=cm.plasma, linewidth=0, antialiased=True, alpha=0.7)
    ax2.set_title('Damped Cosine Surface', fontsize=14)
    ax2.set_xlabel('X axis', fontsize=10)
    ax2.set_ylabel('Y axis', fontsize=10)
    ax2.set_zlabel('Z axis', fontsize=10)
    
    # Add a color bar
    fig.colorbar(surf2, ax=ax2, shrink=0.5, aspect=5)
    
    # Add a few specific points of interest
    points_x = [-3, 0, 3, -2, 2]
    points_y = [3, 0, -3, -2, 2]
    points_z = [Z2[np.searchsorted(y, point_y), np.searchsorted(x, point_x)] 
                for point_x, point_y in zip(points_x, points_y)]
    
    ax2.scatter(points_x, points_y, points_z, color='red', s=50, marker='o')
    
    # Add text annotations to the points
    for i, (x_p, y_p, z_p) in enumerate(zip(points_x, points_y, points_z)):
        ax2.text(x_p, y_p, z_p + 0.1, f'P{i+1}', color='black', fontsize=9)
    
    plt.tight_layout()
    
    return fig

# Create and display all examples
create_time_series_example()
create_statistical_visualization()
create_3d_surface_plot()
```

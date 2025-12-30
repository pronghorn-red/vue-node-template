/**
 * Chart.js Dark Mode Plugin
 * Provides native dark mode support for all chart types
 */

export const chartDarkModePlugin = {
  id: 'darkModePlugin',
  
  afterDatasetsDraw(chart) {
    const isDarkMode = document.documentElement.classList.contains('dark');
    
    // Update chart colors based on dark mode - brighter text for readability
    const textColor = isDarkMode ? '#ffffff' : '#1f2937';
    const gridColor = isDarkMode ? 'rgba(51, 65, 85, 0.3)' : 'rgba(226, 232, 240, 0.5)';
    const borderColor = isDarkMode ? '#475569' : '#e2e8f0';
    
    // Update scales
    if (chart.scales) {
      Object.values(chart.scales).forEach(scale => {
        if (scale.ticks) {
          scale.ticks.color = textColor;
        }
        if (scale.grid) {
          scale.grid.color = gridColor;
          scale.grid.borderColor = borderColor;
        }
      });
    }
    
    // Update legend
    if (chart.legend) {
      chart.legend.labelFontColor = textColor;
    }
  }
};

/**
 * Get chart options with dark mode support
 * @param {boolean} isDarkMode - Whether dark mode is enabled
 * @returns {Object} Chart options object
 */
export function getChartOptions(isDarkMode = false) {
  // Brighter text colors for better readability in dark mode
  const textColor = isDarkMode ? '#ffffff' : '#1f2937';
  const gridColor = isDarkMode ? 'rgba(51, 65, 85, 0.3)' : 'rgba(226, 232, 240, 0.5)';
  const borderColor = isDarkMode ? '#475569' : '#e2e8f0';
  const tooltipBg = isDarkMode ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)';
  const tooltipTextColor = isDarkMode ? '#ffffff' : '#1f2937';
  const canvasBg = isDarkMode ? '#0f172a' : '#ffffff';

  return {
    maintainAspectRatio: false,
    responsive: true,
    plugins: {
      legend: {
        labels: {
          color: textColor,
          font: {
            family: "'Inter', system-ui, -apple-system, sans-serif",
            size: 12,
            weight: '500'
          },
          usePointStyle: true,
          padding: 15,
          boxWidth: 8,
          boxHeight: 8
        },
        position: 'top'
      },
      tooltip: {
        backgroundColor: tooltipBg,
        titleColor: tooltipTextColor,
        bodyColor: tooltipTextColor,
        borderColor: borderColor,
        borderWidth: 1,
        padding: 12,
        displayColors: true,
        cornerRadius: 4,
        callbacks: {
          labelColor: function() {
            return { 
              backgroundColor: '#3b82f6',
              borderRadius: 2
            }
          }
        }
      },
      filler: {
        propagate: true
      }
    },
    scales: {
      y: {
        ticks: {
          color: textColor,
          font: {
            size: 11,
            family: "'Inter', system-ui, -apple-system, sans-serif"
          },
          padding: 8
        },
        grid: {
          color: gridColor,
          drawBorder: true,
          borderColor: borderColor,
          borderWidth: 1
        },
        border: {
          color: borderColor,
          width: 1
        }
      },
      x: {
        ticks: {
          color: textColor,
          font: {
            size: 11,
            family: "'Inter', system-ui, -apple-system, sans-serif"
          },
          padding: 8
        },
        grid: {
          color: gridColor,
          drawBorder: true,
          borderColor: borderColor,
          borderWidth: 1
        },
        border: {
          color: borderColor,
          width: 1
        }
      }
    }
  };
}

/**
 * Canvas background plugin for dark mode
 */
export const canvasBackgroundPlugin = {
  id: 'canvasBackground',
  
  beforeDraw(chart) {
    const isDarkMode = document.documentElement.classList.contains('dark');
    const canvasBg = isDarkMode ? '#0f172a' : '#ffffff';
    
    const ctx = chart.ctx;
    ctx.save();
    ctx.fillStyle = canvasBg;
    ctx.fillRect(0, 0, chart.width, chart.height);
    ctx.restore();
  }
};

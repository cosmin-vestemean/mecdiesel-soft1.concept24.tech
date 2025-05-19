// Chart Helper Functions
// This file provides utility functions for creating and customizing charts

/**
 * Generates an array of colors with a specified opacity
 * @param {number} count - Number of colors to generate
 * @param {number} opacity - Opacity value between 0 and 1
 * @returns {Array} Array of color strings in rgba format
 */
export function generateChartColors(count, opacity = 0.7) {
  const baseColors = [
    [255, 99, 132],   // red
    [54, 162, 235],   // blue
    [255, 206, 86],   // yellow
    [75, 192, 192],   // teal
    [153, 102, 255],  // purple
    [255, 159, 64],   // orange
    [199, 199, 199],  // grey
    [83, 180, 60],    // green
    [201, 203, 207],  // light grey
    [255, 99, 71]     // tomato
  ];

  const colors = [];
  for (let i = 0; i < count; i++) {
    const colorIndex = i % baseColors.length;
    const [r, g, b] = baseColors[colorIndex];
    colors.push(`rgba(${r}, ${g}, ${b}, ${opacity})`);
  }

  return colors;
}

/**
 * Formats a number with thousands separators
 * @param {number} value - Number to format
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted number string
 */
export function formatNumber(value, decimals = 0) {
  if (value === null || value === undefined || isNaN(value)) {
    return '';
  }
  return parseFloat(value).toLocaleString(undefined, { 
    minimumFractionDigits: decimals, 
    maximumFractionDigits: decimals 
  });
}

/**
 * Creates a Pareto chart configuration for Chart.js
 * @param {Object} options - Chart options
 * @param {Array} options.labels - X-axis labels
 * @param {Array} options.values - Values for the bars
 * @param {string} options.title - Chart title
 * @param {string} options.xAxisLabel - Label for X axis
 * @param {string} options.yAxisLabel - Label for Y axis
 * @returns {Object} Chart.js configuration object
 */
export function createParetoChartConfig(options) {
  const { labels, values, title, xAxisLabel, yAxisLabel } = options;
  
  // Calculate cumulative percentage
  let totalValue = values.reduce((sum, value) => sum + value, 0);
  let cumulativeValue = 0;
  const cumulativePercentage = values.map(value => {
    cumulativeValue += value;
    return (cumulativeValue / totalValue) * 100;
  });

  return {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: yAxisLabel || 'Value',
          data: values,
          backgroundColor: 'rgba(54, 162, 235, 0.5)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1,
          order: 2
        },
        {
          label: 'Cumulative %',
          data: cumulativePercentage,
          type: 'line',
          fill: false,
          borderColor: 'rgba(255, 99, 132, 1)',
          backgroundColor: 'rgba(255, 99, 132, 1)',
          pointBackgroundColor: 'rgba(255, 99, 132, 1)',
          pointRadius: 3,
          pointHoverRadius: 5,
          tension: 0.4,
          yAxisID: 'y1',
          order: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: yAxisLabel || 'Value'
          }
        },
        y1: {
          beginAtZero: true,
          max: 100,
          position: 'right',
          grid: {
            drawOnChartArea: false,
          },
          title: {
            display: true,
            text: 'Cumulative %'
          }
        },
        x: {
          title: {
            display: true,
            text: xAxisLabel || ''
          },
          ticks: {
            maxRotation: 90,
            minRotation: 45
          }
        }
      },
      plugins: {
        title: {
          display: true,
          text: title || 'Pareto Chart'
        },
        legend: {
          position: 'top',
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const datasetLabel = context.dataset.label;
              const value = context.parsed.y;
              if (datasetLabel === 'Cumulative %') {
                return `${datasetLabel}: ${value.toFixed(2)}%`;
              }
              return `${datasetLabel}: ${formatNumber(value)}`;
            }
          }
        }
      }
    }
  };
}

/**
 * Get a color for an ABC class
 * @param {string} abcClass - The ABC class (A, B, C)
 * @param {number} opacity - Opacity value between 0 and 1
 * @returns {string} Color in rgba format
 */
export function getAbcClassColor(abcClass, opacity = 0.7) {
  switch(abcClass.toUpperCase()) {
    case 'A': return `rgba(255, 99, 132, ${opacity})`;
    case 'B': return `rgba(54, 162, 235, ${opacity})`;
    case 'C': return `rgba(255, 206, 86, ${opacity})`;
    default: return `rgba(75, 192, 192, ${opacity})`;
  }
}

/**
 * Creates default chart options with sensible defaults
 * @param {Object} options - Chart options to override defaults
 * @returns {Object} Chart options
 */
export function createDefaultChartOptions(options = {}) {
  const defaultOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: options.title || 'Chart'
      },
      tooltip: {
        mode: 'index',
        intersect: false,
      }
    }
  };

  return { ...defaultOptions, ...options };
}
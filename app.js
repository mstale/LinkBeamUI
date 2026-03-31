function analyze() {
    const spans = document.getElementById('spans').value
      .split(',').map(Number);
  
    // 1. Build beam positions array (points along beam)
    // 2. Solve reactions using stiffness matrix (for continuous spans)
    // 3. Loop vehicle across bridge, calculate moment/shear at each point
    // 4. Envelope the max/min values
    // 5. Plot results with Plotly
    
    plotResults(momentEnvelope, shearEnvelope);
  }
  
  function plotResults(moment, shear) {
    Plotly.newPlot('momentChart', [{
      y: moment.max, name: 'Max Moment', fill: 'tozeroy'
    }, {
      y: moment.min, name: 'Min Moment', fill: 'tozeroy'
    }]);
  }
const express = require('express');
const WebSocket = require('ws');
const InfluxDBService = require('./src/config/influxdb');

const app = express();
const server = require('http').createServer(app);
const wss = new WebSocket.Server({ server });

const API_BASE_URL = process.env.REACT_APP_API_URL | 'http://localhost:8080/api/epics';

// Initialize InfluxDB
const influxDB = new InfluxDBService();

// Your existing EPICS data fetching logic
let currentPVData = {};
let errors = {};

// Modified function to include InfluxDB writing
async function fetchEPICSData() {
  try {
    // Your existing EPICS data fetching logic
    const response = await fetch(`${API_BASE_URL}/pvs`);
    const data = await response.json();
    
    currentPVData = data.pvData || {};
    errors = data.errors || {};
    
    // Write to InfluxDB (batch write for better performance)
    if (Object.keys(currentPVData).length > 0) {
      await influxDB.writeBatchPVData(currentPVData, 'default-system');
    }
    
    // Broadcast to WebSocket clients (your existing logic)
    const message = JSON.stringify({
      type: 'pvData',
      data: currentPVData,
      errors: errors,
      timestamp: Date.now()
    });
    
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
    
  } catch (error) {
    console.error('Error fetching EPICS data:', error);
  }
}

// Start periodic data fetching
setInterval(fetchEPICSData, 1000); // Every second

// Add new API endpoints for historical data
app.get('/api/history/pv/:pvName', async (req, res) => {
  try {
    const { pvName } = req.params;
    const { timeRange = '1h', aggregation = 'mean', interval = '1m' } = req.query;
    
    const history = await influxDB.queryPVHistory(pvName, timeRange, aggregation, interval);
    res.json({ success: true, data: history });
  } catch (error) {
    console.error('Error fetching PV history:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/history/multiple', async (req, res) => {
  try {
    const { pvNames, timeRange = '1h', aggregation = 'mean', interval = '1m' } = req.query;
    const pvNamesArray = Array.isArray(pvNames) ? pvNames : [pvNames];
    
    const history = await influxDB.queryMultiplePVHistory(pvNamesArray, timeRange, aggregation, interval);
    res.json({ success: true, data: history });
  } catch (error) {
    console.error('Error fetching multiple PV history:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/history/alarms', async (req, res) => {
  try {
    const { timeRange = '24h', severity } = req.query;
    
    const alarms = await influxDB.queryAlarmEvents(timeRange, severity);
    res.json({ success: true, data: alarms });
  } catch (error) {
    console.error('Error fetching alarm history:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await influxDB.close();
  process.exit(0);
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
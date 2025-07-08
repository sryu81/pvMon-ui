class HistoryService {
  constructor() {
    this.baseURL = 'http://localhost:3001';
  }

  /**
   * Get historical data for a single PV
   */
  async getPVHistory(pvName, timeRange = '1h', aggregation = 'mean', interval = '1m') {
    try {
      const response = await fetch(
        `${this.baseURL}/api/history/pv/${encodeURIComponent(pvName)}?` +
        `timeRange=${timeRange}&aggregation=${aggregation}&interval=${interval}`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      return result.success ? result.data : [];
    } catch (error) {
      console.error(`Error fetching history for ${pvName}:`, error);
      return [];
    }
  }

  /**
   * Get historical data for multiple PVs
   */
  async getMultiplePVHistory(pvNames, timeRange = '1h', aggregation = 'mean', interval = '1m') {
    try {
      const queryParams = new URLSearchParams();
      pvNames.forEach(pv => queryParams.append('pvNames', pv));
      queryParams.append('timeRange', timeRange);
      queryParams.append('aggregation', aggregation);
      queryParams.append('interval', interval);

      const response = await fetch(`${this.baseURL}/api/history/multiple?${queryParams}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      return result.success ? result.data : {};
    } catch (error) {
      console.error('Error fetching multiple PV history:', error);
      return {};
    }
  }

  /**
   * Get alarm events
   */
  async getAlarmHistory(timeRange = '24h', severity = null) {
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('timeRange', timeRange);
      if (severity) {
        queryParams.append('severity', severity);
      }

      const response = await fetch(`${this.baseURL}/api/history/alarms?${queryParams}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      return result.success ? result.data : [];
    } catch (error) {
      console.error('Error fetching alarm history:', error);
      return [];
    }
  }
}

export default new HistoryService();
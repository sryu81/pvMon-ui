const { InfluxDB, Point } = require('@influxdata/influxdb-client');
const { OrgsAPI, BucketsAPI } = require('@influxdata/influxdb-client-apis');

class InfluxDBService {
  constructor() {
    // InfluxDB configuration
    this.url = process.env.INFLUXDB_URL || 'http://localhost:8086';
    this.token = process.env.INFLUXDB_TOKEN || '06pwUPbfXqLF7B9g3nChxBEYQLVL0D7fON8kxH4zmn-JYsHEUX15aKf10LFmQm4Ear97peKRgjYC3dh3W6WeRw==';
    this.org = process.env.INFLUXDB_ORG || 'epics-org';
    this.bucket = process.env.INFLUXDB_BUCKET || 'epics-data';
    
    // Initialize InfluxDB client
    this.influxDB = new InfluxDB({ url: this.url, token: this.token });
    this.writeApi = this.influxDB.getWriteApi(this.org, this.bucket);
    this.queryApi = this.influxDB.getQueryApi(this.org);
    
    // Configure write options
    this.writeApi.useDefaultTags({ source: 'epics-system' });
    
    console.log(`InfluxDB connected to ${this.url}, org: ${this.org}, bucket: ${this.bucket}`);
  }

  /**
   * Write PV data to InfluxDB
   * @param {string} pvName - PV name
   * @param {object} pvData - PV data object
   * @param {string} systemName - System name (optional)
   */
  async writePVData(pvName, pvData, systemName = 'unknown') {
    try {
      const point = new Point('pv_data')
        .tag('pv_name', pvName)
        .tag('system', systemName)
        .tag('connection_status', pvData.connectionStatus || 'UNKNOWN')
        .tag('alarm_severity', pvData.alarmSeverity || 'NO_ALARM')
        .floatField('value', parseFloat(pvData.value) || 0)
        .booleanField('has_alarm', pvData.hasAlarm || false)
        .stringField('formatted_value', pvData.formattedValue || String(pvData.value))
        .stringField('units', pvData.units || '')
        .timestamp(new Date(pvData.timestamp || Date.now()));

      // Add alarm level as tag if present
      if (pvData.hasAlarm && pvData.alarmSeverity) {
        const severity = pvData.alarmSeverity.toLowerCase();
        if (severity.includes('major')) {
          point.tag('alarm_level', 'major');
        } else if (severity.includes('minor')) {
          point.tag('alarm_level', 'minor');
        }
      }

      this.writeApi.writePoint(point);
      
    } catch (error) {
      console.error(`Error writing PV data to InfluxDB for ${pvName}:`, error);
    }
  }

  /**
   * Write multiple PV data points in batch
   * @param {object} allPVData - Object with PV names as keys and data as values
   * @param {string} systemName - System name (optional)
   */
  async writeBatchPVData(allPVData, systemName = 'unknown') {
    try {
      const points = [];
      
      for (const [pvName, pvData] of Object.entries(allPVData)) {
        if (pvData && pvData.value !== null && pvData.value !== undefined) {
          const point = new Point('pv_data')
            .tag('pv_name', pvName)
            .tag('system', systemName)
            .tag('connection_status', pvData.connectionStatus || 'UNKNOWN')
            .tag('alarm_severity', pvData.alarmSeverity || 'NO_ALARM')
            .floatField('value', parseFloat(pvData.value) || 0)
            .booleanField('has_alarm', pvData.hasAlarm || false)
            .stringField('formatted_value', pvData.formattedValue || String(pvData.value))
            .stringField('units', pvData.units || '')
            .timestamp(new Date(pvData.timestamp || Date.now()));

          if (pvData.hasAlarm && pvData.alarmSeverity) {
            const severity = pvData.alarmSeverity.toLowerCase();
            if (severity.includes('major')) {
              point.tag('alarm_level', 'major');
            } else if (severity.includes('minor')) {
              point.tag('alarm_level', 'minor');
            }
          }

          points.push(point);
        }
      }

      if (points.length > 0) {
        this.writeApi.writePoints(points);
        console.log(`Wrote ${points.length} PV data points to InfluxDB`);
      }
      
    } catch (error) {
      console.error('Error writing batch PV data to InfluxDB:', error);
    }
  }

  /**
   * Query historical PV data
   * @param {string} pvName - PV name
   * @param {string} timeRange - Time range (e.g., '1h', '24h', '7d')
   * @param {string} aggregation - Aggregation function (mean, max, min, last)
   * @param {string} interval - Group by interval (e.g., '1m', '5m', '1h')
   */
  async queryPVHistory(pvName, timeRange = '1h', aggregation = 'mean', interval = '1m') {
    const query = `
      from(bucket: "${this.bucket}")
        |> range(start: -${timeRange})
        |> filter(fn: (r) => r._measurement == "pv_data")
        |> filter(fn: (r) => r.pv_name == "${pvName}")
        |> filter(fn: (r) => r._field == "value")
        |> aggregateWindow(every: ${interval}, fn: ${aggregation}, createEmpty: false)
        |> yield(name: "${aggregation}")
    `;

    try {
      const result = [];
      await this.queryApi.queryRows(query, {
        next(row, tableMeta) {
          const o = tableMeta.toObject(row);
          result.push({
            time: o._time,
            value: o._value,
            pvName: o.pv_name
          });
        },
        error(error) {
          console.error('InfluxDB query error:', error);
        },
        complete() {
          console.log(`Query completed for ${pvName}, got ${result.length} points`);
        },
      });
      
      return result;
    } catch (error) {
      console.error('Error querying PV history:', error);
      return [];
    }
  }

  /**
   * Query multiple PVs history
   * @param {string[]} pvNames - Array of PV names
   * @param {string} timeRange - Time range
   * @param {string} aggregation - Aggregation function
   * @param {string} interval - Group by interval
   */
  async queryMultiplePVHistory(pvNames, timeRange = '1h', aggregation = 'mean', interval = '1m') {
    const pvFilter = pvNames.map(pv => `r.pv_name == "${pv}"`).join(' or ');
    
    const query = `
      from(bucket: "${this.bucket}")
        |> range(start: -${timeRange})
        |> filter(fn: (r) => r._measurement == "pv_data")
        |> filter(fn: (r) => ${pvFilter})
        |> filter(fn: (r) => r._field == "value")
        |> aggregateWindow(every: ${interval}, fn: ${aggregation}, createEmpty: false)
        |> yield(name: "${aggregation}")
    `;

    try {
      const result = {};
      await this.queryApi.queryRows(query, {
        next(row, tableMeta) {
          const o = tableMeta.toObject(row);
          if (!result[o.pv_name]) {
            result[o.pv_name] = [];
          }
          result[o.pv_name].push({
            time: o._time,
            value: o._value
          });
        },
        error(error) {
          console.error('InfluxDB query error:', error);
        },
        complete() {
          console.log(`Multi-PV query completed, got data for ${Object.keys(result).length} PVs`);
        },
      });
      
      return result;
    } catch (error) {
      console.error('Error querying multiple PV history:', error);
      return {};
    }
  }

  /**
   * Get alarm events
   * @param {string} timeRange - Time range
   * @param {string} severity - Alarm severity filter (optional)
   */
  async queryAlarmEvents(timeRange = '24h', severity = null) {
    let severityFilter = '';
    if (severity) {
      severityFilter = `|> filter(fn: (r) => r.alarm_severity == "${severity}")`;
    }

    const query = `
      from(bucket: "${this.bucket}")
        |> range(start: -${timeRange})
        |> filter(fn: (r) => r._measurement == "pv_data")
        |> filter(fn: (r) => r._field == "has_alarm")
        |> filter(fn: (r) => r._value == true)
        ${severityFilter}
        |> yield(name: "alarms")
    `;

    try {
      const result = [];
      await this.queryApi.queryRows(query, {
        next(row, tableMeta) {
          const o = tableMeta.toObject(row);
          result.push({
            time: o._time,
            pvName: o.pv_name,
            system: o.system,
            alarmSeverity: o.alarm_severity,
            connectionStatus: o.connection_status
          });
        },
        error(error) {
          console.error('InfluxDB alarm query error:', error);
        },
        complete() {
          console.log(`Alarm query completed, found ${result.length} alarm events`);
        },
      });
      
      return result;
    } catch (error) {
      console.error('Error querying alarm events:', error);
      return [];
    }
  }

  /**
   * Flush pending writes and close connection
   */
  async close() {
    try {
      await this.writeApi.close();
      console.log('InfluxDB connection closed');
    } catch (error) {
      console.error('Error closing InfluxDB connection:', error);
    }
  }
}

module.exports = InfluxDBService;
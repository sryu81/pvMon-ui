import { useState, useEffect, useCallback, useRef } from 'react';

const API_BASE_URL = 'http://localhost:8080/api/epics';

export function usePVData(pollingFrequency, subscribedPVs) {
  const [pvData, setPvData] = useState({});
  const [lastUpdate, setLastUpdate] = useState(null);
  const [isPolling, setIsPolling] = useState(false);
  const [errors, setErrors] = useState({});
  const pollingRef = useRef(null);
  const abortControllerRef = useRef(null);

  const pollForUpdates = useCallback(async () => {
    if (subscribedPVs.size === 0 || isPolling) {
      return;
    }

    setIsPolling(true);
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    
    try {
      const promises = Array.from(subscribedPVs).map(async (pvName) => {
        try {
          const url = `${API_BASE_URL}/pv/${encodeURIComponent(pvName)}`;
          const response = await fetch(url, {
            signal: abortControllerRef.current.signal,
            timeout: 5000
          });

          if (response.ok) {
            const apiData = await response.json();
            return { pvName, apiData, error: null };
          } else {
            console.warn(`HTTP ${response.status} for ${pvName}`);
            return { pvName, apiData: null, error: `HTTP ${response.status}` };
          }
        } catch (error) {
          if (error.name === 'AbortError') {
            return { pvName, apiData: null, error: 'Request cancelled' };
          }
          console.error(`Error fetching data for ${pvName}:`, error);
          return { pvName, apiData: null, error: error.message };
        }
      });

      const results = await Promise.allSettled(promises);
      
      setPvData(prev => {
        const newData = { ...prev };
        let hasUpdates = false;
        
        results.forEach((result) => {
          if (result.status === 'fulfilled') {
            const { pvName, apiData, error } = result.value;
            if (apiData) {
              // Transform simplified API data to match component expectations
              const transformedData = {
                // Core values
                value: apiData.value,
                rawValue: apiData.value,
                formattedValue: apiData.formattedValue || String(apiData.value || 'N/A'),
                displayValue: apiData.formattedValue || String(apiData.value || 'N/A'),
                
                // Connection status - simplified check
                isConnected: apiData.connectionStatus === 'CONNECTED',
                connectionStatus: apiData.connectionStatus || 'UNKNOWN',
                
                // Timestamps
                timestamp: apiData.lastUpdate ? new Date(apiData.lastUpdate).getTime() : Date.now(),
                lastUpdate: apiData.lastUpdate,
                timestampFormatted: apiData.lastUpdate ? 
                  new Date(apiData.lastUpdate).toLocaleString() : 'Never',
                
                // Basic metadata (simplified)
                dataType: apiData.dataType || 'Unknown',
                units: apiData.units || '',
                description: apiData.description || '',
                precision: apiData.precision || 0,
                
                // Simplified alarm information
                hasAlarm: apiData.alarmSeverity && apiData.alarmSeverity !== 'NO_ALARM',
                alarmSeverity: apiData.alarmSeverity || 'NO_ALARM',
                alarmStatus: apiData.alarmStatus || 'NO_ALARM',
                
                // Computed fields
                isNumeric: ['Double', 'Integer', 'Float', 'Long'].includes(apiData.dataType),
                isActive: apiData.connectionStatus === 'CONNECTED' && 
                         apiData.value !== null && 
                         apiData.value !== undefined,
                
                // Debug info
                _raw: apiData,
                _lastPolled: Date.now()
              };
              
              // Debug logging
              if (process.env.NODE_ENV === 'development') {
                console.log(`PV Data Transform for ${pvName}:`, {
                  connectionStatus: apiData.connectionStatus,
                  isConnected: transformedData.isConnected,
                  alarmSeverity: apiData.alarmSeverity,
                  hasAlarm: transformedData.hasAlarm
                });
              }
              
              newData[pvName] = transformedData;
              hasUpdates = true;
              
              // Clear errors for successful PVs
              setErrors(prevErrors => {
                const newErrors = { ...prevErrors };
                delete newErrors[pvName];
                return newErrors;
              });
              
            } else if (error) {
              // Handle errors
              setErrors(prevErrors => ({
                ...prevErrors,
                [pvName]: {
                  message: error,
                  timestamp: Date.now(),
                  type: 'connection_error'
                }
              }));
              
              // Set error state in pvData
              newData[pvName] = {
                value: 'Error',
                isConnected: false,
                connectionStatus: 'ERROR',
                hasAlarm: false,
                alarmSeverity: 'NO_ALARM',
                timestamp: Date.now(),
                timestampFormatted: new Date().toLocaleString(),
                _error: error,
                _lastPolled: Date.now()
              };
              hasUpdates = true;
            }
          }
        });
        
        if (hasUpdates) {
          setLastUpdate(new Date().toLocaleTimeString());
        }
        
        return newData;
      });
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error polling for updates:', error);
      }
    } finally {
      setIsPolling(false);
    }
  }, [subscribedPVs, isPolling]);

  // Setup polling
  useEffect(() => {
    if (subscribedPVs.size > 0) {
      pollForUpdates();
      pollingRef.current = setInterval(pollForUpdates, pollingFrequency);
      
      return () => {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
        }
      };
    }
  }, [subscribedPVs, pollingFrequency, pollForUpdates]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Helper functions
  const getPVStatus = useCallback((pvName) => {
    const data = pvData[pvName];
    const error = errors[pvName];
    
    if (error) return 'Error';
    if (!data) return 'Unknown';
    if (data.hasAlarm) return 'Alarm';
    if (!data.isConnected) return 'Disconnected';
    return 'Connected';
  }, [pvData, errors]);

  const getFormattedValue = useCallback((pvName) => {
    const data = pvData[pvName];
    if (!data) return 'N/A';
    
    const value = data.displayValue || data.formattedValue || data.value;
    const units = data.units;
    
    if (value === null || value === undefined) return 'N/A';
    if (units) return `${value} ${units}`;
    return value.toString();
  }, [pvData]);

  const hasAlarmCondition = useCallback((pvName) => {
    const data = pvData[pvName];
    return data && data.hasAlarm;
  }, [pvData]);

  const getAlarmLevel = useCallback((pvName) => {
    const data = pvData[pvName];
    if (!data || !data.hasAlarm) return 'none';
    
    const severity = data.alarmSeverity?.toLowerCase() || '';
    if (severity.includes('major') || severity.includes('high')) return 'major';
    if (severity.includes('minor') || severity.includes('low')) return 'minor';
    return 'minor'; // Default for any alarm
  }, [pvData]);

  const getConnectionStats = useCallback(() => {
    const total = subscribedPVs.size;
    const connected = Object.values(pvData).filter(data => data.isConnected).length;
    const withAlarms = Object.keys(pvData).filter(pvName => hasAlarmCondition(pvName)).length;
    const withErrors = Object.keys(errors).length;
    
    return { total, connected, withAlarms, withErrors };
  }, [subscribedPVs, pvData, errors, hasAlarmCondition]);

  return { 
    pvData, 
    lastUpdate, 
    isPolling,
    errors,
    getPVStatus,
    getFormattedValue,
    hasAlarmCondition,
    getAlarmLevel,
    getConnectionStats
  };
}
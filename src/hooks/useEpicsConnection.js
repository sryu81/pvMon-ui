import { useState, useCallback, useEffect, useRef } from 'react';

const API_BASE_URL = process.env.REACT_APP_API_URL | 'http://localhost:8080/api/epics';

export function useEpicsConnection() {
  const [connectionStatus, setConnectionStatus] = useState('Checking...');
  const [subscribedPVs, setSubscribedPVs] = useState(new Set());
  const connectionCheckRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Check server connection with timeout
  const checkConnection = useCallback(async () => {
    // Cancel previous request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    
    try {
      const response = await fetch(`${API_BASE_URL}/pvs`, {
        signal: abortControllerRef.current.signal,
        timeout: 5000 // 5 second timeout
      });
      
      if (response.ok) {
        setConnectionStatus('Connected');
        // Get existing PVs from server
        const existingPVs = await response.json();
        setSubscribedPVs(new Set(existingPVs));
        console.log('Connection established, existing PVs:', existingPVs);
        return true;
      } else {
        setConnectionStatus('Error');
        return false;
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Connection check aborted');
        return false;
      }
      console.error('Connection check failed:', error);
      setConnectionStatus('Disconnected');
      return false;
    }
  }, []);

  // Auto-check connection on mount and periodically
  useEffect(() => {
    checkConnection();
    connectionCheckRef.current = setInterval(checkConnection, 30000);
    
    return () => {
      if (connectionCheckRef.current) {
        clearInterval(connectionCheckRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [checkConnection]);

  const subscribeToPV = useCallback(async (pvName) => {
    if (!pvName || !pvName.trim()) {
      console.warn('Cannot subscribe to empty PV name');
      return false;
    }

    const trimmedPVName = pvName.trim();
    
    if (connectionStatus !== 'Connected') {
      console.warn(`Cannot subscribe to ${trimmedPVName}: not connected to server`);
      return false;
    }

    // Check if already subscribed
    if (subscribedPVs.has(trimmedPVName)) {
      console.log(`Already subscribed to ${trimmedPVName}`);
      return true;
    }

    try {
      console.log(`Attempting to subscribe to PV: ${trimmedPVName}`);
      const response = await fetch(`${API_BASE_URL}/subscribe/${encodeURIComponent(trimmedPVName)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000 // 10 second timeout for subscription
      });

      if (response.ok) {
        setSubscribedPVs(prev => new Set([...prev, trimmedPVName]));
        console.log(`Successfully subscribed to PV: ${trimmedPVName}`);
        return true;
      } else {
        const error = await response.json().catch(() => ({ message: 'Unknown error' }));
        console.error(`Failed to subscribe to ${trimmedPVName}:`, error);
        return false;
      }
    } catch (error) {
      console.error(`Error subscribing to PV ${trimmedPVName}:`, error);
      return false;
    }
  }, [connectionStatus, subscribedPVs]);

  const unsubscribeFromPV = useCallback(async (pvName) => {
    if (!pvName || !pvName.trim()) {
      console.warn('Cannot unsubscribe from empty PV name');
      return false;
    }

    const trimmedPVName = pvName.trim();
    
    try {
      console.log(`Attempting to unsubscribe from PV: ${trimmedPVName}`);
      const response = await fetch(`${API_BASE_URL}/unsubscribe/${encodeURIComponent(trimmedPVName)}`, {
        method: 'DELETE',
        timeout: 10000
      });

      if (response.ok) {
        setSubscribedPVs(prev => {
          const newSet = new Set(prev);
          newSet.delete(trimmedPVName);
          return newSet;
        });
        console.log(`Successfully unsubscribed from PV: ${trimmedPVName}`);
        return true;
      } else {
        console.error(`Failed to unsubscribe from ${trimmedPVName}: HTTP ${response.status}`);
        return false;
      }
    } catch (error) {
      console.error(`Error unsubscribing from PV ${trimmedPVName}:`, error);
      return false;
    }
  }, []);

  // Bulk subscription with better error handling
  const addMultiplePVsToSystem = useCallback(async (systemId, pvNames, updateSystemsCallback) => {
    if (connectionStatus !== 'Connected') {
      alert('Not connected to server. Please check your connection.');
      return { success: false, message: 'Not connected to server' };
    }

    if (!Array.isArray(pvNames) || pvNames.length === 0) {
      console.warn('No PV names provided for bulk subscription');
      return { success: false, message: 'No PV names provided' };
    }

    console.log(`Starting bulk subscription of ${pvNames.length} PVs for system ${systemId}`);

    const results = {
      successful: [],
      failed: [],
      alreadySubscribed: [],
      duplicates: []
    };

    // Remove duplicates and empty names
    const uniquePVs = [...new Set(pvNames.map(pv => pv.trim()).filter(pv => pv))];
    const duplicateCount = pvNames.length - uniquePVs.length;
    
    if (duplicateCount > 0) {
      results.duplicates = Array(duplicateCount).fill('duplicate');
    }

    // Subscribe to each unique PV
    for (const pvName of uniquePVs) {
      // Skip if already subscribed
      if (subscribedPVs.has(pvName)) {
        console.log(`PV ${pvName} already subscribed, adding to system`);
        results.alreadySubscribed.push(pvName);
        results.successful.push(pvName);
        continue;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/subscribe/${encodeURIComponent(pvName)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000
        });

        if (response.ok) {
          results.successful.push(pvName);
          setSubscribedPVs(prev => new Set([...prev, pvName]));
          console.log(`Bulk subscription successful: ${pvName}`);
        } else {
          results.failed.push(pvName);
          console.error(`Bulk subscription failed: ${pvName} - HTTP ${response.status}`);
        }
      } catch (error) {
        console.error(`Error in bulk subscription for ${pvName}:`, error);
        results.failed.push(pvName);
      }
    }

    // Update the systems through the callback
    if (results.successful.length > 0 && updateSystemsCallback) {
      console.log(`Updating system ${systemId} with ${results.successful.length} successful PVs`);
      updateSystemsCallback(systemId, results.successful);
    }

    // Generate detailed message
    let message = '';
    if (results.successful.length > 0) {
      message += `✅ Successfully added ${results.successful.length} PV${results.successful.length !== 1 ? 's' : ''}`;
    }
    
    if (results.alreadySubscribed.length > 0) {
      message += `\n📋 ${results.alreadySubscribed.length} PV${results.alreadySubscribed.length !== 1 ? 's were' : ' was'} already subscribed`;
    }
    
    if (duplicateCount > 0) {
      message += `\n🔄 ${duplicateCount} duplicate${duplicateCount !== 1 ? 's' : ''} removed`;
    }
    
    if (results.failed.length > 0) {
      message += `\n❌ Failed to add ${results.failed.length} PV${results.failed.length !== 1 ? 's' : ''}`;
      if (results.failed.length <= 5) {
        message += `: ${results.failed.join(', ')}`;
      } else {
        message += `: ${results.failed.slice(0, 3).join(', ')} and ${results.failed.length - 3} more...`;
      }
    }
    
    alert(message || 'No changes made');
    
    return {
      success: results.successful.length > 0,
      results,
      message
    };
  }, [connectionStatus, subscribedPVs]);

  // Clear subscriptions when disconnected
  useEffect(() => {
    if (connectionStatus === 'Disconnected' || connectionStatus === 'Error') {
      console.log('Connection lost, clearing local PV subscriptions');
      setSubscribedPVs(new Set());
    }
  }, [connectionStatus]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    connectionStatus,
    subscribedPVs,
    checkConnection,
    subscribeToPV,
    unsubscribeFromPV,
    addMultiplePVsToSystem
  };
}
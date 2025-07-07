import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Sidebar from './components/Navigation/Sidebar';
import GUIConfigTab from './components/Tabs/GUIConfigTab';
import SystemOverviewTab from './components/Tabs/SystemOverviewTab';
import SystemViewTab from './components/Tabs/SystemViewTab';
import ConfigManagerPanel from './components/ConfigManager/ConfigManagerPanel';
import { useEpicsConnection } from './hooks/useEpicsConnection';
import { usePVData } from './hooks/usePVData';
import { useConfigManager } from './hooks/useConfigManager';
import { useAppCleanup } from './hooks/useAppCleanup';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('gui-config');
  const [systemPVInputs, setSystemPVInputs] = useState({});
  const [pvSubscriptionInitialized, setPvSubscriptionInitialized] = useState(false);

  // Configuration management
  const {
    config,
    isLoading: configLoading,
    hasUnsavedChanges,
    updateConfig,
    saveConfig,
    exportConfig,
    importConfig,
    resetConfig,
    configLoaded
  } = useConfigManager();

  // EPICS connection
  const { 
    connectionStatus, 
    subscribedPVs, 
    subscribeToPV, 
    unsubscribeFromPV, 
    addMultiplePVsToSystem 
  } = useEpicsConnection();

  // Memoize systems to prevent unnecessary re-renders
  const systems = useMemo(() => {
    return Array.isArray(config?.systems) ? config.systems : [];
  }, [config?.systems]);

  // Memoize polling frequency
  const pollingFrequency = useMemo(() => {
    return config?.pollingFrequency || 2000;
  }, [config?.pollingFrequency]);

  // Get all PV names across all systems for duplicate checking
  const allPVNames = useMemo(() => {
    const pvSet = new Set();
    systems.forEach(system => {
      if (Array.isArray(system.pvs)) {
        system.pvs.forEach(pv => pvSet.add(pv));
      }
    });
    return pvSet;
  }, [systems]);

  // Check if PV already exists in any system
  const isPVDuplicate = useCallback((pvName, excludeSystemId = null) => {
    const trimmedPVName = pvName.trim();
    if (!trimmedPVName) return false;

    return systems.some(system => {
      // Skip the system we're excluding (for editing scenarios)
      if (excludeSystemId && system.id === excludeSystemId) return false;
      
      return Array.isArray(system.pvs) && system.pvs.includes(trimmedPVName);
    });
  }, [systems]);

  // Get system name that contains a specific PV
  const getSystemWithPV = useCallback((pvName) => {
    const trimmedPVName = pvName.trim();
    const system = systems.find(sys => 
      Array.isArray(sys.pvs) && sys.pvs.includes(trimmedPVName)
    );
    return system ? system.name : null;
  }, [systems]);

  // PV data polling
  const { pvData, lastUpdate } = usePVData(pollingFrequency, subscribedPVs);

  // App cleanup on exit
  useAppCleanup(subscribedPVs, unsubscribeFromPV, saveConfig, hasUnsavedChanges);

  // Initialize PV inputs when systems change
  useEffect(() => {
    if (systems.length > 0) {
      const inputs = {};
      systems.forEach(system => {
        if (!(system.id in systemPVInputs)) {
          inputs[system.id] = '';
        }
      });
      if (Object.keys(inputs).length > 0) {
        setSystemPVInputs(prev => ({ ...prev, ...inputs }));
      }
    }
  }, [systems, systemPVInputs]);

  // Subscribe to PVs from loaded configuration
  useEffect(() => {
    if (connectionStatus === 'Connected' && configLoaded && systems.length > 0 && !pvSubscriptionInitialized) {
      console.log('Subscribing to PVs from configuration...');
      const allPVs = systems.flatMap(system => system.pvs || []);
      
      if (allPVs.length > 0) {
        console.log(`Found ${allPVs.length} PVs to subscribe to:`, allPVs);
        
        allPVs.forEach(async (pvName) => {
          try {
            await subscribeToPV(pvName);
            console.log(`Subscribed to PV: ${pvName}`);
          } catch (error) {
            console.error(`Failed to subscribe to PV ${pvName}:`, error);
          }
        });
        
        setPvSubscriptionInitialized(true);
      } else {
        console.log('No PVs found in configuration');
        setPvSubscriptionInitialized(true);
      }
    }
  }, [connectionStatus, configLoaded, systems, pvSubscriptionInitialized, subscribeToPV]);

  // Reset PV subscription flag when configuration changes significantly
  useEffect(() => {
    setPvSubscriptionInitialized(false);
  }, [config?.systems]);

  // Configuration update handlers
  const handlePollingFrequencyChange = useCallback((newFrequency) => {
    updateConfig({ pollingFrequency: newFrequency });
  }, [updateConfig]);

  const handleSystemsChange = useCallback((newSystems) => {
    updateConfig({ systems: newSystems });
  }, [updateConfig]);

  // System management functions
  const addSystem = useCallback(() => {
    const newId = Math.max(...(systems.map(s => s.id) || [0]), 0) + 1;
    const newSystems = [...systems, { id: newId, name: `System ${newId}`, pvs: [] }];
    handleSystemsChange(newSystems);
    setSystemPVInputs(prev => ({ ...prev, [newId]: '' }));
  }, [systems, handleSystemsChange]);

  const removeSystem = useCallback((systemId) => {
    const system = systems.find(s => s.id === systemId);
    if (system && system.pvs) {
      system.pvs.forEach(pvName => {
        console.log(`Unsubscribing from PV: ${pvName}`);
        unsubscribeFromPV(pvName);
      });
    }
    if (activeTab === `system-${systemId}`) {
      setActiveTab('gui-config');
    }
    const newSystems = systems.filter(s => s.id !== systemId);
    handleSystemsChange(newSystems);
    setSystemPVInputs(prev => {
      const newInputs = { ...prev };
      delete newInputs[systemId];
      return newInputs;
    });
  }, [systems, activeTab, handleSystemsChange, unsubscribeFromPV]);

  const updateSystemName = useCallback((systemId, newName) => {
    const newSystems = systems.map(system => 
      system.id === systemId ? { ...system, name: newName } : system
    );
    handleSystemsChange(newSystems);
  }, [systems, handleSystemsChange]);

  const updateSystemPVInput = useCallback((systemId, value) => {
    setSystemPVInputs(prev => ({ ...prev, [systemId]: value }));
  }, []);

  const addPVToSystem = useCallback(async (systemId) => {
    const pvName = systemPVInputs[systemId];
    if (pvName && pvName.trim()) {
      const trimmedPVName = pvName.trim();
      
      // Check for duplicates
      if (isPVDuplicate(trimmedPVName)) {
        const existingSystemName = getSystemWithPV(trimmedPVName);
        alert(`PV "${trimmedPVName}" already exists in system "${existingSystemName}". Duplicate PVs are not allowed.`);
        return;
      }

      const success = await subscribeToPV(trimmedPVName);
      if (success) {
        const newSystems = systems.map(system => 
          system.id === systemId 
            ? { ...system, pvs: [...(system.pvs || []), trimmedPVName] }
            : system
        );
        handleSystemsChange(newSystems);
        setSystemPVInputs(prev => ({ ...prev, [systemId]: '' }));
        console.log(`Added PV ${trimmedPVName} to system ${systemId}`);
      }
    }
  }, [systems, systemPVInputs, subscribeToPV, handleSystemsChange, isPVDuplicate, getSystemWithPV]);

  const removePVFromSystem = useCallback((systemId, pvName) => {
    console.log(`Removing PV ${pvName} from system ${systemId}`);
    unsubscribeFromPV(pvName);
    const newSystems = systems.map(system => 
      system.id === systemId 
        ? { ...system, pvs: (system.pvs || []).filter(pv => pv !== pvName) }
        : system
    );
    handleSystemsChange(newSystems);
  }, [systems, unsubscribeFromPV, handleSystemsChange]);

  const handleMultiplePVsToSystem = useCallback((systemId, pvNames) => {
    console.log(`App.js: Adding ${pvNames.length} PVs to system ${systemId}`);
    
    // Filter out duplicates before processing
    const uniquePVs = [];
    const duplicatePVs = [];
    
    pvNames.forEach(pvName => {
      const trimmedPVName = pvName.trim();
      if (trimmedPVName && !isPVDuplicate(trimmedPVName)) {
        uniquePVs.push(trimmedPVName);
      } else if (trimmedPVName) {
        const existingSystemName = getSystemWithPV(trimmedPVName);
        duplicatePVs.push({ pv: trimmedPVName, system: existingSystemName });
      }
    });

    if (duplicatePVs.length > 0) {
      const duplicateMessage = duplicatePVs
        .slice(0, 5) // Show first 5 duplicates
        .map(dup => `"${dup.pv}" (in ${dup.system})`)
        .join('\n');
      
      const remainingCount = duplicatePVs.length - 5;
      const fullMessage = `Found ${duplicatePVs.length} duplicate PV(s):\n\n${duplicateMessage}${
        remainingCount > 0 ? `\n... and ${remainingCount} more` : ''
      }\n\nDuplicates will be skipped. Continue with ${uniquePVs.length} unique PVs?`;
      
      if (!window.confirm(fullMessage)) {
        return;
      }
    }

    if (uniquePVs.length === 0) {
      alert('No unique PVs to add. All PVs already exist in the system.');
      return;
    }
    
    // Create the callback function that will update the systems
    const updateSystemsCallback = (targetSystemId, successfulPVs) => {
      console.log(`App.js: Updating system ${targetSystemId} with PVs:`, successfulPVs);
      
      const newSystems = systems.map(system => {
        if (system.id === targetSystemId) {
          const existingPVs = system.pvs || [];
          const newPVs = successfulPVs.filter(pv => !existingPVs.includes(pv));
          const updatedPVs = [...existingPVs, ...newPVs];
          
          console.log(`System ${targetSystemId}: Adding ${newPVs.length} new PVs, total will be ${updatedPVs.length}`);
          
          return {
            ...system,
            pvs: updatedPVs
          };
        }
        return system;
      });
      
      handleSystemsChange(newSystems);
    };
    
    // Call the EPICS connection function with our callback and filtered PVs
    addMultiplePVsToSystem(systemId, uniquePVs, updateSystemsCallback);
  }, [systems, handleSystemsChange, addMultiplePVsToSystem, isPVDuplicate, getSystemWithPV]);

  const switchToSystemView = useCallback((systemId) => {
    setActiveTab(`system-${systemId}`);
  }, []);

  // Configuration management handlers
  const handleImportConfig = useCallback(async (file) => {
    console.log('Clearing current PV subscriptions before import...');
    subscribedPVs.forEach(pvName => {
      unsubscribeFromPV(pvName);
    });
    
    const result = await importConfig(file);
    if (result.success) {
      const inputs = {};
      (result.config.systems || []).forEach(system => {
        inputs[system.id] = '';
      });
      setSystemPVInputs(inputs);
      setActiveTab('gui-config');
      setPvSubscriptionInitialized(false);
      console.log('Configuration imported, will re-subscribe to PVs');
    }
    return result;
  }, [importConfig, subscribedPVs, unsubscribeFromPV]);

  const handleResetConfig = useCallback(() => {
    console.log('Clearing current PV subscriptions before reset...');
    subscribedPVs.forEach(pvName => {
      unsubscribeFromPV(pvName);
    });
    
    const newConfig = resetConfig();
    const inputs = {};
    (newConfig.systems || []).forEach(system => {
      inputs[system.id] = '';
    });
    setSystemPVInputs(inputs);
    setActiveTab('gui-config');
    setPvSubscriptionInitialized(false);
    console.log('Configuration reset, will re-subscribe to PVs');
    return newConfig;
  }, [resetConfig, subscribedPVs, unsubscribeFromPV]);

  // Memoize main content to prevent unnecessary re-renders
  const mainContent = useMemo(() => {
    if (configLoading) {
      return <div className="loading-indicator">Loading configuration...</div>;
    }

    if (activeTab === 'gui-config') {
      return (
        <>
          <ConfigManagerPanel
            config={config}
            hasUnsavedChanges={hasUnsavedChanges}
            onSave={saveConfig}
            onExport={exportConfig}
            onImport={handleImportConfig}
            onReset={handleResetConfig}
          />
          <GUIConfigTab 
            pollingFrequency={pollingFrequency}
            setPollingFrequency={handlePollingFrequencyChange}
            systems={systems}
            addSystem={addSystem}
            removeSystem={removeSystem}
            updateSystemName={updateSystemName}
            systemPVInputs={systemPVInputs}
            updateSystemPVInput={updateSystemPVInput}
            addPVToSystem={addPVToSystem}
            removePVFromSystem={removePVFromSystem}
            connectionStatus={connectionStatus}
            addMultiplePVsToSystem={handleMultiplePVsToSystem}
            allPVNames={allPVNames}
            isPVDuplicate={isPVDuplicate}
            getSystemWithPV={getSystemWithPV}
          />
        </>
      );
    } else if (activeTab === 'overview') {
      return (
        <SystemOverviewTab 
          systems={systems} 
          updateSystems={handleSystemsChange}
          pvData={pvData}
          getPVStatus={(pvName) => {
            const data = pvData[pvName];
            if (!data) return 'Unknown';
            if (data.hasAlarm === true || data.alarmSeverity !== null) return 'Alarm';
            if (data.isConnected !== true) return 'Disconnected';
            return 'Connected';
          }}
          getFormattedValue={(pvName) => {
            const data = pvData[pvName];
            if (!data) return 'N/A';
            return data.displayValue || data.formattedValue || data.value || 'N/A';
          }}
          hasAlarmCondition={(pvName) => {
            const data = pvData[pvName];
            return data && (data.hasAlarm === true || data.alarmSeverity !== null);
          }}
          getAlarmLevel={(pvName) => {
            const data = pvData[pvName];
            if (!data || (!data.hasAlarm && !data.alarmSeverity)) return null;
            return data.alarmSeverity === 'MAJOR' ? 'major' : 'minor';
          }}
          onSystemSelect={(system) => {
            setActiveTab(`system-${system.id}`);
          }}
        />
      );
    } else if (activeTab.startsWith('system-')) {
      const systemId = parseInt(activeTab.replace('system-', ''));
      const system = systems.find(s => s.id === systemId);
      return system ? <SystemViewTab system={system} pvData={pvData} /> : null;
    }
    return <div>Select a tab from the sidebar</div>;
  }, [
    configLoading,
    activeTab,
    config,
    hasUnsavedChanges,
    saveConfig,
    exportConfig,
    handleImportConfig,
    handleResetConfig,
    pollingFrequency,
    handlePollingFrequencyChange,
    systems,
    addSystem,
    removeSystem,
    updateSystemName,
    systemPVInputs,
    updateSystemPVInput,
    addPVToSystem,
    removePVFromSystem,
    connectionStatus,
    handleMultiplePVsToSystem,
    allPVNames,
    isPVDuplicate,
    getSystemWithPV,
    pvData,
    handleSystemsChange
  ]);

  if (configLoading) {
    return (
      <div className="App">
        <div className="loading-screen">
          <h2>Loading EPICS PV Monitor...</h2>
          <p>Loading configuration...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      <header className="App-header">
        <h1>EPICS Process Variable Monitor</h1>
        <div className={`connection-status ${connectionStatus.toLowerCase().replace(/\s+/g, '-')}`}>
          Status: {connectionStatus}
        </div>
        {lastUpdate && (
          <div className="last-update">
            Last Update: {lastUpdate} (Every {pollingFrequency/1000}s)
          </div>
        )}
        {hasUnsavedChanges && (
          <div className="unsaved-indicator">
            ● Unsaved changes
          </div>
        )}
        {/* Debug info - remove in production */}
        {process.env.NODE_ENV === 'development' && (
          <div className="debug-info" style={{ fontSize: '12px', color: '#666' }}>
            Subscribed PVs: {subscribedPVs.size} | 
            Config Systems: {systems.length} | 
            Total PVs: {allPVNames.size} |
            PV Init: {pvSubscriptionInitialized ? 'Yes' : 'No'}
          </div>
        )}
      </header>
      
      <div className="app-container">
        <Sidebar 
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          systems={systems}
          switchToSystemView={switchToSystemView}
        />
        <main className="main-content">
          {mainContent}
        </main>
      </div>
    </div>
  );
}

export default App;
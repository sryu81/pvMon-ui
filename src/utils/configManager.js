const CONFIG_STORAGE_KEY = 'epics_pv_monitor_config';
const CONFIG_VERSION = '1.1'; // Incremented for new features

// Custom confirmation function to avoid no-restricted-globals
const showConfirmDialog = (message) => {
  // Use window.confirm explicitly to satisfy linter
  return window.confirm(message);
};

export const defaultConfig = {
  version: CONFIG_VERSION,
  pollingFrequency: 2000,
  systems: [],
  lastSaved: null,
  settings: {
    autoSave: true,
    autoLoad: true,
    confirmOnExit: true,
    maxRetries: 3,
    connectionTimeout: 5000,
    maxPVsPerSystem: 1000,
    enableAlarmNotifications: true,
    chartRefreshRate: 1000
  },
  ui: {
    theme: 'light',
    compactMode: false,
    showTimestamps: true,
    defaultSortColumn: 'name',
    defaultSortDirection: 'asc'
  }
};

export const saveConfiguration = (config) => {
  try {
    // Validate config before saving
    if (!config || typeof config !== 'object') {
      console.error('Invalid configuration object');
      return false;
    }

    const configToSave = {
      ...defaultConfig, // Ensure all default fields exist
      ...config,
      lastSaved: new Date().toISOString(),
      version: CONFIG_VERSION,
      // Ensure systems is always an array with proper structure
      systems: Array.isArray(config.systems) ? config.systems.map(system => ({
        id: system.id || Date.now(),
        name: system.name || 'Unnamed System',
        pvs: Array.isArray(system.pvs) ? [...new Set(system.pvs)] : [], // Remove duplicates
        createdAt: system.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })) : []
    };
    
    // Validate total PV count
    const totalPVs = configToSave.systems.reduce((sum, system) => sum + system.pvs.length, 0);
    if (totalPVs > 10000) {
      console.warn(`Large configuration detected: ${totalPVs} total PVs`);
    }
    
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(configToSave));
    console.log('Configuration saved successfully:', {
      systems: configToSave.systems.length,
      totalPVs,
      version: configToSave.version
    });
    return true;
  } catch (error) {
    console.error('Failed to save configuration:', error);
    // Check if localStorage is full
    if (error.name === 'QuotaExceededError') {
      alert('Storage quota exceeded. Please export your configuration and clear some data.');
    }
    return false;
  }
};

export const loadConfiguration = () => {
  try {
    const savedConfig = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!savedConfig) {
      console.log('No saved configuration found, using defaults');
      return { ...defaultConfig };
    }
    
    const config = JSON.parse(savedConfig);
    console.log('Raw loaded configuration:', {
      version: config.version,
      systems: config.systems?.length || 0,
      lastSaved: config.lastSaved
    });
    
    // Version compatibility check with migration
    if (config.version !== CONFIG_VERSION) {
      console.warn(`Configuration version mismatch (${config.version} vs ${CONFIG_VERSION}), migrating...`);
      const migratedConfig = migrateConfiguration(config);
      saveConfiguration(migratedConfig); // Save migrated version
      return migratedConfig;
    }
    
    // Validate and ensure required fields
    const validatedConfig = {
      ...defaultConfig,
      ...config,
      // Ensure systems is always an array with proper structure
      systems: Array.isArray(config.systems) 
        ? config.systems.map(system => ({
            id: system.id || Date.now() + Math.random(),
            name: system.name || 'Unnamed System',
            pvs: Array.isArray(system.pvs) ? [...new Set(system.pvs)] : [], // Remove duplicates
            createdAt: system.createdAt || new Date().toISOString(),
            updatedAt: system.updatedAt || new Date().toISOString()
          }))
        : defaultConfig.systems,
      // Ensure pollingFrequency is a valid number
      pollingFrequency: typeof config.pollingFrequency === 'number' && config.pollingFrequency >= 500 
        ? config.pollingFrequency 
        : defaultConfig.pollingFrequency,
      // Merge settings with defaults
      settings: {
        ...defaultConfig.settings,
        ...config.settings
      },
      ui: {
        ...defaultConfig.ui,
        ...config.ui
      }
    };
    
    console.log('Validated configuration loaded:', {
      systems: validatedConfig.systems.length,
      totalPVs: validatedConfig.systems.reduce((sum, sys) => sum + sys.pvs.length, 0),
      version: validatedConfig.version
    });
    
    return validatedConfig;
  } catch (error) {
    console.error('Failed to load configuration:', error);
    // If config is corrupted, backup and reset
    try {
      const corruptedConfig = localStorage.getItem(CONFIG_STORAGE_KEY);
      if (corruptedConfig) {
        localStorage.setItem(`${CONFIG_STORAGE_KEY}_corrupted_${Date.now()}`, corruptedConfig);
        console.log('Corrupted configuration backed up');
      }
    } catch (backupError) {
      console.error('Failed to backup corrupted configuration:', backupError);
    }
    
    return { ...defaultConfig };
  }
};

// Configuration migration function
function migrateConfiguration(oldConfig) {
  const migrated = { ...defaultConfig };
  
  // Migrate from version 1.0 to 1.1
  if (oldConfig.version === '1.0') {
    migrated.systems = oldConfig.systems || [];
    migrated.pollingFrequency = oldConfig.pollingFrequency || defaultConfig.pollingFrequency;
    migrated.settings = {
      ...defaultConfig.settings,
      ...oldConfig.settings
    };
    // Add new UI settings with defaults
    migrated.ui = defaultConfig.ui;
  }
  
  // Add more migration logic for future versions here
  
  migrated.version = CONFIG_VERSION;
  console.log(`Configuration migrated from ${oldConfig.version} to ${CONFIG_VERSION}`);
  
  return migrated;
}

export const exportConfiguration = (config) => {
  try {
    const exportData = {
      ...config,
      exportedAt: new Date().toISOString(),
      exportedBy: 'EPICS PV Monitor',
      exportVersion: CONFIG_VERSION,
      metadata: {
        totalSystems: config.systems?.length || 0,
        totalPVs: config.systems?.reduce((sum, sys) => sum + (sys.pvs?.length || 0), 0) || 0,
        exportFormat: 'json'
      }
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    
    const timestamp = new Date().toISOString().split('T')[0];
    const systemCount = config.systems?.length || 0;
    link.download = `epics_config_${timestamp}_${systemCount}systems.json`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    console.log('Configuration exported successfully:', exportData.metadata);
    return true;
  } catch (error) {
    console.error('Failed to export configuration:', error);
    return false;
  }
};

export const importConfiguration = (file) => {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('No file provided'));
      return;
    }
    
    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      reject(new Error('File too large (max 10MB)'));
      return;
    }
    
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const config = JSON.parse(event.target.result);
        
        // Basic validation
        if (!config || typeof config !== 'object') {
          reject(new Error('Invalid configuration file format'));
          return;
        }
        
        if (!config.systems || !Array.isArray(config.systems)) {
          reject(new Error('Configuration file missing systems array'));
          return;
        }
        
        // Validate systems structure
        const validSystems = config.systems.filter(system => 
          system && 
          typeof system === 'object' && 
          system.name && 
          Array.isArray(system.pvs)
        );
        
        if (validSystems.length === 0) {
          reject(new Error('No valid systems found in configuration file'));
          return;
        }
        
        // Count total PVs
        const totalPVs = validSystems.reduce((sum, sys) => sum + sys.pvs.length, 0);
        if (totalPVs > 10000) {
          const proceed = showConfirmDialog(`This configuration contains ${totalPVs} PVs. This may impact performance. Continue?`);
          if (!proceed) {
            reject(new Error('Import cancelled by user'));
            return;
          }
        }
        
        // Ensure required fields exist and migrate if necessary
        let validatedConfig = {
          ...defaultConfig,
          ...config,
          version: CONFIG_VERSION,
          lastSaved: null, // Reset last saved time for imported config
          systems: validSystems.map(system => ({
            id: system.id || Date.now() + Math.random(),
            name: system.name,
            pvs: [...new Set(system.pvs)], // Remove duplicates
            createdAt: system.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
          })),
          settings: {
            ...defaultConfig.settings,
            ...config.settings
          },
          ui: {
            ...defaultConfig.ui,
            ...config.ui
          }
        };
        
        // If importing from older version, migrate
        if (config.version && config.version !== CONFIG_VERSION) {
          validatedConfig = migrateConfiguration(validatedConfig);
        }
        
        console.log('Configuration imported successfully:', {
          systems: validatedConfig.systems.length,
          totalPVs,
          originalVersion: config.version,
          currentVersion: CONFIG_VERSION
        });
        
        resolve(validatedConfig);
      } catch (error) {
        reject(new Error(`Failed to parse configuration file: ${error.message}`));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read configuration file'));
    };
    
    reader.readAsText(file);
  });
};

export const clearConfiguration = () => {
  try {
    // Backup current config before clearing
    const currentConfig = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (currentConfig) {
      localStorage.setItem(`${CONFIG_STORAGE_KEY}_backup_${Date.now()}`, currentConfig);
    }
    
    localStorage.removeItem(CONFIG_STORAGE_KEY);
    console.log('Configuration cleared (backup created)');
    return true;
  } catch (error) {
    console.error('Failed to clear configuration:', error);
    return false;
  }
};

// New utility functions
export const getConfigurationStats = () => {
  try {
    const config = loadConfiguration();
    const totalPVs = config.systems.reduce((sum, sys) => sum + sys.pvs.length, 0);
    const storageUsed = new Blob([JSON.stringify(config)]).size;
    
    return {
      systems: config.systems.length,
      totalPVs,
      storageUsed,
      storageUsedMB: (storageUsed / 1024 / 1024).toFixed(2),
      lastSaved: config.lastSaved,
      version: config.version
    };
  } catch (error) {
    console.error('Failed to get configuration stats:', error);
    return null;
  }
};

export const validateConfiguration = (config) => {
  const errors = [];
  const warnings = [];
  
  if (!config || typeof config !== 'object') {
    errors.push('Configuration is not a valid object');
    return { isValid: false, errors, warnings };
  }
  
  if (!Array.isArray(config.systems)) {
    errors.push('Systems must be an array');
  } else {
    config.systems.forEach((system, index) => {
      if (!system.name) {
        errors.push(`System ${index + 1} missing name`);
      }
      if (!Array.isArray(system.pvs)) {
        errors.push(`System ${index + 1} PVs must be an array`);
      } else if (system.pvs.length > 1000) {
        warnings.push(`System "${system.name}" has ${system.pvs.length} PVs (may impact performance)`);
      }
    });
  }
  
  if (typeof config.pollingFrequency !== 'number' || config.pollingFrequency < 500) {
    warnings.push('Polling frequency should be at least 500ms');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

// Enhanced import with user confirmation
export const importConfigurationWithConfirmation = async (file, onConfirm) => {
  try {
    const config = await importConfiguration(file);
    
    // Show confirmation dialog with config details
    const totalPVs = config.systems.reduce((sum, sys) => sum + sys.pvs.length, 0);
    const message = `Import Configuration?\n\n` +
      `Systems: ${config.systems.length}\n` +
      `Total PVs: ${totalPVs}\n` +
      `Version: ${config.version}\n\n` +
      `This will replace your current configuration.`;
    
    if (onConfirm) {
      // Use custom confirmation callback
      const confirmed = await onConfirm(message, config);
      if (!confirmed) {
        throw new Error('Import cancelled by user');
      }
    } else {
      // Fallback to browser confirm
      const confirmed = showConfirmDialog(message);
      if (!confirmed) {
        throw new Error('Import cancelled by user');
      }
    }
    
    return config;
  } catch (error) {
    throw error;
  }
};

// Bulk operations with confirmation
export const bulkDeleteSystems = (systemIds, allSystems, onConfirm) => {
  const systemsToDelete = allSystems.filter(sys => systemIds.includes(sys.id));
  const totalPVs = systemsToDelete.reduce((sum, sys) => sum + sys.pvs.length, 0);
  
  const message = `Delete ${systemsToDelete.length} system(s)?\n\n` +
    `Systems: ${systemsToDelete.map(s => s.name).join(', ')}\n` +
    `Total PVs to be removed: ${totalPVs}\n\n` +
    `This action cannot be undone.`;
  
if (onConfirm) {
    return onConfirm(message, systemsToDelete);
  } else {
    return showConfirmDialog(message);
  }
};

// Safe configuration update with validation
export const updateConfigurationSafely = (currentConfig, updates, onValidationError) => {
  try {
    const newConfig = {
      ...currentConfig,
      ...updates,
      lastSaved: new Date().toISOString()
    };
    
    // Validate the updated configuration
    const validation = validateConfiguration(newConfig);
    
    if (!validation.isValid) {
      const errorMessage = `Configuration update failed: ${validation.errors.join(', ')}`;
      if (onValidationError) {
        onValidationError(errorMessage, validation.errors);
      } else {
        console.error(errorMessage);
      }
      return null;
    }
    
    // Show warnings if any
    if (validation.warnings.length > 0) {
      console.warn('Configuration update warnings:', validation.warnings);
    }
    
    return newConfig;
  } catch (error) {
    const errorMessage = `Error updating configuration: ${error.message}`;
    if (onValidationError) {
      onValidationError(errorMessage, [error.message]);
    } else {
      console.error(errorMessage);
    }
    return null;
  }
};

// Configuration backup and restore
export const createConfigurationBackup = (config, backupName) => {
  try {
    const backupKey = `${CONFIG_STORAGE_KEY}_backup_${backupName || Date.now()}`;
    const backupData = {
      ...config,
      backupCreatedAt: new Date().toISOString(),
      backupName: backupName || 'Manual Backup',
      originalVersion: config.version
    };
    
    localStorage.setItem(backupKey, JSON.stringify(backupData));
    console.log(`Configuration backup created: ${backupKey}`);
    return backupKey;
  } catch (error) {
    console.error('Failed to create configuration backup:', error);
    return null;
  }
};

export const listConfigurationBackups = () => {
  try {
    const backups = [];
    const backupPrefix = `${CONFIG_STORAGE_KEY}_backup_`;
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(backupPrefix)) {
        try {
          const backupData = JSON.parse(localStorage.getItem(key));
          backups.push({
            key,
            name: backupData.backupName || 'Unnamed Backup',
            createdAt: backupData.backupCreatedAt || 'Unknown',
            version: backupData.originalVersion || 'Unknown',
            systems: backupData.systems?.length || 0,
            totalPVs: backupData.systems?.reduce((sum, sys) => sum + (sys.pvs?.length || 0), 0) || 0
          });
        } catch (parseError) {
          console.warn(`Failed to parse backup ${key}:`, parseError);
        }
      }
    }
    
    // Sort by creation date (newest first)
    return backups.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } catch (error) {
    console.error('Failed to list configuration backups:', error);
    return [];
  }
};

export const restoreConfigurationBackup = (backupKey, onConfirm) => {
  try {
    const backupData = localStorage.getItem(backupKey);
    if (!backupData) {
      throw new Error('Backup not found');
    }
    
    const config = JSON.parse(backupData);
    
    // Validate backup
    const validation = validateConfiguration(config);
    if (!validation.isValid) {
      throw new Error(`Invalid backup configuration: ${validation.errors.join(', ')}`);
    }
    
    const message = `Restore backup "${config.backupName || 'Unnamed'}"?\n\n` +
      `Created: ${config.backupCreatedAt || 'Unknown'}\n` +
      `Systems: ${config.systems?.length || 0}\n` +
      `Total PVs: ${config.systems?.reduce((sum, sys) => sum + (sys.pvs?.length || 0), 0) || 0}\n\n` +
      `This will replace your current configuration.`;
    
    const confirmed = onConfirm ? onConfirm(message, config) : showConfirmDialog(message);
    
    if (confirmed) {
      // Create backup of current config before restoring
      const currentConfig = loadConfiguration();
      createConfigurationBackup(currentConfig, 'Pre-restore backup');
      
      // Remove backup-specific fields and update version
      const restoredConfig = {
        ...config,
        version: CONFIG_VERSION,
        lastSaved: new Date().toISOString()
      };
      delete restoredConfig.backupCreatedAt;
      delete restoredConfig.backupName;
      delete restoredConfig.originalVersion;
      
      // Save restored configuration
      const success = saveConfiguration(restoredConfig);
      if (success) {
        console.log(`Configuration restored from backup: ${backupKey}`);
        return restoredConfig;
      } else {
        throw new Error('Failed to save restored configuration');
      }
    } else {
      throw new Error('Restore cancelled by user');
    }
  } catch (error) {
    console.error('Failed to restore configuration backup:', error);
    throw error;
  }
};

export const deleteConfigurationBackup = (backupKey, onConfirm) => {
  try {
    const backupData = localStorage.getItem(backupKey);
    if (!backupData) {
      throw new Error('Backup not found');
    }
    
    const config = JSON.parse(backupData);
    const message = `Delete backup "${config.backupName || 'Unnamed'}"?\n\n` +
      `Created: ${config.backupCreatedAt || 'Unknown'}\n` +
      `This action cannot be undone.`;
    
    const confirmed = onConfirm ? onConfirm(message) : showConfirmDialog(message);
    
    if (confirmed) {
      localStorage.removeItem(backupKey);
      console.log(`Configuration backup deleted: ${backupKey}`);
      return true;
    } else {
      return false;
    }
  } catch (error) {
    console.error('Failed to delete configuration backup:', error);
    throw error;
  }
};

// Configuration health check
export const performConfigurationHealthCheck = (config) => {
  const issues = [];
  const recommendations = [];
  
  if (!config) {
    issues.push('No configuration loaded');
    return { issues, recommendations, score: 0 };
  }
  
  // Check version
  if (config.version !== CONFIG_VERSION) {
    issues.push(`Configuration version mismatch (${config.version} vs ${CONFIG_VERSION})`);
  }
  
  // Check systems
  if (!Array.isArray(config.systems) || config.systems.length === 0) {
    issues.push('No systems configured');
  } else {
    const totalPVs = config.systems.reduce((sum, sys) => sum + (sys.pvs?.length || 0), 0);
    
    if (totalPVs === 0) {
      issues.push('No PVs configured across all systems');
    } else if (totalPVs > 5000) {
      recommendations.push(`Large number of PVs (${totalPVs}) may impact performance`);
    }
    
    // Check for systems without PVs
    const emptySystems = config.systems.filter(sys => !sys.pvs || sys.pvs.length === 0);
    if (emptySystems.length > 0) {
      recommendations.push(`${emptySystems.length} system(s) have no PVs configured`);
    }
    
    // Check for duplicate system names
    const systemNames = config.systems.map(sys => sys.name);
    const duplicateNames = systemNames.filter((name, index) => systemNames.indexOf(name) !== index);
    if (duplicateNames.length > 0) {
      issues.push(`Duplicate system names found: ${[...new Set(duplicateNames)].join(', ')}`);
    }
    
    // Check for very long system names
    const longNames = config.systems.filter(sys => sys.name && sys.name.length > 50);
    if (longNames.length > 0) {
      recommendations.push(`${longNames.length} system(s) have very long names (>50 chars)`);
    }
  }
  
  // Check polling frequency
  if (typeof config.pollingFrequency !== 'number') {
    issues.push('Invalid polling frequency');
  } else if (config.pollingFrequency < 500) {
    issues.push('Polling frequency too low (<500ms) may cause performance issues');
  } else if (config.pollingFrequency > 10000) {
    recommendations.push('Polling frequency very high (>10s) may cause stale data');
  }
  
  // Check settings
  if (config.settings) {
    if (config.settings.maxPVsPerSystem && config.settings.maxPVsPerSystem < 100) {
      recommendations.push('Max PVs per system setting is very low');
    }
    
    if (config.settings.connectionTimeout && config.settings.connectionTimeout < 1000) {
      recommendations.push('Connection timeout is very low (<1s)');
    }
  }
  
  // Calculate health score (0-100)
  const maxIssues = 10; // Arbitrary max for scoring
  const issueScore = Math.max(0, (maxIssues - issues.length) / maxIssues * 70);
  const recommendationScore = Math.max(0, (5 - recommendations.length) / 5 * 30);
  const score = Math.round(issueScore + recommendationScore);
  
  return {
    issues,
    recommendations,
    score,
    status: score >= 80 ? 'excellent' : score >= 60 ? 'good' : score >= 40 ? 'fair' : 'poor'
  };
};

// Configuration optimization suggestions
export const getConfigurationOptimizations = (config) => {
  const optimizations = [];
  
  if (!config || !config.systems) {
    return optimizations;
  }
  
  const totalPVs = config.systems.reduce((sum, sys) => sum + (sys.pvs?.length || 0), 0);
  
  // Polling frequency optimization
  if (totalPVs > 1000 && config.pollingFrequency < 2000) {
    optimizations.push({
      type: 'performance',
      title: 'Increase Polling Frequency',
      description: `With ${totalPVs} PVs, consider increasing polling frequency to 2-3 seconds`,
      impact: 'medium',
      action: 'increase_polling'
    });
  }
  
  // System organization
  const largeSystems = config.systems.filter(sys => sys.pvs && sys.pvs.length > 500);
  if (largeSystems.length > 0) {
    optimizations.push({
      type: 'organization',
      title: 'Split Large Systems',
      description: `${largeSystems.length} system(s) have >500 PVs. Consider splitting for better management`,
      impact: 'low',
      action: 'split_systems'
    });
  }
  
  // Auto-save optimization
  if (totalPVs > 2000 && config.settings?.autoSave !== false) {
    optimizations.push({
      type: 'performance',
      title: 'Consider Disabling Auto-save',
      description: 'With many PVs, auto-save may cause performance issues',
      impact: 'medium',
      action: 'disable_autosave'
    });
  }
  
  // Storage optimization
  const configSize = new Blob([JSON.stringify(config)]).size;
  if (configSize > 1024 * 1024) { // 1MB
    optimizations.push({
      type: 'storage',
      title: 'Large Configuration Size',
      description: `Configuration is ${(configSize / 1024 / 1024).toFixed(2)}MB. Consider exporting and cleaning up`,
      impact: 'low',
      action: 'cleanup_config'
    });
  }
  
  return optimizations;
};
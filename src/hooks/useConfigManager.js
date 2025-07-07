import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  saveConfiguration, 
  loadConfiguration, 
  exportConfiguration, 
  importConfiguration,
  clearConfiguration,
  validateConfiguration,
  getConfigurationStats,
  importConfigurationWithConfirmation,
  bulkDeleteSystems,
  updateConfigurationSafely,
  createConfigurationBackup,
  listConfigurationBackups,
  restoreConfigurationBackup,
  deleteConfigurationBackup,
  performConfigurationHealthCheck,
  getConfigurationOptimizations
} from '../utils/configManager';

// Custom confirmation function to avoid no-restricted-globals
const showConfirmDialog = (message) => {
  return window.confirm(message);
};

export function useConfigManager() {
  const [config, setConfig] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const autoSaveTimeoutRef = useRef(null);
  const configLoadedRef = useRef(false);
  const lastSavedConfigRef = useRef(null);

  // Load configuration on mount with error handling
  useEffect(() => {
    try {
      setIsLoading(true);
      setError(null);
      
      const loadedConfig = loadConfiguration();
      
      // Validate loaded configuration
      const validation = validateConfiguration(loadedConfig);
      if (!validation.isValid) {
        console.error('Loaded configuration is invalid:', validation.errors);
        setError(`Configuration validation failed: ${validation.errors.join(', ')}`);
        // Use default config if validation fails
        const defaultConfig = loadConfiguration();
        setConfig(defaultConfig);
        lastSavedConfigRef.current = JSON.stringify(defaultConfig);
      } else {
        setConfig(loadedConfig);
        lastSavedConfigRef.current = JSON.stringify(loadedConfig);
        
        if (validation.warnings.length > 0) {
          console.warn('Configuration warnings:', validation.warnings);
        }
      }
      
      configLoadedRef.current = true;
      console.log('Configuration loaded successfully');
    } catch (error) {
      console.error('Failed to load configuration:', error);
      setError(`Failed to load configuration: ${error.message}`);
      // Fallback to default configuration
      const defaultConfig = loadConfiguration();
      setConfig(defaultConfig);
      lastSavedConfigRef.current = JSON.stringify(defaultConfig);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Auto-save with debouncing and error handling
  const autoSave = useCallback((configToSave) => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    
    autoSaveTimeoutRef.current = setTimeout(async () => {
      try {
        if (configToSave.settings?.autoSave !== false) {
          // Validate before saving
          const validation = validateConfiguration(configToSave);
          if (!validation.isValid) {
            console.error('Cannot auto-save invalid configuration:', validation.errors);
            setError(`Auto-save failed: ${validation.errors.join(', ')}`);
            return;
          }
          
          const success = saveConfiguration(configToSave);
          if (success) {
            setHasUnsavedChanges(false);
            setError(null);
            lastSavedConfigRef.current = JSON.stringify(configToSave);
            console.log('Configuration auto-saved successfully');
          } else {
            console.error('Auto-save failed');
            setError('Auto-save failed. Please try saving manually.');
          }
        }
      } catch (error) {
        console.error('Error during auto-save:', error);
        setError(`Auto-save error: ${error.message}`);
      }
    }, 1000); // 1 second debounce
  }, []);

  // Update configuration with change detection
  const updateConfig = useCallback((updates) => {
    setConfig(prevConfig => {
      const newConfig = { ...prevConfig, ...updates };
      
      // Check if config actually changed
      const newConfigString = JSON.stringify(newConfig);
      const hasActualChanges = newConfigString !== lastSavedConfigRef.current;
      
      if (hasActualChanges) {
        setHasUnsavedChanges(true);
        setError(null);
        autoSave(newConfig);
        console.log('Configuration updated:', Object.keys(updates));
      }
      
      return newConfig;
    });
  }, [autoSave]);

  // Safe configuration update with validation
  const updateConfigSafely = useCallback((updates, onValidationError) => {
    const updatedConfig = updateConfigurationSafely(config, updates, onValidationError);
    if (updatedConfig) {
      setConfig(updatedConfig);
      setHasUnsavedChanges(true);
      autoSave(updatedConfig);
      return true;
    }
    return false;
  }, [config, autoSave]);

  // Manual save with validation
  const saveConfig = useCallback(() => {
    if (!config) {
      setError('No configuration to save');
      return false;
    }

    try {
      // Validate before saving
      const validation = validateConfiguration(config);
      if (!validation.isValid) {
        setError(`Cannot save invalid configuration: ${validation.errors.join(', ')}`);
        return false;
      }

      const success = saveConfiguration(config);
      if (success) {
        setHasUnsavedChanges(false);
        setError(null);
        lastSavedConfigRef.current = JSON.stringify(config);
        console.log('Configuration manually saved');
        
        if (validation.warnings.length > 0) {
          console.warn('Configuration saved with warnings:', validation.warnings);
        }
      } else {
        setError('Failed to save configuration');
      }
      return success;
    } catch (error) {
      console.error('Error saving configuration:', error);
      setError(`Save error: ${error.message}`);
      return false;
    }
  }, [config]);

  // Export configuration with error handling
  const exportConfig = useCallback(() => {
    if (!config) {
      setError('No configuration to export');
      return false;
    }

    try {
      const success = exportConfiguration(config);
      if (success) {
        setError(null);
        console.log('Configuration exported successfully');
      } else {
        setError('Failed to export configuration');
      }
      return success;
    } catch (error) {
      console.error('Error exporting configuration:', error);
      setError(`Export error: ${error.message}`);
      return false;
    }
  }, [config]);

  // Import configuration with validation
  const importConfig = useCallback(async (file, customConfirm = null) => {
    try {
      setError(null);
      
      if (customConfirm) {
        // Use the enhanced import with custom confirmation
        const importedConfig = await importConfigurationWithConfirmation(file, customConfirm);
        setConfig(importedConfig);
        setHasUnsavedChanges(true);
        autoSave(importedConfig);
        
        console.log('Configuration imported successfully with custom confirmation');
        return { success: true, config: importedConfig };
      } else {
        // Use the standard import
        const importedConfig = await importConfiguration(file);
        
        // Validate imported configuration
        const validation = validateConfiguration(importedConfig);
        if (!validation.isValid) {
          throw new Error(`Invalid configuration file: ${validation.errors.join(', ')}`);
        }
        
        setConfig(importedConfig);
        setHasUnsavedChanges(true);
        autoSave(importedConfig);
        
        console.log('Configuration imported successfully');
        
        return { 
          success: true, 
          config: importedConfig,
          warnings: validation.warnings
        };
      }
    } catch (error) {
      console.error('Import failed:', error);
      setError(`Import failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }, [autoSave]);

  // Reset to defaults with confirmation
  const resetConfig = useCallback((force = false, customConfirm = null) => {
    try {
      if (!force && hasUnsavedChanges) {
        const message = 'You have unsaved changes. Are you sure you want to reset to defaults?';
        const proceed = customConfirm ? customConfirm(message) : showConfirmDialog(message);
        if (!proceed) {
          return null;
        }
      }

      clearConfiguration();
      const defaultConfig = loadConfiguration();
      setConfig(defaultConfig);
      setHasUnsavedChanges(false);
      setError(null);
      lastSavedConfigRef.current = JSON.stringify(defaultConfig);
      console.log('Configuration reset to defaults');
      return defaultConfig;
    } catch (error) {
      console.error('Error resetting configuration:', error);
      setError(`Reset error: ${error.message}`);
      return null;
    }
  }, [hasUnsavedChanges]);

  // Bulk delete systems
  const deleteSystems = useCallback((systemIds, customConfirm = null) => {
    if (!config || !config.systems || systemIds.length === 0) {
      return false;
    }

    try {
      const confirmed = bulkDeleteSystems(systemIds, config.systems, customConfirm);
      
      if (confirmed) {
        const newSystems = config.systems.filter(sys => !systemIds.includes(sys.id));
        const updatedConfig = { ...config, systems: newSystems };
        
        setConfig(updatedConfig);
        setHasUnsavedChanges(true);
        autoSave(updatedConfig);
        
        console.log(`Deleted ${systemIds.length} systems`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error deleting systems:', error);
      setError(`Delete error: ${error.message}`);
      return false;
    }
  }, [config, autoSave]);

  // Backup management
  const createBackup = useCallback((backupName) => {
    if (!config) {
      setError('No configuration to backup');
      return null;
    }

    try {
      const backupKey = createConfigurationBackup(config, backupName);
      if (backupKey) {
        console.log('Configuration backup created successfully');
        return backupKey;
      } else {
        setError('Failed to create backup');
        return null;
      }
    } catch (error) {
      console.error('Error creating backup:', error);
      setError(`Backup error: ${error.message}`);
      return null;
    }
  }, [config]);

  const getBackups = useCallback(() => {
    try {
      return listConfigurationBackups();
    } catch (error) {
      console.error('Error listing backups:', error);
      setError(`Backup list error: ${error.message}`);
      return [];
    }
  }, []);

  const restoreBackup = useCallback((backupKey, customConfirm = null) => {
    try {
      const restoredConfig = restoreConfigurationBackup(backupKey, customConfirm);
      
      if (restoredConfig) {
        setConfig(restoredConfig);
        setHasUnsavedChanges(false);
        setError(null);
        lastSavedConfigRef.current = JSON.stringify(restoredConfig);
        console.log('Configuration restored from backup');
        return restoredConfig;
      }
      
      return null;
    } catch (error) {
      console.error('Error restoring backup:', error);
      setError(`Restore error: ${error.message}`);
      return null;
    }
  }, []);

  const deleteBackup = useCallback((backupKey, customConfirm = null) => {
    try {
      return deleteConfigurationBackup(backupKey, customConfirm);
    } catch (error) {
      console.error('Error deleting backup:', error);
      setError(`Delete backup error: ${error.message}`);
      return false;
    }
  }, []);

  // Health check and optimization
  const getHealthCheck = useCallback(() => {
    try {
      return performConfigurationHealthCheck(config);
    } catch (error) {
      console.error('Error performing health check:', error);
      setError(`Health check error: ${error.message}`);
      return null;
    }
  }, [config]);

  const getOptimizations = useCallback(() => {
    try {
      return getConfigurationOptimizations(config);
    } catch (error) {
      console.error('Error getting optimizations:', error);
      setError(`Optimization error: ${error.message}`);
      return [];
    }
  }, [config]);

  // Get configuration statistics
  const getStats = useCallback(() => {
    try {
      return getConfigurationStats();
    } catch (error) {
      console.error('Error getting configuration stats:', error);
      setError(`Stats error: ${error.message}`);
      return null;
    }
  }, []);

  // Validate current configuration
  const validateCurrentConfig = useCallback(() => {
    if (!config) return { isValid: false, errors: ['No configuration loaded'] };
    return validateConfiguration(config);
  }, [config]);

  // Check for unsaved changes by comparing with last saved state
  const checkForUnsavedChanges = useCallback(() => {
    if (!config || !lastSavedConfigRef.current) return false;
    
    const currentConfigString = JSON.stringify(config);
    return currentConfigString !== lastSavedConfigRef.current;
  }, [config]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  // Update hasUnsavedChanges when config changes
  useEffect(() => {
    if (configLoadedRef.current && config) {
      const hasChanges = checkForUnsavedChanges();
      setHasUnsavedChanges(hasChanges);
    }
  }, [config, checkForUnsavedChanges]);

  return {
    // State
    config,
    isLoading,
    hasUnsavedChanges,
    error,
    configLoaded: configLoadedRef.current,
    
    // Core Actions
    updateConfig,
    updateConfigSafely,
    saveConfig,
    exportConfig,
    importConfig,
    resetConfig,
    
    // System Management
    deleteSystems,
    
    // Backup Management
    createBackup,
    getBackups,
    restoreBackup,
    deleteBackup,
    
    // Health and Optimization
    getHealthCheck,
    getOptimizations,
    
    // Utilities
    getStats,
    validateCurrentConfig,
    checkForUnsavedChanges,
    
    // Clear error
    clearError: () => setError(null)
  };
}
import { useEffect, useCallback, useRef } from 'react';

export function useAppCleanup(subscribedPVs, unsubscribeFromPV, saveConfig, hasUnsavedChanges) {
  const cleanupInProgressRef = useRef(false);
  const cleanupTimeoutRef = useRef(null);

  const cleanup = useCallback(async () => {
    if (cleanupInProgressRef.current) {
      console.log('Cleanup already in progress, skipping...');
      return;
    }

    cleanupInProgressRef.current = true;
    console.log('Starting application cleanup...');
    
    try {
      // Save configuration if there are unsaved changes
      if (hasUnsavedChanges && saveConfig) {
        console.log('Saving unsaved configuration...');
        const saveSuccess = saveConfig();
        if (saveSuccess) {
          console.log('Configuration saved successfully');
        } else {
          console.warn('Failed to save configuration during cleanup');
        }
      }
      
      // Unsubscribe from all PVs with timeout protection
      if (subscribedPVs && subscribedPVs.size > 0 && unsubscribeFromPV) {
        console.log(`Unsubscribing from ${subscribedPVs.size} PVs...`);
        
        const unsubscribePromises = Array.from(subscribedPVs).map(pvName => {
          return Promise.race([
            unsubscribeFromPV(pvName),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error(`Timeout unsubscribing from ${pvName}`)), 5000)
            )
          ]);
        });
        
        try {
          const results = await Promise.allSettled(unsubscribePromises);
          const successful = results.filter(r => r.status === 'fulfilled').length;
          const failed = results.filter(r => r.status === 'rejected').length;
          
          console.log(`PV cleanup completed: ${successful} successful, ${failed} failed`);
          
          if (failed > 0) {
            console.warn('Some PVs failed to unsubscribe during cleanup');
          }
        } catch (error) {
          console.error('Error during PV cleanup:', error);
        }
      }
      
      console.log('Application cleanup completed successfully');
    } catch (error) {
      console.error('Error during application cleanup:', error);
    } finally {
      cleanupInProgressRef.current = false;
    }
  }, [subscribedPVs, unsubscribeFromPV, saveConfig, hasUnsavedChanges]);

  // Handle browser/tab close with improved reliability
  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (hasUnsavedChanges) {
        const message = 'You have unsaved changes. Are you sure you want to leave?';
        event.returnValue = message;
        
        // Try to save quickly during beforeunload (limited time available)
        if (saveConfig) {
          try {
            saveConfig();
          } catch (error) {
            console.error('Failed to save during beforeunload:', error);
          }
        }
        
        return message;
      }
    };

    const handleUnload = () => {
      // Synchronous cleanup only (async operations may not complete)
      if (hasUnsavedChanges && saveConfig) {
        try {
          saveConfig();
        } catch (error) {
          console.error('Failed to save during unload:', error);
        }
      }
    };

    // Use passive listeners where possible for better performance
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('unload', handleUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('unload', handleUnload);
    };
  }, [saveConfig, hasUnsavedChanges]);

  // Handle app visibility change (when tab becomes hidden)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && hasUnsavedChanges && saveConfig) {
        console.log('Tab hidden, auto-saving configuration...');
        
        // Clear any existing timeout
        if (cleanupTimeoutRef.current) {
          clearTimeout(cleanupTimeoutRef.current);
        }
        
        // Debounce the save operation
        cleanupTimeoutRef.current = setTimeout(() => {
          try {
            const success = saveConfig();
            if (success) {
              console.log('Auto-save completed successfully');
            } else {
              console.warn('Auto-save failed');
            }
          } catch (error) {
            console.error('Error during auto-save:', error);
          }
        }, 500);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (cleanupTimeoutRef.current) {
        clearTimeout(cleanupTimeoutRef.current);
      }
    };
  }, [saveConfig, hasUnsavedChanges]);

  // Handle page focus/blur for additional save opportunities
  useEffect(() => {
    const handleFocus = () => {
      // Page regained focus - good time to check connection status
      console.log('Page regained focus');
    };

    const handleBlur = () => {
      // Page lost focus - save if needed
      if (hasUnsavedChanges && saveConfig) {
        console.log('Page lost focus, auto-saving...');
        try {
          saveConfig();
        } catch (error) {
          console.error('Error saving on blur:', error);
        }
      }
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, [saveConfig, hasUnsavedChanges]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (cleanupTimeoutRef.current) {
        clearTimeout(cleanupTimeoutRef.current);
      }
    };
  }, []);

  // Manual cleanup function for explicit calls
  const performCleanup = useCallback(async () => {
    await cleanup();
  }, [cleanup]);

  return { 
    cleanup: performCleanup,
    isCleanupInProgress: () => cleanupInProgressRef.current
  };
}
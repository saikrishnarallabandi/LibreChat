import { useState, useEffect, useCallback, useMemo } from 'react';
import { setupPyodideVirtualFS, executePythonCode } from '~/utils/pyodide';
import { LocalStorageKeys } from 'librechat-data-provider';
import { useToast } from '~/hooks/useToast';

// Debug helper - can be turned off in production
const DEBUG = false;
const debugLog = (...args: any[]) => {
  if (DEBUG) {
    console.log('[Pyodide Hook]', ...args);
  }
};

declare global {
  interface Window {
    loadPyodide: () => Promise<any>;
    pyodide?: any;
  }
}

interface UsePyodideOptions {
  autoLoad?: boolean;
  onPyodideReady?: (pyodide: any) => void;
}

interface UsePyodideResult {
  isPyodideReady: boolean;
  isPyodideLoading: boolean;
  pyodideInstance: any;
  executePython: (code: string) => Promise<{ output: string; error?: string }>;
  loadPyodide: () => Promise<void>;
}

/**
 * Hook for managing Pyodide integration across components
 * 
 * @param options Configuration options
 * @returns Pyodide state and execution function
 */
const usePyodide = (options: UsePyodideOptions = {}): UsePyodideResult => {
  const { autoLoad = true, onPyodideReady } = options;
  const [isPyodideReady, setPyodideReady] = useState<boolean>(false);
  const [isPyodideLoading, setIsPyodideLoading] = useState<boolean>(false);
  const [pyodideInstance, setPyodideInstance] = useState<any>(null);
  const { showToast } = useToast();
  
  // Check if browser execution is enabled in local storage
  const useBrowserExecution = useMemo(() => {
    const storedValue = localStorage.getItem(LocalStorageKeys.BROWSER_CODE_EXECUTION);
    // Default to true if not set
    if (storedValue === null) {
      localStorage.setItem(LocalStorageKeys.BROWSER_CODE_EXECUTION, 'true');
      return true;
    }
    return storedValue === 'true';
  }, []);

  // Load Pyodide function that can be called explicitly
  const loadPyodide = useCallback(async () => {
    // If Pyodide is already loaded or loading, don't load it again
    if (isPyodideReady || isPyodideLoading) {
      return;
    }

    // If Pyodide is already loaded in window, use it
    if (window.pyodide) {
      debugLog('Pyodide already loaded in window, using existing instance');
      setPyodideInstance(window.pyodide);
      setPyodideReady(true);
      if (onPyodideReady) {
        onPyodideReady(window.pyodide);
      }
      return;
    }

    try {
      setIsPyodideLoading(true);

      // Load the Pyodide script if not already loaded
      if (!window.loadPyodide) {
        debugLog('Loading Pyodide script...');
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js';
        script.async = true;

        const loadPromise = new Promise<void>((resolve, reject) => {
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load Pyodide script'));
        });

        document.head.appendChild(script);
        await loadPromise;
      }

      // Initialize Pyodide
      debugLog('Loading Pyodide environment...');
      const pyodide = await window.loadPyodide();
      window.pyodide = pyodide;

      // Set up the Python environment
      await setupPyodideVirtualFS(pyodide);

      setPyodideInstance(pyodide);
      setPyodideReady(true);
      debugLog('Pyodide loaded successfully');

      // Notify via the callback
      if (onPyodideReady) {
        onPyodideReady(pyodide);
      }

      // Show success toast
      showToast({
        message: 'Python environment ready for browser execution',
        status: 'success'
      });
    } catch (error: any) {
      console.error('Error loading Pyodide:', error);
      showToast({
        message: 'Failed to load Python environment: ' + (error.message || 'Unknown error'),
        status: 'error'
      });
    } finally {
      setIsPyodideLoading(false);
    }
  }, [isPyodideReady, isPyodideLoading, showToast, onPyodideReady]);

  // Execute Python code using Pyodide
  const executePython = useCallback(
    async (code: string) => {
      if (!isPyodideReady || !pyodideInstance) {
        throw new Error('Pyodide is not ready. Please call loadPyodide first.');
      }

      debugLog('Executing Python code...');
      return executePythonCode(pyodideInstance, code);
    },
    [isPyodideReady, pyodideInstance]
  );

  // Load Pyodide automatically if autoLoad is true
  useEffect(() => {
    if (autoLoad && useBrowserExecution && !isPyodideReady && !isPyodideLoading) {
      // Load with a slight delay to not impact initial page render
      const timer = setTimeout(() => {
        loadPyodide();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [autoLoad, useBrowserExecution, isPyodideReady, isPyodideLoading, loadPyodide]);

  return {
    isPyodideReady,
    isPyodideLoading,
    pyodideInstance,
    executePython,
    loadPyodide
  };
};

export default usePyodide;
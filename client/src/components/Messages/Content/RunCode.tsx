import debounce from 'lodash/debounce';
import { Tools, AuthType, LocalStorageKeys } from 'librechat-data-provider';
import { TerminalSquareIcon, Loader } from 'lucide-react';
import React, { useMemo, useCallback, useEffect, useState } from 'react';
import type { CodeBarProps } from '~/common';
import { useVerifyAgentToolAuth, useToolCallMutation } from '~/data-provider';
import ApiKeyDialog from '~/components/SidePanel/Agents/Code/ApiKeyDialog';
import { useLocalize, useCodeApiKeyForm } from '~/hooks';
import { useMessageContext } from '~/Providers';
import { cn, normalizeLanguage } from '~/utils';
import { setupPyodideVirtualFS, executePythonCode } from '~/utils/pyodide';
import { useToastContext } from '~/Providers';
import { Spinner } from '~/components';

/**
 * Component to run code blocks in chat messages
 * Supports both API-based execution and browser-based execution via Pyodide
 */
const RunCode: React.FC<CodeBarProps> = React.memo(({ lang, codeRef, blockIndex }) => {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const execute = useToolCallMutation(Tools.execute_code, {
    onError: () => {
      showToast({ message: localize('com_ui_run_code_error'), status: 'error' });
    },
  });

  const { messageId, conversationId, partIndex } = useMessageContext();
  const normalizedLang = useMemo(() => normalizeLanguage(lang), [lang]);
  const { data } = useVerifyAgentToolAuth(
    { toolId: Tools.execute_code },
    {
      retry: 1,
    },
  );
  const authType = useMemo(() => data?.message ?? false, [data?.message]);
  const isAuthenticated = useMemo(() => data?.authenticated ?? false, [data?.authenticated]);
  const { methods, onSubmit, isDialogOpen, setIsDialogOpen, handleRevokeApiKey } =
    useCodeApiKeyForm({});
  
  // State for browser-based code execution
  // State for browser-based Python execution
  const [isPyodideLoading, setIsPyodideLoading] = useState(false);
  const [pyodideReady, setPyodideReady] = useState(false);
  const [pyodideInstance, setPyodideInstance] = useState<any>(null);
  
  // Check if browser execution is enabled in local storage
  const [useBrowserExecution, setUseBrowserExecution] = useState<boolean>(() => {
    try {
      const storedValue = localStorage.getItem(LocalStorageKeys.BROWSER_CODE_EXECUTION);
      // If not set, default to true and set it
      if (storedValue === null) {
        localStorage.setItem(LocalStorageKeys.BROWSER_CODE_EXECUTION, 'true');
        return true;
      }
      return storedValue === 'true';
    } catch (error) {
      console.error('Error reading browser execution setting:', error);
      return true; // Default to true if there's an error
    }
  });
  
  // Update local state when the localStorage value changes (in case it's changed from another component)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === LocalStorageKeys.BROWSER_CODE_EXECUTION) {
        setUseBrowserExecution(e.newValue === 'true');
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);
  
  // Check if Pyodide is already loaded when component mounts
  useEffect(() => {
    // Debug to console when the code block renders
    if (normalizedLang === 'python' || normalizedLang === 'py') {
      console.log(`Python code block detected (${normalizedLang})`);
    }
    
    // Make sure browser execution setting is properly set
    const storedValue = localStorage.getItem(LocalStorageKeys.BROWSER_CODE_EXECUTION);
    if (storedValue === null) {
      localStorage.setItem(LocalStorageKeys.BROWSER_CODE_EXECUTION, 'true');
    }
    
    // If Pyodide is already loaded, use it
    if (window.pyodide) {
      console.log('✅ Pyodide was already loaded, using existing instance');
      setPyodideInstance(window.pyodide);
      setPyodideReady(true);
      return;
    }
  }, [normalizedLang]);
  
  // Load Pyodide for browser-based Python execution
  useEffect(() => {
    // If Pyodide is already loaded, no need to continue
    if (window.pyodide) {
      setPyodideInstance(window.pyodide);
      setPyodideReady(true);
      return;
    }

    const loadPyodide = async () => {
      if (pyodideReady || (isPyodideLoading && !normalizedLang)) return;
      
      try {
        setIsPyodideLoading(true);
        
        if (!window.loadPyodide) {
          // Load the Pyodide script if not already loaded
          console.log('Loading Pyodide script...');
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
        console.log('Loading Pyodide environment...');
        const pyodide = await window.loadPyodide();
        window.pyodide = pyodide;
        
        // Set up the Python environment
        await setupPyodideVirtualFS(pyodide);
        
        setPyodideInstance(pyodide);
        setPyodideReady(true);
        console.log('✅ Pyodide loaded successfully');
        
        // Show success toast only if we're about to use it (Python code)
        if (normalizedLang === 'python' || normalizedLang === 'py') {
          showToast({ 
            message: 'Python environment ready for browser execution', 
            status: 'success' 
          });
        }
      } catch (error: any) {
        console.error('❌ Error loading Pyodide:', error);
        setUseBrowserExecution(false);
        showToast({ 
          message: 'Failed to load Python environment: ' + (error.message || 'Unknown error'), 
          status: 'error' 
        });
      } finally {
        setIsPyodideLoading(false);
      }
    };
    
    // Load Pyodide either when seeing Python code or proactively (with delay)
    if (normalizedLang === 'python' || normalizedLang === 'py') {
      loadPyodide();
    } else if (useBrowserExecution && !pyodideReady && !isPyodideLoading) {
      // Load Pyodide proactively with a slight delay to not impact initial page render
      const timer = setTimeout(() => {
        loadPyodide();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [normalizedLang, pyodideReady, isPyodideLoading, useBrowserExecution, showToast]);

  // Execute code either in browser (for Python) or via API
  const handleExecute = useCallback(async () => {
    const codeString: string = codeRef.current?.textContent ?? '';
    if (
      typeof codeString !== 'string' ||
      codeString.length === 0 ||
      typeof normalizedLang !== 'string' ||
      normalizedLang.length === 0
    ) {
      return;
    }

    // For Python, use browser-based execution if Pyodide is ready
    if ((normalizedLang === 'python' || normalizedLang === 'py') && 
        pyodideReady && 
        pyodideInstance && 
        useBrowserExecution) {
      
      setIsPyodideLoading(true);
      
      try {
        // Execute code using our utility function
        console.log('Executing Python code in browser...');
        const { output, error } = await executePythonCode(pyodideInstance, codeString);
        
        // Create output display
        const outputDiv = document.createElement('div');
        outputDiv.className = 'py-2 px-4 mt-2 bg-gray-200 dark:bg-gray-800 rounded text-sm font-mono whitespace-pre-wrap code-output';
        outputDiv.textContent = output || 'Code executed successfully (no output).';
        
        // Find the parent code block and append the output
        if (codeRef.current && codeRef.current.parentElement) {
          const parent = codeRef.current.parentElement.parentElement;
          if (parent) {
            // Remove previous outputs
            const previousOutputs = parent.querySelectorAll('.code-output');
            previousOutputs.forEach(el => el.remove());
            
            // Add new output
            parent.appendChild(outputDiv);
          }
        }
        
        if (error) {
          showToast({ message: error, status: 'error' });
        } else {
          showToast({ message: 'Code executed successfully in browser', status: 'success' });
        }
      } catch (error: any) {
        console.error('❌ Error executing code in browser:', error);
        
        // Display error message
        const errorDiv = document.createElement('div');
        errorDiv.className = 'py-2 px-4 mt-2 bg-red-100 dark:bg-red-900/30 rounded text-sm font-mono whitespace-pre-wrap code-output';
        errorDiv.textContent = error.message || 'An error occurred while running the code';
        
        // Find the parent code block and append the error
        if (codeRef.current && codeRef.current.parentElement) {
          const parent = codeRef.current.parentElement.parentElement;
          if (parent) {
            // Remove previous outputs
            const previousOutputs = parent.querySelectorAll('.code-output');
            previousOutputs.forEach(el => el.remove());
            
            // Add error output
            parent.appendChild(errorDiv);
          }
        }
        
        showToast({ 
          message: error.message || 'Error executing Python code in browser', 
          status: 'error' 
        });
      } finally {
        setIsPyodideLoading(false);
      }
      return;
    }
    
    // For Python, ensure we prioritize browser execution if enabled
    if ((normalizedLang === 'python' || normalizedLang === 'py') && useBrowserExecution) {
      // If Pyodide is currently loading, show a loading toast
      if (!pyodideReady && !isPyodideLoading) {
        // Try to load Pyodide on demand
        window.setTimeout(() => {
          // This will trigger the useEffect to load Pyodide
          setIsPyodideLoading(true);
          showToast({ 
            message: 'Loading Python environment for browser execution (this happens only once)...', 
            status: 'loading' 
          });
        }, 0);
        return;
      }
      
      // If Pyodide is still loading, show a waiting message
      if (!pyodideReady && isPyodideLoading) {
        showToast({
          message: 'Python environment is still loading, please wait a moment...',
          status: 'loading'
        });
        return;
      }
    }
    
    // Show a message for non-Python languages since we're only supporting browser execution
    if (normalizedLang !== 'python' && normalizedLang !== 'py') {
      showToast({
        message: 'Only Python code execution is supported in browser mode',
        status: 'error'
      });
      return;
    }
    
    // If Python but Pyodide isn't ready, show loading message
    if (!pyodideReady) {
      showToast({
        message: 'Python environment is loading. Please try again in a moment.',
        status: 'loading'
      });
      return;
    }
    
    // API-based execution is disabled, commenting out the code below
    /*
    // For non-Python languages or if browser execution is disabled, fall back to API
    if (!isAuthenticated) {
      setIsDialogOpen(true);
      return;
    }

    execute.mutate({
      partIndex,
      messageId,
      blockIndex,
      conversationId: conversationId ?? '',
      lang: normalizedLang,
      code: codeString,
    });
    */
  }, [
    codeRef,
    execute,
    partIndex,
    messageId,
    blockIndex,
    conversationId,
    normalizedLang,
    setIsDialogOpen,
    isAuthenticated,
    pyodideInstance,
    pyodideReady,
    useBrowserExecution,
    showToast
  ]);

  const debouncedExecute = useMemo(
    () => debounce(handleExecute, 1000, { leading: true }),
    [handleExecute],
  );

  useEffect(() => {
    return () => {
      debouncedExecute.cancel();
    };
  }, [debouncedExecute]);

  if (typeof normalizedLang !== 'string' || normalizedLang.length === 0) {
    return null;
  }

  const isExecutingCode = execute.isLoading || isPyodideLoading;
  const isPythonCode = normalizedLang === 'python' || normalizedLang === 'py';
  const isLoadingPython = isPythonCode && !pyodideReady && useBrowserExecution;
  const usesBrowserExecution = isPythonCode && useBrowserExecution;

  return (
    <>
      <button
        type="button"
        className={cn('ml-auto flex gap-2 items-center', {
          'text-green-600 dark:text-green-400': usesBrowserExecution && pyodideReady
        })}
        onClick={debouncedExecute}
        disabled={isExecutingCode || isLoadingPython}
        title={isLoadingPython ? 'Python environment is loading...' : 
              (usesBrowserExecution && pyodideReady && isPythonCode) ? 'Run Python code in browser (no API key needed)' : 
              usesBrowserExecution && isPythonCode ? 'Loading Python environment...' :
              isPythonCode ? 'Python execution requires API key (browser execution disabled)' :
              'Run code (requires API key for non-Python languages)'}
      >
        {isExecutingCode ? (
          <Loader className="animate-spin" size={18} />
        ) : (
          <TerminalSquareIcon size={18} />
        )}
        {localize('com_ui_run_code')}
        {isLoadingPython && (
          <span className="text-xs text-yellow-500 ml-1">(loading...)</span>
        )}
        {usesBrowserExecution && pyodideReady && isPythonCode && (
          <span className="text-xs text-green-500 ml-1">(browser)</span>
        )}
      </button>
      {/* API Key Dialog removed - browser-only mode */}
    </>
  );
});

export default RunCode;

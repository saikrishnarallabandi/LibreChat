import debounce from 'lodash/debounce';
import { useQueryClient } from '@tanstack/react-query';
import { Tools, AuthType, LocalStorageKeys, QueryKeys } from 'librechat-data-provider';
import { TerminalSquareIcon, Loader } from 'lucide-react';
import React, { useMemo, useCallback, useEffect } from 'react';
import type { CodeBarProps } from '~/common';
import type { ToolCallResult } from 'librechat-data-provider';
import { useVerifyAgentToolAuth, useToolCallMutation } from '~/data-provider';
import ApiKeyDialog from '~/components/SidePanel/Agents/Code/ApiKeyDialog';
import { useLocalize, useCodeApiKeyForm, usePyodide } from '~/hooks';
import { useMessageContext } from '~/Providers';
import { cn, normalizeLanguage } from '~/utils';
import { useToastContext } from '~/Providers';

// Add debugging utility
const debugLog = (message: string, ...data: any[]) => {
  console.log(`[RunCode] ${message}`, ...data);
};

/**
 * Component to run code blocks in chat messages
 * Supports both API-based execution and browser-based execution via Pyodide
 */
const RunCode: React.FC<CodeBarProps> = React.memo(({ lang, codeRef, blockIndex }) => {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const queryClient = useQueryClient();
  const execute = useToolCallMutation(Tools.execute_code, {
    onSuccess: (response) => {
      debugLog('Tool call mutation succeeded:', response);
      // Success is already handled by toast in the try/catch block
    },
    onError: (error) => {
      // More detailed error logging
      if (error && typeof error === 'object' && 'message' in error) {
        console.error(`[RunCode] Tool call mutation failed: ${error.message}`, error);
        
        // Check if it's an Axios error with response data
        if ('isAxiosError' in error && error.response?.data) {
          console.error('[RunCode] Server response data:', error.response.data);
        }
      } else {
        console.error('[RunCode] Tool call mutation failed:', error);
      }
      
      // We won't show this toast since we're handling errors locally and updating UI anyway
      // showToast({ message: localize('com_ui_run_code_error'), status: 'error' });
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
    
  // Use the shared Pyodide hook for browser-based execution
  const { 
    isPyodideReady: pyodideReady, 
    isPyodideLoading, 
    pyodideInstance, 
    executePython 
  } = usePyodide({
    autoLoad: false, // We'll load on demand when needed
  });
  
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
  
  // Check the current toolCalls in the cache when the component mounts
  useEffect(() => {
    if (conversationId && messageId) {
      const toolCallsData = queryClient.getQueryData<ToolCallResult[]>([QueryKeys.toolCalls, conversationId]);
      const toolCallMapKey = `${messageId}_${partIndex ?? 0}_${blockIndex ?? 0}_${Tools.execute_code}`;
      
      debugLog(
        `Component mounted for code block ${blockIndex} in message ${messageId}`,
        `\nToolCall key: ${toolCallMapKey}`,
        `\nExisting tool calls in cache:`, 
        toolCallsData
      );
      
      // More detailed logging about cache data
      if (toolCallsData && toolCallsData.length > 0) {
        debugLog(`Found ${toolCallsData.length} existing tool calls in cache`);
        
        // Check if any of the tool calls match our current code block
        const matchingCalls = toolCallsData.filter(call => 
          call.messageId === messageId && 
          call.partIndex === partIndex && 
          call.blockIndex === blockIndex
        );
        
        if (matchingCalls.length > 0) {
          debugLog(`Found ${matchingCalls.length} matching tool calls for this code block`, matchingCalls);
        } else {
          debugLog(`No matching tool calls found for this code block`);
        }
      } else {
        debugLog(`No tool calls found in cache for conversation ${conversationId}`);
      }
    }
  }, [conversationId, messageId, partIndex, blockIndex, queryClient]);
      return;
    }
  }, [normalizedLang, conversationId, messageId, partIndex, blockIndex, queryClient]);
  
  // Ensure proper settings for browser-based execution
  useEffect(() => {
    // Debug to console when the code block renders
    if (normalizedLang === 'python' || normalizedLang === 'py') {
      debugLog(`Python code block detected (${normalizedLang})`);
    }
  }, [normalizedLang]);

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
      
      try {
        // Execute code using our shared hook function
        debugLog('Executing Python code in browser...');
        const { output, error } = await executePython(codeString);
        
        debugLog('Execution complete. Output:', output, 'Error:', error);
        
        // Format the execution result
        const executionResult = error ? `Error: ${error}\n${output}` : output || 'Code executed successfully (no output).';
        
        // Create tool call result object
        const toolCallParams = {
          partIndex,
          messageId,
          blockIndex,
          conversationId: conversationId ?? '',
          lang: normalizedLang,
          code: codeString,
          result: executionResult,
        };
        
        // Create a tool call result for the cache
        const toolCallResult: ToolCallResult = {
          user: '',
          toolId: Tools.execute_code,
          partIndex: partIndex ?? 0,
          messageId,
          blockIndex: blockIndex ?? 0,
          conversationId: conversationId ?? '',
          result: executionResult,
        };
        
        // Generate the key used in toolCallsMap
        const toolCallMapKey = `${messageId}_${partIndex ?? 0}_${blockIndex ?? 0}_${Tools.execute_code}`;
        
        debugLog('Updating query cache with key:', toolCallMapKey);
        debugLog('Execution result to be saved:', executionResult);
        
        // Update the query cache directly for immediate UI feedback
        // Make sure we have a valid conversation ID
        const cacheKey = conversationId ? [QueryKeys.toolCalls, conversationId] : [QueryKeys.toolCalls, 'temp'];
        debugLog('Using cache key:', cacheKey);
        
        // Validate that the QueryKeys.toolCalls is the correct key for the cache
        const beforeUpdate = queryClient.getQueryData(cacheKey);
        debugLog('Cache data before update:', beforeUpdate);
        
        queryClient.setQueryData<ToolCallResult[]>(
          cacheKey,
          (oldData = []) => {
            // Check if we already have a result for this specific tool call
            const existingResultIndex = oldData.findIndex(
              item => 
                item.messageId === messageId && 
                item.blockIndex === blockIndex && 
                item.partIndex === partIndex
            );
            
            let newData;
            if (existingResultIndex >= 0) {
              // Update existing result
              debugLog('Updating existing tool call result at index:', existingResultIndex);
              newData = [...oldData];
              newData[existingResultIndex] = toolCallResult;
            } else {
              // Add new result
              debugLog('Adding new tool call result');
              newData = [...oldData, toolCallResult];
            }
            
            debugLog('Final cache data after update:', newData);
            return newData;
          }
        );
        
        // Force a refetch/update of any components that depend on the tool calls data
        debugLog('Forcing cache invalidation to update UI');
        queryClient.invalidateQueries({
          queryKey: cacheKey,
          exact: true,
          // Only update the cache/state, don't trigger a refetch
          refetchType: 'none'
        });
        
        debugLog('Also saving result via toolCallMutation');
        
        // Try to save via API but don't fail if API fails (since we've already updated the local cache)
        try {
          execute.mutate(toolCallParams, {
            onError: (apiError) => {
              // Log the error but don't surface it to the user since we've already shown success toast
              console.error('[RunCode] API call failed but UI is still updated:', apiError);
            }
          });
        } catch (apiError) {
          console.error('[RunCode] Failed to call execute mutation:', apiError);
          // No need to show error since we've already updated UI via query cache
        }
        
        if (error) {
          showToast({ message: error, status: 'error' });
        } else {
          showToast({ message: 'Code executed successfully in browser', status: 'success' });
        }
      } catch (error: any) {
        console.error('❌ Error executing code in browser:', error);
        
        // Format the error message
        const errorMessage = error.message || 'An error occurred while running the code';
        
        // Create parameter object for the mutation
        const errorParams = {
          partIndex,
          messageId,
          blockIndex,
          conversationId: conversationId ?? '',
          lang: normalizedLang,
          code: codeString,
          result: errorMessage,
        };
        
        // Create a tool call result for the cache
        const toolCallResult: ToolCallResult = {
          user: '',
          toolId: Tools.execute_code,
          partIndex: partIndex ?? 0,
          messageId,
          blockIndex: blockIndex ?? 0,
          conversationId: conversationId ?? '',
          result: errorMessage,
        };
        
        // Generate the key used in toolCallsMap
        const toolCallMapKey = `${messageId}_${partIndex ?? 0}_${blockIndex ?? 0}_${Tools.execute_code}`;
        
        debugLog('Updating query cache with error key:', toolCallMapKey);
        
        // Update the query cache directly for immediate UI feedback
        // Make sure we have a valid conversation ID
        const cacheKey = conversationId ? [QueryKeys.toolCalls, conversationId] : [QueryKeys.toolCalls, 'temp'];
        debugLog('Using cache key for error:', cacheKey);
        
        queryClient.setQueryData<ToolCallResult[]>(
          cacheKey,
          (oldData = []) => {
            // Check if we already have a result for this specific tool call
            const existingResultIndex = oldData.findIndex(
              item => 
                item.messageId === messageId && 
                item.blockIndex === blockIndex && 
                item.partIndex === partIndex
            );
            
            if (existingResultIndex >= 0) {
              // Update existing result
              debugLog('Updating existing error result at index:', existingResultIndex);
              const newData = [...oldData];
              newData[existingResultIndex] = toolCallResult;
              return newData;
            }
            
            // Add new result
            debugLog('Adding new error result');
            return [...oldData, toolCallResult];
          }
        );
        
        // Force a refetch/update of any components that depend on the tool calls data
        debugLog('Forcing cache invalidation for error to update UI');
        queryClient.invalidateQueries({
          queryKey: cacheKey,
          exact: true,
          // Only update the cache/state, don't trigger a refetch
          refetchType: 'none'
        });
        
        debugLog('Also saving error via toolCallMutation');
        
        // Try to save via API but don't fail if API fails (since we've already updated the local cache)
        try {
          execute.mutate(errorParams, {
            onError: (apiError) => {
              // Log the error but don't surface it to the user since we've already shown error toast
              console.error('[RunCode] Error API call failed but UI is still updated:', apiError);
            }
          });
        } catch (apiError) {
          console.error('[RunCode] Failed to call execute mutation for error:', apiError);
          // No need to show error since we've already updated UI via query cache
        }
        
        showToast({ 
          message: error.message || 'Error executing Python code in browser', 
          status: 'error' 
        });
      }
      return;
    }
    
    // For Python, ensure we prioritize browser execution if enabled
    if ((normalizedLang === 'python' || normalizedLang === 'py') && useBrowserExecution) {
      // If Pyodide is currently loading, show a loading toast
      if (!pyodideReady && !isPyodideLoading) {
        // Try to load Pyodide on demand using our hook
        showToast({ 
          message: 'Loading Python environment for browser execution (this happens only once)...', 
          status: 'loading' 
        });
        loadPyodide();
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
    showToast,
    queryClient  // Add queryClient to the dependency array
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

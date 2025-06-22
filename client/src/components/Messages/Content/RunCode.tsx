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
import { executePythonOnServer, renderPythonOutputImages } from '~/utils/pythonExecution';
import { useToastContext } from '~/Providers';
import { Spinner } from '~/components';

/**
 * Component to run code blocks in chat messages
 * Supports both API-based execution and browser-based execution via Pyodide
 */
const RunCode: React.FC<CodeBarProps> = React.memo(({ lang, codeRef, blockIndex }) => {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const [isExecuting, setIsExecuting] = useState(false);

  const normalizedLang = useMemo(() => normalizeLanguage(lang), [lang]);

  const handleExecute = useCallback(async (_event?: React.MouseEvent) => {
    const codeString: string = codeRef.current?.textContent ?? '';
    if (!codeString || typeof normalizedLang !== 'string' || normalizedLang.length === 0) {
      return;
    }
    if (normalizedLang !== 'python' && normalizedLang !== 'py') {
      showToast({
        message: 'Only Python code execution is supported.',
        status: 'error',
      });
      return;
    }
    setIsExecuting(true);
    try {
      const result = await executePythonOnServer(codeString);
      // Display output
      const outputDiv = document.createElement('div');
      outputDiv.className = 'py-2 px-4 mt-2 bg-gray-200 dark:bg-gray-800 rounded text-sm font-mono whitespace-pre-wrap code-output';
      outputDiv.textContent = result.output || 'Code executed successfully (no output).';
      if (codeRef.current && codeRef.current.parentElement) {
        const parent = codeRef.current.parentElement.parentElement;
        if (parent) {
          // Remove previous outputs
          const previousOutputs = parent.querySelectorAll('.code-output');
          previousOutputs.forEach(el => el.remove());
          parent.appendChild(outputDiv);
          // Render images if any
          renderPythonOutputImages(result, parent);
        }
      }
      showToast({ message: 'Code executed successfully on server', status: 'success' });
    } catch (error: any) {
      const errorDiv = document.createElement('div');
      errorDiv.className = 'py-2 px-4 mt-2 bg-red-100 dark:bg-red-900/30 rounded text-sm font-mono whitespace-pre-wrap code-output';
      errorDiv.textContent = error.message || 'An error occurred while running the code';
      if (codeRef.current && codeRef.current.parentElement) {
        const parent = codeRef.current.parentElement.parentElement;
        if (parent) {
          const previousOutputs = parent.querySelectorAll('.code-output');
          previousOutputs.forEach(el => el.remove());
          parent.appendChild(errorDiv);
        }
      }
      showToast({ message: error.message || 'Error executing Python code on server', status: 'error' });
    } finally {
      setIsExecuting(false);
    }
  }, [codeRef, normalizedLang, showToast]);

  const debouncedExecute = useMemo(
    () => debounce((e: React.MouseEvent) => handleExecute(e), 1000, { leading: true }),
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

  return (
    <>
      <button
        type="button"
        className={cn('ml-auto flex gap-2 items-center', {
          'text-blue-600 dark:text-blue-400': true,
        })}
        onClick={debouncedExecute}
        disabled={isExecuting}
        title={isExecuting ? 'Executing...' : 'Run Python code on server'}
      >
        {isExecuting ? (
          <Loader className="animate-spin" size={18} />
        ) : (
          <TerminalSquareIcon size={18} />
        )}
        {localize('com_ui_run_code')}
        {isExecuting && (
          <span className="text-xs text-yellow-500 ml-1">(executing...)</span>
        )}
        <span className="text-xs text-blue-500 ml-1">(server)</span>
      </button>
    </>
  );
});

export default RunCode;

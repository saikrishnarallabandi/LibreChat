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
import { useToastContext } from '~/Providers';
import { Spinner } from '~/components';

/**
 * Component to run code blocks in chat messages
 * Uses the proper tool call system to execute code and display results
 */
const RunCode: React.FC<CodeBarProps> = React.memo(({ lang, codeRef, blockIndex }) => {
  console.log('[RunCode] Component rendered with lang:', lang, 'blockIndex:', blockIndex);
  
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const { messageId, conversationId, partIndex } = useMessageContext();
  const [isExecuting, setIsExecuting] = useState(false);

  const normalizedLang = useMemo(() => normalizeLanguage(lang), [lang]);

  // Use the proper tool call mutation
  const toolCallMutation = useToolCallMutation(Tools.execute_code, {
    onSuccess: (response) => {
      console.log('[RunCode] Tool call successful:', response);
      showToast({ message: 'Code executed successfully', status: 'success' });
      setIsExecuting(false);
    },
    onError: (error: unknown) => {
      console.error('[RunCode] Tool call error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error executing code';
      showToast({ message: errorMessage, status: 'error' });
      setIsExecuting(false);
    },
  });

  const handleExecute = useCallback(async (_event?: React.MouseEvent) => {
    console.log('[RunCode] BUTTON CLICKED - handleExecute called!');
    
    if (!codeRef.current) {
      console.log('[RunCode] No code ref available');
      return;
    }
    
    const codeString: string = codeRef.current.textContent ?? '';
    console.log('[RunCode] Extracted code:', codeString);
    
    if (!codeString || typeof normalizedLang !== 'string' || normalizedLang.length === 0) {
      console.log('[RunCode] Invalid code or language:', { codeString, normalizedLang });
      return;
    }
    if (normalizedLang !== 'python' && normalizedLang !== 'py') {
      showToast({
        message: 'Only Python code execution is supported.',
        status: 'error',
      });
      return;
    }
    
    console.log('[RunCode] Setting isExecuting to true');
    setIsExecuting(true);
    
    // Use the tool call mutation instead of direct API call
    toolCallMutation.mutate({
      lang: normalizedLang,
      code: codeString,
      messageId: messageId || '',
      conversationId: conversationId || '',
      partIndex: partIndex || 0,
      blockIndex: blockIndex || 0,
    });
  }, [codeRef, normalizedLang, showToast, toolCallMutation, messageId, conversationId, partIndex, blockIndex]);

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
        disabled={isExecuting || toolCallMutation.isLoading}
        title={isExecuting ? 'Executing...' : 'Run Python code'}
      >
        {isExecuting || toolCallMutation.isLoading ? (
          <Loader className="animate-spin" size={18} />
        ) : (
          <TerminalSquareIcon size={18} />
        )}
        {localize('com_ui_run_code')}
        {(isExecuting || toolCallMutation.isLoading) && (
          <span className="text-xs text-yellow-500 ml-1">(executing...)</span>
        )}
        <span className="text-xs text-green-500 ml-1">(tool)</span>
      </button>
    </>
  );
});

export default RunCode;

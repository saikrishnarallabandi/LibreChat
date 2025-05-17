import copy from 'copy-to-clipboard';
import { InfoIcon } from 'lucide-react';
import { Tools } from 'librechat-data-provider';
import React, { useRef, useState, useMemo, useEffect } from 'react';
import type { CodeBarProps } from '~/common';
import LogContent from '~/components/Chat/Messages/Content/Parts/LogContent';
import ResultSwitcher from '~/components/Messages/Content/ResultSwitcher';
import { useToolCallsMapContext, useMessageContext } from '~/Providers';
import RunCode from '~/components/Messages/Content/RunCode';
import Clipboard from '~/components/svg/Clipboard';
import CheckMark from '~/components/svg/CheckMark';
import useLocalize from '~/hooks/useLocalize';
import cn from '~/utils/cn';

// Added debugging helper
const debugLog = (message: string, ...data: any[]) => {
  console.log(`[CodeBlock] ${message}`, ...data);
};

type CodeBlockProps = Pick<
  CodeBarProps,
  'lang' | 'plugin' | 'error' | 'allowExecution' | 'blockIndex'
> & {
  codeChildren: React.ReactNode;
  classProp?: string;
};

const CodeBar: React.FC<CodeBarProps> = React.memo(
  ({ lang, error, codeRef, blockIndex, plugin = null, allowExecution = true }) => {
    const localize = useLocalize();
    const [isCopied, setIsCopied] = useState(false);
    return (
      <div className="relative flex items-center justify-between rounded-tl-md rounded-tr-md bg-gray-700 px-4 py-2 font-sans text-xs text-gray-200 dark:bg-gray-700">
        <span className="">{lang}</span>
        {plugin === true ? (
          <InfoIcon className="ml-auto flex h-4 w-4 gap-2 text-white/50" />
        ) : (
          <div className="flex items-center justify-center gap-4">
            {allowExecution === true && (
              <RunCode lang={lang} codeRef={codeRef} blockIndex={blockIndex} />
            )}
            <button
              type="button"
              className={cn(
                'ml-auto flex gap-2',
                error === true ? 'h-4 w-4 items-start text-white/50' : '',
              )}
              onClick={async () => {
                const codeString = codeRef.current?.textContent;
                if (codeString != null) {
                  setIsCopied(true);
                  copy(codeString.trim(), { format: 'text/plain' });

                  setTimeout(() => {
                    setIsCopied(false);
                  }, 3000);
                }
              }}
            >
              {isCopied ? (
                <>
                  <CheckMark className="h-[18px] w-[18px]" />
                  {error === true ? '' : localize('com_ui_copied')}
                </>
              ) : (
                <>
                  <Clipboard />
                  {error === true ? '' : localize('com_ui_copy_code')}
                </>
              )}
            </button>
          </div>
        )}
      </div>
    );
  },
);

const CodeBlock: React.FC<CodeBlockProps> = ({
  lang,
  blockIndex,
  codeChildren,
  classProp = '',
  allowExecution = true,
  plugin = null,
  error,
}) => {
  const codeRef = useRef<HTMLElement>(null);
  const toolCallsMap = useToolCallsMapContext();
  const { messageId, partIndex } = useMessageContext();
  const key = allowExecution
    ? `${messageId}_${partIndex ?? 0}_${blockIndex ?? 0}_${Tools.execute_code}`
    : '';
  const [currentIndex, setCurrentIndex] = useState(0);

  // Enhanced debugging for tool calls
  debugLog(`Rendering code block for key: ${key}`);
  debugLog(`messageId: ${messageId}, partIndex: ${partIndex}, blockIndex: ${blockIndex}`);
  debugLog(`toolCallsMap available:`, !!toolCallsMap);
  if (toolCallsMap) {
    // Dump all keys to help debug
    const allKeys = Object.keys(toolCallsMap);
    debugLog(`Available tool call keys:`, allKeys);
    
    // Check if our key exists in some similar form
    const similarKeys = allKeys.filter(k => 
      k.includes(messageId ?? '') || 
      k.includes(String(blockIndex ?? '')) || 
      k.includes(Tools.execute_code)
    );
    if (similarKeys.length > 0) {
      debugLog(`Similar keys found:`, similarKeys);
    }
  }

  const fetchedToolCalls = toolCallsMap?.[key];
  const [toolCalls, setToolCalls] = useState(toolCallsMap?.[key] ?? null);

  useEffect(() => {
    if (fetchedToolCalls) {
      debugLog(`Fetched tool calls for key ${key}:`, fetchedToolCalls);
      setToolCalls(fetchedToolCalls);
      setCurrentIndex(fetchedToolCalls.length - 1);
      
      // Additional debug to check the actual result content
      fetchedToolCalls.forEach((call, idx) => {
        debugLog(`Tool call ${idx} result:`, call.result);
      });
    } else {
      debugLog(`No tool calls found for key ${key}`);
    }
  }, [fetchedToolCalls, key]);

  // Debug values in the rendered tool call
  useEffect(() => {
    if (toolCalls && toolCalls.length > 0) {
      debugLog(`Current tool call:`, toolCalls[currentIndex]);
      debugLog(`Result type:`, typeof toolCalls[currentIndex]?.result);
      debugLog(`Result value:`, toolCalls[currentIndex]?.result);
    }
  }, [toolCalls, currentIndex]);

  const currentToolCall = useMemo(() => toolCalls?.[currentIndex], [toolCalls, currentIndex]);

  // Debug the currentToolCall whenever it changes
  useEffect(() => {
    debugLog(`Current tool call changed:`, currentToolCall);
  }, [currentToolCall]);

  const next = () => {
    if (!toolCalls) {
      return;
    }
    if (currentIndex < toolCalls.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const previous = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const isNonCode = !!(plugin === true || error === true);
  const language = isNonCode ? 'json' : lang;

  // Debug right before rendering
  if (allowExecution && toolCalls && toolCalls.length > 0) {
    debugLog(`About to render code execution result`);
    debugLog(`Current result:`, currentToolCall?.result);
  } else if (allowExecution) {
    debugLog(`No results to render: toolCalls=${!!toolCalls}, length=${toolCalls?.length ?? 0}`);
  }

  return (
    <div className="w-full rounded-md bg-gray-900 text-xs text-white/80">
      <CodeBar
        lang={lang}
        error={error}
        codeRef={codeRef}
        blockIndex={blockIndex}
        plugin={plugin === true}
        allowExecution={allowExecution}
      />
      <div className={cn(classProp, 'overflow-y-auto p-4')}>
        <code
          ref={codeRef}
          className={cn(
            isNonCode ? '!whitespace-pre-wrap' : `hljs language-${language} !whitespace-pre`,
          )}
        >
          {codeChildren}
        </code>
      </div>
      {allowExecution === true && toolCalls && toolCalls.length > 0 && (
        <>
          <div className="bg-gray-700 p-4 text-xs">
            <div
              className="prose flex flex-col-reverse text-white"
              style={{
                color: 'white',
              }}
            >
              <pre className="shrink-0">
                <LogContent
                  output={(currentToolCall?.result as string | undefined) ?? ''}
                  attachments={currentToolCall?.attachments ?? []}
                  renderImages={true}
                />
              </pre>
            </div>
          </div>
          {toolCalls.length > 1 && (
            <ResultSwitcher
              currentIndex={currentIndex}
              totalCount={toolCalls.length}
              onPrevious={previous}
              onNext={next}
            />
          )}
        </>
      )}
    </div>
  );
};

export default CodeBlock;

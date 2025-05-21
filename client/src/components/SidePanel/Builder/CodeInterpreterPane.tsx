import React, { useState, useRef, useCallback } from 'react';
import { usePyodide } from '~/hooks';
import { Code } from 'lucide-react';
import { Button } from '~/components/ui/Button';
import { Loader } from '~/components/svg';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';

interface CodeInterpreterPaneProps {
  defaultCode?: string;
}

/**
 * Code editor and execution component for use in the right panel
 */
const CodeInterpreterPane: React.FC<CodeInterpreterPaneProps> = ({ defaultCode = '' }) => {
  const localize = useLocalize();
  const [code, setCode] = useState<string>(defaultCode);
  const [output, setOutput] = useState<string>('');
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const codeEditorRef = useRef<HTMLTextAreaElement>(null);

  // Initialize Pyodide
  const { 
    isPyodideReady, 
    isPyodideLoading, 
    executePython, 
    loadPyodide 
  } = usePyodide({ autoLoad: true });

  // Execute the code in the editor
  const handleExecute = useCallback(async () => {
    if (!isPyodideReady) {
      if (!isPyodideLoading) {
        loadPyodide();
      }
      return;
    }

    const codeToExecute = code.trim();
    if (!codeToExecute) {
      setOutput('No code to execute');
      return;
    }

    setIsExecuting(true);
    setOutput('Executing code...');

    try {
      const result = await executePython(codeToExecute);
      
      if (result.error) {
        setOutput(`${result.error}\n\n${result.output || ''}`);
      } else {
        setOutput(result.output || 'Code executed successfully (no output)');
      }
    } catch (err: any) {
      setOutput(`Error: ${err.message || 'An unknown error occurred'}`);
      console.error('Error executing Python code:', err);
    } finally {
      setIsExecuting(false);
    }
  }, [code, isPyodideReady, isPyodideLoading, executePython, loadPyodide]);

  // UI for the code interpreter pane
  return (
    <div className="flex flex-col w-full h-full">
      <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-2 px-3">
          <Code className="w-4 h-4 text-gray-600 dark:text-gray-300" />
          <span className="font-medium text-sm text-gray-700 dark:text-gray-200">
            {localize('com_assistants_code_interpreter')} (Browser Python)
          </span>
        </div>
        <Button
          onClick={handleExecute}
          disabled={isExecuting || isPyodideLoading || !code.trim()}
          className={cn("mr-3 text-xs py-1 px-2", {
            "bg-green-600 hover:bg-green-700": isPyodideReady && !isExecuting,
            "bg-gray-500 hover:bg-gray-600": !isPyodideReady || isExecuting
          })}
          type="button"
          size="sm"
        >
          {isExecuting ? (
            <Loader className="animate-spin mr-1 w-3 h-3" />
          ) : (
            <Code className="mr-1 w-3 h-3" />
          )}
          {isPyodideLoading ? 'Loading Python...' : localize('com_ui_run_code')}
          {isPyodideReady && !isExecuting && !isPyodideLoading && (
            <span className="ml-1 text-xs">(browser)</span>
          )}
        </Button>
      </div>

      <div className="flex flex-col flex-grow overflow-hidden">
        <div className="p-2 flex-grow overflow-hidden">
          <textarea
            ref={codeEditorRef}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full h-40 min-h-32 p-3 font-mono text-sm rounded-md bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="# Enter Python code here"
            spellCheck={false}
          />
        </div>

        <div className="p-2 flex-grow overflow-hidden">
          <div className="w-full h-40 min-h-32 overflow-auto p-3 font-mono text-sm rounded-md bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700">
            <pre className="whitespace-pre-wrap break-words">
              {output || 'Run your code to see output here'}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CodeInterpreterPane;

export default CodeInterpreterPane;
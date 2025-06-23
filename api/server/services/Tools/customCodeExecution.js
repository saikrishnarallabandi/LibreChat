const { tool } = require('@langchain/core/tools');
const { z } = require('zod');
const axios = require('axios');
const { logger } = require('~/config');

/**
 * Custom Code Execution Tool that uses our custom Python backend
 * This replaces the default createCodeExecutionTool to use our /api/python/execute endpoint
 */
function createCustomCodeExecutionTool({ user_id, apiKey, files = [] }) {
  const executeCodeSchema = z.object({
    lang: z.string().describe('The programming language of the code'),
    code: z.string().describe('The code to execute'),
  });

  const executeCode = tool(
    async ({ lang, code }) => {
      console.log('[CustomCodeExecutionTool] Executing code:', { lang, code: code.substring(0, 100) + '...' });
      
      try {
        // Only support Python for now
        if (lang !== 'python' && lang !== 'py') {
          throw new Error('Only Python code execution is supported.');
        }

        // Make request to our custom Python backend
        const response = await axios.post('http://localhost:3080/api/python/execute', {
          code: code,
        }, {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 30000, // 30 second timeout
        });

        console.log('[CustomCodeExecutionTool] Response:', response.data);

        const result = response.data;
        
        if (result.success) {
          // Format the output for the chat interface
          let output = result.output || 'Code executed successfully (no output).';
          
          // Create artifact structure for file handling
          const artifact = {
            files: result.images || [],
            session_id: `custom_${user_id}_${Date.now()}`,
          };

          // Return as two-tuple: [content, artifact] for content_and_artifact format
          return [output, artifact.files.length > 0 ? artifact : null];
        } else {
          // Handle execution errors
          const errorMessage = result.error?.message || 'Code execution failed';
          return [`Error: ${errorMessage}`, null];
        }
      } catch (error) {
        console.error('[CustomCodeExecutionTool] Error:', error);
        
        let errorMessage = 'Failed to execute code';
        if (error.response?.data?.error) {
          errorMessage = error.response.data.error;
        } else if (error.message) {
          errorMessage = error.message;
        }
        
        return [`Error: ${errorMessage}`, null];
      }
    },
    {
      name: 'execute_code',
      description: 'Execute Python code and return the output',
      schema: executeCodeSchema,
      responseFormat: 'content_and_artifact',
    }
  );

  // Attach the API key for compatibility
  executeCode.apiKey = apiKey;
  
  return executeCode;
}

module.exports = {
  createCustomCodeExecutionTool,
};

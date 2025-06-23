import { createBackendRequest } from '~/utils/createBackendRequest';

/**
 * Execute Python code on the server with visualization support
 * @param {string} code The Python code to execute
 */
export const executePythonOnServer = async (code) => {
  console.log('[pythonExecution] Starting executePythonOnServer with code:', code);
  
  if (!code || code.trim() === '') {
    throw new Error('No code provided');
  }

  try {
    console.log('[pythonExecution] Creating backend request...');
    const backendRequest = createBackendRequest();
    console.log('[pythonExecution] Backend request created:', backendRequest.defaults);
    console.log('[pythonExecution] Making POST to /api/python/execute');
    
    const response = await backendRequest.post('/api/python/execute', { code });
    console.log('[pythonExecution] Got response status:', response.status);
    console.log('[pythonExecution] Got response data:', response.data);
    
    return response.data;
  } catch (error) {
    console.error('[pythonExecution] Error executing Python code on server:', error);
    console.error('[pythonExecution] Error response:', error.response);
    console.error('[pythonExecution] Error request:', error.request);
    console.error('[pythonExecution] Error config:', error.config);
    
    // Handle different error types
    if (error.response?.data) {
      throw new Error(error.response.data.error || 'Failed to execute code on server');
    } else if (error.message) {
      throw new Error(`Server error: ${error.message}`);
    } else {
      throw new Error('Unknown server error');
    }
  }
};

/**
 * Render images from Python execution results in the DOM
 * @param {Object} result The result object from the Python execution
 * @param {Element} parentElement The DOM element to append images to
 */
export const renderPythonOutputImages = (result, parentElement) => {
  if (!result || !result.images || !result.images.length || !parentElement) {
    return;
  }

  // Create a container for images
  const imagesContainer = document.createElement('div');
  imagesContainer.className = 'py-2 mt-2 flex flex-col space-y-2 code-output';

  // Add each image
  result.images.forEach((image, index) => {
    const imgWrapper = document.createElement('div');
    imgWrapper.className = 'py-1 rounded overflow-hidden';
    
    const imgElement = document.createElement('img');
    imgElement.src = `data:image/png;base64,${image.data}`;
    imgElement.alt = `Figure ${index + 1}`;
    imgElement.className = 'max-w-full';
    
    imgWrapper.appendChild(imgElement);
    imagesContainer.appendChild(imgWrapper);
  });

  // Add the images to the parent element
  parentElement.appendChild(imagesContainer);
};

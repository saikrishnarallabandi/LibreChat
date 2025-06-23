import axios from 'axios';

export function createBackendRequest() {
  const baseURL = import.meta.env.DEV ? '/api' : '/api';
  console.log('[createBackendRequest] Creating axios instance with baseURL:', baseURL);
  
  return axios.create({
    baseURL,
    timeout: 30000, // 30 second timeout
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

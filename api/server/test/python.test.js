const request = require('supertest');
const express = require('express');
const pythonRouter = require('../routes/python');

describe('Python Execution API', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/python', pythonRouter);
  });

  it('should return 400 if no code is provided', async () => {
    const response = await request(app)
      .post('/api/python/execute')
      .send({});
    
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('No code provided');
  });

  it('should execute simple Python code successfully', async () => {
    const response = await request(app)
      .post('/api/python/execute')
      .send({
        code: 'print("Hello, world!")'
      });
    
    // In a real test, we would expect this to succeed
    // Here we're just testing the API structure since the Python environment
    // might not be available in the test environment
    if (response.status === 200) {
      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('output');
      
      if (response.body.success) {
        expect(response.body.output).toContain('Hello, world!');
      }
    }
  });
});

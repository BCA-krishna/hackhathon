const request = require('supertest');
const createApp = require('../src/app');

const app = createApp();

describe('Auth API', () => {
  it('should signup and login successfully', async () => {
    const signup = await request(app).post('/api/auth/signup').send({
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123'
    });

    expect(signup.statusCode).toBe(201);
    expect(signup.body.data.token).toBeTruthy();

    const login = await request(app).post('/api/auth/login').send({
      email: 'test@example.com',
      password: 'password123'
    });

    expect(login.statusCode).toBe(200);
    expect(login.body.data.user.email).toBe('test@example.com');
  });

  it('should reject invalid login', async () => {
    const response = await request(app).post('/api/auth/login').send({
      email: 'unknown@example.com',
      password: 'password123'
    });

    expect(response.statusCode).toBe(401);
  });
});

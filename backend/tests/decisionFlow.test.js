const request = require('supertest');
const createApp = require('../src/app');

const app = createApp();

async function createUserAndToken() {
  const signup = await request(app).post('/api/auth/signup').send({
    name: 'Flow User',
    email: 'flow@example.com',
    password: 'password123'
  });
  return signup.body.data.token;
}

describe('Decision support flow', () => {
  it('should upload data and return insights, forecast, alerts, recommendations', async () => {
    const token = await createUserAndToken();

    const records = [
      { productName: 'Coffee', sales: 100, stock: 5, date: '2026-04-01' },
      { productName: 'Tea', sales: 50, stock: 30, date: '2026-04-01' },
      { productName: 'Coffee', sales: 120, stock: 4, date: '2026-04-02' },
      { productName: 'Tea', sales: 40, stock: 28, date: '2026-04-02' }
    ];

    const upload = await request(app)
      .post('/api/upload-data')
      .set('Authorization', `Bearer ${token}`)
      .send({ records });

    expect(upload.statusCode).toBe(201);
    expect(upload.body.data.count).toBe(4);

    const insights = await request(app)
      .get('/api/insights')
      .set('Authorization', `Bearer ${token}`);
    expect(insights.statusCode).toBe(200);
    expect(insights.body.data.totalSales).toBe(310);

    const forecast = await request(app)
      .get('/api/forecast')
      .set('Authorization', `Bearer ${token}`);
    expect(forecast.statusCode).toBe(200);
    expect(forecast.body.data.predictions).toHaveLength(7);

    const alerts = await request(app)
      .get('/api/alerts')
      .set('Authorization', `Bearer ${token}`);
    expect(alerts.statusCode).toBe(200);

    const recommendations = await request(app)
      .get('/api/recommendations')
      .set('Authorization', `Bearer ${token}`);
    expect(recommendations.statusCode).toBe(200);
  });

  it('should validate upload schema', async () => {
    const token = await createUserAndToken();

    const upload = await request(app)
      .post('/api/upload-data')
      .set('Authorization', `Bearer ${token}`)
      .send({ records: [{ productName: 'Coffee', sales: -1, stock: 10, date: '2026-04-01' }] });

    expect(upload.statusCode).toBe(400);
  });
});

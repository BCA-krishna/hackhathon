# Real-Time Decision Support System for Small Businesses

Production-ready full-stack app with real-time analytics and AI-assisted forecasting.

## Tech Stack

- Backend: Node.js, Express, Firebase Firestore, JWT, Socket.IO
- Frontend: React (Vite), Tailwind CSS, Axios, Recharts
- Testing: Jest, Supertest, mongodb-memory-server

## Features

- JWT authentication (`/api/auth/signup`, `/api/auth/login`)
- Protected APIs with auth middleware
- Data ingestion (`POST /api/upload-data`) via CSV, JSON file, or manual JSON payload
- Insights engine (`GET /api/insights`) for total sales, daily trends, top products
- Forecast module (`GET /api/forecast`) with moving-average next 7-day prediction
- Alert system (`GET /api/alerts`) for low-stock and sales-drop alerts
- Recommendation engine (`GET /api/recommendations`) for restock/promotion suggestions
- Real-time updates using Socket.IO events (`data_uploaded`, `alerts_updated`)

## Folder Structure

- `backend/src/controllers`
- `backend/src/services`
- `backend/src/models`
- `backend/src/routes`
- `backend/src/middlewares`
- `backend/src/utils`
- `frontend/src/pages` (Login, Dashboard, Upload Data, Forecast, Alerts)
- `frontend/src/components`
- `frontend/src/context`
- `frontend/src/services`

## Setup

### 1. Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`, backend at `http://localhost:5000`.

## API Examples

### Signup

```bash
curl -X POST http://localhost:5000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@example.com","password":"password123"}'
```

### Upload JSON Data

```bash
curl -X POST http://localhost:5000/api/upload-data \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"records":[{"productName":"Coffee","sales":120,"stock":8,"date":"2026-04-10"}]}'
```

### Upload CSV File

```bash
curl -X POST http://localhost:5000/api/upload-data \
  -H "Authorization: Bearer <TOKEN>" \
  -F "file=@sales.csv"
```

## Tests

```bash
cd backend
npm test
```

## Notes

- Firestore collections used: `users`, `sales`, `inventory`, `alerts`
- Forecast uses moving average for a stable baseline
- Frontend routes are protected by auth context + token persistence
- Dashboard updates in near real-time via websocket events

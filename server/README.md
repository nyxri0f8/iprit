# RIT IPR Backend Server

Simple Node.js + Express backend with SQLite database for RIT IPR Portal.

## Features

- ✅ User authentication (register/login with JWT)
- ✅ User management with default institution
- ✅ Patent submission and storage
- ✅ Patent history tracking
- ✅ User statistics
- ✅ SQLite database (no external DB needed)
- ✅ Secure password hashing
- ✅ CORS enabled for frontend

## Installation

```bash
cd server
npm install
```

## Configuration

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Edit `.env` and set your values:
```env
PORT=5000
JWT_SECRET=your-super-secret-jwt-key-change-this
NODE_ENV=development
```

## Running the Server

### Development (with auto-reload):
```bash
npm run dev
```

### Production:
```bash
npm start
```

Server will run on `http://localhost:5000`

## API Endpoints

### Authentication

#### Register
```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "department": "Computer Science"
}
```

Response:
```json
{
  "message": "Account created successfully",
  "token": "jwt-token-here",
  "user": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "institution": "Rajalakshmi Institute of Technology",
    "department": "Computer Science",
    "created_at": "2024-01-01T00:00:00.000Z"
  }
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "password123"
}
```

#### Get Current User
```http
GET /api/auth/me
Authorization: Bearer <token>
```

### Patents

#### Create Patent
```http
POST /api/patents
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "IoT Based Smart System",
  "problem": "Problem description",
  "components": "Components used",
  "working": "How it works",
  "industry": "IoT",
  "unique_features": "Unique aspects",
  "innovation_score": 85,
  "novelty_score": 78,
  "readiness_score": 82,
  "grant_probability": 75,
  "status": "completed",
  "analysis_data": { ... },
  "applicant_data": { ... }
}
```

#### Get User's Patents
```http
GET /api/patents?limit=20
Authorization: Bearer <token>
```

#### Get Single Patent
```http
GET /api/patents/:id
Authorization: Bearer <token>
```

#### Update Patent
```http
PATCH /api/patents/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "filed"
}
```

#### Delete Patent
```http
DELETE /api/patents/:id
Authorization: Bearer <token>
```

### Statistics

#### Get User Stats
```http
GET /api/stats
Authorization: Bearer <token>
```

Response:
```json
{
  "stats": {
    "total_patents": 5,
    "completed_patents": 4,
    "avg_innovation_score": 82.5,
    "avg_novelty_score": 78.3,
    "avg_readiness_score": 80.1
  }
}
```

### Admin (Optional)

#### Get All Users
```http
GET /api/admin/users
Authorization: Bearer <token>
```

#### Get All Patents
```http
GET /api/admin/patents?limit=100
Authorization: Bearer <token>
```

### Health Check

```http
GET /api/health
```

## Database Schema

### Users Table
```sql
- id (INTEGER PRIMARY KEY)
- name (TEXT)
- email (TEXT UNIQUE)
- password (TEXT, hashed)
- institution (TEXT, default: "Rajalakshmi Institute of Technology")
- department (TEXT)
- role (TEXT, default: "user")
- created_at (DATETIME)
- updated_at (DATETIME)
```

### Patents Table
```sql
- id (INTEGER PRIMARY KEY)
- user_id (INTEGER, foreign key)
- title (TEXT)
- problem (TEXT)
- components (TEXT)
- working (TEXT)
- industry (TEXT)
- unique_features (TEXT)
- innovation_score (INTEGER)
- novelty_score (INTEGER)
- readiness_score (INTEGER)
- grant_probability (INTEGER)
- status (TEXT, default: "draft")
- analysis_data (TEXT, JSON)
- applicant_data (TEXT, JSON)
- created_at (DATETIME)
- updated_at (DATETIME)
```

## Default Values

- **Institution**: "Rajalakshmi Institute of Technology" (set automatically)
- **Role**: "user"
- **Status**: "draft" (for patents)

## Security Features

- Password hashing with bcryptjs
- JWT token authentication
- Token expiration (30 days)
- CORS protection
- SQL injection prevention (prepared statements)

## Error Handling

All endpoints return appropriate HTTP status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Server Error

## Database File

The SQLite database is stored as `rit-ipr.db` in the server directory.

To reset the database, simply delete the file:
```bash
rm rit-ipr.db
```

The database will be recreated on next server start.

## Production Deployment

1. Set `NODE_ENV=production` in `.env`
2. Use a strong `JWT_SECRET`
3. Consider using PostgreSQL/MySQL for production
4. Add rate limiting
5. Add request validation
6. Set up HTTPS
7. Use environment variables for sensitive data

## Testing

Test the API using:
- Postman
- cURL
- Thunder Client (VS Code extension)

Example cURL:
```bash
# Register
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"test123","department":"CSE"}'

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'
```

## Support

For issues or questions, contact the RIT IPR development team.

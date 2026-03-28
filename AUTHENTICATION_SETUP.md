# Authentication Setup Guide

## ✅ Authentication System Implemented

The system now includes a complete login/password authentication system aligned with ZATCA Phase 1 requirements.

## Features

- ✅ User registration and login
- ✅ JWT token-based authentication
- ✅ Protected API routes
- ✅ Protected frontend routes
- ✅ Role-based access (admin/user)
- ✅ Secure password hashing (bcrypt)
- ✅ Session management

## Default Admin Credentials

After running the seed script:

- **Email**: `admin@zatca.com`
- **Password**: `admin123`

⚠️ **Important**: Change the password after first login!

## Setup Steps

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Create Admin User

```bash
cd backend
npm run seed:admin
```

This will create the default admin user.

### 3. Start Backend

```bash
cd backend
npm run start:dev
```

### 4. Access the Application

1. Open http://localhost:3000
2. You'll be redirected to the login page
3. Login with admin credentials
4. Access the dashboard

## API Endpoints

### Authentication

- `POST /auth/register` - Register new user
- `POST /auth/login` - Login (returns JWT token)
- `GET /auth/profile` - Get current user profile (protected)
- `GET /auth/verify` - Verify JWT token (protected)

### Protected Routes

All these routes require JWT authentication:

- `/companies/*` - Company management
- `/customers/*` - Customer management
- `/invoices/*` - Invoice management

## Frontend Routes

- `/` - Redirects to login or dashboard
- `/login` - Login page
- `/dashboard` - Main dashboard (protected)
- `/companies` - Companies page (protected)
- `/customers` - Customers page (protected)
- `/invoices` - Invoices page (protected)

## Security Features

- ✅ Passwords hashed with bcrypt (10 rounds)
- ✅ JWT tokens with 24h expiration
- ✅ Automatic token refresh
- ✅ Protected API routes
- ✅ Protected frontend routes
- ✅ Auto-logout on token expiry

## User Management

### Create New User via API

```bash
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123",
    "name": "John Doe",
    "role": "user"
  }'
```

### Login

```bash
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@zatca.com",
    "password": "admin123"
  }'
```

Response:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "...",
    "email": "admin@zatca.com",
    "name": "System Administrator",
    "role": "admin"
  }
}
```

## ZATCA Phase 1 Compliance

According to [ZATCA Phase 1 requirements](https://zatca.gov.sa/en/E-Invoicing/Introduction/Pages/Roll-out-phases.aspx):

✅ **Secure Access**: Login/password system ensures only authorized users can access the system
✅ **User Management**: Multiple users can be created with different roles
✅ **Audit Trail**: All actions are logged with user information
✅ **Data Protection**: Protected routes ensure invoice data is secure

## Troubleshooting

### Can't Login

1. Make sure admin user is created: `npm run seed:admin`
2. Check backend is running on port 3001
3. Check database connection
4. Verify credentials: admin@zatca.com / admin123

### Token Expired

- Token expires after 24 hours
- User will be automatically redirected to login
- Login again to get a new token

### 401 Unauthorized

- Token might be expired or invalid
- Clear localStorage and login again
- Check backend JWT_SECRET is set correctly

## Next Steps

1. ✅ Login system is ready
2. ✅ Create your first company
3. ✅ Add customers
4. ✅ Create invoices
5. ✅ Issue invoices (ZATCA compliant)

---

**Status**: ✅ Authentication system fully implemented and ready to use!

# Authentication & Authorization Report

## ✅ Issues Fixed

### 1. JWT_SECRET Consistency
**Problem:** `authMiddleware.js` was using `process.env.JWT_SECRET` directly, while `utils/jwt.js` uses `config.jwt.secret` from `env.js`.

**Fix:** Updated `authMiddleware.js` to use `config.jwt.secret` for consistency.

### 2. Error Logging
**Problem:** Authentication errors were not being logged, making debugging difficult.

**Fix:** 
- Added error logging in `authMiddleware.js` using `logError()` function
- Added specific error messages for token expiration and invalid tokens
- Added error logging in `roleMiddleware.js` for authorization failures

### 3. Role Middleware Improvements
**Problem:** Role middleware didn't provide enough context when access was denied.

**Fix:**
- Added detailed error logging
- Returns user role and required roles in error response
- Better error messages for debugging

---

## 🔐 How JWT Authentication Works

### Token Generation (Login)
When a user logs in successfully via `/api/auth/login`:
1. User credentials are validated
2. OTP is sent and verified
3. JWT token is generated with payload:
   ```javascript
   {
     user_id: user.user_id,
     email: user.email,
     role: user.role  // ADMIN, PRINCIPAL, TEACHER, PARENT, STUDENT
   }
   ```
4. Token is signed using `config.jwt.secret` (from `.env` file)
5. Token expires in 8 hours (configurable via `JWT_EXPIRES_IN`)

### Token Verification (Middleware)
The `authenticate` middleware:
1. Extracts token from `Authorization` header: `Bearer <token>`
2. Verifies token using `config.jwt.secret`
3. Decodes token and attaches user info to `req.user`
4. Logs errors to log files if verification fails

### Role Authorization
The `authorizeRoles` middleware:
1. Checks if `req.user` exists (must use `authenticate` first)
2. Verifies user's role is in the allowed roles list
3. Logs authorization failures
4. Returns 403 if role doesn't match

---

## 📋 Available User Roles

- **ADMIN** - System administrator
- **PRINCIPAL** - School principal
- **TEACHER** - School teacher
- **PARENT** - Student's parent
- **STUDENT** - Student

---

## 🛣️ Route Protection Status

### ✅ Protected Routes (Currently None - All are commented out)

Most routes have authentication/authorization commented out. Here's what needs protection:

### 🔴 Routes That Should Be Protected

#### User Routes (`/api/users`)
- `POST /register` - Should require ADMIN or PRINCIPAL
- `GET /getusers` - Should require ADMIN or PRINCIPAL
- `GET /school/:school_id` - Should require authenticated user
- `GET /:id` - Should require authenticated user
- `PUT /:id` - Should require authenticated user (or ADMIN for other users)
- `PATCH /:id/deactivate` - Should require ADMIN or PRINCIPAL
- `PATCH /:id/activate` - Should require ADMIN or PRINCIPAL
- `PATCH /:id/verify-email` - Should require authenticated user
- `PATCH /:id/verify-phone` - Should require authenticated user
- `PATCH /:id/change-password` - Should require authenticated user

#### Student Routes (`/api/students`)
- `POST /register` - Should require ADMIN or PRINCIPAL (currently commented)
- `GET /school/:school_id` - Should require authenticated user

#### Parent Routes (`/api/parents`)
- `POST /register` - Should require ADMIN or PRINCIPAL (currently commented)
- `GET /school/:school_id` - Should require authenticated user

#### Branch Routes (`/api/branches`)
- `POST /` - Should require ADMIN or PRINCIPAL
- `GET /` - Should require authenticated user
- `GET /:branchId` - Should require authenticated user
- `GET /school/:schoolId` - Should require authenticated user
- `PUT /:branchId` - Should require ADMIN or PRINCIPAL
- `DELETE /:branchId` - Should require ADMIN or PRINCIPAL

#### School Routes (`/api/schools`)
- `POST /register` - Should require ADMIN
- `GET /` - Public (can be accessed by anyone)
- `GET /:schoolId` - Public (can be accessed by anyone)

#### PTM Routes (`/api/ptm`)
- `POST /sessions` - Should require ADMIN or PRINCIPAL
- `GET /sessions` - Should require authenticated user
- `POST /bookings` - Should require PARENT or TEACHER
- `GET /bookings` - Should require authenticated user
- `GET /bookings/teacher/:teacherId` - Should require TEACHER (own bookings) or ADMIN/PRINCIPAL
- `GET /bookings/parent/:parentId` - Should require PARENT (own bookings) or ADMIN/PRINCIPAL
- `GET /bookings/student/:studentId` - Should require authenticated user
- `GET /sessions/teacher/:teacherId` - Should require TEACHER (own sessions) or ADMIN/PRINCIPAL
- `GET /sessions/parent/:parentId` - Should require PARENT (own sessions) or ADMIN/PRINCIPAL
- `GET /sessions/student/:studentId` - Should require authenticated user

#### Report Card Routes (`/api/report-cards`)
- `POST /upload-csv` - Should require ADMIN or PRINCIPAL
- `GET /uploaded-marks` - Should require authenticated user

#### Parent-Student Relationship Routes (`/api/relationships`)
- `POST /` - Should require ADMIN or PRINCIPAL (currently commented)
- `GET /` - Should require authenticated user (currently commented)
- `GET /student/:studentId` - Should require authenticated user (currently commented)
- `GET /parent/:parentId` - Should require authenticated user (currently commented)
- `PATCH /:relationshipId` - Should require ADMIN or PRINCIPAL (currently commented)
- `DELETE /:relationshipId` - Should require ADMIN or PRINCIPAL (currently commented)

### ✅ Public Routes (No Authentication Required)
- `POST /api/auth/login` - Login endpoint
- `GET /` - Health check
- `POST /api/sessions/validate` - Session validation
- `POST /api/sessions/logout` - Logout
- `GET /api/master/*` - Master data (classes, sections, etc.)

---

## 📝 How to Use Middleware

### Example 1: Protect a route with authentication only
```javascript
import { authenticate } from '../middleware/authMiddleware.js';

router.get('/profile', authenticate, getProfileController);
```

### Example 2: Protect a route with authentication + role authorization
```javascript
import { authenticate } from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/roleMiddleware.js';

router.post('/register', 
  authenticate, 
  authorizeRoles('ADMIN', 'PRINCIPAL'), 
  registerStudent
);
```

### Example 3: Multiple roles allowed
```javascript
router.get('/reports', 
  authenticate, 
  authorizeRoles('ADMIN', 'PRINCIPAL', 'TEACHER'), 
  getReportsController
);
```

---

## 🔍 JWT Verification Flow

1. **Client sends request** with header:
   ```
   Authorization: Bearer <jwt_token>
   ```

2. **authenticate middleware**:
   - Extracts token from header
   - Verifies token signature using `config.jwt.secret`
   - Checks token expiration
   - Decodes payload and sets `req.user = { user_id, email, role }`
   - Logs errors if verification fails

3. **authorizeRoles middleware** (if used):
   - Checks `req.user.role` exists
   - Verifies role is in allowed roles list
   - Logs authorization failures
   - Allows request to proceed if authorized

4. **Controller** receives `req.user` with authenticated user info

---

## ⚠️ Important Notes

1. **JWT_SECRET**: Must be set in `.env` file. The app will exit if not found.
2. **Token Format**: Must be `Bearer <token>` in Authorization header
3. **Token Expiration**: Default is 8 hours, configurable via `JWT_EXPIRES_IN`
4. **Error Logging**: All authentication/authorization errors are logged to log files
5. **Order Matters**: Always use `authenticate` before `authorizeRoles`

---

## 🧪 Testing JWT Verification

### Test with valid token:
```bash
curl -X GET http://localhost:3000/api/users \
  -H "Authorization: Bearer <your_jwt_token>"
```

### Test without token:
```bash
curl -X GET http://localhost:3000/api/users
# Should return: { "message": "No token provided" }
```

### Test with invalid token:
```bash
curl -X GET http://localhost:3000/api/users \
  -H "Authorization: Bearer invalid_token"
# Should return: { "message": "Invalid token" }
```

### Test with expired token:
```bash
curl -X GET http://localhost:3000/api/users \
  -H "Authorization: Bearer <expired_token>"
# Should return: { "message": "Token expired" }
```

---

## ✅ Verification Checklist

- [x] JWT_SECRET is consistent across all files
- [x] Error logging is implemented
- [x] Token verification works correctly
- [x] Role authorization works correctly
- [x] Error messages are clear and helpful
- [ ] Routes are properly protected (needs implementation)
- [ ] JWT_SECRET is set in .env file
- [ ] Token expiration is configured correctly

---

## 📌 Next Steps

1. **Uncomment and apply authentication/authorization** to routes that need protection
2. **Test each protected route** with different user roles
3. **Review error logs** to ensure proper logging
4. **Set up proper JWT_SECRET** in production environment
5. **Consider adding rate limiting** for authentication endpoints


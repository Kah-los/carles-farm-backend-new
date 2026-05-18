# 🐄 Carles Meatland & Farms - Backend API

Complete REST API backend for the Carles Meatland & Farms Management System.

---

## 📦 **WHAT'S INCLUDED**

✅ **Node.js + Express** REST API  
✅ **PostgreSQL** database with complete schema  
✅ **JWT Authentication** with 4-digit PIN  
✅ **Admin Portal** - User management & role-based access  
✅ **Complete CRUD** for Animals, Feed, Medications, Breeding, Finance  
✅ **Reports & Analytics** - Comprehensive data analysis  
✅ **Production Ready** - Secure, scalable, deployable  

---

## 🚀 **QUICK START (Local Development)**

### **1. Prerequisites**
- Node.js 18+ installed
- PostgreSQL installed and running

### **2. Install Dependencies**
```bash
npm install
```

### **3. Configure Environment**
Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Edit `.env`:
```env
DATABASE_URL=postgresql://username:password@localhost:5432/carles_farm
JWT_SECRET=your-super-secret-jwt-key-change-this
FRONTEND_URL=http://localhost:3000
ADMIN_USERNAME=admin
ADMIN_PIN=1234
```

### **4. Setup Database**
This creates all tables and the initial admin user:

```bash
npm run setup
```

You'll see:
```
✨ Database setup completed successfully!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔐 ADMIN CREDENTIALS:
   Username: admin
   PIN: 1234
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### **5. Start Server**
```bash
npm start
```

Server runs on `http://localhost:3000`

---

## 🌐 **DEPLOY TO PRODUCTION**

### **Option 1: Railway.app (RECOMMENDED - $5/month)**

#### **Why Railway?**
- ✅ Automatic PostgreSQL database included
- ✅ One-click deployment
- ✅ Always-on (no cold starts)
- ✅ Automatic HTTPS
- ✅ $5 credit/month free tier

#### **Steps:**

1. **Create Railway Account**: https://railway.app
2. **Click "New Project"**
3. **Select "Deploy from GitHub repo"**
4. **Connect your repo** (or upload files)
5. **Railway auto-detects** Node.js and installs dependencies
6. **Add PostgreSQL**:
   - Click "+ New"
   - Select "Database"
   - Choose "PostgreSQL"
   - Railway automatically sets `DATABASE_URL` for you!

7. **Add Environment Variables**:
   Click on your service → Variables → Add:
   ```
   JWT_SECRET=<generate-random-string>
   FRONTEND_URL=<your-netlify-url>
   ADMIN_USERNAME=admin
   ADMIN_PIN=1234
   NODE_ENV=production
   ```

8. **Setup Database** (one-time):
   - Go to "Settings" → "Custom Start Command"
   - Temporarily set to: `npm run setup`
   - Click "Deploy"
   - After deployment completes, change back to: `npm start`
   - Click "Deploy" again

9. **Done!** Your API is live at: `https://your-app.railway.app`

---

### **Option 2: Render.com (FREE TIER)**

#### **Why Render?**
- ✅ Completely FREE tier available
- ✅ PostgreSQL database included (free)
- ✅ Automatic HTTPS
- ⚠️ Spins down after 15 min inactivity (takes ~30 sec to wake)

#### **Steps:**

1. **Create Render Account**: https://render.com
2. **Click "New +" → "Web Service"**
3. **Connect GitHub** or upload files
4. **Configure**:
   - **Name**: carles-farm-api
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free

5. **Add PostgreSQL**:
   - Click "New +" → "PostgreSQL"
   - Name it `carles-db`
   - Plan: Free
   - Copy the "Internal Database URL"

6. **Add Environment Variables** (in your web service):
   ```
   DATABASE_URL=<paste-internal-database-url>
   JWT_SECRET=<generate-random-string>
   FRONTEND_URL=<your-netlify-url>
   NODE_ENV=production
   ADMIN_USERNAME=admin
   ADMIN_PIN=1234
   ```

7. **Setup Database** (one-time):
   - Go to "Shell" tab
   - Run: `npm run setup`

8. **Done!** API live at: `https://carles-farm-api.onrender.com`

---

## 🔐 **GENERATE JWT SECRET**

Never use a weak JWT secret in production! Generate a secure one:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Copy the output and use it as your `JWT_SECRET`.

---

## 📡 **API ENDPOINTS**

### **Authentication**
```
POST   /api/auth/login           - Login with username + PIN
GET    /api/auth/me              - Get current user info
POST   /api/auth/change-pin      - Change your PIN
```

### **Users (Admin Only)**
```
GET    /api/users                - List all users
POST   /api/users                - Create new user
PUT    /api/users/:id            - Update user
DELETE /api/users/:id            - Delete user
POST   /api/users/:id/reset-pin  - Reset user's PIN
POST   /api/users/:id/unlock     - Unlock locked account
```

### **Animals**
```
GET    /api/animals              - List animals (filter by species/status/pen)
GET    /api/animals/:id          - Get animal details + history
POST   /api/animals              - Create animal
PUT    /api/animals/:id          - Update animal
DELETE /api/animals/:id          - Delete animal
POST   /api/animals/:id/weight   - Record weight
GET    /api/animals/stats/summary - Dashboard stats
```

### **Feed Management**
```
GET    /api/feed/ingredients     - List all ingredients
POST   /api/feed/ingredients     - Add ingredient
PUT    /api/feed/ingredients/:id - Update ingredient
DELETE /api/feed/ingredients/:id - Delete ingredient

GET    /api/feed/formulas        - List all formulas
POST   /api/feed/formulas        - Create formula
DELETE /api/feed/formulas/:id    - Delete formula

GET    /api/feed/logs            - Get feeding logs
POST   /api/feed/logs            - Log feeding
```

### **Medications**
```
GET    /api/medications          - List all medications
POST   /api/medications          - Add medication
PUT    /api/medications/:id      - Update medication
DELETE /api/medications/:id      - Delete medication

GET    /api/medications/logs     - Get medication logs
POST   /api/medications/logs     - Log medication administration
```

### **Breeding**
```
GET    /api/breeding             - List breeding records
POST   /api/breeding             - Create breeding record
PUT    /api/breeding/:id         - Update breeding record
```

### **Finance**
```
GET    /api/finance              - List transactions
POST   /api/finance              - Create transaction
DELETE /api/finance/:id          - Delete transaction
GET    /api/finance/summary      - Financial summary
```

### **Reports & Analytics**
```
GET    /api/reports/dashboard    - Complete dashboard data
GET    /api/reports/growth       - Growth analytics
GET    /api/reports/feeding      - Feed consumption analysis
GET    /api/reports/health       - Health & medication analytics
GET    /api/reports/financial    - Detailed financial analysis
GET    /api/reports/inventory    - Stock levels
```

---

## 🔌 **CONNECT FRONTEND TO BACKEND**

### **Update Your Frontend**

In your frontend code, replace all `localStorage` calls with API calls:

**Before (localStorage):**
```javascript
const users = JSON.parse(localStorage.getItem('users'));
```

**After (API):**
```javascript
const API_URL = 'https://your-backend.railway.app/api';

// Login
const response = await fetch(`${API_URL}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username, pin })
});
const { token, user } = await response.json();
localStorage.setItem('token', token);

// Get animals (authenticated)
const token = localStorage.getItem('token');
const response = await fetch(`${API_URL}/animals`, {
  headers: { 'Authorization': `Bearer ${token}` }
});
const animals = await response.json();
```

---

## 🗄️ **DATABASE SCHEMA**

Complete schema with 11 tables:

- `users` - User accounts with roles
- `animals` - Animal records
- `feed_ingredients` - Feed inventory
- `feed_formulas` - Feed recipes
- `formula_items` - Ingredients in formulas
- `feeding_logs` - Feeding history
- `medications` - Medication inventory
- `medication_dosages` - Species-specific dosages
- `medication_logs` - Treatment history
- `breeding_records` - Breeding tracking
- `weight_records` - Weight history
- `financial_transactions` - Income & expenses

---

## 👥 **USER ROLES**

| Role | Permissions |
|------|-------------|
| **Admin** | Full access - manage users, all operations |
| **Manager** | View & edit all data (no user management) |
| **Worker** | Add/edit animals, log feeding/medications |
| **Veterinarian** | View animals, log medications |

---

## 🔒 **SECURITY FEATURES**

✅ **JWT Authentication** - Secure token-based auth  
✅ **PIN Hashing** - bcrypt with 10 rounds  
✅ **Account Locking** - 3 failed attempts  
✅ **Role-Based Access** - Protected admin routes  
✅ **Input Validation** - express-validator  
✅ **SQL Injection Protection** - Parameterized queries  
✅ **CORS Protection** - Configured origins  
✅ **Helmet Security** - HTTP headers protection  

---

## 📊 **TESTING THE API**

### **Using cURL:**

```bash
# Login
curl -X POST https://your-api.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","pin":"1234"}'

# Get animals (replace TOKEN)
curl https://your-api.railway.app/api/animals \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### **Using Postman/Insomnia:**

1. Import the API endpoints
2. Login to get token
3. Add token to Authorization header: `Bearer YOUR_TOKEN`
4. Test all endpoints

---

## 🆘 **TROUBLESHOOTING**

### **"Database connection failed"**
- Check `DATABASE_URL` is correct
- Ensure PostgreSQL is running
- Verify firewall allows connection

### **"JWT Secret is required"**
- Set `JWT_SECRET` environment variable
- Use a long random string (64+ characters)

### **"Account locked"**
- Admin can unlock: `POST /api/users/:id/unlock`
- Or reset database: `npm run setup`

### **"CORS error"**
- Set `FRONTEND_URL` to your Netlify URL
- Include `https://` in the URL

---

## 📈 **WHAT'S NEXT?**

**Your complete system is:**

```
Frontend (Netlify) ←→ Backend (Railway/Render) ←→ PostgreSQL
   HTML/React              Node.js/Express           Database
```

**To go live:**
1. ✅ Deploy backend (Railway/Render)
2. ✅ Update frontend to use API
3. ✅ Deploy frontend (Netlify)
4. ✅ Test login & features
5. ✅ Change admin PIN!

---

## 💡 **SUPPORT**

- Check logs in Railway/Render dashboard
- Test endpoints with Postman
- Verify environment variables are set
- Ensure database setup ran successfully

---

**Built for Carles Meatland & Farms** 🐄  
**Raised Right. Grown Together. Delivered Better.**

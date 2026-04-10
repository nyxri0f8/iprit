# 👥 RIT IPR User Accounts

**Created**: April 7, 2026  
**Status**: ✅ All accounts active in Supabase database

---

## 🎓 Faculty Accounts

### Account 1: Varun
```
Name: Varun
Email: varun.iprit@ritchennai.com
Password: Varun@RIT2026
Department: ECE
Role: Faculty
Institution: Rajalakshmi Institute of Technology
Status: ✅ Active
```

### Account 2: DR.B.Manimaran
```
Name: DR.B.Manimaran
Email: drmanimaran.iprit@ritchennai.com
Password: DrMani@RIT2026
Department: ECE
Role: Faculty
Institution: Rajalakshmi Institute of Technology
Status: ✅ Active
```

### Account 3: Test User
```
Name: Test User
Email: testuser.iprit@ritchennai.com
Password: TestUser@RIT2026
Department: ECE
Role: Faculty
Institution: Rajalakshmi Institute of Technology
Status: ✅ Active
```

---

## 👨‍💼 Admin Account (Existing)

### Admin
```
Name: Admin
Email: admin-iprrit@ritchennai.com
Password: adminiprit1
Role: Admin
Institution: Rajalakshmi Institute of Technology
Status: ✅ Active
```

---

## 🔐 Password Policy

All passwords follow this format:
- Minimum 8 characters
- Contains uppercase and lowercase letters
- Contains numbers
- Contains special characters (@)
- Secure and unique per user

---

## 🚀 How to Login

### Local Server:
1. Start server: `cd RIT-IPR-main/server && npm start`
2. Open: http://localhost:5000
3. Click "Login"
4. Enter email and password from above
5. Access your dashboard!

### Network Access:
1. Find your IP: `ipconfig` (Windows) or `ifconfig` (Mac/Linux)
2. Share: `http://YOUR_IP:5000`
3. Others can login from same network

---

## 📊 Account Details

| Name | Email | Department | Role | Password |
|------|-------|------------|------|----------|
| Varun | varun.iprit@ritchennai.com | ECE | Faculty | Varun@RIT2026 |
| DR.B.Manimaran | drmanimaran.iprit@ritchennai.com | ECE | Faculty | DrMani@RIT2026 |
| Test User | testuser.iprit@ritchennai.com | ECE | Faculty | TestUser@RIT2026 |
| Admin | admin-iprrit@ritchennai.com | - | Admin | adminiprit1 |

---

## ✨ What Each User Can Do

### Faculty Users (Varun, Dr. Manimaran, Test User):
- ✅ Register and login
- ✅ Analyze patent ideas with AI
- ✅ Get innovation, novelty, and readiness scores
- ✅ Generate patent claims and abstracts
- ✅ Save patents to history
- ✅ Submit patents for admin review
- ✅ Track submission status
- ✅ Receive notifications
- ✅ Chat with AI assistant
- ✅ Upload documents (PDF, DOCX, images)
- ✅ View personal dashboard
- ✅ View patent history

### Admin User:
- ✅ All faculty features PLUS:
- ✅ View all submissions from all faculty
- ✅ Approve or reject patent applications
- ✅ Add review comments
- ✅ Send notifications to faculty
- ✅ View system-wide analytics
- ✅ Track admin actions
- ✅ Manage users
- ✅ View department-wise statistics

---

## 🧪 Testing Workflow

### Test as Faculty (Varun):
1. Login with Varun's credentials
2. Click "New Patent"
3. Fill in invention details
4. Click "Analyze with AI"
5. Review AI analysis
6. Save patent
7. Submit for review

### Test as Admin:
1. Login with admin credentials
2. Go to "Admin Panel"
3. See Varun's submission
4. Review the patent
5. Approve or reject with comments
6. Varun receives notification

### Test Notifications:
1. Login as Varun
2. Submit a patent
3. Logout
4. Login as Admin
5. Approve the patent
6. Logout
7. Login as Varun
8. See notification!

---

## 🔄 Password Reset (If Needed)

If you need to reset a password, you can:

1. **Via Supabase Dashboard**:
   - Go to https://supabase.com/dashboard
   - Select RIT-IPR-Supabase project
   - Go to Table Editor → profiles
   - Find the user
   - Update password field with new bcrypt hash

2. **Via SQL** (using Supabase power):
   ```sql
   UPDATE profiles 
   SET password = '$2a$10$NEW_BCRYPT_HASH' 
   WHERE email = 'user@email.com';
   ```

3. **Via Registration** (if email not used):
   - User can register with new email
   - Admin can delete old account

---

## 📱 Share These Credentials

You can share these credentials with:
- Varun (ECE faculty)
- Dr. B. Manimaran (ECE faculty)
- Test users for demonstration

**Security Note**: These are test accounts. For production use, users should:
1. Register their own accounts
2. Choose their own passwords
3. Change passwords after first login

---

## ✅ Verification

All accounts have been created in Supabase database:
- ✅ Varun: ID `fc4fffb2-677a-4a5f-8433-724d07d5b3ed`
- ✅ DR.B.Manimaran: ID `30998b67-8e20-478d-a821-d1d2f32afda0`
- ✅ Test User: ID `e6abc5a5-02c1-4e6c-9378-5f551c3c5721`

All accounts are ready to use immediately!

---

## 🎯 Quick Start

1. **Start Server**:
   ```bash
   cd RIT-IPR-main/server
   npm start
   ```

2. **Access**:
   ```
   http://localhost:5000
   ```

3. **Login**:
   - Use any email/password from above
   - Test the system!

---

**Created**: April 7, 2026  
**Database**: Supabase (ACTIVE_HEALTHY)  
**Status**: ✅ ALL ACCOUNTS READY  
**Total Users**: 4 (3 Faculty + 1 Admin)

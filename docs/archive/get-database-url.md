# Getting DATABASE_URL from pgAdmin 4

## Steps to Get Your Database Connection String

### From pgAdmin 4 Desktop App:

1. **Right-click on "Planetary-agents" server** (the one with the elephant icon)
2. Select **"Properties"**
3. Look at the **"Connection"** tab
4. You'll see fields like:
   - **Host name/address**: (e.g., `localhost`, `127.0.0.1`, or a remote host)
   - **Port**: (usually `5432`)
   - **Maintenance database**: (the database name)
   - **Username**: (database username)
   - **Password**: (password used to connect)

### Construct the DATABASE_URL

The format is:

```
postgresql://USERNAME:PASSWORD@HOST:PORT/DATABASE
```

**Example:**
If your connection details are:

- Host: `localhost`
- Port: `5432`
- Database: `planetary_agents`
- Username: `postgres`
- Password: `your_password`

Your DATABASE_URL would be:

```
postgresql://postgres:your_password@localhost:5432/planetary_agents
```

### Special Considerations

**If using localhost** (development only):

- Vercel **cannot** connect to `localhost` databases
- You'll need a **publicly accessible** database URL for production

**If using a managed service** (Production ready):

- Render, Railway, Neon, Supabase, etc. provide connection strings
- These are already publicly accessible
- Use those connection strings directly

### For Production on Vercel

You need a **publicly accessible** database, not localhost. Options:

1. **Use Render PostgreSQL** (recommended)
   - Go to your Render dashboard
   - Select your PostgreSQL database
   - Copy the "Internal Database URL"
2. **Use Prisma Accelerate** (best for serverless)
   - Go to https://console.prisma.io
   - Enable Accelerate on your database
   - Use the Accelerate connection string

3. **Use Neon/Supabase**
   - Get the connection string from their dashboard
   - These are production-ready and publicly accessible

### Security Note

⚠️ **IMPORTANT:** The password in the connection string will be visible in pgAdmin.

- For production, regenerate strong passwords
- Consider using connection pooling (Prisma Accelerate)
- Never commit these credentials to git

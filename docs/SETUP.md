# Setup Instructions

## Initial User Setup

This application comes with one pre-configured admin user account. You need to set its password using an environment variable.

### Step 1: Create .env file

Copy the example environment file:

```bash
cp .env.example .env
```

### Step 2: Set password

Edit the `.env` file and set a secure password for the admin user:

```bash
RAMU_PASSWORD=your_secure_password_here
```

**Important:**
- The `.env` file is already in `.gitignore` and will NOT be committed to git
- Use a strong, unique password
- Keep the `.env` file secure and do not share it

### Step 3: Reset user (if needed)

If you need to reset the user and password, run:

```bash
docker exec matsu-backend-1 python -c "
from app.models.database import get_db_session, User
db = get_db_session()
db.query(User).delete()
db.commit()
print('Deleted all users')
db.close()
"

docker-compose restart
```

The user will be recreated with the password from your `.env` file.

## User Account

The application creates one admin user account on first startup:
- **ramu** - Password from `RAMU_PASSWORD` environment variable

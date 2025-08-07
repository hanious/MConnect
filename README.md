# COS20031-May-Group-1

## Summary

MConnect is a working social media platform made for professionals.

### Installed Packages

- **express** (^5.1.0) – Serves the API and static files
- **sqlite3** (^5.1.7) – Stores user data and posts
- **bcrypt** (^6.0.0) – Secures user passwords
- **cors** (^2.8.5) – Enables frontend-backend communication
- **axios** (^1.10.0) – Handles API calls from the frontend
- **dotenv** (^17.1.0) – Loads environment variables from .env
- **express-session** (^1.18.1) – Session management for Express
- **passport** (^0.7.0) – Authentication middleware
- **passport-google-oauth20** (^2.0.0) – Google OAuth 2.0 strategy for Passport

## Main features

- Single sign-on
- User one-factor authentication (Username and Passkey)
- Basic posting functions
- User account customization

## Set Up Project

### If using Docker Desktop
`docker compose up`

--------
### Install packages manually

`npm install`

### Initialize database tables and create test data

`npm run init`

### Environment Variables (.env Setup)

Create a `.env` file in the backend folder. This file will store sensitive configuration values for your backend server.

You will need to set the following variables:

```
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
SESSION_SECRET=your-session-secret
```

**Where to get these values:**
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`: Create OAuth 2.0 credentials in the [Google Cloud Console](https://console.cloud.google.com/apis/credentials). Use the Authorized JavaScript origins and redirect URIs listed below when setting up your credentials.
- `SESSION_SECRET`: Set this to any random string for securing user sessions (e.g., use a password generator).

### Google OAuth SSO Setup

To enable Google Single Sign-On (SSO), configure your Google Cloud OAuth credentials as follows:

**Authorized JavaScript origins:**
- http://localhost:3000
- http://127.0.0.1:5500

**Authorized redirect URIs:**
- http://localhost:3000/api/auth/google/callback
- http://127.0.0.1:3000/api/auth/google/callback

Add these in the Google Cloud Console under your OAuth 2.0 Client ID settings.

### Connect to NodeJS server

`npm run server`

# API Documentation

## Base URL

```shell
http://localhost:3000/api
```

## Authentication

All authenticated endpoints require the `Authorization` header:

```shell
Authorization: Bearer <session_token>
```

---

## Authentication Endpoints

### Register User

**POST** `/api/auth/sign-up`

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "name": "John Doe"
}
```

**Response (201):**

```json
{
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "session": {
    "token": "session_token",
    "expiresAt": "2024-12-31T23:59:59.999Z"
  }
}
```

---

### Login

**POST** `/api/auth/sign-in`

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response (200):**

```json
{
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "session": {
    "token": "session_token",
    "expiresAt": "2024-12-31T23:59:59.999Z"
  }
}
```

---

### Logout

**POST** `/api/auth/sign-out`

**Headers:**

```shell
Authorization: Bearer <session_token>
```

**Response (200):**

```json
{
  "success": true
}
```

---

## Template Management

### Create Template

**POST** `/api/templates`

**Headers:**

```shell
Authorization: Bearer <session_token>
Content-Type: multipart/form-data
```

**Form Data:**

```shell
templateImage: File (PNG, JPG, JPEG, WEBP)
name: string
type: "image" | "html"
fields: JSON string (array of field mappings)
fontIds: JSON string (array of font IDs)
metadata: JSON string (additional metadata)
```

**Example Fields:**

```json
[
  {
    "csvColumn": "name",
    "x": 300,
    "y": 400,
    "fontSize": 48,
    "font": "Helvetica-Bold",
    "color": "#000000",
    "width": 500,
    "align": "center"
  }
]
```

**Response (201):**

```json
{
  "success": true,
  "message": "Template created successfully",
  "data": {
    "id": "template_id",
    "name": "Certificate Template",
    "type": "image",
    "createdBy": "user_id",
    "fields": [...],
    "fontIds": [...],
    "metadata": {
      "telegramFileId": "file_id",
      "originalFileName": "template.png"
    },
    "isActive": true,
    "createdAt": "2024-11-15T10:00:00.000Z"
  }
}
```

---

### Get All Templates

**GET** `/api/templates`

**Headers:**

```shell
Authorization: Bearer <session_token>
```

**Response (200):**

```json
{
  "success": true,
  "count": 5,
  "data": [
    {
      "id": "template_id",
      "name": "Certificate Template",
      "type": "image",
      "createdBy": "user_id",
      "fields": [...],
      "fontIds": [...],
      "metadata": {...},
      "isActive": true,
      "createdAt": "2024-11-15T10:00:00.000Z"
    }
  ]
}
```

---

### Get Template Details

**GET** `/api/templates/:id`

**Headers:**

```shell
Authorization: Bearer <session_token>
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "template": {
      "id": "template_id",
      "name": "Certificate Template",
      "type": "image",
      "fields": [...],
      "fontIds": [...],
      "metadata": {...}
    },
    "fonts": [
      {
        "id": "font_id",
        "name": "Custom Font",
        "fileName": "font.ttf"
      }
    ],
    "previewUrl": "https://api.telegram.org/file/bot.../photo.png"
  }
}
```

---

### Update Template

**PUT** `/api/templates/:id`

**Headers:**

```shell
Authorization: Bearer <session_token>
Content-Type: multipart/form-data
```

**Form Data:**

```shell
templateImage: File (optional, to update image)
name: string (optional)
fields: JSON string (optional)
fontIds: JSON string (optional)
metadata: JSON string (optional)
```

**Response (200):**

```json
{
  "success": true,
  "message": "Template updated successfully",
  "data": {
    "id": "template_id",
    "name": "Updated Template",
    ...
  }
}
```

---

### Delete Template

**DELETE** `/api/templates/:id?deleteFonts=true`

**Headers:**

```shell
Authorization: Bearer <session_token>
```

**Query Parameters:**

- `deleteFonts` (optional): "true" to delete unused fonts attached to this template

**Response (200):**

```json
{
  "success": true,
  "message": "Template deleted successfully"
}
```

---

### Preview Data Fields

**POST** `/api/templates/:id/preview-fields`

**Headers:**

```shell
Authorization: Bearer <session_token>
Content-Type: multipart/form-data
```

**Form Data:**

```shell
dataFile: File (CSV or Excel)
```

**Response (200):**

```json
{
  "success": true,
  "fields": ["name", "email", "date", "course"],
  "currentMapping": [...]
}
```

---

## Font Management

### Upload Font

**POST** `/api/fonts`

**Headers:**

```shell
Authorization: Bearer <session_token>
Content-Type: multipart/form-data
```

**Form Data:**

```shell
fontFile: File (TTF, OTF, WOFF, WOFF2)
name: string (optional)
```

**Response (201):**

```json
{
  "success": true,
  "message": "Font uploaded successfully",
  "data": {
    "id": "font_id",
    "name": "My Custom Font",
    "fileName": "uuid.ttf",
    "filePath": "fonts/user_id/uuid.ttf",
    "uploadedBy": "user_id",
    "isActive": true,
    "metadata": {
      "originalName": "CustomFont.ttf",
      "size": 524288
    },
    "createdAt": "2024-11-15T10:00:00.000Z"
  }
}
```

---

### Get All Fonts

**GET** `/api/fonts`

**Headers:**

```shell
Authorization: Bearer <session_token>
```

**Response (200):**

```json
{
  "success": true,
  "count": 3,
  "data": [
    {
      "id": "font_id",
      "name": "My Custom Font",
      "fileName": "uuid.ttf",
      "filePath": "fonts/user_id/uuid.ttf",
      "uploadedBy": "user_id",
      "isActive": true,
      "createdAt": "2024-11-15T10:00:00.000Z"
    }
  ]
}
```

---

### Get Font Details

**GET** `/api/fonts/:id`

**Headers:**

```shell
Authorization: Bearer <session_token>
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "id": "font_id",
    "name": "My Custom Font",
    "fileName": "uuid.ttf",
    "filePath": "fonts/user_id/uuid.ttf",
    "metadata": {...}
  }
}
```

---

### Delete Font

**DELETE** `/api/fonts/:id`

**Headers:**

```shell
Authorization: Bearer <session_token>
```

**Note:** Cannot delete fonts that are attached to active templates

**Response (200):**

```json
{
  "success": true,
  "message": "Font deleted successfully"
}
```

**Error (400):**

```json
{
  "error": "Cannot delete font that is attached to templates",
  "templatesCount": 2
}
```

---

### Download Font

**GET** `/api/fonts/:id/download`

**Headers:**

```shell
Authorization: Bearer <session_token>
```

**Response:** File download (binary)

---

## Certificate Generation

### Generate Certificates (Async)

**POST** `/api/certificates/generate`

**Headers:**

```shell
Authorization: Bearer <session_token>
Content-Type: multipart/form-data
```

**Form Data:**

```shell
templateId: string
dataFile: File (CSV or Excel)
```

**Response (200):**

```json
{
  "success": true,
  "message": "Certificate generation started",
  "data": {
    "generationId": "generation_id",
    "status": "pending",
    "totalCertificates": 50
  }
}
```

**Error (400):**

```json
{
  "error": "Insufficient certificates. You have 10 remaining, but requested 50"
}
```

---

### Get Generation Status

**GET** `/api/certificates/status/:generationId`

**Headers:**

```shell
Authorization: Bearer <session_token>
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "id": "generation_id",
    "userId": "user_id",
    "templateId": "template_id",
    "status": "processing",
    "totalCertificates": 50,
    "processedCertificates": 25,
    "progress": 50,
    "createdAt": "2024-11-15T10:00:00.000Z"
  }
}
```

**Status Values:**

- `pending`: Queued, waiting to start
- `processing`: Currently generating
- `completed`: Finished successfully
- `failed`: Error occurred

---

### Download Certificates

**GET** `/api/certificates/download/:generationId`

**Headers:**

```shell
Authorization: Bearer <session_token>
```

**Response:** ZIP file download (binary)

**Error (400):**

```json
{
  "error": "Generation not completed yet",
  "status": "processing"
}
```

---

### Get Generation History

**GET** `/api/certificates/history?page=1&limit=20`

**Headers:**

```shell
Authorization: Bearer <session_token>
```

**Query Parameters:**

- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "generation_id",
      "templateId": {
        "id": "template_id",
        "name": "Certificate Template",
        "type": "image"
      },
      "status": "completed",
      "totalCertificates": 50,
      "processedCertificates": 50,
      "zipPath": "output/certificates-123456.zip",
      "createdAt": "2024-11-15T10:00:00.000Z",
      "completedAt": "2024-11-15T10:05:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "pages": 3
  }
}
```

---

## Preview Data Fields

**POST** `/api/certificates/preview-fields`

**Headers:**

```shell
Authorization: Bearer <session_token>
Content-Type: multipart/form-data
```

**Form Data:**

```shell
dataFile: File (CSV or Excel)
```

**Response (200):**

```json
{
  "success": true,
  "fields": ["name", "email", "date", "course", "grade"]
}
```

---

### Get Usage Statistics

**GET** `/api/certificates/usage`

**Headers:**

```shell
Authorization: Bearer <session_token>
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "packageType": "standard",
    "certificatesRemaining": 75,
    "certificatesGenerated": 25,
    "packageLimit": 100,
    "hasWatermark": false
  }
}
```

---

## Admin Endpoints

**Note:** All admin endpoints require admin privileges

### Get System Statistics

**GET** `/api/admin/stats`

**Headers:**

```shell
Authorization: Bearer <admin_session_token>
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "totalUsers": 150,
    "totalGenerations": 1250,
    "totalTemplates": 75,
    "activeGenerations": 5,
    "packageStats": [
      {
        "_id": "free",
        "count": 100,
        "totalGenerated": 500
      },
      {
        "_id": "standard",
        "count": 40,
        "totalGenerated": 2500
      },
      {
        "_id": "premium",
        "count": 10,
        "totalGenerated": 5000
      }
    ]
  }
}
```

---

### Get All Users

**GET** `/api/admin/users?page=1&limit=20&search=john`

**Headers:**

```
Authorization: Bearer <admin_session_token>
```

**Query Parameters:**

- `page` (optional): Page number
- `limit` (optional): Items per page
- `search` (optional): Search by email or name

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "user_id",
      "email": "user@example.com",
      "name": "John Doe",
      "packageType": "standard",
      "certificatesRemaining": 75,
      "certificatesGenerated": 25,
      "isActive": true,
      "isAdmin": false,
      "createdAt": "2024-11-15T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8
  }
}
```

---

### Get User Details

**GET** `/api/admin/users/:id`

**Headers:**

```
Authorization: Bearer <admin_session_token>
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_id",
      "email": "user@example.com",
      "name": "John Doe",
      "packageType": "standard",
      "certificatesRemaining": 75,
      "certificatesGenerated": 25,
      "isActive": true
    },
    "stats": {
      "totalGenerations": 15,
      "recentGenerations": [...]
    }
  }
}
```

---

### Update User Package

**PUT** `/api/admin/users/:id/package`

**Headers:**

```
Authorization: Bearer <admin_session_token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "packageType": "premium",
  "certificatesRemaining": 1000
}
```

**Response (200):**

```json
{
  "success": true,
  "message": "Package updated successfully",
  "data": {
    "id": "user_id",
    "packageType": "premium",
    "certificatesRemaining": 1000,
    ...
  }
}
```

---

### Toggle User Status

**PUT** `/api/admin/users/:id/status`

**Headers:**

```
Authorization: Bearer <admin_session_token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "isActive": false
}
```

**Response (200):**

```json
{
  "success": true,
  "message": "User deactivated successfully",
  "data": {
    "id": "user_id",
    "isActive": false,
    ...
  }
}
```

---

### Get All Generations

**GET** `/api/admin/generations?page=1&limit=20&status=completed`

**Headers:**

```
Authorization: Bearer <admin_session_token>
```

**Query Parameters:**

- `page` (optional): Page number
- `limit` (optional): Items per page
- `status` (optional): Filter by status

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "generation_id",
      "userId": {
        "id": "user_id",
        "email": "user@example.com",
        "name": "John Doe"
      },
      "templateId": {
        "id": "template_id",
        "name": "Certificate Template",
        "type": "image"
      },
      "status": "completed",
      "totalCertificates": 50,
      "processedCertificates": 50,
      "createdAt": "2024-11-15T10:00:00.000Z",
      "completedAt": "2024-11-15T10:05:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1250,
    "pages": 63
  }
}
```

---

### Get Generation Details

**GET** `/api/admin/generations/:id`

**Headers:**

```
Authorization: Bearer <admin_session_token>
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "id": "generation_id",
    "userId": {
      "id": "user_id",
      "email": "user@example.com",
      "name": "John Doe",
      "packageType": "standard"
    },
    "templateId": {
      "id": "template_id",
      "name": "Certificate Template",
      "type": "image",
      "metadata": {...}
    },
    "status": "completed",
    "totalCertificates": 50,
    "processedCertificates": 50,
    "zipPath": "output/certificates-123456.zip",
    "metadata": {...},
    "createdAt": "2024-11-15T10:00:00.000Z",
    "completedAt": "2024-11-15T10:05:00.000Z"
  }
}
```

---

### Get All Templates (Admin)

**GET** `/api/admin/templates?page=1&limit=20`

**Headers:**

```
Authorization: Bearer <admin_session_token>
```

**Query Parameters:**

- `page` (optional): Page number
- `limit` (optional): Items per page

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "template_id",
      "name": "Certificate Template",
      "type": "image",
      "createdBy": {
        "id": "user_id",
        "email": "user@example.com",
        "name": "John Doe"
      },
      "fields": [...],
      "createdAt": "2024-11-15T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 75,
    "pages": 4
  }
}
```

---

## Package Types

- **free**: 10 certificates, includes watermark
- **standard**: 100 certificates, no watermark
- **premium**: 1000 certificates, no watermark
- **custom**: Custom limit (set by admin), no watermark

---

## Error Responses

All errors follow this format:

```json
{
  "error": "Error message description"
}
```

Common HTTP Status Codes:

- `400`: Bad Request (invalid input)
- `401`: Unauthorized (not authenticated)
- `403`: Forbidden (insufficient permissions)
- `404`: Not Found (resource doesn't exist)
- `500`: Internal Server Error

---

## Telegram Setup Guide

### Step 1: Create a Telegram Bot

1. Open Telegram and search for `@BotFather`
2. Send `/newbot` command
3. Follow the instructions to create your bot
4. Save the bot token (format: `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`)

### Step 2: Get Your Chat ID

1. Search for `@userinfobot` in Telegram
2. Start a conversation
3. The bot will reply with your chat ID (numeric value)
4. Save this chat ID

### Step 3: Configure Environment

Add to your `.env` file:

```env
TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
TELEGRAM_CHAT_ID=987654321
```

### Step 4: Test

1. Send a message to your bot
2. Upload a template through the API
3. The image will be stored in your Telegram chat

---

## Redis Setup

### Install Redis

**macOS:**

```bash
brew install redis
brew services start redis
```

**Ubuntu/Debian:**

```bash
sudo apt-get install redis-server
sudo systemctl start redis
```

**Docker:**

```bash
docker run -d -p 6379:6379 redis:alpine
```

### Configure

Add to your `.env`:

```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

---

## Worker System

The certificate generation uses Bull queue with Redis for async processing:

- Requests are queued immediately
- Worker processes jobs in the background
- API remains responsive
- Users can check status and download when complete

### Queue Features

- **Retries**: Failed jobs retry 3 times with exponential backoff
- **Progress**: Real-time progress tracking
- **Monitoring**: Admin can monitor all generations
- **Concurrency**: Multiple certificates can be generated simultaneously

---

## Rate Limiting

Consider implementing rate limiting in production:

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```

---

## Development

### Start Development Server

```bash
yarn install
yarn dev
```

### Build for Production

```bash
yarn build
yarn start
```

### Required Services

- MongoDB
- Redis
- Telegram Bot (configured)

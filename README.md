<div align="center">

<br/>

```
 ____                      __  ___  
/ ___| _ __ ___   __ _ _ __\ \/ _ \ 
\___ \| '_ ` _ \ / _` | '__|\  / | |
 ___) | | | | | | (_| | |   /  \ |_|
|____/|_| |_| |_|\__,_|_|  /_/\_\__/
```

### **Smart Queue Management System**

*Skip the line. Not the experience.*

<br/>

[![License: MIT](https://img.shields.io/badge/License-MIT-22c55e.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-Welcome-6366f1.svg?style=for-the-badge)](CONTRIBUTING.md)
[![Made with Love](https://img.shields.io/badge/Made%20With-❤️-ef4444.svg?style=for-the-badge)](#)
[![Open Source](https://img.shields.io/badge/Open-Source-f59e0b.svg?style=for-the-badge)](#)

<br/>

**SmartQ** is a real-time, full-stack queue management platform that lets customers join queues remotely and track their position live — while giving businesses complete control over their service flow.

> No more crowded waiting rooms. No more guessing when it's your turn.

<br/>

[🚀 Live Demo](#) · [📖 Docs](#documentation) · [🐛 Report Bug](issues) · [✨ Request Feature](issues) · [🤝 Contribute](#contributing)

---

</div>

<br/>

## 📋 Table of Contents

- [✨ Overview](#-overview)
- [🎯 Key Features](#-key-features)
- [🏗️ Architecture](#️-architecture)
- [🛠️ Tech Stack](#️-tech-stack)
- [📦 Installation](#-installation)
- [⚙️ Configuration](#️-configuration)
- [🗄️ Database Schema](#️-database-schema)
- [📡 API Reference](#-api-reference)
- [👥 User Roles](#-user-roles)
- [📱 Screenshots](#-screenshots)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)

---

<br/>

## ✨ Overview

SmartQ reimagines the waiting experience for both customers and businesses. Whether it's a barbershop, hospital, restaurant, or service center — SmartQ digitizes the queue, delivers real-time updates, and eliminates physical waiting.

```
Customer opens app  →  Finds nearby business  →  Joins queue remotely
       ↓
Receives digital token  →  Gets notified when turn is near  →  Arrives just in time ✅
```

Built with a **mobile-first** philosophy, SmartQ works seamlessly across web and mobile, making it accessible to everyone.

<br/>

## 🎯 Key Features

### 👤 For Customers
| Feature | Description |
|---|---|
| 📍 **Nearby Discovery** | Find businesses by location & category |
| 👁️ **Live Queue View** | See real-time queue length & estimated wait |
| 🎫 **Digital Token** | Get your virtual queue number instantly |
| 📅 **Advance Booking** | Book a slot up to 4 days ahead |
| 🔔 **Smart Notifications** | Push + WhatsApp alerts when your turn nears |
| 📜 **History & Cancellation** | Manage all your bookings in one place |

### 🏢 For Business Owners
| Feature | Description |
|---|---|
| ⚡ **Live Dashboard** | Monitor your queue in real-time |
| ✅ **Accept / Reject** | Control who enters your queue |
| 📣 **Customer Alerts** | Send direct notifications to waiting customers |
| 📊 **Analytics** | Daily customers, avg. wait time, peak hours |
| 🔄 **Auto-Advance** | Queue moves automatically when service completes |
| 🛠️ **Service Management** | Define services with custom durations |

### 🔑 For Admins
| Feature | Description |
|---|---|
| 🏢 **Business Management** | Approve, suspend, or manage all businesses |
| 📈 **Platform Analytics** | Bird's-eye view of platform-wide metrics |
| 🛡️ **Role Management** | Full control over users and permissions |

<br/>

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     SmartQ Platform                      │
├──────────────┬──────────────────┬───────────────────────┤
│   Customer   │  Business Owner  │        Admin          │
│   Web / App  │    Dashboard     │       Panel           │
└──────┬───────┴────────┬─────────┴──────────┬────────────┘
       │                │                    │
       └────────────────▼────────────────────┘
                        │
              ┌─────────▼──────────┐
              │    REST API Layer   │
              │   (Node.js/Express) │
              └─────────┬──────────┘
                        │
         ┌──────────────┼──────────────┐
         ▼              ▼              ▼
   ┌───────────┐  ┌──────────┐  ┌──────────────┐
   │ PostgreSQL │  │  Redis   │  │  WebSockets  │
   │  (Primary) │  │ (Cache)  │  │ (Real-time)  │
   └───────────┘  └──────────┘  └──────────────┘
                        │
         ┌──────────────┼──────────────┐
         ▼              ▼              ▼
   ┌──────────┐   ┌──────────┐  ┌───────────┐
   │   Push   │   │ WhatsApp │  │   Email   │
   │  Notify  │   │   API    │  │  (SMTP)   │
   └──────────┘   └──────────┘  └───────────┘
```

<br/>

## 🛠️ Tech Stack

### Frontend
![React](https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![React Native](https://img.shields.io/badge/React_Native-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white)

### Backend
![Node.js](https://img.shields.io/badge/Node.js-43853D?style=flat-square&logo=node.js&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js-404D59?style=flat-square&logo=express&logoColor=white)
![Socket.io](https://img.shields.io/badge/Socket.io-010101?style=flat-square&logo=socket.io&logoColor=white)

### Database & Cache
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=flat-square&logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?style=flat-square&logo=redis&logoColor=white)

### DevOps & Cloud
![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white)
![AWS](https://img.shields.io/badge/AWS-FF9900?style=flat-square&logo=amazon-aws&logoColor=white)

<br/>

## 📦 Installation

### Prerequisites

- Node.js `v18+`
- PostgreSQL `v14+`
- Redis `v7+`
- npm or yarn

### Clone the Repository

```bash
git clone https://github.com/your-username/smartq.git
cd smartq
```

### Backend Setup

```bash
cd server
npm install

# Copy environment file
cp .env.example .env

# Run database migrations
npm run migrate

# Seed sample data (optional)
npm run seed

# Start development server
npm run dev
```

### Frontend Setup

```bash
cd client
npm install

# Start the web app
npm run dev
```

### Mobile Setup (React Native)

```bash
cd mobile
npm install

# iOS
npx pod-install
npx react-native run-ios

# Android
npx react-native run-android
```

### Docker (Recommended)

```bash
# Start all services
docker-compose up --build

# App will be running at http://localhost:3000
```

<br/>

## ⚙️ Configuration

Create a `.env` file in the `/server` directory:

```env
# Server
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/smartq

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your_super_secret_key
JWT_EXPIRES_IN=7d

# Google Maps API (for location features)
GOOGLE_MAPS_API_KEY=your_google_maps_key

# WhatsApp (Twilio / Meta)
WHATSAPP_API_KEY=your_whatsapp_key
WHATSAPP_PHONE_ID=your_phone_id

# Push Notifications (Firebase)
FIREBASE_SERVER_KEY=your_firebase_server_key

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
```

<br/>

## 🗄️ Database Schema

```sql
-- Users Table
CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL,
  phone       VARCHAR(20) UNIQUE,
  email       VARCHAR(150) UNIQUE,
  role        ENUM('customer', 'business_owner', 'admin') DEFAULT 'customer',
  created_at  TIMESTAMP DEFAULT NOW()
);

-- Businesses Table
CREATE TABLE businesses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID REFERENCES users(id),
  name        VARCHAR(150) NOT NULL,
  category    VARCHAR(50),              -- barber, hospital, restaurant, etc.
  address     TEXT,
  latitude    DECIMAL(9,6),
  longitude   DECIMAL(9,6),
  status      ENUM('pending', 'approved', 'suspended') DEFAULT 'pending',
  created_at  TIMESTAMP DEFAULT NOW()
);

-- Services Table
CREATE TABLE services (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     UUID REFERENCES businesses(id),
  name            VARCHAR(100) NOT NULL,
  duration_mins   INTEGER NOT NULL,     -- e.g., 20 for a haircut
  is_active       BOOLEAN DEFAULT TRUE
);

-- Queues Table
CREATE TABLE queues (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     UUID REFERENCES businesses(id),
  customer_id     UUID REFERENCES users(id),
  service_id      UUID REFERENCES services(id),
  token_number    INTEGER NOT NULL,
  status          ENUM('waiting', 'active', 'completed', 'cancelled') DEFAULT 'waiting',
  joined_at       TIMESTAMP DEFAULT NOW(),
  served_at       TIMESTAMP
);

-- Bookings Table
CREATE TABLE bookings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id     UUID REFERENCES users(id),
  business_id     UUID REFERENCES businesses(id),
  service_id      UUID REFERENCES services(id),
  scheduled_at    TIMESTAMP NOT NULL,
  status          ENUM('upcoming', 'completed', 'cancelled') DEFAULT 'upcoming',
  token_number    INTEGER,
  created_at      TIMESTAMP DEFAULT NOW()
);

-- Notifications Table
CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id),
  type        ENUM('push', 'whatsapp', 'sms', 'email'),
  message     TEXT,
  status      ENUM('sent', 'delivered', 'failed'),
  sent_at     TIMESTAMP DEFAULT NOW()
);
```

<br/>

## 📡 API Reference

### Auth
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Register new user |
| `POST` | `/api/auth/login` | Login & get JWT |
| `POST` | `/api/auth/refresh` | Refresh access token |

### Queues
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/businesses/:id/queue` | Get live queue status |
| `POST` | `/api/queues/join` | Join a queue |
| `PATCH` | `/api/queues/:id/cancel` | Cancel queue position |
| `PATCH` | `/api/queues/:id/complete` | Mark service as done (owner) |
| `POST` | `/api/queues/next` | Call next customer (owner) |

### Businesses
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/businesses/nearby` | Get nearby businesses |
| `POST` | `/api/businesses` | Register a business |
| `GET` | `/api/businesses/:id/analytics` | Get business analytics |

### Bookings
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/bookings` | Book a future slot |
| `GET` | `/api/bookings/my` | Get user booking history |
| `DELETE` | `/api/bookings/:id` | Cancel a booking |

<br/>

## 👥 User Roles

```
┌─────────────┬────────────────────────────────────────────┐
│    Role     │              Capabilities                   │
├─────────────┼────────────────────────────────────────────┤
│  Customer   │  Browse, join queue, book, cancel, receive │
│             │  notifications, view history               │
├─────────────┼────────────────────────────────────────────┤
│  Business   │  Manage services, control queue, view      │
│   Owner     │  analytics, send alerts, call customers    │
├─────────────┼────────────────────────────────────────────┤
│    Admin    │  Approve businesses, manage users,         │
│             │  view platform-wide analytics              │
└─────────────┴────────────────────────────────────────────┘
```

<br/>

## 📱 Screenshots

> *Screenshots will be added after the initial UI build is complete.*

| Customer App | Business Dashboard | Admin Panel |
|:---:|:---:|:---:|
| `Coming Soon` | `Coming Soon` | `Coming Soon` |

<br/>

## 🤝 Contributing

We welcome contributions from everyone — whether you're fixing a bug, improving documentation, or proposing a major new feature. SmartQ is built by the community, for the community.

### How to Contribute

1. **Fork** the repository
   ```bash
   git fork https://github.com/your-username/smartq.git
   ```

2. **Create a feature branch** from `main`
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make your changes** following the code style guide below

4. **Commit** with a clear, descriptive message
   ```bash
   git commit -m "feat: add WhatsApp notification for queue reminders"
   ```
   > We follow [Conventional Commits](https://www.conventionalcommits.org/) — use prefixes like `feat:`, `fix:`, `docs:`, `chore:`

5. **Push** your branch
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Open a Pull Request** against the `main` branch with:
   - A clear title and description
   - Screenshots or screen recordings if it's a UI change
   - Reference to any related issues (`Closes #123`)

### 📐 Code Style
- Use **TypeScript** for all new code
- Run `npm run lint` before committing
- Write tests for new features where possible
- Keep PRs focused — one feature or fix per PR

### 🐛 Reporting Bugs
Open an [issue](issues) with the `bug` label. Please include:
- Steps to reproduce
- Expected vs actual behavior
- Your OS, browser, and Node.js version

### 💡 Suggesting Features
Open an [issue](issues) with the `enhancement` label and describe the use case clearly.

### 🙏 Code of Conduct
All contributors are expected to uphold a respectful and inclusive environment. Be kind. Be constructive.

<br/>

---

<div align="center">

## 📄 License

This project is licensed under the **MIT License** — free to use, modify, and distribute.

See the [LICENSE](LICENSE) file for full details.

<br/>

---

**Built with ❤️ by the SmartQ community**

*If SmartQ helped you, please ⭐ star this repo — it means a lot!*

[![Star History Chart](https://img.shields.io/github/stars/your-username/smartq?style=social)](#)

</div>

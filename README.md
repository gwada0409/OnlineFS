# OnlineFS - Online Filing System

OnlineFS is a modern, responsive web application designed for streamlined employee leave filing, document submission, leave balance tracking, and approval workflow monitoring.

---

## 🚀 Features

- **Leave Request Filing**: Quick and intuitive form for submitting vacation, sick, emergency, and special leaves (`FileLeavePage`).
- **Leave Request Details**: Real-time status tracking, breakdown of leave days, and detailed approval route history (`LeaveDetailPage`).
- **Document & Attachment Uploads**: Support for medical certificates, support documents, and file previews.
- **Responsive UI**: Built with Tailwind CSS and Radix UI components for seamless experience on desktop, tablet, and mobile.
- **API Integration**: Integrated via Axios for backend API interaction.

---

## 📁 Repository Structure

```
OnlineFS/
├── src/
│   ├── components/         # Reusable UI components & Layouts
│   ├── pages/              # Main application pages (FileLeave, LeaveDetail, etc.)
│   ├── services/           # Axios API services and endpoints
│   ├── types/              # TypeScript interface definitions
│   └── App.tsx             # Application routing and state management
├── public/                 # Static assets and icons
├── Dockerfile              # Containerization specification for NGINX deployment
├── nginx.conf              # NGINX configuration for SPA routing
├── tailwind.config.js      # Tailwind CSS styling configuration
├── vite.config.ts          # Vite build runner setup
└── package.json            # Dependencies and npm scripts
```

---

## 🛠️ Tech Stack

- **Framework**: React 19 + TypeScript
- **Build Tool**: Vite 8
- **Styling**: Tailwind CSS v4, PostCSS, Radix UI primitives
- **Icons**: Lucide React
- **HTTP Client**: Axios
- **Deployment**: Docker + NGINX

---

## 🏁 Getting Started

### Prerequisites

- [Node.js 18+](https://nodejs.org/) & npm

### Development Setup

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Run Development Server**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

3. **Build for Production**:
   ```bash
   npm run build
   ```

4. **Preview Production Build**:
   ```bash
   npm run preview
   ```

---

## 🐳 Docker Deployment

To build and run the production NGINX container locally:

```bash
# Build the Docker image
docker build -t onlinefs:latest .

# Run the container
docker run -d -p 80:80 onlinefs:latest
```

---

## 🔒 License

Internal & Proprietary Project. All rights reserved.

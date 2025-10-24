# Altairium Grant Writing Tool

A modern grant writing application built with React, TypeScript, Vite, and Tailwind CSS.

## Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn

### Installation

1. Clone the repository
2. Navigate to the project directory:
   ```bash
   cd altairium-grant-writing-tool
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

### Development

To run the development server:

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

### Build

To build the project for production:

```bash
npm run build
```

### Preview Production Build

To preview the production build locally:

```bash
npm run preview
```

## Technologies Used

- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **Lucide React** - Icon library

## Project Structure

```
altairium-grant-writing-tool/
├── public/           # Static assets
├── src/
│   ├── App.tsx      # Main application component
│   ├── main.tsx     # Application entry point
│   └── index.css    # Global styles with Tailwind directives
├── index.html       # HTML template
├── package.json     # Dependencies and scripts
├── tsconfig.json    # TypeScript configuration
├── vite.config.ts   # Vite configuration
└── tailwind.config.js # Tailwind CSS configuration
```

## Features

- Grant information form
- Document upload interface
- Grant proposal generation
- Export to DOCX/PDF (coming soon)
- Modern, responsive UI

## License

MIT

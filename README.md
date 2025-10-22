# Jetson Capacity Planning

A modern Next.js application for production capacity planning and job management, built with React, TypeScript, and Tailwind CSS.

## Features

### Machines View
- **Production Line Cards**: Visual cards displaying all production lines with key specifications
- **Status Filtering**: Filter machines by status (All, Running, Available, Maintenance)
- **Real-time Information**: Shows current job assignments, machine specs, speed, and capacity
- **Color-coded Status**: Visual indicators for machine availability and status

### Add Job Modal
A comprehensive 4-step wizard for adding new jobs:

1. **Job Details**: Job number, client name, description, quantity, service type, dates, and notes
2. **Requirements**: Process type, machine type, envelope size, pockets, shifts, and material status
3. **Machine Selection**: Interactive table to select available machines for the job
4. **Review & Confirm**: Summary of all entered information before submission

### Design System
- **Consistent Color Palette**: Professional blue, green, yellow, and red status colors
- **Responsive Layout**: Mobile-first design that works on all screen sizes
- **Modern UI Components**: Clean cards, buttons, forms, and modals
- **Smooth Interactions**: Hover effects, transitions, and focus states

## Getting Started

### Development Server

```bash
npm run dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser.

### Build for Production

```bash
npm run build
npm start
```

## Technology Stack

- **Framework**: Next.js 15.5.6 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS with custom CSS variables
- **UI**: React with Client Components

## Project Structure

```
app/
├── components/
│   └── AddJobModal.tsx    # Multi-step job creation modal
├── globals.css            # Global styles and CSS variables
├── layout.tsx             # Root layout
└── page.tsx               # Main page with machines view
```

## Color Scheme

- **Primary Blue**: `#2563eb` - Navigation, primary actions
- **Dark Blue**: `#1e40af` - Headings, important text
- **Success Green**: `#10b981` - Available status, success states
- **Warning Yellow**: `#f59e0b` - Maintenance, warnings
- **Accent Red**: `#ef4444` - Alerts, errors

## Key Components

### Machine Cards
Display production line information including:
- Line number and type
- Current status (Running/Available/Maintenance)
- Specifications (max size, pockets, speed, shift capacity)
- Current job assignment (if running)

### Add Job Modal
Multi-step form with:
- Step indicator showing progress
- Form validation
- Dynamic content based on step
- Previous/Next navigation
- Review summary before submission

## Future Enhancements

- Dashboard view with active jobs and capacity overview
- Materials tracking page
- Job editing and deletion
- Real-time updates via WebSocket
- Backend API integration
- User authentication
- Advanced filtering and search
- Export reports (PDF, Excel)

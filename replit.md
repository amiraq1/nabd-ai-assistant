# Nabd (نبض) - AI Assistant Interface

## Overview
A modern, sleek Arabic RTL personal AI assistant web interface named "Nabd" (نبض). Features deep dark theme with neon purple glow effects, glassmorphism styling, bento box grid layout, and a full chat interface.

## Architecture
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Express.js
- **Database**: PostgreSQL with Drizzle ORM
- **Language**: TypeScript throughout
- **Font**: Cairo (Google Fonts) for Arabic text
- **Layout**: RTL (Right-to-Left), fully Arabic localized

## Key Components
- `client/src/pages/home.tsx` - Main page with landing view and chat view
- `client/src/components/nabd-sidebar.tsx` - Collapsible sidebar for chat history
- `client/src/components/nabd-header.tsx` - Header with brand and sidebar toggle
- `client/src/components/bento-grid.tsx` - AI tools grid on landing page
- `client/src/components/chat-input.tsx` - Sticky chat input with glassmorphism
- `client/src/components/chat-messages.tsx` - Message display with user/assistant styling

## API Routes
- `GET /api/conversations` - List all conversations
- `POST /api/conversations` - Create new conversation
- `DELETE /api/conversations/:id` - Delete conversation
- `GET /api/conversations/:id/messages` - Get messages
- `POST /api/conversations/:id/messages` - Send message (auto-generates AI response)

## Database Schema
- `conversations` - id, title, createdAt
- `messages` - id, conversationId, role, content, createdAt

## Recent Changes
- 2026-02-21: Initial build - Complete UI with RTL Arabic layout, dark theme, neon glow, glassmorphism, bento grid, chat system, PostgreSQL persistence, seed data

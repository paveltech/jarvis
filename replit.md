# Overview

JARVIS is an AI-powered voice assistant application that integrates with n8n workflows to perform various tasks like email management, calendar scheduling, contact management, and content creation. The application features a React frontend with a futuristic, sci-fi interface and an Express backend that handles voice transcription, AI processing, and workflow orchestration.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture

**Framework**: React 18 with TypeScript, using Vite as the build tool and development server. The application uses a component-based architecture with a dark, sci-fi themed UI built using shadcn/ui components and Tailwind CSS.

**State Management**: React Query (TanStack Query) for server state management and caching, with local React state for UI interactions. Session-based conversation management with unique session IDs.

**UI Framework**: Custom design system built on Radix UI primitives with extensive shadcn/ui components. Uses a dark color scheme with cyan/blue accent colors and glowing animations to create a futuristic JARVIS-like interface.

**Audio Processing**: Browser-native MediaRecorder API for voice recording, with built-in audio utilities for recording, playback, and file management. Supports real-time audio visualization during recording.

## Backend Architecture

**Server Framework**: Express.js with TypeScript, featuring middleware for request logging, error handling, and JSON parsing. Uses ESM modules throughout the application.

**API Design**: RESTful API with endpoints for conversation history, audio transcription, and JARVIS interaction. Supports multipart file uploads for audio processing.

**Database Layer**: Drizzle ORM configured for PostgreSQL with schema-first approach. Currently using in-memory storage (MemStorage) for development, with PostgreSQL schema defined for production deployment.

**AI Integration**: OpenAI API integration for Whisper speech-to-text transcription and GPT-4o for conversational AI responses. Supports audio file processing with configurable size limits.

## Voice Processing Pipeline

**Speech-to-Text**: OpenAI Whisper API for high-quality audio transcription with support for various audio formats and automatic language detection.

**Voice Interface**: Real-time voice recording with visual feedback, automatic silence detection, and seamless transcription workflow.

**Audio Management**: File upload handling with multer, temporary file storage, and automatic cleanup of processed audio files.

## Workflow Integration

**n8n Integration**: Multiple specialized agent workflows including Email Agent, Calendar Agent, Contact Agent, and Content Creator Agent. Each agent is designed as a separate n8n workflow with specific capabilities.

**Agent Architecture**: Master JARVIS workflow orchestrates sub-agents based on user intent, with tools for web search, email management, calendar operations, and content generation.

**External Tools**: Tavily API for web search capabilities, Airtable integration for contact management, and various other third-party service integrations through n8n.

## Data Storage

**Conversation Management**: Session-based conversation history with support for both text and audio messages. Stores metadata, timestamps, and audio URLs for complete interaction tracking.

**Database Schema**: PostgreSQL schema with conversations table including session tracking, message content, sender identification, and audio file references.

**File Storage**: Local file system storage for audio uploads with configurable size limits and automatic cleanup processes.

# External Dependencies

## AI Services
- **OpenAI API**: Whisper for speech-to-text transcription and GPT-4o for conversational AI
- **Tavily API**: Web search capabilities for content research and real-time information

## Database & Storage
- **PostgreSQL**: Primary database using Neon serverless PostgreSQL
- **Drizzle ORM**: Type-safe database operations and migrations

## Workflow Automation
- **n8n**: Workflow automation platform hosting specialized AI agents
- **Airtable**: Contact management and data storage integration

## Frontend Libraries
- **React Query**: Server state management and caching
- **Radix UI**: Accessible UI component primitives
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: Icon library

## Audio & Media
- **Multer**: File upload middleware for audio processing
- **Browser MediaRecorder API**: Native audio recording capabilities

## Development Tools
- **Vite**: Build tool and development server with HMR
- **TypeScript**: Type safety across frontend and backend
- **ESBuild**: Production build optimization
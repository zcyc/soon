# SOON - Screen Recording Made Simple

**SOON** is a modern, web-based screen recording application built with Next.js that allows users to easily record their screen, camera, and audio with professional-quality output. Record, manage, and share your videos with a beautiful, intuitive interface.

## 🎬 Features

### Core Recording Features
- **Multi-source Recording**: Record screen, camera, or both simultaneously
- **High Quality Output**: Support for 720p and 1080p recording with customizable bitrates
- **Audio Recording**: Capture system audio, microphone, or both
- **Flexible Screen Sources**: Record entire screen, specific windows, or browser tabs
- **Real-time Subtitles**: AI-powered speech recognition with subtitle generation (SRT/VTT export)
- **Recording Controls**: Pause/resume functionality with real-time duration tracking

### Video Management
- **Video Gallery**: Organized grid and list views of all recordings
- **Video Player**: Custom video player with subtitle support
- **Public/Private Videos**: Control video visibility and sharing permissions
- **Video Metadata**: Track views, duration, quality, and creation dates
- **Search & Filter**: Find videos by title, quality, or other attributes

### Sharing & Collaboration
- **Public Sharing**: Generate shareable links for public videos
- **Video Reactions**: Emoji-based reaction system for viewer engagement
- **Download Options**: Export videos in WebM format
- **Responsive Player**: Optimized video display across all devices

### User Experience
- **Authentication System**: Secure user registration and login with Supabase
- **Multi-language Support**: Built-in internationalization (English/Chinese)
- **Theme Support**: Light and dark mode with customizable themes
- **Responsive Design**: Mobile-first design that works on all devices
- **Real-time Notifications**: Toast notifications for user feedback

## 🛠️ Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) with App Router and Turbopack
- **UI Library**: [shadcn/ui](https://ui.shadcn.com/) + [Tailwind CSS](https://tailwindcss.com/)
- **Backend Services**: [Supabase](https://supabase.com/) for authentication, database, and file storage
- **Recording API**: Web APIs (MediaRecorder, Screen Capture, getUserMedia)
- **Styling**: Tailwind CSS 4.0 with CSS variables and theme system
- **TypeScript**: Full type safety throughout the application
- **Icons**: [Lucide React](https://lucide.dev/) icon library

## 🏗️ Architecture Overview

SOON uses Supabase as the primary backend service:
- **Supabase**: Authentication, database operations, video storage, metadata management
- **Next.js**: Frontend and API routes
- **Client-side APIs**: Web recording APIs for media capture

## 🚀 Quick Start

### Prerequisites

- **Node.js 18+** installed
- **Supabase project** created and accessible
- **Git** for version control

### Step 1: Supabase Setup

#### 1. Create Supabase Project

1. Visit [Supabase Dashboard](https://supabase.com)
2. Create an account or sign in
3. Click "New Project"
4. Project Name: `SOON Screen Recorder`
5. Choose a strong database password
6. Select a region close to your users

#### 2. Configure Authentication

1. Navigate to **Authentication > Providers**
2. Enable Auth Methods:
   - ✅ Email (enabled by default)
   - ✅ GitHub (optional, for OAuth)
   - ✅ Google (optional, for OAuth)
3. Configure OAuth Providers (if needed):
   - Add OAuth credentials from GitHub/Google
   - Set redirect URLs: `https://your-project.supabase.co/auth/v1/callback`

#### 3. Create Database Tables

In Supabase SQL Editor, execute the following SQL:

```sql
-- Create videos table
CREATE TABLE videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  title TEXT NOT NULL,
  file_id TEXT NOT NULL,
  quality TEXT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  duration NUMERIC DEFAULT 0,
  views INTEGER DEFAULT 0,
  is_public BOOLEAN DEFAULT false,
  is_publish BOOLEAN DEFAULT false,
  thumbnail_url TEXT,
  subtitle_file_id TEXT
);

-- Create reactions table
CREATE TABLE reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  emoji TEXT NOT NULL,
  UNIQUE(video_id, user_id, emoji)
);

-- Create activity_logs table
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ip_address TEXT,
  metadata TEXT,
  user_name TEXT
);

-- Create indexes
CREATE INDEX idx_videos_user_id ON videos(user_id);
CREATE INDEX idx_videos_is_public ON videos(is_public);
CREATE INDEX idx_videos_is_publish ON videos(is_publish);
CREATE INDEX idx_reactions_video_id ON reactions(video_id);
CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id);
```

#### 4. Row Level Security (RLS) - Optional

**Note**: Since this project uses Server Actions with Secret Key for all database operations, **RLS is optional**. All permission checks are done in Server Actions.

If you want to add RLS for additional security in production:

```sql
-- Enable RLS
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Videos policies
CREATE POLICY "Users can view public videos" ON videos
  FOR SELECT USING (is_public = true AND is_publish = true);

CREATE POLICY "Users can view their own videos" ON videos
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own videos" ON videos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own videos" ON videos
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own videos" ON videos
  FOR DELETE USING (auth.uid() = user_id);

-- Reactions policies
CREATE POLICY "Anyone can view reactions" ON reactions
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can add reactions" ON reactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reactions" ON reactions
  FOR DELETE USING (auth.uid() = user_id);

-- Activity logs policies
CREATE POLICY "Users can insert their own activity logs" ON activity_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
```

#### 5. Create Storage Bucket

1. Navigate to **Storage** in Supabase Dashboard
2. Click "New bucket"
3. Bucket Name: `videos`
4. Set as Public (for public video access)
5. File size limit: 1000MB (or your preference)
6. Allowed MIME types: `video/webm,video/mp4,video/quicktime,video/x-msvideo`

#### 6. Get API Keys

1. Navigate to **Project Settings > API**
2. Copy the following:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **Publishable key** → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - **Secret key** → `SUPABASE_SECRET_KEY` (⚠️ Keep secret, server-side only!)

### Step 2: Application Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd soon-screen-recorder
   npm install
   ```

2. **Environment Configuration**

   Create a `.env.local` file in the root directory:
   ```env
   # Supabase Configuration
   NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="your-publishable-key"
   SUPABASE_SECRET_KEY="your-secret-key"
   
   # Storage Bucket
   NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET="videos"
   
   # Base URL
   NEXT_PUBLIC_BASE_URL="http://localhost:3000"
   ```

3. **Start Development Server**
   ```bash
   npm run dev
   ```
   
   Open [http://localhost:3000](http://localhost:3000) to see the application.

## 📝 Usage

### Recording Videos
1. **Navigate to Dashboard**: Log in and go to the dashboard
2. **Configure Recording**: Choose your recording source (screen/camera/both)
3. **Set Quality**: Select between 720p and 1080p output
4. **Enable Features**: Toggle audio recording and subtitles as needed
5. **Start Recording**: Click the record button and grant necessary permissions
6. **Control Recording**: Use pause/resume controls during recording
7. **Save & Share**: Add a title, set privacy, and upload your video

### Managing Videos
- **View Library**: Browse all your recordings in the dashboard
- **Share Videos**: Copy share links or use the built-in sharing features
- **Download Videos**: Export your recordings in WebM format
- **Delete Videos**: Remove unwanted recordings from your library

### Advanced Features
- **Subtitle Export**: Download generated subtitles in SRT or VTT format
- **Public Gallery**: Browse public videos from other users
- **Reactions**: Add emoji reactions to videos you watch
- **Responsive Viewing**: Videos automatically adapt to container sizes

## 🧪 Testing

### Basic Functionality Tests

1. **Homepage Loading**
   - [ ] Visit http://localhost:3000
   - [ ] Page loads without errors

2. **User Registration**
   - [ ] Visit `/sign-up`
   - [ ] Fill form and register
   - [ ] Auto-login after registration

3. **User Login**
   - [ ] Visit `/sign-in`
   - [ ] Login with registered account
   - [ ] Redirect after successful login

4. **Video Upload**
   - [ ] Login and visit `/dashboard`
   - [ ] Record or upload video
   - [ ] Video successfully uploaded to Supabase Storage

5. **Video Management**
   - [ ] View video list in Dashboard
   - [ ] Play videos
   - [ ] Delete videos
   - [ ] Toggle privacy settings
   - [ ] Toggle publish status

6. **Public Features**
   - [ ] Visit `/discover` to see public videos
   - [ ] Visit `/share/[videoId]` for video sharing
   - [ ] Add reactions to videos

### Common Issues & Troubleshooting

#### Environment Variables Not Set

**Error**: `SUPABASE_SECRET_KEY is required for admin operations`

**Solution**:
1. Check if `.env.local` file exists
2. Verify all required environment variables are set
3. Ensure you're using Publishable key and Secret key (not legacy keys)
4. Restart development server

#### Database Tables Don't Exist

**Error**: `relation "videos" does not exist`

**Solution**:
1. Execute the SQL statements in Supabase SQL Editor
2. Verify tables were created successfully

#### Storage Bucket Not Found

**Error**: `Bucket not found`

**Solution**:
1. Create storage bucket in Supabase Dashboard > Storage
2. Ensure bucket name matches `NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET`

#### OAuth Callback Failed

**Error**: `OAuth callback failed`

**Solution**:
1. Check Supabase Dashboard > Authentication > URL Configuration
2. Verify callback URL is correctly configured
3. Check OAuth provider (GitHub/Google) callback URL settings

## 🔒 Security

### Server Actions & Row Level Security

This project uses **Server Actions** for all database operations with **Secret Key**, which means:

- ✅ All database operations are executed server-side
- ✅ Permission validation is done in Server Actions
- ✅ RLS is optional (but recommended for production)

### Security Best Practices

1. **Secret Key Security**
   - **Must** only be used server-side
   - **Never** expose to client (browser)
   - Store in environment variables, never commit to repository

2. **Permission Validation**
   - Verify user permissions in each Server Action
   - Example: Check if user owns the resource before modifying

3. **Production Recommendations**
   - Use RLS as an additional security layer
   - Implement defense in depth strategy
   - Regular security audits

## 🎨 Theming

The application includes a comprehensive theming system supporting light and dark modes. When developing:

- Use CSS custom properties like `var(--color-primary)` 
- Utilize Tailwind theme classes like `bg-primary text-primary-foreground`
- Avoid hardcoded colors to ensure proper theme switching
- Customize themes in `contexts/theme-context.tsx`

## 📁 Project Structure

```
├── app/                    # Next.js app directory
│   ├── (login)/           # Authentication pages
│   ├── dashboard/         # Main recording interface
│   ├── discover/          # Public video gallery
│   ├── share/[videoId]/   # Public video sharing
│   └── api/               # API routes
├── components/            # Reusable UI components
│   ├── ui/               # shadcn/ui components
│   ├── screen-recorder.tsx # Main recording component
│   ├── video-gallery.tsx  # Video management interface
│   └── header.tsx        # Navigation header
├── contexts/             # React contexts
├── lib/                  # Utility libraries
│   ├── auth/            # Authentication services
│   ├── services/        # Business logic services
│   ├── database.ts       # Database type definitions
│   ├── supabase.ts      # Supabase client configuration
│   ├── supabase-server.ts # Supabase server configuration
│   └── config.ts        # App configuration
└── public/              # Static assets
```

## 🔧 Development Scripts

- `npm run dev` - Start development server with Turbopack
- `npm run build` - Build for production  
- `npm run start` - Start production server

## 🌐 Browser Support

- **Chrome/Edge**: Full support with optimal performance
- **Firefox**: Full support with slightly reduced performance
- **Safari**: Partial support (some recording features limited)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📧 Support

For support and questions:
- Create an issue on GitHub
- Join our community discussions
- Check the troubleshooting section above

---

Built with ❤️ using Next.js and Supabase

#!/bin/bash

echo "🚀 Setting up Strava Weather Integration - Local Development"
echo "=========================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "Please run this script from the project root directory"
    exit 1
fi

# Check Node.js version
echo "🔍 Checking Node.js version..."
NODE_VERSION=$(node --version 2>/dev/null)
REQUIRED_VERSION="v22.11.0"

if [ -z "$NODE_VERSION" ]; then
    print_error "Node.js is not installed"
    echo "Please install Node.js 22.11.0 or higher: https://nodejs.org/"
    exit 1
fi

# Simple version comparison (works for most cases)
NODE_MAJOR=$(echo $NODE_VERSION | cut -d. -f1 | sed 's/v//')
if [ "$NODE_MAJOR" -lt "22" ]; then
    print_error "Node.js version 22.11.0 or higher is required. Current: $NODE_VERSION"
    echo "Please install Node.js 22.11.0 LTS: https://nodejs.org/"
    exit 1
fi

print_status "Node.js version check passed: $NODE_VERSION"

# Check npm version
NPM_VERSION=$(npm --version 2>/dev/null)
if [ -z "$NPM_VERSION" ]; then
    print_error "npm is not installed"
    exit 1
fi
print_status "npm version: $NPM_VERSION"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install
if [ $? -eq 0 ]; then
    print_status "Dependencies installed successfully"
else
    print_error "Failed to install dependencies"
    exit 1
fi

# Create environment file if it doesn't exist
echo ""
echo "📝 Setting up environment configuration..."

if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        cp .env.example .env
        print_status "Created .env file from .env.example"
        echo ""
        print_warning "Please edit .env and add your API keys:"
        echo "   - DATABASE_URL (PostgreSQL connection string)"
        echo "   - STRAVA_CLIENT_ID & STRAVA_CLIENT_SECRET"
        echo "   - OPENWEATHERMAP_API_KEY"
        echo "   - JWT_SECRET (32+ character random string)"
        echo "   - ENCRYPTION_KEY (32+ character random string)"
    else
        print_error ".env.example file not found"
        exit 1
    fi
else
    print_warning ".env file already exists - skipping creation"
fi

# Check if DATABASE_URL is configured
echo ""
echo "🔍 Checking environment configuration..."
if grep -q "postgresql://postgres:password@localhost" .env 2>/dev/null; then
    print_warning "DATABASE_URL appears to be using the default value"
    echo "   Please update it with your actual PostgreSQL connection string"
else
    # Try to generate Prisma client
    echo ""
    echo "🗄️  Generating Prisma client..."
    npm run db:generate
    if [ $? -eq 0 ]; then
        print_status "Prisma client generated successfully"
    else
        print_warning "Failed to generate Prisma client - check your DATABASE_URL"
    fi
fi

# Type checking
echo ""
echo "🔍 Running type checks..."
npm run typecheck
if [ $? -eq 0 ]; then
    print_status "Type checking passed"
else
    print_warning "Type checking failed - this might be normal if DATABASE_URL is not configured"
fi

# Check for optional tools
echo ""
echo "🔧 Checking optional tools..."

command_exists() {
    command -v "$1" >/dev/null 2>&1
}

if command_exists psql; then
    print_status "PostgreSQL client (psql) is installed"
else
    print_warning "PostgreSQL client (psql) not found"
    echo "   Install it for easier database management"
fi

if command_exists docker; then
    print_status "Docker is installed"
    echo ""
    echo "   💡 Quick PostgreSQL setup with Docker:"
    echo "   docker run --name postgres-strava \\"
    echo "     -e POSTGRES_PASSWORD=password \\"
    echo "     -e POSTGRES_DB=strava_weather \\"
    echo "     -p 5432:5432 \\"
    echo "     -d postgres:15"
else
    print_warning "Docker not found"
    echo "   Consider installing Docker for easy PostgreSQL setup"
fi

if command_exists ngrok; then
    print_status "ngrok is installed (for webhook testing)"
else
    print_warning "ngrok not found"
    echo "   Install ngrok for local webhook testing: https://ngrok.com"
fi

echo ""
echo "============================================"
echo "✨ Setup Complete!"
echo "============================================"
echo ""
echo "📋 Next Steps:"
echo ""
echo "1. Configure your environment variables in .env"
echo ""
echo "2. Set up your database:"
echo "   npm run db:migrate"
echo ""
echo "3. Start development servers:"
echo "   npm run dev              # Both frontend and backend"
echo "   npm run dev:server       # Backend only (http://localhost:3001)"
echo "   npm run dev:web          # Frontend only (http://localhost:5173)"
echo ""
echo "   Note: APP_URL is already set to http://localhost:5173 for local development"
echo ""
echo "4. For webhook testing with ngrok:"
echo "   ngrok http 3001"
echo "   Then use the ngrok URL for webhook setup"
echo ""
echo "📚 Useful Commands:"
echo "   npm run db:studio        # Open Prisma Studio"
echo "   npm run webhook:status   # Check webhook status"
echo "   npm run webhook:setup    # Setup webhooks"
echo "   npm run lint:fix         # Fix linting issues"
echo "   npm run build            # Build for production"
echo ""
echo "🔗 Resources:"
echo "   Health Check: http://localhost:3001/api/health"
echo "   API Docs: See README.md"
echo "   GitHub: https://github.com/james-langridge/strava-weather"
echo ""
print_status "Happy coding! 🚀"
#!/bin/bash

echo "🚀 Setting up Strava Weather Integration - Complete Project"
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
    echo -e "${YELLOW}⚠️ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check Node.js version
echo "🔍 Checking Node.js version..."
NODE_VERSION=$(node --version)
REQUIRED_VERSION="v22.11.0"

if [[ "$NODE_VERSION" < "$REQUIRED_VERSION" ]]; then
    print_error "Node.js version $REQUIRED_VERSION or higher is required. Current: $NODE_VERSION"
    echo "Please install Node.js 22.11.0 LTS: https://nodejs.org/"
    exit 1
fi

print_status "Node.js version check passed: $NODE_VERSION"

# Install root dependencies
echo "📦 Installing root dependencies..."
npm install
if [ $? -eq 0 ]; then
    print_status "Root dependencies installed"
else
    print_error "Failed to install root dependencies"
    exit 1
fi

# Install workspace dependencies
echo "📦 Installing workspace dependencies..."
npm run setup
if [ $? -eq 0 ]; then
    print_status "Workspace dependencies installed"
else
    print_error "Failed to install workspace dependencies"
    exit 1
fi

# Create environment files
echo "📝 Setting up environment files..."

# Root environment
if [ ! -f .env.local ]; then
    cp .env.example .env.local
    print_status "Created .env.local (please fill in your API keys)"
else
    print_warning ".env.local already exists"
fi

# API environment
if [ ! -f apps/api/.env.local ]; then
    cp apps/api/.env.example apps/api/.env.local
    print_status "Created apps/api/.env.local"
else
    print_warning "apps/api/.env.local already exists"
fi

# Web environment
if [ ! -f apps/web/.env.local ]; then
    cp apps/web/.env.example apps/web/.env.local
    print_status "Created apps/web/.env.local"
else
    print_warning "apps/web/.env.local already exists"
fi

# Build shared packages
echo "🔨 Building shared packages..."
npm run build --workspace=packages/shared
if [ $? -eq 0 ]; then
    print_status "Shared package built"
else
    print_error "Failed to build shared package"
    exit 1
fi

# Check if DATABASE_URL is set
echo "🗄️ Checking database configuration..."
if grep -q "postgresql://username:password" .env.local 2>/dev/null; then
    print_warning "Please update DATABASE_URL in .env.local with your PostgreSQL connection string"
    echo "   Example: postgresql://user:password@localhost:5432/strava_weather"
else
    print_status "Environment configuration looks good"
fi

# Generate Prisma client (will work once DATABASE_URL is set)
echo "🗄️ Generating Prisma client..."
npm run db:generate
if [ $? -eq 0 ]; then
    print_status "Prisma client generated"
else
    print_warning "Prisma client generation failed - make sure DATABASE_URL is set correctly"
fi

# Type checking
echo "🔍 Running type checks..."
npm run typecheck
if [ $? -eq 0 ]; then
    print_status "Type checking passed"
else
    print_warning "Type checking failed - this is expected if DATABASE_URL is not set"
fi

echo ""
echo "🎉 Setup Complete!"
echo "=================="
echo ""
echo "Next steps:"
echo "1. 📝 Fill in your API keys in .env.local:"
echo "   - DATABASE_URL (PostgreSQL connection string)"
echo "   - STRAVA_CLIENT_ID (from https://developers.strava.com/)"
echo "   - STRAVA_CLIENT_SECRET"
echo "   - OPENWEATHERMAP_API_KEY (from https://openweathermap.org/api)"
echo "   - JWT_SECRET (32+ character random string)"
echo "   - ENCRYPTION_KEY (32+ character random string)"
echo ""
echo "2. 🗄️ Set up your database:"
echo "   npm run db:migrate"
echo ""
echo "3. 🚀 Start development servers:"
echo "   npm run dev          # Start both frontend and backend"
echo "   npm run dev:api      # Backend only (http://localhost:3001)"
echo "   npm run dev:web      # Frontend only (http://localhost:5173)"
echo ""
echo "4. 🌐 Test your setup:"
echo "   curl http://localhost:3001/api/health"
echo ""
echo "📚 Documentation:"
echo "   - README.md for complete setup guide"
echo "   - docs/ folder for detailed documentation"
echo "   - Health check: http://localhost:3001/api/health/detailed"
echo ""

# Check if required commands exist
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

echo "🔧 Optional tools check:"
if command_exists psql; then
    print_status "PostgreSQL client available"
else
    print_warning "PostgreSQL client not found - install for easier database management"
fi

if command_exists docker; then
    print_status "Docker available"
    echo "   💡 Tip: You can run PostgreSQL with Docker:"
    echo "   docker run --name postgres -e POSTGRES_PASSWORD=password -p 5432:5432 -d postgres:15"
else
    print_warning "Docker not found - consider installing for local database"
fi

echo ""
print_status "All done! Happy coding! 🎯"
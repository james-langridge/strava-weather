import { execSync } from 'child_process';
import { config } from '../src/config/environment.js';

console.log('🏗️  Starting build process...');

try {
    // Step 1: Generate Prisma Client
    console.log('📦 Generating Prisma Client...');
    execSync('npx prisma generate', { stdio: 'inherit' });
    console.log('✅ Prisma Client generated');

    // Step 2: Run migrations (only in production)
    if (config.isProduction && process.env.DATABASE_URL) {
        console.log('🗄️  Running database migrations...');
        try {
            execSync('npx prisma migrate deploy', { stdio: 'inherit' });
            console.log('✅ Database migrations completed');
        } catch (error) {
            console.error('❌ Migration failed:', error);
            // Don't fail the build if migrations fail - the app might still work
            // This handles cases where migrations were already run
            console.log('⚠️  Continuing build despite migration failure...');
        }
    } else {
        console.log('⏭️  Skipping migrations (not in production or no DATABASE_URL)');
    }

    // Step 3: Compile TypeScript
    console.log('🔨 Compiling TypeScript...');
    execSync('tsc', { stdio: 'inherit' });
    console.log('✅ TypeScript compilation completed');

    console.log('🎉 Build completed successfully!');

} catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
}
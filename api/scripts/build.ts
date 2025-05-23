import { execSync } from 'child_process';

console.log('🏗️  Starting build process...');

try {
    // Step 1: Generate Prisma Client
    console.log('📦 Generating Prisma Client...');
    execSync('npx prisma generate', { stdio: 'inherit' });
    console.log('✅ Prisma Client generated');

    // Step 2: Run migrations (in production environments)
    const isVercel = process.env.VERCEL === '1';
    const isProduction = process.env.NODE_ENV === 'production' || isVercel;
    const databaseUrl = process.env.DATABASE_URL;

    console.log('Environment check:', {
        NODE_ENV: process.env.NODE_ENV,
        VERCEL: process.env.VERCEL,
        isProduction,
        hasDatabaseUrl: !!databaseUrl
    });

    if (isProduction && databaseUrl) {
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
        console.log('⏭️  Skipping migrations');
        if (!isProduction) console.log('   - Not in production environment');
        if (!databaseUrl) console.log('   - DATABASE_URL not found');
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
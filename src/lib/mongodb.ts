import { MongoClient } from 'mongodb';

if (!process.env.MONGODB_URI) {
    throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
}

// Ensure the MongoDB URI is properly formatted
let uri = process.env.MONGODB_URI;
if (!uri.startsWith('mongodb://') && !uri.startsWith('mongodb+srv://')) {
    // Try to fix common formatting issues
    if (uri.includes('@') && !uri.startsWith('mongodb')) {
        uri = `mongodb://${uri}`;
    } else {
        throw new Error('Invalid MONGODB_URI format. Must start with mongodb:// or mongodb+srv://');
    }
}

// Add required query parameters if not present
if (!uri.includes('retryWrites=')) {
    uri += (uri.includes('?') ? '&' : '?') + 'retryWrites=true';
}
if (!uri.includes('w=')) {
    uri += '&w=majority';
}
if (!uri.includes('maxPoolSize=')) {
    uri += '&maxPoolSize=5';
}
if (!uri.includes('ssl=')) {
    uri += '&ssl=true';
}

const options = {
    maxPoolSize: 5,
    minPoolSize: 1,
    maxIdleTimeMS: 120000,
    connectTimeoutMS: 60000,
    serverSelectionTimeoutMS: 60000,
    socketTimeoutMS: 120000,
    waitQueueTimeoutMS: 60000,
    heartbeatFrequencyMS: 10000,
    retryWrites: true,
    retryReads: true,
    ssl: true,
    directConnection: false,
    family: 4
};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === 'development') {
    // In development mode, use a global variable so that the value
    // is preserved across module reloads caused by HMR (Hot Module Replacement).
    let globalWithMongo = global as typeof globalThis & {
        _mongoClientPromise?: Promise<MongoClient>;
    };

    if (!globalWithMongo._mongoClientPromise) {
        client = new MongoClient(uri, options);
        globalWithMongo._mongoClientPromise = client.connect()
            .catch(error => {
                console.error('Failed to connect to MongoDB:', error);
                throw error;
            });
    }
    clientPromise = globalWithMongo._mongoClientPromise;
} else {
    // In production mode, it's best to not use a global variable.
    client = new MongoClient(uri, options);
    clientPromise = client.connect()
        .catch(error => {
            console.error('Failed to connect to MongoDB:', error);
            throw error;
        });
}

// Export a module-scoped MongoClient promise. By doing this in a
// separate module, the client can be shared across functions.
export default clientPromise;

// Cached database connection with retry mechanism
export const connectToDatabase = async () => {
    let retries = 5; // Increased retries
    let lastError;
    let backoffDelay = 1000; // Start with 1 second delay

    while (retries > 0) {
        try {
            const client = await clientPromise;
            const dbName = process.env.MONGODB_DB || 'hire-a-clinic';
            const db = client.db(dbName);

            // Test the connection with a longer timeout
            await db.command({ ping: 1 }, { maxTimeMS: 30000 });
            console.log('Successfully connected to database:', dbName);

            return { client, db };
        } catch (error) {
            lastError = error;
            console.error(`Database connection attempt failed. Retries left: ${retries - 1}`, error);
            retries--;

            if (retries > 0) {
                // Exponential backoff with jitter
                const jitter = Math.floor(Math.random() * 1000);
                await new Promise(resolve => setTimeout(resolve, backoffDelay + jitter));
                backoffDelay *= 2; // Double the delay for next retry
            }
        }
    }

    console.error('All database connection attempts failed');
    throw lastError || new Error('Failed to establish database connection after multiple attempts');
};

import { MongoClient } from 'mongodb';

if (!process.env.MONGODB_URI) {
    throw new Error('Please add your Mongo URI to .env.local');
}

const uri = process.env.MONGODB_URI;
const options = {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    family: 4,
    retryWrites: true,
    retryReads: true,
    connectTimeoutMS: 10000,
};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

const MAX_RETRIES = 5;
const RETRY_DELAY = 1000; // 1 second

export async function connectToDatabase() {
    try {
        if (!client) {
            console.log('Creating new MongoDB client...');
            client = new MongoClient(uri, options);
        }

        // If we already have a connection promise, return it
        if (clientPromise) {
            const connectedClient = await clientPromise;
            // Test the connection
            await connectedClient.db().command({ ping: 1 });
            return { db: connectedClient.db(), client: connectedClient };
        }

        let retries = MAX_RETRIES;
        let lastError;

        while (retries > 0) {
            try {
                console.log(`Connecting to database... Retries left: ${retries}`);
                clientPromise = client.connect();
                const connectedClient = await clientPromise;

                // Test the connection
                await connectedClient.db().command({ ping: 1 });
                console.log('Successfully connected to database');

                return { db: connectedClient.db(), client: connectedClient };
            } catch (error) {
                lastError = error;
                console.error(`Database connection attempt failed. Retries left: ${retries}`, error);
                retries--;
                if (retries > 0) {
                    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                }
            }
        }

        throw lastError || new Error('Failed to connect to database after multiple retries');
    } catch (error) {
        console.error('Error connecting to database:', error);
        throw error;
    }
}

// Handle cleanup on app termination
process.on('SIGINT', async () => {
    try {
        if (client) {
            await client.close();
            console.log('MongoDB connection closed through app termination');
        }
    } catch (error) {
        console.error('Error closing MongoDB connection:', error);
    } finally {
        process.exit(0);
    }
});

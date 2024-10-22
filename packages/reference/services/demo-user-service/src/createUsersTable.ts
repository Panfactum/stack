import {pgClient} from "@/db";


export async function createUsersTable() {
  const createTableQuery = `
  DO $$ 
  BEGIN
      IF NOT EXISTS (
          SELECT FROM pg_tables 
          WHERE schemaname = 'public' 
          AND tablename = 'users'
      ) THEN
          CREATE TABLE users (
              id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
              username VARCHAR(255) NOT NULL UNIQUE,
              password VARCHAR(255) NOT NULL
          );
      END IF;
  END $$;
`;


  try {
    // Connect to the database and run the query
    await pgClient.query(createTableQuery);
    console.log('Table creation checked/completed successfully');
  } catch (error) {
    console.error('Error creating table:', error);
  }
}
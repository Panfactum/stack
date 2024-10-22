package com.example;

import static spark.Spark.*;

import org.jooq.*;
import org.jooq.impl.DSL;

import io.github.cdimascio.dotenv.Dotenv;

import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URL;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import spark.Request;
import spark.Response;
import com.google.gson.Gson;


public class TaskService {
    private static final Gson gson = new Gson();
    private static final Logger logger = LoggerFactory.getLogger(TaskService.class);

    private static DSLContext ctx;

    private static Dotenv dotenv;

    static {
        try {
            // Load the .env file
            dotenv = Dotenv.load();
        } catch (Exception e) {
            // Handle the case where the .env file is not found
            System.out.println("Warning: .env file not found. Defaulting to environment variables.");
            dotenv = Dotenv.configure().ignoreIfMissing().load(); // Load only existing variables
        }
    }

    private static DSLContext createContext() {
        try {
            String url = "jdbc:postgresql://" + dotenv.get("DB_HOST") + ":" + dotenv.get("DB_PORT") + "/" + dotenv.get("DB_NAME");
            Connection connection = DriverManager.getConnection(url, dotenv.get("DB_USER"), dotenv.get("DB_PASSWORD"));
            return DSL.using(connection, SQLDialect.POSTGRES);
        } catch (SQLException e) {
            throw new RuntimeException("Error connecting to the database", e);
        }
    }

    public static void main(String[] args) {
        String portEnv = dotenv.get("PORT");
        int port = (portEnv != null) ? Integer.parseInt(portEnv) : 4567;

        // Set the port for the Spark application
        port(port);

        System.out.println("Server is listening on port: " + port);

        // Health endpoint
        get("/health", (req, res) -> {
            res.status(200);
            return "OK";
        });

        // Create the Task table if it doesn't exist
        ctx = createContext();
        ctx.execute("CREATE SCHEMA IF NOT EXISTS " + dotenv.get("DB_SCHEMA"));
        ctx.execute("CREATE TABLE IF NOT EXISTS " + dotenv.get("DB_SCHEMA") + ".tasks (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL)");

        // Middleware to validate Bearer token
        before("/tasks", (req, res) -> {
            logger.info("Received request for /tasks");

            String authorization = req.headers("Authorization");
            if (authorization == null || !authorization.startsWith("Bearer ")) {
                halt(401, "Unauthorized Z");
            }

            boolean isValid = validateToken(authorization);

            if (!isValid) {
                halt(401, "Unauthorized F");
            }
            logger.info("middleware passed");
        });

        // Route to create a task
        post("/tasks", TaskService::createTask);
    }

    private static String createTask(Request req, Response res) {
        // Parse JSON body for task name
        TaskPayload payload = gson.fromJson(req.body(), TaskPayload.class);
        if (payload == null || payload.name == null || payload.name.isEmpty()) {
            res.status(400);
            return "Invalid task name";
        }

        ctx.insertInto(DSL.table(dotenv.get("DB_SCHEMA") + ".tasks"))
                .columns(DSL.field("name"))
                .values(payload.name)
                .execute();

        res.status(201); // Created
        return "Task '" + payload.name + "' created successfully";
    }

    private static boolean validateToken(String authHeader) {
        String tokenValidationUrl = dotenv.get("TOKEN_VALIDATION_URL");

        try {
            // Set up the HTTP connection
            URL url = new URL(tokenValidationUrl);
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod("GET");
            connection.setRequestProperty("Authorization", authHeader);
            connection.setConnectTimeout(5000); // Timeout after 5 seconds
            connection.setReadTimeout(5000);

            // Make the request and check the response code
            int responseCode = connection.getResponseCode();
            return responseCode == 200;
        } catch (IOException e) {
            System.err.println("Error validating token: " + e.getMessage());
            return false;
        }
    }

    private static class TaskPayload {
        String name;
    }
}

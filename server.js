// server.js - Debug Version with Better Error Handling
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config();

// Import our audit system
const { AuditAPI } = require("./website-analysis-agent");

const app = express();
const PORT = process.env.PORT || 3001;

// Global audit API instance
let auditAPI = null;

// Middleware
app.use(cors());
app.use(express.json());

console.log("🚀 Starting SiteLaunch Audit API Server...");

// Initialize audit system
async function initializeAuditSystem() {
  try {
    console.log("🔧 Creating AuditAPI instance...");
    auditAPI = new AuditAPI();

    console.log("🔧 Initializing audit system...");
    await auditAPI.initialize();

    console.log("✅ Audit system initialized successfully");
  } catch (error) {
    console.error("❌ Failed to initialize audit system:");
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    process.exit(1);
  }
}

// ROUTES
// Health check
app.get("/api/health", (req, res) => {
  console.log("🔍 Health check requested");
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    message: "SiteLaunch Audit API is running!",
    auditSystemReady: auditAPI ? true : false,
  });
});

// Test PageSpeed API directly
app.get("/api/test-pagespeed", async (req, res) => {
  console.log("🧪 Starting PageSpeed API test...");

  try {
    if (!auditAPI) {
      throw new Error("Audit system not initialized");
    }

    console.log("🧪 Testing with google.com...");
    const testUrl = "https://www.google.com";

    console.log("🧪 Calling auditWebsite...");
    const result = await auditAPI.auditWebsite(testUrl);

    console.log("✅ PageSpeed API test successful");
    res.json({
      status: "success",
      message: "PageSpeed API is working",
      testUrl: testUrl,
      score: result.summary?.overallScore || "unknown",
    });
  } catch (error) {
    console.error("❌ PageSpeed API test failed:");
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);

    res.status(500).json({
      status: "error",
      message: "PageSpeed API failed",
      error: error.message,
      errorName: error.name,
    });
  }
});

// Main audit endpoint with enhanced error handling
app.post("/api/audit/start", async (req, res) => {
  const startTime = Date.now();
  console.log("📊 === AUDIT REQUEST STARTED ===");

  try {
    console.log("📊 Request body:", JSON.stringify(req.body, null, 2));

    const { url, email } = req.body;

    if (!url) {
      console.log("❌ No URL provided");
      return res.status(400).json({
        error: "URL is required",
        example: { url: "https://example.com", email: "client@example.com" },
      });
    }

    if (!auditAPI) {
      console.log("❌ Audit system not initialized");
      return res.status(500).json({ error: "Audit system not initialized" });
    }

    console.log(`🔍 Starting audit for: ${url}`);
    console.log(`⏱️  Start time: ${new Date().toISOString()}`);

    // Set response timeout to 2 minutes
    req.setTimeout(120000, () => {
      console.log("⏰ Request timeout reached");
    });
    res.setTimeout(120000, () => {
      console.log("⏰ Response timeout reached");
    });

    console.log("🚀 Calling auditAPI.auditWebsite...");

    // Run the audit with detailed logging
    const report = await auditAPI.auditWebsite(url);

    console.log("✅ Audit completed successfully");

    const duration = Date.now() - startTime;
    console.log(`✅ Total audit duration: ${duration}ms`);

    // If email provided, log it
    if (email) {
      console.log(`📧 Would send report to: ${email}`);
    }

    console.log("📊 Sending response...");
    res.json({
      success: true,
      message: "Audit completed successfully",
      data: report,
      duration: duration,
    });

    console.log("📊 === AUDIT REQUEST COMPLETED ===");
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("❌ === AUDIT REQUEST FAILED ===");
    console.error(`❌ Failed after ${duration}ms`);
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);

    // Send error response if headers not already sent
    if (!res.headersSent) {
      res.status(500).json({
        error: error.message,
        errorName: error.name,
        duration: duration,
        timestamp: new Date().toISOString(),
      });
    }

    console.error("📊 === AUDIT REQUEST ERROR HANDLED ===");
  }
});

// Simple test endpoint
app.get("/api/simple-test", (req, res) => {
  console.log("🧪 Simple test endpoint called");
  res.json({
    message: "Simple test works!",
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use((req, res) => {
  console.log(`❌ 404 - Route not found: ${req.method} ${req.path}`);
  res.status(404).json({
    error: "Endpoint not found",
    requestedPath: req.path,
    availableEndpoints: [
      "GET /api/health",
      "GET /api/simple-test",
      "GET /api/test-pagespeed",
      "POST /api/audit/start",
    ],
  });
});

// Enhanced error handling
process.on("uncaughtException", (error) => {
  console.error("❌ === UNCAUGHT EXCEPTION ===");
  console.error("Error name:", error.name);
  console.error("Error message:", error.message);
  console.error("Error stack:", error.stack);
  console.error("=================================");
  process.exit(1);
});

process.on("unhandledRejection", (error) => {
  console.error("❌ === UNHANDLED REJECTION ===");
  console.error("Error name:", error.name);
  console.error("Error message:", error.message);
  console.error("Error stack:", error.stack);
  console.error("================================");
  process.exit(1);
});

// Graceful shutdown
async function gracefulShutdown() {
  console.log("📝 Graceful shutdown initiated...");
  if (auditAPI) {
    try {
      await auditAPI.cleanup();
      console.log("✅ Audit system cleaned up");
    } catch (error) {
      console.error("❌ Error during cleanup:", error);
    }
  }
  process.exit(0);
}

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

// Start server
async function startServer() {
  try {
    console.log("🔧 Initializing audit system...");
    await initializeAuditSystem();

    app.listen(PORT, () => {
      console.log(`✅ SiteLaunch Audit API Server running on port ${PORT}`);
      console.log(`📊 Test Endpoints:`);
      console.log(`   Health: http://localhost:${PORT}/api/health`);
      console.log(`   Simple: http://localhost:${PORT}/api/simple-test`);
      console.log(
        `   PageSpeed Test: http://localhost:${PORT}/api/test-pagespeed`
      );
      console.log(`🎯 Ready for debugging!`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:");
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    process.exit(1);
  }
}

startServer();

// server.js - Updated to use real audit agent
const express = require("express");
const cors = require("cors");

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
    auditAPI = new AuditAPI();
    await auditAPI.initialize();
    console.log("✅ Audit system initialized successfully");
  } catch (error) {
    console.error("❌ Failed to initialize audit system:", error);
    process.exit(1);
  }
}

// Test routes first
app.get("/api/health", (req, res) => {
  console.log("Health check requested");
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    message: "SiteLaunch Audit API is running!",
    auditSystemReady: auditAPI ? true : false,
  });
});

// Real audit endpoint
app.post("/api/audit/start", async (req, res) => {
  try {
    const { url, email } = req.body;

    // Validate input
    if (!url) {
      return res.status(400).json({
        error: "URL is required",
        example: { url: "https://example.com", email: "client@example.com" },
      });
    }

    console.log(`🔍 Starting audit for: ${url}`);
    // Add this to your server.js file for debugging

    // Test endpoint to check if PageSpeed API is working
    app.get("/api/test-pagespeed", async (req, res) => {
      try {
        console.log("🧪 Testing PageSpeed API directly...");

        // Simple test with a fast website
        const testUrl = "https://www.google.com";
        const result = await auditAPI.auditWebsite(testUrl);

        console.log("✅ PageSpeed API test successful");
        res.json({
          status: "success",
          message: "PageSpeed API is working",
          testUrl: testUrl,
          score: result.summary?.overallScore || "unknown",
        });
      } catch (error) {
        console.error("❌ PageSpeed API test failed:", error.message);
        res.json({
          status: "error",
          message: "PageSpeed API failed",
          error: error.message,
        });
      }
    });

    // Enhanced audit endpoint with more logging
    app.post("/api/audit/start", async (req, res) => {
      const startTime = Date.now();

      try {
        console.log("📊 Audit request received:", req.body);

        const { url, email } = req.body;

        if (!url) {
          return res.status(400).json({ error: "URL is required" });
        }

        console.log(`🔍 Starting audit for: ${url}`);
        console.log(`⏱️  Start time: ${new Date().toISOString()}`);

        // Set response timeout
        req.setTimeout(120000); // 2 minutes
        res.setTimeout(120000);

        const result = await auditAPI.auditWebsite(url);

        const duration = Date.now() - startTime;
        console.log(`✅ Audit completed in ${duration}ms`);

        res.json(result);
      } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`❌ Audit failed after ${duration}ms:`, error.message);

        res.status(500).json({
          error: error.message,
          duration: duration,
          timestamp: new Date().toISOString(),
        });
      }
    });
    // Start audit using our analysis agent
    const report = await auditAPI.auditWebsite(url);

    // If email provided, could send report via email here
    if (email) {
      console.log(`📧 Would send report to: ${email}`);
      // TODO: Implement email sending
    }

    res.json({
      success: true,
      message: "Audit completed successfully",
      data: report,
    });
  } catch (error) {
    console.error("Audit error:", error);
    res.status(500).json({
      error: "Audit failed",
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Batch audit multiple websites
app.post("/api/audit/batch", async (req, res) => {
  try {
    const { urls, email } = req.body;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({
        error: "URLs array is required",
        example: {
          urls: ["https://example1.com", "https://example2.com"],
          email: "client@example.com",
        },
      });
    }

    if (urls.length > 5) {
      return res.status(400).json({
        error: "Maximum 5 URLs per batch request",
      });
    }

    console.log(`🔍 Starting batch audit for ${urls.length} websites`);

    const results = [];
    for (const url of urls) {
      try {
        const report = await auditAPI.auditWebsite(url);
        results.push({ url, success: true, report });
      } catch (error) {
        results.push({ url, success: false, error: error.message });
      }
    }

    res.json({
      success: true,
      message: `Batch audit completed for ${urls.length} websites`,
      results,
    });
  } catch (error) {
    console.error("Batch audit error:", error);
    res.status(500).json({
      error: "Batch audit failed",
      message: error.message,
    });
  }
});

// Get Miami business suggestions (for prospecting)
app.get("/api/prospects/miami", (req, res) => {
  // Sample Miami business suggestions for testing
  const sampleProspects = [
    {
      business: "Miami Beach Restaurant",
      website: "https://example-miami-restaurant.com",
      category: "Restaurant",
      estimatedIssues: ["Slow mobile loading", "No mobile menu"],
    },
    {
      business: "Coral Gables Law Firm",
      website: "https://example-law-firm.com",
      category: "Legal Services",
      estimatedIssues: ["Poor mobile design", "Missing contact info"],
    },
    {
      business: "Downtown Miami Fitness",
      website: "https://example-fitness.com",
      category: "Fitness",
      estimatedIssues: ["No SSL certificate", "Slow desktop loading"],
    },
  ];

  res.json({
    success: true,
    prospects: sampleProspects,
    note: "These are sample prospects. Real implementation would scrape business directories.",
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "Endpoint not found",
    availableEndpoints: [
      "GET /api/health",
      "POST /api/audit/start",
      "POST /api/audit/batch",
      "GET /api/prospects/miami",
    ],
  });
});

// Handle server errors
process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (error) => {
  console.error("❌ Unhandled Rejection:", error);
  process.exit(1);
});

// Graceful shutdown
async function gracefulShutdown() {
  console.log("📝 Graceful shutdown initiated...");
  if (auditAPI) {
    await auditAPI.cleanup();
    console.log("✅ Audit system cleaned up");
  }
  process.exit(0);
}

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

// Start server
async function startServer() {
  try {
    await initializeAuditSystem();

    app.listen(PORT, () => {
      console.log(`✅ SiteLaunch Audit API Server running on port ${PORT}`);
      console.log(`📊 API Documentation:`);
      console.log(`   Health Check: http://localhost:${PORT}/api/health`);
      console.log(
        `   Single Audit: POST http://localhost:${PORT}/api/audit/start`
      );
      console.log(
        `   Batch Audit:  POST http://localhost:${PORT}/api/audit/batch`
      );
      console.log(
        `   Miami Prospects: http://localhost:${PORT}/api/prospects/miami`
      );
      console.log(`🎯 Ready to audit Miami businesses!`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();

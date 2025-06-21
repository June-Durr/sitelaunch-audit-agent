// website-analysis-agent.js - Fixed PageSpeed Insights Integration
// SiteLaunch Studios AI Agent using Google's PageSpeed Insights API

const https = require("https");

class PageSpeedAnalysisAgent {
  constructor() {
    this.initialized = false;
    // Google PageSpeed Insights API endpoint
    this.apiBase = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

    // You can get a free API key from Google Cloud Console
    this.apiKey = process.env.GOOGLE_PAGESPEED_API_KEY || null;
  }

  async initialize() {
    console.log("🔧 Initializing PageSpeed Insights Analysis Agent...");

    if (this.apiKey) {
      console.log("✅ Using Google API key for unlimited requests");
    } else {
      console.log("⚠️  No API key - using free tier (limited requests)");
      console.log(
        "💡 Get free API key: https://developers.google.com/speed/docs/insights/v5/get-started"
      );
    }

    this.initialized = true;
    console.log("✅ PageSpeed Insights Agent ready");
  }

  async analyzeWebsite(url) {
    console.log(`🔍 Starting PageSpeed analysis for: ${url}`);

    const analysis = {
      url,
      timestamp: new Date().toISOString(),
      mobile: {},
      desktop: {},
      technical: {},
      seo: {},
      score: 0,
    };

    try {
      // Run parallel PageSpeed analysis for mobile and desktop with timeout handling
      console.log("📱 Fetching mobile analysis...");

      const analysisPromises = [
        this.runPageSpeedAnalysis(url, "mobile").catch((error) => {
          console.warn("Mobile analysis failed:", error.message);
          return null;
        }),
        this.runPageSpeedAnalysis(url, "desktop").catch((error) => {
          console.warn("Desktop analysis failed:", error.message);
          return null;
        }),
      ];

      // Wait for both with overall timeout
      const [mobileResults, desktopResults] = await Promise.all(
        analysisPromises
      );

      // Check if we got any results
      if (!mobileResults && !desktopResults) {
        throw new Error(
          "Both mobile and desktop PageSpeed analysis failed. Google PageSpeed Insights may be experiencing issues."
        );
      }

      console.log("💻 Processing analysis results...");

      // Parse results safely - use available data
      analysis.mobile = mobileResults
        ? this.parseMobileResults(mobileResults)
        : this.getEmptyMobileResults();
      analysis.desktop = desktopResults
        ? this.parseDesktopResults(desktopResults)
        : this.getEmptyDesktopResults();
      analysis.technical = mobileResults
        ? this.parseTechnicalResults(mobileResults)
        : this.getEmptyTechnicalResults();
      analysis.seo = mobileResults
        ? this.parseSEOResults(mobileResults)
        : this.getEmptySEOResults();

      analysis.score = this.calculateOverallScore(analysis);

      // Add warning if partial results
      if (!mobileResults || !desktopResults) {
        analysis.warning =
          !mobileResults && !desktopResults
            ? "Unable to get PageSpeed data from Google. Please try again later."
            : `Partial results: ${
                !mobileResults ? "Mobile" : "Desktop"
              } analysis failed.`;
      }

      console.log(
        `✅ PageSpeed analysis complete for ${url} - Score: ${analysis.score}/100`
      );
      return analysis;
    } catch (error) {
      console.error(`❌ Error analyzing ${url}:`, error.message);

      // Return basic analysis with error info
      return {
        ...analysis,
        error: error.message,
        mobile: this.getEmptyMobileResults(),
        desktop: this.getEmptyDesktopResults(),
        technical: this.getEmptyTechnicalResults(),
        seo: this.getEmptySEOResults(),
        score: 0,
      };
    }
  }

  async runPageSpeedAnalysis(url, strategy = "mobile") {
    console.log(`📊 Running ${strategy} PageSpeed analysis...`);

    // Build API URL
    const params = new URLSearchParams({
      url: url,
      strategy: strategy,
      category: ["performance", "accessibility", "best-practices", "seo"].join(
        ","
      ),
      locale: "en",
    });

    if (this.apiKey) {
      params.append("key", this.apiKey);
    }

    const apiUrl = `${this.apiBase}?${params.toString()}`;

    return new Promise((resolve, reject) => {
      // Set shorter timeout - 45 seconds max
      const timeout = setTimeout(() => {
        request.destroy();
        reject(
          new Error(
            `PageSpeed API timeout after 45 seconds for ${strategy} analysis. Google's servers may be overloaded.`
          )
        );
      }, 45000);

      const request = https.get(apiUrl, (response) => {
        let data = "";

        response.on("data", (chunk) => {
          data += chunk;
        });

        response.on("end", () => {
          clearTimeout(timeout);
          try {
            if (response.statusCode === 200) {
              const result = JSON.parse(data);
              console.log(`✅ ${strategy} analysis completed successfully`);
              resolve(result);
            } else if (response.statusCode === 429) {
              // Rate limited
              reject(
                new Error(
                  `Google PageSpeed API rate limit reached. Please try again in a few minutes.`
                )
              );
            } else if (response.statusCode >= 500) {
              // Server error
              reject(
                new Error(
                  `Google PageSpeed servers are experiencing issues (${response.statusCode}). Please try again later.`
                )
              );
            } else {
              const error = JSON.parse(data);
              reject(
                new Error(
                  `PageSpeed API Error: ${
                    error.error?.message || `HTTP ${response.statusCode}`
                  }`
                )
              );
            }
          } catch (parseError) {
            reject(
              new Error(
                `Failed to parse PageSpeed response: ${parseError.message}`
              )
            );
          }
        });
      });

      request.on("error", (error) => {
        clearTimeout(timeout);
        if (error.code === "ENOTFOUND") {
          reject(
            new Error(
              "Network error: Unable to reach Google PageSpeed Insights. Check your internet connection."
            )
          );
        } else if (error.code === "ETIMEDOUT") {
          reject(
            new Error(
              "Network timeout: Google PageSpeed Insights is not responding. Please try again."
            )
          );
        } else {
          reject(new Error(`PageSpeed API request failed: ${error.message}`));
        }
      });

      request.on("timeout", () => {
        clearTimeout(timeout);
        request.destroy();
        reject(new Error("PageSpeed API request timed out"));
      });
    });
  }

  parseMobileResults(data) {
    try {
      const lighthouse = data.lighthouseResult || {};
      const audits = lighthouse.audits || {};
      const categories = lighthouse.categories || {};

      // Safely extract metrics
      const mobile = {
        performanceScore: this.safeScore(categories.performance),
        accessibilityScore: this.safeScore(categories.accessibility),

        // Core Web Vitals - safely extract
        firstContentfulPaint: this.safeNumericValue(
          audits["first-contentful-paint"]
        ),
        largestContentfulPaint: this.safeNumericValue(
          audits["largest-contentful-paint"]
        ),
        firstInputDelay: this.safeNumericValue(audits["max-potential-fid"]),
        cumulativeLayoutShift: this.safeNumericValue(
          audits["cumulative-layout-shift"]
        ),
        speedIndex: this.safeNumericValue(audits["speed-index"]),
        totalBlockingTime: this.safeNumericValue(audits["total-blocking-time"]),

        // Mobile usability analysis
        mobileUsability: this.analyzeMobileUsability(audits),
      };

      return mobile;
    } catch (error) {
      console.error("Error parsing mobile results:", error);
      return {
        performanceScore: 0,
        accessibilityScore: 0,
        mobileUsability: { score: 0, issues: ["Error parsing mobile data"] },
      };
    }
  }

  parseDesktopResults(data) {
    try {
      const lighthouse = data.lighthouseResult || {};
      const audits = lighthouse.audits || {};
      const categories = lighthouse.categories || {};

      const desktop = {
        performanceScore: this.safeScore(categories.performance),
        accessibilityScore: this.safeScore(categories.accessibility),

        // Core Web Vitals
        firstContentfulPaint: this.safeNumericValue(
          audits["first-contentful-paint"]
        ),
        largestContentfulPaint: this.safeNumericValue(
          audits["largest-contentful-paint"]
        ),
        cumulativeLayoutShift: this.safeNumericValue(
          audits["cumulative-layout-shift"]
        ),
        speedIndex: this.safeNumericValue(audits["speed-index"]),
        totalBlockingTime: this.safeNumericValue(audits["total-blocking-time"]),
      };

      return desktop;
    } catch (error) {
      console.error("Error parsing desktop results:", error);
      return {
        performanceScore: 0,
        accessibilityScore: 0,
      };
    }
  }

  parseTechnicalResults(data) {
    try {
      const lighthouse = data.lighthouseResult || {};
      const audits = lighthouse.audits || {};
      const categories = lighthouse.categories || {};
      const issues = [];

      // Check various technical aspects safely
      if (this.auditFailed(audits["is-on-https"])) {
        issues.push("Website not using HTTPS (no SSL certificate)");
      }

      if (this.auditFailed(audits["uses-optimized-images"])) {
        issues.push("Images not optimized for performance");
      }

      if (this.auditFailed(audits["uses-text-compression"])) {
        issues.push("Text compression not enabled");
      }

      if (this.auditFailed(audits["image-alt"])) {
        issues.push("Some images missing alt text");
      }

      if (this.auditFailed(audits["meta-description"])) {
        issues.push("Missing or poor meta description");
      }

      if (this.auditFailed(audits["document-title"])) {
        issues.push("Missing or poor page title");
      }

      return {
        issues: issues,
        hasSSL: this.auditPassed(audits["is-on-https"]),
        hasViewport: this.auditPassed(audits["viewport"]),
        bestPracticesScore: this.safeScore(categories["best-practices"]),
      };
    } catch (error) {
      console.error("Error parsing technical results:", error);
      return {
        issues: ["Error analyzing technical aspects"],
        hasSSL: false,
        hasViewport: false,
        bestPracticesScore: 0,
      };
    }
  }

  parseSEOResults(data) {
    try {
      const lighthouse = data.lighthouseResult || {};
      const audits = lighthouse.audits || {};
      const categories = lighthouse.categories || {};
      const issues = [];

      // SEO audits
      if (this.auditFailed(audits["document-title"])) {
        issues.push("Page title needs improvement");
      }

      if (this.auditFailed(audits["meta-description"])) {
        issues.push("Meta description missing or too short");
      }

      if (this.auditFailed(audits["link-text"])) {
        issues.push("Links need descriptive text");
      }

      if (this.auditFailed(audits["heading-order"])) {
        issues.push("Heading elements not in logical order");
      }

      // Check for local business keywords
      const hasLocalKeywords = this.checkForLocalKeywords(
        lighthouse.finalUrl || ""
      );

      return {
        issues: issues,
        seoScore: this.safeScore(categories.seo),
        hasLocalKeywords: hasLocalKeywords,
        recommendations: hasLocalKeywords
          ? []
          : ["Add Miami/South Florida keywords for better local SEO"],
      };
    } catch (error) {
      console.error("Error parsing SEO results:", error);
      return {
        issues: ["Error analyzing SEO aspects"],
        seoScore: 0,
        hasLocalKeywords: false,
        recommendations: ["Unable to analyze SEO - please try again"],
      };
    }
  }

  analyzeMobileUsability(audits) {
    try {
      const issues = [];
      let score = 100;

      // Check viewport configuration
      if (this.auditFailed(audits["viewport"])) {
        issues.push("Missing mobile viewport configuration");
        score -= 20;
      }

      // Check touch targets
      if (this.auditFailed(audits["tap-targets"])) {
        issues.push("Touch targets too small or too close together");
        score -= 20;
      }

      // Check font sizes
      if (this.auditFailed(audits["font-size"])) {
        issues.push("Text too small to read on mobile");
        score -= 15;
      }

      // Check for horizontal scrolling issues
      if (this.auditFailed(audits["content-width"])) {
        issues.push("Content wider than screen");
        score -= 15;
      }

      return {
        score: Math.max(0, score),
        issues: issues,
      };
    } catch (error) {
      console.error("Error analyzing mobile usability:", error);
      return {
        score: 0,
        issues: ["Error analyzing mobile usability"],
      };
    }
  }

  checkForLocalKeywords(url) {
    const miamiKeywords = ["miami", "florida", "fl", "south-florida", "dade"];
    const urlLower = (url || "").toLowerCase();
    return miamiKeywords.some((keyword) => urlLower.includes(keyword));
  }

  calculateOverallScore(analysis) {
    let score = 0;
    let maxScore = 0;

    // Mobile Performance (40% weight)
    if (
      analysis.mobile.performanceScore !== undefined &&
      analysis.mobile.performanceScore !== null
    ) {
      score += analysis.mobile.performanceScore * 0.4;
      maxScore += 40;
    }

    // Desktop Performance (20% weight)
    if (
      analysis.desktop.performanceScore !== undefined &&
      analysis.desktop.performanceScore !== null
    ) {
      score += analysis.desktop.performanceScore * 0.2;
      maxScore += 20;
    }

    // Mobile Usability (20% weight)
    if (
      analysis.mobile.mobileUsability &&
      analysis.mobile.mobileUsability.score !== undefined
    ) {
      score += analysis.mobile.mobileUsability.score * 0.2;
      maxScore += 20;
    }

    // SEO Score (10% weight)
    if (analysis.seo.seoScore !== undefined && analysis.seo.seoScore !== null) {
      score += analysis.seo.seoScore * 0.1;
      maxScore += 10;
    }

    // Technical/Best Practices (10% weight)
    if (
      analysis.technical.bestPracticesScore !== undefined &&
      analysis.technical.bestPracticesScore !== null
    ) {
      score += analysis.technical.bestPracticesScore * 0.1;
      maxScore += 10;
    }

    return Math.round(score);
  }

  generateAuditReport(analysis) {
    const report = {
      summary: {
        url: analysis.url,
        overallScore: analysis.score,
        grade: this.getGrade(analysis.score),
        timestamp: analysis.timestamp,
        poweredBy: "Google PageSpeed Insights",
      },
      criticalIssues: this.identifyCriticalIssues(analysis),
      recommendations: this.generateRecommendations(analysis),
      detailed: {
        mobile: analysis.mobile,
        desktop: analysis.desktop,
        technical: analysis.technical,
        seo: analysis.seo,
      },
    };

    return report;
  }

  getGrade(score) {
    if (score >= 90) return "A";
    if (score >= 80) return "B";
    if (score >= 70) return "C";
    if (score >= 60) return "D";
    return "F";
  }

  identifyCriticalIssues(analysis) {
    const critical = [];

    try {
      // Mobile performance issues
      if (
        analysis.mobile.performanceScore &&
        analysis.mobile.performanceScore < 70
      ) {
        critical.push({
          type: "Mobile Performance",
          severity: "High",
          issue: `Mobile speed score of ${analysis.mobile.performanceScore}/100 (Google PageSpeed Insights)`,
          impact:
            "Users likely abandoning site due to slow mobile loading - 68% of Miami traffic is mobile",
          googleMetric: true,
        });
      }

      // Core Web Vitals issues
      if (
        analysis.mobile.largestContentfulPaint &&
        analysis.mobile.largestContentfulPaint > 2500
      ) {
        critical.push({
          type: "Core Web Vitals",
          severity: "High",
          issue: `Largest Contentful Paint is ${(
            analysis.mobile.largestContentfulPaint / 1000
          ).toFixed(1)}s (should be < 2.5s)`,
          impact: "Google uses this metric for search rankings",
          googleMetric: true,
        });
      }

      // Mobile usability issues
      if (
        analysis.mobile.mobileUsability &&
        analysis.mobile.mobileUsability.issues &&
        analysis.mobile.mobileUsability.issues.length > 0
      ) {
        critical.push({
          type: "Mobile Usability",
          severity: "High",
          issue: analysis.mobile.mobileUsability.issues.join(", "),
          impact: "Google penalizes sites with poor mobile experience",
          googleMetric: true,
        });
      }

      // SEO issues for local businesses
      if (analysis.seo.seoScore && analysis.seo.seoScore < 80) {
        critical.push({
          type: "SEO Optimization",
          severity: "Medium",
          issue: `SEO score of ${analysis.seo.seoScore}/100 needs improvement`,
          impact:
            "Lower search rankings mean fewer customers finding your business",
          googleMetric: true,
        });
      }
    } catch (error) {
      console.error("Error identifying critical issues:", error);
    }

    return critical.slice(0, 3); // Top 3 most critical
  }

  generateRecommendations(analysis) {
    const recommendations = [];

    try {
      // Performance recommendations
      if (
        analysis.mobile.performanceScore &&
        analysis.mobile.performanceScore < 80
      ) {
        recommendations.push({
          priority: "High",
          category: "Performance",
          action:
            "Optimize images and enable compression to improve mobile performance",
          expectedImpact: "20-30% improvement in mobile load time",
          timeline: "1-2 weeks",
          source: "Google PageSpeed Insights",
        });
      }

      // Mobile usability recommendations
      if (
        analysis.mobile.mobileUsability &&
        analysis.mobile.mobileUsability.score < 90
      ) {
        recommendations.push({
          priority: "High",
          category: "Mobile Experience",
          action: "Fix mobile usability issues identified by Google",
          expectedImpact: "Better mobile experience for 68% of Miami visitors",
          timeline: "1-2 weeks",
          source: "Google PageSpeed Insights",
        });
      }

      // SEO recommendations for Miami businesses
      if (analysis.seo && !analysis.seo.hasLocalKeywords) {
        recommendations.push({
          priority: "Medium",
          category: "Local SEO",
          action:
            "Add Miami/South Florida keywords to improve local search rankings",
          expectedImpact: "Better visibility in local search results",
          timeline: "1 week",
          source: "SiteLaunch Studios SEO Analysis",
        });
      }

      // Technical recommendations
      if (
        analysis.technical &&
        analysis.technical.issues &&
        analysis.technical.issues.length > 0
      ) {
        recommendations.push({
          priority: "Medium",
          category: "Technical",
          action: "Fix technical issues identified by Google Lighthouse",
          expectedImpact: "Improved search engine rankings and user experience",
          timeline: "1-3 weeks",
          source: "Google PageSpeed Insights",
        });
      }
    } catch (error) {
      console.error("Error generating recommendations:", error);
    }

    return recommendations;
  }

  // Helper methods for safe data extraction
  safeScore(category) {
    return category && category.score !== null && category.score !== undefined
      ? Math.round(category.score * 100)
      : 0;
  }

  safeNumericValue(audit) {
    return audit &&
      audit.numericValue !== null &&
      audit.numericValue !== undefined
      ? audit.numericValue
      : null;
  }

  auditPassed(audit) {
    return audit && audit.score === 1;
  }

  auditFailed(audit) {
    return (
      audit &&
      audit.score !== null &&
      audit.score !== undefined &&
      audit.score < 1
    );
  }

  // Fallback methods for when PageSpeed API fails
  getEmptyMobileResults() {
    return {
      performanceScore: null,
      accessibilityScore: null,
      firstContentfulPaint: null,
      largestContentfulPaint: null,
      firstInputDelay: null,
      cumulativeLayoutShift: null,
      speedIndex: null,
      totalBlockingTime: null,
      mobileUsability: {
        score: 0,
        issues: [
          "Unable to analyze mobile usability - PageSpeed API unavailable",
        ],
      },
    };
  }

  getEmptyDesktopResults() {
    return {
      performanceScore: null,
      accessibilityScore: null,
      firstContentfulPaint: null,
      largestContentfulPaint: null,
      cumulativeLayoutShift: null,
      speedIndex: null,
      totalBlockingTime: null,
    };
  }

  getEmptyTechnicalResults() {
    return {
      issues: [
        "Unable to analyze technical aspects - PageSpeed API unavailable",
      ],
      hasSSL: null,
      hasViewport: null,
      bestPracticesScore: null,
    };
  }

  getEmptySEOResults() {
    return {
      issues: ["Unable to analyze SEO aspects - PageSpeed API unavailable"],
      seoScore: null,
      hasLocalKeywords: false,
      recommendations: [
        "Unable to provide SEO recommendations - please try again later",
      ],
    };
  }

  async cleanup() {
    console.log("🧹 Cleaning up PageSpeed Analysis Agent...");
    this.initialized = false;
  }
}

// API wrapper
class PageSpeedAuditAPI {
  constructor() {
    this.agent = new PageSpeedAnalysisAgent();
  }

  async initialize() {
    await this.agent.initialize();
  }

  async auditWebsite(url) {
    try {
      // Validate URL
      const validUrl = this.validateURL(url);

      // Run analysis
      const analysis = await this.agent.analyzeWebsite(validUrl);

      // Generate report
      const report = this.agent.generateAuditReport(analysis);

      console.log(`📊 PageSpeed audit completed for ${url}`);

      return report;
    } catch (error) {
      console.error("PageSpeed audit failed:", error);
      throw new Error(`PageSpeed audit failed: ${error.message}`);
    }
  }

  validateURL(url) {
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }

    try {
      new URL(url);
      return url;
    } catch {
      throw new Error("Invalid URL provided");
    }
  }

  async cleanup() {
    await this.agent.cleanup();
  }
}

// Export for use - keep same names for compatibility
module.exports = {
  PageSpeedAnalysisAgent,
  PageSpeedAuditAPI,
  // Keep the same export names for compatibility
  WebsiteAnalysisAgent: PageSpeedAnalysisAgent,
  AuditAPI: PageSpeedAuditAPI,
};

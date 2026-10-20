// src/middleware/apiKeyAuth.js
const apiKeyAuth = (req, res, next) => {
    const apiKey = req.headers["x-api-key"];
    const configuredKey = process.env.API_KEY;

    // Never let a production deployment run the evaluator-facing API with the
    // sample key or with authentication effectively unconfigured.
    if (process.env.NODE_ENV === "production"
        && (!configuredKey || ["change-me", "changeme", "your-api-key", "replace-me"].includes(configuredKey.trim().toLowerCase()))) {
        return res.status(503).json({
            error: "API authentication is not configured",
            code: "API_KEY_NOT_CONFIGURED",
            message: "The service operator must configure a non-placeholder API_KEY."
        });
    }

    if (!apiKey) {
        return res.status(401).json({
            error: "Missing API key",
            message: "Please provide an API key in the x-api-key header"
        });
    }

    if (apiKey !== configuredKey) {
        return res.status(403).json({
            error: "Invalid API key",
            message: "The provided API key is not valid"
        });
    }

    next();
};

module.exports = apiKeyAuth;

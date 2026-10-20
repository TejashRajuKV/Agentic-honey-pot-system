// src/routes/reports.js
const express = require('express');
// "Session … not found" is the caller's problem (404), everything else is ours (500)
const fail = (res, error) => {
    const notFound = /not found/i.test(String(error?.message || ''));
    return res.status(notFound ? 404 : 500).json({
        status: 'error',
        message: notFound ? 'Requested session or report was not found' : 'Unable to process report request'
    });
};

function validSessionId(value) {
    return typeof value === 'string' && value.trim().length > 0 && value.length <= 200
        && !value.includes('/') && !value.includes('\\') && !/[\\x00-\\x1f\\x7f]/.test(value);
}

function boundedLimit(value, fallback = 100, maximum = 500) {
    if (value === undefined || value === '') return fallback;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1) return null;
    return Math.min(parsed, maximum);
}

const router = express.Router();
const reportService = require('../services/reportService');
const path = require('path');

/**
 * @route POST /api/v1/reports/generate
 * @desc Generate a new report (PDF or JSON)
 */
router.post('/generate', async (req, res) => {
    try {
        const { sessionId, format = 'pdf' } = req.body || {};

        if (!validSessionId(sessionId)) {
            return res.status(400).json({ status: 'error', message: 'sessionId (string) required' });
        }

        if (format === 'pdf') {
            const result = await reportService.generatePDFReport(sessionId);
            res.json({ status: 'success', data: result, message: 'PDF report generated' });
        } else if (format === 'json') {
            const data = await reportService.generateJSONExport(sessionId);
            res.json({ status: 'success', data });
        } else {
            res.status(400).json({ status: 'error', message: 'Invalid format. Use "pdf" or "json"' });
        }
    } catch (error) {
        fail(res, error);
    }
});

/**
 * @route GET /api/v1/reports/:id/pdf
 * @desc Download PDF report
 */
router.get('/:sessionId/pdf', async (req, res) => {
    try {
        if (!validSessionId(req.params.sessionId)) return res.status(400).json({ status: 'error', message: 'Invalid sessionId' });
        const result = await reportService.generatePDFReport(req.params.sessionId);

        res.download(result.filepath, result.filename, (err) => {
            if (err) {
                console.error('Download error:', err);
                if (!res.headersSent) {
                    res.status(500).json({ status: 'error', message: 'Download failed' });
                }
            }
        });
    } catch (error) {
        fail(res, error);
    }
});

/**
 * @route GET /api/v1/reports/:id/json
 * @desc Get JSON export of session
 */
router.get('/:sessionId/json', async (req, res) => {
    try {
        if (!validSessionId(req.params.sessionId)) return res.status(400).json({ status: 'error', message: 'Invalid sessionId' });
        const data = await reportService.generateJSONExport(req.params.sessionId);

        const { download } = req.query;
        if (download === 'true') {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename=report_${req.params.sessionId}.json`);
            res.send(JSON.stringify(data, null, 2));
        } else {
            res.json({ status: 'success', data });
        }
    } catch (error) {
        fail(res, error);
    }
});

/**
 * @route GET /api/v1/reports/list
 * @desc Get list of all generated reports
 */
router.get('/list', async (req, res) => {
    try {
        const limit = boundedLimit(req.query.limit, 100, 500);
        if (limit === null) return res.status(400).json({ status: 'error', message: 'limit must be a positive integer' });
        const reports = (await reportService.listReports()).slice(0, limit);
        res.json({ status: 'success', data: reports, count: reports.length });
    } catch (error) {
        fail(res, error);
    }
});

/**
 * @route GET /api/v1/reports/:sessionId/timeline
 * @desc Get conversation timeline summary
 */
router.get('/:sessionId/timeline', async (req, res) => {
    try {
        if (!validSessionId(req.params.sessionId)) return res.status(400).json({ status: 'error', message: 'Invalid sessionId' });
        const ConversationTurn = require('../models/ConversationTurn');
        const turns = await ConversationTurn.find({ sessionId: req.params.sessionId })
            .sort({ timestamp: 1 }).limit(5000);

        const timeline = reportService.createTimelineSummary(turns);
        res.json({ status: 'success', data: timeline });
    } catch (error) {
        fail(res, error);
    }
});

module.exports = router;

// src/routes/reports.js
const express = require('express');
// "Session … not found" is the caller's problem (404), everything else is ours (500)
const fail = (res, error) =>
    res.status(/not found/i.test(error.message) ? 404 : 500).json({ status: 'error', message: error.message });

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

        if (typeof sessionId !== 'string' || !sessionId) {
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
        const reports = await reportService.listReports();
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
        const ConversationTurn = require('../models/ConversationTurn');
        const turns = await ConversationTurn.find({ sessionId: req.params.sessionId })
            .sort({ timestamp: 1 });

        const timeline = reportService.createTimelineSummary(turns);
        res.json({ status: 'success', data: timeline });
    } catch (error) {
        fail(res, error);
    }
});

module.exports = router;

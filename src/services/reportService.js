// src/services/reportService.js
const PDFDocument = require('pdfkit');
const Session = require('../models/Session');
const ConversationTurn = require('../models/ConversationTurn');
const ScammerProfile = require('../models/ScammerProfile');
const QualityMetrics = require('../models/QualityMetrics');
const intelligenceExtractor = require('../../detection/intelligenceExtractor');
const fs = require('fs');
const path = require('path');

/**
 * Report Generation Service
 * Creates PDF and JSON exports of scam sessions
 */
class ReportService {
    /**
     * Generate comprehensive PDF report
     */
    async generatePDFReport(sessionId) {
        const data = await this._compileAllData(sessionId);
        if (!data) {
            throw new Error(`Session ${sessionId} not found`);
        }

        // Create reports directory if it doesn't exist
        const reportsDir = path.join(__dirname, '../../reports');
        if (!fs.existsSync(reportsDir)) {
            fs.mkdirSync(reportsDir, { recursive: true });
        }

        const filename = `scam_report_${sessionId}_${Date.now()}.pdf`;
        const filepath = path.join(reportsDir, filename);

        const doc = new PDFDocument({ margin: 50 });
        const stream = fs.createWriteStream(filepath);
        doc.pipe(stream);

        // Title Page
        doc.fontSize(24).text('Scam Detection Report', { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).text(`Session ID: ${sessionId}`, { align: 'center' });
        doc.text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
        doc.moveDown(2);

        // Executive Summary
        doc.fontSize(18).text('Executive Summary', { underline: true });
        doc.moveDown();
        doc.fontSize(11);
        doc.text(this._createExecutiveSummary(data));
        doc.moveDown(2);

        // Risk Assessment
        doc.fontSize(18).text('Risk Assessment', { underline: true });
        doc.moveDown();
        doc.fontSize(11);
        doc.text(`Scam Detected: ${data.session.scamEverDetected ? 'YES' : 'NO'}`);
        doc.text(`Maximum Probability: ${data.session.maxScamProbability}%`);
        doc.text(`Risk Level: ${this._getRiskLevel(data.session.maxScamProbability)}`);
        doc.text(`Final Phase: ${data.session.highestPhase}`);
        doc.text(`Platform: ${data.session.platform || 'Unknown'}`);
        doc.moveDown();

        // Detected Patterns
        if (data.patterns.length > 0) {
            doc.fontSize(14).text('Detected Patterns:', { underline: true });
            doc.fontSize(10);
            data.patterns.forEach(pattern => {
                doc.text(`• ${pattern}`, { indent: 20 });
            });
            doc.moveDown();
        }

        // Intelligence Extracted
        doc.addPage();
        doc.fontSize(18).text('Extracted Intelligence', { underline: true });
        doc.moveDown();
        doc.fontSize(11);

        if (data.intelligence.upiIds.length > 0) {
            doc.text(`UPI IDs: ${data.intelligence.upiIds.join(', ')}`);
        }
        if (data.intelligence.phoneNumbers.length > 0) {
            doc.text(`Phone Numbers: ${data.intelligence.phoneNumbers.join(', ')}`);
        }
        if (data.intelligence.urls.length > 0) {
            doc.text(`URLs: ${data.intelligence.urls.join(', ')}`);
        }
        doc.moveDown();

        // Conversation Timeline
        doc.addPage();
        doc.fontSize(18).text('Conversation Timeline', { underline: true });
        doc.moveDown();

        for (let i = 0; i < data.turns.length; i++) {
            const turn = data.turns[i];
            const role = turn.role === 'user' ? 'Scammer' : 'Agent';

            doc.fontSize(10).fillColor('#333');
            doc.text(`[${i + 1}] ${role} (${new Date(turn.timestamp).toLocaleTimeString()}):`, {
                bold: true
            });
            doc.fontSize(9).fillColor('#666');
            doc.text(turn.text, { indent: 20 });

            if (turn.metadata) {
                doc.fontSize(8).fillColor('#999');
                doc.text(`  Risk: ${turn.metadata.scamProbability || 0}% | Phase: ${turn.metadata.phase || 'N/A'}`,
                    { indent: 20 });
            }

            doc.moveDown(0.5);

            // Page break if needed
            if (doc.y > 700) {
                doc.addPage();
            }
        }

        // Quality Metrics
        if (data.qualityMetrics.length > 0) {
            doc.addPage();
            doc.fontSize(18).fillColor('#000').text('Quality Metrics', { underline: true });
            doc.moveDown();
            doc.fontSize(11);

            const avgQuality = data.qualityMetrics.reduce((sum, m) => sum + m.scores.overall, 0) /
                data.qualityMetrics.length;

            doc.text(`Average Quality Score: ${(avgQuality * 100).toFixed(1)}%`);
            doc.text(`Total Responses Evaluated: ${data.qualityMetrics.length}`);
            doc.text(`Quality Flags: ${data.qualityMetrics.flatMap(m => m.flags).length}`);
            doc.moveDown();
        }

        // Scammer Profile (if available)
        if (data.profile) {
            doc.addPage();
            doc.fontSize(18).text('Scammer Profile', { underline: true });
            doc.moveDown();
            doc.fontSize(11);

            doc.text(`Profile ID: ${data.profile.profileId}`);
            doc.text(`Risk Score: ${data.profile.riskScore}/100`);
            doc.text(`Sophistication: ${data.profile.psychologicalProfile.sophistication}`);
            doc.text(`Primary Tactic: ${data.profile.psychologicalProfile.primaryTactic}`);
            doc.text(`Total Sessions: ${data.profile.sessions.length}`);
            doc.moveDown();

            if (data.profile.behavioralFingerprint.pressureTactics.length > 0) {
                doc.text('Pressure Tactics Used:');
                data.profile.behavioralFingerprint.pressureTactics.forEach(tactic => {
                    doc.text(`• ${tactic}`, { indent: 20 });
                });
            }
        }

        // Recommendations
        doc.addPage();
        doc.fontSize(18).text('Recommendations', { underline: true });
        doc.moveDown();
        doc.fontSize(11);
        doc.text(this._generateRecommendations(data));

        // Footer
        doc.fontSize(8).fillColor('#999');
        doc.text('This report was automatically generated by the Agentic Honey-Pot System v2.1', {
            align: 'center'
        });

        doc.end();

        return new Promise((resolve, reject) => {
            stream.on('finish', () => {
                resolve({
                    success: true,
                    filename,
                    filepath,
                    size: fs.statSync(filepath).size
                });
            });
            stream.on('error', reject);
        });
    }

    /**
     * Generate JSON export
     */
    async generateJSONExport(sessionId) {
        const data = await this._compileAllData(sessionId);
        if (!data) {
            throw new Error(`Session ${sessionId} not found`);
        }

        const exportData = {
            metadata: {
                sessionId,
                generatedAt: new Date().toISOString(),
                version: '2.1',
                format: 'json'
            },
            session: {
                id: data.session.sessionId,
                createdAt: data.session.createdAt,
                lastActiveAt: data.session.lastActiveAt,
                platform: data.session.platform,
                status: data.session.status
            },
            riskAssessment: {
                scamDetected: data.session.scamEverDetected,
                maxProbability: data.session.maxScamProbability,
                riskLevel: this._getRiskLevel(data.session.maxScamProbability),
                finalPhase: data.session.highestPhase,
                responseMode: data.session.responseMode
            },
            patterns: data.patterns,
            intelligence: data.intelligence,
            conversation: data.turns.map(t => ({
                role: t.role,
                text: t.text,
                timestamp: t.timestamp,
                metadata: t.metadata
            })),
            qualityMetrics: data.qualityMetrics.map(m => ({
                turnNumber: m.turnNumber,
                scores: m.scores,
                flags: m.flags
            })),
            profile: data.profile ? {
                id: data.profile.profileId,
                riskScore: data.profile.riskScore,
                psychological: data.profile.psychologicalProfile,
                behavioral: {
                    tactics: data.profile.behavioralFingerprint.pressureTactics,
                    velocity: data.profile.behavioralFingerprint.pressureVelocity
                }
            } : null,
            summary: this._createExecutiveSummary(data)
        };

        return exportData;
    }

    /**
     * Create executive summary
     */
    _createExecutiveSummary(data) {
        const { session, turns, intelligence, profile } = data;

        let summary = `This session was ${session.status} on ${new Date(session.createdAt).toLocaleDateString()}. `;

        if (session.scamEverDetected) {
            summary += `A scam was detected with ${session.maxScamProbability}% confidence. `;
        } else {
            summary += `No scam was detected. `;
        }

        summary += `The conversation lasted ${turns.length} turns and reached the ${session.highestPhase} phase. `;

        if (intelligence.upiIds.length > 0 || intelligence.phoneNumbers.length > 0) {
            summary += `Intelligence was extracted including `;
            const items = [];
            if (intelligence.upiIds.length > 0) items.push(`${intelligence.upiIds.length} UPI ID(s)`);
            if (intelligence.phoneNumbers.length > 0) items.push(`${intelligence.phoneNumbers.length} phone number(s)`);
            if (intelligence.urls.length > 0) items.push(`${intelligence.urls.length} URL(s)`);
            summary += items.join(', ') + '. ';
        }

        if (profile) {
            summary += `The scammer has been profiled with a risk score of ${profile.riskScore}/100 `;
            summary += `and classified as using ${profile.psychologicalProfile.primaryTactic} tactics `;
            summary += `with ${profile.psychologicalProfile.sophistication} sophistication. `;
        }

        return summary;
    }

    /**
     * Compile all data for reporting
     */
    async _compileAllData(sessionId) {
        const session = await Session.findOne({ sessionId });
        if (!session) return null;

        const turns = await ConversationTurn.find({ sessionId }).sort({ timestamp: 1 });
        const qualityMetrics = await QualityMetrics.find({ sessionId }).sort({ turnNumber: 1 });

        // Extract intelligence
        const intelligence = {
            upiIds: [],
            phoneNumbers: [],
            urls: []
        };

        const patterns = new Set();

        for (const turn of turns) {
            if (turn.role === 'user') {
                const intel = intelligenceExtractor.extractAll(turn.text);
                intelligence.upiIds.push(...intel.upiIds);
                intelligence.phoneNumbers.push(...intel.phoneNumbers);
                intelligence.urls.push(...intel.urls);
            }

            if (turn.metadata?.detectedPatterns) {
                turn.metadata.detectedPatterns.forEach(p => patterns.add(p));
            }
        }

        // Deduplicate
        intelligence.upiIds = [...new Set(intelligence.upiIds)];
        intelligence.phoneNumbers = [...new Set(intelligence.phoneNumbers)];
        intelligence.urls = [...new Set(intelligence.urls)];

        // Try to find associated profile
        let profile = null;
        if (intelligence.upiIds.length > 0 || intelligence.phoneNumbers.length > 0) {
            profile = await ScammerProfile.findOne({
                $or: [
                    { 'identifiers.upiIds': { $in: intelligence.upiIds } },
                    { 'identifiers.phoneNumbers': { $in: intelligence.phoneNumbers } }
                ]
            });
        }

        return {
            session,
            turns,
            qualityMetrics,
            intelligence,
            patterns: Array.from(patterns),
            profile
        };
    }

    /**
     * Get risk level label
     */
    _getRiskLevel(probability) {
        if (probability >= 80) return 'CRITICAL';
        if (probability >= 60) return 'HIGH';
        if (probability >= 40) return 'MEDIUM';
        if (probability >= 20) return 'LOW';
        return 'SAFE';
    }

    /**
     * Generate recommendations
     */
    _generateRecommendations(data) {
        const recommendations = [];

        if (data.session.scamEverDetected) {
            recommendations.push('• Block and report the sender immediately');
            recommendations.push('• Do not engage further with this contact');
        }

        if (data.intelligence.upiIds.length > 0) {
            recommendations.push('• Report extracted UPI IDs to payment platforms');
        }

        if (data.intelligence.phoneNumbers.length > 0) {
            recommendations.push('• Report phone numbers to telecom authorities');
        }

        if (data.intelligence.urls.length > 0) {
            recommendations.push('• Report malicious URLs to cybersecurity agencies');
        }

        if (data.profile && data.profile.riskScore >= 80) {
            recommendations.push('• This is a known high-risk scammer - add to blacklist');
        }

        if (recommendations.length === 0) {
            recommendations.push('• Continue monitoring for suspicious activity');
        }

        return recommendations.join('\n');
    }

    /**
     * Create conversation timeline summary
     */
    createTimelineSummary(turns) {
        return turns.map((turn, index) => ({
            turn: index + 1,
            timestamp: turn.timestamp,
            role: turn.role === 'user' ? 'Scammer' : 'Agent',
            preview: turn.text.substring(0, 100) + (turn.text.length > 100 ? '...' : ''),
            risk: turn.metadata?.scamProbability || 0,
            phase: turn.metadata?.phase || 'N/A'
        }));
    }

    /**
     * Get list of all reports
     */
    async listReports() {
        const reportsDir = path.join(__dirname, '../../reports');

        if (!fs.existsSync(reportsDir)) {
            return [];
        }

        const files = fs.readdirSync(reportsDir).filter(f => f.endsWith('.pdf'));

        return files.map(filename => {
            const filepath = path.join(reportsDir, filename);
            const stats = fs.statSync(filepath);

            return {
                filename,
                filepath,
                size: stats.size,
                created: stats.birthtime,
                sessionId: filename.match(/scam_report_(.+?)_\d+\.pdf/)?.[1] || 'unknown'
            };
        }).sort((a, b) => b.created - a.created);
    }
}

module.exports = new ReportService();

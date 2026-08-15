/**
 * File responsibility: PDF export renderer.
 * Main responsibilities:
 * - Render report data into a polished A4 PDF template.
 * - Keep jsPDF drawing details out of API and React component layers.
 * - Reuse the report view model so exported reports align with the on-screen report data.
 */

import jsPdfModule from 'jspdf';
import { buildReportViewModel } from '../reportView/index.js';

const JsPDF = jsPdfModule.jsPDF || jsPdfModule;

const PAGE = {
  width: 210,
  height: 297,
  margin: 15,
  bottom: 276,
};

const COLOR = {
  ink: [18, 44, 33],
  muted: [90, 109, 99],
  faint: [139, 151, 144],
  line: [219, 229, 224],
  soft: [247, 250, 248],
  brand: [12, 115, 83],
  blue: [33, 104, 169],
  amber: [169, 101, 20],
  rose: [174, 50, 70],
  white: [255, 255, 255],
};

const CONTENT_WIDTH = PAGE.width - PAGE.margin * 2;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const asText = (value, fallback = '') => {
  if (value === null || value === undefined) return fallback;
  return String(value).trim() || fallback;
};

const formatNumber = (value, digits = 2) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(digits) : '-';
};

const titleCase = (value = '') => String(value || '')
  .replace(/_/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .replace(/\b\w/g, (match) => match.toUpperCase());

const friendlyStatus = (status = '') => {
  const normalized = String(status || '').toLowerCase();
  if (!normalized) return 'Ready for review';
  if (['ready', 'passed', 'complete', 'completed'].includes(normalized)) return 'Ready';
  if (normalized.includes('repair') || normalized.includes('failed')) return 'Needs review';
  if (normalized.includes('insufficient')) return 'Insufficient evidence';
  if (normalized.includes('review')) return 'Needs review';
  return titleCase(status);
};

const friendlyEvidenceLabel = (value = '') => {
  const normalized = String(value || '').toLowerCase();
  if (!normalized) return '';
  if (normalized.includes('answer') || normalized.includes('transcript')) return 'Interview answer';
  if (normalized.includes('cv')) return 'CV evidence';
  if (normalized.includes('jd')) return 'Job requirement';
  if (normalized.includes('match')) return 'Role match evidence';
  if (normalized.includes('question')) return 'Interview plan evidence';
  return titleCase(value);
};

const formatPublishedMetric = (value, suffix, prefix = '') => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? `${prefix}${value}${suffix}` : null;
};

const formatFrameworkMetrics = (value = {}) => {
  if (!Number.isFinite(value.level) || !Number.isFinite(value.scorePercent)) return null;
  return [
    formatPublishedMetric(value.level, '/5', 'Level '),
    formatPublishedMetric(value.scorePercent, '/100'),
  ].join(', ');
};

const hasInterviewPerformance = (value) => {
  const normalized = typeof value === 'string' ? value.trim() : value;
  return (typeof normalized === 'number' || typeof normalized === 'string')
    && normalized !== ''
    && Number.isFinite(Number(normalized));
};

const scoreRows = (report = {}) => {
  const overall = report.scores?.overall;
  if (!hasInterviewPerformance(overall)) return [];
  return [{
    label: 'Interview performance',
    value: Number(overall),
    detail: 'Answer quality signal',
    color: COLOR.brand,
  }];
};

class PdfLayout {
  constructor(pdf) {
    this.pdf = pdf;
    this.y = PAGE.margin;
    this.pageNumber = 1;
  }

  setColor(color) {
    this.pdf.setTextColor(...color);
  }

  setFill(color) {
    this.pdf.setFillColor(...color);
  }

  setStroke(color) {
    this.pdf.setDrawColor(...color);
  }

  font(size, style = 'normal', color = COLOR.ink) {
    this.pdf.setFont('helvetica', style);
    this.pdf.setFontSize(size);
    this.setColor(color);
  }

  rect(x, y, width, height, { fill = COLOR.white, stroke = COLOR.line, radius = 3 } = {}) {
    this.setFill(fill);
    this.setStroke(stroke);
    this.pdf.setLineWidth(0.25);
    if (typeof this.pdf.roundedRect === 'function') {
      this.pdf.roundedRect(x, y, width, height, radius, radius, 'FD');
      return;
    }
    this.pdf.rect(x, y, width, height, 'FD');
  }

  line(x1, y1, x2, y2, color = COLOR.line) {
    this.setStroke(color);
    this.pdf.setLineWidth(0.25);
    this.pdf.line(x1, y1, x2, y2);
  }

  addFooter() {
    this.font(7.5, 'normal', COLOR.faint);
    this.line(PAGE.margin, 283, PAGE.width - PAGE.margin, 283);
    this.pdf.text('Kiwi AI Interview Report', PAGE.margin, 288);
    this.pdf.text(`Page ${this.pageNumber}`, PAGE.width - PAGE.margin - 14, 288);
  }

  addPage() {
    this.addFooter();
    this.pdf.addPage();
    this.pageNumber += 1;
    this.y = PAGE.margin;
    this.font(8, 'bold', COLOR.brand);
    this.pdf.text('KIWI AI', PAGE.margin, this.y);
    this.font(8, 'normal', COLOR.faint);
    this.pdf.text('Interview coaching report', PAGE.margin + 22, this.y);
    this.y += 9;
  }

  ensureSpace(height) {
    if (this.y + height <= PAGE.bottom) return;
    this.addPage();
  }

  text(value, x, y, maxWidth, { size = 10, style = 'normal', color = COLOR.ink, lineHeight = 5 } = {}) {
    this.font(size, style, color);
    const lines = this.pdf.splitTextToSize(asText(value), maxWidth);
    lines.forEach((line) => {
      if (this.y > PAGE.bottom) this.addPage();
      this.pdf.text(line, x, y);
      y += lineHeight;
      this.y = Math.max(this.y, y);
    });
    return y;
  }

  paragraph(value, { x = PAGE.margin, width = CONTENT_WIDTH, size = 9.5, color = COLOR.muted, lineHeight = 5 } = {}) {
    const lines = this.pdf.splitTextToSize(asText(value), width);
    this.ensureSpace(lines.length * lineHeight + 1);
    this.font(size, 'normal', color);
    lines.forEach((line) => {
      this.pdf.text(line, x, this.y);
      this.y += lineHeight;
    });
    return this.y;
  }

  label(label, value, { x = PAGE.margin, width = CONTENT_WIDTH } = {}) {
    if (!asText(value)) return;
    this.ensureSpace(8);
    this.font(7.5, 'bold', COLOR.faint);
    this.pdf.text(String(label).toUpperCase(), x, this.y);
    this.font(9.5, 'normal', COLOR.ink);
    this.pdf.text(asText(value), x + width * 0.32, this.y);
    this.y += 6;
  }

  sectionTitle(title, subtitle = '') {
    this.ensureSpace(subtitle ? 36 : 28);
    this.y += 4;
    this.font(13, 'bold', COLOR.ink);
    this.pdf.text(title, PAGE.margin, this.y);
    this.y += 3;
    this.line(PAGE.margin, this.y, PAGE.width - PAGE.margin, this.y, COLOR.brand);
    this.y += 6;
    if (subtitle) {
      this.paragraph(subtitle, { size: 8.5, color: COLOR.faint, lineHeight: 4.5 });
      this.y += 2;
    }
  }
}

const drawPill = (layout, text, x, y, width, color = COLOR.brand) => {
  layout.rect(x, y, width, 8, { fill: COLOR.soft, stroke: COLOR.line, radius: 2 });
  layout.font(7.5, 'bold', color);
  layout.pdf.text(asText(text), x + 3, y + 5.2);
};

const drawScoreCard = (layout, item, x, y, width) => {
  const safeScore = clamp(Number(item.value || 0), 0, 100);
  layout.rect(x, y, width, 37, { fill: COLOR.white, stroke: COLOR.line, radius: 3 });
  layout.font(7.5, 'bold', item.color);
  layout.pdf.text(item.label.toUpperCase(), x + 5, y + 8);
  layout.font(22, 'bold', COLOR.ink);
  layout.pdf.text(formatNumber(safeScore), x + 5, y + 20);
  layout.font(8, 'normal', COLOR.faint);
  layout.pdf.text('/100', x + 32, y + 20);
  layout.font(8, 'normal', COLOR.muted);
  const detailLines = layout.pdf.splitTextToSize(item.detail, width - 10).slice(0, 2);
  detailLines.forEach((line, index) => {
    layout.pdf.text(line, x + 5, y + 25 + index * 4);
  });

  const barY = y + 30;
  layout.setFill([235, 241, 238]);
  layout.pdf.rect(x + 5, barY, width - 10, 2.4, 'F');
  layout.setFill(item.color);
  layout.pdf.rect(x + 5, barY, (width - 10) * (safeScore / 100), 2.4, 'F');
};

const drawCallout = (layout, title, body, color = COLOR.brand) => {
  const innerWidth = CONTENT_WIDTH - 24;
  layout.font(8.4, 'normal', COLOR.ink);
  const lines = layout.pdf.splitTextToSize(asText(body), innerWidth);
  const height = Math.max(22, 12 + lines.length * 4.4);
  layout.ensureSpace(height + 4);
  const startY = layout.y;
  layout.rect(PAGE.margin, startY, CONTENT_WIDTH, height, { fill: COLOR.soft, stroke: color, radius: 3 });
  layout.font(7.5, 'bold', color);
  layout.pdf.text(title.toUpperCase(), PAGE.margin + 5, startY + 7);
  layout.y = startY + 13;
  layout.paragraph(body, { x: PAGE.margin + 5, width: innerWidth, size: 8.4, color: COLOR.ink, lineHeight: 4.4 });
  layout.y = startY + height + 5;
};

const drawItemCard = (layout, title, body, { meta = '', action = '', color = COLOR.brand } = {}) => {
  const innerWidth = CONTENT_WIDTH - 12;
  layout.font(10, 'bold', COLOR.ink);
  const titleLines = layout.pdf.splitTextToSize(asText(title, 'Untitled'), innerWidth);
  layout.font(8.8, 'normal', COLOR.muted);
  const bodyLines = body ? layout.pdf.splitTextToSize(asText(body), innerWidth) : [];
  layout.font(8.6, 'normal', COLOR.ink);
  const actionLines = action ? layout.pdf.splitTextToSize(asText(action), CONTENT_WIDTH - 28) : [];
  const contentHeight = titleLines.length * 4.8
    + (bodyLines.length ? 2 + bodyLines.length * 4.6 : 0)
    + (action ? 1.5 + actionLines.length * 4.6 : 0)
    + (meta ? 5 + 4 : 0);
  const height = Math.max(24, 8 + contentHeight + 7);
  layout.ensureSpace(height + 4);
  const startY = layout.y;
  layout.rect(PAGE.margin, startY, CONTENT_WIDTH, height, { fill: COLOR.white, stroke: COLOR.line, radius: 3 });

  let cursorY = startY + 8;
  layout.font(10, 'bold', COLOR.ink);
  titleLines.forEach((line) => {
    layout.pdf.text(line, PAGE.margin + 5, cursorY);
    cursorY += 4.8;
  });

  if (bodyLines.length) {
    cursorY += 2;
    layout.font(8.8, 'normal', COLOR.muted);
    bodyLines.forEach((line) => {
      layout.pdf.text(line, PAGE.margin + 5, cursorY);
      cursorY += 4.6;
    });
  }

  if (action) {
    cursorY += 1.5;
    layout.font(8.5, 'bold', color);
    layout.pdf.text('Next step:', PAGE.margin + 5, cursorY);
    layout.font(8.5, 'normal', COLOR.ink);
    actionLines.forEach((line, index) => {
      layout.pdf.text(line, PAGE.margin + 22, cursorY + index * 4.6);
    });
    cursorY += actionLines.length * 4.6;
  }

  if (meta) {
    cursorY += 5;
    layout.font(7.5, 'normal', COLOR.faint);
    layout.pdf.text(meta, PAGE.margin + 5, cursorY);
  }
  layout.y = startY + height + 4;
};

const drawCover = (layout, reportData, vm) => {
  const report = vm.report || {};
  const generated = report.generatedAt ? new Date(report.generatedAt).toLocaleString() : new Date().toLocaleString();
  const status = friendlyStatus(reportData?.latestStatus || report.latestStatus);

  layout.rect(0, 0, PAGE.width, 54, { fill: [235, 246, 240], stroke: [235, 246, 240], radius: 0 });
  layout.font(8, 'bold', COLOR.brand);
  layout.pdf.text('KIWI AI', PAGE.margin, 18);
  layout.font(24, 'bold', COLOR.ink);
  layout.pdf.text('Interview Report', PAGE.margin, 32);
  layout.font(9, 'normal', COLOR.muted);
  layout.pdf.text('Personalised coaching summary and evidence review', PAGE.margin, 40);
  drawPill(layout, status, 150, 17, 43, status === 'Ready' ? COLOR.brand : COLOR.amber);

  layout.y = 67;
  layout.label('Candidate', report.candidateName || reportData?.candidateName || 'Candidate');
  layout.label('Target role', report.jobTitle || reportData?.targetRole || 'Target role not specified');
  layout.label('Generated', generated);
  layout.y += 6;
  drawCallout(layout, 'Overall feedback', vm.takeaway || report.summary || 'No summary available.', COLOR.brand);

  const cards = scoreRows(report);
  if (cards.length) {
    layout.ensureSpace(44);
    const cardY = layout.y;
    drawScoreCard(layout, cards[0], PAGE.margin, cardY, CONTENT_WIDTH);
    layout.y = cardY + 44;
  }

  const firstPriority = vm.improvementPriorities?.[0] || {};
  if (firstPriority.title || firstPriority.action || firstPriority.actionStep) {
    drawCallout(
      layout,
      'Recommended next focus',
      `${firstPriority.title || 'Improve the weakest evidence gap first'}${firstPriority.action || firstPriority.actionStep ? ` - ${firstPriority.action || firstPriority.actionStep}` : ''}`,
      COLOR.amber
    );
  }
};

const drawInsights = (layout, vm) => {
  const explanations = hasInterviewPerformance(vm.report?.scores?.overall)
    ? Object.entries(vm.scoreExplanations || {})
      .filter(([key, value]) => key === 'overall' && value?.explanation)
    : [];
  const insights = (vm.dataInsights || []).slice(0, 3);
  if (!explanations.length && !insights.length) return;

  layout.sectionTitle('Interview Insights', 'A concise view of your interview answer quality and supporting evidence.');
  explanations.forEach(([, value]) => {
    drawItemCard(
      layout,
      'Interview performance',
      value.explanation,
      { color: COLOR.blue },
    );
  });
  insights.forEach((insight) => {
    drawItemCard(
      layout,
      insight.title || insight.label || 'Insight',
      insight.description || insight.interpretation || insight.summary || '',
      { meta: insight.metric || insight.displayValue || String(insight.value ?? '') }
    );
  });
};

const drawCoaching = (layout, vm) => {
  const priorities = vm.improvementPriorities || [];
  if (!priorities.length) return;

  layout.sectionTitle('Priority Improvements');
  priorities.slice(0, 3).forEach((item) => {
    drawItemCard(
      layout,
      item.title || item.label || 'Improvement',
      item.whyItMatters || item.reason || item.detail || item.description || '',
      {
        action: item.action || item.actionStep || item.example || '',
        meta: [friendlyEvidenceLabel(item.evidenceLabel), item.confidenceLevel ? `${item.confidenceLevel} confidence` : ''].filter(Boolean).join(' - '),
        color: COLOR.blue,
      }
    );
  });
};

const drawReportLimitations = (layout, vm) => {
  if (vm.legacyReportNotice) {
    layout.sectionTitle('Report Limitation');
    drawCallout(layout, 'Legacy report', vm.legacyReportNotice, COLOR.amber);
  }
  const risks = Array.isArray(vm.transcriptRisks) ? vm.transcriptRisks.slice(0, 3) : [];
  if (!risks.length) return;
  layout.sectionTitle('Transcript Risks');
  risks.forEach((risk) => {
    drawItemCard(
      layout,
      risk.title || risk.label || 'Transcript risk',
      risk.message || risk.description || risk.reason || risk.summary || asText(risk),
      { color: COLOR.amber },
    );
  });
};

export const buildTurnFrameworkMeta = (turn = {}) => {
  const parts = [];
  const dimensions = Array.isArray(turn.frameworkBreakdown?.dimensions)
    ? turn.frameworkBreakdown.dimensions.filter((dimension) => dimension.status !== 'not_applicable')
    : [];
  const hasStarr = Boolean(turn.starrBreakdown || turn.starBreakdown);
  const frameworkLabel = turn.frameworkLabel || 'Role-specific framework';

  if (dimensions.length) {
    const frameworkMetrics = formatFrameworkMetrics(turn.frameworkBreakdown);
    const frameworkSummary = `${frameworkLabel}${frameworkMetrics ? ` ${frameworkMetrics}` : ''}`;
    const dimensionSummaries = dimensions
      .map((dimension) => `${dimension.label} ${formatFrameworkMetrics(dimension) || 'Level unavailable'}${dimension.reason ? `: ${dimension.reason}` : ''}`);
    parts.push(frameworkSummary, ...dimensionSummaries);
  } else if (!hasStarr) {
    parts.push(`${frameworkLabel} unavailable`);
  }

  if (turn.durationAssessment?.eligible) {
    parts.push(`Duration ${formatPublishedMetric(turn.durationAssessment.level, '/5', 'Level ') || 'Level unavailable'}`);
  }

  return parts.join(' | ');
};

const drawTurnBreakdowns = (layout, turns = []) => {
  if (!turns.length) return;
  layout.ensureSpace(74);
  layout.sectionTitle('Turn-by-Turn Feedback', 'Detailed feedback for the scored answers.');
  turns.forEach((turn, index) => {
    const scores = buildTurnFrameworkMeta(turn);
    const title = `Q${index + 1}: ${asText(turn.question, 'Interview question')}`;
    drawItemCard(layout, title, turn.answer || turn.answerSummary || '', {
      action: turn.feedback || '',
      meta: scores,
      color: COLOR.blue,
    });
  });
};

const drawAnswerRewrites = (layout, rewrites = []) => {
  if (!rewrites.length) return;
  layout.ensureSpace(58);
  layout.sectionTitle('How To Answer Better');
  rewrites.slice(0, 5).forEach((item) => {
    drawItemCard(layout, 'Weaker version', item.weak || item.before || '', { color: COLOR.rose });
    if (item.status === 'unavailable' || !item.better) {
      drawItemCard(layout, 'Rewrite unavailable', item.failureReason || 'A grounded stronger answer could not be generated reliably.', { color: COLOR.amber });
    } else {
      drawItemCard(layout, 'Stronger version', item.better || item.after || item.rewrite || '', { color: COLOR.brand });
    }
  });
};

export const generateReportPDF = async (reportData) => {
  try {
    const vm = buildReportViewModel(reportData);
    const pdf = new JsPDF('p', 'mm', 'a4');
    const layout = new PdfLayout(pdf);

    drawCover(layout, reportData, vm);
    drawInsights(layout, vm);
    drawReportLimitations(layout, vm);
    drawCoaching(layout, vm);
    drawTurnBreakdowns(layout, vm.turnBreakdowns);
    drawAnswerRewrites(layout, vm.answerRewriteTips);

    layout.addFooter();
    pdf.save(`kiwi-ai-report-${reportData?.sessionId || 'session'}.pdf`);
    return true;
  } catch (error) {
    console.error('PDF generation failed:', error);
    throw new Error('Failed to generate PDF. Please try again.', { cause: error });
  }
};

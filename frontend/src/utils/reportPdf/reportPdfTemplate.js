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

const resolveCvJdScore = (report = {}) => {
  const scores = report.scores || {};
  const candidate = scores.cvJdMatch ?? scores.requirements ?? scores.macro ?? scores.overall;
  const parsed = Number(candidate);
  return Number.isFinite(parsed) ? parsed : 0;
};

const resolveInterviewScore = (report = {}) => {
  const scores = report.scores || {};
  const directScore = scores.interviewPerformance ?? scores.interview ?? scores.micro;
  if (Number.isFinite(Number(directScore))) return Number(directScore);

  const evidenceStrength = Number(scores.evidenceStrength);
  if (Number.isFinite(evidenceStrength)) return evidenceStrength <= 4 ? (evidenceStrength / 4) * 100 : evidenceStrength;
  return 0;
};

const scoreRows = (report = {}) => [
  {
    label: 'Overall',
    value: Number(report.scores?.overall || 0),
    detail: 'Blended CV fit and interview evidence',
    color: COLOR.brand,
  },
  {
    label: 'CV-JD match',
    value: resolveCvJdScore(report),
    detail: 'Role requirement alignment',
    color: COLOR.blue,
  },
  {
    label: 'Interview',
    value: resolveInterviewScore(report),
    detail: 'Answer quality signal',
    color: COLOR.amber,
  },
];

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

const drawTwoColumnList = (layout, items, renderer) => {
  const gap = 6;
  const width = (CONTENT_WIDTH - gap) / 2;
  for (let index = 0; index < items.length; index += 2) {
    const rowItems = items.slice(index, index + 2);
    const heights = rowItems.map((item) => renderer.measure(item, width));
    const rowHeight = Math.max(...heights);
    layout.ensureSpace(rowHeight + 6);
    const startY = layout.y;
    rowItems.forEach((item, column) => {
      const x = PAGE.margin + column * (width + gap);
      renderer.draw(item, x, startY, width, rowHeight);
    });
    layout.y = startY + rowHeight + 6;
  }
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
  layout.label('Session', reportData?.sessionId || 'N/A');

  layout.y += 6;
  drawCallout(layout, 'Overall feedback', vm.takeaway || report.summary || 'No summary available.', COLOR.brand);

  const cards = scoreRows(report);
  const cardGap = 6;
  const cardWidth = (CONTENT_WIDTH - cardGap * 2) / 3;
  layout.ensureSpace(44);
  const cardY = layout.y;
  cards.forEach((card, index) => {
    drawScoreCard(layout, card, PAGE.margin + index * (cardWidth + cardGap), cardY, cardWidth);
  });
  layout.y = cardY + 44;

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
  const insights = (vm.dataInsights || []).slice(0, 6);
  const strengths = (vm.strengthHighlights || []).slice(0, 4);
  if (!insights.length && !strengths.length) return;

  layout.sectionTitle('Evidence Snapshot', 'The strongest and weakest signals captured in this interview.');
  insights.forEach((insight) => {
    drawItemCard(
      layout,
      insight.title || insight.label || 'Insight',
      insight.description || insight.interpretation || insight.summary || '',
      { meta: insight.metric || insight.displayValue || String(insight.value ?? '') }
    );
  });

  if (strengths.length) {
    layout.sectionTitle('What You Did Well');
    const strengthRenderer = {
      measure: (item, width) => {
        layout.font(9, 'bold', COLOR.ink);
        const titleLines = layout.pdf.splitTextToSize(asText(item.title || item.label || item, 'Strength'), width - 8);
        layout.font(7.8, 'normal', COLOR.muted);
        const bodyLines = layout.pdf.splitTextToSize(
          item.explanation || item.description || 'This was one of the clearer role-fit signals.',
          width - 8
        );
        return Math.max(30, 12 + titleLines.length * 4.2 + bodyLines.length * 4);
      },
      draw: (item, x, y, width, height) => {
        layout.rect(x, y, width, height, { fill: [239, 249, 244], stroke: [204, 231, 218], radius: 3 });
        layout.font(9, 'bold', COLOR.ink);
        const titleLines = layout.pdf.splitTextToSize(asText(item.title || item.label || item, 'Strength'), width - 8);
        let cursorY = y + 8;
        titleLines.forEach((line) => {
          layout.pdf.text(line, x + 4, cursorY);
          cursorY += 4.2;
        });
        cursorY += 2;
        layout.font(7.8, 'normal', COLOR.muted);
        const bodyLines = layout.pdf.splitTextToSize(
          item.explanation || item.description || 'This was one of the clearer role-fit signals.',
          width - 8
        );
        bodyLines.forEach((line) => {
          layout.pdf.text(line, x + 4, cursorY);
          cursorY += 4;
        });
      },
    };
    drawTwoColumnList(layout, strengths, strengthRenderer);
  }
};

const drawCommunicationProfile = (layout, profile) => {
  if (!profile) return;
  const traits = profile.traits || profile.keyTraits || [];
  const summary = profile.summary || profile.overallImpression;
  if (!summary && !traits.length && !profile.fillerWords && !profile.fillerWordNote) return;

  layout.sectionTitle('Communication Style Profile');
  if (summary) drawCallout(layout, 'Overall impression', summary, COLOR.brand);
  traits.forEach((trait) => {
    drawItemCard(layout, trait.label || trait.title || 'Trait', trait.description || '', { color: COLOR.brand });
  });
  if (profile.fillerWords || profile.fillerWordNote) {
    drawCallout(layout, 'Delivery and filler words', profile.fillerWordNote || profile.fillerWords, COLOR.rose);
  }
};

const drawCoaching = (layout, vm) => {
  const priorities = vm.improvementPriorities || [];
  const coaching = vm.coachingAdvice || [];
  if (!priorities.length && !coaching.length) return;

  layout.sectionTitle('Priority Improvements');
  priorities.slice(0, 5).forEach((item) => {
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

  if (coaching.length) {
    layout.sectionTitle('Coaching Plan');
    coaching.slice(0, 5).forEach((item) => {
      drawItemCard(
        layout,
        item.theme || item.title || item.label || 'Coaching point',
        item.advice || item.explanation || item.description || '',
        {
          action: item.example || '',
          meta: [friendlyEvidenceLabel(item.evidenceLabel), item.confidenceLevel ? `${item.confidenceLevel} confidence` : ''].filter(Boolean).join(' - '),
          color: COLOR.brand,
        }
      );
    });
  }
};

const drawQuoteAnalyses = (layout, quoteAnalyses = []) => {
  if (!quoteAnalyses.length) return;
  layout.sectionTitle('Interview Highlights and Critiques', 'Short coaching examples based on actual interview responses.');
  quoteAnalyses.slice(0, 4).forEach((analysis) => {
    drawItemCard(layout, analysis.context || 'Interview response', analysis.quote || '', { color: COLOR.blue });
    drawItemCard(layout, "Coach's critique", analysis.critique || '', { color: COLOR.amber });
    if (analysis.rewrite) drawItemCard(layout, 'How to say it better', analysis.rewrite, { color: COLOR.brand });
  });
};

export const buildTurnFrameworkMeta = (turn = {}) => {
  const dimensions = turn.frameworkBreakdown?.dimensions;
  if (Array.isArray(dimensions) && dimensions.length) {
    const score = Number(turn.frameworkBreakdown.normalizedScore);
    const frameworkSummary = `${turn.frameworkLabel || 'Role-specific framework'}${Number.isFinite(score) ? ` ${score}/10` : ''}`;
    const dimensionSummaries = dimensions.map((dimension) => (
      dimension.status === 'not_applicable'
        ? `${dimension.label} not applicable`
        : `${dimension.label} ${Number(dimension.score || 0)}/10`
    ));
    return [frameworkSummary, ...dimensionSummaries].join(' | ');
  }
  if (!turn.scores) return '';
  return `Business ${turn.scores.business ?? '-'} / Logic ${turn.scores.logic ?? '-'} / Evidence ${turn.scores.evidence ?? '-'}`;
};

const drawTurnBreakdowns = (layout, turns = []) => {
  if (!turns.length) return;
  layout.ensureSpace(74);
  layout.sectionTitle('Turn-by-Turn Feedback', 'Detailed feedback for the scored answers.');
  turns.slice(0, 8).forEach((turn, index) => {
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
    drawItemCard(layout, 'Stronger version', item.better || item.after || item.rewrite || '', { color: COLOR.brand });
  });
};

const drawAppendix = (layout, reportData, vm) => {
  const report = vm.report || {};
  const qa = vm.qa || {};
  const diagnostics = vm.evidenceDiagnostics || {};
  const evidenceReferences = report.evidenceReferences || report.evidenceSummary || [];

  layout.sectionTitle('Appendix: Report Confidence', 'Technical checks are summarized in candidate-friendly language.');
  layout.label('Report status', friendlyStatus(reportData?.latestStatus || report.latestStatus));
  if (qa.coverageScore !== undefined) layout.label('Coverage score', `${qa.coverageScore}/100`);
  if (qa.hallucinationRisk) layout.label('Grounding risk', titleCase(qa.hallucinationRisk));
  if (diagnostics.averageStrength !== undefined) layout.label('Average evidence strength', `${diagnostics.averageStrength}/4`);

  if (diagnostics.totals && Object.keys(diagnostics.totals).length) {
    layout.y += 3;
    drawItemCard(
      layout,
      'Evidence type breakdown',
      Object.entries(diagnostics.totals).map(([key, value]) => `${titleCase(key)}: ${value}`).join(' | '),
      { color: COLOR.brand }
    );
  }

  if (evidenceReferences.length) {
    layout.sectionTitle('Evidence Sources');
    evidenceReferences.slice(0, 8).forEach((item) => {
      const label = typeof item === 'string'
        ? friendlyEvidenceLabel(item)
        : item.label || item.title || friendlyEvidenceLabel(item.sourceType) || item.summary;
      drawItemCard(layout, label || 'Evidence source', item.summary || item.description || friendlyEvidenceLabel(item.sourceType) || '', {
        color: COLOR.brand,
      });
    });
  } else {
    drawItemCard(layout, 'Evidence sources', 'No evidence available', { color: COLOR.amber });
  }
};

export const generateReportPDF = async (reportData) => {
  try {
    const vm = buildReportViewModel(reportData);
    const pdf = new JsPDF('p', 'mm', 'a4');
    const layout = new PdfLayout(pdf);

    drawCover(layout, reportData, vm);
    drawInsights(layout, vm);
    drawCommunicationProfile(layout, vm.communicationProfile);
    drawCoaching(layout, vm);
    drawQuoteAnalyses(layout, vm.quoteAnalyses);
    drawTurnBreakdowns(layout, vm.turnBreakdowns);
    drawAnswerRewrites(layout, vm.answerRewriteTips);
    drawAppendix(layout, reportData, vm);

    layout.addFooter();
    pdf.save(`kiwi-ai-report-${reportData?.sessionId || 'session'}.pdf`);
    return true;
  } catch (error) {
    console.error('PDF generation failed:', error);
    throw new Error('Failed to generate PDF. Please try again.', { cause: error });
  }
};

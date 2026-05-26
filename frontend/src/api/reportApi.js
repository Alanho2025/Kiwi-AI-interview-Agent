/**
 * File responsibility: Application module.
 * Main responsibilities:
 * - Keep presentation, state orchestration, and display helpers separated so React components stay reusable.
 * - Main file role: reportApi should keep its module boundaries clear and focused.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { apiPost, apiGet } from './client.js';

/**
 * Purpose: Execute the main responsibility for generateReport.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const generateReport = async ({ sessionId }) => apiPost('/report/generate', { sessionId });
export const qaReport = async ({ sessionId }) => apiPost('/report/qa', { sessionId });
export const getReport = async (sessionId) => apiGet(`/report/${sessionId}`);

/**
 * Purpose: Execute the main responsibility for exportReport.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const exportReport = async ({ sessionId, format = 'json' }) => 
  apiPost(`/report/${sessionId}/export`, { format });

/**
 * Purpose: Download report file using blob URL.
 * Inputs: File content and session ID.
 * Returns: None, triggers browser download.
 */
export const downloadReportFile = ({ content, sessionId, format = 'json' }) => {
  const extension = format === 'json' ? 'json' : (format === 'pdf' ? 'pdf' : 'txt');
  const mimeType = format === 'json' ? 'application/json' : (format === 'pdf' ? 'application/pdf' : 'text/plain');
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `report-${sessionId}.${extension}`;
  anchor.click();
  URL.revokeObjectURL(url);
};

import jsPDF from 'jspdf';
import { buildReportViewModel } from '../utils/reportView/index.js';

// ── PDF layout constants ──
const M = 20;
const LH = 5.5;
const PW = 210;
const CW = PW - M * 2;
const PB = 278;

// ── Helpers ──
const wrapText = (pdf, text, x, y, maxW = CW, lh = LH) => {
  const lines = pdf.splitTextToSize(String(text || ''), maxW);
  for (const line of lines) {
    if (y > PB) { pdf.addPage(); y = M; }
    pdf.text(line, x, y);
    y += lh;
  }
  return y;
};

const sectionHeading = (pdf, title, y) => {
  if (y > 260) { pdf.addPage(); y = M; }
  y += 4;
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(20, 80, 140);
  pdf.text(title, M, y);
  y += 2;
  pdf.setDrawColor(20, 80, 140);
  pdf.line(M, y, PW - M, y);
  y += LH + 1;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(40, 40, 40);
  return y;
};

const itemTitle = (pdf, title, y) => {
  if (y > PB - 10) { pdf.addPage(); y = M; }
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(50, 50, 50);
  y = wrapText(pdf, title, M, y);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(40, 40, 40);
  return y;
};

const labelValue = (pdf, lbl, val, y) => {
  if (y > PB) { pdf.addPage(); y = M; }
  pdf.setFont('helvetica', 'bold');
  pdf.text(`${lbl}: `, M + 2, y);
  const lw = pdf.getTextWidth(`${lbl}: `);
  pdf.setFont('helvetica', 'normal');
  pdf.text(String(val), M + 2 + lw, y);
  y += LH;
  return y;
};

const fmtScore = (v) => (typeof v === 'number' ? v.toFixed(2) : String(v ?? ''));

/**
 * Generate PDF from report data using pure jsPDF text layout.
 * Maps the same viewModel used by the React report page.
 */
export const generateReportPDF = async (reportData) => {
  try {
    const vm = buildReportViewModel(reportData);
    const r = vm.report || {};
    const scores = r.scores || {};
    const pdf = new jsPDF('p', 'mm', 'a4');
    let y = M;

    // ══════ Title ══════
    pdf.setFontSize(22);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(20, 80, 140);
    pdf.text('Kiwi AI Interview Report', M, y);
    y += 10;
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(120, 120, 120);
    pdf.text(`Generated: ${r.generatedAt ? new Date(r.generatedAt).toLocaleString() : new Date().toLocaleString()}`, M, y);
    y += 4;
    pdf.text(`Session: ${reportData?.sessionId || 'N/A'}`, M, y);
    y += 8;

    // ══════ Your Interview Feedback ══════
    if (vm.takeaway) {
      y = sectionHeading(pdf, 'Your Interview Feedback', y);
      y = wrapText(pdf, vm.takeaway, M, y);
      y += 2;
      if (vm.scoreBand) { y = labelValue(pdf, 'Match Level', vm.scoreBand, y); }
      if (r.decision) { y = labelValue(pdf, 'Decision', r.decision, y); }
    }

    // ══════ Scores ══════
    if (scores.overall !== undefined) {
      y = sectionHeading(pdf, 'Scores', y);
      const entries = [
        ['Overall (Blended)', scores.overall, '/100'],
        ['CV-JD Match', scores.macro, '/100'],
        ['Interview Quality', scores.micro, '/100'],
      ];
      for (const [l, v, s] of entries) {
        if (v !== undefined && v !== null) {
          y = labelValue(pdf, l, `${fmtScore(v)}${s}`, y);
        }
      }
    }


    // ══════ Communication Style Profile ══════
    const hasCommunicationProfile = vm.communicationProfile
      && (
        vm.communicationProfile.summary
        || vm.communicationProfile.overallImpression
        || vm.communicationProfile.fillerWordNote
        || vm.communicationProfile.fillerWords
        || vm.communicationProfile.traits?.length
        || vm.communicationProfile.keyTraits?.length
      );
    if (hasCommunicationProfile) {
      const cp = vm.communicationProfile;
      y = sectionHeading(pdf, 'Communication Style Profile', y);

      if (cp.summary || cp.overallImpression) {
        y = itemTitle(pdf, 'Overall Impression', y);
        y = wrapText(pdf, cp.summary || cp.overallImpression, M + 2, y, CW - 4);
        y += 2;
      }

      const traits = cp.traits || cp.keyTraits || [];
      if (traits?.length) {
        y = itemTitle(pdf, 'Key Traits', y);
        for (const t of traits) {
          pdf.setFont('helvetica', 'bold');
          y = wrapText(pdf, `• ${t.label || t.title || ''}`, M + 2, y, CW - 4);
          pdf.setFont('helvetica', 'normal');
          if (t.description) { y = wrapText(pdf, t.description, M + 6, y, CW - 8); }
          y += 1;
        }
      }

      if (cp.fillerWordNote || cp.fillerWords) {
        y = itemTitle(pdf, 'Delivery & Filler Words', y);
        y = wrapText(pdf, cp.fillerWordNote || cp.fillerWords, M + 2, y, CW - 4);
        y += 2;
      }
    }

    // ══════ Priority Improvements ══════
    if (vm.improvementPriorities?.length) {
      y = sectionHeading(pdf, 'Priority Improvements', y);
      for (const p of vm.improvementPriorities) {
        y = itemTitle(pdf, p.title || p.label || '', y);
        if (p.reason || p.description) { y = wrapText(pdf, p.reason || p.description, M + 2, y, CW - 4); }
        if (p.actionStep) {
          pdf.setFont('helvetica', 'italic');
          y = wrapText(pdf, `What to do next: ${p.actionStep}`, M + 2, y, CW - 4);
          pdf.setFont('helvetica', 'normal');
        }
        y += 2;
      }
    }

    // ══════ AI Coaching ══════
    if (vm.coachingAdvice?.length) {
      y = sectionHeading(pdf, 'AI Coaching', y);
      for (const c of vm.coachingAdvice) {
        y = itemTitle(pdf, c.title || c.label || '', y);
        if (c.explanation || c.description) { y = wrapText(pdf, c.explanation || c.description, M + 2, y, CW - 4); }
        if (c.example) {
          pdf.setFont('helvetica', 'italic');
          y = wrapText(pdf, `Try this next time: ${c.example}`, M + 2, y, CW - 4);
          pdf.setFont('helvetica', 'normal');
        }
        y += 2;
      }
    }

    // ══════ Interview Highlights & Critiques ══════
    if (vm.quoteAnalyses?.length) {
      y = sectionHeading(pdf, 'Interview Highlights & Critiques', y);
      for (const q of vm.quoteAnalyses) {
        if (q.context) {
          pdf.setFont('helvetica', 'bold');
          y = wrapText(pdf, 'Context', M, y);
          pdf.setFont('helvetica', 'normal');
          y = wrapText(pdf, q.context, M + 2, y, CW - 4);
          y += 1;
        }
        if (q.quote) {
          pdf.setFont('helvetica', 'italic');
          pdf.setTextColor(80, 80, 80);
          y = wrapText(pdf, `"${q.quote}"`, M + 4, y, CW - 8);
          pdf.setTextColor(40, 40, 40);
          pdf.setFont('helvetica', 'normal');
          y += 1;
        }
        if (q.critique) {
          pdf.setFont('helvetica', 'bold');
          y = wrapText(pdf, "Coach's Critique", M, y);
          pdf.setFont('helvetica', 'normal');
          y = wrapText(pdf, q.critique, M + 2, y, CW - 4);
          y += 1;
        }
        if (q.rewrite) {
          pdf.setFont('helvetica', 'bold');
          y = wrapText(pdf, 'How to say it better', M, y);
          pdf.setFont('helvetica', 'normal');
          y = wrapText(pdf, q.rewrite, M + 2, y, CW - 4);
        }
        y += 4;
      }
    }

    // ══════ Turn-by-Turn Breakdown ══════
    if (vm.turnBreakdowns?.length) {
      y = sectionHeading(pdf, 'Turn-by-Turn Breakdown', y);
      for (const [index, t] of vm.turnBreakdowns.entries()) {
        const qNum = t.questionIndex ?? t.turnIndex ?? index + 1;
        y = itemTitle(pdf, `Q${qNum}: ${t.questionText || t.question || ''}`, y);

        if (t.scores) {
          const parts = [];
          if (t.scores.business !== undefined) parts.push(`Business: ${t.scores.business}/10`);
          if (t.scores.logic !== undefined) parts.push(`Logic: ${t.scores.logic}/10`);
          if (t.scores.evidence !== undefined) parts.push(`Evidence: ${t.scores.evidence}/10`);
          if (parts.length) { y = labelValue(pdf, 'Micro-Scores', parts.join('  |  '), y); }
        }

        if (t.starApplicable === false && t.structureBreakdown) {
          const label = t.structureLabel || 'Answer structure';
          y = labelValue(pdf, label, `Main gap: ${t.structureBreakdown.mainMissingElement || 'specificity'}`, y);
          if (t.structureBreakdown.scoreReason) {
            y = wrapText(pdf, t.structureBreakdown.scoreReason, M + 2, y, CW - 4);
          }
        } else if (t.starBreakdown) {
          y = labelValue(pdf, 'STAR', `S: ${t.starBreakdown.situation || '-'} | T: ${t.starBreakdown.task || '-'} | A: ${t.starBreakdown.action || '-'} | R: ${t.starBreakdown.result || '-'}`, y);
        }

        if (t.answerSummary || t.answer) {
          pdf.setFont('helvetica', 'italic');
          y = wrapText(pdf, `Answer: ${t.answerSummary || t.answer}`, M + 2, y, CW - 4);
          pdf.setFont('helvetica', 'normal');
          y += 1;
        }
        if (t.feedback) { y = wrapText(pdf, t.feedback, M + 2, y, CW - 4); }
        y += 3;
      }
    }

    // ══════ How To Answer Better ══════

    // ══════ Section-by-Section Breakdown ══════
    if (r.sections?.length) {
      y = sectionHeading(pdf, 'Section-by-Section Breakdown', y);
      for (const sec of r.sections) {
        y = itemTitle(pdf, sec.title || 'Section', y);
        if (sec.content) { y = wrapText(pdf, sec.content, M + 2, y, CW - 4); }
        y += 2;
      }
    }

    // ══════ Footer ══════
    const pages = pdf.internal.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
      pdf.setPage(p);
      pdf.setFontSize(8);
      pdf.setTextColor(160, 160, 160);
      pdf.text(`Kiwi AI Interview Agent  •  Page ${p}/${pages}`, PW / 2, 290, { align: 'center' });
    }

    const sid = reportData?.sessionId || reportData?.id || 'export';
    pdf.save(`Kiwi-Report-${sid}.pdf`);
    return true;
  } catch (error) {
    console.error('PDF Generation Error:', error);
    throw new Error('Could not generate PDF. ' + error.message, { cause: error });
  }
};

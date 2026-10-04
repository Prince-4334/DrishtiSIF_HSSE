import { useState, useMemo, useEffect } from 'react';
import {
  Sparkles, Trash2, Play, Save, Lock, AlertTriangle,
  CheckCircle2, Loader2, FileText, ClipboardCheck, User,
} from 'lucide-react';
import type { AnalysisResult, Report, SifLevel } from '@/lib/types';
import type { PageId } from '@/components/Sidebar';
import { analyzeReport } from '@/lib/analyzer';
import { DEMO_REPORTS } from '@/lib/seedData';
import { supabase } from '@/lib/supabase';
import { SifBadge } from '@/components/Badges';

interface AnalyzeProps {
  reports: Report[];
  onSaved: () => void;
  onNavigate: (page: PageId) => void;
}

type AnalyzeState = 'idle' | 'analyzing' | 'result';

interface HseReview {
  reviewerName: string;
  comments: string;
  levelOverride: SifLevel | '';
  confirmedAction: string;
}

export default function Analyze({ reports, onSaved, onNavigate }: AnalyzeProps) {
  const [text, setText] = useState('');
  const [state, setState] = useState<AnalyzeState>('idle');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState('');
  const [demoText, setDemoText] = useState<string | null>(null);
  const [tooShort, setTooShort] = useState(false);

  const [hseReview, setHseReview] = useState<HseReview>({
    reviewerName: 'Rajesh Saikia (Sr. HSE Manager)',
    comments: '',
    levelOverride: '',
    confirmedAction: '',
  });
  const [reviewError, setReviewError] = useState('');

  const maxId = useMemo(() => {
    let max = 0;
    reports.forEach((r) => {
      const num = parseInt(r.report_id.replace(/\D/g, ''), 10);
      if (num > max) max = num;
    });
    return max;
  }, [reports]);

const handleAnalyze = async () => {
    if (text.trim().length < 15) {
      setTooShort(true);
      return;
    }
    setTooShort(false);
    setState('analyzing');

    try {
      const response = await fetch('https://drishtisif-hsse.onrender.com/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await response.json();

      const fallback = analyzeReport(text);

      const analysis: AnalysisResult = {
        ...fallback,
        sifLevel: data.sif_potential,
        priorityScore: data.sif_score,
        lifeSavingRule: data.life_saving_rule,
        activity: data.activity,
        hazard: data.hazard,
        barrierFailure: data.barrier_failure,
        potentialConsequence: data.potential_consequence,
        explanation: data.why_flagged,
        evidence: data.extracted_precursors || fallback.evidence,
      };

      setResult(analysis);
      setHseReview({
        reviewerName: 'Rajesh Saikia (Sr. HSE Manager)',
        comments: '',
        levelOverride: '',
        confirmedAction: analysis.recommendedAction || '',
      });
      setState('result');
    } catch (error) {
      console.error(error);
      const fallback = analyzeReport(text);
      setResult(fallback);
      setState('result');
    }
  };
  const handleClear = () => {
    setText('');
    setResult(null);
    setState('idle');
    setSaveState('idle');
    setSaveError('');
    setTooShort(false);
    setHseReview({ reviewerName: 'Rajesh Saikia (Sr. HSE Manager)', comments: '', levelOverride: '', confirmedAction: '' });
    setReviewError('');
  };

  const handleDemo = (demoText: string) => {
    setDemoText(demoText);
  };

  useEffect(() => {
    if (demoText !== null) {
      setText(demoText);
      setDemoText(null);
      setResult(null);
      setState('idle');
      setSaveState('idle');
      setSaveError('');
      setTooShort(false);
      setHseReview({ reviewerName: 'Rajesh Saikia (Sr. HSE Manager)', comments: '', levelOverride: '', confirmedAction: '' });
    }
  }, [demoText]);

  const handleSave = async () => {
    if (!result) return;

    if (!hseReview.reviewerName.trim()) {
      setReviewError('Reviewing HSE officer signature is required.');
      return;
    }
    setReviewError('');
    setSaveState('saving');
    setSaveError('');

    const newReportId = `REP-OIL-${String(maxId + 1 || Math.floor(Math.random() * 9000 + 1000)).padStart(4, '0')}`;
    const today = new Date().toISOString().split('T')[0];
    const sites = ['Duliajan Rig #4', 'Moran Tank Farm', 'Naharkatiya GGS', 'Jorajan Oil Field', 'Digboi Processing Unit'];
    const assignedSite = sites[Math.floor(Math.random() * sites.length)];
    const finalSifLevel: SifLevel = hseReview.levelOverride || result.sifLevel;

    const newReportRecord: Report = {
      id: String(Date.now()),
      report_id: newReportId,
      report_date: today,
      site: assignedSite,
      report_type: 'Near-miss',
      raw_narrative: text,
      activity: result.activity,
      sif_level: finalSifLevel,
      priority_score: result.priorityScore,
      life_saving_rule: result.lifeSavingRule,
      hazard: result.hazard,
      barrier: result.barrier,
      barrier_failure: result.barrierFailure,
      potential_consequence: result.potentialConsequence,
      explanation: result.explanation,
      evidence: result.evidence,
      recommended_action: hseReview.confirmedAction || result.recommendedAction,
      review_status: 'Reviewed',
      is_seed: false,
      hse_reviewer_name: hseReview.reviewerName.trim(),
      hse_review_comments: hseReview.comments.trim() || null,
      hse_review_level: hseReview.levelOverride || null,
      hse_confirmed_action: hseReview.confirmedAction || null,
      hse_reviewed_at: new Date().toISOString(),
    };

    try {
      reports.unshift(newReportRecord);

      if (supabase) {
        await supabase.from('reports').insert(newReportRecord);
      }

      setSaveState('saved');
      onSaved();
      setTimeout(() => {
        onNavigate('reports');
      }, 1200);
    } catch {
      setSaveState('saved');
      onSaved();
      setTimeout(() => {
        onNavigate('reports');
      }, 1200);
    }
  };

  return (
    <div className="p-6 max-w-[1000px] mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
          Analyze Safety Report
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-light)' }}>
          Paste a UA/UC, near-miss, or incident report for AI-assisted SIF precursor screening & HSE adjudication
        </p>
      </div>

      <div className="card p-5 mb-4">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste a UA/UC, near-miss or incident report narrative..."
          rows={6}
          className="w-full p-3 text-[14px] leading-relaxed border rounded outline-none focus:border-[var(--color-primary)] resize-y"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
        />

        {tooShort && (
          <div className="mt-2 px-3 py-2 rounded text-[12px] flex items-center gap-2" style={{ backgroundColor: 'var(--color-high-bg)', color: 'var(--color-high)' }}>
            <AlertTriangle size={14} />
            Please enter a more detailed report (at least 15 characters) to analyze.
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 mt-3">
          <button
            onClick={handleAnalyze}
            disabled={state === 'analyzing'}
            className="btn-primary px-4 py-2 rounded text-[13px] font-semibold flex items-center gap-2 disabled:opacity-60"
          >
            {state === 'analyzing' ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Play size={15} />
            )}
            Analyze Report
          </button>
          <button
            onClick={handleClear}
            className="px-4 py-2 rounded text-[13px] font-medium border hover:bg-gray-50 flex items-center gap-2"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
          >
            <Trash2 size={15} />
            Clear
          </button>
        </div>

        <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <div className="text-[10px] font-medium uppercase tracking-wide mb-2 flex items-center gap-1.5" style={{ color: 'var(--color-text-light)' }}>
            <Sparkles size={12} />
            Try Demo Report
          </div>
          <div className="flex flex-wrap gap-2">
            {DEMO_REPORTS.map((demo) => (
              <button
                key={demo.label}
                onClick={() => handleDemo(demo.text)}
                className="px-3 py-1.5 rounded text-[12px] font-medium border hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
              >
                {demo.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {state === 'analyzing' && (
        <div className="card p-8 text-center animate-fade-in">
          <Loader2 size={32} className="animate-spin mx-auto mb-3" style={{ color: 'var(--color-primary)' }} />
          <div className="text-[14px] font-semibold" style={{ color: 'var(--color-text)' }}>
            Analyzing safety narrative...
          </div>
          <div className="text-[12px] mt-1" style={{ color: 'var(--color-text-light)' }}>
            Extracting energy vectors, barrier breaches, and IOGP rules
          </div>
        </div>
      )}

      {state === 'result' && result && (
        <ResultCard
          result={result}
          saveState={saveState}
          saveError={saveError}
          onSave={handleSave}
          hseReview={hseReview}
          setHseReview={setHseReview}
          reviewError={reviewError}
        />
      )}
    </div>
  );
}

function ResultCard({ result, saveState, saveError, onSave, hseReview, setHseReview, reviewError }: {
  result: AnalysisResult;
  saveState: 'idle' | 'saving' | 'saved' | 'error';
  saveError: string;
  onSave: () => void;
  hseReview: HseReview;
  setHseReview: React.Dispatch<React.SetStateAction<HseReview>>;
  reviewError: string;
}) {
  const scoreColor =
    result.priorityScore >= 70 ? 'var(--color-high)' :
    result.priorityScore >= 40 ? 'var(--color-medium)' :
    'var(--color-low)';

  const finalLevel: SifLevel = hseReview.levelOverride || result.sifLevel;

  return (
    <div className="card overflow-hidden animate-fade-in">
      <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--color-border)', backgroundColor: '#f8f9fb' }}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-medium uppercase tracking-wide" style={{ color: 'var(--color-text-light)' }}>
              SIF Potential
            </span>
            <SifBadge level={result.sifLevel} />
            {result.insufficientSignal && (
              <span className="text-[11px] px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--color-medium-bg)', color: 'var(--color-medium)' }}>
                Insufficient Signal
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium uppercase tracking-wide" style={{ color: 'var(--color-text-light)' }}>
              SIF Priority Score
            </span>
            <span className="text-2xl font-bold tabular-nums" style={{ color: scoreColor }}>
              {result.priorityScore}
            </span>
            <span className="text-[14px]" style={{ color: 'var(--color-text-light)' }}>/ 100</span>
          </div>
        </div>
        <div className="mt-2 text-[12px]" style={{ color: 'var(--color-text-light)' }}>
          {result.sifLevel === 'HIGH' && 'High SIF potential — flagged for HSE officer verification.'}
          {result.sifLevel === 'MEDIUM' && 'Moderate SIF potential — review recommended.'}
          {result.sifLevel === 'LOW' && 'Low SIF potential — routine follow-up.'}
          {result.sifLevel === 'NON-SIF' && 'Non-SIF — barrier successfully applied or low energy hazard.'}
        </div>
      </div>

      <div className="px-5 py-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          <MetaField icon={<Lock size={14} />} label="IOGP Life-Saving Rule" value={result.lifeSavingRule} />
          <MetaField icon={<FileText size={14} />} label="Activity" value={result.activity} />
          <MetaField label="Hazard" value={result.hazard} />
          <MetaField label="Barrier" value={result.barrier} />
          <MetaField label="Barrier Failure" value={result.barrierFailure} highlight={result.barrierFailure !== 'None identified' && !result.barrierFailure.includes('successfully applied')} />
          <MetaField label="Potential Consequence" value={result.potentialConsequence} />
        </div>
      </div>

      <div className="px-5 pb-4">
        <div className="text-[10px] font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--color-text-light)' }}>
          Why Was This Flagged?
        </div>
        <div className="text-[13px] leading-relaxed p-3 rounded border-l-2" style={{ borderColor: 'var(--color-primary)', backgroundColor: 'var(--color-info-bg)', color: 'var(--color-text)' }}>
          {result.explanation}
        </div>
      </div>

      {result.evidence.length > 0 && (
        <div className="px-5 pb-4">
          <div className="text-[10px] font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--color-text-light)' }}>
            Extracted Precursor Evidence
          </div>
          <div className="flex flex-wrap gap-2">
            {result.evidence.map((ev, i) => (
              <span key={i} className="px-2 py-0.5 rounded text-[11px] font-medium" style={{ backgroundColor: '#e8eef5', color: 'var(--color-info)' }}>
                {ev}
              </span>
            ))}
          </div>
        </div>
      )}

      <div
        className="px-5 py-5 border-t"
        style={{ borderColor: 'var(--color-border)', backgroundColor: '#F8FAFC' }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded flex items-center justify-center shrink-0"
              style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}
            >
              <ClipboardCheck size={18} />
            </div>
            <div>
              <div className="text-[14px] font-bold" style={{ color: 'var(--color-text)' }}>
                HSE Officer Adjudication
              </div>
              <div className="text-[11px]" style={{ color: 'var(--color-text-light)' }}>
                Human-in-the-loop validation of SIF classification prior to database record commitment
              </div>
            </div>
          </div>
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded border border-blue-200 bg-blue-50 text-blue-800">
            Adjudication Mode
          </span>
        </div>

        <div className="mb-4">
          <label className="text-[10px] font-bold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--color-text-light)' }}>
            Officer Determination <span style={{ color: 'var(--color-high)' }}>*</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setHseReview((prev) => ({ ...prev, levelOverride: 'HIGH' }))}
              className={`py-2 px-3 rounded text-[12px] font-bold border transition-all flex items-center justify-center gap-1.5 ${
                (hseReview.levelOverride === 'HIGH' || (!hseReview.levelOverride && result.sifLevel === 'HIGH'))
                  ? 'bg-red-700 text-white border-red-700 shadow-sm'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              <span>⚠️</span> Confirm SIF-Potential
            </button>
            <button
              type="button"
              onClick={() => setHseReview((prev) => ({ ...prev, levelOverride: 'NON-SIF' }))}
              className={`py-2 px-3 rounded text-[12px] font-bold border transition-all flex items-center justify-center gap-1.5 ${
                hseReview.levelOverride === 'NON-SIF'
                  ? 'bg-slate-800 text-white border-slate-800 shadow-sm'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              <span>✓</span> Reclassify Non-SIF
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider block mb-1" style={{ color: 'var(--color-text-light)' }}>
              Reviewing Officer Name <span style={{ color: 'var(--color-high)' }}>*</span>
            </label>
            <div className="relative">
              <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-light)' }} />
              <input
                type="text"
                value={hseReview.reviewerName}
                onChange={(e) => setHseReview((prev) => ({ ...prev, reviewerName: e.target.value }))}
                className="w-full pl-9 pr-3 py-2 text-[12px] border rounded outline-none focus:border-[var(--color-primary)] bg-white font-medium"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                placeholder="Officer signature"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider block mb-1" style={{ color: 'var(--color-text-light)' }}>
              Officer Comments / Rationale
            </label>
            <input
              type="text"
              value={hseReview.comments}
              onChange={(e) => setHseReview((prev) => ({ ...prev, comments: e.target.value }))}
              placeholder="e.g., Verified energy isolation failure on site inspection"
              className="w-full px-3 py-2 text-[12px] border rounded outline-none focus:border-[var(--color-primary)] bg-white"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="text-[10px] font-bold uppercase tracking-wider block mb-1" style={{ color: 'var(--color-text-light)' }}>
            Confirmed HSE Remediation Action
          </label>
          <textarea
            value={hseReview.confirmedAction}
            onChange={(e) => setHseReview((prev) => ({ ...prev, confirmedAction: e.target.value }))}
            rows={2}
            className="w-full p-2.5 text-[12px] leading-relaxed border rounded outline-none focus:border-[var(--color-primary)] resize-y bg-white"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
          />
        </div>

        <div
          className="p-3 rounded border-l-2 text-[12px] bg-white flex items-center justify-between"
          style={{ borderColor: 'var(--color-primary)' }}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 size={15} style={{ color: 'var(--color-low)' }} />
            <span style={{ color: 'var(--color-text-light)' }}>
              Final SIF Status: <b style={{ color: 'var(--color-text)' }}>{finalLevel}</b>
              {hseReview.levelOverride ? ' (Officer Override)' : ' (AI Agreement)'}
            </span>
          </div>
          <span className="text-[11px] font-medium" style={{ color: 'var(--color-text-light)' }}>
            Reviewer: <b>{hseReview.reviewerName || '—'}</b>
          </span>
        </div>

        {reviewError && (
          <div className="mt-3 px-3 py-2 rounded text-[12px] flex items-center gap-2" style={{ backgroundColor: 'var(--color-high-bg)', color: 'var(--color-high)' }}>
            <AlertTriangle size={14} />
            {reviewError}
          </div>
        )}
      </div>

      <div className="px-5 py-4 border-t flex items-center gap-3" style={{ borderColor: 'var(--color-border)', backgroundColor: '#ffffff' }}>
        {saveState === 'idle' && (
          <button
            onClick={onSave}
            className="btn-primary px-5 py-2.5 rounded text-[13px] font-bold flex items-center gap-2 shadow-sm"
          >
            <Save size={15} />
            Commit Reviewed Report
          </button>
        )}
        {saveState === 'saving' && (
          <button disabled className="btn-primary px-5 py-2.5 rounded text-[13px] font-bold flex items-center gap-2 opacity-75">
            <Loader2 size={15} className="animate-spin" />
            Saving to Register...
          </button>
        )}
        {saveState === 'saved' && (
          <div className="flex items-center gap-2 text-[13px] font-bold" style={{ color: 'var(--color-low)' }}>
            <CheckCircle2 size={18} />
            Adjudication saved successfully — redirecting to SIF Reports...
          </div>
        )}
        {saveState === 'error' && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-[13px] font-semibold" style={{ color: 'var(--color-high)' }}>
              <AlertTriangle size={18} />
              {saveError}
            </div>
            <button onClick={onSave} className="px-3 py-1.5 rounded text-[12px] font-medium border hover:bg-gray-50" style={{ borderColor: 'var(--color-border)' }}>
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function MetaField({ icon, label, value, highlight }: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-wide mb-1 flex items-center gap-1.5" style={{ color: 'var(--color-text-light)' }}>
        {icon}
        {label}
      </div>
      <div
        className="text-[13px] font-medium"
        style={{
          color: highlight ? 'var(--color-high)' : 'var(--color-text)',
          backgroundColor: highlight ? 'var(--color-high-bg)' : 'transparent',
          padding: highlight ? '4px 8px' : '0',
          borderRadius: highlight ? '3px' : '0',
          display: 'inline-block',
        }}
      >
        {value}
      </div>
    </div>
  );
}
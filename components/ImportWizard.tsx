import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { X, ChevronRight, ChevronLeft, Table, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { DailyRecord } from '../types';
import { normalizeDate, parseDateString, isValid, TIME_SLOTS_2H } from '../utils';

interface ImportWizardProps {
    workbook: XLSX.WorkBook;
    onComplete: (data: DailyRecord[]) => void;
    onCancel: () => void;
}

type ColumnType = 'date' | 'time' | 'ccs_value' | 'tonnage' | 'ignore';

export const ImportWizard: React.FC<ImportWizardProps> = ({ workbook, onComplete, onCancel }) => {
    const [step, setStep] = useState<1 | 2>(1);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [statusMessage, setStatusMessage] = useState('');
    
    const [sheetSelection, setSheetSelection] = useState({
        quality: '',
        tonnage: ''
    });

    const [mappings, setMappings] = useState<Record<string, Record<string, ColumnType>>>({});

    const sheetNames = workbook.SheetNames;

    const getSheetPreview = (sheetName: string) => {
        if (!sheetName) return [];
        const ws = workbook.Sheets[sheetName];
        return XLSX.utils.sheet_to_json<any>(ws, { header: "A", range: 0, defval: "" }).slice(0, 10);
    };

    const qualityPreview = useMemo(() => getSheetPreview(sheetSelection.quality), [sheetSelection.quality]);
    const tonnagePreview = useMemo(() => getSheetPreview(sheetSelection.tonnage), [sheetSelection.tonnage]);

    const handleColumnMap = (sheet: 'quality' | 'tonnage', col: string, type: ColumnType) => {
        const sheetName = sheetSelection[sheet];
        setMappings(prev => ({
            ...prev,
            [sheetName]: {
                ...prev[sheetName],
                [col]: type
            }
        }));
    };

    const processFinalData = async () => {
        setIsProcessing(true);
        setProgress(5);
        setStatusMessage('در حال آماده‌سازی هسته پردازش...');

        await new Promise(r => setTimeout(r, 800));

        const qSheetName = sheetSelection.quality;
        const tSheetName = sheetSelection.tonnage;
        const qMap = mappings[qSheetName] || {};
        const tMap = mappings[tSheetName] || {};

        const qData: Record<string, any[]> = {};
        const tData: Record<string, number> = {};
        const allDates = new Set<string>();

        // Process Quality
        if (qSheetName) {
            setProgress(15);
            setStatusMessage('مرحله ۱/۴: استخراج مقادیر کیفی (CCS)...');
            await new Promise(r => setTimeout(r, 600));

            const ws = workbook.Sheets[qSheetName];
            const rows = XLSX.utils.sheet_to_json<any>(ws, { header: "A", defval: "" });
            
            const dateCol = Object.keys(qMap).find(k => qMap[k] === 'date');
            const timeCol = Object.keys(qMap).find(k => qMap[k] === 'time');
            const valCol = Object.keys(qMap).find(k => qMap[k] === 'ccs_value');

            if (dateCol && valCol) {
                const daySampleCounter: Record<string, number> = {};

                rows.forEach((row, index) => {
                    const date = normalizeDate(row[dateCol]);
                    const rawVal = row[valCol];
                    
                    if (index === 0 && !isValid(rawVal)) return;

                    if (date && isValid(rawVal)) {
                        const val = Number(String(rawVal).replace(/,/g, ''));
                        if (!isNaN(val) && val > 0) {
                            if (!qData[date]) {
                                qData[date] = [];
                                daySampleCounter[date] = 0;
                            }
                            
                            let timeStr = timeCol ? String(row[timeCol]).trim() : '';
                            if (!timeStr || timeStr === '') {
                                const slotIdx = daySampleCounter[date] % TIME_SLOTS_2H.length;
                                timeStr = TIME_SLOTS_2H[slotIdx];
                                daySampleCounter[date]++;
                            }

                            qData[date].push({ timeSlot: timeStr, value: val });
                            allDates.add(date);
                        }
                    }
                });
            }
            setProgress(40);
        }

        // Process Tonnage
        if (tSheetName) {
            setStatusMessage('مرحله ۲/۴: تطبیق و استخراج تناژ تولیدی...');
            await new Promise(r => setTimeout(r, 600));

            const ws = workbook.Sheets[tSheetName];
            const rows = XLSX.utils.sheet_to_json<any>(ws, { header: "A", defval: "" });
            
            const dateCol = Object.keys(tMap).find(k => tMap[k] === 'date');
            const tonCol = Object.keys(tMap).find(k => tMap[k] === 'tonnage');

            if (dateCol && tonCol) {
                rows.forEach((row, index) => {
                    const date = normalizeDate(row[dateCol]);
                    const rawVal = row[tonCol];
                    if (index === 0 && !isValid(rawVal)) return;

                    if (date && isValid(rawVal)) {
                        const val = Number(String(rawVal).replace(/,/g, ''));
                        if (!isNaN(val)) {
                            tData[date] = (tData[date] || 0) + val;
                            allDates.add(date);
                        }
                    }
                });
            }
            setProgress(70);
        }

        setStatusMessage('مرحله ۳/۴: یکپارچه‌سازی و مرتب‌سازی تقویم...');
        await new Promise(r => setTimeout(r, 500));

        const newRecords: DailyRecord[] = Array.from(allDates).map(date => ({
            day: parseDateString(date)?.day || 0,
            dateStr: date,
            dataPoints: qData[date] || [],
            tonnage: tData[date] !== undefined ? Number(tData[date].toFixed(1)) : 0
        }));

        newRecords.sort((a,b) => {
            const pa = parseDateString(a.dateStr);
            const pb = parseDateString(b.dateStr);
            const scoreA = (pa?.year || 0)*10000 + (pa?.month || 0)*100 + (pa?.day || 0);
            const scoreB = (pb?.year || 0)*10000 + (pb?.month || 0)*100 + (pb?.day || 0);
            return scoreA - scoreB;
        });

        setProgress(95);
        setStatusMessage('مرحله ۴/۴: ذخیره‌سازی در پایگاه داده محلی...');
        await new Promise(r => setTimeout(r, 400));

        setProgress(100);
        setStatusMessage('فرآیند با موفقیت انجام شد!');
        await new Promise(r => setTimeout(r, 300));

        onComplete(newRecords);
    };

    const renderColumnMapper = (sheet: 'quality' | 'tonnage', preview: any[]) => {
        const sheetName = sheetSelection[sheet];
        if (!sheetName || preview.length === 0) return null;
        
        const cols = Object.keys(preview[0]);
        const currentMap = mappings[sheetName] || {};

        return (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6">
                <div className="flex items-center gap-2 mb-3">
                    <Table className={`w-5 h-5 ${sheet === 'quality' ? 'text-blue-600' : 'text-emerald-600'}`} />
                    <h4 className="font-bold text-slate-700">تعیین ستون‌های شیت {sheet === 'quality' ? 'کیفی' : 'تناژ'} ({sheetName})</h4>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-xs text-center border-separate border-spacing-1">
                        <thead>
                            <tr>
                                {cols.map(c => (
                                    <th key={c} className="p-2">
                                        <select 
                                            value={currentMap[c] || 'ignore'} 
                                            onChange={e => handleColumnMap(sheet, c, e.target.value as ColumnType)}
                                            className={`w-full p-1.5 rounded-lg border font-bold outline-none transition ${currentMap[c] && currentMap[c] !== 'ignore' ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-slate-500'}`}
                                        >
                                            <option value="ignore">نادیده گرفتن</option>
                                            <option value="date">تاریخ</option>
                                            {sheet === 'quality' && <option value="time">ساعت</option>}
                                            {sheet === 'quality' && <option value="ccs_value">مقدار CCS</option>}
                                            {sheet === 'tonnage' && <option value="tonnage">مقدار تناژ</option>}
                                        </select>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {preview.map((row, i) => (
                                <tr key={i}>
                                    {cols.map(c => (
                                        <td key={c} className={`p-2 border rounded-md font-mono ${currentMap[c] && currentMap[c] !== 'ignore' ? 'bg-blue-50 border-blue-200 text-blue-700 font-bold' : 'bg-white text-slate-400'}`}>
                                            {String(row[c]).substring(0, 15)}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <div className="bg-white rounded-3xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-white/20">
                
                {/* Header */}
                <div className="px-8 py-5 border-b flex justify-between items-center bg-slate-50">
                    <div>
                        <h2 className="text-xl font-black text-slate-800 flex items-center gap-3">
                            <Table className="w-6 h-6 text-blue-600" />
                            جادوگر واردات هوشمند داده‌ها
                        </h2>
                        <p className="text-slate-500 text-xs mt-1">مرحله {step} از ۲: {step === 1 ? 'انتخاب شیت‌های مربوطه' : 'تعیین نوع ستون‌ها'}</p>
                    </div>
                    {!isProcessing && <button onClick={onCancel} className="p-2 hover:bg-slate-200 rounded-full transition"><X /></button>}
                </div>

                {/* Content */}
                <div className="p-8 overflow-y-auto flex-1 relative">
                    {isProcessing && (
                        <div className="absolute inset-0 bg-white/95 z-20 flex flex-col items-center justify-center p-12 animate-in fade-in duration-300">
                            <div className="relative mb-8">
                                <Loader2 className="w-20 h-20 text-blue-600 animate-spin" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-xs font-black text-blue-600">{progress}%</span>
                                </div>
                            </div>
                            <h3 className="text-2xl font-black text-slate-800 mb-2">در حال بارگذاری و پردازش داده‌ها...</h3>
                            <p className="text-blue-600 font-bold mb-10 h-6">{statusMessage}</p>
                            
                            <div className="w-full max-w-md bg-slate-100 h-3 rounded-full overflow-hidden border border-slate-200 shadow-inner">
                                <div 
                                    className="h-full bg-blue-600 transition-all duration-300 ease-out shadow-[0_0_15px_rgba(37,99,235,0.4)]"
                                    style={{ width: `${progress}%` }}
                                ></div>
                            </div>
                            
                            <div className="mt-12 grid grid-cols-4 gap-4 w-full max-w-2xl">
                                {[
                                    { id: 15, label: 'استخراج' },
                                    { id: 40, label: 'تطبیق' },
                                    { id: 70, label: 'یکپارچه‌سازی' },
                                    { id: 100, label: 'نهایی‌سازی' }
                                ].map(stage => (
                                    <div key={stage.id} className="flex flex-col items-center gap-2">
                                        <div className={`w-3 h-3 rounded-full ${progress >= stage.id ? 'bg-blue-600' : 'bg-slate-200'}`}></div>
                                        <span className={`text-[10px] font-black ${progress >= stage.id ? 'text-blue-600' : 'text-slate-400'}`}>{stage.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {step === 1 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4">
                            <div className="space-y-4">
                                <label className="flex items-center gap-2 font-bold text-slate-700">
                                    <AlertCircle className="w-4 h-4 text-blue-500" />
                                    کدام شیت شامل داده‌های کیفی (CCS) است؟
                                </label>
                                <div className="grid grid-cols-1 gap-2">
                                    {sheetNames.map(name => (
                                        <button 
                                            key={name} 
                                            onClick={() => setSheetSelection(prev => ({...prev, quality: name}))}
                                            className={`p-4 rounded-2xl border-2 text-right transition flex justify-between items-center ${sheetSelection.quality === name ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-sm' : 'border-slate-100 hover:border-slate-300 text-slate-600'}`}
                                        >
                                            <span className="font-bold">{name}</span>
                                            {sheetSelection.quality === name && <CheckCircle2 className="w-5 h-5" />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-4">
                                <label className="flex items-center gap-2 font-bold text-slate-700">
                                    <AlertCircle className="w-4 h-4 text-emerald-500" />
                                    کدام شیت شامل داده‌های تناژ تولید است؟
                                </label>
                                <div className="grid grid-cols-1 gap-2">
                                    {sheetNames.map(name => (
                                        <button 
                                            key={name} 
                                            onClick={() => setSheetSelection(prev => ({...prev, tonnage: name}))}
                                            className={`p-4 rounded-2xl border-2 text-right transition flex justify-between items-center ${sheetSelection.tonnage === name ? 'border-emerald-600 bg-emerald-50 text-emerald-700 shadow-sm' : 'border-slate-100 hover:border-slate-300 text-slate-600'}`}
                                        >
                                            <span className="font-bold">{name}</span>
                                            {sheetSelection.tonnage === name && <CheckCircle2 className="w-5 h-5" />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="animate-in fade-in slide-in-from-left-4">
                            {renderColumnMapper('quality', qualityPreview)}
                            {renderColumnMapper('tonnage', tonnagePreview)}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {!isProcessing && (
                    <div className="px-8 py-5 border-t bg-slate-50 flex justify-between items-center">
                        <button 
                            onClick={() => step === 2 ? setStep(1) : onCancel()} 
                            className="px-6 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-200 transition flex items-center gap-2"
                        >
                            <ChevronRight className="w-4 h-4" />
                            {step === 2 ? 'بازگشت به انتخاب شیت' : 'انصراف'}
                        </button>
                        
                        {step === 1 ? (
                            <button 
                                disabled={!sheetSelection.quality && !sheetSelection.tonnage}
                                onClick={() => setStep(2)}
                                className="px-8 py-2.5 rounded-xl font-bold bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2"
                            >
                                تایید و تعیین ستون‌ها
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                        ) : (
                            <button 
                                onClick={processFinalData}
                                className="px-8 py-2.5 rounded-xl font-bold bg-slate-900 text-white hover:bg-slate-800 transition shadow-lg flex items-center gap-2"
                            >
                                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                                پردازش نهایی و ثبت داده‌ها
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
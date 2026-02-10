import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as Lucide from 'lucide-react';
import * as XLSX from 'xlsx';
import { AppConfig, DailyRecord, Profile, SamplingMode } from './types';
import { parseDateString, pad, calculateTotalImpactFromRecords } from './utils';
import { DataGrid } from './components/DataTables';
import { ChartsTab } from './components/Charts';
import { RuleConfigModal } from './components/Modals';
import { ImportWizard } from './components/ImportWizard';
import { analyzeQualityData } from './services/geminiService';
import { PeriodicReport } from './components/PeriodicReport';
import { dbService } from './services/dbService';

const DEFAULT_PROFILES: Profile[] = [
    {
        id: 'ccs_fixed', name: 'قوانین قرارداد (استاندارد)', readonly: false,
        rules: [
            { min: 0, minOp: 'ge', max: 65, maxOp: 'lt', label: 'غیرقابل قبول (REj)', type: 'danger', factor: -100 },
            { min: 65, minOp: 'gt', max: 70, maxOp: 'le', label: 'دو درصد جریمه تناژ', type: 'warning', factor: -2 },
            { min: 70, minOp: 'gt', max: 73, maxOp: 'le', label: 'یک درصد جریمه تناژ', type: 'warning', factor: -1 },
            { min: 73, minOp: 'gt', max: 75, maxOp: 'le', label: 'نیم درصد جریمه تناژ', type: 'warning', factor: -0.5 },
            { min: 75, minOp: 'gt', max: 80, maxOp: 'lt', label: 'تایید (بدون جریمه)', type: 'success', factor: 0 },
            { min: 80, minOp: 'ge', max: 83, maxOp: 'lt', label: 'نیم درصد پاداش', type: 'success', factor: 0.5 },
            { min: 83, minOp: 'ge', max: 85, maxOp: 'lt', label: 'یک درصد پاداش', type: 'success', factor: 1 },
            { min: 85, minOp: 'ge', max: 90, maxOp: 'lt', label: 'یک و نیم درصد پاداش', type: 'success', factor: 1.5 },
            { min: 90, minOp: 'ge', max: 1000, maxOp: 'lt', label: 'دو درصد پاداش', type: 'success', factor: 2 },
        ]
    },
    {
        id: 'ccs_custom', name: 'قوانین جدید (سفارشی)', readonly: false,
        rules: [
            { min: 0, minOp: 'ge', max: 65, maxOp: 'lt', label: 'REj', type: 'danger', factor: -100 },
            { min: 65, minOp: 'ge', max: 1000, maxOp: 'lt', label: 'تایید', type: 'success', factor: 0 }
        ]
    }
];

const RULES_KEY = "ccs_v3_rules";

export default function App() {
    const [config, setConfig] = useState<AppConfig>({ 
        year: 1403, 
        month: 11, 
        minRange: 260, 
        maxRange: 310, 
        customMinRange: 260, 
        customMaxRange: 310 
    });
    const [range, setRange] = useState({ startYear: 1403, startMonth: 1, endYear: 1403, endMonth: 12 });
    const [data, setData] = useState<DailyRecord[]>([]);
    const [profiles, setProfiles] = useState<Profile[]>(() => JSON.parse(localStorage.getItem(RULES_KEY) || 'null') || DEFAULT_PROFILES);
    const [activeTab, setActiveTab] = useState('data');
    const [samplingMode, setSamplingMode] = useState<SamplingMode>('2h');
    const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
    const [analysisResult, setAnalysisResult] = useState("");
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isWizardOpen, setIsWizardOpen] = useState(false);
    const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
    
    const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error' | 'local' | 'config_missing'>('syncing');
    const isFirstLoad = useRef(true);

    useEffect(() => {
        const initData = async () => {
            setSyncStatus('syncing');
            const result = await dbService.loadData();
            setData(result.data);
            setSyncStatus(result.status);
            isFirstLoad.current = false;
        };
        initData();
    }, []);

    useEffect(() => {
        if (isFirstLoad.current) return;
        const timer = setTimeout(async () => {
            setSyncStatus('syncing');
            const status = await dbService.saveData(data);
            setSyncStatus(status);
        }, 2000);
        return () => clearTimeout(timer);
    }, [data]);

    useEffect(() => {
        localStorage.setItem(RULES_KEY, JSON.stringify(profiles));
    }, [profiles]);

    const filteredData = useMemo(() => {
        return data.filter(r => {
            const p = parseDateString(r.dateStr);
            return p && p.year === config.year && p.month === config.month;
        });
    }, [data, config]);

    const currentImpacts = useMemo(() => {
        let recordsToCalc = activeTab === 'report' ? data : filteredData;
        return calculateTotalImpactFromRecords(recordsToCalc, config, profiles, samplingMode);
    }, [data, filteredData, activeTab, config, profiles, samplingMode]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const ab = await file.arrayBuffer();
        const wb = XLSX.read(ab, { type: 'array' });
        setWorkbook(wb);
        setIsWizardOpen(true);
    };

    const handleAIAnalysis = async () => {
        setIsAnalyzing(true);
        const result = await analyzeQualityData(filteredData, config);
        setAnalysisResult(result);
        setIsAnalyzing(false);
    };

    const monthsList = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
    const yearsList = [1401, 1402, 1403, 1404, 1405];

    return (
        <div className="min-h-screen p-4 md:p-8 bg-slate-50 text-slate-900" dir="rtl">
            <header className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row justify-between items-center gap-6 bg-white p-6 rounded-[2.5rem] border shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="bg-blue-600 p-4 rounded-3xl text-white shadow-lg shadow-blue-200">
                        <Lucide.LayoutDashboard size={28}/>
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-800 tracking-tight">پنل هوشمند مدیریت کیفی</h1>
                        <div className="flex items-center gap-2 mt-1">
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Stable Core v4.2</p>
                            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black border transition-colors ${
                                syncStatus === 'synced' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                syncStatus === 'syncing' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                syncStatus === 'config_missing' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                syncStatus === 'error' ? 'bg-red-50 text-red-600 border-red-100' :
                                'bg-slate-50 text-slate-500 border-slate-100'
                            }`}>
                                {syncStatus === 'synced' && <><Lucide.Cloud size={10}/> متصل به ابر</>}
                                {syncStatus === 'syncing' && <><Lucide.RefreshCw size={10} className="animate-spin"/> در حال ذخیره...</>}
                                {syncStatus === 'config_missing' && <><Lucide.Settings2 size={10}/> نیاز به تنظیم کلیدهای ورسل</>}
                                {syncStatus === 'error' && <><Lucide.AlertCircle size={10}/> خطای دیتابیس</>}
                                {syncStatus === 'local' && <><Lucide.HardDrive size={10}/> حالت آفلاین (Local)</>}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex gap-3">
                    <label className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-sm cursor-pointer hover:bg-slate-800 transition shadow-xl active:scale-95 flex items-center gap-2">
                        <Lucide.FileUp size={18} className="text-blue-400"/>
                        واردات اکسل
                        <input type="file" hidden accept=".xlsx" onChange={handleFileUpload} />
                    </label>
                </div>
            </header>

            {syncStatus === 'config_missing' && (
                <div className="max-w-7xl mx-auto mb-6 bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-center gap-4 text-amber-800 animate-pulse">
                    <Lucide.AlertTriangle className="flex-shrink-0" />
                    <p className="text-xs font-bold">
                        توجه: کلیدهای دیتابیس Supabase در پنل ورسل ست نشده‌اند. سیستم فعلاً داده‌ها را در مرورگر شما ذخیره می‌کند. برای دائمی شدن، متغیرهای محیطی را در تنظیمات ورسل وارد کنید.
                    </p>
                </div>
            )}

            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-8">
                <aside className="space-y-6">
                    <div className="bg-white p-6 rounded-[2rem] border shadow-sm space-y-4">
                        <h3 className="font-bold text-slate-700 flex items-center gap-2 border-b pb-2">
                            <Lucide.Zap size={18} className="text-amber-500"/> نحوه محاسبه
                        </h3>
                        <div className="grid grid-cols-1 gap-2">
                            {[
                                { id: '2h', label: 'دو ساعته (معمولی)', icon: <Lucide.Clock size={14}/> },
                                { id: 'shift', label: 'شیفتی (میانگین ۴ عدد)', icon: <Lucide.Users size={14}/> },
                                { id: 'daily', label: 'روزانه (میانگین روز)', icon: <Lucide.CalendarDays size={14}/> },
                            ].map(mode => (
                                <button
                                    key={mode.id}
                                    onClick={() => setSamplingMode(mode.id as SamplingMode)}
                                    className={`flex items-center gap-3 p-3 rounded-xl font-bold text-xs transition-all ${samplingMode === mode.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                                >
                                    {mode.icon}
                                    {mode.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-[2rem] border shadow-sm space-y-6">
                        <h3 className="font-bold text-slate-700 flex items-center gap-2 border-b pb-2">
                            <Lucide.Filter size={18} className="text-blue-500"/> تنظیمات کلی
                        </h3>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 block mb-2 uppercase">سال</label>
                                    <select 
                                        value={config.year} 
                                        onChange={e => setConfig({...config, year: Number(e.target.value)})}
                                        className="w-full bg-slate-50 border rounded-xl p-3 font-bold text-sm outline-none ring-2 ring-transparent focus:ring-blue-500 transition"
                                    >
                                        {yearsList.map(y => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 block mb-2 uppercase">ماه</label>
                                    <select 
                                        value={config.month} 
                                        onChange={e => setConfig({...config, month: Number(e.target.value)})}
                                        className="w-full bg-slate-50 border rounded-xl p-3 font-bold text-sm outline-none ring-2 ring-transparent focus:ring-blue-500 transition"
                                    >
                                        {monthsList.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
                                    </select>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2">
                                <div className="bg-slate-50 p-2 rounded-xl border">
                                    <label className="text-[8px] font-black text-slate-400 block mb-1">MIN CCS</label>
                                    <input type="number" value={config.minRange} onChange={e=>setConfig({...config, minRange: Number(e.target.value)})} className="w-full bg-transparent text-center font-bold text-blue-600 outline-none"/>
                                </div>
                                <div className="bg-slate-50 p-2 rounded-xl border">
                                    <label className="text-[8px] font-black text-slate-400 block mb-1">MAX CCS</label>
                                    <input type="number" value={config.maxRange} onChange={e=>setConfig({...config, maxRange: Number(e.target.value)})} className="w-full bg-transparent text-center font-bold text-blue-600 outline-none"/>
                                </div>
                            </div>
                            <button onClick={()=>setIsRuleModalOpen(true)} className="w-full bg-white border border-slate-200 p-3 rounded-xl text-[10px] font-black text-slate-500 hover:bg-slate-50 transition uppercase tracking-widest flex justify-center items-center gap-2">
                                <Lucide.Settings size={14}/> مدیریت فرمول‌ها
                            </button>
                        </div>
                    </div>

                    <div className="bg-slate-900 text-white p-6 rounded-[2rem] shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-5 rotate-12 scale-150">
                            <Lucide.TrendingUp size={100}/>
                        </div>
                        <div className="relative z-10 space-y-4">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-800 block pb-2">برآیند مالی ماه</span>
                            <div>
                                <span className="text-[9px] text-slate-500 block mb-1">تاثیر جریمه/پاداش (تن):</span>
                                <div className={`text-2xl font-black font-mono ${currentImpacts.fixed >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {currentImpacts.fixed > 0 ? '+' : ''}{Math.round(currentImpacts.fixed).toLocaleString()}
                                </div>
                            </div>
                            <div className="pt-2 mt-2 border-t border-slate-800">
                                <div className="flex justify-between items-center text-[10px]">
                                    <span className="text-slate-500">مجموع تناژ:</span>
                                    <span className="font-bold text-slate-300">{Math.round(currentImpacts.tonnage).toLocaleString()} T</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </aside>

                <main className="lg:col-span-3 space-y-6">
                    <div className="flex bg-white/50 p-2 rounded-[2.5rem] border backdrop-blur-md">
                        <button onClick={()=>setActiveTab('data')} className={`flex-1 py-4 rounded-3xl font-black text-xs transition ${activeTab==='data' ? 'bg-white shadow-xl text-blue-600' : 'text-slate-400'}`}>مشاهده داده‌ها</button>
                        <button onClick={()=>setActiveTab('charts')} className={`flex-1 py-4 rounded-3xl font-black text-xs transition ${activeTab==='charts' ? 'bg-white shadow-xl text-indigo-600' : 'text-slate-400'}`}>نمودار عملکرد</button>
                        <button onClick={()=>setActiveTab('report')} className={`flex-1 py-4 rounded-3xl font-black text-xs transition ${activeTab==='report' ? 'bg-white shadow-xl text-emerald-600' : 'text-slate-400'}`}>گزارش دوره‌ای</button>
                        <button onClick={()=>setActiveTab('ai')} className={`flex-1 py-4 rounded-3xl font-black text-xs transition ${activeTab==='ai' ? 'bg-white shadow-xl text-purple-600' : 'text-slate-400'}`}>تحلیل هوشمند</button>
                    </div>

                    <div className="bg-white p-8 rounded-[3rem] border shadow-sm min-h-[600px]">
                        {activeTab === 'report' && (
                            <div className="mb-10 bg-slate-50 p-6 rounded-3xl border border-slate-200">
                                <h4 className="text-sm font-black text-slate-700 mb-4 flex items-center gap-2">
                                    <Lucide.CalendarRange size={18} className="text-emerald-500"/> تنظیم بازه گزارش
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-3">
                                        <span className="text-[10px] font-black text-slate-400 uppercase">از تاریخ:</span>
                                        <div className="grid grid-cols-2 gap-2">
                                            <select value={range.startYear} onChange={e=>setRange({...range, startYear: Number(e.target.value)})} className="bg-white border rounded-xl p-2 font-bold text-xs">
                                                {yearsList.map(y => <option key={y} value={y}>{y}</option>)}
                                            </select>
                                            <select value={range.startMonth} onChange={e=>setRange({...range, startMonth: Number(e.target.value)})} className="bg-white border rounded-xl p-2 font-bold text-xs">
                                                {monthsList.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <span className="text-[10px] font-black text-slate-400 uppercase">تا تاریخ:</span>
                                        <div className="grid grid-cols-2 gap-2">
                                            <select value={range.endYear} onChange={e=>setRange({...range, endYear: Number(e.target.value)})} className="bg-white border rounded-xl p-2 font-bold text-xs">
                                                {yearsList.map(y => <option key={y} value={y}>{y}</option>)}
                                            </select>
                                            <select value={range.endMonth} onChange={e=>setRange({...range, endMonth: Number(e.target.value)})} className="bg-white border rounded-xl p-2 font-bold text-xs">
                                                {monthsList.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'data' && <DataGrid data={filteredData} config={config} profiles={profiles} samplingMode={samplingMode} onUpdateTonnage={() => {}} />}
                        {activeTab === 'charts' && <ChartsTab data={filteredData} config={config} samplingMode={samplingMode} />}
                        {activeTab === 'report' && <PeriodicReport data={data} range={range} config={config} profiles={profiles} samplingMode={samplingMode} />}
                        {activeTab === 'ai' && (
                            <div className="space-y-6">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                        <Lucide.Sparkles className="text-purple-600"/> تحلیل عمیق Gemini
                                    </h3>
                                    <button onClick={handleAIAnalysis} disabled={isAnalyzing} className="bg-purple-600 text-white px-8 py-3 rounded-2xl font-black shadow-lg hover:bg-purple-700 transition active:scale-95 disabled:opacity-50">
                                        {isAnalyzing ? 'در حال تحلیل...' : 'شروع تحلیل هوشمند'}
                                    </button>
                                </div>
                                <div className="bg-slate-50 p-10 rounded-[3rem] border border-dashed border-slate-300 min-h-[300px] leading-relaxed text-slate-700 whitespace-pre-wrap font-medium">
                                    {analysisResult || "برای دریافت تحلیل بر اساس داده‌های این ماه، روی دکمه بالا کلیک کنید."}
                                </div>
                            </div>
                        )}
                    </div>
                </main>
            </div>

            {isWizardOpen && workbook && (
                <ImportWizard 
                    workbook={workbook} 
                    onComplete={(newData) => { setData(newData); setIsWizardOpen(false); }} 
                    onCancel={() => setIsWizardOpen(false)} 
                />
            )}

            <RuleConfigModal profiles={profiles} setProfiles={setProfiles} isOpen={isRuleModalOpen} onClose={() => setIsRuleModalOpen(false)} />
        </div>
    );
}
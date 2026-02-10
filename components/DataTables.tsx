import React from 'react';
import { DailyRecord, AppConfig, Profile, SamplingMode } from '../types';
import { getCellColor, pad, checkRuleMatch, getAggregatedValues, TIME_SLOTS_2H } from '../utils';
import { Activity, CheckCircle2, AlertTriangle, TrendingUp, Info } from 'lucide-react';

interface DataGridProps {
    data: DailyRecord[];
    config: AppConfig;
    profiles: Profile[];
    onUpdateTonnage: (dateStr: string, val: number) => void;
    samplingMode: SamplingMode;
}

export const DataGrid: React.FC<DataGridProps> = ({ data, config, profiles, samplingMode }) => {
    const weekGroups = [
        { id: 1, name: 'هفته اول', days: [1,2,3,4,5,6,7] },
        { id: 2, name: 'هفته دوم', days: [8,9,10,11,12,13,14] },
        { id: 3, name: 'هفته سوم', days: [15,16,17,18,19,20,21,22] },
        { id: 4, name: 'هفته چهارم', days: Array.from({length:10},(_,i)=>i+23) }
    ];

    const getDaysInMonth = (m: number) => (m <= 6 ? 31 : m <= 11 ? 30 : 29);
    const maxDays = getDaysInMonth(config.month);

    let monthTotalTonnage = 0;
    let monthFixedImpact = 0;
    let monthCustomImpact = 0;

    let headers: string[] = [];
    if (samplingMode === '2h') headers = TIME_SLOTS_2H;
    else if (samplingMode === 'shift') headers = ["شیفت A", "شیفت B", "شیفت C"];
    else if (samplingMode === 'daily') headers = ["میانگین روزانه"];

    const colCount = headers.length;

    return (
        <div className="flex flex-col gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-center text-sm border-collapse">
                    <thead className="bg-slate-100 text-slate-600 border-b">
                        <tr>
                            <th className="py-3 px-4 sticky right-0 bg-slate-100 z-10 border-l">تاریخ</th>
                            <th className="py-3 px-2 min-w-[80px] text-blue-700 border-l">تناژ</th>
                            {headers.map((h, i) => <th key={i} className="py-3 px-1">{h}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {weekGroups.map(week => {
                            const weekDays = week.days.filter(d => d <= maxDays);
                            if(weekDays.length === 0) return null;

                            let weekTon = 0;
                            let weekTotalPoints = 0;
                            
                            let fOk = 0, fHigh = 0, fLow = 0;
                            let cOk = 0, cHigh = 0, cLow = 0;

                            const weekRows = weekDays.map(dayNum => {
                                const dateStr = `${config.year}/${pad(config.month)}/${pad(dayNum)}`;
                                const record = data.find(r => r.dateStr === dateStr) || { day: dayNum, dateStr, tonnage: 0, dataPoints: [] };
                                
                                if(record.tonnage) {
                                    weekTon += Number(record.tonnage);
                                }
                                
                                const points = getAggregatedValues(record, samplingMode);
                                
                                points.forEach(val => {
                                    if(!isNaN(val) && val !== 0 && val !== undefined) {
                                        weekTotalPoints++;
                                        if(val >= config.minRange && val <= config.maxRange) fOk++;
                                        else if(val > config.maxRange) fHigh++;
                                        else fLow++;
                                        if(val >= config.customMinRange && val <= config.customMaxRange) cOk++;
                                        else if(val > config.customMaxRange) cHigh++;
                                        else cLow++;
                                    }
                                });

                                return { dayNum, record, points };
                            });

                            const fixedPct = weekTotalPoints > 0 ? (fOk / weekTotalPoints) * 100 : 0;
                            const customPct = weekTotalPoints > 0 ? (cOk / weekTotalPoints) * 100 : 0;
                            const fixedRule = profiles.find(p=>p.id==='ccs_fixed')?.rules.find(r=>checkRuleMatch(fixedPct, r));
                            const customRule = profiles.find(p=>p.id==='ccs_custom')?.rules.find(r=>checkRuleMatch(customPct, r));
                            const fixedImpact = weekTon * (fixedRule?.factor || 0) / 100;
                            const customImpact = weekTon * (customRule?.factor || 0) / 100;

                            monthTotalTonnage += weekTon;
                            monthFixedImpact += fixedImpact;
                            monthCustomImpact += customImpact;

                            return (
                                <React.Fragment key={week.id}>
                                    <tr className="bg-slate-50 border-y border-slate-200">
                                        <td colSpan={colCount + 2} className="py-2 px-4 text-right font-bold text-slate-500 text-xs">
                                            {week.name}
                                        </td>
                                    </tr>
                                    {weekRows.map(({ record, points }) => {
                                        const pointCells = Array.from({length: colCount}).map((_, idx) => {
                                            const val = points[idx];
                                            const displayVal = (!isNaN(val) && val !== undefined) ? Number(val).toFixed(1) : '';
                                            return (
                                                 <td key={idx} className="p-1">
                                                    <div className={`w-full py-1 rounded text-xs font-bold border ${getCellColor(Number(displayVal), config.customMinRange, config.customMaxRange)}`}>
                                                        {displayVal}
                                                    </div>
                                                </td>
                                            );
                                        });

                                        return (
                                            <tr key={record.dateStr} className="hover:bg-blue-50/30 border-b border-slate-50 last:border-none">
                                                <td className="py-2 px-4 font-bold text-slate-700 bg-white sticky right-0 border-l shadow-[2px_0_5px_rgba(0,0,0,0.02)] z-10">{record.dateStr}</td>
                                                <td className="p-1 border-l bg-blue-50/10 text-center font-bold text-slate-600 font-mono text-xs">
                                                    {record.tonnage ? record.tonnage.toLocaleString() : '-'}
                                                </td>
                                                {pointCells}
                                            </tr>
                                        );
                                    })}
                                    <tr className="bg-slate-50/80 border-t-2 border-slate-300">
                                        <td className="py-4 px-4 text-right sticky right-0 bg-slate-50/80 z-10 border-l align-top">
                                            <div className="font-bold text-slate-700 text-sm">خلاصه {week.name}</div>
                                            <div className="text-[10px] text-slate-400 mt-1">محاسبات سیستمی</div>
                                        </td>
                                        <td className="py-4 px-2 align-top border-l bg-blue-50/20">
                                            <div className="flex flex-col items-center">
                                                <span className="text-[10px] text-slate-400 font-bold mb-1">تناژ هفته</span>
                                                <span className="text-sm font-black text-blue-700 dir-ltr">{weekTon.toLocaleString()} T</span>
                                            </div>
                                        </td>
                                        <td colSpan={colCount} className="py-4 px-6">
                                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                                <div className="flex flex-col gap-2 border-l border-slate-200 pl-4">
                                                    <div className="flex items-center justify-between text-xs">
                                                        <span className="text-slate-500 flex items-center gap-1"><Activity className="w-3 h-3"/> کل نمونه‌ها:</span>
                                                        <span className="font-bold text-slate-700">{weekTotalPoints}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between text-xs">
                                                        <span className="text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> در رنج ({config.minRange}-{config.maxRange}):</span>
                                                        <span className="font-bold text-emerald-700">{fOk}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between text-xs">
                                                        <span className="text-red-500 flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> خارج از رنج:</span>
                                                        <span className="font-bold text-red-600">{fLow + fHigh}</span>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col justify-center items-center gap-1 border-l border-slate-200 px-4">
                                                    <span className="text-[10px] text-slate-400 font-bold">درصد انطباق هفته</span>
                                                    <div className="flex items-baseline gap-1">
                                                        <span className="text-xl font-black text-slate-800">{fixedPct.toFixed(1)}</span>
                                                        <span className="text-xs text-slate-500">%</span>
                                                    </div>
                                                    <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden mt-1">
                                                        <div className={`h-full transition-all duration-500 ${fixedPct >= 80 ? 'bg-emerald-500' : fixedPct >= 65 ? 'bg-orange-500' : 'bg-red-500'}`} style={{width: `${fixedPct}%`}}></div>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col justify-center items-center gap-1 border-l border-slate-200 px-4">
                                                    <span className="text-[10px] text-slate-400 font-bold">تاثیر مالی (استاندارد)</span>
                                                    <div className={`text-sm font-black dir-ltr ${fixedImpact >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                        {fixedImpact > 0 ? '+' : ''}{Math.round(fixedImpact).toLocaleString()} <span className="text-[10px]">T</span>
                                                    </div>
                                                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-500 border">{fixedRule?.label || 'فاقد قانون'}</span>
                                                </div>
                                                <div className="flex flex-col justify-center items-center gap-1 px-4">
                                                    <span className="text-[10px] text-slate-400 font-bold">تاثیر مالی (سفارشی)</span>
                                                    <div className={`text-sm font-black dir-ltr ${customImpact >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                        {customImpact > 0 ? '+' : ''}{Math.round(customImpact).toLocaleString()} <span className="text-[10px]">T</span>
                                                    </div>
                                                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-500 border">{customRule?.label || 'فاقد قانون'}</span>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
        <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl border border-slate-800 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-3 opacity-10"><TrendingUp className="w-24 h-24 text-white"/></div>
            <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="flex flex-col items-center border-l border-slate-800">
                    <span className="text-slate-400 text-xs font-bold mb-2 flex items-center gap-1"><Info className="w-3 h-3"/> مجموع تولید ماه</span>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-black text-blue-400 font-mono">{Math.round(monthTotalTonnage).toLocaleString()}</span>
                        <span className="text-sm text-slate-500 font-bold">Tons</span>
                    </div>
                </div>
                <div className="flex flex-col items-center border-l border-slate-800">
                    <span className="text-slate-400 text-xs font-bold mb-2">برآیند مالی ماه (استاندارد)</span>
                    <div className="flex items-baseline gap-2">
                        <span className={`text-3xl font-black font-mono ${monthFixedImpact >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {monthFixedImpact > 0 ? '+' : ''}{Math.round(monthFixedImpact).toLocaleString()}
                        </span>
                        <span className="text-sm text-slate-500 font-bold">Tons</span>
                    </div>
                </div>
                <div className="flex flex-col items-center">
                    <span className="text-slate-400 text-xs font-bold mb-2">برآیند مالی ماه (سفارشی)</span>
                    <div className="flex items-baseline gap-2">
                        <span className={`text-3xl font-black font-mono ${monthCustomImpact >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {monthCustomImpact > 0 ? '+' : ''}{Math.round(monthCustomImpact).toLocaleString()}
                        </span>
                        <span className="text-sm text-slate-500 font-bold">Tons</span>
                    </div>
                </div>
            </div>
        </div>
        </div>
    );
};
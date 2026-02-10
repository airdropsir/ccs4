import React, { useMemo } from 'react';
import { DailyRecord, AppConfig, Profile, SamplingMode } from '../types';
import { calculateWeekStats, calculateTotalImpactFromRecords, pad } from '../utils';
import { Info, AlertOctagon, Calendar, TrendingUp } from 'lucide-react';

interface PeriodicReportProps {
    data: DailyRecord[];
    range: { startYear: number; startMonth: number; endYear: number; endMonth: number };
    config: AppConfig;
    profiles: Profile[];
    samplingMode: SamplingMode;
}

export const PeriodicReport: React.FC<PeriodicReportProps> = ({ data, range, config, profiles, samplingMode }) => {
    
    const monthsList = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];

    const periodSummary = useMemo(() => {
        const startStr = `${range.startYear}/${pad(range.startMonth)}/01`;
        const endStr = `${range.endYear}/${pad(range.endMonth)}/31`;
        const periodRecords = data.filter(d => d.dateStr >= startStr && d.dateStr <= endStr);
        return calculateTotalImpactFromRecords(periodRecords, config, profiles, samplingMode);
    }, [data, range, config, profiles, samplingMode]);

    const reportRows = useMemo(() => {
        const rows = [];
        let currentYear = range.startYear;
        let currentMonth = range.startMonth;

        while (true) {
            if (currentYear > range.endYear || (currentYear === range.endYear && currentMonth > range.endMonth)) break;

            const monthKey = `${currentYear}/${pad(currentMonth)}`;
            const monthRecords = data.filter(d => d.dateStr.startsWith(monthKey));

            const weekData = [
                { id: 1, name: 'هفته ۱', days: [1,2,3,4,5,6,7] },
                { id: 2, name: 'هفته ۲', days: [8,9,10,11,12,13,14] },
                { id: 3, name: 'هفته ۳', days: [15,16,17,18,19,20,21,22] },
                { id: 4, name: 'هفته ۴+', days: Array.from({length:10},(_,i)=>i+23) }
            ].map(w => {
                const wRecs = monthRecords.filter(r => {
                    const d = parseInt(r.dateStr.split('/')[2]);
                    return w.days.includes(d);
                });
                const stats = calculateWeekStats(wRecs, config, profiles, samplingMode);
                return { stats, name: w.name };
            });

            const monthTotalFixed = weekData.reduce((sum, w) => sum + w.stats.impact.fixed, 0);

            rows.push({
                year: currentYear,
                month: currentMonth,
                monthName: monthsList[currentMonth - 1],
                weeks: weekData,
                monthTotalFixed
            });

            currentMonth++;
            if (currentMonth > 12) {
                currentMonth = 1;
                currentYear++;
            }
        }
        return rows;
    }, [data, range, config, profiles, samplingMode]);

    if (reportRows.length === 0) {
        return <div className="p-20 text-center text-slate-400 font-black bg-white rounded-3xl border-2 border-dashed">داده‌ای برای این بازه زمانی یافت نشد.</div>;
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-900 rounded-3xl p-5 border border-slate-700 shadow-xl">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">کل برآیند استاندارد دوره</span>
                    <div className={`text-2xl font-black font-mono ${periodSummary.fixed >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {periodSummary.fixed > 0 ? '+' : ''}{Math.round(periodSummary.fixed).toLocaleString()} <span className="text-xs text-slate-500">T</span>
                    </div>
                </div>
                <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">کل برآیند سفارشی دوره</span>
                    <div className={`text-2xl font-black font-mono ${periodSummary.custom >= 0 ? 'text-blue-600' : 'text-orange-500'}`}>
                        {periodSummary.custom > 0 ? '+' : ''}{Math.round(periodSummary.custom).toLocaleString()} <span className="text-xs text-slate-400">T</span>
                    </div>
                </div>
                <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">مجموع تناژ تولیدی</span>
                    <div className="text-2xl font-black font-mono text-slate-800">
                        {Math.round(periodSummary.tonnage).toLocaleString()} <span className="text-xs text-slate-400">T</span>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-3xl shadow-lg border border-slate-200 overflow-hidden">
                <div className="p-4 bg-slate-50 border-b flex justify-between items-center">
                    <h4 className="font-black text-slate-700 flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-blue-600"/>
                        گزارش عملکرد از {monthsList[range.startMonth-1]} {range.startYear} تا {monthsList[range.endMonth-1]} {range.endYear}
                    </h4>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-center border-collapse">
                        <thead>
                            <tr className="bg-slate-100/80 text-slate-600 border-b uppercase">
                                <th className="py-5 px-4 sticky right-0 bg-slate-100 z-10 border-l font-black text-xs">ماه و سال</th>
                                <th className="py-5 px-2 border-l text-[10px] font-black">هفته اول</th>
                                <th className="py-5 px-2 border-l text-[10px] font-black">هفته دوم</th>
                                <th className="py-5 px-2 border-l text-[10px] font-black">هفته سوم</th>
                                <th className="py-5 px-2 border-l text-[10px] font-black">هفته چهارم+</th>
                                <th className="py-5 px-5 bg-slate-800 text-white font-black text-xs">جمع مالی ماه</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reportRows.map((row, idx) => (
                                <tr key={idx} className="border-b hover:bg-blue-50/10 transition">
                                    <td className="py-5 px-4 font-black text-slate-800 bg-white sticky right-0 border-l z-10 text-sm">
                                        {row.monthName} <span className="text-slate-400 font-mono text-[10px]">{row.year}</span>
                                    </td>
                                    {row.weeks.map((w, i) => {
                                        const isRej = w.stats.isRej.fixed;
                                        const impact = w.stats.impact.fixed;
                                        return (
                                            <td key={i} className={`p-2 border-l transition-all duration-300 ${isRej ? 'bg-slate-900 text-white' : ''}`}>
                                                <div className="flex flex-col gap-1.5 p-1">
                                                    <div className="flex justify-between items-center gap-2">
                                                        <span className={`text-[8px] font-black uppercase ${isRej ? 'text-slate-500' : 'text-slate-400'}`}>Sample:</span>
                                                        <span className="font-black text-xs font-mono">{w.stats.counts.total}</span>
                                                    </div>
                                                    {w.stats.counts.total > 0 ? (
                                                        <div className={`mt-1 py-1.5 rounded-lg px-2 text-[11px] font-black dir-ltr shadow-sm flex items-center justify-center gap-1 ${
                                                            isRej ? 'bg-red-600 text-white' : 
                                                            impact > 0 ? 'bg-emerald-100 text-emerald-800' : 
                                                            impact < 0 ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-500'
                                                        }`}>
                                                            {impact > 0 ? '+' : ''}{Math.round(impact).toLocaleString()}
                                                        </div>
                                                    ) : (
                                                        <div className="mt-1 py-1.5 rounded-lg px-2 text-[10px] font-black bg-slate-50 text-slate-300 border border-dashed text-center">N/A</div>
                                                    )}
                                                </div>
                                            </td>
                                        );
                                    })}
                                    <td className="py-5 px-5 bg-slate-50 font-black">
                                        <div className={`text-base font-black font-mono tracking-tighter flex items-center justify-center gap-1 dir-ltr ${row.monthTotalFixed >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                            {row.monthTotalFixed > 0 ? '+' : ''}{Math.round(row.monthTotalFixed).toLocaleString()}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex gap-4 items-start relative overflow-hidden">
                <div className="absolute top-0 right-0 w-2 h-full bg-blue-600 opacity-50"></div>
                <div className="bg-blue-50 p-3 rounded-2xl"><Info className="w-6 h-6 text-blue-600" /></div>
                <div>
                    <h5 className="font-black text-slate-800 text-sm mb-1">راهنمای گزارش:</h5>
                    <p className="text-xs text-slate-500 leading-7 font-medium">محاسبات بر اساس بازه زمانی انتخابی و قوانین استاندارد صورت گرفته است.</p>
                </div>
            </div>
        </div>
    );
};
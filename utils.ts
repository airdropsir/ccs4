import { DailyRecord, AppConfig, Profile, Rule, WeekStats, SamplingMode } from './types';

export const pad = (num: any): string => {
    if (num === undefined || num === null) return '00';
    return String(num).padStart(2, '0');
};

export const isValid = (val: any): boolean => {
    if (val === null || val === undefined || String(val).trim() === '') return false;
    const num = Number(String(val).replace(/,/g, ''));
    return !isNaN(num);
};

export const normalizeDate = (dStr: any): string | null => {
    if (!dStr) return null;
    try {
        const str = String(dStr).trim();
        // Handle Excel Serial Date
        if (!isNaN(Number(str)) && Number(str) > 40000) {
                const d = new Date((Number(str) - 25569) * 86400 * 1000);
                if(isNaN(d.getTime())) return null;
                return `${d.getFullYear()}/${pad(d.getMonth()+1)}/${pad(d.getDate())}`;
        }
        // Handle YYYY/MM/DD or YYYY-MM-DD
        const parts = str.split(/[\/\-]/);
        if (parts.length >= 3) {
            let y = parseInt(parts[0]);
            let m = parseInt(parts[1]);
            let d = parseInt(parts[2]);
            
            if (y < 100) y += 1400; 
            
            if(isNaN(y) || isNaN(m) || isNaN(d)) return null;
            return `${y}/${pad(m)}/${pad(d)}`;
        }
        return str;
    } catch(e) { return null; }
};

export const parseDateString = (dateStr: string) => {
    if(!dateStr) return null;
    const parts = String(dateStr).split(/[\/\-]/);
    if (parts.length >= 2) return { year: parseInt(parts[0]), month: parseInt(parts[1]), day: parseInt(parts[2]) };
    return null;
};

export const getHourFromTime = (raw: any): number => {
    if (raw === undefined || raw === null) return -1;
    const str = String(raw).trim().toUpperCase();
    
    // Case 1: Excel numeric time (0 to 0.999)
    if (!isNaN(Number(str)) && str !== '') {
         const num = Number(str);
         if (num < 1 && num >= 0) {
             const totalMinutes = Math.round(num * 24 * 60);
             const h = Math.floor(totalMinutes / 60);
             return h === 24 ? 0 : h;
         }
         if (num >= 0 && num < 24) return Math.floor(num);
    }

    // Case 2: String time "HH:MM" or "HH:MM:SS" or "HH:MM AM/PM"
    const isPM = str.includes('PM');
    const isAM = str.includes('AM');
    
    const timePart = str.replace('AM', '').replace('PM', '').trim();
    const parts = timePart.split(':');
    
    if (parts.length >= 1) {
        let h = parseInt(parts[0]);
        if (isNaN(h)) return -1;

        // Handle 12-hour format AM/PM
        if (isAM || isPM) {
            if (isPM && h < 12) h += 12;
            if (isAM && h === 12) h = 0;
        } else {
            // Handle cases where 00:00 might be written as 24:00
            if (h === 24) h = 0;
        }

        if (h >= 0 && h < 24) return h;
    }
    return -1;
};

export const TIME_SLOTS_2H = ["06:00", "08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00", "22:00", "00:00", "02:00", "04:00"];
const TIME_SLOTS_2H_HOURS = [6, 8, 10, 12, 14, 16, 18, 20, 22, 0, 2, 4];

export const getAggregatedValues = (record: DailyRecord, mode: SamplingMode): number[] => {
    if(!record || !record.dataPoints) return [];
    
    const valMap: {[hour: number]: number} = {};
    
    record.dataPoints.forEach(p => {
        if (p.timeSlot !== undefined && p.timeSlot !== null && isValid(p.value)) {
            const h = getHourFromTime(p.timeSlot);
            if (h !== -1) {
                valMap[h] = Number(String(p.value).replace(/,/g, ''));
            }
        }
    });

    if (mode === '2h') {
        return TIME_SLOTS_2H_HOURS.map(h => valMap[h] !== undefined ? valMap[h] : NaN);
    }

    if (mode === 'shift') {
        const getShiftAvg = (hours: number[]) => {
            const validVals: number[] = [];
            hours.forEach(h => {
                if (valMap[h] !== undefined) validVals.push(valMap[h]);
            });
            if (validVals.length === 0) return NaN;
            return Number((validVals.reduce((a,b)=>a+b, 0) / validVals.length).toFixed(1));
        };
        return [getShiftAvg([6, 8, 10, 12]), getShiftAvg([14, 16, 18, 20]), getShiftAvg([22, 0, 2, 4])];
    }

    if (mode === 'daily') {
        const validValues = Object.values(valMap).filter(v => v !== undefined && !isNaN(v));
        if (validValues.length === 0) return [NaN];
        return [Number((validValues.reduce((a, b) => a + b, 0) / validValues.length).toFixed(1))];
    }

    return [];
};

export const checkRuleMatch = (val: number, rule: Rule): boolean => {
    if (rule.rawCondition === 'x < 65') return val < 65;
    const minOk = rule.minOp === 'lt' ? val > rule.min : val >= rule.min;
    const maxOk = rule.maxOp === 'lt' ? val < rule.max : val <= rule.max;
    return minOk && maxOk;
};

export const getCellColor = (val: number, min: number, max: number): string => {
    if (!isValid(val) || isNaN(val)) return 'text-slate-300';
    const num = Number(val);
    if (num >= min && num <= max) return 'bg-emerald-50 text-emerald-700 border-emerald-100'; 
    if (num > max) return 'bg-orange-50 text-orange-600 border-orange-100'; 
    if (num < min) return 'bg-red-50 text-red-600 border-red-100'; 
    return 'text-slate-700'; 
};

export const calculateWeekStats = (weekRecords: DailyRecord[], config: AppConfig, profiles: Profile[], mode: SamplingMode): WeekStats => {
    let totalCount = 0;
    let totalTonnage = 0;
    let fInRange=0, fLow=0, fHigh=0;
    let cInRange=0, cLow=0, cHigh=0;

    weekRecords.forEach(r => { 
        if(r.tonnage) totalTonnage += Number(r.tonnage);
        const aggregatedValues = getAggregatedValues(r, mode);
        aggregatedValues.forEach(val => {
            if (!isNaN(val) && val !== undefined) {
                totalCount++;
                if(val >= config.minRange && val <= config.maxRange) fInRange++;
                else if (val < config.minRange) fLow++;
                else fHigh++;
                if(val >= config.customMinRange && val <= config.customMaxRange) cInRange++;
                else if (val < config.customMinRange) cLow++;
                else cHigh++;
            }
        });
    });

    if (totalCount === 0) {
        return {
            pct: { fixed: 0, custom: 0 },
            impact: { fixed: 0, custom: 0 },
            factor: { fixed: 0, custom: 0 },
            ruleLabels: { fixed: 'بدون داده', custom: 'بدون داده' },
            isRej: { fixed: false, custom: false },
            style: { fixed: 'text-slate-400', custom: 'text-slate-400' },
            counts: { total: 0, fixed: {inRange:0,low:0,high:0}, custom: {inRange:0,low:0,high:0} },
            totalTonnage
        };
    }

    const fPct = (fInRange / totalCount) * 100;
    const cPct = (cInRange / totalCount) * 100;
    const fProf = profiles.find(p => p.id === 'ccs_fixed');
    const cProf = profiles.find(p => p.id === 'ccs_custom');
    const fMatch = fProf?.rules.find(r => checkRuleMatch(fPct, r));
    const cMatch = cProf?.rules.find(r => checkRuleMatch(cPct, r));

    return {
        pct: { fixed: fPct, custom: cPct },
        impact: { fixed: totalTonnage * (fMatch?.factor || 0) / 100, custom: totalTonnage * (cMatch?.factor || 0) / 100 },
        factor: { fixed: fMatch?.factor || 0, custom: cMatch?.factor || 0 },
        ruleLabels: { fixed: fMatch?.label, custom: cMatch?.label },
        isRej: { fixed: (fMatch?.factor ?? 0) <= -100, custom: (cMatch?.factor ?? 0) <= -100 },
        style: { 
            fixed: fMatch?.type === 'danger' ? 'text-red-600' : fMatch?.type === 'warning' ? 'text-orange-600' : 'text-green-600',
            custom: cMatch?.type === 'danger' ? 'text-red-600' : cMatch?.type === 'warning' ? 'text-orange-600' : 'text-green-600'
        },
        counts: { total: totalCount, fixed: { inRange: fInRange, low: fLow, high: fHigh }, custom: { inRange: cInRange, low: cLow, high: cHigh } },
        totalTonnage
    };
};

/**
 * Ensures consistent financial calculation by iterating over all weeks in a set of records.
 * This should be used for all summaries (Sidebar, Tables, Reports).
 */
export const calculateTotalImpactFromRecords = (records: DailyRecord[], config: AppConfig, profiles: Profile[], mode: SamplingMode) => {
    if (!records || records.length === 0) return { fixed: 0, custom: 0, tonnage: 0 };

    // Group by Month first
    const months: Record<string, DailyRecord[]> = {};
    records.forEach(r => {
        const monthKey = r.dateStr.split('/').slice(0, 2).join('/');
        if (!months[monthKey]) months[monthKey] = [];
        months[monthKey].push(r);
    });

    let totalFixed = 0;
    let totalCustom = 0;
    let totalTon = 0;

    const weekWindows = [
        [1, 7], [8, 14], [15, 22], [23, 31]
    ];

    Object.values(months).forEach(monthRecs => {
        weekWindows.forEach(win => {
            const weekRecs = monthRecs.filter(r => {
                const day = parseInt(r.dateStr.split('/')[2]);
                return day >= win[0] && day <= win[1];
            });
            if (weekRecs.length > 0) {
                const stats = calculateWeekStats(weekRecs, config, profiles, mode);
                totalFixed += stats.impact.fixed;
                totalCustom += stats.impact.custom;
                totalTon += stats.totalTonnage;
            }
        });
    });

    return { fixed: totalFixed, custom: totalCustom, tonnage: totalTon };
};

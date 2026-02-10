
import React, { useState, useEffect } from 'react';
import { ImportConfig, Profile, Rule } from '../types';
// Add Lucide import to fix 'Cannot find name Lucide' errors
import * as Lucide from 'lucide-react';
import { X, Plus, Trash2, Info } from 'lucide-react';

interface ImportConfigModalProps {
    config: ImportConfig;
    onSave: (c: ImportConfig) => void;
    isOpen: boolean;
    onClose: () => void;
}

export const ImportConfigModal: React.FC<ImportConfigModalProps> = ({ config, onSave, isOpen, onClose }) => {
    const [localConfig, setLocalConfig] = useState(config);
    useEffect(() => { if(isOpen) setLocalConfig(config); }, [isOpen, config]);

    if(!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-md flex flex-col animate-[scaleIn_0.3s_ease-out]">
                <div className="p-4 border-b flex justify-between"><h3 className="font-bold">تنظیمات وارد کردن فایل (Excel)</h3><button onClick={onClose}><X className="w-5 h-5"/></button></div>
                <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh]">
                    <div>
                        <h4 className="font-bold text-blue-600 mb-3 border-b pb-1">اطلاعات کیفی (CCS)</h4>
                        <div className="space-y-3">
                            <div><label className="block text-xs font-bold text-slate-500 mb-1">نام شیت (Sheet Name)</label><input value={localConfig.quality.sheetName} onChange={e=>setLocalConfig({...localConfig, quality: {...localConfig.quality, sheetName: e.target.value}})} className="w-full border rounded p-2 text-left dir-ltr"/></div>
                            <div><label className="block text-xs font-bold text-slate-500 mb-1">ستون تاریخ (مثل A)</label><input value={localConfig.quality.dateCol} onChange={e=>setLocalConfig({...localConfig, quality: {...localConfig.quality, dateCol: e.target.value.toUpperCase()}})} className="w-full border rounded p-2 text-center font-bold dir-ltr"/></div>
                            <div><label className="block text-xs font-bold text-slate-500 mb-1">ستون ساعت (مثل B)</label><input value={localConfig.quality.timeCol} onChange={e=>setLocalConfig({...localConfig, quality: {...localConfig.quality, timeCol: e.target.value.toUpperCase()}})} className="w-full border rounded p-2 text-center font-bold dir-ltr"/></div>
                            <div><label className="block text-xs font-bold text-slate-500 mb-1">ستون مقدار CCS (مثل P)</label><input value={localConfig.quality.valueCol} onChange={e=>setLocalConfig({...localConfig, quality: {...localConfig.quality, valueCol: e.target.value.toUpperCase()}})} className="w-full border rounded p-2 text-center font-bold dir-ltr"/></div>
                        </div>
                    </div>
                </div>
                <div className="p-4 border-t flex justify-end gap-2 bg-slate-50">
                    <button onClick={onClose} className="px-4 py-2 text-slate-600">انصراف</button>
                    <button onClick={()=>{onSave(localConfig); onClose();}} className="px-6 py-2 bg-blue-600 text-white rounded-lg">ذخیره تنظیمات</button>
                </div>
            </div>
        </div>
    );
};

interface RuleConfigModalProps {
    profiles: Profile[];
    setProfiles: (p: Profile[]) => void;
    isOpen: boolean;
    onClose: () => void;
}

export const RuleConfigModal: React.FC<RuleConfigModalProps> = ({ profiles, setProfiles, isOpen, onClose }) => {
    const [activeTab, setActiveTab] = useState<'fixed' | 'custom'>('fixed'); 
    if(!isOpen) return null;
    
    const activeProfile = profiles.find(p => p.id === (activeTab === 'fixed' ? 'ccs_fixed' : 'ccs_custom'));
    
    const handleUpdateRule = (profileId: string, idx: number, field: keyof Rule, value: any) => { 
        const newP = [...profiles]; 
        const prof = newP.find(p=>p.id===profileId);
        if(prof) {
            prof.rules[idx] = { ...prof.rules[idx], [field]: value };
            setProfiles(newP); 
        }
    };

    const handleAddRule = (profileId: string) => {
        const newP = [...profiles];
        const prof = newP.find(p=>p.id===profileId);
        if(prof) {
            prof.rules.push({
                min: 0, minOp: 'ge', max: 100, maxOp: 'lt', label: 'شرط جدید', type: 'success', factor: 0
            });
            setProfiles(newP);
        }
    };

    const handleDeleteRule = (profileId: string, idx: number) => {
        if(!confirm('آیا از حذف این شرط اطمینان دارید؟')) return;
        const newP = [...profiles];
        const prof = newP.find(p=>p.id===profileId);
        if(prof) {
            prof.rules.splice(idx, 1);
            setProfiles(newP);
        }
    };
    
    const renderRuleRow = (rule: Rule, idx: number, profileId: string) => (
        <div key={idx} className="grid grid-cols-12 gap-2 items-center p-3 rounded-2xl border bg-white hover:border-blue-200 transition shadow-sm group">
            <div className="col-span-4 flex items-center justify-center gap-1 text-xs font-mono bg-slate-50 p-2 rounded-xl" dir="ltr">
                <input type="number" value={rule.min} onChange={e=>handleUpdateRule(profileId,idx,'min',Number(e.target.value))} className="w-12 text-center outline-none border-b border-dashed bg-transparent focus:border-blue-500"/>
                <select value={rule.minOp} onChange={e=>handleUpdateRule(profileId,idx,'minOp',e.target.value)} className="bg-transparent text-blue-600 font-bold cursor-pointer"><option value="lt">&lt;</option><option value="le">≤</option><option value="gt">&gt;</option><option value="ge">≥</option></select>
                <span className="font-black text-slate-400">X</span>
                <select value={rule.maxOp} onChange={e=>handleUpdateRule(profileId,idx,'maxOp',e.target.value)} className="bg-transparent text-blue-600 font-bold cursor-pointer"><option value="lt">&lt;</option><option value="le">≤</option></select>
                <input type="number" value={rule.max} onChange={e=>handleUpdateRule(profileId,idx,'max',Number(e.target.value))} className="w-12 text-center outline-none border-b border-dashed bg-transparent focus:border-blue-500"/>
            </div>
            <div className="col-span-4 px-2">
                <input value={rule.label} onChange={e=>handleUpdateRule(profileId,idx,'label',e.target.value)} className="w-full text-right outline-none font-bold text-[11px] text-slate-600 focus:text-blue-600" placeholder="عنوان وضعیت..." />
            </div>
            <div className="col-span-2 text-center font-black font-mono text-xs flex items-center justify-center gap-1" dir="ltr">
                <input type="number" value={rule.factor} step="0.1" onChange={e=>handleUpdateRule(profileId,idx,'factor',Number(e.target.value))} className="w-12 text-center outline-none bg-blue-50 rounded-lg p-1 text-blue-700"/>
                <span className="text-[10px] text-slate-400">%</span>
            </div>
            <div className="col-span-2 flex justify-end gap-1">
                 <select 
                    value={rule.type} 
                    onChange={e=>handleUpdateRule(profileId,idx,'type',e.target.value)}
                    className={`text-[10px] font-bold p-1 rounded-lg border outline-none ${rule.type === 'danger' ? 'text-red-500 border-red-100 bg-red-50' : rule.type === 'warning' ? 'text-orange-500 border-orange-100 bg-orange-50' : 'text-emerald-500 border-emerald-100 bg-emerald-50'}`}
                >
                    <option value="success">تایید</option>
                    <option value="warning">هشدار</option>
                    <option value="danger">REj</option>
                </select>
                <button onClick={()=>handleDeleteRule(profileId, idx)} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                    <Trash2 size={14}/>
                </button>
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-[2.5rem] w-full max-w-4xl max-h-[90vh] flex flex-col animate-[scaleIn_0.3s_ease-out] shadow-2xl overflow-hidden border border-white/20">
                <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-600 p-2 rounded-xl text-white"><Lucide.Settings size={20}/></div>
                        <h3 className="font-black text-slate-800">مدیریت هوشمند فرمول‌ها و ضرایب</h3>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition"><X size={20} /></button>
                </div>
                
                <div className="flex bg-slate-100/50 p-1 m-4 rounded-2xl border">
                    <button onClick={()=>setActiveTab('fixed')} className={`flex-1 py-3 rounded-xl font-black text-xs transition flex items-center justify-center gap-2 ${activeTab==='fixed'?'bg-white shadow-sm text-blue-600':'text-slate-400'}`}>
                        <Lucide.ShieldCheck size={16}/> قوانین استاندارد قرارداد
                    </button>
                    <button onClick={()=>setActiveTab('custom')} className={`flex-1 py-3 rounded-xl font-black text-xs transition flex items-center justify-center gap-2 ${activeTab==='custom'?'bg-white shadow-sm text-purple-600':'text-slate-400'}`}>
                        <Lucide.PenTool size={16}/> قوانین سفارشی کاربر
                    </button>
                </div>

                <div className="px-6 py-2 overflow-y-auto flex-1 space-y-3">
                    <div className="grid grid-cols-12 px-4 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b mb-2">
                        <div className="col-span-4 text-center">محدوده درصد انطباق (X)</div>
                        <div className="col-span-4 text-center">برچسب وضعیت</div>
                        <div className="col-span-2 text-center">ضریب تاثیر تناژ</div>
                        <div className="col-span-2 text-center">عملیات</div>
                    </div>
                    
                    {activeProfile?.rules.map((r,i)=>renderRuleRow(r,i, activeProfile.id))}
                    
                    <button 
                        onClick={() => handleAddRule(activeProfile?.id || '')}
                        className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 transition font-black text-xs flex items-center justify-center gap-2 group"
                    >
                        <Plus size={18} className="group-hover:scale-125 transition"/> افزودن شرط جدید به لیست
                    </button>
                </div>

                <div className="p-6 border-t flex justify-between items-center bg-slate-50">
                    <div className="flex items-center gap-2 text-blue-600 bg-blue-50 px-4 py-2 rounded-xl border border-blue-100">
                        <Info size={16}/>
                        <span className="text-[10px] font-black">تغییرات به صورت خودکار ذخیره می‌شوند.</span>
                    </div>
                    <button onClick={onClose} className="px-10 py-3 bg-slate-900 text-white rounded-2xl font-black text-sm hover:bg-slate-800 transition shadow-xl active:scale-95">بستن و بازگشت</button>
                </div>
            </div>
        </div>
    );
};

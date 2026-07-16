import React from 'react';
import { Icon } from './Icons';
import { CellType } from '../domain/types';
import { EditorTool } from '../App';

interface ToolDockProps {
  status: 'EDITING' | 'SIMULATING';
  editorTool: EditorTool;
  setEditorTool: (t: EditorTool) => void;

  brushType: CellType;
  setBrushType: (c: CellType) => void;

  isSymmetryEnabled: boolean;
  setIsSymmetryEnabled: (s: boolean) => void;

  onClear: () => void;
  onGenerate: (type: string) => void;
  onExportMatrix: () => void;
  onImportMatrix: () => void;
}

export const ToolDock: React.FC<ToolDockProps> = ({
  status,
  editorTool,
  setEditorTool,
  brushType,
  setBrushType,
  isSymmetryEnabled,
  setIsSymmetryEnabled,
  onClear,
  onGenerate,
  onExportMatrix,
  onImportMatrix
}) => {
  if (status !== 'EDITING') return null;

  return (
    <div className="absolute left-4 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-4">
        
        {/* MAIN TOOLS */}
        <div className="bg-slate-900/90 backdrop-blur border border-slate-700 p-2 rounded-2xl shadow-xl flex flex-col gap-2">
            <ToolButton 
                active={editorTool === 'VIEW'} 
                onClick={() => setEditorTool('VIEW')}
                icon="eye"
                label="View"
            />
            <ToolButton 
                active={editorTool === 'BUILD'} 
                onClick={() => setEditorTool('BUILD')}
                icon="hammer"
                label="Build"
                color="text-blue-400"
            />
            <ToolButton 
                active={editorTool === 'ERASE'} 
                onClick={() => setEditorTool('ERASE')}
                icon="trash"
                label="Erase"
                color="text-red-400"
            />
        </div>

        {/* BRUSH TYPE (Only visible in BUILD mode) */}
        {editorTool === 'BUILD' && (
             <div className="bg-slate-900/90 backdrop-blur border border-slate-700 p-3 rounded-2xl shadow-xl flex flex-col gap-2 items-center animate-in slide-in-from-left-4 fade-in duration-200">
                <span className="text-[10px] font-bold text-slate-500 uppercase mb-1">Material</span>
                <BrushButton active={brushType === CellType.BODY} onClick={() => setBrushType(CellType.BODY)} color="bg-blue-600" label="BODY" />
                <BrushButton active={brushType === CellType.HEAD} onClick={() => setBrushType(CellType.HEAD)} color="bg-red-500" label="HEAD" />
                <BrushButton active={brushType === CellType.FOOT} onClick={() => setBrushType(CellType.FOOT)} color="bg-green-500" label="FOOT" />
                
                <div className="h-px bg-slate-700 w-full my-1" />
                
                <button 
                    onClick={() => setIsSymmetryEnabled(!isSymmetryEnabled)}
                    className={`w-full py-1.5 px-2 rounded-lg flex items-center justify-between transition-all border ${
                        isSymmetryEnabled ? 'bg-purple-600 border-purple-400' : 'bg-slate-800 border-slate-600 opacity-60'
                    }`}
                >
                    <span className="text-[9px] font-bold text-white uppercase tracking-tighter">Symmetry</span>
                    <div className={`w-2 h-2 rounded-full ${isSymmetryEnabled ? 'bg-white shadow-[0_0_5px_white]' : 'bg-slate-500'}`} />
                </button>
            </div>
        )}

        {/* GENERATORS */}
        <div className="bg-slate-900/90 backdrop-blur border border-slate-700 p-3 rounded-2xl shadow-xl flex flex-col gap-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase text-center mb-1">Auto</span>
            <button onClick={() => onGenerate('small')} className="text-xs bg-slate-800 hover:bg-slate-700 text-teal-400 py-1 px-2 rounded border border-slate-600">
                Random
            </button>
            <button onClick={() => onGenerate('large')} className="text-xs bg-slate-800 hover:bg-slate-700 text-indigo-400 py-1 px-2 rounded border border-slate-600">
                Beast
            </button>
            <button onClick={() => onGenerate('monster')} className="text-xs bg-slate-800 hover:bg-slate-700 text-red-400 py-1 px-2 rounded border border-slate-600">
                Monster
            </button>
            <button onClick={() => onGenerate('spider')} className="text-xs bg-slate-800 hover:bg-slate-700 text-amber-400 py-1 px-2 rounded border border-slate-600">
                Spider
            </button>
            <button onClick={() => onGenerate('octo')} className="text-xs bg-slate-800 hover:bg-slate-700 text-pink-400 py-1 px-2 rounded border border-slate-600">
                Octo
            </button>
            <div className="h-px bg-slate-700 my-1" />
            <button onClick={() => onGenerate('mirror')} className="text-xs bg-purple-900/30 hover:bg-purple-900/50 text-purple-300 py-1 px-2 rounded border border-purple-800">
                Mirror X
            </button>
            <div className="h-px bg-slate-700 my-1" />
            <div className="grid grid-cols-2 gap-1">
                <button onClick={onExportMatrix} className="text-[10px] bg-blue-900/20 hover:bg-blue-900/40 text-blue-300 py-1 px-1 rounded border border-blue-800">
                    Export
                </button>
                <button onClick={onImportMatrix} className="text-[10px] bg-green-900/20 hover:bg-green-900/40 text-green-300 py-1 px-1 rounded border border-green-800">
                    Import
                </button>
            </div>
            <button onClick={onClear} className="text-xs bg-red-900/20 hover:bg-red-900/40 text-red-400 py-1 px-2 rounded border border-red-800 mt-2">
                Clear All
            </button>
        </div>
    </div>
  );
};

const ToolButton: React.FC<{ active: boolean, onClick: () => void, icon: string, label: string, color?: string }> = ({ 
    active, onClick, icon, label, color 
}) => (
    <button
        onClick={onClick}
        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
            active 
            ? 'bg-slate-700 text-white shadow-lg ring-1 ring-slate-500' 
            : 'text-slate-500 hover:bg-slate-800 hover:text-white'
        }`}
        title={label}
    >
        <Icon name={icon} className={`w-5 h-5 ${active && color ? color : ''}`} />
    </button>
);

const BrushButton: React.FC<{ active: boolean, onClick: () => void, color: string, label: string }> = ({ active, onClick, color, label }) => (
    <button
        onClick={onClick}
        className={`w-full py-1.5 px-2 rounded-lg flex items-center justify-between transition-all border ${
            active ? 'border-white/50 shadow-md scale-105' : 'border-transparent opacity-70 hover:opacity-100'
        } ${color}`}
    >
        <span className="text-[9px] font-bold text-white">{label}</span>
        {active && <div className="w-1.5 h-1.5 rounded-full bg-white shadow-sm" />}
    </button>
);
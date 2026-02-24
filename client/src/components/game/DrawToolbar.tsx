import React from 'react';
import type { DrawTool } from '../../types/game.types';

const COLORS = [
    '#000000', '#ffffff', '#ef4444', '#f97316', '#eab308', '#22c55e',
    '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#92400e', '#6b7280',
    '#fbbf24', '#34d399', '#60a5fa', '#f472b6', '#a78bfa', '#fb923c',
    '#4ade80', '#2dd4bf',
];

interface Props {
    color: string;
    brushSize: number;
    tool: DrawTool;
    onColorChange: (c: string) => void;
    onSizeChange: (s: number) => void;
    onToolChange: (t: DrawTool) => void;
    onUndo: () => void;
    onClear: () => void;
}

export default function DrawToolbar({ color, brushSize, tool, onColorChange, onSizeChange, onToolChange, onUndo, onClear }: Props) {
    return (
        <div className="draw-toolbar">
            {/* Tools */}
            <div className="tool-group">
                {(['brush', 'eraser', 'fill'] as DrawTool[]).map(t => (
                    <button
                        key={t}
                        className={`tool-btn ${tool === t ? 'active' : ''}`}
                        onClick={() => onToolChange(t)}
                        title={t.charAt(0).toUpperCase() + t.slice(1)}
                    >
                        {t === 'brush' ? '🖌️' : t === 'eraser' ? '🧹' : '🪣'}
                    </button>
                ))}
            </div>

            {/* Brush size */}
            <div className="tool-group">
                <input
                    type="range" min={2} max={40} value={brushSize}
                    onChange={e => onSizeChange(Number(e.target.value))}
                    title="Brush size"
                />
                <span className="brush-label">{brushSize}px</span>
            </div>

            {/* Color palette */}
            <div className="color-palette">
                {COLORS.map(c => (
                    <div
                        key={c}
                        className={`color-swatch ${color === c ? 'selected' : ''}`}
                        style={{ background: c, border: c === '#ffffff' ? '2px solid #555' : undefined }}
                        onClick={() => { onColorChange(c); onToolChange('brush'); }}
                        title={c}
                    />
                ))}
            </div>

            {/* Actions */}
            <div className="tool-group">
                <button className="tool-btn" onClick={onUndo} title="Undo">↩️</button>
                <button className="tool-btn danger" onClick={onClear} title="Clear">🗑️</button>
            </div>
        </div>
    );
}

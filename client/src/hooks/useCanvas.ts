import { useRef, useCallback, useEffect } from 'react';
import socket from '../config/socket';
import type { DrawTool } from '../types/game.types';

interface UseCanvasProps {
    isDrawer: boolean;
    color: string;
    brushSize: number;
    tool: DrawTool;
}

export function useCanvas({ isDrawer, color, brushSize, tool }: UseCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const isDrawing = useRef(false);
    const lastPos = useRef({ x: 0, y: 0 });
    const undoStack = useRef<string[]>([]);

    const getCtx = () => canvasRef.current?.getContext('2d') ?? null;

    const getPos = (e: MouseEvent | TouchEvent) => {
        const canvas = canvasRef.current!;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const src = 'touches' in e ? e.touches[0] : e;
        return {
            x: (src.clientX - rect.left) * scaleX,
            y: (src.clientY - rect.top) * scaleY,
        };
    };

    const clearCanvas = useCallback(() => {
        const ctx = getCtx();
        const canvas = canvasRef.current;
        if (!ctx || !canvas) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }, []);

    const saveUndo = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        if (undoStack.current.length >= 20) undoStack.current.shift();
        undoStack.current.push(canvas.toDataURL());
    }, []);

    const applyUndo = useCallback((dataURL: string) => {
        const ctx = getCtx();
        const canvas = canvasRef.current;
        if (!ctx || !canvas) return;
        const img = new Image();
        img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
        };
        img.src = dataURL;
    }, []);

    const hexToRgb = (hex: string): [number, number, number] => [
        parseInt(hex.slice(1, 3), 16),
        parseInt(hex.slice(3, 5), 16),
        parseInt(hex.slice(5, 7), 16),
    ];

    const floodFill = useCallback((startX: number, startY: number, fillColor: string) => {
        const ctx = getCtx();
        const canvas = canvasRef.current;
        if (!ctx || !canvas) return;

        const sx = Math.round(startX), sy = Math.round(startY);
        const { width: w, height: h } = canvas;
        const imageData = ctx.getImageData(0, 0, w, h);
        const data = imageData.data;

        const idx = (y: number, x: number) => (y * w + x) * 4;
        const start = idx(sy, sx);
        const [sr, sg, sb, sa] = [data[start], data[start + 1], data[start + 2], data[start + 3]];
        const [fr, fg, fb] = hexToRgb(fillColor);

        if (sr === fr && sg === fg && sb === fb) return;

        const match = (i: number) =>
            data[i] === sr && data[i + 1] === sg && data[i + 2] === sb && data[i + 3] === sa;
        const set = (i: number) => {
            data[i] = fr; data[i + 1] = fg; data[i + 2] = fb; data[i + 3] = 255;
        };

        const queue: [number, number][] = [[sx, sy]];
        while (queue.length) {
            const [x, y] = queue.pop()!;
            if (x < 0 || x >= w || y < 0 || y >= h) continue;
            const i = idx(y, x);
            if (!match(i)) continue;
            set(i);
            queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
        }
        ctx.putImageData(imageData, 0, 0);
    }, []);

    // ─── Canvas Event Handlers ─────────────────────────────────────────────────
    const onPointerDown = useCallback((e: MouseEvent | TouchEvent) => {
        if (!isDrawer) return;
        e.preventDefault();
        const pos = getPos(e);

        if (tool === 'fill') {
            saveUndo();
            floodFill(pos.x, pos.y, color);
            socket.emit('draw:fill', { x: pos.x, y: pos.y, color });
            return;
        }

        isDrawing.current = true;
        lastPos.current = pos;
        saveUndo();

        const ctx = getCtx()!;
        const actualSize = tool === 'eraser' ? brushSize * 2 : brushSize;
        const actualColor = tool === 'eraser' ? '#ffffff' : color;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, actualSize / 2, 0, Math.PI * 2);
        ctx.fillStyle = actualColor;
        ctx.fill();

        socket.emit('draw:start', { x: pos.x, y: pos.y, color: actualColor, size: actualSize, tool });
    }, [isDrawer, tool, color, brushSize, floodFill, saveUndo]);

    const onPointerMove = useCallback((e: MouseEvent | TouchEvent) => {
        if (!isDrawing.current || !isDrawer) return;
        e.preventDefault();
        const pos = getPos(e);
        const ctx = getCtx()!;

        const actualSize = tool === 'eraser' ? brushSize * 2 : brushSize;
        const actualColor = tool === 'eraser' ? '#ffffff' : color;

        ctx.beginPath();
        ctx.moveTo(lastPos.current.x, lastPos.current.y);
        ctx.lineTo(pos.x, pos.y);
        ctx.strokeStyle = actualColor;
        ctx.lineWidth = actualSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();

        socket.emit('draw:move', {
            x1: lastPos.current.x, y1: lastPos.current.y,
            x2: pos.x, y2: pos.y,
            color: actualColor, size: actualSize,
        });
        lastPos.current = pos;
    }, [isDrawer, tool, color, brushSize]);

    const onPointerUp = useCallback(() => { isDrawing.current = false; }, []);

    const handleUndo = useCallback(() => {
        if (!isDrawer || undoStack.current.length === 0) return;
        const prev = undoStack.current.pop()!;
        applyUndo(prev);
        socket.emit('draw:undo', { dataURL: prev });
    }, [isDrawer, applyUndo]);

    const handleClear = useCallback(() => {
        if (!isDrawer) return;
        saveUndo();
        clearCanvas();
        socket.emit('draw:clear');
    }, [isDrawer, clearCanvas, saveUndo]);

    // ─── Incoming Draw Events ──────────────────────────────────────────────────
    useEffect(() => {
        socket.on('draw:start', ({ x, y, color: c, size, tool: t }) => {
            const ctx = getCtx();
            if (!ctx) return;
            ctx.beginPath();
            ctx.arc(x, y, size / 2, 0, Math.PI * 2);
            ctx.fillStyle = t === 'eraser' ? '#ffffff' : c;
            ctx.fill();
        });

        socket.on('draw:move', ({ x1, y1, x2, y2, color: c, size }) => {
            const ctx = getCtx();
            if (!ctx) return;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.strokeStyle = c;
            ctx.lineWidth = size;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.stroke();
        });

        socket.on('draw:clear', clearCanvas);
        socket.on('draw:fill', ({ x, y, color: c }) => floodFill(x, y, c));
        socket.on('draw:undo', ({ dataURL }) => applyUndo(dataURL));

        socket.on('canvas:request', ({ requesterSocketId }) => {
            if (!isDrawer || !canvasRef.current) return;
            const dataURL = canvasRef.current.toDataURL();
            socket.emit('canvas:respond', { dataURL, toSocketId: requesterSocketId });
        });

        socket.on('canvas:sync', ({ dataURL }) => applyUndo(dataURL));

        return () => {
            socket.off('draw:start');
            socket.off('draw:move');
            socket.off('draw:clear');
            socket.off('draw:fill');
            socket.off('draw:undo');
            socket.off('canvas:request');
            socket.off('canvas:sync');
        };
    }, [clearCanvas, floodFill, applyUndo, isDrawer]);

    return {
        canvasRef,
        clearCanvas,
        handleUndo,
        handleClear,
        onPointerDown,
        onPointerMove,
        onPointerUp,
    };
}

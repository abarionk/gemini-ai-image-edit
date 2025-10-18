/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React, { useState, useCallback, useRef, useEffect } from 'react';
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop';
import { generateEditedImage, generateFilteredImage, generateAdjustedImage, generateErasedImage, generateUpscaledImage, generateWatermarkRemovedImage } from './services/geminiService';
import Spinner from './components/Spinner';
import FilterPanel from './components/FilterPanel';
import AdjustmentPanel from './components/AdjustmentPanel';
import CropPanel from './components/CropPanel';
import TransformPanel from './components/TransformPanel';
import ErasePanel from './components/ErasePanel';
import { UndoIcon, RedoIcon, EyeIcon, MagicWandIcon, EraserIcon, SunIcon, PaletteIcon, CropIcon, FlipHorizontalIcon, UploadIcon, DownloadIcon, ResetIcon, SparklesIcon } from './components/icons';
import StartScreen from './components/StartScreen';
import GenerateScreen from './components/GenerateScreen';
import ZoomControls from './components/ZoomControls';

// Helper to convert a data URL string to a File object
export const dataURLtoFile = (dataurl: string, filename: string): File => {
    const arr = dataurl.split(',');
    if (arr.length < 2) throw new Error("Invalid data URL");
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch || !mimeMatch[1]) throw new Error("Could not parse MIME type from data URL");

    const mime = mimeMatch[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while(n--){
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, {type:mime});
}

type Tab = 'retouch' | 'erase' | 'adjust' | 'filters' | 'crop' | 'transform';
type AppMode = 'start' | 'editor' | 'generator';

const App: React.FC = () => {
  const [appMode, setAppMode] = useState<AppMode>('start');
  const [previousAppMode, setPreviousAppMode] = useState<AppMode | null>(null);
  const [history, setHistory] = useState<File[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [prompt, setPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [editHotspot, setEditHotspot] = useState<{ x: number, y: number } | null>(null);
  const [displayHotspot, setDisplayHotspot] = useState<{ imageX: number, imageY: number } | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('retouch');
  
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [aspect, setAspect] = useState<number | undefined>();
  const [isComparing, setIsComparing] = useState<boolean>(false);
  
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [erasePath, setErasePath] = useState<Array<{x: number, y: number}>>([]);
  const [brushSize, setBrushSize] = useState<number>(30);
  const [brushOpacity, setBrushOpacity] = useState<number>(0.8);
  
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const imgRef = useRef<HTMLImageElement>(null);
  const eraseCanvasRef = useRef<HTMLCanvasElement>(null);
  const erasePathRef = useRef<Array<{x: number, y: number}>>([]);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });

  const currentImage = history[historyIndex] ?? null;
  const originalImage = history[0] ?? null;

  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);

  const resetState = useCallback(() => {
    setHistory([]);
    setHistoryIndex(-1);
    setError(null);
    setPrompt('');
    setEditHotspot(null);
    setDisplayHotspot(null);
    setActiveTab('retouch');
    setCrop(undefined);
    setCompletedCrop(undefined);
    setErasePath([]);
    erasePathRef.current = [];
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setPreviousAppMode(null);
  }, []);

  const startEditing = useCallback((file: File) => {
    resetState();
    setHistory([file]);
    setHistoryIndex(0);
    setAppMode('editor');
  }, [resetState]);

  const startGenerating = useCallback(() => {
    resetState();
    setAppMode('generator');
  }, [resetState]);
  
  const switchToGenerator = useCallback(() => {
    setPreviousAppMode(appMode);
    setAppMode('generator');
  }, [appMode]);

  const resetView = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  const handleClearErase = useCallback(() => {
    erasePathRef.current = [];
    setErasePath([]);
    const canvas = eraseCanvasRef.current;
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, []);
  
  const handleTabChange = (tabId: Tab) => {
    if (activeTab !== tabId) {
        resetView();
        // Reset tool-specific states when changing tabs
        setEditHotspot(null);
        setDisplayHotspot(null);
        handleClearErase();
        setCrop(undefined);
        setCompletedCrop(undefined);
        setActiveTab(tabId);
    }
  };

  // Effect to handle resizing of the erase canvas
  useEffect(() => {
    const canvas = eraseCanvasRef.current;
    const image = imgRef.current;

    if (canvas && image && activeTab === 'erase') {
        const setCanvasSize = () => {
            const rect = image.getBoundingClientRect();
            if (canvas.width !== rect.width || canvas.height !== rect.height) {
                canvas.width = rect.width;
                canvas.height = rect.height;
                 // Resizing clears the path. A more complex solution could rescale it.
                handleClearErase();
            }
        };
        
        setCanvasSize(); // Set initial size
        
        const resizeObserver = new ResizeObserver(setCanvasSize);
        resizeObserver.observe(image);
        
        return () => resizeObserver.unobserve(image);
    }
  }, [activeTab, currentImageUrl, handleClearErase]);

  // Effect to create and revoke object URLs safely for the current image
  useEffect(() => {
    if (currentImage) {
      const url = URL.createObjectURL(currentImage);
      setCurrentImageUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setCurrentImageUrl(null);
    }
  }, [currentImage]);
  
  // Effect to create and revoke object URLs safely for the original image
  useEffect(() => {
    if (originalImage) {
      const url = URL.createObjectURL(originalImage);
      setOriginalImageUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setOriginalImageUrl(null);
    }
  }, [originalImage]);


  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const addImageToHistory = useCallback((newImageFile: File) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newImageFile);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    // Reset transient states after an action
    setCrop(undefined);
    setCompletedCrop(undefined);
    handleClearErase();
  }, [history, historyIndex, handleClearErase]);

  const handleGenerate = useCallback(async () => {
    if (!currentImage) {
      setError('No image loaded to edit.');
      return;
    }
    
    if (!prompt.trim()) {
        setError('Please enter a description for your edit.');
        return;
    }

    if (!editHotspot) {
        setError('Please click on the image to select an area to edit.');
        return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
        const editedImageUrl = await generateEditedImage(currentImage, prompt, editHotspot);
        const newImageFile = dataURLtoFile(editedImageUrl, `edited-${Date.now()}.png`);
        addImageToHistory(newImageFile);
        setEditHotspot(null);
        setDisplayHotspot(null);
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        setError(`Failed to generate the image. ${errorMessage}`);
        console.error(err);
    } finally {
        setIsLoading(false);
    }
  }, [currentImage, prompt, editHotspot, addImageToHistory]);

  const handleApplyErase = useCallback(async () => {
    if (!currentImage || erasePathRef.current.length < 2 || !imgRef.current || !eraseCanvasRef.current) {
        setError('Please draw on the image to select an area to erase.');
        return;
    }

    setIsLoading(true);
    setError(null);

    try {
        const image = imgRef.current;
        const displayCanvas = eraseCanvasRef.current;
        const { naturalWidth, naturalHeight } = image;
        
        // Create mask canvas with original image dimensions
        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = naturalWidth;
        maskCanvas.height = naturalHeight;
        const ctx = maskCanvas.getContext('2d');

        if (!ctx) {
            throw new Error('Could not create mask canvas context.');
        }

        // Black background
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, naturalWidth, naturalHeight);

        // Calculate scaling factors
        const scaleX = naturalWidth / displayCanvas.width;
        const scaleY = naturalHeight / displayCanvas.height;

        // Draw the path on the mask canvas
        const path = erasePathRef.current;
        ctx.strokeStyle = `rgba(255, 255, 255, ${brushOpacity})`;
        ctx.lineWidth = brushSize * scaleX;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        ctx.beginPath();
        ctx.moveTo(path[0].x * scaleX, path[0].y * scaleY);
        for (let i = 1; i < path.length; i++) {
            ctx.lineTo(path[i].x * scaleX, path[i].y * scaleY);
        }
        ctx.stroke();

        const maskDataUrl = maskCanvas.toDataURL('image/png');
        const maskFile = dataURLtoFile(maskDataUrl, 'mask.png');

        const erasedImageUrl = await generateErasedImage(currentImage, maskFile);
        const newImageFile = dataURLtoFile(erasedImageUrl, `erased-${Date.now()}.png`);
        
        addImageToHistory(newImageFile);
        // handleClearErase is called inside addImageToHistory

    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        setError(`Failed to apply the erase. ${errorMessage}`);
        console.error(err);
    } finally {
        setIsLoading(false);
    }
  }, [currentImage, addImageToHistory, brushSize, brushOpacity]);
  
  const handleApplyFilter = useCallback(async (filterPrompt: string) => {
    if (!currentImage) {
      setError('No image loaded to apply a filter to.');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
        const filteredImageUrl = await generateFilteredImage(currentImage, filterPrompt);
        const newImageFile = dataURLtoFile(filteredImageUrl, `filtered-${Date.now()}.png`);
        addImageToHistory(newImageFile);
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        setError(`Failed to apply the filter. ${errorMessage}`);
        console.error(err);
    } finally {
        setIsLoading(false);
    }
  }, [currentImage, addImageToHistory]);
  
  const handleApplyAdjustment = useCallback(async (adjustmentPrompt: string) => {
    if (!currentImage) {
      setError('No image loaded to apply an adjustment to.');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
        const adjustedImageUrl = await generateAdjustedImage(currentImage, adjustmentPrompt);
        const newImageFile = dataURLtoFile(adjustedImageUrl, `adjusted-${Date.now()}.png`);
        addImageToHistory(newImageFile);
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        setError(`Failed to apply the adjustment. ${errorMessage}`);
        console.error(err);
    } finally {
        setIsLoading(false);
    }
  }, [currentImage, addImageToHistory]);

  const handleApplyUpscale = useCallback(async () => {
    if (!currentImage) {
      setError('No image loaded to apply an upscale to.');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
        const upscaledImageUrl = await generateUpscaledImage(currentImage);
        const newImageFile = dataURLtoFile(upscaledImageUrl, `upscaled-${Date.now()}.png`);
        addImageToHistory(newImageFile);
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        setError(`Failed to apply the upscale. ${errorMessage}`);
        console.error(err);
    } finally {
        setIsLoading(false);
    }
  }, [currentImage, addImageToHistory]);

  const handleApplyWatermarkRemoval = useCallback(async () => {
    if (!currentImage) {
      setError('No image loaded to remove a watermark from.');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
        const resultImageUrl = await generateWatermarkRemovedImage(currentImage);
        const newImageFile = dataURLtoFile(resultImageUrl, `watermark-removed-${Date.now()}.png`);
        addImageToHistory(newImageFile);
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        setError(`Failed to remove the watermark. ${errorMessage}`);
        console.error(err);
    } finally {
        setIsLoading(false);
    }
  }, [currentImage, addImageToHistory]);

  const handleApplyCrop = useCallback(() => {
    if (!completedCrop || !imgRef.current) {
        setError('Please select an area to crop.');
        return;
    }

    const image = imgRef.current;
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    
    canvas.width = completedCrop.width;
    canvas.height = completedCrop.height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        setError('Could not process the crop.');
        return;
    }

    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = completedCrop.width * pixelRatio;
    canvas.height = completedCrop.height * pixelRatio;
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.imageSmoothingQuality = 'high';

    ctx.drawImage(
      image,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      completedCrop.width,
      completedCrop.height,
    );
    
    const croppedImageUrl = canvas.toDataURL('image/png');
    const newImageFile = dataURLtoFile(croppedImageUrl, `cropped-${Date.now()}.png`);
    addImageToHistory(newImageFile);

  }, [completedCrop, addImageToHistory]);

  const handleTransform = useCallback(async (transformation: 'rotate-left' | 'rotate-right' | 'flip-horizontal' | 'flip-vertical') => {
    if (!currentImage) {
      setError('No image loaded to transform.');
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
        const transformedImageUrl = await new Promise<string>((resolve, reject) => {
            const image = new Image();
            const objectUrl = URL.createObjectURL(currentImage);
            image.src = objectUrl;

            image.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    URL.revokeObjectURL(objectUrl);
                    reject(new Error('Could not get canvas context.'));
                    return;
                }

                const { naturalWidth: w, naturalHeight: h } = image;
                
                switch (transformation) {
                    case 'rotate-left':
                    case 'rotate-right':
                        canvas.width = h;
                        canvas.height = w;
                        ctx.translate(canvas.width / 2, canvas.height / 2);
                        ctx.rotate((transformation === 'rotate-left' ? -90 : 90) * Math.PI / 180);
                        ctx.drawImage(image, -w / 2, -h / 2, w, h);
                        break;
                    case 'flip-horizontal':
                        canvas.width = w;
                        canvas.height = h;
                        ctx.translate(w, 0);
                        ctx.scale(-1, 1);
                        ctx.drawImage(image, 0, 0, w, h);
                        break;
                    case 'flip-vertical':
                        canvas.width = w;
                        canvas.height = h;
                        ctx.translate(0, h);
                        ctx.scale(1, -1);
                        ctx.drawImage(image, 0, 0, w, h);
                        break;
                }
                
                URL.revokeObjectURL(objectUrl);
                resolve(canvas.toDataURL('image/png'));
            };
            
            image.onerror = () => {
                URL.revokeObjectURL(objectUrl);
                reject(new Error('Failed to load image for transformation.'));
            };
        });

        const newImageFile = dataURLtoFile(transformedImageUrl, `transformed-${Date.now()}.png`);
        addImageToHistory(newImageFile);
        
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        setError(`Failed to apply the transformation. ${errorMessage}`);
        console.error(err);
    } finally {
        setIsLoading(false);
    }
  }, [currentImage, addImageToHistory]);

  const handleUndo = useCallback(() => {
    if (canUndo) {
      setHistoryIndex(historyIndex - 1);
      setEditHotspot(null);
      setDisplayHotspot(null);
      handleClearErase();
      resetView();
    }
  }, [canUndo, historyIndex, handleClearErase, resetView]);
  
  const handleRedo = useCallback(() => {
    if (canRedo) {
      setHistoryIndex(historyIndex + 1);
      setEditHotspot(null);
      setDisplayHotspot(null);
      handleClearErase();
      resetView();
    }
  }, [canRedo, historyIndex, handleClearErase, resetView]);

  const handleReset = useCallback(() => {
    if (history.length > 0) {
      setHistoryIndex(0);
      setError(null);
      setEditHotspot(null);
      setDisplayHotspot(null);
      handleClearErase();
      resetView();
    }
  }, [history, handleClearErase, resetView]);

  const handleStartOver = useCallback(() => {
    resetState();
    setAppMode('start');
  }, [resetState]);
  
  const handleBack = useCallback(() => {
    if (previousAppMode) {
        setAppMode(previousAppMode);
        setPreviousAppMode(null);
    }
  }, [previousAppMode]);

  const handleDownload = useCallback(() => {
      if (currentImage) {
          const link = document.createElement('a');
          link.href = URL.createObjectURL(currentImage);
          link.download = `edited-${currentImage.name}`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(link.href);
      }
  }, [currentImage]);
  
  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeTab !== 'retouch' || !imgRef.current || !imageContainerRef.current) return;
    
    const img = imgRef.current;
    const container = imageContainerRef.current;
    const containerRect = container.getBoundingClientRect();

    const mouseX = e.clientX - containerRect.left;
    const mouseY = e.clientY - containerRect.top;

    const imageX = (mouseX - position.x) / scale;
    const imageY = (mouseY - position.y) / scale;

    if (imageX < 0 || imageY < 0 || imageX > img.clientWidth || imageY > img.clientHeight) {
        return; 
    }

    setDisplayHotspot({ imageX, imageY });

    const { naturalWidth, naturalHeight, clientWidth, clientHeight } = img;
    const scaleX = naturalWidth / clientWidth;
    const scaleY = naturalHeight / clientHeight;

    const originalX = Math.round(imageX * scaleX);
    const originalY = Math.round(imageY * scaleY);

    setEditHotspot({ x: originalX, y: originalY });
  };
  
  const handleEraseMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeTab !== 'erase' || isLoading) return;
    setIsDrawing(true);
    const canvas = eraseCanvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    erasePathRef.current = [{ x, y }];
  };

  const handleEraseMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDrawing || activeTab !== 'erase' || isLoading) return;
      const canvas = eraseCanvasRef.current!;
      const ctx = canvas.getContext('2d')!;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const lastPoint = erasePathRef.current[erasePathRef.current.length - 1];
      
      ctx.beginPath();
      ctx.moveTo(lastPoint.x, lastPoint.y);
      ctx.lineTo(x, y);
      ctx.strokeStyle = `rgba(74, 144, 226, ${brushOpacity})`;
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
      
      erasePathRef.current.push({ x, y });
  };

  const handleEraseMouseUp = () => {
      if (!isDrawing) return;
      setIsDrawing(false);
      setErasePath(erasePathRef.current);
  };
  
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
      if (activeTab === 'erase' || activeTab === 'crop') return;
      e.preventDefault();
      const container = imageContainerRef.current;
      if (!container) return;
  
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
  
      const zoomFactor = 1.1;
      const newScale = e.deltaY < 0 ? scale * zoomFactor : scale / zoomFactor;
      const clampedScale = Math.max(1, Math.min(newScale, 10)); 
  
      if (clampedScale === scale) return;
  
      if (clampedScale <= 1) {
          resetView();
          return;
      }
  
      const newX = mouseX - (mouseX - position.x) * (clampedScale / scale);
      const newY = mouseY - (mouseY - position.y) * (clampedScale / scale);
  
      setScale(clampedScale);
      setPosition({ x: newX, y: newY });
  };

  const handlePanMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
      if (scale > 1 && e.button === 0 && activeTab !== 'erase' && activeTab !== 'crop') {
          e.preventDefault();
          isPanningRef.current = true;
          panStartRef.current = {
              x: e.clientX - position.x,
              y: e.clientY - position.y,
          };
          e.currentTarget.style.cursor = 'grabbing';
      }
  };

  const handlePanMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
      if (isPanningRef.current) {
          e.preventDefault(); // Prevents text selection and click event on drag
          const newX = e.clientX - panStartRef.current.x;
          const newY = e.clientY - panStartRef.current.y;
          setPosition({ x: newX, y: newY });
      }
  };

  const getCursor = useCallback(() => {
    if (activeTab === 'retouch') return 'crosshair';
    if (scale > 1) return 'grab';
    return 'default';
  }, [activeTab, scale]);

  const handlePanEnd = (e: React.MouseEvent<HTMLDivElement>) => {
      if (isPanningRef.current) {
          isPanningRef.current = false;
          e.currentTarget.style.cursor = getCursor();
      }
  };

  const handleZoomIn = () => {
    const container = imageContainerRef.current;
    if (!container) return;

    const { width, height } = container.getBoundingClientRect();
    const centerX = width / 2;
    const centerY = height / 2;
    
    const newScale = Math.min(scale * 1.25, 10);
    const newX = centerX - (centerX - position.x) * (newScale / scale);
    const newY = centerY - (centerY - position.y) * (newScale / scale);

    setScale(newScale);
    setPosition({ x: newX, y: newY });
  };

  const handleZoomOut = () => {
      const newScale = Math.max(scale / 1.25, 1);

      if (newScale <= 1) {
          resetView();
          return;
      }
      
      const container = imageContainerRef.current;
      if (!container) return;

      const { width, height } = container.getBoundingClientRect();
      const centerX = width / 2;
      const centerY = height / 2;
      
      const newX = centerX - (centerX - position.x) * (newScale / scale);
      const newY = centerY - (centerY - position.y) * (newScale / scale);

      setScale(newScale);
      setPosition({ x: newX, y: newY });
  };

  if (appMode === 'start') {
    return (
      <main className="h-screen w-full max-w-[1600px] mx-auto p-4 md:p-8 flex justify-center items-center">
        <StartScreen onSelectEdit={startEditing} onSelectGenerate={startGenerating} />
      </main>
    );
  }
  
  if (appMode === 'generator') {
    return (
       <main className="h-screen w-full max-w-[1600px] mx-auto p-4 md:p-8 flex justify-center items-center">
        <GenerateScreen onImageGenerated={startEditing} onStartOver={handleStartOver} onBack={previousAppMode === 'editor' ? handleBack : undefined} />
      </main>
    )
  }

  const tabs: { id: Tab, name: string, icon: React.FC<{className?: string}> }[] = [
    { id: 'retouch', name: 'Retouch', icon: MagicWandIcon },
    { id: 'erase', name: 'Erase', icon: EraserIcon },
    { id: 'adjust', name: 'Adjust', icon: SunIcon },
    { id: 'filters', name: 'Filters', icon: PaletteIcon },
    { id: 'crop', name: 'Crop', icon: CropIcon },
    { id: 'transform', name: 'Transform', icon: FlipHorizontalIcon },
  ];

  const imageDisplay = (
    <div
        ref={imageContainerRef}
        className="relative w-full h-full overflow-hidden rounded-xl"
        style={{ cursor: getCursor() }}
        onWheel={handleWheel}
        onMouseDown={handlePanMouseDown}
        onMouseMove={handlePanMouseMove}
        onMouseUp={handlePanEnd}
        onMouseLeave={handlePanEnd}
        onClick={handleImageClick}
    >
        <div 
            className="relative w-full h-full"
            style={{ 
                transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`, 
                transformOrigin: '0 0',
            }}
        >
            {originalImageUrl && (
                <img
                    key={`original-${originalImageUrl}`}
                    src={originalImageUrl}
                    alt="Original"
                    className="absolute top-0 left-0 w-full h-full object-contain pointer-events-none"
                    style={{ willChange: 'transform' }}
                />
            )}
            <img
                ref={imgRef}
                key={currentImageUrl}
                src={currentImageUrl!}
                alt="Current"
                className={`w-full h-full object-contain transition-opacity duration-200 ease-in-out ${isComparing ? 'opacity-0' : 'opacity-100'}`}
                style={{ willChange: 'transform' }}
            />
        </div>
        
        {activeTab === 'erase' && !isLoading && (
            <canvas
                ref={eraseCanvasRef}
                onMouseDown={handleEraseMouseDown}
                onMouseMove={handleEraseMouseMove}
                onMouseUp={handleEraseMouseUp}
                onMouseLeave={handleEraseMouseUp}
                className="absolute top-0 left-0 cursor-crosshair z-20"
            />
        )}

        {displayHotspot && !isLoading && activeTab === 'retouch' && (
            <div 
                className="absolute rounded-full w-6 h-6 bg-blue-500/50 border-2 border-white pointer-events-none -translate-x-1/2 -translate-y-1/2 z-10"
                style={{ 
                    left: `${position.x + displayHotspot.imageX * scale}px`, 
                    top: `${position.y + displayHotspot.imageY * scale}px` 
                }}
            >
                <div className="absolute inset-0 rounded-full w-6 h-6 animate-ping bg-blue-400"></div>
            </div>
        )}
        
        {activeTab !== 'erase' && activeTab !== 'crop' && (
            <ZoomControls scale={scale} onZoomIn={handleZoomIn} onZoomOut={handleZoomOut} onReset={resetView} />
        )}
    </div>
  );
  
  const cropImageElement = (
    <img 
      ref={imgRef}
      key={`crop-${currentImageUrl}`}
      src={currentImageUrl!} 
      alt="Crop this image"
      className="w-full h-full object-contain rounded-xl"
    />
  );
  
  const renderActivePanel = () => {
    switch (activeTab) {
      case 'retouch':
        return (
          <div className="flex flex-col items-center gap-4">
            <p className="text-md text-gray-400">
              {editHotspot ? 'Great! Now describe your localized edit below.' : 'Click an area on the image to make a precise edit.'}
            </p>
            <form onSubmit={(e) => { e.preventDefault(); handleGenerate(); }} className="w-full flex items-center gap-2">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={editHotspot ? "e.g., 'change my shirt color to blue'" : "First click a point on the image"}
                className="flex-grow bg-gray-800 border border-gray-700 text-gray-200 rounded-lg p-5 text-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition w-full disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isLoading || !editHotspot}
              />
              <button
                type="submit"
                className="bg-gradient-to-br from-blue-600 to-blue-500 text-white font-bold py-5 px-8 text-lg rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner disabled:from-blue-800 disabled:to-blue-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
                disabled={isLoading || !prompt.trim() || !editHotspot}
              >
                Generate
              </button>
            </form>
          </div>
        );
      case 'erase':
        return <ErasePanel onApplyErase={handleApplyErase} onClearErase={handleClearErase} isLoading={isLoading} canErase={erasePath.length > 0} brushSize={brushSize} setBrushSize={setBrushSize} brushOpacity={brushOpacity} setBrushOpacity={setBrushOpacity} />;
      case 'crop':
        return <CropPanel onApplyCrop={handleApplyCrop} onSetAspect={setAspect} isLoading={isLoading} isCropping={!!completedCrop?.width && completedCrop.width > 0} />;
      case 'adjust':
        return <AdjustmentPanel onApplyAdjustment={handleApplyAdjustment} onApplyUpscale={handleApplyUpscale} onApplyWatermarkRemoval={handleApplyWatermarkRemoval} isLoading={isLoading} />;
      case 'filters':
        return <FilterPanel onApplyFilter={handleApplyFilter} isLoading={isLoading} />;
      case 'transform':
        return <TransformPanel onTransform={handleTransform} isLoading={isLoading} />;
      default:
        return null;
    }
  };


  return (
    <div className="h-screen text-gray-100 flex flex-col md:flex-row">
      <aside className="w-full md:w-28 bg-black/20 border-b-2 md:border-b-0 md:border-r-2 border-gray-800/70 p-2 flex md:flex-col gap-2">
          <div className="hidden md:block text-center pt-1">
              <h2 className="text-lg font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-blue-400 to-cyan-300">Pixshop</h2>
          </div>
          <nav className="flex-grow">
              <ul className="flex flex-row flex-wrap justify-center md:flex-col md:justify-start gap-1">
                   <li>
                      <button
                          onClick={switchToGenerator}
                          className="w-full flex flex-col items-center gap-1 p-1 md:p-2 rounded-lg transition-all duration-200 text-gray-400 hover:bg-white/10 hover:text-white"
                          aria-label="Generate Image"
                      >
                          <SparklesIcon className="w-6 h-6 md:w-7 md:h-7" />
                          <span className="text-xs font-semibold capitalize">Generate</span>
                      </button>
                  </li>
                  <div className="h-full md:h-auto w-px md:w-full bg-gray-700 mx-2 md:mx-0 md:my-1"></div>
                  {tabs.map(tab => (
                      <li key={tab.id}>
                          <button
                              onClick={() => handleTabChange(tab.id)}
                              className={`w-full flex flex-col items-center gap-1 p-1 md:p-2 rounded-lg transition-all duration-200 ${
                                  activeTab === tab.id
                                      ? 'bg-blue-500/20 text-blue-300'
                                      : 'text-gray-400 hover:bg-white/10 hover:text-white'
                              }`}
                              aria-label={tab.name}
                          >
                              <tab.icon className="w-6 h-6 md:w-7 md:h-7" />
                              <span className="text-xs font-semibold capitalize">{tab.name}</span>
                          </button>
                      </li>
                  ))}
              </ul>
          </nav>
          <div className="flex flex-row flex-wrap justify-center md:flex-col md:justify-start gap-1">
                <button onClick={handleUndo} disabled={!canUndo} className="p-1 md:p-2 rounded-lg text-gray-400 hover:bg-white/10 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed" aria-label="Undo"><UndoIcon className="w-5 h-5 md:w-6 md:h-6 mx-auto" /></button>
                <button onClick={handleRedo} disabled={!canRedo} className="p-1 md:p-2 rounded-lg text-gray-400 hover:bg-white/10 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed" aria-label="Redo"><RedoIcon className="w-5 h-5 md:w-6 md:h-6 mx-auto" /></button>
                {canUndo && (
                    <button
                        onMouseDown={() => setIsComparing(true)}
                        onMouseUp={() => setIsComparing(false)}
                        onMouseLeave={() => setIsComparing(false)}
                        onTouchStart={() => setIsComparing(true)}
                        onTouchEnd={() => setIsComparing(false)}
                        className="p-1 md:p-2 rounded-lg text-gray-400 hover:bg-white/10 hover:text-white"
                        aria-label="Compare with original"
                    >
                        <EyeIcon className="w-5 h-5 md:w-6 md:h-6 mx-auto" />
                    </button>
                )}
                <button onClick={handleReset} disabled={!canUndo} className="p-1 md:p-2 rounded-lg text-gray-400 hover:bg-white/10 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed" aria-label="Reset All Changes"><ResetIcon className="w-5 h-5 md:w-6 md:h-6 mx-auto" /></button>
                
                <div className="h-full md:h-auto w-px md:w-full bg-gray-700 mx-2 md:mx-0 md:my-1"></div>
                
                <button onClick={handleStartOver} className="p-1 md:p-2 rounded-lg text-gray-400 hover:bg-white/10 hover:text-white" aria-label="Start Over"><UploadIcon className="w-5 h-5 md:w-6 md:h-6 mx-auto" /></button>
                <button onClick={handleDownload} className="p-1 md:p-2 rounded-lg text-gray-400 hover:bg-white/10 hover:text-white" aria-label="Download Image"><DownloadIcon className="w-5 h-5 md:w-6 md:h-6 mx-auto" /></button>
          </div>
      </aside>

      <main className="flex-grow p-4 md:p-8 flex flex-col justify-center items-center overflow-hidden">
        {error ? (
           <div className="text-center animate-fade-in bg-red-500/10 border border-red-500/20 p-8 rounded-lg max-w-2xl mx-auto flex flex-col items-center gap-4">
            <h2 className="text-2xl font-bold text-red-300">An Error Occurred</h2>
            <p className="text-md text-red-400">{error}</p>
            <button
                onClick={() => setError(null)}
                className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-6 rounded-lg text-md transition-colors"
              >
                Try Again
            </button>
          </div>
        ) : (
          <div className="w-full h-full max-w-screen-2xl flex flex-col items-center justify-center gap-6 animate-fade-in">
              <div className="relative w-full flex-1 flex items-center justify-center min-h-0 bg-black/20 rounded-xl shadow-2xl">
                {isLoading && (
                    <div className="absolute inset-0 bg-black/70 z-30 flex flex-col items-center justify-center gap-4 animate-fade-in">
                        <Spinner />
                        <p className="text-gray-300">AI is working its magic...</p>
                    </div>
                )}
                
                {activeTab === 'crop' ? (
                  <ReactCrop 
                    crop={crop} 
                    onChange={c => setCrop(c)} 
                    onComplete={c => setCompletedCrop(c)}
                    aspect={aspect}
                    className="w-full h-full"
                  >
                    {cropImageElement}
                  </ReactCrop>
                ) : imageDisplay }
    
            </div>

            <div className="w-full flex-shrink-0 max-w-5xl">
              {renderActivePanel()}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
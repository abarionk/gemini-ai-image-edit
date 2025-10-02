/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import { MagicWandIcon, RemoveBgIcon, BeautifyIcon, UpscaleIcon, HDRIcon, ContrastIcon, SharpenIcon, RemoveWatermarkIcon } from './icons';

interface AdjustmentPanelProps {
  onApplyAdjustment: (prompt: string) => void;
  onApplyUpscale: () => void;
  onApplyWatermarkRemoval: () => void;
  isLoading: boolean;
}

const AdjustmentPanel: React.FC<AdjustmentPanelProps> = ({ onApplyAdjustment, onApplyUpscale, onApplyWatermarkRemoval, isLoading }) => {
  const [selectedPresetPrompt, setSelectedPresetPrompt] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [activeOptions, setActiveOptions] = useState<'beautify' | 'contrast' | null>(null);

  const handleOptionToggle = (option: 'beautify' | 'contrast') => {
    setActiveOptions(prev => (prev === option ? null : option));
  };

  const presets = [
    { name: 'Blur Background', prompt: 'Apply a realistic depth-of-field effect, making the background blurry while keeping the main subject in sharp focus.' },
    { name: 'Enhance Details', prompt: 'Slightly enhance the sharpness and details of the image without making it look unnatural.' },
    { name: 'Warmer Lighting', prompt: 'Adjust the color temperature to give the image warmer, golden-hour style lighting.' },
    { name: 'Studio Light', prompt: 'Add dramatic, professional studio lighting to the main subject.' },
  ];

  const activePrompt = selectedPresetPrompt || customPrompt;

  const handlePresetClick = (prompt: string) => {
    setSelectedPresetPrompt(prompt);
    setCustomPrompt('');
    setActiveOptions(null);
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomPrompt(e.target.value);
    setSelectedPresetPrompt(null);
    setActiveOptions(null);
  };

  const handleApply = () => {
    if (activePrompt) {
      onApplyAdjustment(activePrompt);
    }
  };
  
  const handleAutoAdjust = () => {
    setActiveOptions(null);
    onApplyAdjustment("Automatically enhance the image's lighting, color balance, and contrast for a professional, natural look. Do not crop or change the composition.");
  };

  const handleRemoveBackground = () => {
    setActiveOptions(null);
    onApplyAdjustment("Remove the background from the image, keeping only the main subject. The new background must be transparent.");
  };
  
  const handleRemoveWatermark = () => {
    setActiveOptions(null);
    onApplyWatermarkRemoval();
  };

  const handleHDREffect = () => {
    setActiveOptions(null);
    onApplyAdjustment("Apply a High Dynamic Range (HDR) effect to the image. Enhance the details in both the shadows and highlights, increase local contrast, and make the colors more vibrant, without making it look unnatural or oversaturated.");
  };

  const handleUpscale = () => {
    setActiveOptions(null);
    onApplyUpscale();
  };

  const handleSharpen = () => {
    setActiveOptions(null);
    onApplyAdjustment("Sharpen the image to bring out finer details, ensuring edges remain crisp and avoiding over-sharpening artifacts.");
  };
  
  const handleIncreaseContrast = () => {
    setActiveOptions(null);
    onApplyAdjustment("Subtly increase the image's contrast to enhance the tonal range and make it more punchy and dramatic. It's crucial to preserve details in both the brightest highlights and the darkest shadows, avoiding any clipping.");
  };

  const handleDecreaseContrast = () => {
    setActiveOptions(null);
    onApplyAdjustment("Subtly decrease the image's contrast to give it a softer, more muted, and slightly flatter look. Ensure the image does not become washed out and retains its essential tonal range and detail.");
  };

  const handleBeautifyFemale = () => {
    onApplyAdjustment("Subtly beautify the female subject in the photo. Smooth skin while retaining natural texture, slightly brighten the eyes and teeth, add a touch of color to the lips and cheeks, and enhance the hair's shine. The overall effect should be natural and flattering, not artificial.");
    setActiveOptions(null);
  };

  const handleBeautifyMale = () => {
      onApplyAdjustment("Subtly enhance the male subject in the photo. Even out skin tone while preserving texture like stubble, slightly sharpen the jawline and eyes, and reduce minor blemishes. The result should look healthy and rested, completely natural and not retouched.");
      setActiveOptions(null);
  };

  return (
    <div className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-4 flex flex-col gap-4 animate-fade-in backdrop-blur-sm">
      <h3 className="text-lg font-semibold text-center text-gray-300">Adjustments</h3>
      
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={handleAutoAdjust}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-3 bg-gradient-to-br from-purple-600 to-indigo-500 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-indigo-500/20 hover:shadow-xl hover:shadow-indigo-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-base disabled:from-indigo-800 disabled:to-indigo-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
        >
          <MagicWandIcon className="w-5 h-5" />
          Auto Adjust
        </button>
        <button
          onClick={handleRemoveBackground}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-3 bg-gradient-to-br from-pink-600 to-rose-500 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-rose-500/20 hover:shadow-xl hover:shadow-rose-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-base disabled:from-rose-800 disabled:to-rose-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
        >
          <RemoveBgIcon className="w-5 h-5" />
          Remove BG
        </button>
        <button
          onClick={handleRemoveWatermark}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-3 bg-gradient-to-br from-yellow-500 to-amber-500 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-amber-500/20 hover:shadow-xl hover:shadow-amber-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-base disabled:from-amber-800 disabled:to-amber-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
        >
          <RemoveWatermarkIcon className="w-5 h-5" />
          Remove Watermark
        </button>
        <button
          onClick={handleHDREffect}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-3 bg-gradient-to-br from-orange-500 to-amber-500 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-amber-500/20 hover:shadow-xl hover:shadow-amber-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-base disabled:from-amber-800 disabled:to-amber-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
        >
          <HDRIcon className="w-5 h-5" />
          HDR Effect
        </button>
         <button
          onClick={() => handleOptionToggle('beautify')}
          disabled={isLoading}
          className={`w-full flex items-center justify-center gap-3 bg-gradient-to-br from-teal-500 to-cyan-500 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-cyan-500/20 hover:shadow-xl hover:shadow-cyan-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-base disabled:from-cyan-800 disabled:to-cyan-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none ${activeOptions === 'beautify' ? 'ring-2 ring-offset-2 ring-offset-gray-800 ring-cyan-300' : ''}`}
        >
          <BeautifyIcon className="w-5 h-5" />
          Beautify
        </button>
        <button
          onClick={handleUpscale}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-3 bg-gradient-to-br from-green-500 to-teal-500 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-teal-500/20 hover:shadow-xl hover:shadow-teal-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-base disabled:from-teal-800 disabled:to-teal-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
        >
          <UpscaleIcon className="w-5 h-5" />
          AI Upscale
        </button>
        <button
          onClick={handleSharpen}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-3 bg-gradient-to-br from-sky-600 to-sky-500 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-sky-500/20 hover:shadow-xl hover:shadow-sky-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-base disabled:from-sky-800 disabled:to-sky-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
        >
          <SharpenIcon className="w-5 h-5" />
          Sharpen
        </button>
        <button
          onClick={() => handleOptionToggle('contrast')}
          disabled={isLoading}
          className={`w-full flex items-center justify-center gap-3 bg-gradient-to-br from-gray-600 to-gray-500 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-gray-500/20 hover:shadow-xl hover:shadow-gray-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-base disabled:from-gray-800 disabled:to-gray-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none ${activeOptions === 'contrast' ? 'ring-2 ring-offset-2 ring-offset-gray-800 ring-gray-300' : ''}`}
        >
          <ContrastIcon className="w-5 h-5" />
          Contrast
        </button>
      </div>
      
      {activeOptions === 'beautify' && (
        <div className="grid grid-cols-2 gap-3 animate-fade-in p-2 bg-gray-900/30 rounded-lg">
          <button onClick={handleBeautifyFemale} disabled={isLoading} className="w-full text-center bg-white/10 text-gray-200 font-semibold py-3 px-4 rounded-md transition-all duration-200 ease-in-out hover:bg-white/20 active:scale-95 text-base disabled:opacity-50 disabled:cursor-not-allowed">
            For Female
          </button>
          <button onClick={handleBeautifyMale} disabled={isLoading} className="w-full text-center bg-white/10 text-gray-200 font-semibold py-3 px-4 rounded-md transition-all duration-200 ease-in-out hover:bg-white/20 active:scale-95 text-base disabled:opacity-50 disabled:cursor-not-allowed">
            For Male
          </button>
        </div>
      )}

      {activeOptions === 'contrast' && (
        <div className="grid grid-cols-2 gap-3 animate-fade-in p-2 bg-gray-900/30 rounded-lg">
          <button onClick={handleIncreaseContrast} disabled={isLoading} className="w-full text-center bg-white/10 text-gray-200 font-semibold py-3 px-4 rounded-md transition-all duration-200 ease-in-out hover:bg-white/20 active:scale-95 text-base disabled:opacity-50 disabled:cursor-not-allowed">
            Increase
          </button>
          <button onClick={handleDecreaseContrast} disabled={isLoading} className="w-full text-center bg-white/10 text-gray-200 font-semibold py-3 px-4 rounded-md transition-all duration-200 ease-in-out hover:bg-white/20 active:scale-95 text-base disabled:opacity-50 disabled:cursor-not-allowed">
            Decrease
          </button>
        </div>
      )}

      <div className="relative flex py-2 items-center">
        <div className="flex-grow border-t border-gray-600"></div>
        <span className="flex-shrink mx-4 text-gray-400 text-sm">OR</span>
        <div className="flex-grow border-t border-gray-600"></div>
      </div>
      
      <p className="text-md text-center text-gray-400">Apply a preset or describe your own adjustment below.</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {presets.map(preset => (
          <button
            key={preset.name}
            onClick={() => handlePresetClick(preset.prompt)}
            disabled={isLoading}
            className={`w-full text-center bg-white/10 text-gray-200 font-semibold py-3 px-4 rounded-md transition-all duration-200 ease-in-out hover:bg-white/20 active:scale-95 text-base disabled:opacity-50 disabled:cursor-not-allowed ${selectedPresetPrompt === preset.prompt ? 'ring-2 ring-offset-2 ring-offset-gray-800 ring-blue-500' : ''}`}
          >
            {preset.name}
          </button>
        ))}
      </div>

      <input
        type="text"
        value={customPrompt}
        onChange={handleCustomChange}
        placeholder="Or describe an adjustment (e.g., 'change background to a forest')"
        className="flex-grow bg-gray-800 border border-gray-600 text-gray-200 rounded-lg p-4 focus:ring-2 focus:ring-blue-500 focus:outline-none transition w-full disabled:cursor-not-allowed disabled:opacity-60 text-base"
        disabled={isLoading}
      />

      {activePrompt && (
        <div className="animate-fade-in flex flex-col gap-4 pt-2">
            <button
                onClick={handleApply}
                className="w-full bg-gradient-to-br from-blue-600 to-blue-500 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-base disabled:from-blue-800 disabled:to-blue-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
                disabled={isLoading || !activePrompt.trim()}
            >
                Apply Adjustment
            </button>
        </div>
      )}
    </div>
  );
};

export default AdjustmentPanel;
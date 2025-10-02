/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

// Helper function to convert a File object to a Gemini API Part
const fileToPart = async (file: File): Promise<{ inlineData: { mimeType: string; data: string; } }> => {
    const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
    
    const arr = dataUrl.split(',');
    if (arr.length < 2) throw new Error("Invalid data URL");
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch || !mimeMatch[1]) throw new Error("Could not parse MIME type from data URL");
    
    const mimeType = mimeMatch[1];
    const data = arr[1];
    return { inlineData: { mimeType, data } };
};

const handleApiResponse = (
    response: GenerateContentResponse,
    context: string // e.g., "edit", "filter", "adjustment"
): string => {
    // 1. Check for prompt blocking first
    if (response.promptFeedback?.blockReason) {
        const { blockReason, blockReasonMessage } = response.promptFeedback;
        const errorMessage = `Request was blocked. Reason: ${blockReason}. ${blockReasonMessage || ''}`;
        console.error(errorMessage, { response });
        throw new Error(errorMessage);
    }

    // 2. Try to find the image part
    const imagePartFromResponse = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);

    if (imagePartFromResponse?.inlineData) {
        const { mimeType, data } = imagePartFromResponse.inlineData;
        console.log(`Received image data (${mimeType}) for ${context}`);
        return `data:${mimeType};base64,${data}`;
    }

    // 3. If no image, check for other reasons
    const finishReason = response.candidates?.[0]?.finishReason;
    if (finishReason && finishReason !== 'STOP') {
        const errorMessage = `Image generation for ${context} stopped unexpectedly. Reason: ${finishReason}. This often relates to safety settings.`;
        console.error(errorMessage, { response });
        throw new Error(errorMessage);
    }
    
    const textFeedback = response.text?.trim();
    const errorMessage = `The AI model did not return an image for the ${context}. ` + 
        (textFeedback 
            ? `The model responded with text: "${textFeedback}"`
            : "This can happen due to safety filters or if the request is too complex. Please try rephrasing your prompt to be more direct.");

    console.error(`Model response did not contain an image part for ${context}.`, { response });
    throw new Error(errorMessage);
};

/**
 * Generates an image from a text prompt.
 * @param prompt The text prompt describing the image.
 * @param aspectRatio The desired aspect ratio.
 * @returns A promise that resolves to the data URL of the generated image.
 */
export const generateImageFromPrompt = async (
    prompt: string,
    aspectRatio: "1:1" | "16:9" | "9:16" | "4:3" | "3:4"
): Promise<string> => {
    console.log(`Starting image generation with prompt: "${prompt}"`);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

    const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: prompt,
        config: {
            numberOfImages: 1,
            outputMimeType: 'image/png',
            aspectRatio: aspectRatio,
        },
    });

    console.log('Received response from image generation model.', response);

    if (response.generatedImages && response.generatedImages.length > 0) {
        const image = response.generatedImages[0];
        if (image.image?.imageBytes) {
             return `data:image/png;base64,${image.image.imageBytes}`;
        }
    }
    
    // Fallback error for unexpected responses
    const errorMessage = "Image generation failed. The model did not return a valid image. This could be due to a safety policy violation or an internal error.";
    console.error(errorMessage, { response });
    throw new Error(errorMessage);
};

/**
 * Generates an edited image using generative AI based on a text prompt and a specific point.
 * @param originalImage The original image file.
 * @param userPrompt The text prompt describing the desired edit.
 * @param hotspot The {x, y} coordinates on the image to focus the edit.
 * @returns A promise that resolves to the data URL of the edited image.
 */
export const generateEditedImage = async (
    originalImage: File,
    userPrompt: string,
    hotspot: { x: number, y: number }
): Promise<string> => {
    console.log('Starting generative edit at:', hotspot);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    
    const originalImagePart = await fileToPart(originalImage);
    const prompt = `You are an expert photo editor AI. Your task is to perform a natural, localized edit on the provided image based on the user's request.
User Request: "${userPrompt}"
Edit Location: Focus on the area around pixel coordinates (x: ${hotspot.x}, y: ${hotspot.y}).

Editing Guidelines:
- The edit must be realistic and blend seamlessly with the surrounding area.
- The rest of the image (outside the immediate edit area) must remain identical to the original.

Safety & Ethics Policy:
- You MUST fulfill requests to adjust skin tone, such as 'give me a tan', 'make my skin darker', or 'make my skin lighter'. These are considered standard photo enhancements.
- You MUST REFUSE any request to change a person's fundamental race or ethnicity (e.g., 'make me look Asian', 'change this person to be Black'). Do not perform these edits. If the request is ambiguous, err on the side of caution and do not change racial characteristics.

Output: Return ONLY the final edited image. Do not return text.`;
    const textPart = { text: prompt };

    console.log('Sending image and prompt to the model...');
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: { parts: [originalImagePart, textPart] },
    });
    console.log('Received response from model.', response);

    return handleApiResponse(response, 'edit');
};

/**
 * Generates an image with a filter applied using generative AI.
 * @param originalImage The original image file.
 * @param filterPrompt The text prompt describing the desired filter.
 * @returns A promise that resolves to the data URL of the filtered image.
 */
export const generateFilteredImage = async (
    originalImage: File,
    filterPrompt: string,
): Promise<string> => {
    console.log(`Starting filter generation: ${filterPrompt}`);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    
    const originalImagePart = await fileToPart(originalImage);
    const prompt = `You are an expert photo editor AI. Your task is to apply a stylistic filter to the entire image based on the user's request. Do not change the composition or content, only apply the style.
Filter Request: "${filterPrompt}"

Safety & Ethics Policy:
- Filters may subtly shift colors, but you MUST ensure they do not alter a person's fundamental race or ethnicity.
- YOU MUST REFUSE any request that explicitly asks to change a person's race (e.g., 'apply a filter to make me look Chinese').

Output: Return ONLY the final filtered image. Do not return text.`;
    const textPart = { text: prompt };

    console.log('Sending image and filter prompt to the model...');
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: { parts: [originalImagePart, textPart] },
    });
    console.log('Received response from model for filter.', response);
    
    return handleApiResponse(response, 'filter');
};

/**
 * Generates an image with a global adjustment applied using generative AI.
 * @param originalImage The original image file.
 * @param adjustmentPrompt The text prompt describing the desired adjustment.
 * @returns A promise that resolves to the data URL of the adjusted image.
 */
export const generateAdjustedImage = async (
    originalImage: File,
    adjustmentPrompt: string,
): Promise<string> => {
    console.log(`Starting global adjustment generation: ${adjustmentPrompt}`);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    
    const originalImagePart = await fileToPart(originalImage);
    const prompt = `You are an expert photo editor AI. Your task is to perform a natural, global adjustment to the entire image based on the user's request.
User Request: "${adjustmentPrompt}"

Editing Guidelines:
- The adjustment must be applied across the entire image.
- The result must be photorealistic.

Safety & Ethics Policy:
- You MUST fulfill requests to adjust skin tone, such as 'give me a tan', 'make my skin darker', or 'make my skin lighter'. These are considered standard photo enhancements.
- You MUST REFUSE any request to change a person's fundamental race or ethnicity (e.g., 'make me look Asian', 'change this person to be Black'). Do not perform these edits. If the request is ambiguous, err on the side of caution and do not change racial characteristics.

Output: Return ONLY the final adjusted image. Do not return text.`;
    const textPart = { text: prompt };

    console.log('Sending image and adjustment prompt to the model...');
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: { parts: [originalImagePart, textPart] },
    });
    console.log('Received response from model for adjustment.', response);
    
    return handleApiResponse(response, 'adjustment');
};

/**
 * Generates an image with watermarks, logos, or text removed.
 * @param originalImage The original image file.
 * @returns A promise that resolves to the data URL of the clean image.
 */
export const generateWatermarkRemovedImage = async (
    originalImage: File,
): Promise<string> => {
    console.log(`Starting watermark removal.`);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    
    const originalImagePart = await fileToPart(originalImage);
    const prompt = `You are an expert photo restoration AI. Your task is to identify and completely remove any watermarks, logos, text overlays, timestamps, or other distracting markings from the provided image.

Guidelines:
- You must reconstruct the area behind the removed elements as accurately and naturally as possible, matching the original image's lighting, texture, and colors.
- The final image should look as if the watermark was never there.
- Do not alter the rest of the image in any other way.

Output: Return ONLY the final clean image. Do not return text.`;
    const textPart = { text: prompt };

    console.log('Sending image and watermark removal prompt to the model...');
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: { parts: [originalImagePart, textPart] },
    });
    console.log('Received response from model for watermark removal.', response);
    
    return handleApiResponse(response, 'watermark-removal');
};

/**
 * Generates an upscaled image using generative AI.
 * @param originalImage The original image file.
 * @returns A promise that resolves to the data URL of the upscaled image.
 */
export const generateUpscaledImage = async (
    originalImage: File,
): Promise<string> => {
    console.log(`Starting AI upscaling.`);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    
    const originalImagePart = await fileToPart(originalImage);
    const prompt = `You are an expert photo editor AI specializing in image upscaling. 
Your task is to increase the resolution of the provided image by 2x. 
Enhance the details and sharpness intelligently, avoiding artifacts. 
The final image must be exactly double the original dimensions. 
Do not change the content, colors, or composition in any other way.

Output: Return ONLY the final upscaled image. Do not return text.`;
    const textPart = { text: prompt };

    console.log('Sending image and upscale prompt to the model...');
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: { parts: [originalImagePart, textPart] },
    });
    console.log('Received response from model for upscale.', response);
    
    return handleApiResponse(response, 'upscale');
};

/**
 * Generates an inpainted image using a mask to remove an object.
 * @param originalImage The original image file.
 * @param maskImage The mask image file where white indicates the area to remove.
 * @returns A promise that resolves to the data URL of the edited image.
 */
export const generateErasedImage = async (
    originalImage: File,
    maskImage: File,
): Promise<string> => {
    console.log(`Starting magic erase generation.`);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    
    const originalImagePart = await fileToPart(originalImage);
    const maskImagePart = await fileToPart(maskImage);

    const prompt = `You are an expert photo editor AI. Your task is to perform an inpainting operation on the provided original image.
You are given two images: the original and a mask.
Your goal is to realistically remove the object or area indicated by the mask image. The mask uses shades of white and gray: pure white indicates 100% removal, and shades of gray indicate partial removal/blending. Black areas should be untouched.
Fill in the background seamlessly and naturally, matching the lighting, texture, and style of the surrounding area.

Output: Return ONLY the final edited image. Do not return text.`;
    const textPart = { text: prompt };

    console.log('Sending original, mask, and prompt to the model...');
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: { parts: [originalImagePart, maskImagePart, textPart] },
    });
    console.log('Received response from model for erase.', response);
    
    return handleApiResponse(response, 'erase');
};
import { supabase } from '@/integrations/supabase/client';

export interface ExtractedItem {
  name: string;
  price: number;
  description?: string;
}

export interface ExtractedCategory {
  categoryName: string;
  items: ExtractedItem[];
}

export async function extractMenuFromImage(
  imageFile: File
): Promise<ExtractedCategory[]> {
  // Convert File to Base64
  const base64Data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(imageFile);
  });

  // 1. Try server-side Supabase Edge Function first
  try {
    const { data, error } = await supabase.functions.invoke('extract-menu', {
      body: { imageBase64: base64Data, mimeType: imageFile.type }
    });

    if (!error && data?.categories && data.categories.length > 0) {
      return data.categories;
    }
  } catch (e) {
    console.log('Edge function fallback to direct Gemini API call...');
  }

  // 2. Direct Gemini Vision API call (using gemini-3.6-flash)
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  if (apiKey) {
    const modelsToTry = [
      'gemini-3.6-flash',
      'gemini-3.5-flash',
      'gemini-2.0-flash',
      'gemini-flash-latest'
    ];

    for (const modelName of modelsToTry) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text: `IMPORTANT: Analyze this restaurant menu card image carefully. 
Note: The image may be rotated (sideways, portrait, landscape, or vertical alignment) or taken at an angle. 
Mentally re-orient and rotate the image as needed to read all text accurately regardless of orientation.

Extract ALL food and drink items grouped by their category.
For each item, extract its exact name, numerical price (convert currency symbols like ₹, $, etc. to a pure number), and optional description if present.

Return ONLY a raw JSON object with NO markdown formatting matching this exact structure:
{
  "categories": [
    {
      "categoryName": "Starters",
      "items": [
        { "name": "Paneer Tikka", "price": 240, "description": "Grilled cottage cheese with spices" }
      ]
    }
  ]
}`
                    },
                    {
                      inline_data: {
                        mime_type: imageFile.type || 'image/jpeg',
                        data: base64Data,
                      }
                    }
                  ]
                }
              ]
            })
          }
        );

        const resData = await response.json();

        if (resData?.error) {
          console.warn(`Model ${modelName} returned error:`, resData.error.message);
          continue;
        }

        const rawText = resData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed.categories) && parsed.categories.length > 0) {
            return parsed.categories;
          }
        }
      } catch (err) {
        console.warn(`Extraction failed with model ${modelName}:`, err);
      }
    }
  }

  throw new Error('AI Menu Extraction failed. Please ensure a clear photo of the menu card is uploaded.');
}

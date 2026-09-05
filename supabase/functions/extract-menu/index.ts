import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, mimeType } = await req.json();

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: 'imageBase64 is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');

    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({ error: 'GEMINI_API_KEY secret is not set in Supabase environment variables' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${geminiApiKey}`,
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
                    mime_type: mimeType || 'image/jpeg',
                    data: imageBase64,
                  }
                }
              ]
            }
          ]
        })
      }
    );

    const resData = await response.json();
    const rawText = resData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return new Response(
        JSON.stringify({ error: 'Could not parse structured menu from AI response', rawText }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return new Response(
      JSON.stringify({ success: true, categories: parsed.categories || [] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[extract-menu] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

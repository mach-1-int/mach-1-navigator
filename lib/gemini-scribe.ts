'use server';

import { GoogleGenerativeAI } from "@google/generative-ai";

export interface TemplateFieldContext {
  id: string
  label: string
  type: string
  options?: string[]
  required?: boolean
}

export interface ScribeResult {
  success: boolean
  data: Record<string, unknown>
  fieldsMatched: number
  isMock: boolean
  error?: string
}

// Mock data that matches the Standard Patient Navigation template field IDs
const MOCK_DATA: Record<string, unknown> = {
  "contact-method": "Face-to-Face",
  "intervention": "Health Education",
  "patient-response": "Receptive",
  "plan-next-steps": "Patient expressed anxiety about upcoming surgery. Spent time explaining pre-op instructions. Patient now understands the process and feels calmer. Will follow up before surgery date.",
}

export async function parseEncounterTranscript(
  transcript: string,
  templateFields: TemplateFieldContext[]
): Promise<ScribeResult> {
  const apiKey = process.env.GEMINI_API_KEY;

  // Safety Check: If no API key, return mock data
  if (!apiKey) {
    console.log("⚠️ No GEMINI_API_KEY found. Returning mock data.");
    return createMockResponse(templateFields);
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Build field descriptions for the prompt
    const fieldDescriptions = templateFields.map((field) => {
      let desc = `- "${field.id}" (${field.label}): ${field.type}`;
      if (field.options && field.options.length > 0) {
        desc += ` - MUST be one of: ${JSON.stringify(field.options)}`;
      }
      if (field.type === "textarea" || field.type === "text") {
        desc += " - Write a professional clinical summary";
      }
      return desc;
    }).join("\n");

    const prompt = `You are an expert medical scribe for patient navigation documentation.
Analyze the transcript and extract data for ALL the form fields below.

CRITICAL RULES:
1. For 'select' fields, you MUST choose EXACTLY one of the provided options. Do not invent new options.
2. For 'textarea' fields, write a professional clinical narrative based on what was discussed.
3. Return ONLY valid JSON with field IDs as keys. No markdown, no explanations.
4. You MUST provide a value for EVERY field listed below - do not skip any.
5. Map the context appropriately:
   - "Face-to-Face" = in-person home visit, apartment visit, or office visit
   - "Phone" = phone call
   - "Telehealth" = video call
   - "Health Education" = explaining medical information, reviewing documents, discussing procedures
   - "Resource Referral" = connecting patient to community resources, transportation, housing, food programs
   - "Provider Coordination" = coordinating with doctors, specialists, or other healthcare providers
   - If patient feels better/calmer after intervention, response is "Receptive"

TEMPLATE FIELDS (you must fill ALL of these):
${fieldDescriptions}

TRANSCRIPT:
"${transcript}"

Return strictly valid JSON with ALL fields:`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();

    // Clean markdown formatting if present
    text = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    console.log("🤖 Gemini Raw Response:", text);

    const parsedData = JSON.parse(text);
    console.log("🤖 Parsed JSON keys:", Object.keys(parsedData));
    console.log("🤖 Expected field IDs:", templateFields.map(f => f.id));

    // Validate and count matched fields
    const validatedData: Record<string, unknown> = {};
    let fieldsMatched = 0;

    for (const field of templateFields) {
      console.log(`🔍 Checking field "${field.id}":`, parsedData[field.id]);
      if (parsedData[field.id] !== undefined) {
        // For select fields, validate the option exists
        if (field.type === "select" && field.options) {
          const value = parsedData[field.id];
          if (field.options.includes(value)) {
            validatedData[field.id] = value;
            fieldsMatched++;
            console.log(`  ✅ Matched select: ${value}`);
          } else {
            // Try to find closest match
            const lowerValue = String(value).toLowerCase();
            const match = field.options.find(
              (opt) => opt.toLowerCase().includes(lowerValue) || lowerValue.includes(opt.toLowerCase())
            );
            if (match) {
              validatedData[field.id] = match;
              fieldsMatched++;
              console.log(`  ✅ Fuzzy matched: ${value} -> ${match}`);
            } else {
              console.log(`  ❌ No match for "${value}" in options:`, field.options);
            }
          }
        } else {
          validatedData[field.id] = parsedData[field.id];
          fieldsMatched++;
          console.log(`  ✅ Added ${field.type}: ${String(parsedData[field.id]).slice(0, 50)}...`);
        }
      } else {
        console.log(`  ⚠️ Field not in response`);
      }
    }

    console.log("🎯 Final validated data:", validatedData);
    console.log("🎯 Fields matched:", fieldsMatched);

    return {
      success: true,
      data: validatedData,
      fieldsMatched,
      isMock: false,
    };
  } catch (error) {
    console.error("❌ Gemini Error:", error);
    // Return mock data on failure
    return createMockResponse(templateFields);
  }
}

function createMockResponse(templateFields: TemplateFieldContext[]): ScribeResult {
  console.log("📦 Creating mock response...");
  console.log("📦 Template field IDs:", templateFields.map(f => f.id));
  console.log("📦 Mock data keys:", Object.keys(MOCK_DATA));

  const data: Record<string, unknown> = {};
  let fieldsMatched = 0;

  for (const field of templateFields) {
    if (MOCK_DATA[field.id] !== undefined) {
      // Validate mock data against field options
      if (field.type === "select" && field.options) {
        const mockValue = MOCK_DATA[field.id];
        if (field.options.includes(mockValue as string)) {
          data[field.id] = mockValue;
          fieldsMatched++;
        } else {
          // Use first option as fallback
          data[field.id] = field.options[0];
          fieldsMatched++;
        }
      } else {
        data[field.id] = MOCK_DATA[field.id];
        fieldsMatched++;
      }
    } else if (field.type === "select" && field.options && field.options.length > 0) {
      // For unmapped select fields, use first option
      data[field.id] = field.options[0];
      fieldsMatched++;
    }
  }

  console.log("📦 Mock response data:", data);
  console.log("📦 Mock fields matched:", fieldsMatched);

  return {
    success: true,
    data,
    fieldsMatched,
    isMock: true,
  };
}
'use server';

import { GoogleGenerativeAI } from "@google/generative-ai";
import type { NoteFieldType } from "./types";

export interface TemplateFieldContext {
  id: string
  label: string
  type: NoteFieldType
  options?: string[]
  required?: boolean
}

export interface ScribeResult {
  success: boolean
  data: Record<string, unknown>
  fieldsMatched: number
  isMock: boolean
  error?: string
  errorKind?: "no_api_key" | "api_error" | "parse_error"
  fieldConfidence?: Record<string, "high" | "low">
  missingFieldIds?: string[]
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

  // Legitimate demo mode: no API key configured, return clearly-labeled mock data
  if (!apiKey) {
    console.log("⚠️ No GEMINI_API_KEY found. Returning mock data.");
    return createMockResponse(templateFields);
  }

  let text: string;
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

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
    text = response.text();
  } catch (error) {
    // Runtime API failure: surface the error honestly, never mislabel mock data as AI output
    console.error("❌ Gemini API Error:", error);
    return {
      success: false,
      data: {},
      fieldsMatched: 0,
      isMock: false,
      errorKind: "api_error",
      error: error instanceof Error ? error.message : "AI request failed",
    };
  }

  // Clean markdown formatting if present
  text = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  console.log("🤖 Gemini Raw Response:", text);

  let parsedData: Record<string, unknown>;
  try {
    parsedData = JSON.parse(text);
  } catch (error) {
    console.error("❌ Gemini JSON Parse Error:", error);
    return {
      success: false,
      data: {},
      fieldsMatched: 0,
      isMock: false,
      errorKind: "parse_error",
      error: error instanceof Error ? error.message : "Could not parse AI response as JSON",
    };
  }

  console.log("🤖 Parsed JSON keys:", Object.keys(parsedData));
  console.log("🤖 Expected field IDs:", templateFields.map(f => f.id));

  // Validate and count matched fields
  const validatedData: Record<string, unknown> = {};
  const fieldConfidence: Record<string, "high" | "low"> = {};
  const missingFieldIds: string[] = [];
  let fieldsMatched = 0;

  for (const field of templateFields) {
    const rawValue = parsedData[field.id];
    console.log(`🔍 Checking field "${field.id}":`, rawValue);
    if (rawValue === undefined || rawValue === null || rawValue === "") {
      console.log(`  ⚠️ Field empty or not in response`);
      missingFieldIds.push(field.id);
      continue;
    }

    // For select fields, validate the option exists
    if (field.type === "select" && field.options) {
      if (field.options.includes(rawValue as string)) {
        validatedData[field.id] = rawValue;
        fieldConfidence[field.id] = "high";
        fieldsMatched++;
        console.log(`  ✅ Matched select: ${rawValue}`);
      } else {
        // Try to find closest match (fuzzy/substring): mark low confidence
        const lowerValue = String(rawValue).toLowerCase();
        const match = field.options.find(
          (opt) => opt.toLowerCase().includes(lowerValue) || lowerValue.includes(opt.toLowerCase())
        );
        if (match) {
          validatedData[field.id] = match;
          fieldConfidence[field.id] = "low";
          fieldsMatched++;
          console.log(`  ⚠️ Fuzzy matched (low confidence): ${rawValue} -> ${match}`);
        } else {
          console.log(`  ❌ No match for "${rawValue}" in options:`, field.options);
          missingFieldIds.push(field.id);
        }
      }
    } else {
      validatedData[field.id] = rawValue;
      fieldConfidence[field.id] = "high";
      fieldsMatched++;
      console.log(`  ✅ Added ${field.type}: ${String(rawValue).slice(0, 50)}...`);
    }
  }

  console.log("🎯 Final validated data:", validatedData);
  console.log("🎯 Fields matched:", fieldsMatched);

  return {
    success: true,
    data: validatedData,
    fieldsMatched,
    isMock: false,
    fieldConfidence,
    missingFieldIds,
  };
}

/**
 * Explicit opt-in to demo values: lets the client fall back to canned mock data
 * after a runtime failure, clearly labeled as mock (never silently).
 */
export async function getMockScribeResult(
  templateFields: TemplateFieldContext[]
): Promise<ScribeResult> {
  return createMockResponse(templateFields);
}

function createMockResponse(templateFields: TemplateFieldContext[]): ScribeResult {
  console.log("📦 Creating mock response...");

  const data: Record<string, unknown> = {};
  const fieldConfidence: Record<string, "high" | "low"> = {};
  const missingFieldIds: string[] = [];
  let fieldsMatched = 0;

  for (const field of templateFields) {
    if (MOCK_DATA[field.id] !== undefined) {
      // Validate mock data against field options
      if (field.type === "select" && field.options) {
        const mockValue = MOCK_DATA[field.id];
        if (field.options.includes(mockValue as string)) {
          data[field.id] = mockValue;
        } else {
          // Use first option as fallback
          data[field.id] = field.options[0];
        }
        fieldConfidence[field.id] = "high";
        fieldsMatched++;
      } else {
        data[field.id] = MOCK_DATA[field.id];
        fieldConfidence[field.id] = "high";
        fieldsMatched++;
      }
    } else if (field.type === "select" && field.options && field.options.length > 0) {
      // For unmapped select fields, use first option
      data[field.id] = field.options[0];
      fieldConfidence[field.id] = "high";
      fieldsMatched++;
    } else {
      missingFieldIds.push(field.id);
    }
  }

  console.log("📦 Mock response data:", data);
  console.log("📦 Mock fields matched:", fieldsMatched);

  return {
    success: true,
    data,
    fieldsMatched,
    isMock: true,
    errorKind: "no_api_key",
    fieldConfidence,
    missingFieldIds,
  };
}

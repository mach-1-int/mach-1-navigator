'use server';

import { GoogleGenerativeAI } from "@google/generative-ai";

export interface TemplateFieldContext {
  id: string
  label: string
  type: string
  options?: string[]
  required?: boolean
  attestationText?: string
}

export interface ScribeNoteContext {
  templateName?: string
  encounterType?: string
  patientName?: string
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

// Mock values for select fields, keyed by field id (validated against options)
const MOCK_SELECT_DATA: Record<string, string> = {
  "contact-method": "Face-to-Face",
  "intervention": "Health Education",
  "patient-response": "Receptive",
  "spoke-with": "patient",
  "need-category": "Food security",
  "unite-us-referral": "Submitted",
}

// Flat field-id -> value map covering the legacy templates AND every Gellert
// template field id, with manual-compliant values (third person, colon+AM/PM
// times) so the no-API-key demo path fills the new templates convincingly.
const MOCK_DATA: Record<string, unknown> = {
  // Legacy templates
  "plan-next-steps": "Patient expressed anxiety about upcoming surgery. Navigator spent time explaining pre-op instructions. Patient now understands the process and feels calmer. Navigator will follow up before surgery date.",
  // Gellert - transit section (shared by medical/BH/lab/SDOH templates)
  "transport-provided": true,
  "pickup-time": "9:40AM",
  "pickup-location": "Patient's home",
  "in-transit-coaching": ["Connection — rapport check-in", "Preparation — what to expect"],
  // Gellert - medical appointment
  "arrival-time": "10:05AM",
  "provider-guidance": "Continue lisinopril every morning, reduce dietary sodium, and repeat labs before the next visit.",
  "patient-response": 'asked about the swelling in her ankles, stated, "I\'ve been walking to the mailbox every day like you asked," and repeated the medication instructions back correctly.',
  "patient-involvement": 'Patient was engaged throughout, asked questions about the plan, and stated, "I understand what I need to do next."',
  "follow-up-date": "March 4",
  "follow-up-time": "2:30PM",
  "with-patient-until": "11:15AM",
  "duration": 50,
  "follow-up-address": "4045 W Main St, Phoenix, AZ 85004",
  // Gellert - phone call
  "call-time": "2:15PM",
  "call-purpose": "a weekly check-in and appointment coordination",
  "patient-statements": 'stated, "I have been taking my medications every morning like we talked about."',
  "plan": "Navigator will confirm transportation for the upcoming appointment and call the patient again next week.",
  "call-end-time": "2:45PM",
  // Gellert - behavioral health
  "safety-screen": [
    "Suicidal ideation (SI)",
    "Homicidal ideation (HI)",
    "Auditory hallucinations (AH)",
    "Visual hallucinations (VH)",
  ],
  "med-changes": "Psychiatrist increased sertraline from 50mg to 100mg daily and reviewed side effects to monitor during the first two weeks.",
  // Gellert - lab / imaging
  "orders-completed": "Fasting labs drawn as ordered; CBC and metabolic panel completed.",
  "results-follow-up": "Results will be sent to the PCP; Navigator will confirm the patient reviews them at the next appointment",
  // Gellert - medication assistance
  "no-touch-attestation": true,
  "pillbox-activity": "Patient filled all seven daily compartments of the weekly pillbox herself while Navigator read each label aloud and gave verbal direction only.",
  // Gellert - SDOH
  "resource-connected": "Meals on Wheels home delivery and the hospital food pantry; intake call completed together.",
  // Gellert - supervision
  "concerns": "Documentation timeliness on same-day multi-appointment patients.",
  "directives": "Supervisor directed the navigator to complete all notes before end of shift and to link same-day continuation notes to the primary note.",
}

// Normalize "3:03 pm", "15:00", "3pm" to the manual's canonical "3:03PM"
function normalizeTimeValue(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  const trimmed = raw.trim();
  const match = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!match) return raw;
  let hours = parseInt(match[1], 10);
  const minutes = match[2] ?? "00";
  let meridiem = match[3]?.toUpperCase() as "AM" | "PM" | undefined;
  if (!meridiem) {
    meridiem = hours >= 12 ? "PM" : "AM";
    if (hours > 12) hours -= 12;
    if (hours === 0) hours = 12;
  }
  return `${hours}:${minutes}${meridiem}`;
}

export async function parseEncounterTranscript(
  transcript: string,
  templateFields: TemplateFieldContext[],
  noteContext?: ScribeNoteContext
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
      if (field.type === "time") {
        desc += ' - Extract the clock time and normalize to H:MMAM/PM with a colon (e.g. "ten oh five" -> "10:05AM")';
      }
      if (field.type === "attestation") {
        desc += ` - boolean; true ONLY if the transcript explicitly supports this attestation: "${field.attestationText ?? field.label}". If the transcript does not support it, return false.`;
      }
      if (field.type === "provider") {
        desc += " - MUST be chosen from the provided options only; never invent a provider";
      }
      return desc;
    }).join("\n");

    const contextLines = noteContext
      ? [
          noteContext.templateName ? `Note template: ${noteContext.templateName}` : null,
          noteContext.encounterType ? `Encounter type: ${noteContext.encounterType}` : null,
          noteContext.patientName ? `Patient: ${noteContext.patientName}` : null,
        ].filter(Boolean)
      : [];
    const contextBlock = contextLines.length > 0
      ? `\nENCOUNTER CONTEXT:\n${contextLines.map((l) => `- ${l}`).join("\n")}\n`
      : "";

    const prompt = `You are an expert medical scribe for patient navigation documentation, following the Gellert Note-Taking Manual.
Analyze the transcript and extract data for ALL the form fields below.
${contextBlock}
DOCUMENTATION STYLE (mandatory, from the manual):
- Write in third person as "Navigator" — never "I", "we", "me", "my", or "our".
- Every clock time uses H:MMAM/PM with a colon and no space (e.g. "10:05AM", never "10 am", "10:05 a.m.", or "15:00").
- Keep narrative content chronological.
- Include direct patient quotes for notable statements (e.g. Patient stated, "I feel much better.").
- Every textarea must state what the patient said or did — patient involvement must be documented.

CRITICAL RULES:
1. For 'select' and 'provider' fields, you MUST choose EXACTLY one of the provided options. Do not invent new options.
2. For 'textarea' fields, write a professional clinical narrative based on what was discussed, in the documentation style above.
3. Return ONLY valid JSON with field IDs as keys. No markdown, no explanations.
4. You MUST provide a value for EVERY field listed below - do not skip any.
5. For 'attestation' fields, return true ONLY when the transcript truthfully supports the attestation language; otherwise return false.
6. Map the context appropriately:
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
    let rawValue = parsedData[field.id];
    console.log(`🔍 Checking field "${field.id}":`, rawValue);
    if (rawValue === undefined || rawValue === null || rawValue === "") {
      console.log(`  ⚠️ Field empty or not in response`);
      missingFieldIds.push(field.id);
      continue;
    }

    // Normalize extracted clock times to the manual's canonical H:MMAM/PM
    if (field.type === "time") {
      rawValue = normalizeTimeValue(rawValue);
    }

    // For select/provider fields, validate the option exists
    if ((field.type === "select" || field.type === "provider") && field.options) {
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

// Type-aware mock resolution so every Gellert field type fills convincingly
function mockValueForField(field: TemplateFieldContext): unknown {
  if (field.type === "select" && field.options && field.options.length > 0) {
    const preferred = MOCK_SELECT_DATA[field.id] ?? MOCK_DATA[field.id];
    if (typeof preferred === "string" && field.options.includes(preferred)) return preferred;
    return field.options[0];
  }
  if (field.type === "provider") {
    return field.options?.[0];
  }
  if (field.type === "multi-select") {
    const preferred = MOCK_DATA[field.id];
    if (Array.isArray(preferred)) {
      const valid = field.options ? preferred.filter((v) => field.options!.includes(v as string)) : preferred;
      if (valid.length > 0) return valid;
    }
    return field.options && field.options.length > 0 ? [field.options[0]] : undefined;
  }
  if (field.type === "attestation") {
    return MOCK_DATA[field.id] ?? true;
  }
  if (field.type === "boolean") {
    return MOCK_DATA[field.id] ?? true;
  }
  if (field.type === "time") {
    return MOCK_DATA[field.id] ?? "10:05AM";
  }
  if (field.type === "time-duration") {
    return MOCK_DATA[field.id] ?? 45;
  }
  return MOCK_DATA[field.id];
}

function createMockResponse(templateFields: TemplateFieldContext[]): ScribeResult {
  console.log("📦 Creating mock response...");

  const data: Record<string, unknown> = {};
  const fieldConfidence: Record<string, "high" | "low"> = {};
  const missingFieldIds: string[] = [];
  let fieldsMatched = 0;

  for (const field of templateFields) {
    const mockValue = mockValueForField(field);
    if (mockValue !== undefined) {
      data[field.id] = mockValue;
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

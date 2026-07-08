import type { EncounterType } from "./types"

/**
 * Sample transcripts for demo/testing the AI Scribe feature.
 * Untagged samples show for every template; tagged samples are filtered to
 * their encounter type / template ids by the recorder's sampleFilter.
 */
export interface SampleTranscript {
  label: string
  encounterType?: EncounterType
  templateIds?: string[]
  transcript: string
}

export const SAMPLE_TRANSCRIPTS: SampleTranscript[] = [
  {
    label: "Transportation Barrier",
    transcript: `Navigator: Good morning Mrs. Johnson, how are you doing today?
Patient: Not great, honestly. I missed my cardiology appointment last week.
Navigator: I'm sorry to hear that. What happened?
Patient: My car broke down and I couldn't find a ride. It's been really frustrating.
Navigator: I understand. Transportation can be a real challenge. Let me help you with that. We have a program called Uber Health that can provide free rides to your medical appointments.
Patient: Really? That would be amazing.
Navigator: Yes, I'll set that up for you right now. How does that sound?
Patient: That sounds wonderful, thank you so much.
Navigator: Great. I'll arrange transportation vouchers for your next three appointments. Let's also reschedule that cardiology visit. We'll follow up next week to make sure everything is working well.
Patient: Thank you, I really appreciate your help.`,
  },
  {
    label: "Food Insecurity",
    transcript: `Navigator: Hi Mr. Martinez, this is your care navigator calling for our weekly check-in. How are things going?
Patient: Things are tough. My medications are making me nauseous and I haven't been eating much.
Navigator: I'm concerned about that. Are you having trouble getting food, or is it more that you don't have an appetite?
Patient: Both, actually. My wife passed away last month and I don't really cook. Plus money is tight with all the medical bills.
Navigator: I'm so sorry for your loss. Let me help you with the food situation. We can connect you with Meals on Wheels - they deliver hot meals right to your door.
Patient: I didn't know that was available.
Navigator: Absolutely. I'll also send you information about our hospital's food pantry. Would you be open to speaking with a social worker about your bills?
Patient: Yes, I think that would help.
Navigator: Perfect. I'll coordinate with social services and follow up with you tomorrow about the meal delivery setup.`,
  },
  {
    label: "Medication Education",
    transcript: `Navigator: Hello Mrs. Chen, I'm here for your home visit to discuss your new diabetes medications.
Patient: Thank you for coming. I'm very confused about all these new pills.
Navigator: That's completely understandable. Let's go through them one by one. Can you show me what you have?
Patient: Here's the bag from the pharmacy. I don't know which to take when.
Navigator: Okay, let me explain. The metformin - this white pill - you take twice a day with meals. It helps control your blood sugar.
Patient: With meals? I was taking it on an empty stomach.
Navigator: That could be why you've been having stomach upset. Always take it with food. And this other one, the lisinopril, is for your blood pressure. Take it once in the morning.
Patient: Oh, I see. Can you write this down for me?
Navigator: Of course. I'll make you a medication schedule. I'm also going to arrange for a pharmacist to call you next week for additional counseling.
Patient: That would be very helpful. Thank you for explaining everything.`,
  },
  {
    label: "PCP Visit with Transit",
    encounterType: "medical_appointment",
    templateIds: ["template-gellert-medical"],
    transcript: `Okay, documenting today's visit. I picked the patient up at her home at nine forty this morning and we drove straight to her primary care appointment. We arrived at the office at ten oh five - that's Desert Family Medicine, 4045 West Main Street, Phoenix, Arizona 85004. She was seen by her PCP, Dr. Jane Smith. Dr. Smith reviewed her blood pressure log, said the readings are trending better, and advised her to keep taking the lisinopril every morning and to cut back on salty snacks. She also wants labs repeated before the next visit. The patient was engaged the whole time - she asked Dr. Smith about the swelling in her ankles and told her, quote, I've been walking to the mailbox every day like you asked, end quote. She repeated the medication instructions back correctly. Before we left, the front desk scheduled her follow-up for March 4 at two thirty in the afternoon, same office, 4045 West Main Street. I drove her home afterward and stayed with her until eleven fifteen to make sure she got settled. That was about 50 minutes total for the encounter.`,
  },
  {
    label: "BH Visit with Med Change",
    encounterType: "behavioral_health",
    templateIds: ["template-gellert-bh"],
    transcript: `Behavioral health appointment today. No transport this time - the patient met me at the clinic. We arrived at the behavioral health office at one o five in the afternoon and she was seen by her psychiatrist, Dr. Robert Nguyen. I did the standard safety screening in the waiting room: she denied any thoughts of hurting herself, denied any thoughts of hurting anyone else, and denied hearing voices or seeing things that are not there. No safety concerns at all today. Dr. Nguyen talked through how she has been sleeping and decided to increase her sertraline from fifty milligrams to one hundred milligrams daily, and he explained the possible side effects to watch for in the first two weeks. The patient was very involved in the discussion - she asked whether the higher dose would make her drowsy and said, quote, I finally feel like someone is listening to me, end quote. She agreed to the medication change and confirmed her pharmacy is still the same. Follow-up with Dr. Nguyen is in four weeks. I was with the patient until two ten in the afternoon. Total time was about 65 minutes.`,
  },
  {
    label: "Medication Assistance - Pillbox",
    encounterType: "medication_assistance",
    templateIds: ["template-gellert-med-assist"],
    transcript: `Medication assistance visit at the patient's apartment. I arrived at three o'clock in the afternoon. We worked on her weekly pillbox together. To be clear for the record: the patient filled every compartment of the pillbox herself with her own hands - I gave verbal direction only, reading each label out loud with her, and I never touched the medications at any point. She sorted the metformin into the morning and evening slots and the atorvastatin into the evening slots, and she double-checked each compartment when she finished. She was actively involved the whole time and said, quote, this is so much easier when we do it together, end quote. She noticed she only had four days of metformin left, so while I was there she called her pharmacy, Walgreens on Camelback Road, and requested the refill herself - it will be ready Thursday. Plan is to repeat the pillbox routine at next week's visit. I was with the patient until three forty in the afternoon. Total was 40 minutes.`,
  },
]

/**
 * ICD-10 Code Dictionary
 *
 * Comprehensive list of commonly used ICD-10 diagnosis codes
 * organized by category for searchable lookup.
 */

export interface ICD10Code {
  code: string
  description: string
  category: string
  keywords?: string[]
}

export const ICD10_CODES: ICD10Code[] = [
  // ============================================
  // DIABETES (E08-E13) - ~35 codes
  // ============================================
  { code: "E08.9", description: "Diabetes mellitus due to underlying condition without complications", category: "Diabetes" },
  { code: "E09.9", description: "Drug or chemical induced diabetes mellitus without complications", category: "Diabetes" },
  { code: "E10.9", description: "Type 1 diabetes mellitus without complications", category: "Diabetes", keywords: ["juvenile", "insulin dependent", "IDDM"] },
  { code: "E10.10", description: "Type 1 diabetes mellitus with ketoacidosis without coma", category: "Diabetes", keywords: ["DKA"] },
  { code: "E10.21", description: "Type 1 diabetes mellitus with diabetic nephropathy", category: "Diabetes", keywords: ["kidney"] },
  { code: "E10.22", description: "Type 1 diabetes mellitus with diabetic chronic kidney disease", category: "Diabetes", keywords: ["CKD"] },
  { code: "E10.29", description: "Type 1 diabetes mellitus with other diabetic kidney complication", category: "Diabetes" },
  { code: "E10.311", description: "Type 1 diabetes mellitus with unspecified diabetic retinopathy with macular edema", category: "Diabetes", keywords: ["eye", "vision"] },
  { code: "E10.319", description: "Type 1 diabetes mellitus with unspecified diabetic retinopathy without macular edema", category: "Diabetes", keywords: ["eye"] },
  { code: "E10.40", description: "Type 1 diabetes mellitus with diabetic neuropathy, unspecified", category: "Diabetes", keywords: ["nerve", "numbness"] },
  { code: "E10.42", description: "Type 1 diabetes mellitus with diabetic polyneuropathy", category: "Diabetes", keywords: ["nerve"] },
  { code: "E10.65", description: "Type 1 diabetes mellitus with hyperglycemia", category: "Diabetes", keywords: ["high blood sugar"] },
  { code: "E11.00", description: "Type 2 diabetes mellitus with hyperosmolarity without NKHHC", category: "Diabetes" },
  { code: "E11.21", description: "Type 2 diabetes mellitus with diabetic nephropathy", category: "Diabetes", keywords: ["kidney"] },
  { code: "E11.22", description: "Type 2 diabetes mellitus with diabetic chronic kidney disease", category: "Diabetes", keywords: ["CKD"] },
  { code: "E11.29", description: "Type 2 diabetes mellitus with other diabetic kidney complication", category: "Diabetes" },
  { code: "E11.311", description: "Type 2 diabetes mellitus with unspecified diabetic retinopathy with macular edema", category: "Diabetes", keywords: ["eye", "vision"] },
  { code: "E11.319", description: "Type 2 diabetes mellitus with unspecified diabetic retinopathy without macular edema", category: "Diabetes", keywords: ["eye"] },
  { code: "E11.321", description: "Type 2 diabetes mellitus with mild nonproliferative diabetic retinopathy with macular edema", category: "Diabetes" },
  { code: "E11.329", description: "Type 2 diabetes mellitus with mild nonproliferative diabetic retinopathy without macular edema", category: "Diabetes" },
  { code: "E11.40", description: "Type 2 diabetes mellitus with diabetic neuropathy, unspecified", category: "Diabetes", keywords: ["nerve", "numbness", "tingling"] },
  { code: "E11.42", description: "Type 2 diabetes mellitus with diabetic polyneuropathy", category: "Diabetes", keywords: ["nerve"] },
  { code: "E11.43", description: "Type 2 diabetes mellitus with diabetic autonomic (poly)neuropathy", category: "Diabetes" },
  { code: "E11.51", description: "Type 2 diabetes mellitus with diabetic peripheral angiopathy without gangrene", category: "Diabetes", keywords: ["circulation", "PAD"] },
  { code: "E11.52", description: "Type 2 diabetes mellitus with diabetic peripheral angiopathy with gangrene", category: "Diabetes" },
  { code: "E11.59", description: "Type 2 diabetes mellitus with other circulatory complications", category: "Diabetes" },
  { code: "E11.610", description: "Type 2 diabetes mellitus with diabetic neuropathic arthropathy", category: "Diabetes", keywords: ["Charcot"] },
  { code: "E11.618", description: "Type 2 diabetes mellitus with other diabetic arthropathy", category: "Diabetes" },
  { code: "E11.620", description: "Type 2 diabetes mellitus with diabetic dermatitis", category: "Diabetes", keywords: ["skin"] },
  { code: "E11.621", description: "Type 2 diabetes mellitus with foot ulcer", category: "Diabetes", keywords: ["wound"] },
  { code: "E11.622", description: "Type 2 diabetes mellitus with other skin ulcer", category: "Diabetes", keywords: ["wound"] },
  { code: "E11.65", description: "Type 2 diabetes mellitus with hyperglycemia", category: "Diabetes", keywords: ["high blood sugar", "uncontrolled"] },
  { code: "E11.69", description: "Type 2 diabetes mellitus with other specified complication", category: "Diabetes" },
  { code: "E11.8", description: "Type 2 diabetes mellitus with unspecified complications", category: "Diabetes" },
  { code: "E11.9", description: "Type 2 diabetes mellitus without complications", category: "Diabetes", keywords: ["adult onset", "NIDDM"] },
  { code: "E13.9", description: "Other specified diabetes mellitus without complications", category: "Diabetes" },

  // ============================================
  // HYPERTENSION (I10-I16) - ~20 codes
  // ============================================
  { code: "I10", description: "Essential (primary) hypertension", category: "Hypertension", keywords: ["high blood pressure", "HTN"] },
  { code: "I11.0", description: "Hypertensive heart disease with heart failure", category: "Hypertension", keywords: ["HHD", "CHF"] },
  { code: "I11.9", description: "Hypertensive heart disease without heart failure", category: "Hypertension", keywords: ["HHD"] },
  { code: "I12.0", description: "Hypertensive chronic kidney disease with stage 5 CKD or ESRD", category: "Hypertension", keywords: ["renal", "kidney"] },
  { code: "I12.9", description: "Hypertensive chronic kidney disease with stage 1-4 CKD", category: "Hypertension", keywords: ["renal", "kidney"] },
  { code: "I13.0", description: "Hypertensive heart and chronic kidney disease with heart failure and stage 1-4 CKD", category: "Hypertension" },
  { code: "I13.10", description: "Hypertensive heart and chronic kidney disease without heart failure, with stage 1-4 CKD", category: "Hypertension" },
  { code: "I13.11", description: "Hypertensive heart and chronic kidney disease without heart failure, with stage 5 CKD or ESRD", category: "Hypertension" },
  { code: "I13.2", description: "Hypertensive heart and chronic kidney disease with heart failure and stage 5 CKD or ESRD", category: "Hypertension" },
  { code: "I15.0", description: "Renovascular hypertension", category: "Hypertension", keywords: ["secondary", "renal artery"] },
  { code: "I15.1", description: "Hypertension secondary to other renal disorders", category: "Hypertension" },
  { code: "I15.2", description: "Hypertension secondary to endocrine disorders", category: "Hypertension" },
  { code: "I15.8", description: "Other secondary hypertension", category: "Hypertension" },
  { code: "I15.9", description: "Secondary hypertension, unspecified", category: "Hypertension" },
  { code: "I16.0", description: "Hypertensive urgency", category: "Hypertension", keywords: ["crisis"] },
  { code: "I16.1", description: "Hypertensive emergency", category: "Hypertension", keywords: ["crisis", "malignant"] },
  { code: "I16.9", description: "Hypertensive crisis, unspecified", category: "Hypertension" },

  // ============================================
  // HEART DISEASE (I20-I52) - ~55 codes
  // ============================================
  { code: "I20.0", description: "Unstable angina", category: "Heart Disease", keywords: ["chest pain", "ACS"] },
  { code: "I20.1", description: "Angina pectoris with documented spasm", category: "Heart Disease", keywords: ["Prinzmetal", "variant"] },
  { code: "I20.8", description: "Other forms of angina pectoris", category: "Heart Disease" },
  { code: "I20.9", description: "Angina pectoris, unspecified", category: "Heart Disease", keywords: ["chest pain"] },
  { code: "I21.01", description: "ST elevation myocardial infarction involving left main coronary artery", category: "Heart Disease", keywords: ["STEMI", "heart attack"] },
  { code: "I21.02", description: "ST elevation myocardial infarction involving left anterior descending coronary artery", category: "Heart Disease", keywords: ["STEMI", "LAD"] },
  { code: "I21.09", description: "ST elevation myocardial infarction involving other coronary artery of anterior wall", category: "Heart Disease" },
  { code: "I21.11", description: "ST elevation myocardial infarction involving right coronary artery", category: "Heart Disease", keywords: ["STEMI", "RCA"] },
  { code: "I21.19", description: "ST elevation myocardial infarction involving other coronary artery of inferior wall", category: "Heart Disease" },
  { code: "I21.21", description: "ST elevation myocardial infarction involving left circumflex coronary artery", category: "Heart Disease", keywords: ["STEMI"] },
  { code: "I21.29", description: "ST elevation myocardial infarction involving other sites", category: "Heart Disease" },
  { code: "I21.3", description: "ST elevation myocardial infarction of unspecified site", category: "Heart Disease", keywords: ["STEMI"] },
  { code: "I21.4", description: "Non-ST elevation myocardial infarction", category: "Heart Disease", keywords: ["NSTEMI", "heart attack"] },
  { code: "I21.9", description: "Acute myocardial infarction, unspecified", category: "Heart Disease", keywords: ["MI", "heart attack"] },
  { code: "I21.A1", description: "Myocardial infarction type 2", category: "Heart Disease", keywords: ["demand ischemia"] },
  { code: "I21.A9", description: "Other myocardial infarction type", category: "Heart Disease" },
  { code: "I22.0", description: "Subsequent ST elevation myocardial infarction of anterior wall", category: "Heart Disease" },
  { code: "I22.1", description: "Subsequent ST elevation myocardial infarction of inferior wall", category: "Heart Disease" },
  { code: "I22.2", description: "Subsequent non-ST elevation myocardial infarction", category: "Heart Disease" },
  { code: "I25.10", description: "Atherosclerotic heart disease of native coronary artery without angina pectoris", category: "Heart Disease", keywords: ["CAD", "coronary artery disease"] },
  { code: "I25.110", description: "Atherosclerotic heart disease of native coronary artery with unstable angina pectoris", category: "Heart Disease", keywords: ["CAD"] },
  { code: "I25.111", description: "Atherosclerotic heart disease of native coronary artery with angina pectoris with documented spasm", category: "Heart Disease" },
  { code: "I25.118", description: "Atherosclerotic heart disease of native coronary artery with other forms of angina pectoris", category: "Heart Disease" },
  { code: "I25.119", description: "Atherosclerotic heart disease of native coronary artery with unspecified angina pectoris", category: "Heart Disease", keywords: ["CAD"] },
  { code: "I25.2", description: "Old myocardial infarction", category: "Heart Disease", keywords: ["prior MI", "history of heart attack"] },
  { code: "I25.5", description: "Ischemic cardiomyopathy", category: "Heart Disease" },
  { code: "I25.700", description: "Atherosclerosis of coronary artery bypass graft(s), unspecified, with unstable angina pectoris", category: "Heart Disease", keywords: ["CABG"] },
  { code: "I25.710", description: "Atherosclerosis of autologous vein coronary artery bypass graft(s) with unstable angina pectoris", category: "Heart Disease" },
  { code: "I25.810", description: "Atherosclerosis of coronary artery bypass graft(s) without angina pectoris", category: "Heart Disease" },
  { code: "I25.82", description: "Chronic total occlusion of coronary artery", category: "Heart Disease", keywords: ["CTO"] },
  { code: "I25.83", description: "Coronary atherosclerosis due to lipid rich plaque", category: "Heart Disease" },
  { code: "I25.84", description: "Coronary atherosclerosis due to calcified coronite", category: "Heart Disease" },
  { code: "I25.89", description: "Other forms of chronic ischemic heart disease", category: "Heart Disease" },
  { code: "I25.9", description: "Chronic ischemic heart disease, unspecified", category: "Heart Disease", keywords: ["CAD", "IHD"] },
  { code: "I42.0", description: "Dilated cardiomyopathy", category: "Heart Disease", keywords: ["DCM"] },
  { code: "I42.1", description: "Obstructive hypertrophic cardiomyopathy", category: "Heart Disease", keywords: ["HOCM"] },
  { code: "I42.2", description: "Other hypertrophic cardiomyopathy", category: "Heart Disease", keywords: ["HCM"] },
  { code: "I42.9", description: "Cardiomyopathy, unspecified", category: "Heart Disease" },
  { code: "I48.0", description: "Paroxysmal atrial fibrillation", category: "Heart Disease", keywords: ["AFib", "PAF"] },
  { code: "I48.1", description: "Persistent atrial fibrillation", category: "Heart Disease", keywords: ["AFib"] },
  { code: "I48.11", description: "Longstanding persistent atrial fibrillation", category: "Heart Disease", keywords: ["AFib"] },
  { code: "I48.19", description: "Other persistent atrial fibrillation", category: "Heart Disease" },
  { code: "I48.20", description: "Chronic atrial fibrillation, unspecified", category: "Heart Disease", keywords: ["AFib", "permanent"] },
  { code: "I48.21", description: "Permanent atrial fibrillation", category: "Heart Disease", keywords: ["AFib"] },
  { code: "I48.91", description: "Unspecified atrial fibrillation", category: "Heart Disease", keywords: ["AFib", "irregular heartbeat"] },
  { code: "I48.92", description: "Unspecified atrial flutter", category: "Heart Disease", keywords: ["AFlutter"] },
  { code: "I50.1", description: "Left ventricular failure, unspecified", category: "Heart Disease", keywords: ["LVF"] },
  { code: "I50.20", description: "Unspecified systolic (congestive) heart failure", category: "Heart Disease", keywords: ["CHF", "HFrEF"] },
  { code: "I50.21", description: "Acute systolic (congestive) heart failure", category: "Heart Disease", keywords: ["CHF"] },
  { code: "I50.22", description: "Chronic systolic (congestive) heart failure", category: "Heart Disease", keywords: ["CHF", "HFrEF"] },
  { code: "I50.23", description: "Acute on chronic systolic (congestive) heart failure", category: "Heart Disease", keywords: ["CHF"] },
  { code: "I50.30", description: "Unspecified diastolic (congestive) heart failure", category: "Heart Disease", keywords: ["CHF", "HFpEF"] },
  { code: "I50.32", description: "Chronic diastolic (congestive) heart failure", category: "Heart Disease", keywords: ["CHF", "HFpEF"] },
  { code: "I50.33", description: "Acute on chronic diastolic (congestive) heart failure", category: "Heart Disease" },
  { code: "I50.40", description: "Unspecified combined systolic and diastolic heart failure", category: "Heart Disease" },
  { code: "I50.42", description: "Chronic combined systolic and diastolic heart failure", category: "Heart Disease" },
  { code: "I50.9", description: "Heart failure, unspecified", category: "Heart Disease", keywords: ["CHF", "congestive heart failure"] },

  // ============================================
  // COPD & RESPIRATORY (J40-J47, J96) - ~30 codes
  // ============================================
  { code: "J40", description: "Bronchitis, not specified as acute or chronic", category: "Respiratory", keywords: ["cough"] },
  { code: "J41.0", description: "Simple chronic bronchitis", category: "Respiratory" },
  { code: "J41.1", description: "Mucopurulent chronic bronchitis", category: "Respiratory" },
  { code: "J41.8", description: "Mixed simple and mucopurulent chronic bronchitis", category: "Respiratory" },
  { code: "J42", description: "Unspecified chronic bronchitis", category: "Respiratory" },
  { code: "J43.0", description: "Unilateral pulmonary emphysema", category: "Respiratory" },
  { code: "J43.1", description: "Panlobular emphysema", category: "Respiratory" },
  { code: "J43.2", description: "Centrilobular emphysema", category: "Respiratory" },
  { code: "J43.8", description: "Other emphysema", category: "Respiratory" },
  { code: "J43.9", description: "Emphysema, unspecified", category: "Respiratory" },
  { code: "J44.0", description: "Chronic obstructive pulmonary disease with acute lower respiratory infection", category: "Respiratory", keywords: ["COPD exacerbation"] },
  { code: "J44.1", description: "Chronic obstructive pulmonary disease with acute exacerbation", category: "Respiratory", keywords: ["COPD flare"] },
  { code: "J44.9", description: "Chronic obstructive pulmonary disease, unspecified", category: "Respiratory", keywords: ["COPD"] },
  { code: "J45.20", description: "Mild intermittent asthma, uncomplicated", category: "Respiratory" },
  { code: "J45.21", description: "Mild intermittent asthma with acute exacerbation", category: "Respiratory" },
  { code: "J45.22", description: "Mild intermittent asthma with status asthmaticus", category: "Respiratory" },
  { code: "J45.30", description: "Mild persistent asthma, uncomplicated", category: "Respiratory" },
  { code: "J45.31", description: "Mild persistent asthma with acute exacerbation", category: "Respiratory" },
  { code: "J45.40", description: "Moderate persistent asthma, uncomplicated", category: "Respiratory" },
  { code: "J45.41", description: "Moderate persistent asthma with acute exacerbation", category: "Respiratory" },
  { code: "J45.50", description: "Severe persistent asthma, uncomplicated", category: "Respiratory" },
  { code: "J45.51", description: "Severe persistent asthma with acute exacerbation", category: "Respiratory" },
  { code: "J45.52", description: "Severe persistent asthma with status asthmaticus", category: "Respiratory" },
  { code: "J45.901", description: "Unspecified asthma with acute exacerbation", category: "Respiratory", keywords: ["asthma attack"] },
  { code: "J45.902", description: "Unspecified asthma with status asthmaticus", category: "Respiratory" },
  { code: "J45.909", description: "Unspecified asthma, uncomplicated", category: "Respiratory", keywords: ["asthma"] },
  { code: "J47.0", description: "Bronchiectasis with acute lower respiratory infection", category: "Respiratory" },
  { code: "J47.1", description: "Bronchiectasis with acute exacerbation", category: "Respiratory" },
  { code: "J47.9", description: "Bronchiectasis, uncomplicated", category: "Respiratory" },
  { code: "J96.00", description: "Acute respiratory failure, unspecified whether with hypoxia or hypercapnia", category: "Respiratory" },
  { code: "J96.01", description: "Acute respiratory failure with hypoxia", category: "Respiratory", keywords: ["low oxygen"] },
  { code: "J96.02", description: "Acute respiratory failure with hypercapnia", category: "Respiratory", keywords: ["high CO2"] },
  { code: "J96.10", description: "Chronic respiratory failure, unspecified", category: "Respiratory" },
  { code: "J96.11", description: "Chronic respiratory failure with hypoxia", category: "Respiratory" },
  { code: "J96.12", description: "Chronic respiratory failure with hypercapnia", category: "Respiratory" },

  // ============================================
  // CANCER (C00-D49) - ~100 codes
  // ============================================
  // Head and Neck
  { code: "C01", description: "Malignant neoplasm of base of tongue", category: "Cancer", keywords: ["tongue cancer"] },
  { code: "C02.9", description: "Malignant neoplasm of tongue, unspecified", category: "Cancer" },
  { code: "C04.9", description: "Malignant neoplasm of floor of mouth, unspecified", category: "Cancer", keywords: ["oral cancer"] },
  { code: "C06.9", description: "Malignant neoplasm of mouth, unspecified", category: "Cancer", keywords: ["oral cancer"] },
  { code: "C09.9", description: "Malignant neoplasm of tonsil, unspecified", category: "Cancer" },
  { code: "C10.9", description: "Malignant neoplasm of oropharynx, unspecified", category: "Cancer", keywords: ["throat cancer"] },
  { code: "C11.9", description: "Malignant neoplasm of nasopharynx, unspecified", category: "Cancer" },
  { code: "C13.9", description: "Malignant neoplasm of hypopharynx, unspecified", category: "Cancer" },
  { code: "C14.0", description: "Malignant neoplasm of pharynx, unspecified", category: "Cancer" },

  // Digestive
  { code: "C15.9", description: "Malignant neoplasm of esophagus, unspecified", category: "Cancer", keywords: ["esophageal cancer"] },
  { code: "C16.0", description: "Malignant neoplasm of cardia", category: "Cancer", keywords: ["stomach cancer", "gastric"] },
  { code: "C16.9", description: "Malignant neoplasm of stomach, unspecified", category: "Cancer", keywords: ["stomach cancer", "gastric"] },
  { code: "C17.9", description: "Malignant neoplasm of small intestine, unspecified", category: "Cancer" },
  { code: "C18.0", description: "Malignant neoplasm of cecum", category: "Cancer", keywords: ["colon cancer"] },
  { code: "C18.2", description: "Malignant neoplasm of ascending colon", category: "Cancer", keywords: ["colon cancer"] },
  { code: "C18.4", description: "Malignant neoplasm of transverse colon", category: "Cancer", keywords: ["colon cancer"] },
  { code: "C18.6", description: "Malignant neoplasm of descending colon", category: "Cancer", keywords: ["colon cancer"] },
  { code: "C18.7", description: "Malignant neoplasm of sigmoid colon", category: "Cancer", keywords: ["colon cancer"] },
  { code: "C18.9", description: "Malignant neoplasm of colon, unspecified", category: "Cancer", keywords: ["colon cancer", "colorectal"] },
  { code: "C19", description: "Malignant neoplasm of rectosigmoid junction", category: "Cancer", keywords: ["colorectal cancer"] },
  { code: "C20", description: "Malignant neoplasm of rectum", category: "Cancer", keywords: ["rectal cancer", "colorectal"] },
  { code: "C22.0", description: "Liver cell carcinoma", category: "Cancer", keywords: ["hepatocellular carcinoma", "HCC"] },
  { code: "C22.1", description: "Intrahepatic bile duct carcinoma", category: "Cancer", keywords: ["cholangiocarcinoma"] },
  { code: "C22.9", description: "Malignant neoplasm of liver, not specified as primary or secondary", category: "Cancer", keywords: ["liver cancer"] },
  { code: "C23", description: "Malignant neoplasm of gallbladder", category: "Cancer" },
  { code: "C24.0", description: "Malignant neoplasm of extrahepatic bile duct", category: "Cancer", keywords: ["cholangiocarcinoma"] },
  { code: "C24.1", description: "Malignant neoplasm of ampulla of Vater", category: "Cancer" },
  { code: "C25.0", description: "Malignant neoplasm of head of pancreas", category: "Cancer", keywords: ["pancreatic cancer"] },
  { code: "C25.1", description: "Malignant neoplasm of body of pancreas", category: "Cancer" },
  { code: "C25.2", description: "Malignant neoplasm of tail of pancreas", category: "Cancer" },
  { code: "C25.9", description: "Malignant neoplasm of pancreas, unspecified", category: "Cancer", keywords: ["pancreatic cancer"] },

  // Respiratory
  { code: "C32.9", description: "Malignant neoplasm of larynx, unspecified", category: "Cancer", keywords: ["laryngeal cancer", "voice box"] },
  { code: "C34.10", description: "Malignant neoplasm of upper lobe, unspecified bronchus or lung", category: "Cancer", keywords: ["lung cancer"] },
  { code: "C34.11", description: "Malignant neoplasm of upper lobe, right bronchus or lung", category: "Cancer" },
  { code: "C34.12", description: "Malignant neoplasm of upper lobe, left bronchus or lung", category: "Cancer" },
  { code: "C34.30", description: "Malignant neoplasm of lower lobe, unspecified bronchus or lung", category: "Cancer" },
  { code: "C34.31", description: "Malignant neoplasm of lower lobe, right bronchus or lung", category: "Cancer" },
  { code: "C34.32", description: "Malignant neoplasm of lower lobe, left bronchus or lung", category: "Cancer" },
  { code: "C34.90", description: "Malignant neoplasm of unspecified part of unspecified bronchus or lung", category: "Cancer", keywords: ["lung cancer"] },
  { code: "C34.91", description: "Malignant neoplasm of unspecified part of right bronchus or lung", category: "Cancer" },
  { code: "C34.92", description: "Malignant neoplasm of unspecified part of left bronchus or lung", category: "Cancer" },
  { code: "C45.0", description: "Mesothelioma of pleura", category: "Cancer", keywords: ["asbestos"] },

  // Bone and Soft Tissue
  { code: "C40.00", description: "Malignant neoplasm of scapula and long bones of unspecified upper limb", category: "Cancer", keywords: ["bone cancer"] },
  { code: "C40.20", description: "Malignant neoplasm of long bones of unspecified lower limb", category: "Cancer" },
  { code: "C41.9", description: "Malignant neoplasm of bone and articular cartilage, unspecified", category: "Cancer", keywords: ["bone cancer"] },
  { code: "C49.9", description: "Malignant neoplasm of connective and soft tissue, unspecified", category: "Cancer", keywords: ["sarcoma"] },

  // Skin
  { code: "C43.0", description: "Malignant melanoma of lip", category: "Cancer", keywords: ["melanoma", "skin cancer"] },
  { code: "C43.30", description: "Malignant melanoma of unspecified part of face", category: "Cancer", keywords: ["melanoma"] },
  { code: "C43.4", description: "Malignant melanoma of scalp and neck", category: "Cancer", keywords: ["melanoma"] },
  { code: "C43.59", description: "Malignant melanoma of other part of trunk", category: "Cancer", keywords: ["melanoma"] },
  { code: "C43.60", description: "Malignant melanoma of unspecified upper limb, including shoulder", category: "Cancer", keywords: ["melanoma"] },
  { code: "C43.70", description: "Malignant melanoma of unspecified lower limb, including hip", category: "Cancer", keywords: ["melanoma"] },
  { code: "C43.9", description: "Malignant melanoma of skin, unspecified", category: "Cancer", keywords: ["melanoma", "skin cancer"] },
  { code: "C44.90", description: "Unspecified malignant neoplasm of skin, unspecified", category: "Cancer", keywords: ["skin cancer"] },

  // Breast
  { code: "C50.011", description: "Malignant neoplasm of nipple and areola, right female breast", category: "Cancer", keywords: ["breast cancer"] },
  { code: "C50.012", description: "Malignant neoplasm of nipple and areola, left female breast", category: "Cancer" },
  { code: "C50.111", description: "Malignant neoplasm of central portion of right female breast", category: "Cancer" },
  { code: "C50.112", description: "Malignant neoplasm of central portion of left female breast", category: "Cancer" },
  { code: "C50.211", description: "Malignant neoplasm of upper-inner quadrant of right female breast", category: "Cancer" },
  { code: "C50.212", description: "Malignant neoplasm of upper-inner quadrant of left female breast", category: "Cancer" },
  { code: "C50.311", description: "Malignant neoplasm of lower-inner quadrant of right female breast", category: "Cancer" },
  { code: "C50.411", description: "Malignant neoplasm of upper-outer quadrant of right female breast", category: "Cancer" },
  { code: "C50.412", description: "Malignant neoplasm of upper-outer quadrant of left female breast", category: "Cancer" },
  { code: "C50.511", description: "Malignant neoplasm of lower-outer quadrant of right female breast", category: "Cancer" },
  { code: "C50.911", description: "Malignant neoplasm of unspecified site of right female breast", category: "Cancer", keywords: ["breast cancer"] },
  { code: "C50.912", description: "Malignant neoplasm of unspecified site of left female breast", category: "Cancer", keywords: ["breast cancer"] },
  { code: "C50.919", description: "Malignant neoplasm of unspecified site of unspecified female breast", category: "Cancer", keywords: ["breast cancer"] },
  { code: "C50.921", description: "Malignant neoplasm of unspecified site of right male breast", category: "Cancer" },
  { code: "C50.922", description: "Malignant neoplasm of unspecified site of left male breast", category: "Cancer" },

  // Female Reproductive
  { code: "C53.9", description: "Malignant neoplasm of cervix uteri, unspecified", category: "Cancer", keywords: ["cervical cancer"] },
  { code: "C54.1", description: "Malignant neoplasm of endometrium", category: "Cancer", keywords: ["endometrial cancer", "uterine cancer"] },
  { code: "C54.9", description: "Malignant neoplasm of corpus uteri, unspecified", category: "Cancer", keywords: ["uterine cancer"] },
  { code: "C56.1", description: "Malignant neoplasm of right ovary", category: "Cancer", keywords: ["ovarian cancer"] },
  { code: "C56.2", description: "Malignant neoplasm of left ovary", category: "Cancer" },
  { code: "C56.9", description: "Malignant neoplasm of unspecified ovary", category: "Cancer", keywords: ["ovarian cancer"] },

  // Male Reproductive
  { code: "C61", description: "Malignant neoplasm of prostate", category: "Cancer", keywords: ["prostate cancer"] },
  { code: "C62.10", description: "Malignant neoplasm of undescended testis, unspecified", category: "Cancer", keywords: ["testicular cancer"] },
  { code: "C62.90", description: "Malignant neoplasm of unspecified testis, unspecified", category: "Cancer", keywords: ["testicular cancer"] },

  // Urinary
  { code: "C64.1", description: "Malignant neoplasm of right kidney, except renal pelvis", category: "Cancer", keywords: ["kidney cancer", "renal cell carcinoma"] },
  { code: "C64.2", description: "Malignant neoplasm of left kidney, except renal pelvis", category: "Cancer" },
  { code: "C64.9", description: "Malignant neoplasm of unspecified kidney, except renal pelvis", category: "Cancer", keywords: ["kidney cancer"] },
  { code: "C67.0", description: "Malignant neoplasm of trigone of bladder", category: "Cancer", keywords: ["bladder cancer"] },
  { code: "C67.9", description: "Malignant neoplasm of bladder, unspecified", category: "Cancer", keywords: ["bladder cancer"] },

  // Brain and CNS
  { code: "C71.0", description: "Malignant neoplasm of cerebrum, except lobes and ventricles", category: "Cancer", keywords: ["brain cancer", "brain tumor"] },
  { code: "C71.1", description: "Malignant neoplasm of frontal lobe", category: "Cancer", keywords: ["brain cancer"] },
  { code: "C71.2", description: "Malignant neoplasm of temporal lobe", category: "Cancer" },
  { code: "C71.3", description: "Malignant neoplasm of parietal lobe", category: "Cancer" },
  { code: "C71.4", description: "Malignant neoplasm of occipital lobe", category: "Cancer" },
  { code: "C71.9", description: "Malignant neoplasm of brain, unspecified", category: "Cancer", keywords: ["brain cancer", "brain tumor"] },

  // Thyroid
  { code: "C73", description: "Malignant neoplasm of thyroid gland", category: "Cancer", keywords: ["thyroid cancer"] },

  // Lymphoma and Leukemia
  { code: "C81.90", description: "Hodgkin lymphoma, unspecified, unspecified site", category: "Cancer", keywords: ["Hodgkin's disease"] },
  { code: "C82.90", description: "Follicular lymphoma, unspecified, unspecified site", category: "Cancer" },
  { code: "C83.30", description: "Diffuse large B-cell lymphoma, unspecified site", category: "Cancer", keywords: ["DLBCL"] },
  { code: "C85.90", description: "Non-Hodgkin lymphoma, unspecified, unspecified site", category: "Cancer", keywords: ["NHL"] },
  { code: "C90.00", description: "Multiple myeloma not having achieved remission", category: "Cancer", keywords: ["myeloma", "plasma cell"] },
  { code: "C90.01", description: "Multiple myeloma in remission", category: "Cancer" },
  { code: "C91.00", description: "Acute lymphoblastic leukemia not having achieved remission", category: "Cancer", keywords: ["ALL"] },
  { code: "C91.10", description: "Chronic lymphocytic leukemia of B-cell type not having achieved remission", category: "Cancer", keywords: ["CLL"] },
  { code: "C92.00", description: "Acute myeloblastic leukemia, not having achieved remission", category: "Cancer", keywords: ["AML"] },
  { code: "C92.10", description: "Chronic myeloid leukemia, BCR/ABL-positive, not having achieved remission", category: "Cancer", keywords: ["CML"] },

  // Metastatic
  { code: "C77.9", description: "Secondary and unspecified malignant neoplasm of lymph node, unspecified", category: "Cancer", keywords: ["metastatic", "lymph node mets"] },
  { code: "C78.00", description: "Secondary malignant neoplasm of unspecified lung", category: "Cancer", keywords: ["lung mets", "metastatic"] },
  { code: "C78.7", description: "Secondary malignant neoplasm of liver and intrahepatic bile duct", category: "Cancer", keywords: ["liver mets", "metastatic"] },
  { code: "C79.31", description: "Secondary malignant neoplasm of brain", category: "Cancer", keywords: ["brain mets", "metastatic"] },
  { code: "C79.51", description: "Secondary malignant neoplasm of bone", category: "Cancer", keywords: ["bone mets", "metastatic"] },
  { code: "C80.0", description: "Disseminated malignant neoplasm, unspecified", category: "Cancer", keywords: ["metastatic cancer", "widespread"] },
  { code: "C80.1", description: "Malignant (primary) neoplasm, unspecified", category: "Cancer", keywords: ["cancer NOS", "unknown primary"] },

  // ============================================
  // MENTAL HEALTH (F01-F99) - ~80 codes
  // ============================================
  // Dementia
  { code: "F01.50", description: "Vascular dementia without behavioral disturbance", category: "Mental Health", keywords: ["multi-infarct dementia"] },
  { code: "F01.51", description: "Vascular dementia with behavioral disturbance", category: "Mental Health" },
  { code: "F02.80", description: "Dementia in other diseases classified elsewhere without behavioral disturbance", category: "Mental Health" },
  { code: "F02.81", description: "Dementia in other diseases classified elsewhere with behavioral disturbance", category: "Mental Health" },
  { code: "F03.90", description: "Unspecified dementia without behavioral disturbance", category: "Mental Health", keywords: ["dementia NOS"] },
  { code: "F03.91", description: "Unspecified dementia with behavioral disturbance", category: "Mental Health" },

  // Substance Use
  { code: "F10.10", description: "Alcohol abuse, uncomplicated", category: "Mental Health", keywords: ["alcoholism", "drinking"] },
  { code: "F10.20", description: "Alcohol dependence, uncomplicated", category: "Mental Health", keywords: ["alcoholism"] },
  { code: "F10.21", description: "Alcohol dependence, in remission", category: "Mental Health" },
  { code: "F10.239", description: "Alcohol dependence with withdrawal, unspecified", category: "Mental Health" },
  { code: "F11.10", description: "Opioid abuse, uncomplicated", category: "Mental Health", keywords: ["opioid use disorder"] },
  { code: "F11.20", description: "Opioid dependence, uncomplicated", category: "Mental Health", keywords: ["opioid use disorder", "OUD"] },
  { code: "F11.21", description: "Opioid dependence, in remission", category: "Mental Health" },
  { code: "F12.10", description: "Cannabis abuse, uncomplicated", category: "Mental Health", keywords: ["marijuana"] },
  { code: "F12.20", description: "Cannabis dependence, uncomplicated", category: "Mental Health" },
  { code: "F13.10", description: "Sedative, hypnotic or anxiolytic abuse, uncomplicated", category: "Mental Health", keywords: ["benzodiazepine"] },
  { code: "F13.20", description: "Sedative, hypnotic or anxiolytic dependence, uncomplicated", category: "Mental Health" },
  { code: "F14.10", description: "Cocaine abuse, uncomplicated", category: "Mental Health" },
  { code: "F14.20", description: "Cocaine dependence, uncomplicated", category: "Mental Health" },
  { code: "F15.10", description: "Other stimulant abuse, uncomplicated", category: "Mental Health", keywords: ["methamphetamine", "amphetamine"] },
  { code: "F15.20", description: "Other stimulant dependence, uncomplicated", category: "Mental Health" },
  { code: "F17.210", description: "Nicotine dependence, cigarettes, uncomplicated", category: "Mental Health", keywords: ["smoking", "tobacco"] },
  { code: "F17.211", description: "Nicotine dependence, cigarettes, in remission", category: "Mental Health" },
  { code: "F19.10", description: "Other psychoactive substance abuse, uncomplicated", category: "Mental Health", keywords: ["polysubstance"] },
  { code: "F19.20", description: "Other psychoactive substance dependence, uncomplicated", category: "Mental Health" },

  // Psychotic Disorders
  { code: "F20.0", description: "Paranoid schizophrenia", category: "Mental Health" },
  { code: "F20.1", description: "Disorganized schizophrenia", category: "Mental Health", keywords: ["hebephrenic"] },
  { code: "F20.2", description: "Catatonic schizophrenia", category: "Mental Health" },
  { code: "F20.3", description: "Undifferentiated schizophrenia", category: "Mental Health" },
  { code: "F20.5", description: "Residual schizophrenia", category: "Mental Health" },
  { code: "F20.81", description: "Schizophreniform disorder", category: "Mental Health" },
  { code: "F20.89", description: "Other schizophrenia", category: "Mental Health" },
  { code: "F20.9", description: "Schizophrenia, unspecified", category: "Mental Health" },
  { code: "F22", description: "Delusional disorders", category: "Mental Health", keywords: ["paranoia"] },
  { code: "F23", description: "Brief psychotic disorder", category: "Mental Health" },
  { code: "F25.0", description: "Schizoaffective disorder, bipolar type", category: "Mental Health" },
  { code: "F25.1", description: "Schizoaffective disorder, depressive type", category: "Mental Health" },
  { code: "F25.9", description: "Schizoaffective disorder, unspecified", category: "Mental Health" },

  // Mood Disorders
  { code: "F31.0", description: "Bipolar disorder, current episode hypomanic", category: "Mental Health" },
  { code: "F31.10", description: "Bipolar disorder, current episode manic without psychotic features, unspecified", category: "Mental Health" },
  { code: "F31.11", description: "Bipolar disorder, current episode manic without psychotic features, mild", category: "Mental Health" },
  { code: "F31.12", description: "Bipolar disorder, current episode manic without psychotic features, moderate", category: "Mental Health" },
  { code: "F31.13", description: "Bipolar disorder, current episode manic without psychotic features, severe", category: "Mental Health" },
  { code: "F31.2", description: "Bipolar disorder, current episode manic severe with psychotic features", category: "Mental Health" },
  { code: "F31.30", description: "Bipolar disorder, current episode depressed, mild or moderate severity, unspecified", category: "Mental Health" },
  { code: "F31.31", description: "Bipolar disorder, current episode depressed, mild", category: "Mental Health" },
  { code: "F31.32", description: "Bipolar disorder, current episode depressed, moderate", category: "Mental Health" },
  { code: "F31.4", description: "Bipolar disorder, current episode depressed, severe, without psychotic features", category: "Mental Health" },
  { code: "F31.5", description: "Bipolar disorder, current episode depressed, severe, with psychotic features", category: "Mental Health" },
  { code: "F31.81", description: "Bipolar II disorder", category: "Mental Health" },
  { code: "F31.9", description: "Bipolar disorder, unspecified", category: "Mental Health" },
  { code: "F32.0", description: "Major depressive disorder, single episode, mild", category: "Mental Health", keywords: ["depression"] },
  { code: "F32.1", description: "Major depressive disorder, single episode, moderate", category: "Mental Health", keywords: ["depression"] },
  { code: "F32.2", description: "Major depressive disorder, single episode, severe without psychotic features", category: "Mental Health" },
  { code: "F32.3", description: "Major depressive disorder, single episode, severe with psychotic features", category: "Mental Health" },
  { code: "F32.4", description: "Major depressive disorder, single episode, in partial remission", category: "Mental Health" },
  { code: "F32.5", description: "Major depressive disorder, single episode, in full remission", category: "Mental Health" },
  { code: "F32.89", description: "Other specified depressive episodes", category: "Mental Health" },
  { code: "F32.9", description: "Major depressive disorder, single episode, unspecified", category: "Mental Health", keywords: ["depression"] },
  { code: "F33.0", description: "Major depressive disorder, recurrent, mild", category: "Mental Health" },
  { code: "F33.1", description: "Major depressive disorder, recurrent, moderate", category: "Mental Health" },
  { code: "F33.2", description: "Major depressive disorder, recurrent severe without psychotic features", category: "Mental Health" },
  { code: "F33.3", description: "Major depressive disorder, recurrent, severe with psychotic symptoms", category: "Mental Health" },
  { code: "F33.40", description: "Major depressive disorder, recurrent, in remission, unspecified", category: "Mental Health" },
  { code: "F33.9", description: "Major depressive disorder, recurrent, unspecified", category: "Mental Health", keywords: ["depression", "recurrent depression"] },
  { code: "F34.1", description: "Dysthymic disorder", category: "Mental Health", keywords: ["persistent depressive disorder", "dysthymia"] },

  // Anxiety Disorders
  { code: "F40.00", description: "Agoraphobia, unspecified", category: "Mental Health" },
  { code: "F40.10", description: "Social phobia, unspecified", category: "Mental Health", keywords: ["social anxiety"] },
  { code: "F40.11", description: "Social phobia, generalized", category: "Mental Health", keywords: ["social anxiety disorder"] },
  { code: "F41.0", description: "Panic disorder without agoraphobia", category: "Mental Health", keywords: ["panic attacks"] },
  { code: "F41.1", description: "Generalized anxiety disorder", category: "Mental Health", keywords: ["GAD", "anxiety"] },
  { code: "F41.8", description: "Other specified anxiety disorders", category: "Mental Health", keywords: ["anxiety NOS"] },
  { code: "F41.9", description: "Anxiety disorder, unspecified", category: "Mental Health", keywords: ["anxiety"] },
  { code: "F42.2", description: "Mixed obsessional thoughts and acts", category: "Mental Health", keywords: ["OCD"] },
  { code: "F42.9", description: "Obsessive-compulsive disorder, unspecified", category: "Mental Health", keywords: ["OCD"] },
  { code: "F43.10", description: "Post-traumatic stress disorder, unspecified", category: "Mental Health", keywords: ["PTSD", "trauma"] },
  { code: "F43.11", description: "Post-traumatic stress disorder, acute", category: "Mental Health", keywords: ["PTSD"] },
  { code: "F43.12", description: "Post-traumatic stress disorder, chronic", category: "Mental Health", keywords: ["PTSD"] },
  { code: "F43.20", description: "Adjustment disorder, unspecified", category: "Mental Health" },
  { code: "F43.21", description: "Adjustment disorder with depressed mood", category: "Mental Health" },
  { code: "F43.22", description: "Adjustment disorder with anxiety", category: "Mental Health" },
  { code: "F43.23", description: "Adjustment disorder with mixed anxiety and depressed mood", category: "Mental Health" },

  // Other Mental Health
  { code: "F50.00", description: "Anorexia nervosa, unspecified", category: "Mental Health", keywords: ["eating disorder"] },
  { code: "F50.01", description: "Anorexia nervosa, restricting type", category: "Mental Health" },
  { code: "F50.02", description: "Anorexia nervosa, binge eating/purging type", category: "Mental Health" },
  { code: "F50.2", description: "Bulimia nervosa", category: "Mental Health", keywords: ["eating disorder"] },
  { code: "F60.3", description: "Borderline personality disorder", category: "Mental Health", keywords: ["BPD"] },
  { code: "F84.0", description: "Autistic disorder", category: "Mental Health", keywords: ["autism", "ASD"] },
  { code: "F90.0", description: "Attention-deficit hyperactivity disorder, predominantly inattentive type", category: "Mental Health", keywords: ["ADHD", "ADD"] },
  { code: "F90.1", description: "Attention-deficit hyperactivity disorder, predominantly hyperactive type", category: "Mental Health", keywords: ["ADHD"] },
  { code: "F90.2", description: "Attention-deficit hyperactivity disorder, combined type", category: "Mental Health", keywords: ["ADHD"] },
  { code: "F90.9", description: "Attention-deficit hyperactivity disorder, unspecified type", category: "Mental Health", keywords: ["ADHD"] },

  // ============================================
  // KIDNEY DISEASE (N17-N19) - ~25 codes
  // ============================================
  { code: "N17.0", description: "Acute kidney failure with tubular necrosis", category: "Kidney Disease", keywords: ["ATN", "AKI"] },
  { code: "N17.1", description: "Acute kidney failure with acute cortical necrosis", category: "Kidney Disease" },
  { code: "N17.2", description: "Acute kidney failure with medullary necrosis", category: "Kidney Disease" },
  { code: "N17.8", description: "Other acute kidney failure", category: "Kidney Disease", keywords: ["AKI"] },
  { code: "N17.9", description: "Acute kidney failure, unspecified", category: "Kidney Disease", keywords: ["AKI", "acute renal failure"] },
  { code: "N18.1", description: "Chronic kidney disease, stage 1", category: "Kidney Disease", keywords: ["CKD"] },
  { code: "N18.2", description: "Chronic kidney disease, stage 2 (mild)", category: "Kidney Disease", keywords: ["CKD"] },
  { code: "N18.30", description: "Chronic kidney disease, stage 3 unspecified", category: "Kidney Disease", keywords: ["CKD"] },
  { code: "N18.31", description: "Chronic kidney disease, stage 3a", category: "Kidney Disease", keywords: ["CKD"] },
  { code: "N18.32", description: "Chronic kidney disease, stage 3b", category: "Kidney Disease", keywords: ["CKD"] },
  { code: "N18.4", description: "Chronic kidney disease, stage 4 (severe)", category: "Kidney Disease", keywords: ["CKD"] },
  { code: "N18.5", description: "Chronic kidney disease, stage 5", category: "Kidney Disease", keywords: ["CKD", "end stage"] },
  { code: "N18.6", description: "End stage renal disease", category: "Kidney Disease", keywords: ["ESRD", "dialysis"] },
  { code: "N18.9", description: "Chronic kidney disease, unspecified", category: "Kidney Disease", keywords: ["CKD"] },
  { code: "N19", description: "Unspecified kidney failure", category: "Kidney Disease", keywords: ["renal failure"] },
  { code: "N25.0", description: "Renal osteodystrophy", category: "Kidney Disease" },
  { code: "N25.1", description: "Nephrogenic diabetes insipidus", category: "Kidney Disease" },
  { code: "Z49.01", description: "Encounter for fitting and adjustment of extracorporeal dialysis catheter", category: "Kidney Disease", keywords: ["dialysis access"] },
  { code: "Z49.31", description: "Encounter for adequacy testing for hemodialysis", category: "Kidney Disease" },
  { code: "Z91.15", description: "Patient's noncompliance with renal dialysis", category: "Kidney Disease" },
  { code: "Z99.2", description: "Dependence on renal dialysis", category: "Kidney Disease", keywords: ["dialysis dependent"] },

  // ============================================
  // OBESITY & METABOLIC (E65-E68, E78) - ~20 codes
  // ============================================
  { code: "E66.01", description: "Morbid (severe) obesity due to excess calories", category: "Obesity", keywords: ["BMI 40+"] },
  { code: "E66.09", description: "Other obesity due to excess calories", category: "Obesity" },
  { code: "E66.1", description: "Drug-induced obesity", category: "Obesity" },
  { code: "E66.2", description: "Morbid (severe) obesity with alveolar hypoventilation", category: "Obesity", keywords: ["Pickwickian"] },
  { code: "E66.3", description: "Overweight", category: "Obesity", keywords: ["BMI 25-29"] },
  { code: "E66.8", description: "Other obesity", category: "Obesity" },
  { code: "E66.9", description: "Obesity, unspecified", category: "Obesity", keywords: ["obese"] },
  { code: "E78.00", description: "Pure hypercholesterolemia, unspecified", category: "Metabolic", keywords: ["high cholesterol"] },
  { code: "E78.01", description: "Familial hypercholesterolemia", category: "Metabolic", keywords: ["FH"] },
  { code: "E78.1", description: "Pure hyperglyceridemia", category: "Metabolic", keywords: ["high triglycerides"] },
  { code: "E78.2", description: "Mixed hyperlipidemia", category: "Metabolic", keywords: ["high cholesterol", "dyslipidemia"] },
  { code: "E78.4", description: "Other hyperlipidemia", category: "Metabolic" },
  { code: "E78.5", description: "Hyperlipidemia, unspecified", category: "Metabolic", keywords: ["high cholesterol"] },
  { code: "Z68.30", description: "Body mass index (BMI) 30.0-30.9, adult", category: "Obesity", keywords: ["obese class I"] },
  { code: "Z68.35", description: "Body mass index (BMI) 35.0-35.9, adult", category: "Obesity", keywords: ["obese class II"] },
  { code: "Z68.40", description: "Body mass index (BMI) 40.0-44.9, adult", category: "Obesity", keywords: ["obese class III", "morbid"] },
  { code: "Z68.41", description: "Body mass index (BMI) 45.0-49.9, adult", category: "Obesity", keywords: ["super obese"] },
  { code: "Z68.42", description: "Body mass index (BMI) 50.0-59.9, adult", category: "Obesity" },
  { code: "Z68.43", description: "Body mass index (BMI) 60.0-69.9, adult", category: "Obesity" },
  { code: "Z68.44", description: "Body mass index (BMI) 70 or greater, adult", category: "Obesity" },

  // ============================================
  // PAIN & MUSCULOSKELETAL (M00-M99) - ~50 codes
  // ============================================
  { code: "M05.79", description: "Rheumatoid arthritis with rheumatoid factor of unspecified site without organ or systems involvement", category: "Pain/MSK", keywords: ["RA"] },
  { code: "M06.9", description: "Rheumatoid arthritis, unspecified", category: "Pain/MSK", keywords: ["RA"] },
  { code: "M10.9", description: "Gout, unspecified", category: "Pain/MSK", keywords: ["gouty arthritis"] },
  { code: "M15.0", description: "Primary generalized (osteo)arthritis", category: "Pain/MSK" },
  { code: "M15.9", description: "Polyosteoarthritis, unspecified", category: "Pain/MSK", keywords: ["arthritis"] },
  { code: "M16.0", description: "Bilateral primary osteoarthritis of hip", category: "Pain/MSK", keywords: ["hip arthritis"] },
  { code: "M16.11", description: "Unilateral primary osteoarthritis, right hip", category: "Pain/MSK" },
  { code: "M16.12", description: "Unilateral primary osteoarthritis, left hip", category: "Pain/MSK" },
  { code: "M16.9", description: "Osteoarthritis of hip, unspecified", category: "Pain/MSK", keywords: ["hip arthritis"] },
  { code: "M17.0", description: "Bilateral primary osteoarthritis of knee", category: "Pain/MSK", keywords: ["knee arthritis"] },
  { code: "M17.11", description: "Unilateral primary osteoarthritis, right knee", category: "Pain/MSK" },
  { code: "M17.12", description: "Unilateral primary osteoarthritis, left knee", category: "Pain/MSK" },
  { code: "M17.9", description: "Osteoarthritis of knee, unspecified", category: "Pain/MSK", keywords: ["knee arthritis"] },
  { code: "M19.90", description: "Unspecified osteoarthritis, unspecified site", category: "Pain/MSK", keywords: ["arthritis", "degenerative joint disease", "DJD"] },
  { code: "M25.50", description: "Pain in unspecified joint", category: "Pain/MSK", keywords: ["joint pain", "arthralgia"] },
  { code: "M25.511", description: "Pain in right shoulder", category: "Pain/MSK", keywords: ["shoulder pain"] },
  { code: "M25.512", description: "Pain in left shoulder", category: "Pain/MSK" },
  { code: "M25.551", description: "Pain in right hip", category: "Pain/MSK", keywords: ["hip pain"] },
  { code: "M25.552", description: "Pain in left hip", category: "Pain/MSK" },
  { code: "M25.561", description: "Pain in right knee", category: "Pain/MSK", keywords: ["knee pain"] },
  { code: "M25.562", description: "Pain in left knee", category: "Pain/MSK" },
  { code: "M32.9", description: "Systemic lupus erythematosus, unspecified", category: "Pain/MSK", keywords: ["SLE", "lupus"] },
  { code: "M35.3", description: "Polymyalgia rheumatica", category: "Pain/MSK", keywords: ["PMR"] },
  { code: "M47.812", description: "Spondylosis without myelopathy or radiculopathy, cervical region", category: "Pain/MSK", keywords: ["neck arthritis"] },
  { code: "M47.816", description: "Spondylosis without myelopathy or radiculopathy, lumbar region", category: "Pain/MSK", keywords: ["back arthritis"] },
  { code: "M47.817", description: "Spondylosis without myelopathy or radiculopathy, lumbosacral region", category: "Pain/MSK" },
  { code: "M50.20", description: "Other cervical disc displacement, unspecified cervical region", category: "Pain/MSK", keywords: ["herniated disc", "neck"] },
  { code: "M51.16", description: "Intervertebral disc disorders with radiculopathy, lumbar region", category: "Pain/MSK", keywords: ["sciatica", "herniated disc"] },
  { code: "M51.26", description: "Other intervertebral disc displacement, lumbar region", category: "Pain/MSK", keywords: ["herniated disc", "bulging disc"] },
  { code: "M51.27", description: "Other intervertebral disc displacement, lumbosacral region", category: "Pain/MSK" },
  { code: "M54.10", description: "Radiculopathy, site unspecified", category: "Pain/MSK", keywords: ["pinched nerve"] },
  { code: "M54.12", description: "Radiculopathy, cervical region", category: "Pain/MSK", keywords: ["pinched nerve", "neck"] },
  { code: "M54.16", description: "Radiculopathy, lumbar region", category: "Pain/MSK", keywords: ["sciatica"] },
  { code: "M54.17", description: "Radiculopathy, lumbosacral region", category: "Pain/MSK", keywords: ["sciatica"] },
  { code: "M54.2", description: "Cervicalgia", category: "Pain/MSK", keywords: ["neck pain"] },
  { code: "M54.30", description: "Sciatica, unspecified side", category: "Pain/MSK", keywords: ["leg pain", "radiating pain"] },
  { code: "M54.31", description: "Sciatica, right side", category: "Pain/MSK" },
  { code: "M54.32", description: "Sciatica, left side", category: "Pain/MSK" },
  { code: "M54.40", description: "Lumbago with sciatica, unspecified side", category: "Pain/MSK", keywords: ["low back pain"] },
  { code: "M54.50", description: "Low back pain, unspecified", category: "Pain/MSK", keywords: ["LBP", "lumbago"] },
  { code: "M54.51", description: "Vertebrogenic low back pain", category: "Pain/MSK" },
  { code: "M54.59", description: "Other low back pain", category: "Pain/MSK" },
  { code: "M54.6", description: "Pain in thoracic spine", category: "Pain/MSK", keywords: ["upper back pain", "mid back"] },
  { code: "M54.9", description: "Dorsalgia, unspecified", category: "Pain/MSK", keywords: ["back pain"] },
  { code: "M62.830", description: "Muscle spasm of back", category: "Pain/MSK" },
  { code: "M79.1", description: "Myalgia", category: "Pain/MSK", keywords: ["muscle pain"] },
  { code: "M79.3", description: "Panniculitis, unspecified", category: "Pain/MSK" },
  { code: "M79.7", description: "Fibromyalgia", category: "Pain/MSK", keywords: ["chronic pain", "fibro"] },
  { code: "G89.29", description: "Other chronic pain", category: "Pain/MSK", keywords: ["chronic pain syndrome"] },
  { code: "G89.4", description: "Chronic pain syndrome", category: "Pain/MSK" },

  // ============================================
  // SOCIAL DETERMINANTS Z-CODES (Z55-Z65) - ~35 codes
  // ============================================
  { code: "Z55.0", description: "Illiteracy and low-level literacy", category: "Social Determinants", keywords: ["education", "reading"] },
  { code: "Z55.1", description: "Schooling unavailable and unattainable", category: "Social Determinants" },
  { code: "Z55.2", description: "Failed school examinations", category: "Social Determinants" },
  { code: "Z55.3", description: "Underachievement in school", category: "Social Determinants" },
  { code: "Z55.4", description: "Educational maladjustment and discord with teachers and classmates", category: "Social Determinants" },
  { code: "Z55.9", description: "Problems related to education and literacy, unspecified", category: "Social Determinants" },
  { code: "Z56.0", description: "Unemployment, unspecified", category: "Social Determinants", keywords: ["jobless"] },
  { code: "Z56.1", description: "Change of job", category: "Social Determinants" },
  { code: "Z56.2", description: "Threat of job loss", category: "Social Determinants" },
  { code: "Z56.3", description: "Stressful work schedule", category: "Social Determinants" },
  { code: "Z56.4", description: "Discord with boss and workmates", category: "Social Determinants" },
  { code: "Z56.5", description: "Uncongenial work environment", category: "Social Determinants" },
  { code: "Z56.6", description: "Other physical and mental strain related to work", category: "Social Determinants", keywords: ["work stress"] },
  { code: "Z56.9", description: "Unspecified problems related to employment", category: "Social Determinants" },
  { code: "Z59.00", description: "Homelessness unspecified", category: "Social Determinants", keywords: ["homeless", "unhoused"] },
  { code: "Z59.01", description: "Sheltered homelessness", category: "Social Determinants", keywords: ["shelter"] },
  { code: "Z59.02", description: "Unsheltered homelessness", category: "Social Determinants" },
  { code: "Z59.1", description: "Inadequate housing", category: "Social Determinants", keywords: ["substandard housing"] },
  { code: "Z59.41", description: "Food insecurity", category: "Social Determinants", keywords: ["hunger", "food desert"] },
  { code: "Z59.48", description: "Other specified lack of adequate food", category: "Social Determinants" },
  { code: "Z59.5", description: "Extreme poverty", category: "Social Determinants" },
  { code: "Z59.6", description: "Low income", category: "Social Determinants", keywords: ["financial hardship"] },
  { code: "Z59.7", description: "Insufficient social insurance and welfare support", category: "Social Determinants" },
  { code: "Z59.811", description: "Housing instability, housed, with risk of homelessness", category: "Social Determinants" },
  { code: "Z59.812", description: "Housing instability, housed, homelessness in past 12 months", category: "Social Determinants" },
  { code: "Z59.819", description: "Housing instability, housed unspecified", category: "Social Determinants" },
  { code: "Z59.89", description: "Other problems related to housing and economic circumstances", category: "Social Determinants" },
  { code: "Z60.0", description: "Problems of adjustment to life-cycle transitions", category: "Social Determinants" },
  { code: "Z60.2", description: "Problems related to living alone", category: "Social Determinants", keywords: ["social isolation"] },
  { code: "Z60.3", description: "Acculturation difficulty", category: "Social Determinants", keywords: ["cultural adjustment"] },
  { code: "Z60.4", description: "Social exclusion and rejection", category: "Social Determinants" },
  { code: "Z60.5", description: "Target of (perceived) adverse discrimination and persecution", category: "Social Determinants" },
  { code: "Z62.810", description: "Personal history of physical and sexual abuse in childhood", category: "Social Determinants", keywords: ["childhood trauma", "ACEs"] },
  { code: "Z62.811", description: "Personal history of psychological abuse in childhood", category: "Social Determinants" },
  { code: "Z62.812", description: "Personal history of neglect in childhood", category: "Social Determinants" },
  { code: "Z62.819", description: "Personal history of unspecified abuse in childhood", category: "Social Determinants" },
  { code: "Z63.0", description: "Problems in relationship with spouse or partner", category: "Social Determinants", keywords: ["marital problems"] },
  { code: "Z63.4", description: "Disappearance and death of family member", category: "Social Determinants", keywords: ["grief", "bereavement"] },
  { code: "Z63.5", description: "Disruption of family by separation and divorce", category: "Social Determinants" },
  { code: "Z63.72", description: "Alcoholism and drug addiction in family", category: "Social Determinants" },
  { code: "Z63.79", description: "Other stressful life events affecting family and household", category: "Social Determinants" },
  { code: "Z64.0", description: "Problems related to unwanted pregnancy", category: "Social Determinants" },
  { code: "Z64.1", description: "Problems related to multiparity", category: "Social Determinants" },
  { code: "Z65.4", description: "Victim of crime and terrorism", category: "Social Determinants" },
  { code: "Z65.5", description: "Exposure to disaster, war and other hostilities", category: "Social Determinants" },
  { code: "Z91.411", description: "Patient's personal history of adult physical and sexual abuse", category: "Social Determinants", keywords: ["domestic violence", "IPV"] },
  { code: "Z91.412", description: "Patient's personal history of adult psychological abuse", category: "Social Determinants" },

  // ============================================
  // OTHER COMMON CONDITIONS - ~40 codes
  // ============================================
  // Anemia
  { code: "D50.9", description: "Iron deficiency anemia, unspecified", category: "Anemia", keywords: ["low iron"] },
  { code: "D51.0", description: "Vitamin B12 deficiency anemia due to intrinsic factor deficiency", category: "Anemia", keywords: ["pernicious anemia"] },
  { code: "D51.9", description: "Vitamin B12 deficiency anemia, unspecified", category: "Anemia" },
  { code: "D52.9", description: "Folate deficiency anemia, unspecified", category: "Anemia" },
  { code: "D53.9", description: "Nutritional anemia, unspecified", category: "Anemia" },
  { code: "D64.9", description: "Anemia, unspecified", category: "Anemia" },

  // Thyroid
  { code: "E03.9", description: "Hypothyroidism, unspecified", category: "Thyroid", keywords: ["underactive thyroid", "low thyroid"] },
  { code: "E05.90", description: "Thyrotoxicosis, unspecified without thyrotoxic crisis or storm", category: "Thyroid", keywords: ["hyperthyroidism", "overactive thyroid"] },
  { code: "E06.3", description: "Autoimmune thyroiditis", category: "Thyroid", keywords: ["Hashimoto's"] },

  // Infectious
  { code: "B20", description: "Human immunodeficiency virus [HIV] disease", category: "Infectious Disease", keywords: ["AIDS", "HIV positive"] },
  { code: "B18.1", description: "Chronic viral hepatitis B without delta-agent", category: "Infectious Disease", keywords: ["HBV"] },
  { code: "B18.2", description: "Chronic viral hepatitis C", category: "Infectious Disease", keywords: ["HCV", "Hep C"] },
  { code: "A41.9", description: "Sepsis, unspecified organism", category: "Infectious Disease", keywords: ["septicemia"] },
  { code: "J18.9", description: "Pneumonia, unspecified organism", category: "Infectious Disease" },
  { code: "N39.0", description: "Urinary tract infection, site not specified", category: "Infectious Disease", keywords: ["UTI"] },

  // Stroke / Cerebrovascular
  { code: "I63.9", description: "Cerebral infarction, unspecified", category: "Stroke", keywords: ["stroke", "CVA", "brain attack"] },
  { code: "I63.50", description: "Cerebral infarction due to unspecified occlusion or stenosis of unspecified cerebral artery", category: "Stroke" },
  { code: "I61.9", description: "Nontraumatic intracerebral hemorrhage, unspecified", category: "Stroke", keywords: ["hemorrhagic stroke", "brain bleed"] },
  { code: "I69.30", description: "Unspecified sequelae of cerebral infarction", category: "Stroke", keywords: ["stroke history", "CVA sequelae"] },
  { code: "G45.9", description: "Transient cerebral ischemic attack, unspecified", category: "Stroke", keywords: ["TIA", "mini stroke"] },

  // GI
  { code: "K21.0", description: "Gastro-esophageal reflux disease with esophagitis", category: "GI", keywords: ["GERD", "acid reflux"] },
  { code: "K21.9", description: "Gastro-esophageal reflux disease without esophagitis", category: "GI", keywords: ["GERD"] },
  { code: "K25.9", description: "Gastric ulcer, unspecified as acute or chronic, without hemorrhage or perforation", category: "GI", keywords: ["stomach ulcer"] },
  { code: "K29.70", description: "Gastritis, unspecified, without bleeding", category: "GI" },
  { code: "K50.90", description: "Crohn's disease, unspecified, without complications", category: "GI", keywords: ["IBD", "inflammatory bowel"] },
  { code: "K51.90", description: "Ulcerative colitis, unspecified, without complications", category: "GI", keywords: ["IBD", "UC"] },
  { code: "K57.30", description: "Diverticulosis of large intestine without perforation or abscess without bleeding", category: "GI" },
  { code: "K57.32", description: "Diverticulitis of large intestine without perforation or abscess without bleeding", category: "GI" },
  { code: "K58.9", description: "Irritable bowel syndrome without diarrhea", category: "GI", keywords: ["IBS"] },
  { code: "K70.30", description: "Alcoholic cirrhosis of liver without ascites", category: "GI", keywords: ["liver disease"] },
  { code: "K74.60", description: "Unspecified cirrhosis of liver", category: "GI", keywords: ["liver failure"] },
  { code: "K76.0", description: "Fatty (change of) liver, not elsewhere classified", category: "GI", keywords: ["NAFLD", "fatty liver"] },

  // Peripheral Vascular
  { code: "I70.0", description: "Atherosclerosis of aorta", category: "Vascular" },
  { code: "I70.209", description: "Unspecified atherosclerosis of native arteries of extremities, unspecified extremity", category: "Vascular", keywords: ["PAD", "peripheral artery disease"] },
  { code: "I73.9", description: "Peripheral vascular disease, unspecified", category: "Vascular", keywords: ["PVD"] },
  { code: "I87.2", description: "Venous insufficiency (chronic) (peripheral)", category: "Vascular" },

  // Neurological
  { code: "G20", description: "Parkinson's disease", category: "Neurological", keywords: ["Parkinson", "PD"] },
  { code: "G30.9", description: "Alzheimer's disease, unspecified", category: "Neurological", keywords: ["Alzheimer's", "dementia"] },
  { code: "G35", description: "Multiple sclerosis", category: "Neurological", keywords: ["MS"] },
  { code: "G40.909", description: "Epilepsy, unspecified, not intractable, without status epilepticus", category: "Neurological", keywords: ["seizures"] },
  { code: "G43.909", description: "Migraine, unspecified, not intractable, without status migrainosus", category: "Neurological", keywords: ["headache"] },
  { code: "G62.9", description: "Polyneuropathy, unspecified", category: "Neurological", keywords: ["neuropathy", "nerve damage"] },

  // Sleep
  { code: "G47.00", description: "Insomnia, unspecified", category: "Sleep", keywords: ["can't sleep", "sleeplessness"] },
  { code: "G47.33", description: "Obstructive sleep apnea (adult) (pediatric)", category: "Sleep", keywords: ["OSA", "sleep apnea"] },
]

/**
 * Get all unique categories from the ICD-10 codes
 */
export function getCategories(): string[] {
  const categories = new Set(ICD10_CODES.map(code => code.category))
  return Array.from(categories).sort()
}

/**
 * Search ICD-10 codes by query (matches code, description, or keywords)
 * @param query Search string
 * @param limit Maximum results to return (default 50)
 */
export function searchICD10Codes(query: string, limit: number = 50): ICD10Code[] {
  if (!query || query.trim().length === 0) {
    return []
  }

  const searchTerm = query.toLowerCase().trim()

  const results = ICD10_CODES.filter(code => {
    // Match against code
    if (code.code.toLowerCase().includes(searchTerm)) {
      return true
    }
    // Match against description
    if (code.description.toLowerCase().includes(searchTerm)) {
      return true
    }
    // Match against keywords
    if (code.keywords?.some(kw => kw.toLowerCase().includes(searchTerm))) {
      return true
    }
    return false
  })

  // Sort by relevance: exact code match first, then code starts with, then description contains
  results.sort((a, b) => {
    const aCodeExact = a.code.toLowerCase() === searchTerm
    const bCodeExact = b.code.toLowerCase() === searchTerm
    if (aCodeExact && !bCodeExact) return -1
    if (bCodeExact && !aCodeExact) return 1

    const aCodeStarts = a.code.toLowerCase().startsWith(searchTerm)
    const bCodeStarts = b.code.toLowerCase().startsWith(searchTerm)
    if (aCodeStarts && !bCodeStarts) return -1
    if (bCodeStarts && !aCodeStarts) return 1

    // Then alphabetically by code
    return a.code.localeCompare(b.code)
  })

  return results.slice(0, limit)
}

/**
 * Get ICD-10 codes by category
 * @param category Category name
 */
export function getCodesByCategory(category: string): ICD10Code[] {
  return ICD10_CODES.filter(code => code.category === category)
}

/**
 * Look up a specific ICD-10 code
 * @param code ICD-10 code to look up
 */
export function getICD10Code(code: string): ICD10Code | undefined {
  return ICD10_CODES.find(c => c.code.toUpperCase() === code.toUpperCase())
}

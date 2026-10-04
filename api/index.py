from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
import re

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

TRAINING_DATA = [
    ("Valve isolation failed under line pressure during flange bolt removal", "Energy Isolation", "HIGH"),
    ("High pressure line opened without zero energy verification lockout tagout", "Energy Isolation", "HIGH"),
    ("Worker removed safety interlock switch on the compressor emergency stop", "Bypassing Safety Controls", "HIGH"),
    ("Safety barrier override performed without management authorization", "Bypassing Safety Controls", "HIGH"),
    ("Technician entered crude oil storage tank vessel without gas monitoring toxic gas", "Confined Space", "HIGH"),
    ("Manhole entry without oxygen test or standby rescue personnel", "Confined Space", "HIGH"),
    ("Speeding light vehicle rolled over on gravel access road driver seatbelt failed", "Driving", "HIGH"),
    ("Heavy transport truck collision near drilling pad due to brake failure", "Driving", "HIGH"),
    ("Welding torch spark ignited flammable vapor near gas separator line", "Hot Work", "HIGH"),
    ("Grinding work performed without hot work permit or fire watch cover", "Hot Work", "HIGH"),
    ("Rig worker positioned directly in line of fire under pressurized discharge line", "Line of Fire", "HIGH"),
    ("Standing under suspended drill pipe load when hoist cable shifted", "Line of Fire", "HIGH"),
    ("Crane lifting tackle sling snapped while hoisting heavy blowout preventer", "Safe Mechanical Lifting", "HIGH"),
    ("Exceeded crane safe working load limit during heavy module lift", "Safe Mechanical Lifting", "HIGH"),
    ("Worker stepped onto scaffold without safety harness fall protection at 12m height", "Working at Height", "HIGH"),
    ("Unsecured ladder slipped during elevated walkway lighting inspection", "Working at Height", "HIGH"),
    ("Routine housekeeping performed in main workshop area clean floor", "Work Authorization", "LOW"),
    ("Routine replenishment of safety goggles and personal protective equipment inventory", "Work Authorization", "LOW"),
    ("Toolbox talk conducted and work permit signed for daily shift change inspection", "Work Authorization", "LOW"),
    ("General visual inspection of office fire extinguisher pressure gauges", "Work Authorization", "LOW")
]

df = pd.DataFrame(TRAINING_DATA, columns=["report_text", "iogp_rule", "sif_potential"])

def preprocess_text(text: str) -> str:
    cleaned = text.lower()
    cleaned = re.sub(r'[^a-z0-9\s]', ' ', cleaned)
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    return cleaned

df["clean_text"] = df["report_text"].apply(preprocess_text)

rule_model = Pipeline([
    ("tfidf", TfidfVectorizer(ngram_range=(1, 2))),
    ("clf", LogisticRegression(class_weight="balanced"))
])
rule_model.fit(df["clean_text"], df["iogp_rule"])

sif_model = Pipeline([
    ("tfidf", TfidfVectorizer(ngram_range=(1, 2))),
    ("clf", LogisticRegression(class_weight="balanced"))
])
sif_model.fit(df["clean_text"], df["sif_potential"])

METADATA = {
    "Energy Isolation": {
        "activity": "Pipeline / Equipment Maintenance",
        "hazard": "Stored / Pressurized Energy",
        "barrier_failure": "Energy isolation barrier compromised",
        "potential_consequence": "Uncontrolled energy release — Serious Injury / Fatality potential"
    },
    "Bypassing Safety Controls": {
        "activity": "Safety Systems Operation",
        "hazard": "Defeated Protection System",
        "barrier_failure": "Safety interlock / control bypassed",
        "potential_consequence": "Catastrophic system failure without safety cut-offs"
    },
    "Confined Space": {
        "activity": "Tank / Vessel Entry",
        "hazard": "Oxygen Deficiency / Toxic Atmosphere",
        "barrier_failure": "Atmospheric testing / standby rescue missing",
        "potential_consequence": "Asphyxiation or severe chemical poisoning"
    },
    "Driving": {
        "activity": "Site Vehicle Transport",
        "hazard": "Vehicle Dynamics / Roll Over",
        "barrier_failure": "Defensive driving / seatbelt barrier failure",
        "potential_consequence": "Vehicle rollover resulting in severe trauma"
    },
    "Hot Work": {
        "activity": "Welding / Cutting Operations",
        "hazard": "Spark Ignition in Flammable Zone",
        "barrier_failure": "Gas testing / fire watch barrier breached",
        "potential_consequence": "Explosion or flash fire hazard"
    },
    "Line of Fire": {
        "activity": "Rig Floor / Pipe Handling",
        "hazard": "Stored Mechanical Energy / Drop Zone",
        "barrier_failure": "Exclusion zone not enforced",
        "potential_consequence": "Direct impact or crush injury"
    },
    "Safe Mechanical Lifting": {
        "activity": "Crane & Rigging Lifting Operations",
        "hazard": "Falling Suspended Load",
        "barrier_failure": "Lifting tackle / load limit integrity failed",
        "potential_consequence": "Crush injury or structural collapse"
    },
    "Working at Height": {
        "activity": "Elevated Structure Maintenance",
        "hazard": "Fall from Elevation",
        "barrier_failure": "Fall arrest harness / tie-off not used",
        "potential_consequence": "High-impact fall resulting in severe injury"
    },
    "Work Authorization": {
        "activity": "Routine Maintenance / Operations",
        "hazard": "General Low-Energy Operational Risk",
        "barrier_failure": "None identified (Controls intact)",
        "potential_consequence": "Minor or negligible injury risk"
    }
}

class IncidentRequest(BaseModel):
    text: str

@app.post("/api/analyze")
def analyze_report(request: IncidentRequest):
    cleaned = preprocess_text(request.text)
    
    predicted_rule = rule_model.predict([cleaned])[0]
    predicted_sif = sif_model.predict([cleaned])[0]
    
    probabilities = sif_model.predict_proba([cleaned])[0]
    sif_classes = list(sif_model.classes_)
    high_index = sif_classes.index("HIGH")
    sif_probability = float(probabilities[high_index])
    score = int(round(sif_probability * 100))
    
    vocab = rule_model.named_steps["tfidf"].vocabulary_
    words = cleaned.split()
    extracted_precursors = [w for w in words if w in vocab]
    
    info = METADATA.get(predicted_rule, METADATA["Work Authorization"])
    
    if predicted_sif == "HIGH":
        why_flagged = f"Exposure to {info['hazard'].lower()} during {info['activity'].lower()}. The model identified that {info['barrier_failure'].lower()}, triggering IOGP Rule: {predicted_rule}."
    else:
        why_flagged = "Observation does not indicate high-energy exposure or critical safety barrier failure."

    return {
        "sif_potential": predicted_sif,
        "sif_score": max(score, 15) if predicted_sif == "HIGH" else min(score, 25),
        "life_saving_rule": predicted_rule,
        "activity": info["activity"],
        "hazard": info["hazard"],
        "barrier_failure": info["barrier_failure"],
        "potential_consequence": info["potential_consequence"],
        "why_flagged": why_flagged,
        "extracted_precursors": list(dict.fromkeys(extracted_precursors))[:8]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend:app", host="127.0.0.1", port=8000, reload=True)
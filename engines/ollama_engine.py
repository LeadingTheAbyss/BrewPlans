import requests
import json
import re
import os
from dotenv import load_dotenv

def build_prompt(passengers: list, total_budget: int, days: int, preference: str, group_size: int = 1, constraints: str = "") -> str:
    cities = [p.get("city", "Unknown") for p in passengers if p.get("city")]
    city_str = ", ".join(cities) if cities else "various locations"
    num_pax = group_size if group_size > 0 else (len(cities) if cities else 1)
    
    per_person = total_budget // num_pax if num_pax > 0 else total_budget

    # Build a concrete guidance note per preference type so the model doesn't hallucinate
    # NOTE: cities within each list are in NO particular order — ranking must be based on budget fit and traveler context
    import random
    preference_lower = preference.lower()

    # Each entry: (keyword, city_list, exclusions)
    # exclusions = cities to explicitly avoid for this context
    guidance_rules = [
        ("non veg", ["Hyderabad (dum biryani)", "Kolkata (kosha mangsho, hilsa fish)", "Amritsar (tandoori chicken, fish)", "Goa (seafood)", "Chettinad (spicy non-veg curries)", "Mumbai (street non-veg)", "Old Delhi (kebabs)", "Lucknow (galouti kebab, shami kebab)"], []),
        ("veg",     ["Indore (poha, jalebi, pure veg street food)", "Ahmedabad (Gujarati thali, dhokla)", "Varanasi (kachori, lassi)", "Jaipur (dal baati churma)", "Mathura (pedas, sattvic food)", "Pushkar (pure veg city)", "Mysore (Udupi cuisine)", "Tirupati (prasadam, South Indian veg)", "Vrindavan (sattvic veg)"], ["Lucknow", "Hyderabad", "Kolkata", "Amritsar", "Goa", "Chettinad"]),
        ("food",    ["Hyderabad (biryani, Irani chai)", "Old Delhi (parathas, chaat)", "Amritsar (kulcha, tandoori)", "Kolkata (mishti doi, kathi rolls)", "Indore (poha, jalebi, street food)", "Mumbai (vada pav, street food)", "Chennai (dosas, filter coffee)", "Lucknow (Awadhi cuisine)", "Mysore", "Pune"], []),
        ("culinary",["Hyderabad (biryani, Irani chai)", "Old Delhi (parathas, chaat)", "Amritsar (kulcha, tandoori)", "Kolkata (mishti doi, kathi rolls)", "Indore (poha, jalebi, street food)", "Mumbai (vada pav, street food)", "Chennai (dosas, filter coffee)", "Lucknow (Awadhi cuisine)", "Mysore", "Pune"], []),
        ("mountains",["Ladakh", "Spiti Valley", "Manali", "Kasol", "Darjeeling", "Gangtok", "Shimla", "Mussoorie", "Almora", "Auli", "Dalhousie", "Nainital", "Ooty", "Kodaikanal", "Munnar"], []),
        ("beaches", ["Andaman Islands", "Gokarna", "Goa", "Varkala", "Pondicherry", "Lakshadweep", "Kovalam", "Vizag", "Puri", "Diu", "Tarkarli"], []),
        ("heritage",["Hampi", "Varanasi", "Agra", "Jaisalmer", "Mahabalipuram", "Jodhpur", "Khajuraho", "Udaipur", "Jaipur", "Fatehpur Sikri", "Mysore"], []),
        ("wildlife",["Kaziranga", "Bandhavgarh", "Jim Corbett", "Sundarbans", "Ranthambore", "Kanha", "Gir Forest", "Nagarhole", "Mudumalai"], []),
        ("spiritual",["Bodh Gaya", "Varanasi", "Shirdi", "Rishikesh", "Tirupati", "Haridwar", "Puri", "Amritsar", "Vrindavan", "Madurai"], []),
        ("adventure",["Spiti", "Bir Billing", "Rishikesh", "Ladakh", "Manali", "Chopta", "Coorg", "Wayanad"], []),
        ("romantic", ["Coorg", "Andaman", "Udaipur", "Munnar", "Pondicherry", "Ooty", "Goa", "Mussoorie", "Shimla"], []),
        ("nightlife",["Bengaluru", "Mumbai", "Goa", "Pune", "Delhi", "Hyderabad"], []),
    ]

    # Collect ALL matching contexts (not just first) so "food and veg" gets both hints
    matched_cities = []
    all_exclusions = []
    for keyword, city_list, exclusions in guidance_rules:
        if keyword in preference_lower:
            shuffled = city_list[:]
            random.shuffle(shuffled)
            matched_cities.extend(shuffled)
            all_exclusions.extend(exclusions)

    guidance = ""
    if matched_cities:
        # Deduplicate while preserving order
        seen = set()
        unique_cities = [c for c in matched_cities if not (c in seen or seen.add(c))]
        guidance = f"\nCONTEXT — relevant cities (in NO particular order, rank by budget & traveler home city): {', '.join(unique_cities)}"
    if all_exclusions:
        unique_excl = list(dict.fromkeys(all_exclusions))
        guidance += f"\nDO NOT recommend these cities as they do NOT match the preference: {', '.join(unique_excl)}\n"

    return f"""
A group of {num_pax} travelers want to take a trip.
- Their home cities are: {city_str}
- Total budget for the entire group: ₹{total_budget}
- Budget per person: ₹{per_person}
- Duration: {days} days (excluding travel days)
- Their travel preference / vibe: "{preference}"
{guidance}
Recommend EXACTLY 10 destinations in India that best match the preference "{preference}".

{f"- HARD USER CONSTRAINTS: '{constraints}'\\n  You MUST respect these constraints. Destinations that violate these constraints are STRICTLY FORBIDDEN." if constraints else ""}
ALL 10 destinations MUST strongly align with this preference. Do NOT recommend generic tourist spots that do not match.

Respond ONLY with a JSON object containing a "destinations" array, where each item matches this EXACT structure:
{{
  "destinations": [
    {{
      "id": "slug_name",
      "name": "Destination Name",
      "state": "State Name",
      "category": "food|mountains|beaches|heritage|desert|wildlife|spiritual|hills|adventure|romantic|nightlife|any",
      "tags": ["Tag1", "Tag2", "Tag3"],
      "why": "A 1-2 sentence personal explanation of why this place matches their preference, referencing their home city and budget.",
      "budgetEstimate": 0,
      "perPersonEstimate": 0,
      "matchScore": 92,
      "isPrimaryMatch": true
    }}
  ]
}}

Rules:
- STRICT GEOGRAPHY RULE: EVERY destination MUST be located within the country of India. DO NOT recommend foreign countries like Bhutan, Nepal, Sri Lanka, Maldives, or Dubai under any circumstances.
- name MUST be the actual city or place name ONLY (e.g. "Indore", "Goa", "Shimla"). DO NOT add descriptors.
- budgetEstimate MUST be a realistic total cost in INR for ALL {num_pax} people for {days} days (transport from {city_str}, stay, food). Provide a REAL number, not 0.
- budgetEstimate MUST NOT exceed ₹{total_budget}.
- perPersonEstimate MUST equal (budgetEstimate / {num_pax}).
- matchScore is 0-100, score between 70-98 based on how well the destination matches the preference.
- isPrimaryMatch must be true for all 10.
- Return EXACTLY 10 destinations.
- DO NOT use any emojis.
"""

def call_ollama(prompt: str) -> str:
    system_prompt = "You are an expert Indian travel planner. Respond ONLY with valid JSON."
    
    # Re-read .env on every call so key changes are picked up without restarting the server
    load_dotenv(override=True)
    groq_api_key = os.getenv("GROQ_API_KEY")
    print(f"[Groq] Using key: {groq_api_key[:8] if groq_api_key else 'NONE'}...")
    if not groq_api_key or groq_api_key == "your_groq_api_key_here":
        return '{"error": "Groq API Key is missing. Please add GROQ_API_KEY to the .env file."}'
        
    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {groq_api_key}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "llama-3.3-70b-versatile",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.4,
        "response_format": {"type": "json_object"}
    }
    
    try:
        res = requests.post(url, headers=headers, json=payload, timeout=180)
        res.raise_for_status()
        data = res.json()
        return data["choices"][0]["message"]["content"]
    except Exception as e:
        print(f"[Error] Krutrim API call failed: {e}")
        return f"EXCEPTION: {str(e)}"


def parse_response(raw: str) -> list:
    if not raw:
        return []
    
    # Attempt 1: Direct parsing
    try:
        data = json.loads(raw)
        if isinstance(data, dict) and "destinations" in data:
            return data["destinations"]
        elif isinstance(data, list):
            return data
    except json.JSONDecodeError:
        pass
        
    # Attempt 2: Extract JSON object using regex
    try:
        match = re.search(r'\{.*\}', raw, re.DOTALL)
        if match:
            data = json.loads(match.group(0))
            if isinstance(data, dict) and "destinations" in data:
                return data["destinations"]
    except json.JSONDecodeError:
        pass
        
    print("[Error] Failed to parse Ollama response as JSON array")
    print(raw.encode('ascii', 'replace').decode('ascii'))
    return []

def recommend(passengers: list, total_budget: int, days: int, preference: str, group_size: int = 0, constraints: str = "") -> list:
    # Resolve num_pax: use explicit group_size if provided, else fall back to city count
    cities = [p for p in passengers if p.get("city")]
    num_pax = group_size if group_size > 0 else (len(cities) if cities else 1)

    prompt = build_prompt(passengers, total_budget, days, preference, num_pax, constraints)
    raw_response = call_ollama(prompt)
    destinations = parse_response(raw_response)
    
    # Fallback if Ollama fails or returns invalid response
    if not destinations or not isinstance(destinations, list):
        error_details = raw_response[:300] if raw_response else "Empty response"
        return [
            {
                "id": "fallback_error",
                "name": "Service Unavailable",
                "state": "N/A",
                "category": preference,
                "tags": ["Error"],
                "why": f"Ollama failed. Details: {error_details}",
                "budgetEstimate": 0,
                "perPersonEstimate": 0,
                "matchScore": 0,
                "isPrimaryMatch": False
            }
        ]
        
    # --- Deduplicate by city name (the LLM sometimes repeats cities) ---
    seen_names = set()
    unique_destinations = []
    for dest in destinations:
        if not isinstance(dest, dict):
            continue
        name_key = dest.get("name", "").strip().lower()
        if name_key and name_key not in seen_names:
            seen_names.add(name_key)
            unique_destinations.append(dest)
    destinations = unique_destinations

    # --- Realistic budget calculation (don't trust the LLM's math) ---
    # Per-person-per-day costs in INR based on destination category
    # These cover: mid-range hotel, 3 meals, local transport, and entry fees
    COST_PER_PERSON_PER_DAY = {
        "mountains": 2500,
        "hills":     2500,
        "beaches":   3000,
        "heritage":  2000,
        "spiritual": 1800,
        "wildlife":  3500,
        "desert":    2800,
        "adventure": 3200,
        "food":      2200,
        "any":       2500,
    }
    # One-time round-trip transport cost per person (rough average across India)
    TRANSPORT_COST_PER_PERSON = 2000

    for dest in destinations:
        if not isinstance(dest, dict):
            continue
        try:
            category = str(dest.get("category", "any")).lower()
            daily_rate = COST_PER_PERSON_PER_DAY.get(category, 2500)
            realistic_total = (daily_rate * days + TRANSPORT_COST_PER_PERSON) * num_pax
            # Clamp to the user's budget ceiling so we never exceed it
            budget_estimate = min(realistic_total, total_budget)
            dest["budgetEstimate"] = budget_estimate
            dest["perPersonEstimate"] = budget_estimate // num_pax
        except Exception as e:
            print(f"[Warn] Budget calc failed for {dest.get('name')}: {e}")

    return destinations


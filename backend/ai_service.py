from google import genai
import os
from dotenv import load_dotenv

load_dotenv()

client = genai.Client(api_key=os.getenv('GEMINI_API_KEY'))

def get_raspuns_joc(intrebare):
    prompt = f"""
    Esti GameMatch AI, un asistent expert in jocuri video.
    Stii tot despre jocuri — de la clasice la moderne, PC, console, mobile.
    
    Raspunde la urmatoarea intrebare despre jocuri:
    {intrebare}
    
    Fii prietenos, entuziast si detaliat.
    Raspunde in limba romana.
    """
    
    response = client.models.generate_content(
        model='gemini-2.5-flash',
        contents=prompt
    )
    return response.text

def recomanda_jocuri(gen=None, platforma=None, preferinte=None):
    prompt = f"""
    Esti GameMatch AI, expert in recomandari de jocuri video.
    
    Recomanda 5 jocuri bazat pe urmatoarele preferinte:
    - Gen: {gen or 'orice'}
    - Platforma: {platforma or 'orice'}
    - Preferinte: {preferinte or 'jocuri populare'}
    
    Pentru fiecare joc include:
    - Nume
    - Gen
    - Platforma
    - De ce il recomanzi
    
    Raspunde DOAR cu JSON valid:
    [
        {{
            "nume": "Numele jocului",
            "gen": "Gen joc",
            "platforma": "PC/PS5/Xbox/Mobile",
            "motiv": "De ce il recomanzi"
        }}
    ]
    """
    
    import json
    response = client.models.generate_content(
        model='gemini-2.5-flash',
        contents=prompt
    )
    
    text = response.text.strip()
    if '```json' in text:
        text = text.split('```json')[1].split('```')[0].strip()
    elif '```' in text:
        text = text.split('```')[1].split('```')[0].strip()
    
    return json.loads(text)

def verifica_etica(intrebare):
    prompt = f"""
    Esti un sistem de moderare pentru GameMatch AI.
    
    Verifica daca aceasta intrebare este:
    1. Relevanta pentru jocuri video sau gaming
    2. Adecvata pentru un mediu educational/distractiv
    3. Nu contine limbaj ofensator
    
    INTREBARE: {intrebare}
    
    Raspunde DOAR cu JSON valid:
    {{
        "permisa": true,
        "motiv": "Explicatie scurta"
    }}
    """
    
    import json
    response = client.models.generate_content(
        model='gemini-2.5-flash',
        contents=prompt
    )
    
    text = response.text.strip()
    if '```json' in text:
        text = text.split('```json')[1].split('```')[0].strip()
    elif '```' in text:
        text = text.split('```')[1].split('```')[0].strip()
    
    return json.loads(text)
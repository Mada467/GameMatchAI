from google import genai
import os
import json
from dotenv import load_dotenv

load_dotenv()

client = genai.Client(api_key=os.getenv('GEMINI_API_KEY'))

def get_raspuns_joc(intrebare):
    prompt = f"""
    Esti GameMatch AI, un asistent expert in jocuri video.
    Stii tot despre jocuri — de la clasice la moderne, PC, console, mobile.
    Cand recomanzi jocuri, mentioneaza intotdeauna:
    - Numele exact al jocului
    - Platforma disponibila
    - De ce il recomanzi
    
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

def recomanda_jocuri(gen=None, platforma=None, preferinte=None, mod=None, varsta=None, numar=5):
    prompt = f"""
    Esti GameMatch AI, expert in recomandari de jocuri video.
    
    Recomanda exact {numar} jocuri bazat pe urmatoarele preferinte:
    - Gen: {gen or 'orice'}
    - Platforma: {platforma or 'orice'}
    - Mod joc: {mod or 'orice'}
    - Varsta: {varsta or 'toate varstele'}
    - Preferinte extra: {preferinte or 'jocuri populare'}
    
    Pentru fiecare joc include:
    - Nume exact
    - Gen
    - Platforma
    - Rating aproximativ
    - De ce il recomanzi
    - Varsta recomandata
    
    Raspunde DOAR cu JSON valid:
    [
        {{
            "nume": "Numele jocului",
            "gen": "Gen joc",
            "platforma": "PC/PS5/Xbox/Mobile",
            "rating": 9.0,
            "motiv": "De ce il recomanzi",
            "varsta": "16+"
        }}
    ]
    """
    
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
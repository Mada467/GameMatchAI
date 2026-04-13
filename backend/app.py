from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv
from database import get_connection
from ai_service import get_raspuns_joc, recomanda_jocuri, verifica_etica, client
import os
import json

load_dotenv()

app = Flask(__name__, 
    static_folder='../frontend',
    static_url_path='')
CORS(app)

@app.route('/')
def home():
    return send_from_directory('../frontend', 'GameMatch-AI.html')

@app.route('/pages/<path:filename>')
def pages(filename):
    return send_from_directory('../frontend/pages', filename)

@app.route('/api/intreaba', methods=['POST'])
def intreaba():
    data = request.get_json()
    intrebare = data.get('intrebare')

    if not intrebare:
        return jsonify({'error': 'Intrebarea lipseste!'}), 400

    try:
        etica = verifica_etica(intrebare)
        if not etica.get('permisa', True):
            return jsonify({
                'error': 'intrebare_nepermisa',
                'motiv': etica.get('motiv', 'Intrebarea nu este relevanta pentru gaming.')
            }), 400
    except Exception as e:
        print(f"Eroare verificare etica: {e}")

    raspuns = get_raspuns_joc(intrebare)

    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO conversatii (intrebare, raspuns) VALUES (%s, %s)",
            (intrebare, raspuns)
        )
        cursor.execute(
            "INSERT INTO statistici (tip_cerere, detalii) VALUES (%s, %s)",
            ('intrebare', intrebare)
        )
        conn.commit()
        cursor.close()
        conn.close()
    except Exception as e:
        print(f"Eroare salvare: {e}")

    return jsonify({'raspuns': raspuns})

@app.route('/api/recomanda', methods=['POST'])
def recomanda():
    data = request.get_json()
    gen = data.get('gen')
    platforma = data.get('platforma')
    mod = data.get('mod')
    varsta = data.get('varsta')
    numar = data.get('numar', 5)
    preferinte = data.get('preferinte')

    try:
        jocuri = recomanda_jocuri(gen, platforma, preferinte, mod, varsta, numar)
        try:
            conn = get_connection()
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO statistici (tip_cerere, detalii) VALUES (%s, %s)",
                ('recomandare', f"gen:{gen} platforma:{platforma}")
            )
            conn.commit()
            cursor.close()
            conn.close()
        except Exception as e:
            print(f"Eroare salvare statistici: {e}")
        return jsonify({'jocuri': jocuri})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/extrage-jocuri', methods=['POST'])
def extrage_jocuri():
    data = request.get_json()
    text = data.get('text', '')

    try:
        prompt = f"""
        Din urmatorul text extrage numele jocurilor video mentionate.
        
        TEXT: {text}
        
        Raspunde DOAR cu JSON valid:
        [
            {{
                "nume": "Numele jocului",
                "gen": "Gen joc",
                "platforma": "Platforma"
            }}
        ]
        
        Daca nu sunt jocuri in text, returneaza lista goala: []
        """

        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt
        )

        text_r = response.text.strip()
        if '```json' in text_r:
            text_r = text_r.split('```json')[1].split('```')[0].strip()
        elif '```' in text_r:
            text_r = text_r.split('```')[1].split('```')[0].strip()

        jocuri = json.loads(text_r)
        return jsonify({'jocuri': jocuri})
    except Exception as e:
        return jsonify({'jocuri': []})

@app.route('/api/pc-config', methods=['POST'])
def pc_config():
    data = request.get_json()
    cpu = data.get('cpu')
    gpu = data.get('gpu')
    ram = data.get('ram')
    stocare = data.get('stocare')
    gen = data.get('gen')
    rezolutie = data.get('rezolutie')
    console_det = data.get('console_det')
    buget = data.get('buget')

    try:
        prompt = f"""
        Esti GameMatch AI, expert in hardware si gaming pe PC.
        
        Analizeaza aceasta configuratie si recomanda jocuri si setari:
        - CPU: {cpu}
        - GPU: {gpu}
        - RAM: {ram}
        - Stocare: {stocare}
        - Rezolutie: {rezolutie}
        - Console detinute: {console_det}
        - Buget jocuri: {buget}
        - Genuri preferate: {gen}
        
        Ofera:
        1. Performanta estimata (FPS la 1080p/1440p/4K)
        2. Top 5 jocuri recomandate pentru aceasta configuratie
        3. Setari optime in joc pentru performanta maxima
        4. Upgrade-uri recomandate daca e cazul
        
        Raspunde in romana, detaliat si prietenos.
        """

        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt
        )

        analiza = response.text

        prompt_jocuri = f"""
        Pentru o configuratie cu {cpu}, {gpu}, {ram} RAM,
        recomanda 5 jocuri potrivite gen {gen or 'orice'}.
        
        Raspunde DOAR cu JSON valid:
        [
            {{
                "nume": "Numele jocului",
                "gen": "Gen",
                "platforma": "PC",
                "motiv": "De ce merge bine pe aceasta configuratie"
            }}
        ]
        """

        response2 = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt_jocuri
        )

        text_j = response2.text.strip()
        if '```json' in text_j:
            text_j = text_j.split('```json')[1].split('```')[0].strip()
        elif '```' in text_j:
            text_j = text_j.split('```')[1].split('```')[0].strip()

        jocuri = json.loads(text_j)

        return jsonify({'analiza': analiza, 'jocuri': jocuri})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/compare', methods=['POST'])
def compare():
    data = request.get_json()
    joc1 = data.get('joc1')
    joc2 = data.get('joc2')

    try:
        prompt = f"""
        Esti GameMatch AI, expert in jocuri video.
        
        Compara detaliat aceste 2 jocuri:
        - Joc 1: {joc1}
        - Joc 2: {joc2}
        
        Compara pe urmatoarele criterii:
        1. Gameplay si mecanici
        2. Grafica si performanta
        3. Poveste si continut
        4. Multiplayer / Single Player
        5. Pret si valoare
        6. Platforme disponibile
        7. Cerinte sistem (PC)
        
        La final da un verdict clar: care e mai bun si pentru cine.
        Raspunde in romana, detaliat.
        """

        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt
        )

        return jsonify({'comparatie': response.text})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/statistici', methods=['GET'])
def statistici():
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT tip_cerere, detalii, created_at FROM statistici ORDER BY created_at DESC LIMIT 20")
        rows = cursor.fetchall()
        cursor.close()
        conn.close()
        result = [{'tip': r[0], 'detalii': r[1], 'data': str(r[2])} for r in rows]
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/istoric', methods=['GET'])
def istoric():
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT intrebare, created_at FROM conversatii ORDER BY created_at DESC LIMIT 20")
        rows = cursor.fetchall()
        cursor.close()
        conn.close()
        result = [{'intrebare': r[0], 'data': str(r[1])} for r in rows]
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

app.run(debug=True, port=5000)
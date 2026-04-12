from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from database import get_connection
from ai_service import get_raspuns_joc, recomanda_jocuri, verifica_etica
import os
import json

load_dotenv()

app = Flask(__name__)
CORS(app)

@app.route('/')
def home():
    return jsonify({'status': 'GameMatch AI API functioneaza!'})

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
    preferinte = data.get('preferinte')

    try:
        jocuri = recomanda_jocuri(gen, platforma, preferinte)
        
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
import pymysql
import os
from dotenv import load_dotenv

load_dotenv()

def get_connection():
    connection = pymysql.connect(
        host=os.getenv('DB_HOST'),
        user=os.getenv('DB_USER'),
        password=os.getenv('DB_PASSWORD'),
        database=os.getenv('DB_NAME'),
        charset='utf8mb4'
    )
    return connection

def test_connection():
    try:
        conn = get_connection()
        print("Conexiune la MySQL reusita!")
        conn.close()
        return True
    except Exception as e:
        print(f"Eroare conexiune: {e}")
        return False
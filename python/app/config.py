import os
from dotenv import load_dotenv

load_dotenv()

AUTH_URL      = os.getenv("AUTH_URL",      "https://auth-center.sh-development.ru")
AUTH_INTERNAL = os.getenv("AUTH_INTERNAL", "https://auth-center.sh-development.ru")
APP_URL       = os.getenv("APP_URL",       "http://localhost:8000")
APP_TOKEN     = os.getenv("APP_TOKEN",     "")
SECRET_KEY    = os.getenv("SECRET_KEY",    "dev-secret-change-me")
DB_PATH       = os.getenv("DB_PATH",       "/data/wgetbash.db")

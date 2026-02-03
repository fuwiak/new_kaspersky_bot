# 🚀 Szybki start na Railway

## 📋 Co będzie uruchomione

Po wdrożeniu na Railway automatycznie uruchomią się **wszystkie komponenty**:
- ✅ **Server** (serwer API) - na porcie dostarczonym przez Railway (zmienna `PORT`)
- ✅ **Collector** (procesor dokumentów) - na porcie 8888 wewnątrz kontenera
- ✅ **Frontend** (interfejs webowy) - wbudowany w server i serwowany przez niego

Wszystkie komponenty działają w **jednym kontenerze Docker** i automatycznie uruchamiają się przez `docker-entrypoint.sh`.

## 🎯 Kroki do wdrożenia

### 1. Przygotowanie repozytorium

```bash
git add .
git commit -m "Ready for Railway deployment"
git push
```

### 2. Utworzenie projektu na Railway

1. Zaloguj się do [Railway Dashboard](https://railway.app/dashboard)
2. Kliknij **"New Project"**
3. Wybierz **"Deploy from GitHub repo"**
4. Wybierz swoje repozytorium `anything-llm-vlad`

### 3. Dodanie bazy danych PostgreSQL (WYMAGANE!)

1. W Railway Dashboard otwórz swój projekt
2. Kliknij **"+ New"** → wybierz **"Database"** → wybierz **"PostgreSQL"**
3. Railway automatycznie utworzy zmienną środowiskową `DATABASE_URL`
4. Migracje Prisma zostaną wykonane automatycznie przy pierwszym uruchomieniu

### 4. Konfiguracja zmiennych środowiskowych

W ustawieniach swojego serwisu (Settings → Variables) dodaj:

#### Wymagane zmienne:

```env
NODE_ENV=production
```

#### Ustawienia LLM (wybierz jednego dostawcę):

**OpenRouter:**
```env
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=twój-klucz-od-openrouter
```

**OpenAI:**
```env
LLM_PROVIDER=openai
OPEN_AI_KEY=twój-klucz-od-openai
```

**Anthropic:**
```env
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=twój-klucz-od-anthropic
```

#### Dodatkowe ustawienia:

```env
# Baza danych wektorowa (domyślnie LanceDB)
VECTOR_DB=lancedb

# Silnik embeddingów (domyślnie inherit)
EMBEDDING_ENGINE=inherit

# Wyłączyć telemetrię (opcjonalnie)
DISABLE_TELEMETRY=true

# Port dla collector (domyślnie 8888, zwykle nie trzeba zmieniać)
COLLECTOR_PORT=8888
```

### 5. Konfiguracja magazynu (opcjonalnie, ale zalecane)

Railway zapewnia trwałe magazyn. Upewnij się, że zmienna `STORAGE_DIR` jest ustawiona:

```env
STORAGE_DIR=/app/server/storage
```

Lub Railway może używać volume do trwałego przechowywania danych.

### 6. Wdrożenie

Railway automatycznie:
1. ✅ Wykryje `Dockerfile` w katalogu głównym projektu
2. ✅ Zbuduje obraz Docker
3. ✅ Uruchomi kontener z server i collector
4. ✅ Wykona migracje bazy danych
5. ✅ Zapewni publiczny URL

### 7. Sprawdzenie działania

Po wdrożeniu:
1. Railway zapewni URL Twojej aplikacji (np.: `https://your-app.railway.app`)
2. Otwórz ten URL w przeglądarce
3. Powinieneś zobaczyć interfejs webowy AnythingLLM

## 🔍 Sprawdzanie statusu komponentów

Po wdrożeniu wszystkie komponenty powinny działać:

- **Server**: dostępny przez publiczny URL Railway
- **Collector**: działa wewnątrz kontenera na porcie 8888, dostępny dla server przez `localhost:8888`
- **Frontend**: serwowany przez server pod tym samym URL

## 🐛 Rozwiązywanie problemów

### Błąd "DATABASE_URL is not set"

**Rozwiązanie**: Upewnij się, że dodałeś serwis PostgreSQL do projektu Railway. Railway automatycznie ustawi `DATABASE_URL`.

### Błąd "Document processing API is not online"

**Rozwiązanie**: 
- Sprawdź logi w Railway Dashboard
- Upewnij się, że collector się uruchomił (powinno być komunikatu "Document processor app listening on port 8888")
- Sprawdź, czy `COLLECTOR_PORT=8888` jest ustawione (lub nie ustawione, wtedy użyta zostanie wartość domyślna)

### Błędy przy migracji bazy danych

**Rozwiązanie**:
- Sprawdź, czy serwis PostgreSQL jest dodany i działa
- Sprawdź logi w Railway Dashboard - tam będą szczegóły błędów migracji
- Upewnij się, że `DATABASE_URL` jest poprawnie ustawiony

### Aplikacja nie uruchamia się

**Rozwiązanie**:
1. Sprawdź logi w Railway Dashboard
2. Upewnij się, że wszystkie wymagane zmienne środowiskowe są ustawione
3. Sprawdź, czy serwis PostgreSQL działa
4. Upewnij się, że dostawca LLM jest poprawnie skonfigurowany

## 📝 Ważne uwagi

1. **Jeden kontener = wszystkie komponenty**: Server, Collector i Frontend działają w jednym kontenerze
2. **Porty**: Railway automatycznie ustawia `PORT` dla server. Collector działa na 8888 wewnątrz kontenera
3. **Baza danych**: PostgreSQL jest wymagana! SQLite nie jest zalecane dla produkcji na Railway
4. **Magazyn**: Dane dokumentów są przechowywane w `/app/server/storage` wewnątrz kontenera. Do trwałego przechowywania użyj Railway Volumes

## 🎉 Gotowe!

Po pomyślnym wdrożeniu Twoja aplikacja będzie dostępna pod URL, który zapewni Railway. Wszystkie komponenty (server, collector, frontend) będą działać automatycznie!

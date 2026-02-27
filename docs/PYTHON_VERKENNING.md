# Python Verkenning voor OIL Dashboard

> Status: Verkennend document — geen beslissing genomen
> Datum: 2026-02-27

## Wat is Python?

Python is een programmeertaal die sinds 1991 bestaat en inmiddels de meest
gebruikte taal ter wereld is voor data-analyse, machine learning en
automatisering. De kracht zit in de leesbaarheid en het enorme ecosysteem aan
bibliotheken.

### Kernkenmerken

- **Leesbare syntax** — code leest bijna als pseudo-code
- **Groot ecosysteem** — 400.000+ bibliotheken op PyPI
- **Sterk in data** — pandas, NumPy, scikit-learn, TensorFlow
- **Cross-platform** — draait op Linux, macOS, Windows
- **Gratis en open source**

### Eenvoudig voorbeeld

```python
# Bereken SVASO-allocatie (vereenvoudigd)
marktprijzen = {
    "filet": 8.50,
    "poot": 3.20,
    "vleugel": 2.10,
    "rest": 0.80,
}

totale_waarde = sum(marktprijzen.values())

for deel, prijs in marktprijzen.items():
    aandeel = prijs / totale_waarde * 100
    print(f"{deel:10s}: {aandeel:5.1f}% van batchkosten")
```

Output:
```
filet     :  58.2% van batchkosten
poot      :  21.9% van batchkosten
vleugel   :  14.4% van batchkosten
rest      :   5.5% van batchkosten
```

## Huidige situatie OIL Dashboard

| Aspect | Status |
|---|---|
| Taal | 100% TypeScript |
| Runtime | Node.js via Next.js |
| Database | Supabase (PostgreSQL) |
| Rekenmodules | TypeScript + Decimal.js |
| Python gebruik | Geen |

Alle huidige functionaliteit (SVASO, cherry-picker, massabalans, THT) werkt
prima in TypeScript. Python is **niet nodig** om het bestaande systeem te
vervangen.

## Waar Python meerwaarde kan bieden

### 1. Voorspellende yield-analyse

Met historische batch-data kunnen we modellen trainen die opbrengsten
voorspellen. Denk aan:

- Verwachte yield per seizoen, leverancier of voertype
- Vroege waarschuwing bij afwijkende batches
- Trendlijnen en prognoses voor management

**Bibliotheek**: scikit-learn, Prophet (Meta), statsmodels

### 2. Snijplan-optimalisatie

Gegeven fluctuerende marktprijzen: wat is de optimale verdeling van een kip
om maximale marge te halen?

```python
from scipy.optimize import linprog

# Maximaliseer totale opbrengst gegeven anatomische beperkingen
# (filet max 22%, poot max 30%, etc.)
```

**Bibliotheek**: scipy.optimize, PuLP

### 3. Anomalie-detectie op kosten en yields

Automatisch signaleren wanneer een batch significant afwijkt van het
verwachte patroon, zonder handmatige drempels in te stellen.

**Bibliotheek**: scikit-learn (Isolation Forest), PyOD

### 4. Geavanceerde rapportage-generatie

Geautomatiseerde PDF/Excel-rapporten met grafieken, draaitabellen en
samenvattingen die verder gaan dan wat de huidige xlsx-bibliotheek biedt.

**Bibliotheek**: pandas, matplotlib, openpyxl, reportlab

### 5. Externe data-integratie

Python-scripts om marktprijzen, voerprijzen of andere externe bronnen
periodiek op te halen en in Supabase te laden.

**Bibliotheek**: requests, beautifulsoup4, schedule

## Hoe past Python in onze architectuur?

### Optie A: Python als microservice (aanbevolen)

```
Next.js (bestaand)  ──HTTP──▶  FastAPI service (nieuw)
       │                              │
       ▼                              ▼
    Supabase ◀────── SQL ──────── Supabase
```

- Python draait als aparte service (bv. op Vercel Serverless, Railway, of Fly.io)
- Communicatie via REST API
- Geen wijziging aan bestaande TypeScript code nodig
- Onafhankelijk te deployen en schalen

### Optie B: Python scripts als achtergrondtaken

```
Cron / GitHub Action ──▶ Python script ──▶ Supabase
```

- Nachtelijke of wekelijkse taken (rapportage, data-import)
- Geen realtime integratie met het dashboard
- Simpelste optie om mee te starten

### Optie C: Alles in TypeScript houden

- TensorFlow.js voor ML in Node.js
- Beperktere keuze aan bibliotheken
- Geen extra service om te beheren

## Aanbeveling

**Start klein met Optie B**: een Python-script dat wekelijks yield-trends
analyseert en de resultaten naar Supabase schrijft. Dit geeft het team
ervaring met Python zonder de productie-architectuur te veranderen.

Als de meerwaarde bewezen is, kan later opgeschaald worden naar Optie A met
een FastAPI microservice.

## Benodigde stappen om te starten

1. Python 3.11+ installeren in de ontwikkelomgeving
2. Een `scripts/` map aanmaken voor Python-scripts
3. `requirements.txt` met afhankelijkheden (pandas, supabase-py)
4. Eerste script: historische yield-analyse uit Supabase
5. Resultaten terugschrijven naar een `analytics_results` tabel
6. Dashboard-pagina bouwen om resultaten te tonen

## Vergelijking Python vs TypeScript

| Criterium | Python | TypeScript |
|---|---|---|
| Data-analyse | Uitstekend (pandas, NumPy) | Beperkt |
| Machine learning | Uitstekend (scikit-learn, TF) | Matig (TF.js) |
| Webontwikkeling | Goed (FastAPI, Django) | Uitstekend (Next.js) |
| Snelheid | Matig | Goed |
| Bestaande codebase | Nieuw te leren | Al in gebruik |
| Ecosysteem data | Veruit het grootst | Groeiend |
| Leercurve | Laag (makkelijke syntax) | Al bekend bij team |

## Conclusie

Python is **niet nodig** om het huidige OIL Dashboard te vervangen, maar kan
**wel meerwaarde** bieden als aanvulling voor data-analyse, voorspellingen en
automatisering. De drempel is laag: Python is makkelijk te leren en kan naast
het bestaande TypeScript-systeem draaien zonder iets kapot te maken.
